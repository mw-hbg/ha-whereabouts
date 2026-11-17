# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
private reporting instead: **Security → Report a vulnerability** in this
repository. You will get an answer as soon as possible; this is a hobby
project, so please allow a few days.

Helpful details: Whereabouts and Home Assistant version, what an attacker could
do and how to reproduce it.

## Good to know

* The history is stored in `<config>/whereabouts/history/` (outside `www/`,
  not reachable via any web address), files with mode `0600`. It is part of Home
  Assistant backups. Anyone with access to the configuration folder (e.g. File
  editor, Samba, SSH apps) can read it, like every other file there.
* All access goes through Home Assistant's authenticated WebSocket connection
  or the authenticated export endpoint. Every request is checked against the
  logged-in user (`history_access`, `delete_access`). Person keys, dates and
  times are validated before they are used in file names.
* `whereabouts/info` only lists the persons whose history the user may see.
* The export endpoint validates person and dates and is limited to 10 years per
  request; text cells that a spreadsheet would run as a formula are quoted.
* The cards insert names, addresses and zone names only as text (escaped);
  colours from the card configuration are only accepted as `#rrggbb`.
* The card files (`/whereabouts_static/`) are served without login, like all
  dashboard resources – they contain no data, only code and texts. Leaflet is
  bundled (checked against the official release hash in the tests); nothing is
  loaded from a CDN.
* Map tiles are loaded by the browser from the chosen provider (Esri,
  OpenStreetMap or CARTO), which sees the requested map area.
* Importing is only possible in the integration's options, i.e. for
  administrators. Uploads are limited in size (also inside ZIP files).
* Nothing leaves Home Assistant unless OpenStreetMap is switched on as address
  source; then only the coordinates of places on the way are sent to
  `nominatim.openstreetmap.org`.
