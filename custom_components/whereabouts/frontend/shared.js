// Whereabouts – shared helpers for both cards.
// Loaded by whereabouts-cards.js with the same "?v=<version>" as the cards.

const SCRIPT_URL = new URL(import.meta.url);
export const BASE = SCRIPT_URL.pathname.replace(/\/[^/]*$/, ''); // /whereabouts_static
export const QUERY = SCRIPT_URL.search; // ?v=<version>

// Distinct colours for persons without a configured colour. A person gets the
// colour of its position among ALL persons in Home Assistant, so both cards
// show the same colour without any configuration.
export const PALETTE = [
  '#378ADD', '#D6409F', '#2E9E5B', '#E8833A', '#8E5CD6',
  '#C9A227', '#1FA5A5', '#D94848', '#6B7A8F', '#9C6B3F',
];

export const DEFAULTS_MAP = {
  map_style: 'auto', // auto | light | dark
  tiles: 'esri', // esri | osm | carto
  carto_api_key: '',
  map_link: 'google', // google | apple | osm | waze | here | none
  map_link_choice: true, // phones/tablets: ask which map app opens the coordinates
  show_zones: true,
  zone_names_zoom: 14,
  zone_color_home: '#2E7D32',
  zone_color: '#EF6C00',
  height_mode: 'auto', // auto (full height in a panel view) | full | fixed
  height: 450,
};

// --- translations ---------------------------------------------------------
const translations = {};

export async function loadTranslations(lang) {
  const want = [lang, 'en'].filter(Boolean);
  for (const code of want) {
    if (translations[code]) return translations[code];
    try {
      const response = await fetch(`${BASE}/i18n/${code}.json${QUERY}`);
      if (response.ok) {
        translations[code] = await response.json();
        if (code !== 'en' && !translations.en) await loadTranslations('en');
        return translations[code];
      }
    } catch (err) {
      // try the next language
    }
  }
  return {};
}

export function language(hass) {
  return ((hass && ((hass.locale && hass.locale.language) || hass.language)) || 'en').split('-')[0];
}

export function translator(hass) {
  const lang = language(hass);
  return (key, vars = {}) => {
    const text = (translations[lang] && translations[lang][key]) || (translations.en && translations.en[key]) || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
  };
}

// --- Leaflet (bundled with the integration, no CDN) -------------------------
let leafletPromise = null;

export function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve();
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${BASE}/leaflet/leaflet.js`;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        leafletPromise = null;
        reject(new Error('Leaflet could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

// Leaflet's CSS has to live inside the card (Home Assistant uses Shadow DOM).
export function leafletCss() {
  return `<link rel="stylesheet" data-whereabouts-leaflet href="${BASE}/leaflet/leaflet.css">`;
}

export function waitForCss(root) {
  const link = root.querySelector('link[data-whereabouts-leaflet]');
  return new Promise((resolve) => {
    if (!link || link.sheet) return resolve();
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
}

// --- map tiles ----------------------------------------------------------------
export function isDark(hass, style) {
  if (style === 'dark') return true;
  if (style === 'light') return false;
  const themes = hass && hass.themes;
  if (themes && typeof themes.darkMode === 'boolean') return themes.darkMode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Replaces the tile layers of `map` (the array `layers` is changed in place
// and returned). If the chosen provider delivers no tiles at all (e.g. the
// CARTO key was blocked), the map falls back: CARTO -> Esri -> OpenStreetMap.
// `notice(text)`: shows a hint (administrators only), or nothing.
export const FALLBACK = { carto: 'esri', esri: 'osm' };

export function setTiles(map, layers, config, dark, container, notice) {
  const L = window.L;
  layers.splice(0).forEach((layer) => map.removeLayer(layer));
  const oldHint = container.querySelector('.wa-ersatz');
  if (oldHint) oldHint.remove();
  const add = (url, options) => { const layer = L.tileLayer(url, options).addTo(map); layers.push(layer); return layer; };
  container.style.background = dark ? '#262626' : '#f2efe9';
  container.classList.toggle('wa-osm-dark', false);
  container.classList.toggle('wa-dark', dark);
  let tiles = config.tiles || 'esri';
  if (tiles === 'carto' && !config.carto_api_key) tiles = 'esri'; // no key: Esri needs none
  let main;
  if (tiles === 'carto') {
    // CARTO delivers tiles with a key only up to zoom 18 -> scale up above.
    const style = dark ? 'dark_all' : 'rastertiles/voyager';
    main = add(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(config.carto_api_key)}`, {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxNativeZoom: 18, maxZoom: 20,
    });
  } else if (tiles === 'osm') {
    main = add('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxNativeZoom: 19, maxZoom: 20,
    });
    // OpenStreetMap has no dark style: darken the tiles with a filter.
    container.classList.toggle('wa-osm-dark', dark);
  } else if (dark) {
    main = add('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap', maxNativeZoom: 16, maxZoom: 20,
    });
    add('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxNativeZoom: 16, maxZoom: 20,
    });
  } else {
    main = add('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap', maxNativeZoom: 19, maxZoom: 20,
    });
  }
  // Only a provider that delivers nothing at all is replaced - single missing
  // tiles (bad network) are not enough.
  let loaded = 0;
  let failed = 0;
  main.on('tileload', () => { loaded += 1; });
  main.on('tileerror', () => {
    failed += 1;
    const next = FALLBACK[tiles];
    if (loaded || failed < 6 || !next || !navigator.onLine || !layers.includes(main)) return;
    setTiles(map, layers, { ...config, tiles: next }, dark, container, notice);
    if (notice) notice(tiles, next);
  });
  return layers;
}

