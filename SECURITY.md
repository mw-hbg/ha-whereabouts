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
  not reachable via `/local/`), files with mode `0600`. It is part of Home
  Assistant backups.
* All access goes through Home Assistant's authenticated WebSocket connection
  or the authenticated export endpoint. Every request is checked against the
  logged-in user (`history_access`, `delete_access`). Person keys, dates and
  times are validated before they are used in file names.
* Importing is only possible in the integration's options, i.e. for
  administrators. Uploads are limited in size (also inside ZIP files).
* Nothing leaves Home Assistant unless OpenStreetMap is switched on as address
  source; then only the coordinates of places on the way are sent to
  `nominatim.openstreetmap.org`.
