"""Files the integration prepares for download (0.7.10): export ZIP files, later PDF and Excel.

The files lie in <config>/whereabouts/exports/ and are deleted after 24 hours. They are
handed out by ``DownloadView``: only with a Home Assistant login or a signed link
(``auth/sign_path``), only files of the form ``<token>_<name>.zip|pdf|xlsx`` that this
integration made, always as an attachment. The page asks for a signed link, because the
Home Assistant apps cannot download a ``blob:`` address.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import time
import uuid
from http import HTTPStatus

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN, STORAGE_FOLDER

_LOGGER = logging.getLogger(__name__)

EXPORT_FOLDER = "exports"
MAX_AGE_SECONDS = 24 * 3600
TEMP_PREFIX = "tmp_"
# <12 hex characters>_<name>.<type>; nothing else is ever handed out
FILE_NAME = re.compile(r"^[0-9a-f]{12}_[A-Za-z0-9._-]{1,80}\.(zip|pdf|xlsx)$")
CONTENT_TYPES = {
    "zip": "application/zip",
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def exports_folder(hass: HomeAssistant) -> str:
    return hass.config.path(STORAGE_FOLDER, EXPORT_FOLDER)


def new_token() -> str:
    return uuid.uuid4().hex[:12]


def safe_name(name: str) -> str:
    """A file name part with only letters, digits, dot, dash and underscore."""
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")[:60] or "whereabouts"


def final_name(token: str, name: str, kind: str) -> str:
    """``<token>_<name>.<kind>`` - the form ``DownloadView`` accepts."""
    return f"{token}_{safe_name(name)}.{kind}"


def cleanup(folder: str, max_age: float = MAX_AGE_SECONDS, now: float | None = None) -> int:
    """Delete files and temporary folders older than ``max_age`` seconds (runs in the executor)."""
    now = time.time() if now is None else now
    removed = 0
    try:
        names = os.listdir(folder)
    except OSError:
        return 0
    for name in names:
        path = os.path.join(folder, name)
        try:
            if now - os.path.getmtime(path) <= max_age:
                continue
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            else:
                os.remove(path)
            removed += 1
        except OSError:
            continue
    return removed


class DownloadView(HomeAssistantView):
    """GET /api/whereabouts/download/<file>  (login or signed path)."""

    url = "/api/whereabouts/download/{name}"
    name = "api:whereabouts:download"
    requires_auth = True

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        hass: HomeAssistant = request.app["hass"]
        if hass.data.get(DOMAIN) is None:
            return self.json_message("Whereabouts is not set up", HTTPStatus.NOT_FOUND)
        if not FILE_NAME.match(name):
            return self.json_message("Invalid request", HTTPStatus.BAD_REQUEST)
        path = os.path.join(exports_folder(hass), name)
        exists = await hass.async_add_executor_job(os.path.isfile, path)
        if not exists:
            return self.json_message("Not found", HTTPStatus.NOT_FOUND)
        kind = name.rsplit(".", 1)[1]
        shown = name.split("_", 1)[1]
        return web.FileResponse(
            path,
            headers={
                "Content-Type": CONTENT_TYPES[kind],
                "Content-Disposition": f'attachment; filename="{shown}"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