// CSS shared by both cards for the map itself.
export const MAP_CSS = `
  .leaflet-container { font: inherit; }
  /* No hairlines between tiles at browser zoom != 100 % */
  .leaflet-tile-container img.leaflet-tile { mix-blend-mode: plus-lighter; }
  .leaflet-tile-pane, .leaflet-tile-container { isolation: isolate; }
  .wa-osm-dark .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(.9) contrast(.9); }
  .zonen-name { background: transparent; border: none; box-shadow: none; font-weight: 600;
                color: #555; text-shadow: 0 0 3px #fff, 0 0 3px #fff; padding: 0; }
  .wa-dark .zonen-name { color: #ddd; text-shadow: 0 0 3px #000, 0 0 3px #000; }
  .zonen-name::before { display: none; }
  .zonen-aus .zonen-name { display: none; }
  .wa-ersatz { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 900; max-width: calc(100% - 140px);
               padding: 6px 12px; border-radius: 8px; font-size: 12px; line-height: 1.4; text-align: center;
               background: rgba(0,0,0,.72); color: #fff; pointer-events: none; }
`;

// Hint on the map that the chosen map service failed (for administrators).
export function fallbackNotice(container, t) {
  return (from, to) => {
    let hint = container.querySelector('.wa-ersatz');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'wa-ersatz';
      container.appendChild(hint);
    }
    const name = { esri: 'Esri', osm: 'OpenStreetMap', carto: 'CARTO' };
    hint.textContent = t(from === 'carto' ? 'tiles_fallback_carto' : 'tiles_fallback', { from: name[from], to: name[to] });
  };
}

// --- zones (both cards) -----------------------------------------------------------
export function zoneStates(hass, config) {
  if (!config.show_zones) return [];
  const states = hass.states;
  return Object.keys(states).filter((id) => id.startsWith('zone.')).map((id) => states[id])
    .filter((z) => z.attributes && !z.attributes.passive
      && Number.isFinite(Number(z.attributes.latitude)) && Number.isFinite(Number(z.attributes.longitude)));
}

export function zoneSignature(hass, config) {
  return [config.zone_color_home, config.zone_color, ...zoneStates(hass, config).map((z) => {
    const a = z.attributes;
    return [z.entity_id, a.latitude, a.longitude, a.radius, a.friendly_name].join('|');
  })].join(';');
}

