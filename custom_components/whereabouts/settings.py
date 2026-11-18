"""Settings of the sidebar page and the cards: per user, with defaults, locks and rights.

Stored with Home Assistant's own storage helper in ``.storage/whereabouts.settings``
(part of every Home Assistant backup). Layout:

- ``defaults``: the administrator's values for every personal category
- ``users``: ``{user_id: {category: {key: value}}}`` - only what a user changed
- ``locks``: ``{category: {"mode": "none"|"all"|"selected", "except": [...], "users": [...]}}``
  "all" locks the category for every non-admin except the listed users,
  "selected" only for the listed users. Locked = the user gets the defaults.
- ``rights_default``: ``{"live"|"history"|"delete": "all"|"own"|"none"}`` for users
  without own rights; ``rights``: ``{user_id: {"live": [...], "history": [...], "delete": [...]}}``
- ``all_flags`` / ``user_flags``: synchronise with an administrator's settings
  (``sync``) and hide the settings tab (``hide_settings``) - for everybody, or
  per user (a per-user value wins); ``sync.user_id``: whose settings are used
- ``field_locks``: ``{user_id: {category: ["*"] | [key, ...]}}`` - single
  settings (or whole categories) an administrator fixed for one user

Administrators are never locked and may see and delete everything.
"""

from __future__ import annotations

import copy
import re
from typing import Any

import voluptuous as vol
from homeassistant.auth.models import User
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import ACCESS_ADMINS, ACCESS_EVERYONE, CONF_DELETE_ACCESS, CONF_HISTORY_ACCESS

STORAGE_KEY = "whereabouts.settings"
STORAGE_VERSION = 1

_COLOR = vol.Match(r"^#[0-9A-Fa-f]{6}$")
_URL = vol.All(str, vol.Length(max=500))
_PERSON = vol.Match(r"^person\.[a-z0-9_]{1,100}$")
_ZONE = vol.Match(r"^zone\.[a-z0-9_]{1,100}$")
_PERSON_SETTING = vol.Schema(
    {
        vol.Optional("name"): vol.All(str, vol.Length(max=60)),
        vol.Optional("color"): _COLOR,
        vol.Optional("picture"): _URL,
        # in which map the person appears
        vol.Optional("show_in"): vol.In(["both", "live", "history"]),
    }
)

MAP_APPS = ["google", "apple", "osm", "waze", "here"]
CARTO_STYLES = ["voyager", "voyager_nolabels", "positron", "positron_nolabels", "dark_matter", "dark_matter_nolabels"]

# Personal categories: key -> (default, validator). The order is the order on the page.
CATEGORIES: dict[str, dict[str, tuple[Any, Any]]] = {
    "views": {
        "view_live": (True, bool),
        "view_history": (True, bool),
        "view_settings": (True, bool),
        "start_view": ("live", vol.In(["live", "history", "settings"])),
    },
    "persons": {
        "persons": ([], vol.All([_PERSON], vol.Length(max=100))),
        "person_settings": ({}, vol.Schema({_PERSON: _PERSON_SETTING})),
    },
    "map": {
        "map_style": ("auto", vol.In(["auto", "light", "dark"])),
        "tiles": ("esri", vol.In(["esri", "osm", "carto"])),
        "map_link": ("google", vol.In(["google", "apple", "osm", "waze", "here", "none"])),
        "map_link_choice": (True, bool),
        # which map apps are offered when choosing is on
        "map_link_apps": (["apple", "google"], vol.All([vol.In(MAP_APPS)], vol.Length(max=len(MAP_APPS)))),
        # CARTO styles per map and light/dark
        "carto_live_light": ("voyager", vol.In(CARTO_STYLES)),
        "carto_live_dark": ("dark_matter", vol.In(CARTO_STYLES)),
        "carto_history_light": ("voyager", vol.In(CARTO_STYLES)),
        "carto_history_dark": ("dark_matter", vol.In(CARTO_STYLES)),
    },
    "zones": {
        # in which map the zones are drawn
        "zones_in": ("both", vol.In(["both", "live", "history", "none"])),
        "zone_color_home": ("#2E7D32", _COLOR),
        "zone_color": ("#EF6C00", _COLOR),
        "zone_names_zoom": (14, vol.All(vol.Coerce(int), vol.Range(min=1, max=20))),
        "hidden_zones": ([], vol.All([_ZONE], vol.Length(max=500))),
        "zone_colors": ({}, vol.Schema({_ZONE: _COLOR})),
    },
    "live": {
        "show_info_bar": (True, bool),
        "show_status_bar": (True, bool),
        "show_accuracy": (True, bool),
        "follow": (True, bool),
        "live_auto_refresh": (True, bool),
        "live_refresh_interval": (30, vol.All(vol.Coerce(int), vol.Range(min=5, max=3600))),
    },
    "history": {
        # start view: route ("map"), heat map or table
        "default_view": ("map", vol.In(["map", "heat", "table"])),
        "start_period": ("today", vol.In(["today", "3d", "7d", "4w"])),
        # points of the route are hidden from this many entries on (0 = always shown)
        "simplify_points": (400, vol.All(vol.Coerce(int), vol.Range(min=0, max=100000))),
        "show_legend": (True, bool),
        "show_export": (True, bool),
        "history_auto_refresh": (True, bool),
        "history_refresh_interval": (30, vol.All(vol.Coerce(int), vol.Range(min=10, max=3600))),
    },
}

