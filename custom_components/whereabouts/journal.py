"""Log of data maintenance and the trash to undo it (0.7.3).

Every action that changes stored data (data maintenance, import, deleting,
restoring) writes an entry to ``journal.json``. Before an action writes a
day file, the file is copied into its own trash folder
``trash/<entry id>/`` ("Backup"); "Restore" copies these files back. A day
that did not exist before is removed again on restore.

Entries are only removed when an administrator deletes them. Trash folders
are removed after ``trash_days`` (0 = never); the entry stays, it just can no
longer be restored. Every method here does file access: call it in the
executor.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import threading
from datetime import datetime
from typing import Any

JOURNAL_FILE = "journal.json"
TRASH_FOLDER = "trash"
META_FILE = "meta.json"
HINT_ENTRIES = 300  # from here on the settings page suggests cleaning up
MAX_ENTRIES = 5000  # hard limit, so the file can never grow without end

_ID = re.compile(r"^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$")


def is_valid_id(value: str) -> bool:
    return bool(_ID.match(value or ""))


def _state(path: str) -> list[int] | None:
    """What a file looks like now (size, change time) - None when it does not exist."""
    try:
        info = os.stat(path)
    except FileNotFoundError:
        return None
    return [info.st_size, info.st_mtime_ns]


def folder_size(folder: str) -> tuple[int, int]:
    """(bytes, files) of the files directly in ``folder`` and one level below."""
    total = files = 0
    try:
        entries = list(os.scandir(folder))
    except FileNotFoundError:
        return 0, 0
    for entry in entries:
        if entry.is_file(follow_symlinks=False):
            total += entry.stat(follow_symlinks=False).st_size
            files += 1
        elif entry.is_dir(follow_symlinks=False):
            size, count = folder_size_flat(entry.path)
            total += size
            files += count
    return total, files


def folder_size_flat(folder: str) -> tuple[int, int]:
    total = files = 0
    try:
        entries = list(os.scandir(folder))
    except FileNotFoundError:
        return 0, 0
    for entry in entries:
        if entry.is_file(follow_symlinks=False):
            total += entry.stat(follow_symlinks=False).st_size
            files += 1
    return total, files


def history_size(folder: str) -> dict[str, Any]:
    """Size of the stored history: total and per person (only file sizes are read)."""
    persons: dict[str, dict[str, int]] = {}
    try:
        entries = list(os.scandir(folder))
    except FileNotFoundError:
        entries = []
    for entry in entries:
        name = entry.name
        if not name.endswith(".csv") or "_" not in name or not entry.is_file(follow_symlinks=False):
            continue
        person = name[:-4].rsplit("_", 1)[0]
        found = persons.setdefault(person, {"bytes": 0, "days": 0})
        found["bytes"] += entry.stat(follow_symlinks=False).st_size
        found["days"] += 1
    return {
        "bytes": sum(p["bytes"] for p in persons.values()),
        "days": sum(p["days"] for p in persons.values()),
        "persons": dict(sorted(persons.items())),
    }


class Backup:
    """The day files one action changed, as they were before."""

    def __init__(self, folder: str) -> None:
        self.folder = folder
        self.saved: dict[str, bool] = {}  # file name: existed before

    def save(self, path: str) -> None:
        """Called by the storage right before ``path`` is written or removed (lock held)."""
        name = os.path.basename(path)
        if name in self.saved:
            return
        os.makedirs(self.folder, mode=0o700, exist_ok=True)
        existed = os.path.exists(path)
        if existed:
            target = os.path.join(self.folder, name)
            shutil.copyfile(path, target)
            os.chmod(target, 0o600)
        self.saved[name] = existed


class Journal:
    """journal.json and the trash folders below ``base`` (<config>/whereabouts)."""

    def __init__(self, base: str, history: str) -> None:
        self.base = base
        self.history = history
        self.path = os.path.join(base, JOURNAL_FILE)
        self.trash = os.path.join(base, TRASH_FOLDER)
        self._lock = threading.Lock()

    # --- file ----------------------------------------------------------------------------
    def _read(self) -> list[dict[str, Any]]:
        try:
            with open(self.path, encoding="utf-8") as file:
                data = json.load(file)
        except (FileNotFoundError, ValueError):
            return []
        if not isinstance(data, list):
            return []
        return [e for e in data if isinstance(e, dict) and is_valid_id(str(e.get("id", "")))]

    def _write(self, entries: list[dict[str, Any]]) -> None:
        os.makedirs(self.base, mode=0o700, exist_ok=True)
        temp = self.path + ".tmp"
        with open(temp, "w", encoding="utf-8") as file:
            json.dump(entries[:MAX_ENTRIES], file, ensure_ascii=False, separators=(",", ":"))
        os.chmod(temp, 0o600)
        os.replace(temp, self.path)

    def _folder(self, entry_id: str) -> str:
        if not is_valid_id(entry_id):
            raise ValueError("invalid id")
        return os.path.join(self.trash, entry_id)

    # --- writing ---------------------------------------------------------------------------
    @staticmethod
    def new_id(now: datetime) -> str:
        return f"{now.strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}"

    def backup(self, entry_id: str) -> Backup:
        return Backup(self._folder(entry_id))

    def add(self, entry: dict[str, Any], backup: Backup | None = None) -> dict[str, Any]:
        """Store an entry (newest first). With a backup that saved files, it can be restored."""
        entry = dict(entry)
        if backup is not None and backup.saved:
            after = {name: _state(os.path.join(self.history, name)) for name in backup.saved}
            meta = {"files": backup.saved, "after": after}
            with open(os.path.join(backup.folder, META_FILE), "w", encoding="utf-8") as file:
                json.dump(meta, file)
            entry["trash"] = True
            entry["size"] = folder_size_flat(backup.folder)[0]
            entry["days"] = len(backup.saved)
        else:
            entry["trash"] = False
            entry["size"] = 0
            entry.setdefault("days", 0)
            if backup is not None:
                shutil.rmtree(backup.folder, ignore_errors=True)
        with self._lock:
            entries = self._read()
            entries.insert(0, entry)
            self._write(entries)
        return entry

    def update(self, entry_id: str, values: dict[str, Any]) -> None:
        with self._lock:
            entries = self._read()
            for entry in entries:
                if entry["id"] == entry_id:
                    entry.update(values)
                    self._write(entries)
                    return

    # --- reading ---------------------------------------------------------------------------
    def entries(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._read()

    def summary(self) -> dict[str, Any]:
        entries = self.entries()
        size, _ = folder_size(self.trash)
        return {
            "entries": len(entries),
            "hint": len(entries) >= HINT_ENTRIES,
            "trash_bytes": size,
            "trash_entries": sum(1 for e in entries if e.get("trash")),
        }

    def _meta(self, entry_id: str) -> dict[str, Any] | None:
        try:
            with open(os.path.join(self._folder(entry_id), META_FILE), encoding="utf-8") as file:
                meta = json.load(file)
        except (FileNotFoundError, ValueError):
            return None
        files = meta.get("files") if isinstance(meta, dict) else None
        if not isinstance(files, dict):
            return None
        return meta

    def changed_since(self, entry_id: str) -> list[str] | None:
        """Day files changed after the action ("person_date"); None when nothing can be restored."""
        meta = self._meta(entry_id)
        if meta is None:
            return None
        after = meta.get("after") or {}
        changed = []
        for name in meta["files"]:
            if _state(os.path.join(self.history, name)) != after.get(name):
                changed.append(name[:-4])
        return sorted(changed)

    def restore_files(self, entry_id: str, backup: Backup) -> int:
        """Put the saved files back (call with the storage lock held). Returns the number of days."""
        meta = self._meta(entry_id)
        if meta is None:
            raise FileNotFoundError(entry_id)
        folder = self._folder(entry_id)
        count = 0
        for name, existed in sorted(meta["files"].items()):
            if not re.match(r"^[a-z0-9_]{1,100}_\d{4}-\d{2}-\d{2}\.csv$", name):
                continue
            target = os.path.join(self.history, name)
            backup.save(target)
            if existed:
                source = os.path.join(folder, name)
                if not os.path.exists(source):
                    continue
                os.makedirs(self.history, mode=0o700, exist_ok=True)
                temp = target + ".tmp"
                shutil.copyfile(source, temp)
                os.chmod(temp, 0o600)
                os.replace(temp, target)
            elif os.path.exists(target):
                os.remove(target)
            count += 1
        return count

    # --- removing --------------------------------------------------------------------------
    def delete(self, ids: list[str] | None = None, before: str = "") -> int:
        """Delete entries (by id, or all older than ``before`` YYYY-MM-DD) with their trash."""
        wanted = set(ids or [])
        limit = before.replace("-", "")
        with self._lock:
            entries = self._read()
            keep, gone = [], []
            for entry in entries:
                if entry["id"] in wanted or (limit and entry["id"][:8] < limit):
                    gone.append(entry)
                else:
                    keep.append(entry)
            if gone:
                self._write(keep)
        for entry in gone:
            shutil.rmtree(self._folder(entry["id"]), ignore_errors=True)
        return len(gone)

    def expire(self, before: str) -> int:
        """Remove trash older than ``before`` (YYYY-MM-DD); the entries stay. Returns how many."""
        limit = before.replace("-", "")
        removed = 0
        with self._lock:
            entries = self._read()
            for entry in entries:
                if entry.get("trash") and entry["id"][:8] < limit:
                    shutil.rmtree(self._folder(entry["id"]), ignore_errors=True)
                    entry["trash"] = False
                    entry["expired"] = True
                    removed += 1
            if removed:
                self._write(entries)
            known = {e["id"] for e in entries if e.get("trash")}
        # folders without an entry (e.g. an action that broke off)
        try:
            names = os.listdir(self.trash)
        except FileNotFoundError:
            names = []
        for name in names:
            if is_valid_id(name) and name not in known and name[:8] < limit:
                shutil.rmtree(os.path.join(self.trash, name), ignore_errors=True)
        return removed