// Draws the zones as circles with their names; returns the new layer.
export function drawZones(map, oldLayer, hass, config, t) {
  const L = window.L;
  if (oldLayer) map.removeLayer(oldLayer);
  const layer = L.layerGroup().addTo(map);
  zoneStates(hass, config).forEach((z) => {
    const a = z.attributes;
    const home = z.entity_id === 'zone.home';
    const color = home ? safeColor(config.zone_color_home, '#2E7D32') : safeColor(config.zone_color, '#EF6C00');
    L.circle([Number(a.latitude), Number(a.longitude)], {
      radius: Number(a.radius) || 100, color, weight: 1.5, opacity: 0.7, fillColor: color, fillOpacity: 0.1, interactive: false,
    }).addTo(layer).bindTooltip(escapeHtml(home ? t('home') : (a.friendly_name || z.entity_id)), {
      permanent: true, direction: 'center', offset: [0, 14], className: 'zonen-name',
    });
  });
  return layer;
}

// Zone names only from a zoom level on (class on the map container).
export function watchZoneNames(map, container, config) {
  const apply = () => container.classList.toggle('zonen-aus', map.getZoom() < Number(config.zone_names_zoom || 14));
  map.on('zoomend', apply);
  apply();
}

// Several cards share one style scope in Home Assistant (no Shadow DOM per
// card here, Leaflet needs the light DOM) - so every rule is prefixed with the
// card's root selector. Handles @media blocks; @keyframes stay global.
export function scopeCss(css, scope) {
  let out = '';
  let i = 0;
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) { out += text.slice(i); break; }
    const head = text.slice(i, open).trim();
    // find the matching closing brace
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth) { if (text[j] === '{') depth += 1; else if (text[j] === '}') depth -= 1; j += 1; }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@media') || head.startsWith('@supports')) out += `${head} { ${scopeCss(body, scope)} }\n`;
    else if (head.startsWith('@')) out += `${head} {${body}}\n`;
    else {
      const selectors = head.split(',').map((sel) => sel.trim()).filter(Boolean)
        .map((sel) => (sel.startsWith(scope) ? sel : `${scope} ${sel}`));
      out += `${selectors.join(', ')} {${body}}\n`;
    }
    i = j;
  }
  return out;
}

// --- persons ----------------------------------------------------------------
export function allPersonIds(hass) {
  return Object.keys((hass && hass.states) || {}).filter((id) => id.startsWith('person.')).sort();
}

export function personSettings(config, entityId) {
  return ((config && config.person_settings) || {})[entityId] || {};
}

export function personColor(hass, config, entityId) {
  const own = personSettings(config, entityId).color;
  if (own) return own;
  const index = allPersonIds(hass).indexOf(entityId);
  return PALETTE[(index < 0 ? 0 : index) % PALETTE.length];
}

// Picture: own URL from the card settings, otherwise the person's picture.
export function personPicture(hass, config, entityId) {
  const own = safeUrl(personSettings(config, entityId).picture);
  if (own) return own;
  const st = hass && hass.states[entityId];
  return safeUrl(st && st.attributes.entity_picture) || '';
}

// Only paths on this Home Assistant and http(s) addresses (they end up in CSS url()).
export function safeUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || /["'\\()<>\s]/.test(url)) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return /^https?:\/\//i.test(url) ? url : '';
}

export function personName(hass, config, entityId) {
  const own = personSettings(config, entityId).name;
  if (own) return own;
  const st = hass && hass.states[entityId];
  return (st && st.attributes.friendly_name) || entityId.split('.')[1];
}

// --- positions --------------------------------------------------------------
export function distanceM(lat1, lon1, lat2, lon2) {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(Math.min(1, h)));
}

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

export function zoneFor(states, name) {
  if (name === 'home') return states['zone.home'];
  return Object.keys(states).filter((id) => id.startsWith('zone.')).map((id) => states[id])
    .find((z) => z.attributes && z.attributes.friendly_name === name);
}