RIGHT_KINDS = ("live", "history", "delete")
RIGHT_LEVELS = ("all", "own", "none")
LOCK_MODES = ("none", "all", "selected")
_USER_ID = vol.Match(r"^[0-9a-f]{32}$")


def category_defaults(category: str) -> dict[str, Any]:
    return {key: copy.deepcopy(default) for key, (default, _) in CATEGORIES[category].items()}


def validate_values(category: str, values: dict[str, Any]) -> dict[str, Any]:
    """Only known keys with valid values; raises vol.Invalid otherwise."""
    if category not in CATEGORIES:
        raise vol.Invalid(f"unknown category {category}")
    spec = CATEGORIES[category]
    schema = vol.Schema({vol.Optional(key): validator for key, (_, validator) in spec.items()})
    return schema(values)


def _legacy_level(level: str | None, new: str = "all") -> str:
    """0.1.x option -> rule. Without that option (new installation): ``new``."""
    if level is None:
        return new
    if level == ACCESS_EVERYONE:
        return "all"
    if level == ACCESS_ADMINS:
        return "none"
    return "own"


class Settings:
    """Load, change and evaluate the settings."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY, private=True)
        self.data: dict[str, Any] = {}

    async def async_load(self, legacy_options: dict | None = None) -> None:
        data = await self._store.async_load() or {}
        legacy = legacy_options or {}
        data.setdefault("defaults", {})
        data.setdefault("users", {})
        data.setdefault("locks", {})
        data.setdefault("rights", {})
        data.setdefault("sync", {"enabled": False, "user_id": ""})
        data.setdefault("user_flags", {})
        data.setdefault("field_locks", {})
        # 0.5: users seen by an administrator (None = not yet initialised: all
        # existing users count as known) and new users waiting for a decision
        # (user_id -> administrator whose settings they get meanwhile)
        data.setdefault("known_users", None)
        data.setdefault("pending_users", {})
        # 0.3: one switch "synchronise with all users"
        data.setdefault("all_flags", {"sync": bool(data["sync"].get("enabled")), "hide_settings": False})
        data["sync"].pop("enabled", None)
        # 0.1.x: who may see/delete the history was one option for everybody.
        # New installations: everybody sees everything, only administrators delete.
        data.setdefault(
            "rights_default",
            {
                "live": "all",
                "history": _legacy_level(legacy.get(CONF_HISTORY_ACCESS)),
                "delete": _legacy_level(legacy.get(CONF_DELETE_ACCESS), "none"),
            },
        )
        # 0.3: "show zones" on/off -> in which map
        for values in [data["defaults"], *data["users"].values()]:
            zones = values.get("zones")
            if isinstance(zones, dict) and "show_zones" in zones:
                zones["zones_in"] = "both" if zones.pop("show_zones") else "none"
        self.data = data
        self._prune()

    def _prune(self) -> None:
        """0.5: values equal to what applies anyway are no own values."""
        for cat in CATEGORIES:
            built_in = category_defaults(cat)
            values = self.data["defaults"].get(cat)
            if isinstance(values, dict):
                for key in [k for k, v in values.items() if k not in built_in or v == built_in[k]]:
                    values.pop(key)
                if not values:
                    self.data["defaults"].pop(cat)
        defaults = self.defaults()
        for uid in list(self.data["users"]):
            own = self.data["users"][uid]
            for cat in list(own):
                values = own[cat]
                if cat not in CATEGORIES or not isinstance(values, dict):
                    own.pop(cat)
                    continue
                for key in [k for k, v in values.items() if k not in defaults[cat] or v == defaults[cat][k]]:
                    values.pop(key)
                if not values:
                    own.pop(cat)
            if not own:
                self.data["users"].pop(uid)

    async def async_save(self) -> None:
        await self._store.async_save(self.data)

    # --- personal values ---------------------------------------------------
    def defaults(self) -> dict[str, dict[str, Any]]:
        return {cat: {**category_defaults(cat), **self.data["defaults"].get(cat, {})} for cat in CATEGORIES}

    def own(self, user_id: str) -> dict[str, dict[str, Any]]:
        return copy.deepcopy(self.data["users"].get(user_id, {}))

    def is_locked(self, category: str, user: User | None) -> bool:
        """The whole category is fixed for this user (for all users, or just for them)."""
        if user is None or user.is_admin:
            return False
        if "*" in self.field_locks(user.id).get(category, []):
            return True
        return self._globally_locked(category, user)

    def _globally_locked(self, category: str, user: User) -> bool:
        """Locked by the lock for all users: the user gets the defaults."""
        lock = self.data["locks"].get(category) or {}
        mode = lock.get("mode", "none")
        if mode == "all":
            return user.id not in lock.get("except", [])
        if mode == "selected":
            return user.id in lock.get("users", [])
        return False

    def locked_categories(self, user: User | None) -> list[str]:
        if self.synced(user):
            return list(CATEGORIES)
        return [cat for cat in CATEGORIES if self.is_locked(cat, user)]

    def field_locks(self, user_id: str) -> dict[str, list[str]]:
        return copy.deepcopy(self.data["field_locks"].get(user_id, {}))

    def locked_keys(self, user: User | None, category: str) -> list[str]:
        """Single settings of a category fixed for this user ("*" = all)."""
        if user is None or user.is_admin:
            return []
        if self.is_locked(category, user):
            return ["*"]
        return [k for k in self.field_locks(user.id).get(category, []) if k != "*"]

    def flag(self, user_id: str, name: str) -> bool:
        """Per-user value of sync / hide_settings, otherwise the value for everybody."""
        own = self.data["user_flags"].get(user_id, {})
        if name in own:
            return bool(own[name])
        return bool(self.data["all_flags"].get(name))

    def sync_source(self, user: User | None) -> str | None:
        """Whose settings apply to this (non-admin) user right now, if an administrator's."""
        if user is None or user.is_admin:
            return None
        if self.data["sync"].get("user_id") and self.flag(user.id, "sync"):
            return self.data["sync"]["user_id"]
        # new user, no decision yet: like the administrator who saw them
        return self.data["pending_users"].get(user.id) or None

    def synced(self, user: User | None) -> bool:
        """An administrator's settings apply to this (non-admin) user right now."""
        return self.sync_source(user) is not None

    def settings_hidden(self, user: User | None) -> bool:
        """The settings tab is hidden for this (non-admin) user."""
        return bool(user and not user.is_admin and (self.synced(user) or self.flag(user.id, "hide_settings")))

    def effective(self, user: User | None) -> dict[str, dict[str, Any]]:
        """Defaults, overwritten by the user's own values where not locked.

        With synchronisation on, non-admins get the settings of the
        administrator who switched it on (their own values stay stored)."""
        result = self.defaults()
        if user is None:
            return result
        if (source := self.sync_source(user)) is not None:
            own = self.data["users"].get(source, {})
            for cat in CATEGORIES:
                result[cat].update(copy.deepcopy(own.get(cat, {})))
            return result
        own = self.data["users"].get(user.id, {})
        for cat in CATEGORIES:
            # Fixed for this user alone: the values the administrator set for them still apply.
            if user.is_admin or not self._globally_locked(cat, user):
                result[cat].update(copy.deepcopy(own.get(cat, {})))
        return result

    async def async_promote(self, user: User, category: str | None) -> None:
        """The user's current values become the defaults (one or all categories)."""
        mine = self.effective(user)
        for cat in [category] if category else list(CATEGORIES):
            self.data["defaults"][cat] = copy.deepcopy(mine[cat])
        self._prune()
        await self.async_save()

    async def async_set_flags(self, admin: User, user_id: str, values: dict[str, bool], admins: set[str]) -> None:
        """Set sync / hide_settings for one user or ("all") for everybody.

        Switching synchronisation off keeps the administrator's settings:
        for everybody they become the defaults and the users' own values are
        removed; for one user they become that user's own values.
        """
        mine = self.effective(admin)
        if "sync" in values and values["sync"]:
            self.data["sync"]["user_id"] = admin.id
        if user_id == "all":
            for name, value in values.items():
                was = bool(self.data["all_flags"].get(name))
                self.data["all_flags"][name] = bool(value)
                for flags in self.data["user_flags"].values():
                    flags.pop(name, None)
                if name == "sync" and was and not value:
                    for cat in CATEGORIES:
                        self.data["defaults"][cat] = copy.deepcopy(mine[cat])
                    for uid in [uid for uid in self.data["users"] if uid not in admins]:
                        self.data["users"].pop(uid, None)
        else:
            flags = self.data["user_flags"].setdefault(user_id, {})
            for name, value in values.items():
                was = self.flag(user_id, name)
                flags[name] = bool(value)
                if name == "sync" and was and not value:
                    self.data["users"][user_id] = copy.deepcopy(mine)
        await self.async_save()

    async def async_set_field_lock(self, user_id: str, category: str, keys: list[str]) -> None:
        """Fix single settings ("*" = the whole category) for one user."""
        if category not in CATEGORIES:
            raise vol.Invalid("unknown category")
        valid = [k for k in keys if k == "*" or k in CATEGORIES[category]]
        locks = self.data["field_locks"].setdefault(user_id, {})
        if valid:
            locks[category] = sorted(set(valid))
        else:
            locks.pop(category, None)
        if not locks:
            self.data["field_locks"].pop(user_id, None)
        await self.async_save()

    async def async_set(self, scope: str, user_id: str, category: str, values: dict[str, Any]) -> None:
        """scope "defaults" or "own" (``user_id`` = whose values; administrators may edit any user)."""
        values = validate_values(category, values)
        if scope == "defaults":
            container = self.data["defaults"]
            base = category_defaults(category)
        else:
            container = self.data["users"].setdefault(user_id, {})
            base = self.defaults()[category]
        target = container.setdefault(category, {})
        for key, value in values.items():
            # a value equal to what applies anyway is no own value
            if value == base.get(key):
                target.pop(key, None)
            else:
                target[key] = value
        if not target:
            container.pop(category, None)
        if scope != "defaults" and not container:
            self.data["users"].pop(user_id, None)
        await self.async_save()

    async def async_reset(self, scope: str, user_id: str, category: str | None) -> None:
        container = self.data["defaults"] if scope == "defaults" else self.data["users"].setdefault(user_id, {})
        if category is None:
            container.clear()
        else:
            container.pop(category, None)
        await self.async_save()

    def _factory_own(self, category: str) -> dict[str, Any]:
        """Own values that make a user see the built-in values despite other defaults."""
        built_in = category_defaults(category)
        defaults = self.defaults()[category]
        return {key: value for key, value in built_in.items() if defaults.get(key) != value}

    def snapshot(self, category: str) -> dict[str, Any]:
        """Everything a reset of this category may change (for "restore")."""
        return {
            "defaults": copy.deepcopy(self.data["defaults"].get(category)),
            "users": {uid: copy.deepcopy(own.get(category)) for uid, own in self.data["users"].items()},
        }

    async def async_restore(self, category: str, snap: dict[str, Any]) -> None:
        if snap["defaults"] is None:
            self.data["defaults"].pop(category, None)
        else:
            self.data["defaults"][category] = copy.deepcopy(snap["defaults"])
        for uid in set(self.data["users"]) | set(snap["users"]):
            value = snap["users"].get(uid)
            own = self.data["users"].setdefault(uid, {})
            if value is None:
                own.pop(category, None)
            else:
                own[category] = copy.deepcopy(value)
            if not own:
                self.data["users"].pop(uid, None)
        await self.async_save()

    async def async_factory_reset(self, user_id: str, category: str, everyone: bool) -> None:
        """Back to the built-in values: for one user, or (administrators) for everybody."""
        if everyone:
            self.data["defaults"].pop(category, None)
            for uid in list(self.data["users"]):
                self.data["users"][uid].pop(category, None)
                if not self.data["users"][uid]:
                    self.data["users"].pop(uid, None)
        else:
            own = self.data["users"].setdefault(user_id, {})
            values = self._factory_own(category)
            if values:
                own[category] = values
            else:
                own.pop(category, None)
            if not own:
                self.data["users"].pop(user_id, None)
        await self.async_save()

    # --- new users ------------------------------------------------------------
    async def async_note_users(self, admin: User, user_ids: list[str]) -> list[str]:
        """Remember the users an administrator saw; new ones wait for a decision.

        Returns the users waiting for a decision."""
        known = self.data["known_users"]
        if known is None:
            # first start of 0.5: everybody already there is known
            self.data["known_users"] = sorted(set(user_ids))
            await self.async_save()
            return list(self.data["pending_users"])
        new = [uid for uid in user_ids if uid not in known]
        if new:
            for uid in new:
                self.data["pending_users"].setdefault(uid, admin.id)
            self.data["known_users"] = sorted(set(known) | set(new))
            await self.async_save()
        return [uid for uid in self.data["pending_users"] if uid in user_ids]

    async def async_decide_users(self, admin: User, user_ids: list[str], action: str) -> None:
        """copy: the administrator's current values once; sync: follow them;
        factory: built-in values; later: keep waiting (meanwhile like the administrator)."""
        if action == "later":
            return
        mine = self.effective(admin)
        defaults = self.defaults()
        for uid in user_ids:
            self.data["pending_users"].pop(uid, None)
            if action == "copy":
                own = {
                    cat: {k: copy.deepcopy(v) for k, v in mine[cat].items() if v != defaults[cat].get(k)}
                    for cat in CATEGORIES
                }
                own = {cat: vals for cat, vals in own.items() if vals}
                if own:
                    self.data["users"][uid] = own
                else:
                    self.data["users"].pop(uid, None)
            elif action == "sync":
                self.data["sync"]["user_id"] = admin.id
                self.data["user_flags"].setdefault(uid, {})["sync"] = True
            elif action == "factory":
                own = {cat: self._factory_own(cat) for cat in CATEGORIES}
                own = {cat: vals for cat, vals in own.items() if vals}
                if own:
                    self.data["users"][uid] = own
                else:
                    self.data["users"].pop(uid, None)
        await self.async_save()

    # --- locks ----------------------------------------------------------------
    async def async_set_lock(self, category: str, mode: str, except_ids: list[str], user_ids: list[str]) -> None:
        if category not in CATEGORIES or mode not in LOCK_MODES:
            raise vol.Invalid("invalid lock")
        self.data["locks"][category] = {"mode": mode, "except": list(except_ids), "users": list(user_ids)}
        await self.async_save()

    # --- rights -----------------------------------------------------------------
    def _all_persons(self) -> list[str]:
        return sorted(self.hass.states.async_entity_ids("person"))

    def _own_persons(self, user: User) -> list[str]:
        return [
            entity_id
            for entity_id in self._all_persons()
            if (state := self.hass.states.get(entity_id)) and state.attributes.get("user_id") == user.id
        ]

    def allowed(self, user: User | None, kind: str) -> list[str]:
        """Persons this user may see live / see the history of / delete the history of."""
        if user is None:
            return []
        if user.is_admin:
            return self._all_persons()
        explicit = self.data["rights"].get(user.id)
        if explicit is not None and kind in explicit:
            existing = set(self._all_persons())
            return [p for p in explicit[kind] if p in existing]
        level = self.data["rights_default"].get(kind, "own")
        if level == "all":
            return self._all_persons()
        if level == "own":
            return self._own_persons(user)
        return []

    async def async_set_rights(self, user_id: str, rights: dict[str, list[str]] | None) -> None:
        if rights is None:
            self.data["rights"].pop(user_id, None)
        else:
            self.data["rights"][user_id] = {kind: list(rights.get(kind, [])) for kind in RIGHT_KINDS}
        await self.async_save()

    async def async_set_rights_default(self, levels: dict[str, str]) -> None:
        for kind, level in levels.items():
            if kind in RIGHT_KINDS and level in RIGHT_LEVELS:
                self.data["rights_default"][kind] = level
        await self.async_save()

    def admin_view(self) -> dict[str, Any]:
        return {
            "defaults": self.defaults(),
            "locks": copy.deepcopy(self.data["locks"]),
            "rights": copy.deepcopy(self.data["rights"]),
            "rights_default": dict(self.data["rights_default"]),
            "sync": dict(self.data.get("sync") or {}),
            "all_flags": dict(self.data["all_flags"]),
            "user_flags": copy.deepcopy(self.data["user_flags"]),
            "field_locks": copy.deepcopy(self.data["field_locks"]),
            "pending_users": dict(self.data["pending_users"]),
            # which categories/keys each user set themselves ("Gilt gerade")
            "own_keys": {
                uid: {cat: sorted(vals) for cat, vals in own.items()} for uid, own in self.data["users"].items()
            },
        }


SAFE_PICTURE = re.compile(r"^(/[^\s\"'()<>\\]*|https?://[^\s\"'()<>\\]+)$")


def card_settings(effective: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Flattened for the cards (same keys as the card configuration)."""
    flat: dict[str, Any] = {}
    for values in effective.values():
        flat.update(values)
    flat["person_settings"] = {
        person: {
            **{k: v for k, v in entry.items() if k != "picture"},
            **({"picture": entry["picture"]} if SAFE_PICTURE.match(entry.get("picture", "") or "") else {}),
        }
        for person, entry in flat.get("person_settings", {}).items()
    }
    return flat
