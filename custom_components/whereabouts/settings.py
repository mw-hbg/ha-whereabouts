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
_PERSON_SETTING = vol.Schema(
    {
        vol.Optional("name"): vol.All(str, vol.Length(max=60)),
        vol.Optional("color"): _COLOR,
        vol.Optional("picture"): _URL,
    }
)

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
    },
    "zones": {
        "show_zones": (True, bool),
        "zone_color_home": ("#2E7D32", _COLOR),
        "zone_color": ("#EF6C00", _COLOR),
        "zone_names_zoom": (14, vol.All(vol.Coerce(int), vol.Range(min=1, max=20))),
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
        "default_view": ("map", vol.In(["map", "table"])),
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


def _legacy_level(level: str | None) -> str:
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
        # 0.1.x: who may see/delete the history was one option for everybody
        data.setdefault(
            "rights_default",
            {
                "live": "all",
                "history": _legacy_level(legacy.get(CONF_HISTORY_ACCESS)),
                "delete": _legacy_level(legacy.get(CONF_DELETE_ACCESS)),
            },
        )
        self.data = data

    async def async_save(self) -> None:
        await self._store.async_save(self.data)

    # --- personal values ---------------------------------------------------
    def defaults(self) -> dict[str, dict[str, Any]]:
        return {cat: {**category_defaults(cat), **self.data["defaults"].get(cat, {})} for cat in CATEGORIES}

    def own(self, user_id: str) -> dict[str, dict[str, Any]]:
        return copy.deepcopy(self.data["users"].get(user_id, {}))

    def is_locked(self, category: str, user: User | None) -> bool:
        if user is None or user.is_admin:
            return False
        lock = self.data["locks"].get(category) or {}
        mode = lock.get("mode", "none")
        if mode == "all":
            return user.id not in lock.get("except", [])
        if mode == "selected":
            return user.id in lock.get("users", [])
        return False

    def locked_categories(self, user: User | None) -> list[str]:
        return [cat for cat in CATEGORIES if self.is_locked(cat, user)]

    def effective(self, user: User | None) -> dict[str, dict[str, Any]]:
        """Defaults, overwritten by the user's own values where not locked."""
        result = self.defaults()
        if user is None:
            return result
        own = self.data["users"].get(user.id, {})
        for cat in CATEGORIES:
            if not self.is_locked(cat, user):
                result[cat].update(copy.deepcopy(own.get(cat, {})))
        return result

    async def async_set(self, scope: str, user: User, category: str, values: dict[str, Any]) -> None:
        values = validate_values(category, values)
        if scope == "defaults":
            target = self.data["defaults"].setdefault(category, {})
        else:
            target = self.data["users"].setdefault(user.id, {}).setdefault(category, {})
        target.update(values)
        await self.async_save()

    async def async_reset(self, scope: str, user: User, category: str | None) -> None:
        container = self.data["defaults"] if scope == "defaults" else self.data["users"].setdefault(user.id, {})
        if category is None:
            container.clear()
        else:
            container.pop(category, None)
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