// Position of a person - the same rule the integration uses when recording:
// own coordinates; otherwise (e.g. a Wi-Fi tracker is the source) the GPS
// tracker if it lies inside the current zone, else the zone centre; away
// without zone: the GPS tracker.
export function position(states, st) {
  const a = st.attributes || {};
  const lat = num(a.latitude);
  const lon = num(a.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, accuracy: num(a.gps_accuracy) || 0 };
  const gpsId = (a.device_trackers || []).find((id) => states[id] && states[id].attributes.source_type === 'gps');
  const gps = gpsId ? states[gpsId].attributes : {};
  const glat = num(gps.latitude);
  const glon = num(gps.longitude);
  const gpsOk = Number.isFinite(glat) && Number.isFinite(glon);
  const zone = st.state !== 'not_home' ? zoneFor(states, st.state) : null;
  if (zone) {
    const zlat = num(zone.attributes.latitude);
    const zlon = num(zone.attributes.longitude);
    if (!Number.isFinite(zlat) || !Number.isFinite(zlon)) return null;
    const radius = (num(zone.attributes.radius) || 100) + (num(gps.gps_accuracy) || 0);
    if (gpsOk && distanceM(glat, glon, zlat, zlon) <= radius) return { lat: glat, lon: glon, accuracy: num(gps.gps_accuracy) || 0 };
    return { lat: zlat, lon: zlon, accuracy: 0 };
  }
  return gpsOk ? { lat: glat, lon: glon, accuracy: num(gps.gps_accuracy) || 0 } : null;
}

// The phone's geocoded location sensor (Companion app): a sensor on the same
// device as one of the person's trackers that carries address attributes.
export function findAddressSensor(hass, personState) {
  const entities = hass.entities || {};
  const trackers = (personState && personState.attributes.device_trackers) || [];
  for (const trackerId of trackers) {
    const device = entities[trackerId] && entities[trackerId].device_id;
    if (!device) continue;
    const match = Object.values(entities).find((e) => {
      if (e.device_id !== device || !e.entity_id.startsWith('sensor.')) return false;
      const st = hass.states[e.entity_id];
      const a = (st && st.attributes) || {};
      return ('Location' in a || 'location' in a) && ('Locality' in a || 'locality' in a || 'Thoroughfare' in a || 'thoroughfare' in a);
    });
    if (match) return match.entity_id;
  }
  return null;
}

// "Street No, City[, Country]" - the country only outside the country Home Assistant is set to.
export function phoneAddress(hass, sensorId) {
  const st = sensorId && hass.states[sensorId];
  if (!st) return '';
  const a = st.attributes || {};
  const value = (...names) => {
    for (const n of names) {
      const v = a[n];
      if (v !== undefined && v !== null && v !== '' && v !== 'null' && v !== 'N/A') return String(v);
    }
    return '';
  };
  const street = [value('thoroughfare', 'Thoroughfare'), value('sub_thoroughfare', 'Sub Thoroughfare')].filter(Boolean).join(' ');
  const city = value('locality', 'Locality') || value('sub_locality', 'Sub Locality');
  const parts = [street, city].filter(Boolean);
  const code = value('iso_country_code', 'ISO Country Code').toUpperCase();
  const country = value('country', 'Country');
  const home = ((hass.config && hass.config.country) || '').toUpperCase();
  if (country && code !== home) parts.push(country);
  if (parts.length) return parts.join(', ');
  return st.state && !['unknown', 'unavailable'].includes(st.state) ? st.state.split('\n').map((s) => s.trim()).filter(Boolean).join(', ') : '';
}

// --- texts --------------------------------------------------------------------
export function placeText(t, state) {
  if (state === 'home') return t('home');
  if (state === 'not_home') return t('not_home');
  if (!state || state === 'unknown' || state === 'unavailable') return t('unknown');
  return state;
}

export function clock(hass, date, seconds = false) {
  const options = { hour: '2-digit', minute: '2-digit' };
  if (seconds) options.second = '2-digit';
  return date.toLocaleTimeString(language(hass), options);
}

export function sinceText(hass, t, iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '–';
  const same = (a, b) => a.toDateString() === b.toDateString();
  const time = t('time', { time: clock(hass, dt) });
  if (same(dt, new Date())) return time;
  if (same(dt, new Date(Date.now() - 86400000))) return t('yesterday', { time });
  return `${dt.toLocaleDateString(language(hass), { day: '2-digit', month: '2-digit' })} ${time}`;
}

