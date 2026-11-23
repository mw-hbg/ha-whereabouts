# UI screenshot check

Screenshots of the Whereabouts sidebar page (live map, history, settings) in a fake
Home Assistant. Nothing here talks to a real Home Assistant; all data is invented
(persons Alex and Sam around Stuttgart's Schlossplatz). Screenshots are never committed.

| File | Purpose |
| --- | --- |
| `index.html`, `mock-hass.js` | Test page: fake `hass` object and websocket backend, mounts `<whereabouts-panel>` like Home Assistant does |
| `serve.py` | Static server: `/whereabouts_static/*` → `custom_components/whereabouts/frontend/*` |
| `shoot.py` | Playwright: every view × device × theme, plus the settings page with everything opened |
| `compare.py` | Pixel comparison of two shot folders, writes diff images and `report.md` |

## Run locally

```bash
pip install playwright pillow
python -m playwright install chromium        # or use an installed Chrome with --chrome

python tests/ui/shoot.py                      # -> tests/ui/out/*.png + errors.json
python tests/ui/shoot.py --chrome /usr/bin/google-chrome --only settings-open_pc_dark
python tests/ui/compare.py --old OLD_DIR --new tests/ui/out --diff /tmp/ui-diff
```

`shoot.py` exits with 1 if a JavaScript error, a console error, a failed local request or an
unknown websocket message (`MOCK: unknown message …`) occurred; details are in `errors.json`.
Requests to anything but localhost are blocked, so the maps show no tiles.

Look at the page in a browser:

```bash
python tests/ui/serve.py 8765
# http://localhost:8765/tests/ui/index.html?view=settings&theme=dark&lang=en&user=normal
```

Parameters: `view=live|history|settings`, `theme=light|dark`, `lang=de|en`, `user=admin|normal`, `zones=changed` (question about changed zones).

## In GitHub Actions

The workflow **UI** (`.github/workflows/ui.yaml`) runs on every push and pull request,
compares with the screenshots of the last successful run on `main` and shows the report in
the job summary. Artifacts: `ui-shots` (all pictures, `errors.json`) and `ui-diff` (changed
pictures, only when something changed).
