"""Constants for Whereabouts."""

from __future__ import annotations

DOMAIN = "whereabouts"
NAME = "Whereabouts"

# Folder below the Home Assistant configuration directory. It is NOT below
# www/, so nothing in it is reachable via /local/.
STORAGE_FOLDER = "whereabouts"
HISTORY_FOLDER = "history"
GEOCODE_CACHE_FILE = "geocode_cache.json"

# --- Options ---------------------------------------------------------------
CONF_LIVE_CARD = "live_card"
CONF_HISTORY_CARD = "history_card"
CONF_RECORD_PERSONS = "record_persons"
CONF_SHOW_PERSONS_LIVE = "show_persons_live"  # persons in "Where is…?" (empty = all)
CONF_SHOW_PERSONS_HISTORY = "show_persons_history"  # persons in the history card (empty = all)
CONF_ADDRESS_SOURCE = "address_source"
CONF_ADDRESS_SENSORS = "address_sensors"  # {person entity_id: sensor entity_id}
CONF_MIN_INTERVAL = "min_interval"
CONF_SAME_PLACE_DISTANCE = "same_place_distance"
CONF_ADDRESS_MAX_DISTANCE = "address_max_distance"
CONF_HISTORY_ACCESS = "history_access"
CONF_DELETE_ACCESS = "delete_access"
CONF_RETENTION_DAYS = "retention_days"
CONF_PANEL = "panel"  # entry in the sidebar
CONF_PANEL_TITLE = "panel_title"  # empty = "Standorte" / "Whereabouts" by system language
CONF_PANEL_ICON = "panel_icon"
CONF_CARTO_KEY = "carto_api_key"  # for everybody; a card may have its own

ADDRESS_SOURCE_OFF = "off"
ADDRESS_SOURCE_PHONE = "phone"
ADDRESS_SOURCE_PHONE_OSM = "phone_osm"
ADDRESS_SOURCE_OSM = "osm"
ADDRESS_SOURCES = [
    ADDRESS_SOURCE_PHONE_OSM,
    ADDRESS_SOURCE_PHONE,
    ADDRESS_SOURCE_OSM,
    ADDRESS_SOURCE_OFF,
]

ACCESS_ADMINS = "admins"
ACCESS_ADMINS_AND_SELF = "admins_and_self"
ACCESS_EVERYONE = "everyone"
HISTORY_ACCESS_LEVELS = [ACCESS_ADMINS_AND_SELF, ACCESS_ADMINS, ACCESS_EVERYONE]
DELETE_ACCESS_LEVELS = [ACCESS_ADMINS_AND_SELF, ACCESS_ADMINS]

DEFAULT_OPTIONS: dict = {
    CONF_LIVE_CARD: True,
    CONF_HISTORY_CARD: True,
    # Privacy first: nothing is recorded until persons are chosen.
    CONF_RECORD_PERSONS: [],
    # Shown in the cards; empty = every person in Home Assistant.
    CONF_SHOW_PERSONS_LIVE: [],
    CONF_SHOW_PERSONS_HISTORY: [],
    # The Companion app's geocoded location first; only if it has no fitting
    # address, OpenStreetMap (sends the coordinates of that place).
    CONF_ADDRESS_SOURCE: ADDRESS_SOURCE_PHONE_OSM,
    CONF_ADDRESS_SENSORS: {},
    CONF_MIN_INTERVAL: 60,
    CONF_SAME_PLACE_DISTANCE: 50,
    CONF_ADDRESS_MAX_DISTANCE: 150,
    CONF_HISTORY_ACCESS: ACCESS_ADMINS_AND_SELF,
    CONF_DELETE_ACCESS: ACCESS_ADMINS_AND_SELF,
    # 0 = keep forever. Nothing is ever deleted automatically by default.
    CONF_RETENTION_DAYS: 0,
    CONF_PANEL: True,
    CONF_PANEL_TITLE: "",
    CONF_PANEL_ICON: "mdi:map-marker-radius",
    CONF_CARTO_KEY: "",
}

# Waiting for a fresh phone geocoding after a position update
GEOCODE_WAIT_SECONDS = 6

# OpenStreetMap Nominatim usage policy: max. 1 request/s, own user agent,
# cache results. https://operations.osmfoundation.org/policies/nominatim/
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
NOMINATIM_MIN_GAP_SECONDS = 1.5
NOMINATIM_PAUSE_SECONDS = 3600
PROJECT_URL = "https://github.com/mw-hbg/ha-whereabouts"

# Frontend
FRONTEND_URL_BASE = "/whereabouts_static"

# Sent whenever what the cards show may have changed (options, imports)
SIGNAL_INFO_CHANGED = f"{DOMAIN}_info_changed"
CARDS_FILE = "whereabouts-cards.js"
PANEL_FILE = "whereabouts-panel.js"
PANEL_URL = "whereabouts"  # /whereabouts, /whereabouts/history, /whereabouts/settings
PANEL_ELEMENT = "whereabouts-panel"

STATE_HOME = "home"
STATE_NOT_HOME = "not_home"