export function agoText(t, iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '–';
  const s = Math.max(0, Math.round((Date.now() - dt.getTime()) / 1000));
  if (s < 60) return t('just_now');
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? t('minute_ago') : t('minutes_ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? t('hour_ago') : t('hours_ago', { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? t('day_ago') : t('days_ago', { n: d });
}

export const MAP_APPS = ['google', 'apple', 'osm', 'waze', 'here'];

export function mapLink(kind, lat, lon) {
  const la = lat.toFixed(6);
  const lo = lon.toFixed(6);
  const q = `${la},${lo}`;
  if (kind === 'none') return '';
  if (kind === 'apple') return `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(q)}`;
  if (kind === 'osm') return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=17/${la}/${lo}`;
  if (kind === 'waze') return `https://www.waze.com/ul?ll=${encodeURIComponent(q)}&navigate=no`;
  if (kind === 'here') return `https://share.here.com/l/${q}`;
  if (kind === 'geo') return `geo:${q}?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function platform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function touchDevice() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

// Map apps offered in the chooser, the configured one first.
function chooserApps(preferred) {
  const os = platform();
  let apps = os === 'ios' ? ['apple', 'google', 'waze', 'osm', 'here']
    : os === 'android' ? ['google', 'waze', 'osm', 'here', 'geo'] : [...MAP_APPS];
  if (apps.includes(preferred)) apps = [preferred, ...apps.filter((a) => a !== preferred)];
  return apps;
}

// Fills an <a> for coordinates: link to the configured map; on phones and
// tablets a tap asks which app should open them (if switched on).
export function bindMapLink(a, config, t, lat, lon) {
  const kind = config.map_link || 'google';
  const href = mapLink(kind, lat, lon);
  if (href) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else a.removeAttribute('href');
  a.onclick = (e) => {
    if (!href || config.map_link_choice === false || !touchDevice()) return;
    e.preventDefault();
    showMapChooser(t, lat, lon, kind);
  };
}

const CHOOSER_CSS = `
  .wa-chooser { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-end; justify-content: center;
                background: rgba(0,0,0,0); transition: background .2s; font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); }
  .wa-chooser.offen { background: rgba(0,0,0,.35); }
  .wa-chooser .blatt { width: min(420px, 100%); box-sizing: border-box; margin: 0 8px calc(8px + env(safe-area-inset-bottom));
                       background: var(--card-background-color, #fff); color: var(--primary-text-color, #222);
                       border-radius: 16px; padding: 8px 0; box-shadow: 0 6px 30px rgba(0,0,0,.3);
                       transform: translateY(110%); transition: transform .25s cubic-bezier(.2,.8,.2,1); }
  .wa-chooser.offen .blatt { transform: none; }
  .wa-chooser .titel { padding: 10px 18px 6px; font-size: 13px; color: var(--secondary-text-color, #666); }
  .wa-chooser a, .wa-chooser button { display: block; width: 100%; box-sizing: border-box; padding: 14px 18px; font: inherit; font-size: 16px;
                                      text-align: left; color: inherit; text-decoration: none; background: none; border: none; cursor: pointer; }
  .wa-chooser a:active, .wa-chooser button:active { background: rgba(127,127,127,.15); }
  .wa-chooser button.abbrechen { margin-top: 4px; border-top: 1px solid var(--divider-color, rgba(0,0,0,.12)); text-align: center;
                                 color: var(--primary-color, #03a9f4); font-weight: 600; }
`;

export function showMapChooser(t, lat, lon, preferred) {
  if (!document.getElementById('wa-chooser-css')) {
    const style = document.createElement('style');
    style.id = 'wa-chooser-css';
    style.textContent = CHOOSER_CSS;
    document.head.appendChild(style);
  }
  const box = document.createElement('div');
  box.className = 'wa-chooser';
  box.innerHTML = `<div class="blatt" role="dialog" aria-label="${escapeHtml(t('open_with'))}">
      <div class="titel">${escapeHtml(t('open_with'))}</div>
      ${chooserApps(preferred).map((app) => `<a href="${escapeHtml(mapLink(app, lat, lon))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t(`ed_link_${app}`))}</a>`).join('')}
      <button class="abbrechen" type="button">${escapeHtml(t('cancel'))}</button>
    </div>`;
  const close = () => { box.classList.remove('offen'); setTimeout(() => box.remove(), 250); };
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('a, button')) close(); });
  document.body.appendChild(box);
  requestAnimationFrame(() => box.classList.add('offen'));
}

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Colours from the user's config end up in CSS - allow only real colour values.
export function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

// Is the card inside a panel view (one card filling the page)?
function inPanelView(el) {
  let node = el;
  for (let i = 0; node && i < 12; i += 1) {
    if (node.tagName === 'HUI-PANEL-VIEW') return true;
    node = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
  }
  return false;
}

// Height: full screen height (panel view) or a fixed height.
export function applyHeight(el, config) {
  const mode = config.height_mode || 'auto';
  if (mode === 'fill') { el.style.height = '100%'; return; } // sidebar page
  const full = mode === 'full' || (mode === 'auto' && inPanelView(el));
  if (full) {
    el.style.height = CSS.supports('height', '100dvh') ? 'calc(100dvh - var(--header-height, 56px))' : 'calc(100vh - 56px)';
  } else {
    el.style.height = `${Math.max(200, Number(config.height) || 450)}px`;
  }
}

// Configuration of a card: built-in defaults < the user's settings (settings
// page) < what is set in this card. Person settings are merged per person.
export function cardConfig(defaults, settings, raw, kind) {
  const own = { ...(settings || {}) };
  const interval = own[kind === 'live' ? 'live_refresh_interval' : 'history_refresh_interval'];
  ['live_refresh_interval', 'history_refresh_interval', 'view_live', 'view_history', 'view_settings', 'start_view']
    .forEach((key) => delete own[key]);
  if (interval) own.refresh_interval = interval;
  if (!own.carto_api_key) delete own.carto_api_key;
  const persons = { ...(own.person_settings || {}) };
  Object.entries((raw && raw.person_settings) || {}).forEach(([id, entry]) => { persons[id] = { ...(persons[id] || {}), ...entry }; });
  const config = { ...DEFAULTS_MAP, ...defaults, ...own, ...(raw || {}), person_settings: persons };
  config.persons = raw && raw.persons && raw.persons.length ? raw.persons : (own.persons || []);
  return config;
}

// Perceived colour difference (CIE76 in Lab). Below ~25 two pins are hard to tell apart.
const toLab = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
  const rgb = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; });
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const SIMILAR = 25;
export function similarColors(entries) {
  const pairs = [];
  entries.forEach((a, i) => entries.slice(i + 1).forEach((b) => {
    const la = toLab(a.color);
    const lb = toLab(b.color);
    if (la && lb && Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]) < SIMILAR) pairs.push([a.name, b.name]);
  }));
  return pairs;
}


// --- integration ---------------------------------------------------------------
// One subscription per page: the integration sends what the cards need
// (enabled cards, shown persons, the user's rights) at once and again
// whenever its options change - open cards follow without reloading.
const infoListeners = new Set();
let infoSubscription = null;
let lastInfo = null;

export function subscribeInfo(hass, listener) {
  infoListeners.add(listener);
  if (lastInfo) listener(lastInfo);
  if (!infoSubscription) {
    infoSubscription = hass.connection
      .subscribeMessage((info) => {
        lastInfo = info;
        infoListeners.forEach((l) => l(info));
      }, { type: 'whereabouts/subscribe' })
      .catch((err) => {
        // Integration not loaded at all (unknown command)
        console.warn('Whereabouts: integration not available', err);
        infoSubscription = null;
        lastInfo = { available: false };
        infoListeners.forEach((l) => l(lastInfo));
      });
  }
  return () => infoListeners.delete(listener);
}

export function messageHtml(text) {
  return `<ha-card><div style="padding:16px;color:var(--secondary-text-color)">${escapeHtml(text)}</div></ha-card>`;
}
