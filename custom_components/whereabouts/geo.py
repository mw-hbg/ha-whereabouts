"""Positions, zones and the phone's geocoded address."""

from __future__ import annotations

from homeassistant.components.zone import DOMAIN as ZONE_DOMAIN
from homeassistant.const import ATTR_LATITUDE, ATTR_LONGITUDE
from homeassistant.core import HomeAssistant, State
from homeassistant.helpers import entity_registry as er

from .const import STATE_HOME, STATE_NOT_HOME
from .storage import clean_text, distance_m, to_float

ATTR_DEVICE_TRACKERS = "device_trackers"
ATTR_SOURCE_TYPE = "source_type"
ATTR_GPS_ACCURACY = "gps_accuracy"
ATTR_RADIUS = "radius"
SOURCE_GPS = "gps"


def _coords(state: State | None) -> tuple[float, float] | None:
    if state is None:
        return None
    lat = to_float(state.attributes.get(ATTR_LATITUDE))
    lon = to_float(state.attributes.get(ATTR_LONGITUDE))
    if lat is None or lon is None:
        return None
    return lat, lon


def zone_state_for_name(hass: HomeAssistant, name: str) -> State | None:
    """The zone entity a person state refers to ("home" or a zone name)."""
    if name == STATE_HOME:
        return hass.states.get(f"{ZONE_DOMAIN}.home")
    for zone in hass.states.async_all(ZONE_DOMAIN):
        if zone.name == name:
            return zone
    return None


def position_for(hass: HomeAssistant, person: State) -> tuple[float, float] | None:
    """Coordinates for a person state.

    1. The person's own coordinates (GPS tracker active).
    2. Otherwise (e.g. a Wi-Fi/router tracker is the source) the person's GPS
       tracker - but only if it lies inside the current zone (radius plus GPS
       accuracy); otherwise the centre of that zone.
    3. Away without zone: the GPS tracker, if any.
    """
    own = _coords(person)
    if own:
        return own

    gps_tracker = None
    for entity_id in person.attributes.get(ATTR_DEVICE_TRACKERS) or []:
        tracker = hass.states.get(entity_id)
        if tracker and tracker.attributes.get(ATTR_SOURCE_TYPE) == SOURCE_GPS:
            gps_tracker = tracker
            break
    gps = _coords(gps_tracker)

    zone = zone_state_for_name(hass, person.state) if person.state != STATE_NOT_HOME else None
    centre = _coords(zone)
    if centre:
        if gps:
            radius = to_float(zone.attributes.get(ATTR_RADIUS)) or 100.0
            accuracy = to_float(gps_tracker.attributes.get(ATTR_GPS_ACCURACY)) or 0.0
            if distance_m(gps[0], gps[1], centre[0], centre[1]) <= radius + accuracy:
                return gps
        return centre
    return gps


def zone_snapshot(hass: HomeAssistant) -> list[tuple[str, float, float, float]]:
    """Active zones as (state name, latitude, longitude, radius) - safe to use in a thread."""
    zones = []
    for zone in hass.states.async_all(ZONE_DOMAIN):
        centre = _coords(zone)
        radius = to_float(zone.attributes.get(ATTR_RADIUS))
        if zone.attributes.get("passive") or not centre or radius is None:
            continue
        name = STATE_HOME if zone.entity_id == f"{ZONE_DOMAIN}.home" else zone.name
        zones.append((name, centre[0], centre[1], radius))
    return zones


def zone_in_snapshot(zones: list[tuple[str, float, float, float]], lat: float, lon: float) -> str:
    """Person state a point would have: "home", a zone name or "not_home".

    Like Home Assistant itself: the smallest zone containing the point wins.
    """
    best: tuple[float, str] | None = None
    for name, zlat, zlon, radius in zones:
        if distance_m(lat, lon, zlat, zlon) <= radius and (best is None or radius < best[0]):
            best = (radius, name)
    return best[1] if best else STATE_NOT_HOME


def zone_for(hass: HomeAssistant, lat: float, lon: float) -> str:
    return zone_in_snapshot(zone_snapshot(hass), lat, lon)


def find_address_sensor(hass: HomeAssistant, person: State | None) -> str | None:
    """The geocoded location sensor of the person's phone (Companion app).

    Looks at the person's trackers; for a mobile_app tracker, the sensor on
    the same device whose unique ID ends with "geocoded_location".
    """
    if person is None:
        return None
    registry = er.async_get(hass)
    for tracker_id in person.attributes.get(ATTR_DEVICE_TRACKERS) or []:
        entry = registry.async_get(tracker_id)
        if not entry or entry.platform != "mobile_app" or not entry.device_id:
            continue
        for candidate in er.async_entries_for_device(registry, entry.device_id):
            if candidate.domain == "sensor" and str(candidate.unique_id).endswith("geocoded_location"):
                return candidate.entity_id
    return None


def phone_address(hass: HomeAssistant, sensor_id: str | None, lat: float, lon: float, max_distance: float) -> str:
    """Short address "Street No, City[, Country]" from the phone's geocoded sensor.

    Only if the sensor's own position is close to the point - the geocoding
    often lags one step behind, and no address is better than a wrong one.
    The country is left out when it is the country Home Assistant is set to.
    """
    state = hass.states.get(sensor_id) if sensor_id else None
    if state is None:
        return ""
    # iOS: "Sub Thoroughfare", Android: "sub_thoroughfare"
    values = {}
    for key, value in state.attributes.items():
        if isinstance(value, str):
            value = value.strip()
            if value in ("", "null", "N/A"):
                continue
        values[key.lower().replace(" ", "_")] = value

    position = values.get("location")
    if not isinstance(position, (list, tuple)) or len(position) != 2:
        return ""
    plat, plon = to_float(position[0]), to_float(position[1])
    if plat is None or plon is None or distance_m(lat, lon, plat, plon) > max_distance:
        return ""

    street = " ".join(p for p in (values.get("thoroughfare", ""), values.get("sub_thoroughfare", "")) if p)
    city = values.get("locality", "") or values.get("sub_locality", "")
    parts = [p for p in (street, city) if p]
    country_code = str(values.get("iso_country_code", "")).upper()
    country = values.get("country", "")
    if country and country_code != (hass.config.country or "").upper():
        parts.append(country)
    if parts:
        return clean_text(", ".join(parts))
    if state.state not in ("unknown", "unavailable", ""):
        return clean_text(", ".join(line.strip() for line in state.state.split("\n") if line.strip()))
    return ""
