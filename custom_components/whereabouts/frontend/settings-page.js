// Whereabouts – settings page (third tab of the sidebar page).
// Controls are Home Assistant's own (<ha-selector>) where possible, so the page
// looks and behaves like Home Assistant's settings and follows the theme.
//
// Saving: switches, selections, ticks and colours save at once; text and number
// fields only with their "Save" button or Enter. Unsaved changes are kept when
// the page is left and offered again on return.

// --- what is on the page -------------------------------------------------------
const B = { boolean: {} };
const sel = (options) => ({ select: { mode: 'dropdown', options } });
const num = (min, max, step, unit) => ({ number: { min, max, step, mode: 'box', unit_of_measurement: unit } });

// Personal categories: every user for themselves (unless locked). weight: main | more
const PERSONAL = [
  { id: 'views', icon: 'mdi:tab', weight: 'main', fields: [
    { key: 'view_live', sel: B }, { key: 'view_history', sel: B }, { key: 'view_settings', sel: B },
    { key: 'start_view', sel: (t) => sel(['live', 'history', 'settings'].map((v) => ({ value: v, label: t(`opt_view_${v}`) }))) },
  ] },
  { id: 'persons', icon: 'mdi:account-multiple', weight: 'main', custom: 'persons' },
  { id: 'map', icon: 'mdi:map', weight: 'main', fields: [
    { key: 'map_style', sel: (t) => sel(['auto', 'light', 'dark'].map((v) => ({ value: v, label: t(`ed_style_${v}`) }))) },
    { key: 'tiles', custom: 'tiles' },
    { key: 'map_link', sel: (t) => sel(['google', 'apple', 'osm', 'waze', 'here', 'none'].map((v) => ({ value: v, label: t(`ed_link_${v}`) }))) },
    { key: 'map_link_choice', sel: B },
  ] },
  { id: 'zones', icon: 'mdi:map-marker-circle', weight: 'more', fields: [
    { key: 'zones_in', sel: (t) => sel(['both', 'live', 'history', 'none'].map((v) => ({ value: v, label: t(`zones_in_${v}`) }))) },
    { key: 'zone_color_home', sel: { color_rgb: {} }, color: true, needs: 'zones_in' },
    { key: 'zone_color', sel: { color_rgb: {} }, color: true, needs: 'zones_in' },
    { key: 'zone_names_zoom', sel: num(1, 20, 1), needs: 'zones_in' }, { key: 'zone_list', custom: 'zones', needs: 'zones_in' },
  ] },
  { id: 'live', icon: 'mdi:map-marker-account', weight: 'more', fields: [
    { key: 'show_info_bar', sel: B }, { key: 'show_status_bar', sel: B }, { key: 'show_accuracy', sel: B },
    { key: 'follow', sel: B }, { key: 'live_auto_refresh', sel: B },
    { key: 'live_refresh_interval', sel: num(5, 3600, 5, 's'), needs: 'live_auto_refresh' },
  ] },
  { id: 'history', icon: 'mdi:map-clock', weight: 'more', fields: [
    { key: 'default_view', sel: (t) => sel(['map', 'table'].map((v) => ({ value: v, label: t(`ed_view_${v}`) }))) },
    { key: 'show_legend', sel: B }, { key: 'show_export', sel: B }, { key: 'history_auto_refresh', sel: B },
    { key: 'history_refresh_interval', sel: num(10, 3600, 5, 's'), needs: 'history_auto_refresh' },
  ] },
];

// Administration: integration options, rights, data
const ADMIN = [
  { id: 'base', icon: 'mdi:account-group', custom: 'base' },
  { id: 'rights', icon: 'mdi:account-key', custom: 'rights' },
  { id: 'sidebar', icon: 'mdi:dock-left', reset: ['panel', 'panel_title', 'panel_icon'], options: [
    { key: 'panel', sel: B }, { key: 'panel_title', sel: { text: {} }, text: true },
    { key: 'panel_icon', sel: { icon: {} }, text: true },
  ] },
  { id: 'recording', icon: 'mdi:record-rec', reset: ['min_interval', 'same_place_distance', 'retention_days'], options: [
    { key: 'record_persons', persons: true }, { key: 'min_interval', sel: num(10, 3600, 10, 's') },
    { key: 'same_place_distance', sel: num(10, 1000, 10, 'm') }, { key: 'retention_days', sel: num(0, 36500, 1, 'd'), confirm: 'retention' },
  ] },
  { id: 'addresses', icon: 'mdi:map-search', reset: ['address_source', 'address_max_distance', 'address_sensors'], options: [
    { key: 'address_source', sel: (t) => sel(['phone_osm', 'phone', 'osm', 'off'].map((v) => ({ value: v, label: t(`opt_address_${v}`) }))) },
    { key: 'address_max_distance', sel: num(10, 5000, 10, 'm') },
  ], custom: 'sensors' },
  { id: 'data', icon: 'mdi:swap-vertical', custom: 'data', everyone: true },
  { id: 'diagnostics', icon: 'mdi:stethoscope', custom: 'diagnostics' },
];

// Where the map styles can be looked at
const TILE_LINKS = {
  esri: 'https://www.arcgis.com/home/item.html?id=de26a3cf4cc9451298ea173c4b324736',
  osm: 'https://www.openstreetmap.org/',
  carto: 'https://carto.com/basemaps/#styles',
};
const FORMAT_URL = 'https://github.com/mw-hbg/ha-whereabouts/blob/main/FORMAT.md';

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
};
const rgbToHex = (rgb) => (Array.isArray(rgb) && rgb.length === 3
  ? `#${rgb.map((v) => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  : undefined);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const CARTO_STYLES = ['voyager', 'voyager_nolabels', 'positron', 'positron_nolabels', 'dark_matter', 'dark_matter_nolabels'];
const CARTO_FIELDS = ['carto_live_light', 'carto_live_dark', 'carto_history_light', 'carto_history_dark'];

// CARTO key: the "Your API key" value (cb1_…). A pasted URL is fine too.
export function extractCartoKey(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  const fromUrl = /[?&](?:api_)?key=([A-Za-z0-9_-]+)/.exec(value);
  if (fromUrl) return fromUrl[1];
  const token = /\bcb1_[A-Za-z0-9_-]+/.exec(value);
  if (token) return token[0];
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

// Home Assistant loads its form elements only when a page needs them: an
// editor of a built-in card brings <ha-selector> along.
async function ensureSelector() {
  if (customElements.get('ha-selector')) return true;
  try {
    const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
    if (helpers) {
      for (const type of ['tile', 'entities']) {
        const card = await helpers.createCardElement({ type, entity: 'zone.home', entities: [] });
        if (card && card.constructor.getConfigElement) await card.constructor.getConfigElement();
        if (customElements.get('ha-selector')) break;
      }
    }
  } catch (err) {
    // fall back to plain inputs below
  }
  await Promise.race([customElements.whenDefined('ha-selector'), new Promise((r) => setTimeout(r, 3000))]);
  return Boolean(customElements.get('ha-selector'));
}

const CSS = `
  whereabouts-settings { display: block; }
  .wa-set [hidden] { display: none !important; }
  .wa-set { display: flex; gap: 24px; max-width: 1180px; margin: 0 auto; padding: 16px; box-sizing: border-box;
            color: var(--primary-text-color); }
  .wa-set .toc { flex: 0 0 220px; position: sticky; top: 16px; align-self: flex-start; max-height: calc(100vh - 120px); overflow: auto; }
  .wa-set .toc .gruppe { margin: 14px 0 6px; padding: 0 12px; font-size: 12px; font-weight: 500; letter-spacing: .06em;
                         text-transform: uppercase; color: var(--secondary-text-color); }
  .wa-set .toc .gruppe:first-child { margin-top: 0; }
  .wa-set .toc a { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; cursor: pointer;
                   color: var(--primary-text-color); text-decoration: none; font-size: 14px; }
  .wa-set .toc a:hover { background: var(--secondary-background-color); }
  .wa-set .toc a.aktiv { background: rgba(var(--rgb-primary-color, 3,169,244), .12); color: var(--primary-color); font-weight: 500; }
  .wa-set .toc ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .wa-set .toc a.aktiv ha-icon { color: var(--primary-color); }
  .wa-set .toc .schloss { margin-left: auto; --mdc-icon-size: 16px; }
  .wa-set main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
  .wa-set .sprung { display: none; }
  .wa-set .oben { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .wa-set .oben h1 { margin: 0; font-size: 24px; font-weight: 400; flex: 1 1 auto; }
  .wa-set .umschalter { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 20px; overflow: hidden; }
  .wa-set .umschalter button { font: inherit; font-size: 14px; padding: 7px 14px; border: none; background: none;
                               color: var(--primary-text-color); cursor: pointer; }
  .wa-set .umschalter button.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .wa-set .hinweis { font-size: 14px; color: var(--secondary-text-color); line-height: 1.5; margin: 0; }
  .wa-set ha-card { display: block; overflow: visible; }
  .wa-set .kat-kopf { display: flex; align-items: center; gap: 12px; padding: 16px 16px 8px; }
  .wa-set .kat-kopf.klapp { cursor: pointer; padding-bottom: 16px; }
  .wa-set .kat-kopf .symbol { --mdc-icon-size: 24px; color: var(--secondary-text-color); }
  .wa-set .kat-kopf h2 { margin: 0; font-size: 18px; font-weight: 500; flex: 1 1 auto; }
  .wa-set .kat-kopf .pfeil { transition: transform .2s; color: var(--secondary-text-color); }
  .wa-set .kat.zu .kat-kopf .pfeil { transform: rotate(-90deg); }
  .wa-set .kat.zu .kat-inhalt { display: none; }
  .wa-set .kat:not(.zu) .kat-kopf.klapp { padding-bottom: 8px; }
  .wa-set .kat-text { padding: 0 16px 8px 52px; margin: 0; font-size: 14px; color: var(--secondary-text-color); line-height: 1.5; }
  .wa-set .marke { font-size: 12px; padding: 3px 9px; border-radius: 10px; white-space: nowrap;
                   background: var(--secondary-background-color); color: var(--secondary-text-color); display: inline-flex; gap: 4px; align-items: center; }
  .wa-set .marke ha-icon { --mdc-icon-size: 14px; }
  .wa-set .knopf { font: inherit; font-size: 14px; font-weight: 500; padding: 7px 14px; border-radius: 18px; cursor: pointer;
                   border: 1px solid var(--divider-color); background: none; color: var(--primary-color);
                   display: inline-flex; align-items: center; gap: 6px; }
  .wa-set .knopf:hover:not(:disabled) { background: rgba(var(--rgb-primary-color, 3,169,244), .08); }
  .wa-set .knopf:disabled { opacity: .45; cursor: default; }
  .wa-set .knopf.gefahr { color: var(--error-color, #db4437); }
  .wa-set .knopf.voll { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  .wa-set .knopf ha-icon { --mdc-icon-size: 18px; }
  .wa-set .rund { width: 36px; height: 36px; padding: 0; justify-content: center; border-radius: 50%; border: none; color: var(--secondary-text-color); }
  .wa-set .zeile { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 320px); gap: 4px 16px; align-items: center;
                   padding: 10px 16px; border-top: 1px solid var(--divider-color); }
  .wa-set .zeile.breit { grid-template-columns: minmax(0, 1fr); }
  .wa-set .beschriftung { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 15px; }
  .wa-set .info { flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%; background: none; cursor: pointer;
                  color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; padding: 0; }
  .wa-set .info:hover, .wa-set .info[aria-expanded="true"] { color: var(--primary-color); background: rgba(var(--rgb-primary-color, 3,169,244), .1); }
  .wa-set .info ha-icon { --mdc-icon-size: 18px; }
  .wa-set .infotext { grid-column: 1 / -1; font-size: 13px; line-height: 1.5; color: var(--secondary-text-color);
                      background: var(--secondary-background-color); border-radius: 8px; padding: 8px 12px; }
  .wa-set .infotext[hidden] { display: none; }
  .wa-set .steuer { min-width: 0; display: flex; justify-content: flex-end; }
  .wa-set .steuer > * { width: 100%; }
  .wa-set .steuer.schalter > * { width: auto; }
  .wa-set .gesperrt .steuer { opacity: .6; }
  .wa-set .verweis { grid-column: 1 / -1; justify-self: end; display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
                     color: var(--primary-color); text-decoration: none; }
  .wa-set .verweis:hover { text-decoration: underline; }
  .wa-set .verweis ha-icon { --mdc-icon-size: 16px; }
  .wa-set .warnung { margin: 8px 16px; padding: 10px 12px; border-radius: 8px; font-size: 14px;
                     background: rgba(255,166,0,.14); color: var(--primary-text-color); border-left: 4px solid var(--warning-color, #ffa600); }
  .wa-set .fuss { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px 16px; flex-wrap: wrap; }
  .wa-set .person { display: grid; grid-template-columns: auto 44px minmax(0, 1fr) auto; gap: 8px 12px; align-items: center;
                    padding: 12px 16px; border-top: 1px solid var(--divider-color); }
  .wa-set .person.aus { opacity: .55; }
  .wa-set .person .bild { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--farbe); box-sizing: border-box;
                          background: var(--farbe) center/cover no-repeat; color: #fff; font-weight: 700; font-size: 18px;
                          display: flex; align-items: center; justify-content: center; }
  .wa-set .person .felder { display: grid; grid-template-columns: minmax(120px, 1fr) 120px minmax(160px, 1.4fr); gap: 8px; min-width: 0; }
  .wa-set .person .reihenfolge { display: flex; flex-direction: column; }
  .wa-set .person .bildzeile { display: flex; gap: 4px; align-items: center; min-width: 0; }
  .wa-set .person .bildzeile > :first-child { flex: 1 1 auto; min-width: 0; }
  .wa-set input.ein, .wa-set select.ein { font: inherit; font-size: 14px; padding: 9px 10px; width: 100%; box-sizing: border-box;
                                         border: 1px solid var(--divider-color); border-radius: 8px;
                                         background: var(--card-background-color); color: var(--primary-text-color); }
  .wa-set input[type="color"].ein { padding: 2px; height: 40px; }
  .wa-set .tabelle { width: 100%; border-collapse: collapse; font-size: 14px; }
  .wa-set .tabelle th, .wa-set .tabelle td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--divider-color); vertical-align: top; }
  .wa-set .tabelle th { font-weight: 500; color: var(--secondary-text-color); }
  .wa-set .tabellenrahmen { overflow-x: auto; padding: 0 6px 8px; }
  .wa-set .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .wa-set .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px 4px 6px; border-radius: 14px;
                  border: 1px solid var(--divider-color); cursor: pointer; user-select: none; }
  .wa-set .chip input { margin: 0; }
  .wa-set .chip.an { background: rgba(var(--rgb-primary-color, 3,169,244), .12); border-color: var(--primary-color); }
  .wa-set .chip.fest { cursor: default; }
  .wa-set .ablage { margin: 8px 16px; padding: 20px; border: 2px dashed var(--divider-color); border-radius: 12px; text-align: center;
                    color: var(--secondary-text-color); cursor: pointer; }
  .wa-set .ablage.drueber { border-color: var(--primary-color); color: var(--primary-color); }
  .wa-set .ergebnis { margin: 8px 16px; font-size: 14px; line-height: 1.6; }
  .wa-set .ok { color: var(--success-color, #43a047); }
  .wa-set .schlecht { color: var(--error-color, #db4437); }
  .wa-set .klein { font-size: 12px; color: var(--secondary-text-color); }
  .wa-set .dialog { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,.45); padding: 16px; }
  .wa-set .dialog .fenster { width: min(480px, 100%); max-height: 90vh; overflow: auto; box-sizing: border-box; padding: 20px 24px 16px;
                             background: var(--card-background-color, #fff); color: var(--primary-text-color); border-radius: 16px;
                             box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .wa-set .dialog h3 { margin: 0 0 12px; font-size: 20px; font-weight: 400; }
  .wa-set .dialog .text { font-size: 14px; line-height: 1.6; color: var(--secondary-text-color); white-space: pre-line; }
  .wa-set .dialog .knoepfe { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
  .wa-set .dialog label { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; color: var(--primary-text-color); }
  .wa-set .dialog .liste { margin: 4px 0 8px 28px; }
  .wa-set .toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none;
                   background: var(--primary-text-color); color: var(--card-background-color, #fff); padding: 10px 18px; border-radius: 8px;
                   font-size: 14px; transition: opacity .2s, transform .2s; z-index: 2100; }
  .wa-set .toast.an { opacity: 1; transform: translate(-50%, 0); }
  .wa-set .toast.fehler { background: var(--error-color, #db4437); color: #fff; }

  .wa-set .kat-kopf { cursor: pointer; padding-bottom: 16px; }
  .wa-set .kat:not(.zu) .kat-kopf { padding-bottom: 8px; }
  .wa-set .kat-kopf .titelblock { flex: 1 1 auto; min-width: 0; }
  .wa-set .kat-kopf .titelblock h2 { flex: none; }
  .wa-set .kat-kopf .kurz { font-size: 13px; color: var(--secondary-text-color); margin-top: 2px; display: none;
                            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wa-set .kat.zu .kat-kopf .kurz { display: block; }
  .wa-set .kat-kopf .pfeil { flex: 0 0 auto; }
  .wa-set .banner { padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5;
                    background: rgba(var(--rgb-primary-color, 3,169,244), .14); border-left: 4px solid var(--primary-color);
                    display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .wa-set .banner.standard { background: rgba(255,152,0,.16); border-left-color: var(--warning-color, #ff9800); font-weight: 500; }
  .wa-set .banner .text { flex: 1 1 240px; }
  .wa-set .umschalter button:disabled { opacity: .45; cursor: default; }
  .wa-set .herkunft { font-size: 11px; padding: 1px 7px; border-radius: 8px; margin-left: 6px; white-space: nowrap;
                      background: var(--secondary-background-color); color: var(--secondary-text-color); }
  .wa-set .herkunft.eigen { background: rgba(var(--rgb-primary-color, 3,169,244), .14); color: var(--primary-color); }
  .wa-set .speicher { grid-column: 1 / -1; display: none; justify-content: flex-end; align-items: center; gap: 10px; }
  .wa-set .speicher.an { display: flex; }
  .wa-set .ungespeichert { font-size: 13px; color: var(--warning-color, #ff9800); font-weight: 500; }
  .wa-set .zeile.aus .steuer, .wa-set .zeile.aus .beschriftung { opacity: .45; }
  .wa-set .liste-haken { display: flex; flex-direction: column; gap: 2px; }
  .wa-set .liste-haken label { display: flex; align-items: center; gap: 10px; padding: 5px 0; font-size: 14px; cursor: pointer; }
  .wa-set .liste-haken input, .wa-set .chip input, .wa-set .person input[type="checkbox"] { width: 18px; height: 18px; margin: 0;
                                                                    accent-color: var(--primary-color); cursor: pointer; }
  .wa-set .liste-haken .klein { margin-left: 4px; }
  .wa-set .stile { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; }
  .wa-set .stil { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 2px 12px; align-items: center; padding: 10px 12px;
                  border: 1px solid var(--divider-color); border-radius: 12px; cursor: pointer; }
  .wa-set .stil.gewaehlt { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
  .wa-set .stil input { grid-row: 1 / span 2; width: 18px; height: 18px; margin: 0; accent-color: var(--primary-color); }
  .wa-set .stil .name { font-weight: 500; font-size: 15px; }
  .wa-set .stil .klein { grid-column: 2; }
  .wa-set .stil a { grid-row: 1 / span 2; grid-column: 3; font-size: 13px; color: var(--primary-color); text-decoration: none;
                    display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .wa-set .stil a:hover { text-decoration: underline; }
  .wa-set .stil a ha-icon { --mdc-icon-size: 16px; }
  .wa-set .schluessel { margin: -2px 0 4px 30px; padding: 10px 12px; border-radius: 10px; background: var(--secondary-background-color);
                        display: flex; flex-direction: column; gap: 8px; }
  .wa-set .schluessel .reihe { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .wa-set .schluessel .reihe input { flex: 1 1 220px; }
  .wa-set .schluessel .kopfzeile { display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 500; }
  .wa-set .zonen { grid-column: 1 / -1; display: flex; flex-direction: column; }
  .wa-set .zonenzeile { display: flex; align-items: center; gap: 10px; padding: 6px 0; flex-wrap: wrap; border-top: 1px solid var(--divider-color); }
  .wa-set .zonenzeile:first-child { border-top: none; }
  .wa-set .zonenzeile .zname { flex: 1 1 160px; display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
  .wa-set .zonenzeile .farbwahl { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
  .wa-set .zonenzeile input[type="color"] { width: 40px; height: 28px; padding: 0 2px; border: 1px solid var(--divider-color); border-radius: 6px;
                                            background: none; cursor: pointer; }
  .wa-set .zonen.aus { opacity: .45; pointer-events: none; }
  .wa-set .tupfer { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 auto; }
  .wa-set .person .zweite { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; margin-top: 8px; }
  .wa-set .person .zweite label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary-text-color); }
  .wa-set .person .zweite select { max-width: 220px; }
  .wa-set .person .speicher { margin-top: 6px; }
  .wa-set .person.aus .bild, .wa-set .person.aus .felder, .wa-set .person.aus .zweite { opacity: .45; }
  .wa-set .person.aus .felder, .wa-set .person.aus .zweite { pointer-events: none; }
  .wa-set .chip.regel { background: rgba(var(--rgb-primary-color, 3,169,244), .12); border-color: var(--primary-color); opacity: .8; }
  .wa-set .regelhinweis { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
  .wa-set details.hilfe { margin: 8px 16px; border: 1px solid var(--divider-color); border-radius: 10px; padding: 0 12px; font-size: 14px; }
  .wa-set details.hilfe summary { cursor: pointer; padding: 10px 0; font-weight: 500; color: var(--primary-color); }
  .wa-set details.hilfe pre { background: var(--secondary-background-color); border-radius: 8px; padding: 10px; overflow-x: auto;
                              font-size: 12px; line-height: 1.5; white-space: pre; }
  .wa-set details.hilfe pre.prompt { white-space: pre-wrap; max-height: 260px; overflow: auto; }
  .wa-set details.hilfe p, .wa-set details.hilfe li { line-height: 1.5; color: var(--secondary-text-color); }
  .wa-set details.hilfe .reihe { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  .wa-set .rolle { font-size: 13px; padding: 5px 12px; border-radius: 14px; display: inline-flex; align-items: center; gap: 6px;
                   background: rgba(var(--rgb-primary-color, 3,169,244), .12); color: var(--primary-color); font-weight: 500; }
  .wa-set .rolle ha-icon { --mdc-icon-size: 16px; }
  .wa-set .wessen { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .wa-set .wessen select { width: auto; min-width: 240px; }
  .wa-set .erfolg { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 14px; border-radius: 10px; font-size: 14px;
                    background: rgba(67,160,71,.14); border: 1px solid var(--success-color, #43a047); color: var(--primary-text-color); }
  .wa-set .erfolg ha-icon { color: var(--success-color, #43a047); --mdc-icon-size: 22px; }
  .wa-set .erfolg .text { flex: 1 1 auto; }
  .wa-set .erfolg button { border: none; background: none; cursor: pointer; color: var(--secondary-text-color); padding: 4px; display: inline-flex; }
  .wa-set .kat .erfolg { margin: 0 16px 12px; }
  .wa-set .gespeichert { font-size: 13px; font-weight: 500; color: var(--success-color, #43a047); }
  .wa-set .toast.ok { background: var(--success-color, #43a047); color: #fff; }
  .wa-set .feldschloss { flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%; background: none; cursor: pointer; padding: 0;
                         color: var(--secondary-text-color); display: inline-flex; align-items: center; justify-content: center; }
  .wa-set .feldschloss.an { color: var(--warning-color, #ff9800); }
  .wa-set .feldschloss ha-icon { --mdc-icon-size: 18px; }
  .wa-set .zeile.fest .steuer { opacity: .55; }
  .wa-set .zeile.blitz { animation: wa-blitz 1.6s ease-out; }
  @keyframes wa-blitz { 0%, 30% { background: rgba(255,152,0,.25); } 100% { background: transparent; } }
  .wa-set .benutzer { margin: 8px 16px 12px; border: 1px solid var(--divider-color); border-radius: 12px; overflow: hidden; }
  .wa-set .benutzer .kopf { display: flex; align-items: center; gap: 10px; padding: 10px 12px; flex-wrap: wrap;
                            background: var(--secondary-background-color); }
  .wa-set .benutzer .kopf b { flex: 1 1 auto; font-weight: 500; }
  .wa-set .benutzer select { width: auto; }
  .wa-set .benutzer table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .wa-set .benutzer th, .wa-set .benutzer td { text-align: left; padding: 8px 10px; border-top: 1px solid var(--divider-color); vertical-align: middle; }
  .wa-set .benutzer th { font-weight: 500; color: var(--secondary-text-color); font-size: 13px; }
  .wa-set .benutzer tr.alle td { background: rgba(var(--rgb-primary-color, 3,169,244), .05); font-weight: 500; }
  .wa-set .benutzer .status { font-size: 12px; padding: 2px 8px; border-radius: 8px; white-space: nowrap; display: inline-block; }
  .wa-set .benutzer .status.standard { background: var(--secondary-background-color); color: var(--secondary-text-color); }
  .wa-set .benutzer .status.eigen { background: rgba(var(--rgb-primary-color, 3,169,244), .14); color: var(--primary-color); }
  .wa-set .benutzer .status.sync { background: rgba(67,160,71,.14); color: var(--success-color, #43a047); }
  .wa-set .benutzer .status.fest { background: rgba(255,152,0,.16); color: var(--warning-color, #ef6c00); margin-left: 4px; }
  .wa-set .schalter-klein { width: 36px; height: 20px; accent-color: var(--primary-color); cursor: pointer; }
  .wa-set .kat-kopf .ganz { font-size: 12px; padding: 4px 10px; }
  .wa-set .vorschau-tabelle { max-height: 50vh; overflow: auto; margin: 8px 0; border: 1px solid var(--divider-color); border-radius: 8px; }
  .wa-set .vorschau-tabelle table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .wa-set .vorschau-tabelle th, .wa-set .vorschau-tabelle td { padding: 6px 8px; border-top: 1px solid var(--divider-color); text-align: left; }
  .wa-set .vorschau-tabelle th { position: sticky; top: 0; background: var(--card-background-color); border-top: none; font-weight: 500; }
  .wa-set .vorschau-tabelle .details td { background: var(--secondary-background-color); color: var(--secondary-text-color); font-size: 12px; }
  .wa-set .vorschau-tabelle button.auf { border: none; background: none; cursor: pointer; color: var(--primary-color); padding: 0 4px; }
  .wa-set .dialog .fenster.breit { width: min(760px, 100%); }
  .wa-set .abschnitt-kopf { display: flex; align-items: center; gap: 10px; padding: 14px 16px 4px; font-size: 16px; font-weight: 500;
                            border-top: 1px solid var(--divider-color); }
  .wa-set .abschnitt-kopf ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .wa-set .augen { position: relative; flex: 1 1 220px; display: flex; }
  .wa-set .augen input { flex: 1 1 auto; padding-right: 40px; }
  .wa-set .augen button { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
  .wa-set .verwaltet { padding: 40px 16px; text-align: center; color: var(--secondary-text-color); font-size: 15px; }
  .wa-set .verwaltet ha-icon { --mdc-icon-size: 40px; display: block; margin: 0 auto 12px; }
  .wa-set .dialog ul { margin: 8px 0; padding-left: 20px; font-size: 14px; color: var(--primary-text-color); }
  @media (max-width: 870px) {
    .wa-set { display: block; padding: 0 8px 16px; }
    .wa-set .toc { display: none; }
    .wa-set main { gap: 12px; }
    .wa-set .sprung { display: block; position: sticky; top: 0; z-index: 5; padding: 8px 0; background: var(--primary-background-color); }
    .wa-set .zeile { grid-template-columns: minmax(0, 1fr); }
    .wa-set .steuer { justify-content: flex-start; }
    .wa-set .zeile.schalter-zeile { grid-template-columns: minmax(0, 1fr) auto; }
    .wa-set .person { grid-template-columns: auto 40px minmax(0, 1fr); }
    .wa-set .person .reihenfolge { grid-column: 1; grid-row: 2; flex-direction: row; }
    .wa-set .person .felder { grid-column: 1 / -1; grid-template-columns: minmax(0, 1fr); }
    .wa-set .kat-text { padding-left: 16px; }
  }
`;

export function defineSettingsPage(S, D) {
  // Text for a key that may be missing (e.g. an error code from the server)
  const maybe = (t, key, fallback) => { const text = t(key); return text === key ? fallback : text; };
  const esc = (v) => S.escapeHtml(v);
  const VIEW_KEY = 'whereabouts-settings-view';
  const KEEP_VIEW_MS = 60000; // back within a minute: same place; later: page from the top

  class WhereaboutsSettings extends HTMLElement {
    constructor() {
      super();
      this._scope = 'own'; // own | defaults | user
      this._user = null; // the user whose settings an administrator edits (scope "user")
      this._open = null; // categories that are open (not stored); null = start state
      this._pending = new Map(); // unsaved text/number fields: id -> { label, draft, save, discard }
      this._savables = new Map(); // id -> { api, row }
      this._showTechnical = false;
      this._userFilter = 'all';
      this._import = { person: '', mode: 'merge' };
      this._lastAnchor = null; // where the page was last seen (kept while scrolling)
      this._onScroll = () => {
        if (this._scrollFrame) return;
        this._scrollFrame = requestAnimationFrame(() => { this._scrollFrame = null; this._noteAnchor(); });
      };
      this._beforeUnload = (e) => {
        if (!this._pending.size) return undefined;
        e.preventDefault();
        e.returnValue = '';
        return '';
      };
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      if (first) this._start();
      else this.querySelectorAll('ha-selector').forEach((el) => { el.hass = hass; });
    }

    disconnectedCallback() {
      if (this._unsub) { this._unsub(); this._unsub = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      window.removeEventListener('beforeunload', this._beforeUnload);
      document.removeEventListener('scroll', this._onScroll, true);
      // Left through Home Assistant's sidebar (or rebuilt by it): keep what was not saved and where we were.
      if (this._pending.size) this._storeDrafts();
      this._storeView();
    }

    connectedCallback() {
      window.addEventListener('beforeunload', this._beforeUnload);
      document.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
      if (this._hass && !this._unsub && this._data) {
        this._unsub = S.subscribeInfo(this._hass, (info) => { this._info = info; this._refreshSoon(); });
        this._render();
      }
    }

    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      this._haSelector = await ensureSelector();
      this._restoreView();
      await this._load();
      this._unsub = S.subscribeInfo(this._hass, (info) => { this._info = info; this._refreshSoon(); });
    }

    async _load() {
      try {
        this._data = await this._hass.callWS({ type: 'whereabouts/settings' });
        if (this._scope === 'user' && this._user) await this._loadUser(this._user.id, false);
      } catch (err) {
        this.innerHTML = S.messageHtml(this._t('settings_failed'));
        return;
      }
      if (this._syncAll && this._scope === 'defaults') this._scope = 'own';
      this._render();
    }

    async _loadUser(id, render = true) {
      try {
        this._user = await this._hass.callWS({ type: 'whereabouts/settings/user', user_id: id });
        this._scope = 'user';
      } catch (err) {
        this._user = null;
        this._scope = 'own';
      }
      if (render) this._render();
    }

    _reloadSoon(ms = 1500) {
      clearTimeout(this._reloadTimer);
      this._reloadTimer = setTimeout(() => { if (!this._pending.size) this._load(); }, ms);
    }

    // Changed elsewhere (other tab, other user, integration reloaded): read again,
    // but never redraw while something on the page has the focus or is unsaved.
    _refreshSoon() {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(async () => {
        if (!this._data || (this._info && !this._info.available)) return;
        let fresh;
        try { fresh = await this._hass.callWS({ type: 'whereabouts/settings' }); } catch (err) { return; }
        const old = JSON.stringify(this._data);
        const focused = this.contains(document.activeElement) && document.activeElement !== document.body;
        if (JSON.stringify(fresh) === old || focused || this._pending.size || this.querySelector('.dialog')) return;
        this._data = fresh;
        if (this._scope === 'user' && this._user) await this._loadUser(this._user.id, false);
        this._render();
      }, 600);
    }

    get _admin() { return this._data && this._data.is_admin; }

    get _syncAll() { return Boolean(this._data && this._data.admin && this._data.admin.all_flags && this._data.admin.all_flags.sync); }

    // --- whose values ----------------------------------------------------------------------
    _values(category) {
      if (this._scope === 'defaults') return this._data.defaults[category];
      if (this._scope === 'user' && this._user) return this._user.effective[category];
      return this._data.effective[category];
    }

    _ownValues(category) {
      if (this._scope === 'user' && this._user) return this._user.own[category] || {};
      return this._data.own[category] || {};
    }

    // Fixed for the viewer (non-administrators): whole category or single keys.
    _locked(category) {
      return this._scope === 'own' && this._data.locked.includes(category);
    }

    _fixedKey(category, key) {
      if (this._scope !== 'own' || this._admin) return false;
      const keys = (this._data.field_locks || {})[category] || [];
      return keys.includes('*') || keys.includes(key);
    }

    _userLocks(category) {
      return (this._user && this._user.field_locks && this._user.field_locks[category]) || [];
    }

    _personName(id) {
      const p = (this._data.admin ? this._data.admin.all_persons : this._data.persons).find((x) => x.entity_id === id)
        || this._data.persons.find((x) => x.entity_id === id);
      return p ? p.name : id;
    }

    _userName(id) {
      const u = this._data.admin && this._data.admin.users.find((x) => x.id === id);
      return u ? u.name : id;
    }

    _flag(userId, name) {
      const admin = this._data.admin;
      const own = (admin.user_flags || {})[userId] || {};
      return name in own ? Boolean(own[name]) : Boolean((admin.all_flags || {})[name]);
    }

    // Are there users besides administrators (technical ones like MQTT not counted)?
    _hasOtherUsers() {
      return this._data.admin.users.some((u) => u.active && !u.is_admin && !u.technical);
    }

    _editableUsers() {
      return this._data.admin.users.filter((u) => u.active && !u.is_admin && (this._showTechnical || !u.technical));
    }

    // --- scroll position: kept across redraws and when Home Assistant rebuilds the page ----------
    _scroller() {
      let el = this.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      }
      return document.scrollingElement;
    }

    _anchor() {
      const cards = [...this.querySelectorAll('.kat')];
      const top = Math.max(0, this._scroller() === document.scrollingElement ? 0 : this._scroller().getBoundingClientRect().top);
      const card = cards.find((c) => c.getBoundingClientRect().bottom > top + 10);
      return card ? { id: card.dataset.kat, offset: card.getBoundingClientRect().top - top } : null;
    }

    _restoreAnchor(anchor) {
      if (!anchor) return;
      const card = this.querySelector(`#kat-${anchor.id}`);
      const scroller = this._scroller();
      if (!card || !scroller) return;
      const top = Math.max(0, scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top);
      scroller.scrollTop += card.getBoundingClientRect().top - top - anchor.offset;
    }

    // Only while the page is shown: once Home Assistant has taken it away nothing can be measured.
    _noteAnchor() {
      if (!this.isConnected || !this.getClientRects().length || !this.querySelector('.kat')) return;
      this._lastAnchor = this._anchor();
    }

    // Called by the sidebar page when another tab is shown.
    deactivate() {
      this._noteAnchor();
      this._leftAt = Date.now();
    }

    // Back on this tab: within a minute the same place, later the page as when opened.
    activate() {
      if (!this._data) return;
      const away = this._leftAt ? Date.now() - this._leftAt : 0;
      this._leftAt = null;
      if (away <= KEEP_VIEW_MS) {
        const anchor = this._lastAnchor;
        S.whenSized(this.querySelector('.wa-set'), () => this._restoreAnchor(anchor));
        return;
      }
      this._resetView();
    }

    // Start state: own settings, main areas open, at the top. Areas with unsaved changes stay open.
    _resetView() {
      const unsaved = new Set([...this._pending.keys()].map((id) => {
        const row = this.querySelector(`[data-pid="${window.CSS.escape(id)}"]`);
        const card = row && row.closest('.kat');
        return card && card.dataset.kat;
      }).filter(Boolean));
      const start = new Set(PERSONAL.filter((c) => c.weight === 'main').map((c) => c.id));
      if (this._scope !== 'own' && !this._pending.size) {
        this._scope = 'own';
        this._user = null;
        this._open = start;
        this._pendingAnchor = null;
        this._render();
      } else {
        this.querySelectorAll('.kat').forEach((card) => {
          const id = card.dataset.kat;
          this._setOpen(id, unsaved.size ? unsaved.has(id) : start.has(id));
        });
      }
      this._lastAnchor = null;
      S.whenSized(this.querySelector('.wa-set'), () => requestAnimationFrame(() => {
        const scroller = this._scroller();
        if (scroller) scroller.scrollTop = 0;
      }));
    }

    _storeView() {
      if (!this._data) return;
      const shown = this.isConnected && this.getClientRects().length && this.querySelector('.kat');
      try {
        window.sessionStorage.setItem(VIEW_KEY, JSON.stringify({
          time: Date.now(), anchor: shown ? this._anchor() : this._lastAnchor, open: this._open ? [...this._open] : null,
          scope: this._scope === 'user' ? 'own' : this._scope, success: this._success,
        }));
      } catch (err) { /* no storage */ }
    }

    _restoreView() {
      try {
        const view = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) || 'null');
        window.sessionStorage.removeItem(VIEW_KEY);
        if (!view || Date.now() - view.time > KEEP_VIEW_MS) return;
        if (view.open) this._open = new Set(view.open);
        if (view.scope) this._scope = view.scope;
        this._pendingAnchor = view.anchor;
        this._lastAnchor = view.anchor;
        if (view.success && view.success.until > Date.now()) this._success = view.success;
      } catch (err) { /* nothing */ }
    }

    // --- page -------------------------------------------------------------------------
    _groups() {
      const t = this._t;
      return [
        { title: t('grp_main'), items: PERSONAL.filter((c) => c.weight === 'main') },
        { title: t('grp_more'), items: PERSONAL.filter((c) => c.weight === 'more') },
        { title: t('grp_admin'), items: ADMIN.filter((c) => this._admin || c.everyone || c.id === 'rights') },
      ].filter((g) => g.items.length);
    }

    _render() {
      const t = this._t;
      const d = this._data;
      const anchor = this._pendingAnchor || (this.querySelector('.kat') ? this._anchor() : null);
      this._pendingAnchor = null;
      this._pending.clear();
      this._savables.clear();
      if (d.settings_hidden) {
        this.innerHTML = `<style>${CSS}</style><div class="wa-set"><main><div class="verwaltet">
          <ha-icon icon="mdi:account-lock"></ha-icon>${esc(t('settings_managed'))}</div></main></div>`;
        return;
      }
      if (!this._open) this._open = new Set(PERSONAL.filter((c) => c.weight === 'main').map((c) => c.id));
      const groups = this._groups();
      const lockIcon = (id) => (PERSONAL.some((c) => c.id === id) && d.locked.includes(id) && this._scope === 'own'
        ? '<ha-icon class="schloss" icon="mdi:lock"></ha-icon>' : '');
      const all = groups.flatMap((g) => g.items.map((c) => c.id));
      const allOpen = all.every((id) => this._open.has(id));
      const users = this._admin ? this._editableUsers() : [];
      this.innerHTML = `${S.leafletCss()}<style>${CSS}</style>
        <div class="wa-set">
          <nav class="toc" aria-label="${esc(t('toc'))}">
            ${groups.map((g) => `<div class="gruppe">${esc(g.title)}</div>
              ${g.items.map((c) => `<a data-ziel="${c.id}"><ha-icon icon="${c.icon}"></ha-icon><span>${esc(t(`cat_${c.id}`))}</span>${lockIcon(c.id)}</a>`).join('')}`).join('')}
          </nav>
          <main>
            <div class="sprung"><select class="ein" aria-label="${esc(t('toc'))}">
              ${groups.map((g) => `<optgroup label="${esc(g.title)}">
                ${g.items.map((c) => `<option value="${c.id}">${esc(t(`cat_${c.id}`))}</option>`).join('')}</optgroup>`).join('')}
            </select></div>
            <div class="oben">
              <h1>${esc(t('settings_title'))}</h1>
              <span class="rolle">${this._admin ? '<ha-icon icon="mdi:shield-account"></ha-icon>' : '<ha-icon icon="mdi:account"></ha-icon>'}${esc(this._admin ? t('role_admin', { name: d.user.name }) : d.user.name)}</span>
              <button class="knopf alle-klappen" type="button"><ha-icon icon="${allOpen ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}"></ha-icon>${esc(t(allOpen ? 'collapse_all' : 'expand_all'))}</button>
            </div>
            <div class="entwuerfe"></div>
            <div class="erfolg-oben"></div>
            ${this._admin && (this._hasOtherUsers() || this._scope !== 'own') ? `<div class="wessen">
              <label for="wa-wessen" class="hinweis">${esc(t('settings_of'))}</label>
              <select class="ein" id="wa-wessen">
                <option value="own"${this._scope === 'own' ? ' selected' : ''}>${esc(t('scope_own'))}</option>
                <option value="defaults"${this._scope === 'defaults' ? ' selected' : ''}${this._syncAll ? ' disabled' : ''}>${esc(t('scope_defaults'))}</option>
                ${users.length ? `<optgroup label="${esc(t('scope_users'))}">${users.map((u) => `<option value="user:${esc(u.id)}"${this._scope === 'user' && this._user && this._user.id === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</optgroup>` : ''}
              </select>
              ${this._scope === 'own' ? `<button class="knopf uebernehmen" type="button"${this._syncAll ? ' disabled' : ''}><ha-icon icon="mdi:account-multiple-check"></ha-icon>${esc(t('promote_all'))}</button>` : ''}
            </div>` : ''}
            ${this._scope === 'defaults' ? `<div class="banner standard"><ha-icon icon="mdi:account-multiple"></ha-icon><span class="text">${esc(t('editing_defaults'))}</span></div>` : ''}
            ${this._scope === 'user' && this._user ? `<div class="banner standard"><ha-icon icon="mdi:account-edit"></ha-icon><span class="text">${esc(t('editing_user', { name: this._user.name }))}${this._flag(this._user.id, 'hide_settings') ? ` ${esc(t('editing_user_hidden', { name: this._user.name }))}` : ''}${this._user.synced ? ` ${esc(t('editing_user_synced', { name: this._user.name }))}` : ''}</span></div>` : ''}
            <p class="hinweis">${esc(this._scope === 'defaults' ? t('scope_defaults_text') : this._scope === 'user' ? t('scope_user_text') : t('scope_own_text'))}</p>
            ${this._admin && this._scope !== 'user' ? `<p class="hinweis">${esc(t('lock_explain'))}</p>` : ''}
            ${!this._admin && (d.locked.length || Object.keys(d.field_locks || {}).length) ? `<div class="banner"><ha-icon icon="mdi:lock"></ha-icon><span class="text">${esc(t('locked_hint'))}</span></div>` : ''}
            ${PERSONAL.map((c) => this._categoryHtml(c, true)).join('')}
            ${ADMIN.filter((c) => this._admin || c.everyone || c.id === 'rights').map((c) => this._categoryHtml(c, false)).join('')}
            ${this._scope === 'own' ? `<div class="fuss"><button class="knopf gefahr alles-zurueck"><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_all'))}</button></div>` : ''}
            <p class="hinweis klein">Whereabouts ${esc(d.version)}</p>
          </main>
        </div>`;
      this._wire();
      this._showDrafts();
      this._showSuccess();
      requestAnimationFrame(() => { this._restoreAnchor(anchor); this._noteAnchor(); });
    }

    _categoryHtml(c, personal) {
      const t = this._t;
      const locked = personal && this._locked(c.id);
      const closed = !this._open.has(c.id);
      const lock = personal && this._admin && this._scope !== 'user' ? this._lockState(c.id) : null;
      const userWhole = personal && this._scope === 'user' && this._userLocks(c.id).includes('*');
      return `<ha-card class="kat${closed ? ' zu' : ''}${locked ? ' gesperrt' : ''}" id="kat-${c.id}" data-kat="${c.id}">
        <div class="kat-kopf" role="button" tabindex="0" aria-expanded="${closed ? 'false' : 'true'}">
          <ha-icon class="symbol" icon="${c.icon}"></ha-icon>
          <div class="titelblock"><h2>${esc(t(`cat_${c.id}`))}</h2><div class="kurz">${esc(this._summary(c.id))}</div></div>
          ${locked ? `<span class="marke"><ha-icon icon="mdi:lock"></ha-icon>${esc(t('locked_badge'))}</span>` : ''}
          ${personal && this._scope === 'user' ? `<button class="knopf ganz${userWhole ? ' voll' : ''}" type="button" data-kat="${c.id}"><ha-icon icon="${userWhole ? 'mdi:lock' : 'mdi:lock-open-variant-outline'}"></ha-icon>${esc(t(userWhole ? 'fix_category_off' : 'fix_category', { name: this._user.name }))}</button>` : ''}
          ${lock ? `<button class="knopf rund sperre" title="${esc(this._lockTitle(c.id))}" aria-label="${esc(this._lockTitle(c.id))}"${this._syncAll ? ' disabled' : ''}><ha-icon icon="${lock === 'none' ? 'mdi:lock-open-variant-outline' : 'mdi:lock'}"></ha-icon></button>` : ''}
          ${!personal && !this._admin && c.id !== 'data' ? `<span class="marke"><ha-icon icon="mdi:shield-account"></ha-icon>${esc(t('admin_badge'))}</span>` : ''}
          <ha-icon class="pfeil" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="kat-inhalt">
          <p class="kat-text">${esc(t(`cd_${c.id}`))}</p>
          <div class="felder" data-kat="${c.id}"></div>
          ${personal ? this._footHtml(c.id, locked) : this._adminFootHtml(c)}
        </div>
      </ha-card>`;
    }

    _footHtml(category, locked) {
      const t = this._t;
      const own = this._ownValues(category);
      const canReset = !locked && (this._scope === 'defaults' ? true : own && Object.keys(own).length);
      const promote = this._admin && this._scope === 'own' && this._hasOtherUsers();
      if (!canReset && !promote) return '<div class="fuss" hidden></div>';
      return `<div class="fuss">
        ${promote ? `<button class="knopf standard-setzen" data-kat="${category}"${this._syncAll ? ' disabled' : ''}><ha-icon icon="mdi:account-multiple-check"></ha-icon>${esc(t('make_default'))}</button>` : ''}
        ${canReset ? `<button class="knopf gefahr zurueck" data-kat="${category}"><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_category'))}</button>` : ''}
      </div>`;
    }

    _adminFootHtml(c) {
      if (!this._admin || !c.reset) return '';
      return `<div class="fuss"><button class="knopf gefahr optionen-zurueck" data-kat="${c.id}"><ha-icon icon="mdi:restore"></ha-icon>${esc(this._t('reset_category'))}</button></div>`;
    }

    _refreshFoot(category) {
      const card = this.querySelector(`#kat-${category}`);
      if (!card) return;
      const old = card.querySelector('.fuss');
      const holder = document.createElement('div');
      holder.innerHTML = this._footHtml(category, this._locked(category));
      const foot = holder.firstElementChild;
      if (old) old.replaceWith(foot); else card.querySelector('.kat-inhalt').appendChild(foot);
      this._wireFoot(foot);
    }

    _wireFoot(root) {
      const t = this._t;
      root.querySelectorAll('.zurueck').forEach((b) => b.addEventListener('click', () => this._resetCategory(b.dataset.kat)));
      root.querySelectorAll('.standard-setzen').forEach((b) => b.addEventListener('click', async () => {
        const name = t(`cat_${b.dataset.kat}`);
        if (!await this._confirm(t('make_default'), t('confirm_make_default', { name }), t('make_default'), false)) return;
        if (await this._ws({ type: 'whereabouts/settings/promote', category: b.dataset.kat }, true) !== null) {
          this._setSuccess(t('success_make_default', { name }), b.dataset.kat);
          await this._load();
        }
      }));
      root.querySelectorAll('.optionen-zurueck').forEach((b) => b.addEventListener('click', async () => {
        const c = ADMIN.find((x) => x.id === b.dataset.kat);
        const name = t(`cat_${c.id}`);
        if (!await this._confirm(t('reset_category'), t('confirm_reset_options', { name }), t('reset'), true)) return;
        this._discardIn(c.id);
        this._noteAnchor();
        this._storeView();
        if (await this._ws({ type: 'whereabouts/settings/options_reset', keys: c.reset }, true) !== null) {
          this._setSuccess(t('success_reset', { name }), c.id);
          this._reloadSoon(1200);
        }
      }));
    }

    // --- success box (green, stays a few seconds, survives redraws) ----------------------------------
    _setSuccess(text, category) {
      this._success = { text, category: category || '', until: Date.now() + 8000 };
      this._showSuccess();
    }

    _showSuccess() {
      this.querySelectorAll('.erfolg').forEach((el) => el.remove());
      const s = this._success;
      if (!s || s.until < Date.now()) { this._success = null; return; }
      const box = document.createElement('div');
      box.className = 'erfolg';
      box.setAttribute('role', 'status');
      box.innerHTML = `<ha-icon icon="mdi:check-circle"></ha-icon><span class="text">${esc(s.text)}</span>
        <button type="button" aria-label="${esc(this._t('close'))}"><ha-icon icon="mdi:close"></ha-icon></button>`;
      box.querySelector('button').addEventListener('click', () => { this._success = null; box.remove(); });
      const card = s.category && this.querySelector(`#kat-${s.category} .kat-inhalt`);
      if (card) card.appendChild(box); else (this.querySelector('.erfolg-oben') || this).appendChild(box);
      clearTimeout(this._successTimer);
      this._successTimer = setTimeout(() => { this._success = null; box.remove(); }, Math.max(0, s.until - Date.now()));
    }

    // Short info in a closed category's header.
    _summary(id) {
      const t = this._t;
      const d = this._data;
      const v = PERSONAL.some((c) => c.id === id) ? this._values(id) : null;
      const o = d.admin ? d.admin.options : {};
      const every = (auto, n) => (auto === false ? t('sum_refresh_off') : t('sum_refresh', { n }));
      switch (id) {
        case 'views': return ['live', 'history', 'settings'].filter((k) => v[`view_${k}`] !== false).map((k) => t(`opt_view_${k}`)).join(', ');
        case 'persons': {
          const all = this._selectablePersons();
          const shown = (v.persons || []).filter((x) => all.some((p) => p.entity_id === x));
          return t('sum_persons', { n: shown.length || all.length, of: all.length });
        }
        case 'map': return `${t(`ed_tiles_${v.tiles}`)} · ${t(`ed_style_${v.map_style}`)}`;
        case 'zones': {
          const zones = this._zoneList();
          const hidden = zones.filter((z) => (v.hidden_zones || []).includes(z.entity_id)).length;
          const count = hidden ? t('sum_zones_hidden', { n: zones.length, h: hidden }) : t('sum_zones', { n: zones.length });
          return `${count} · ${t(`zones_in_${v.zones_in || 'both'}`)}`;
        }
        case 'live': return every(v.live_auto_refresh, v.live_refresh_interval);
        case 'history': return `${every(v.history_auto_refresh, v.history_refresh_interval)} · ${t(`ed_view_${v.default_view}`)}`;
        case 'base': return d.admin ? t('sum_persons', { n: d.persons.length, of: d.admin.all_persons.length }) : '';
        case 'rights': {
          if (!d.admin) return '';
          const r = d.admin.rights_default;
          return ['live', 'history', 'delete'].map((k) => `${t(`sum_right_${k}`)}: ${t(`level_${r[k]}`)}`).join(' · ');
        }
        case 'sidebar': return o.panel === false ? t('sum_no_entry') : t('sum_entry', { name: o.panel_title || t('panel_title') });
        case 'recording': {
          const n = (o.record_persons || []).length;
          return n ? t('sum_recording', { n }) : t('sum_recording_none');
        }
        case 'addresses': return o.address_source ? t(`opt_address_${o.address_source}`) : '';
        default: return '';
      }
    }

    _lockState(category) {
      const lock = (this._data.admin && this._data.admin.locks[category]) || {};
      return lock.mode || 'none';
    }

    // "Fixed for all users except Belinda" – shown as tooltip on the lock.
    _lockTitle(category) {
      const t = this._t;
      const lock = (this._data.admin && this._data.admin.locks[category]) || {};
      const names = (ids) => (ids || []).map((id) => this._userName(id)).join(', ');
      if (lock.mode === 'all') return lock.except && lock.except.length ? t('lock_state_all_except', { names: names(lock.except) }) : t('lock_state_all');
      if (lock.mode === 'selected') return t('lock_state_selected', { names: names(lock.users) || t('nobody') });
      return t('lock_state_none');
    }

    _wire() {
      const t = this._t;
      this.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', () => this._jump(a.dataset.ziel)));
      const jump = this.querySelector('.sprung select');
      jump.addEventListener('change', () => this._jump(jump.value));
      const whose = this.querySelector('#wa-wessen');
      if (whose) {
        whose.addEventListener('change', async () => {
          const value = whose.value;
          if (!await this.confirmLeave()) { this._render(); return; }
          if (value.startsWith('user:')) await this._loadUser(value.slice(5));
          else { this._scope = value; this._user = null; this._render(); }
        });
      }
      this.querySelectorAll('.kat-kopf').forEach((head) => {
        const toggle = (e) => {
          if (e.target.closest('button')) return;
          this._setOpen(head.closest('.kat').dataset.kat, head.closest('.kat').classList.contains('zu'));
        };
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
      });
      this.querySelector('.alle-klappen').addEventListener('click', () => {
        const ids = [...this.querySelectorAll('.kat')].map((c) => c.dataset.kat);
        const open = !ids.every((id) => this._open.has(id));
        ids.forEach((id) => this._setOpen(id, open));
      });
      this.querySelectorAll('.sperre').forEach((b) => b.addEventListener('click', () => this._lockDialog(b.closest('.kat').dataset.kat)));
      this.querySelectorAll('.kat-kopf .ganz').forEach((b) => b.addEventListener('click', () => {
        const whole = this._userLocks(b.dataset.kat).includes('*');
        this._setFieldLock(b.dataset.kat, whole ? [] : ['*']);
      }));
      this._wireFoot(this);
      const promote = this.querySelector('.uebernehmen');
      if (promote) {
        promote.addEventListener('click', async () => {
          if (!await this._confirm(t('promote_all'), t('confirm_promote_all'), t('promote_all'), false)) return;
          if (await this._ws({ type: 'whereabouts/settings/promote' }, true) !== null) {
            this._setSuccess(t('success_promote_all'));
            await this._load();
          }
        });
      }
      const all = this.querySelector('.alles-zurueck');
      if (all) {
        all.addEventListener('click', async () => {
          if (!await this._confirm(t('reset_all'), t('confirm_reset_all'), t('reset'), true)) return;
          await this._ws({ type: 'whereabouts/settings/reset', scope: 'own' }, true);
          await this._load();
        });
      }
      PERSONAL.forEach((c) => this._fillPersonal(c));
      ADMIN.forEach((c) => {
        const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
        if (!box) return;
        if (this._admin && c.options) {
          const options = this._data.admin.options;
          c.options.forEach((f) => box.appendChild(f.persons
            ? this._personsOption(f)
            : this._row(f, options[f.key], false, (value) => this._saveOption(f, value),
              { kind: 'option', key: f.key, label: t(`st_${f.key}`) })));
        }
        if (c.custom === 'base' && this._admin) this._base(box);
        if (c.custom === 'rights') this._rights(box);
        if (c.custom === 'sensors' && this._admin) this._sensors(box);
        if (c.custom === 'data') this._dataSection(box);
        if (c.custom === 'diagnostics' && this._open.has('diagnostics')) this._loadDiagnostics();
      });
      this._watchToc();
    }

    _setOpen(id, open) {
      const card = this.querySelector(`#kat-${id}`);
      if (!card) return;
      card.classList.toggle('zu', !open);
      card.querySelector('.kat-kopf').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        this._open.add(id);
        if (id === 'diagnostics') this._loadDiagnostics();
      } else this._open.delete(id);
      const ids = [...this.querySelectorAll('.kat')].map((c) => c.dataset.kat);
      const allOpen = ids.every((x) => this._open.has(x));
      const button = this.querySelector('.alle-klappen');
      if (button) {
        button.innerHTML = `<ha-icon icon="${allOpen ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}"></ha-icon>${esc(this._t(allOpen ? 'collapse_all' : 'expand_all'))}`;
      }
    }

    _updateSummary(id) {
      const el = this.querySelector(`#kat-${id} .kurz`);
      if (el) el.textContent = this._summary(id);
    }

    _jump(id) {
      const card = this.querySelector(`#kat-${id}`);
      if (!card) return;
      this._setOpen(id, true);
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Highlights the category that is in view.
    _watchToc() {
      if (this._observer) this._observer.disconnect();
      if (!window.IntersectionObserver) return;
      const visible = new Map();
      this._observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => visible.set(e.target.dataset.kat, e.isIntersecting ? e.boundingClientRect.top : null));
        const best = [...visible.entries()].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1])[0];
        if (!best) return;
        this.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('aktiv', a.dataset.ziel === best[0]));
        const jump = this.querySelector('.sprung select');
        if (jump && document.activeElement !== jump) jump.value = best[0];
      }, { rootMargin: '0px 0px -60% 0px' });
      this.querySelectorAll('.kat').forEach((card) => this._observer.observe(card));
    }

    // --- a personal category ------------------------------------------------------------------
    _fillPersonal(c) {
      const t = this._t;
      const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
      box.innerHTML = '';
      if (c.custom === 'persons') { this._persons(box, c.id); return; }
      const values = this._values(c.id);
      const locked = this._locked(c.id);
      c.fields.forEach((f) => {
        let row;
        if (f.custom === 'tiles') row = this._tiles(c.id);
        else if (f.custom === 'zones') row = this._zones(c.id);
        else {
          const fixed = locked || this._fixedKey(c.id, f.key);
          row = this._row(f, values[f.key], fixed, (value) => this._savePersonal(c.id, f.key, value),
            { kind: 'personal', scope: this._scope, user: this._user && this._user.id, category: c.id, key: f.key, label: t(`st_${f.key}`) });
          if (fixed && !locked) row.classList.add('fest');
        }
        row.dataset.key = f.key;
        if (f.needs) row.dataset.needs = f.needs;
        this._fieldLockButton(row, c.id, f.custom === 'tiles' ? ['tiles'] : f.custom === 'zones' ? ['hidden_zones', 'zone_colors'] : [f.key]);
        box.appendChild(row);
      });
      this._applyNeeds(c.id);
    }

    // Scope "user": a lock per setting fixes it for this user.
    _fieldLockButton(row, category, keys) {
      if (this._scope !== 'user' || !this._user) return;
      const locks = this._userLocks(category);
      const whole = locks.includes('*');
      const on = whole || keys.every((k) => locks.includes(k));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `feldschloss${on ? ' an' : ''}`;
      button.disabled = whole;
      const title = this._t(on ? 'field_fixed' : 'field_free', { name: this._user.name });
      button.title = title;
      button.setAttribute('aria-label', title);
      button.innerHTML = `<ha-icon icon="${on ? 'mdi:lock' : 'mdi:lock-open-variant-outline'}"></ha-icon>`;
      button.addEventListener('click', () => {
        const next = on ? locks.filter((k) => !keys.includes(k)) : [...new Set([...locks, ...keys])];
        this._setFieldLock(category, next);
      });
      const label = row.querySelector('.beschriftung');
      if (label) label.appendChild(button);
    }

    async _setFieldLock(category, keys) {
      const ok = await this._ws({ type: 'whereabouts/settings/field_lock', user_id: this._user.id, category, keys }, true);
      if (ok === null) return;
      this._user.field_locks = { ...(this._user.field_locks || {}), [category]: keys };
      if (!keys.length) delete this._user.field_locks[category];
      this._rerenderCategory(category);
    }

    // Only this category again (the rest of the page stays where it is).
    _rerenderCategory(category) {
      const old = this.querySelector(`#kat-${category}`);
      const c = PERSONAL.find((x) => x.id === category);
      if (!old || !c) { this._render(); return; }
      [...this._pending.keys()].filter((k) => k.includes(`:${category}:`)).forEach((k) => this._pending.delete(k));
      const holder = document.createElement('div');
      holder.innerHTML = this._categoryHtml(c, true);
      const card = holder.firstElementChild;
      old.replaceWith(card);
      const head = card.querySelector('.kat-kopf');
      const toggle = (e) => { if (!e.target.closest('button')) this._setOpen(category, card.classList.contains('zu')); };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
      card.querySelectorAll('.sperre').forEach((b) => b.addEventListener('click', () => this._lockDialog(category)));
      card.querySelectorAll('.kat-kopf .ganz').forEach((b) => b.addEventListener('click', () => {
        const whole = this._userLocks(category).includes('*');
        this._setFieldLock(category, whole ? [] : ['*']);
      }));
      this._wireFoot(card);
      this._fillPersonal(c);
      if (this._observer) this._observer.observe(card);
      this._showSuccess();
    }

    // Greys out what only matters when another setting is on.
    _applyNeeds(category) {
      const values = this._values(category);
      const box = this.querySelector(`.felder[data-kat="${category}"]`);
      if (!box) return;
      box.querySelectorAll('[data-needs]').forEach((row) => {
        const value = values[row.dataset.needs];
        const off = value === false || value === 'none';
        row.classList.toggle('aus', off);
        row.querySelectorAll('ha-selector, input, select, button.knopf').forEach((el) => {
          if (el.dataset.immer) return;
          el.disabled = off || this._locked(category) || this._fixedKey(category, row.dataset.key);
        });
      });
      const zones = box.querySelector('.zonen');
      if (zones) zones.classList.toggle('aus', values.zones_in === 'none');
    }

    // Origin of a value: the default or an own value (for me / for a user).
    _originHtml(category, key) {
      if (this._scope === 'defaults' || !PERSONAL.some((c) => c.id === category)) return '';
      const own = this._ownValues(category);
      const mine = Object.prototype.hasOwnProperty.call(own, key) && !this._locked(category);
      return `<span class="herkunft${mine ? ' eigen' : ''}">${esc(this._t(mine ? 'origin_own' : 'origin_default'))}</span>`;
    }

    _updateOrigin(category, key) {
      const box = this.querySelector(`.felder[data-kat="${category}"] [data-key="${key}"] .herkunft`);
      if (!box) return;
      const holder = document.createElement('span');
      holder.innerHTML = this._originHtml(category, key);
      if (holder.firstElementChild) box.replaceWith(holder.firstElementChild);
    }

    // --- one setting: label, ⓘ, control -----------------------------------------------------
    // draft: { kind, scope, user, category, key, label } – how an unsaved text/number value is saved later.
    _row(field, value, disabled, onChange, draft) {
      const t = this._t;
      const row = document.createElement('div');
      const selector = typeof field.sel === 'function' ? field.sel(t) : field.sel;
      const isSwitch = 'boolean' in selector;
      row.className = `zeile${isSwitch ? ' schalter-zeile' : ''}`;
      const label = field.label || t(`st_${field.key}`);
      const origin = draft && draft.category ? this._originHtml(draft.category, field.key) : '';
      const fixedNote = disabled && draft && draft.category && this._fixedKey(draft.category, field.key) && !this._locked(draft.category)
        ? `<span class="herkunft">${esc(t('locked_badge'))}</span>` : '';
      row.innerHTML = `<div class="beschriftung"><span>${esc(label)}</span>${origin}${fixedNote}
          <button class="info" type="button" aria-expanded="false" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}: ${esc(label)}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer${isSwitch ? ' schalter' : ''}"></div>
        <div class="infotext" hidden>${esc(field.info || t(`si_${field.key}`))}</div>`;
      this._infoToggle(row);
      const typed = Boolean(field.text || 'number' in selector);
      if (!typed) {
        row.querySelector('.steuer').appendChild(this._control(selector, field, value, disabled, onChange));
        return row;
      }
      // Text and numbers: only "Save" or Enter saves.
      const id = `${draft ? `${draft.kind}:${draft.scope || ''}:${draft.user || ''}:${draft.category || ''}:` : ''}${field.key}${field.idSuffix || ''}`;
      const savable = this._savable(row, {
        id, label, initial: value ?? (field.text ? '' : value), draft,
        save: (v) => onChange(v),
      });
      const control = this._control(selector, field, value, disabled, (v) => savable.set(field.text ? (v ?? '') : v));
      savable.reset = (v) => { if (control.tagName === 'HA-SELECTOR') control.value = v; else control.value = v ?? ''; };
      savable.focus = () => { const input = control.tagName === 'HA-SELECTOR' ? control : control; input.focus && input.focus(); };
      row.querySelector('.steuer').appendChild(control);
      return row;
    }

    // A "Not saved · Save" line for a row. Returns { set(value), reset, focus }.
    _savable(row, spec) {
      const t = this._t;
      const line = document.createElement('div');
      line.className = 'speicher';
      const unsavedHtml = `<span class="ungespeichert">${esc(t('not_saved'))}</span>
        <button class="knopf verwerfen" type="button" data-immer="1"><ha-icon icon="mdi:undo"></ha-icon>${esc(t('discard'))}</button>
        <button class="knopf voll speichern" type="button" data-immer="1"><ha-icon icon="mdi:content-save"></ha-icon>${esc(t('save'))}</button>`;
      line.innerHTML = unsavedHtml;
      row.appendChild(line);
      row.dataset.pid = spec.id;
      const state = { initial: spec.initial, current: spec.initial };
      const showSaved = () => {
        line.classList.add('an');
        line.innerHTML = `<span class="gespeichert">${esc(t('saved_check'))}</span>`;
        clearTimeout(line._timer);
        line._timer = setTimeout(() => {
          if (line.querySelector('.gespeichert')) line.classList.remove('an');
        }, 2500);
      };
      const showUnsaved = () => {
        if (!line.querySelector('.speichern')) {
          line.innerHTML = unsavedHtml;
          line.querySelector('.speichern').addEventListener('click', () => api.save());
          line.querySelector('.verwerfen').addEventListener('click', () => api.discard());
        }
        line.classList.add('an');
      };
      const api = {
        set: (v) => {
          state.current = v;
          const dirty = !same(v, state.initial);
          if (dirty) {
            showUnsaved();
            this._pending.set(spec.id, {
              label: spec.label,
              draft: spec.draft ? { ...spec.draft, id: spec.id, value: v } : null,
              save: () => api.save(),
              discard: () => api.discard(),
            });
          } else {
            if (line.querySelector('.speichern')) line.classList.remove('an');
            this._pending.delete(spec.id);
          }
        },
        save: async () => {
          if (same(state.current, state.initial)) return true;
          const value = state.current;
          // From the click on: no longer "unsaved" (the page may be rebuilt meanwhile).
          const pending = this._pending.get(spec.id);
          this._pending.delete(spec.id);
          const button = line.querySelector('.speichern');
          if (button) button.disabled = true;
          const ok = await spec.save(value);
          if (button) button.disabled = false;
          if (ok === false || ok === null) {
            if (pending && row.isConnected) this._pending.set(spec.id, pending);
            return false;
          }
          state.initial = value;
          if (row.isConnected) showSaved();
          return true;
        },
        // Back to the saved value.
        discard: () => {
          api.reset(state.initial);
          api.set(state.initial);
          this._forgetDraft(spec.id);
        },
        reset: () => {},
        focus: () => {},
      };
      line.querySelector('.speichern').addEventListener('click', () => api.save());
      line.querySelector('.verwerfen').addEventListener('click', () => api.discard());
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        if (!this._pending.has(spec.id)) return;
        e.preventDefault();
        api.save();
      });
      this._savables.set(spec.id, { api, row });
      return api;
    }

    // Jump to an unsaved field (from the leave dialog or the drafts hint).
    _goToField(id, value) {
      const entry = this._savables.get(id);
      if (!entry) return;
      const card = entry.row.closest('.kat');
      if (card) this._setOpen(card.dataset.kat, true);
      if (value !== undefined) { entry.api.reset(value); entry.api.set(value); }
      entry.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      entry.row.classList.remove('blitz');
      void entry.row.offsetWidth;
      entry.row.classList.add('blitz');
      // Remove it again: a page shown again would replay the animation.
      entry.row.addEventListener('animationend', () => entry.row.classList.remove('blitz'), { once: true });
      setTimeout(() => entry.api.focus(), 400);
    }

    _control(selector, field, value, disabled, emit) {
      const shown = field.color ? hexToRgb(value) : value;
      const out = (v) => emit(field.color ? rgbToHex(v) : v);
      if (this._haSelector) {
        const el = document.createElement('ha-selector');
        el.hass = this._hass;
        el.selector = selector;
        el.value = shown;
        el.disabled = disabled;
        // required: no "clear" cross in selections
        el.required = 'select' in selector;
        el.addEventListener('value-changed', (e) => { e.stopPropagation(); el.value = e.detail.value; out(e.detail.value); });
        return el;
      }
      return this._plainControl(selector, field, value, disabled, out);
    }

    // Without Home Assistant's form elements: plain inputs.
    _plainControl(selector, field, value, disabled, emit) {
      let el;
      if ('boolean' in selector) {
        el = document.createElement('input');
        el.type = 'checkbox';
        el.checked = Boolean(value);
        el.addEventListener('change', () => emit(el.checked));
      } else if ('select' in selector) {
        el = document.createElement('select');
        el.className = 'ein';
        selector.select.options.forEach((o) => el.add(new Option(o.label, o.value, false, o.value === value)));
        el.addEventListener('change', () => emit(el.value));
      } else if ('color_rgb' in selector) {
        el = document.createElement('input');
        el.type = 'color';
        el.className = 'ein';
        el.value = (value || '#000000').toLowerCase();
        el.addEventListener('change', () => emit(hexToRgb(el.value)));
      } else {
        el = document.createElement('input');
        el.className = 'ein';
        el.type = 'number' in selector ? 'number' : 'text';
        if ('number' in selector) { el.min = selector.number.min; el.max = selector.number.max; el.step = selector.number.step; }
        el.value = value === undefined || value === null ? '' : value;
        el.addEventListener('input', () => emit('number' in selector ? Number(el.value) : el.value));
      }
      el.disabled = disabled;
      return el;
    }

    // Ticks for persons (instead of Home Assistant's entity picker).
    _checkList(persons, chosen, disabled, onChange, extra) {
      const box = document.createElement('div');
      box.className = 'liste-haken';
      const set = new Set(chosen);
      persons.forEach((p) => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${esc(p.entity_id)}"${set.has(p.entity_id) ? ' checked' : ''}${disabled ? ' disabled' : ''}>
          <span>${esc(p.name)}</span>${extra ? `<span class="klein">${esc(extra(p) || '')}</span>` : ''}`;
        label.querySelector('input').addEventListener('change', async (e) => {
          const next = new Set(set);
          if (e.target.checked) next.add(p.entity_id); else next.delete(p.entity_id);
          const ok = await onChange([...persons.map((x) => x.entity_id).filter((id) => next.has(id))], e.target);
          if (ok === false) { e.target.checked = !e.target.checked; return; }
          if (e.target.checked) set.add(p.entity_id); else set.delete(p.entity_id);
        });
        box.appendChild(label);
      });
      return box;
    }

    _infoToggle(root) {
      root.querySelectorAll('.info').forEach((info) => {
        if (info.dataset.verbunden) return;
        info.dataset.verbunden = '1';
        info.addEventListener('click', () => {
          const text = info.closest('.zeile, .person, .schluessel').querySelector('.infotext');
          text.hidden = !text.hidden;
          info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
        });
      });
    }

    // --- saving -------------------------------------------------------------------------------
    // quiet: no message (the field shows "Saved ✓" itself); errors always.
    async _ws(message, quiet = true) {
      try {
        const result = await this._hass.callWS(message);
        if (!quiet) this._toast(this._t('saved'), false, true);
        return result === undefined || result === null ? true : result;
      } catch (err) {
        this._toast(this._t('save_failed', { error: (err && (err.message || err.code)) || err }), true);
        return null;
      }
    }

    _saveMessage(category, values) {
      const message = { type: 'whereabouts/settings/save', scope: this._scope === 'defaults' ? 'defaults' : 'own', category, values };
      if (this._scope === 'user' && this._user) message.user_id = this._user.id;
      return message;
    }

    async _savePersonal(category, key, value) {
      const ok = await this._ws(this._saveMessage(category, { [key]: value }));
      if (ok === null) return false;
      if (this._scope === 'defaults') this._data.defaults[category][key] = value;
      else if (this._scope === 'user' && this._user) {
        this._user.own[category] = { ...(this._user.own[category] || {}), [key]: value };
        this._user.effective[category][key] = value;
      } else {
        this._data.own[category] = { ...(this._data.own[category] || {}), [key]: value };
        this._data.effective[category][key] = value;
      }
      this._refreshFoot(category);
      this._updateOrigin(category, key);
      this._applyNeeds(category);
      this._updateSummary(category);
      return true;
    }

    async _resetCategory(category) {
      const t = this._t;
      const name = t(`cat_${category}`);
      const text = this._scope === 'defaults' ? t('confirm_reset_defaults', { name })
        : this._scope === 'user' ? t('confirm_reset_user', { name, user: this._user.name })
          : t('confirm_reset_category', { name });
      if (!await this._confirm(t('reset_category'), text, t('reset'), true)) return;
      this._discardIn(category);
      const message = { type: 'whereabouts/settings/reset', scope: this._scope === 'defaults' ? 'defaults' : 'own', category };
      if (this._scope === 'user') message.user_id = this._user.id;
      await this._ws(message, true);
      await this._load();
    }

    async _saveOption(field, value) {
      const t = this._t;
      if (field.confirm === 'retention' && Number(value) > 0) {
        const ok = await this._confirm(t('st_retention_days'), t('confirm_retention', { n: value }), t('save'), true);
        if (!ok) return false;
      }
      this._noteAnchor(); // the sidebar entry may make Home Assistant rebuild the page
      this._storeView();
      const ok = await this._ws({ type: 'whereabouts/settings/options', values: { [field.key]: value } });
      if (ok === null) return false;
      this._data.admin.options[field.key] = value;
      ['sidebar', 'recording', 'addresses'].forEach((id) => this._updateSummary(id));
      return true;
    }

    // --- persons (personal) -----------------------------------------------------------------------
    _selectablePersons() {
      const rights = this._scope === 'user' && this._user ? this._user.rights : this._data.rights;
      const allowed = new Set([...(rights.live || []), ...(rights.history || [])]);
      return this._data.persons.filter((p) => this._scope === 'defaults' || (this._admin && this._scope === 'own') || allowed.has(p.entity_id));
    }

    _persons(box, category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'persons');
      const values = this._values(category);
      const settings = JSON.parse(JSON.stringify(values.person_settings || {})); // what is saved
      const all = this._selectablePersons();
      const chosen = (values.persons || []).filter((id) => all.some((p) => p.entity_id === id));
      const order = chosen.length ? [...chosen, ...all.map((p) => p.entity_id).filter((id) => !chosen.includes(id))]
        : all.map((p) => p.entity_id);
      const shown = new Set(chosen.length ? chosen : order);
      const colorOf = (id) => (settings[id] && settings[id].color) || S.personColor(this._hass, {}, id);
      const personOf = (id) => this._data.persons.find((p) => p.entity_id === id) || { entity_id: id, name: id, picture: '' };
      const scope = this._scope;
      const cleaned = () => {
        const out = {};
        Object.entries(settings).forEach(([id, entry]) => {
          const e = Object.fromEntries(Object.entries(entry).filter(([k, v]) => v && !(k === 'show_in' && v === 'both')));
          if (Object.keys(e).length) out[id] = e;
        });
        return out;
      };
      const save = async () => {
        const list = order.filter((id) => shown.has(id));
        const allInOrder = list.length === all.length && list.every((id, i) => id === all[i].entity_id);
        const ok = await this._ws(this._saveMessage(category, { persons: allInOrder ? [] : list, person_settings: cleaned() }));
        if (ok === null) return false;
        const target = this._values(category);
        target.persons = allInOrder ? [] : list;
        target.person_settings = cleaned();
        if (scope === 'own') this._data.own[category] = { persons: target.persons, person_settings: target.person_settings };
        if (scope === 'user' && this._user) this._user.own[category] = { persons: target.persons, person_settings: target.person_settings };
        this._refreshFoot(category);
        this._updateSummary(category);
        warn();
        return true;
      };
      const warnBox = document.createElement('div');
      warnBox.className = 'warnung';
      warnBox.hidden = true;
      const nameOf = (id) => (settings[id] && settings[id].name) || personOf(id).name;
      const warn = () => {
        const entries = order.filter((id) => shown.has(id)).map((id) => ({ name: nameOf(id), color: colorOf(id) }));
        const pairs = S.similarColors(entries);
        warnBox.hidden = !pairs.length;
        warnBox.textContent = pairs.length ? t('ed_similar_colors', { pairs: pairs.map((p) => p.join(' / ')).join(', ') }) : '';
      };
      const draw = () => {
        box.innerHTML = '';
        if (!all.length) {
          box.innerHTML = `<p class="kat-text">${esc(t('no_persons_allowed'))}</p>`;
          return;
        }
        box.appendChild(warnBox);
        order.forEach((id, index) => {
          const p = personOf(id);
          const own = settings[id] || {};
          const row = document.createElement('div');
          row.className = `person${shown.has(id) ? '' : ' aus'}`;
          row.style.setProperty('--farbe', colorOf(id));
          const showIn = own.show_in || 'both';
          row.innerHTML = `
            <div class="reihenfolge">
              <button class="knopf rund hoch" title="${esc(t('move_up'))}" aria-label="${esc(t('move_up'))}" ${index === 0 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-up"></ha-icon></button>
              <button class="knopf rund runter" title="${esc(t('move_down'))}" aria-label="${esc(t('move_down'))}" ${index === order.length - 1 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            </div>
            <div class="bild"></div>
            <div>
              <label class="chip${shown.has(id) ? ' an' : ''}" style="margin-bottom:8px"><input type="checkbox" class="zeigen"${shown.has(id) ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(p.name)}</label>
              <div class="felder">
                <input class="ein name" placeholder="${esc(t('ps_name_placeholder', { name: p.name }))}" aria-label="${esc(t('ed_name'))}" value="${esc(own.name || '')}" maxlength="60" ${locked ? 'disabled' : ''}>
                <input class="ein farbe" type="color" aria-label="${esc(t('ed_color'))}" value="${esc(colorOf(id).toLowerCase())}" ${locked ? 'disabled' : ''}>
                <div class="bildzeile">
                  <input class="ein bildurl" placeholder="${esc(t('ps_picture_placeholder'))}" aria-label="${esc(t('ed_picture'))}" value="${esc(own.picture || '')}" ${locked ? 'disabled' : ''}>
                  <button class="knopf rund hochladen" title="${esc(t('upload_picture'))}" aria-label="${esc(t('upload_picture'))}" ${locked ? 'disabled' : ''}><ha-icon icon="mdi:upload"></ha-icon></button>
                  <input type="file" accept="image/*" hidden>
                </div>
              </div>
              <div class="zweite">
                <label>${esc(t('show_in'))}
                  <select class="ein zeigen-in" ${locked ? 'disabled' : ''}>
                    ${['both', 'live', 'history'].map((v) => `<option value="${v}"${showIn === v ? ' selected' : ''}>${esc(t(`show_in_${v}`))}</option>`).join('')}
                  </select></label>
              </div>
            </div>
            <button class="info" type="button" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}" aria-expanded="false"><ha-icon icon="mdi:information-outline"></ha-icon></button>
            <div class="infotext" hidden style="grid-column:1/-1">${esc(t('si_person'))}</div>`;
          const nameInput = row.querySelector('.name');
          const urlInput = row.querySelector('.bildurl');
          const colorInput = row.querySelector('.farbe');
          const showInput = row.querySelector('.zeigen-in');
          const picture = () => {
            const url = S.safeUrl(urlInput.value.trim()) || S.safeUrl(p.picture);
            const el = row.querySelector('.bild');
            el.style.backgroundImage = url ? `url("${url}")` : '';
            el.textContent = url ? '' : (nameInput.value.trim() || p.name).charAt(0);
          };
          picture();
          // Name, colour, picture and "Show in": one "Save" for the row (or Enter).
          const holder = document.createElement('div');
          holder.style.gridColumn = '1 / -1';
          row.appendChild(holder);
          const read = () => ({
            name: nameInput.value.trim(), color: colorInput.value.toUpperCase(), picture: urlInput.value.trim(), show_in: showInput.value,
          });
          const label = t('draft_person', { name: p.name });
          const savable = this._savable(holder, {
            id: `person:${scope}:${this._user ? this._user.id : ''}:${category}:${id}`,
            label,
            initial: read(),
            draft: { kind: 'person', scope, user: this._user && this._user.id, category, person: id, label },
            save: async (v) => {
              settings[id] = { ...settings[id], ...v };
              row.style.setProperty('--farbe', v.color);
              return save();
            },
          });
          savable.reset = (v) => {
            nameInput.value = v.name; urlInput.value = v.picture; colorInput.value = (v.color || colorOf(id)).toLowerCase();
            showInput.value = v.show_in || 'both';
            row.style.setProperty('--farbe', colorInput.value);
            picture();
          };
          savable.focus = () => nameInput.focus();
          const changed = () => { savable.set(read()); picture(); };
          nameInput.addEventListener('input', changed);
          urlInput.addEventListener('input', changed);
          colorInput.addEventListener('input', () => { row.style.setProperty('--farbe', colorInput.value); changed(); });
          showInput.addEventListener('change', changed);
          [nameInput, urlInput].forEach((input) => input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); savable.save(); }
          }));
          row.querySelector('.zeigen').addEventListener('change', async (e) => {
            if (e.target.checked) shown.add(id); else shown.delete(id);
            row.classList.toggle('aus', !e.target.checked);
            e.target.closest('.chip').classList.toggle('an', e.target.checked);
            await save();
          });
          const file = row.querySelector('input[type="file"]');
          row.querySelector('.hochladen').addEventListener('click', () => file.click());
          file.addEventListener('change', async () => {
            if (!file.files.length) return;
            const url = await this._upload(file.files[0]);
            if (!url) return;
            urlInput.value = url;
            changed();
          });
          const move = async (delta) => {
            if ([...this._pending.keys()].some((k) => k.startsWith(`person:${scope}:`))) {
              this._toast(t('save_first'), true);
              return;
            }
            const j = index + delta;
            [order[index], order[j]] = [order[j], order[index]];
            draw();
            await save();
          };
          row.querySelector('.hoch').addEventListener('click', () => move(-1));
          row.querySelector('.runter').addEventListener('click', () => move(1));
          this._infoToggle(row);
          box.appendChild(row);
        });
        warn();
        const fake = document.createElement('div');
        this._fieldLockButton(fake, category, ['persons', 'person_settings']);
        const lock = fake.querySelector('.feldschloss');
        if (lock) {
          const line = document.createElement('div');
          line.className = 'zeile breit';
          line.innerHTML = `<div class="beschriftung"><span class="klein">${esc(t('fix_persons_for', { name: this._user.name }))}</span></div>`;
          line.querySelector('.beschriftung').appendChild(lock);
          box.prepend(line);
        }
      };
      draw();
    }

    async _upload(fileObject) {
      const form = new FormData();
      form.append('file', fileObject);
      try {
        const response = await this._hass.fetchWithAuth('/api/image/upload', { method: 'POST', body: form });
        if (!response.ok) throw new Error(`${response.status}`);
        const item = await response.json();
        return `/api/image/serve/${item.id}/512x512`;
      } catch (err) {
        this._toast(this._t('upload_failed'), true);
        return null;
      }
    }

    // --- map style, CARTO styles and the CARTO key --------------------------------------------------
    _tiles(category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'tiles');
      const values = this._values(category);
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_tiles'))}</span>${this._originHtml(category, 'tiles')}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t('si_tiles'))}</div>
        <div class="stile" role="radiogroup" aria-label="${esc(t('st_tiles'))}">
          ${['esri', 'osm', 'carto'].map((v) => `<label class="stil${values.tiles === v ? ' gewaehlt' : ''}">
              <input type="radio" name="kartenstil-${this._scope}" value="${v}"${values.tiles === v ? ' checked' : ''}${locked ? ' disabled' : ''}>
              <span class="name">${esc(t(`ed_tiles_${v}`))}</span>
              <span class="klein">${esc(t(`tiles_note_${v}`))}</span>
              <a href="${TILE_LINKS[v]}" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('tiles_examples'))}</a>
            </label>${v === 'carto' ? '<div class="schluessel"></div>' : ''}`).join('')}
        </div>`;
      this._infoToggle(row);
      row.querySelectorAll('.stil a').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
      row.querySelectorAll('.stil input').forEach((input) => input.addEventListener('change', async () => {
        if (!input.checked) return;
        const ok = await this._savePersonal(category, 'tiles', input.value);
        if (!ok) { this._fillPersonal(PERSONAL.find((c) => c.id === category)); return; }
        row.querySelectorAll('.stil').forEach((l) => l.classList.toggle('gewaehlt', l.querySelector('input').checked));
        styles.hidden = input.value !== 'carto';
      }));
      const keyBox = row.querySelector('.schluessel');
      this._cartoKey(keyBox);
      // Which CARTO style in which map, light and dark
      const styles = document.createElement('div');
      styles.className = 'carto-stile';
      styles.hidden = values.tiles !== 'carto';
      CARTO_FIELDS.forEach((key) => {
        const field = { key, sel: (tt) => sel(CARTO_STYLES.map((v) => ({ value: v, label: tt(`ed_carto_${v}`) }))) };
        const r = this._row(field, values[key], locked || this._fixedKey(category, key), (value) => this._savePersonal(category, key, value),
          { kind: 'personal', scope: this._scope, user: this._user && this._user.id, category, key, label: t(`st_${key}`) });
        r.dataset.key = key;
        this._fieldLockButton(r, category, [key]);
        styles.appendChild(r);
      });
      keyBox.after(styles);
      return row;
    }

    _cartoKey(box) {
      const t = this._t;
      const d = this._data;
      if (!this._admin) {
        box.innerHTML = `<span class="klein">${esc(d.carto_key_set ? t('carto_key_set') : t('carto_key_missing'))}</span>`;
        return;
      }
      const current = d.admin.options.carto_api_key || '';
      box.innerHTML = `<div class="kopfzeile">${esc(t('st_carto_api_key'))}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t('si_carto_api_key'))}</div>
        <div class="reihe">
          <span class="augen"><input class="ein schluesselfeld" type="password" autocomplete="off" spellcheck="false" placeholder="cb1_…" value="${esc(current)}" aria-label="${esc(t('st_carto_api_key'))}">
            <button class="knopf rund auge" type="button" data-immer="1" title="${esc(t('show_key'))}" aria-label="${esc(t('show_key'))}"><ha-icon icon="mdi:eye"></ha-icon></button></span>
          <button class="knopf gefahr entfernen" type="button"${current ? '' : ' hidden'}><ha-icon icon="mdi:delete-outline"></ha-icon>${esc(t('carto_remove'))}</button>
        </div>
        <div class="reihe"><span class="klein status">${esc(current ? t('carto_key_set') : '')}</span>
          <a class="verweis" style="margin-left:auto" href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('carto_get_key'))}</a></div>`;
      this._infoToggle(box);
      const input = box.querySelector('.schluesselfeld');
      const eye = box.querySelector('.auge');
      const status = box.querySelector('.status');
      const remove = box.querySelector('.entfernen');
      // Hidden with dots; the eye (or typing) shows it for 10 seconds.
      const show = (on) => {
        input.type = on ? 'text' : 'password';
        eye.innerHTML = `<ha-icon icon="${on ? 'mdi:eye-off' : 'mdi:eye'}"></ha-icon>`;
        clearTimeout(this._eyeTimer);
        if (on) this._eyeTimer = setTimeout(() => show(false), 10000);
      };
      eye.addEventListener('click', () => show(input.type === 'password'));
      const holder = document.createElement('div');
      box.insertBefore(holder, box.children[3]);
      const store = async (key) => {
        const ok = await this._saveOption({ key: 'carto_api_key' }, key);
        if (!ok) return false;
        d.carto_key_set = Boolean(key);
        input.value = key;
        remove.hidden = !key;
        status.className = 'klein status';
        status.textContent = key ? t('carto_key_checking') : '';
        if (key) this._checkKey(status);
        return true;
      };
      const savable = this._savable(holder, {
        id: 'option::::carto_api_key',
        label: t('st_carto_api_key'),
        initial: current,
        draft: { kind: 'option', key: 'carto_api_key', label: t('st_carto_api_key') },
        save: async (value) => {
          const key = extractCartoKey(value);
          if (key === null) { status.className = 'klein status schlecht'; status.textContent = t('carto_key_invalid'); return false; }
          return store(key);
        },
      });
      savable.reset = (v) => { input.value = v; };
      savable.focus = () => input.focus();
      input.addEventListener('input', () => { show(true); savable.set(input.value.trim()); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savable.save(); } });
      remove.addEventListener('click', async () => {
        if (!await this._confirm(t('carto_remove_title'), t('confirm_carto_remove'), t('carto_remove'), true)) return;
        savable.set('');
        await savable.save();
      });
    }

    // One small request to CARTO after saving; the integration reloads meanwhile.
    async _checkKey(status) {
      const t = this._t;
      let result = null;
      for (const wait of [1500, 2500, 4000]) {
        await new Promise((r) => setTimeout(r, wait));
        try { result = await this._hass.callWS({ type: 'whereabouts/settings/check_key' }); break; } catch (err) { result = null; }
      }
      if (!status.isConnected) return;
      if (result && result.ok) { status.className = 'klein status ok'; status.textContent = t('carto_key_ok'); return; }
      status.className = 'klein status schlecht';
      status.textContent = result && /^http_4/.test(result.reason || '') ? t('carto_key_rejected') : t('carto_key_unchecked');
    }

    // --- zones: hide single zones, own colours ------------------------------------------------------
    _zoneList() {
      return (this._data.zones || []).filter((z) => !z.passive);
    }

    _zones(category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'hidden_zones');
      const values = this._values(category);
      const row = document.createElement('div');
      row.className = 'zeile breit';
      const zones = this._zoneList();
      const hidden = new Set(values.hidden_zones || []);
      const colors = { ...(values.zone_colors || {}) };
      const base = (id) => (id === 'zone.home' ? values.zone_color_home : values.zone_color);
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_zone_list'))}</span>${this._originHtml(category, 'hidden_zones')}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t('si_zone_list'))}</div>
        <div class="zonen${values.zones_in === 'none' ? ' aus' : ''}">
          ${zones.length ? zones.map((z) => `<div class="zonenzeile" data-zone="${esc(z.entity_id)}">
            <label class="zname"><input type="checkbox" class="zeigen"${hidden.has(z.entity_id) ? '' : ' checked'}${locked ? ' disabled' : ''}>
              <span class="tupfer" style="background:${S.safeColor(colors[z.entity_id] || base(z.entity_id), '#888')}"></span>${esc(z.name)}</label>
            <label class="farbwahl"><input type="checkbox" class="eigen"${colors[z.entity_id] ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(t('zone_own_color'))}</label>
            <input type="color" class="farbe" value="${esc((colors[z.entity_id] || base(z.entity_id) || '#888888').toLowerCase())}"${colors[z.entity_id] ? '' : ' hidden'}${locked ? ' disabled' : ''} aria-label="${esc(t('zone_own_color'))}: ${esc(z.name)}">
          </div>`).join('') : `<span class="klein">${esc(t('no_zones'))}</span>`}
        </div>`;
      this._infoToggle(row);
      const saveHidden = () => this._savePersonal(category, 'hidden_zones', [...hidden]);
      const saveColors = () => this._savePersonal(category, 'zone_colors', { ...colors });
      row.querySelectorAll('.zonenzeile').forEach((line) => {
        const id = line.dataset.zone;
        const dot = line.querySelector('.tupfer');
        const picker = line.querySelector('.farbe');
        line.querySelector('.zeigen').addEventListener('change', async (e) => {
          if (e.target.checked) hidden.delete(id); else hidden.add(id);
          if (!await saveHidden()) e.target.checked = !e.target.checked;
        });
        line.querySelector('.eigen').addEventListener('change', async (e) => {
          if (e.target.checked) colors[id] = picker.value.toUpperCase(); else delete colors[id];
          picker.hidden = !e.target.checked;
          dot.style.background = colors[id] || base(id);
          await saveColors();
        });
        picker.addEventListener('change', async () => {
          colors[id] = picker.value.toUpperCase();
          dot.style.background = colors[id];
          await saveColors();
        });
      });
      return row;
    }

    // --- persons in Whereabouts (administrators) -----------------------------------------------------
    _base(box) {
      const t = this._t;
      const d = this._data;
      const all = d.admin.all_persons;
      const configured = d.admin.options.persons || [];
      const chosen = configured.length ? configured : all.map((p) => p.entity_id);
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_persons'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t('si_persons'))}</div>`;
      this._infoToggle(row);
      row.appendChild(this._checkList(all, chosen, false, async (list) => {
        if (!list.length) { this._toast(t('base_needs_one'), true); return false; }
        const value = list.length === all.length ? [] : list;
        const ok = await this._saveOption({ key: 'persons' }, value);
        if (ok) this._reloadSoon();
        return ok;
      }));
      box.appendChild(row);
    }

    // Recording: ticks, only persons in Whereabouts.
    _personsOption(field) {
      const t = this._t;
      const d = this._data;
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t(`st_${field.key}`))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t(`si_${field.key}`))}</div>`;
      this._infoToggle(row);
      const chosen = (d.admin.options[field.key] || []).filter((id) => d.persons.some((p) => p.entity_id === id));
      row.appendChild(this._checkList(d.persons, chosen, false, (list) => this._saveOption(field, list)));
      return row;
    }

    // --- users and their settings (administrators, in "Users and rights") -----------------------------
    _usersTable(box) {
      const t = this._t;
      const admin = this._data.admin;
      const technical = admin.users.filter((u) => u.active && u.technical && !u.is_admin).length;
      const wrap = document.createElement('div');
      wrap.className = 'benutzer';
      const statusOf = (u) => {
        const parts = [];
        if (this._flag(u.id, 'sync') && admin.sync && admin.sync.user_id) {
          parts.push(`<span class="status sync">${esc(admin.sync.user_id === this._data.user.id ? t('state_synced_me') : t('state_synced', { name: this._userName(admin.sync.user_id) }))}</span>`);
        } else {
          const own = Object.keys((admin.own_keys || {})[u.id] || {});
          parts.push(own.length ? `<span class="status eigen">${esc(t('state_own', { cats: own.map((c) => t(`cat_${c}`)).join(', ') }))}</span>`
            : `<span class="status standard">${esc(t('state_default'))}</span>`);
        }
        const locks = (admin.field_locks || {})[u.id] || {};
        const fixed = Object.values(locks).reduce((n, keys) => n + (keys.includes('*') ? 1 : keys.length), 0);
        if (fixed) parts.push(`<span class="status fest">${esc(t('state_fixed', { n: fixed }))}</span>`);
        return parts.join('');
      };
      const users = this._editableUsers().filter((u) => {
        if (this._userFilter === 'own') return Object.keys((admin.own_keys || {})[u.id] || {}).length > 0;
        if (this._userFilter === 'synced') return this._flag(u.id, 'sync');
        return true;
      });
      wrap.innerHTML = `<div class="kopf"><b>${esc(t('users_settings'))}</b>
          <select class="ein filter" aria-label="${esc(t('users_filter'))}">
            ${['all', 'own', 'synced'].map((v) => `<option value="${v}"${this._userFilter === v ? ' selected' : ''}>${esc(t(`users_filter_${v}`))}</option>`).join('')}
          </select>
          ${technical ? `<label class="klein"><input type="checkbox" class="technisch"${this._showTechnical ? ' checked' : ''}> ${esc(t('show_technical', { n: technical }))}</label>` : ''}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button>
        </div>
        <div class="infotext" hidden style="margin:8px 12px">${esc(t('si_users_settings'))}</div>
        <div class="tabellenrahmen" style="padding:0"><table>
          <thead><tr><th>${esc(t('user'))}</th><th>${esc(t('users_state'))}</th><th>${esc(t('users_tab'))}</th><th>${esc(t('users_sync'))}</th><th></th></tr></thead>
          <tbody>
            <tr class="alle"><td>${esc(t('users_all'))}</td><td class="klein">${esc(t('users_all_hint'))}</td>
              <td><input type="checkbox" class="schalter-klein" data-flag="hide_settings" data-user="all"${admin.all_flags.hide_settings ? '' : ' checked'} aria-label="${esc(t('users_tab'))}"></td>
              <td><input type="checkbox" class="schalter-klein" data-flag="sync" data-user="all"${admin.all_flags.sync ? ' checked' : ''} aria-label="${esc(t('users_sync'))}"></td><td></td></tr>
            ${users.map((u) => `<tr><td>${esc(u.name)}${u.technical ? `<div class="klein">${esc(t('technical_user'))}</div>` : ''}</td>
              <td>${statusOf(u)}</td>
              <td><input type="checkbox" class="schalter-klein" data-flag="hide_settings" data-user="${esc(u.id)}"${this._flag(u.id, 'hide_settings') || this._flag(u.id, 'sync') ? '' : ' checked'}${this._flag(u.id, 'sync') ? ' disabled' : ''} aria-label="${esc(t('users_tab'))}: ${esc(u.name)}"></td>
              <td><input type="checkbox" class="schalter-klein" data-flag="sync" data-user="${esc(u.id)}"${this._flag(u.id, 'sync') ? ' checked' : ''} aria-label="${esc(t('users_sync'))}: ${esc(u.name)}"></td>
              <td><button class="knopf bearbeiten" type="button" data-user="${esc(u.id)}"${this._flag(u.id, 'sync') ? ' disabled' : ''}><ha-icon icon="mdi:pencil"></ha-icon>${esc(t('edit'))}</button></td></tr>`).join('')}
            ${users.length ? '' : `<tr><td colspan="5" class="klein">${esc(t('no_users'))}</td></tr>`}
          </tbody></table></div>`;
      wrap.querySelector('.info').addEventListener('click', (e) => {
        const text = wrap.querySelector('.infotext');
        text.hidden = !text.hidden;
        e.currentTarget.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      });
      wrap.querySelector('.filter').addEventListener('change', (e) => { this._userFilter = e.target.value; this._redrawRights(); });
      const tech = wrap.querySelector('.technisch');
      if (tech) tech.addEventListener('change', () => { this._showTechnical = tech.checked; this._render(); });
      wrap.querySelectorAll('[data-flag]').forEach((box2) => box2.addEventListener('change', () => this._setFlag(box2)));
      wrap.querySelectorAll('.bearbeiten').forEach((b) => b.addEventListener('click', async () => {
        if (!await this.confirmLeave()) return;
        await this._loadUser(b.dataset.user);
        const scroller = this._scroller();
        if (scroller) scroller.scrollTop = 0;
      }));
      box.appendChild(wrap);
    }

    async _setFlag(input) {
      const t = this._t;
      const flag = input.dataset.flag;
      const userId = input.dataset.user;
      const name = userId === 'all' ? t('users_all') : this._userName(userId);
      // The tab switch shows "visible"; stored is "hidden".
      const value = flag === 'hide_settings' ? !input.checked : input.checked;
      if (flag === 'sync') {
        const text = userId === 'all' ? t(value ? 'confirm_sync_all_on' : 'confirm_sync_all_off') : t(value ? 'confirm_sync_user_on' : 'confirm_sync_user_off', { name });
        if (!await this._confirm(t('users_sync'), text, t(value ? 'sync_on' : 'sync_off'), !value && userId === 'all')) {
          input.checked = !input.checked;
          return;
        }
      }
      const ok = await this._ws({ type: 'whereabouts/settings/flags', user_id: userId, [flag]: value }, true);
      if (ok === null) { input.checked = !input.checked; return; }
      if (flag === 'sync') {
        this._setSuccess(userId === 'all'
          ? t(value ? 'success_sync_all_on' : 'success_sync_all_off')
          : t(value ? 'success_sync_user_on' : 'success_sync_user_off', { name }), 'rights');
      }
      await this._load();
    }

    _redrawRights() {
      const box = this.querySelector('.felder[data-kat="rights"]');
      if (!box) return;
      box.innerHTML = '';
      this._rights(box);
    }

    // --- rights ---------------------------------------------------------------------------------------
    _rights(box) {
      const t = this._t;
      const d = this._data;
      const nameOf = (id) => this._personName(id);
      const list = (ids) => (ids.length ? ids.map(nameOf).join(', ') : t('nobody'));
      if (!this._admin) {
        box.innerHTML = `<div class="tabellenrahmen"><table class="tabelle">
          ${['live', 'history', 'delete'].map((k) => `<tr><th>${esc(t(`right_${k}`))}</th><td>${esc(list(d.rights[k] || []))}</td></tr>`).join('')}
          </table></div><p class="kat-text klein">${esc(t('rights_by_admin'))}</p>`;
        return;
      }
      if (this._hasOtherUsers()) this._usersTable(box);
      const admin = d.admin;
      const levels = ['all', 'own', 'none'];
      ['live', 'history', 'delete'].forEach((kind) => {
        box.appendChild(this._row({ key: `rights_default_${kind}`, sel: sel(levels.map((v) => ({ value: v, label: t(`level_${v}`) }))) },
          admin.rights_default[kind], false, async (value) => {
            const before = admin.rights_default[kind];
            if (levels.indexOf(value) > levels.indexOf(before)
              && !await this._confirm(t('rights_title'), t('confirm_rights_less'), t('save'), true)) { this._redrawRights(); return false; }
            if (await this._ws({ type: 'whereabouts/settings/rights_default', levels: { [kind]: value } }) === null) return false;
            admin.rights_default[kind] = value;
            this._redrawRights();
            this._updateSummary('rights');
            return true;
          }));
      });
      const users = admin.users.filter((u) => u.active && (this._showTechnical || !u.technical || u.is_admin));
      const table = document.createElement('div');
      table.className = 'tabellenrahmen';
      table.innerHTML = `<table class="tabelle"><thead><tr><th>${esc(t('user'))}</th><th>${esc(t('rights_own'))}</th>
        ${['live', 'history', 'delete'].map((k) => `<th>${esc(t(`right_${k}`))}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
      const body = table.querySelector('tbody');
      users.forEach((u) => {
        const tr = document.createElement('tr');
        if (u.is_admin) {
          tr.innerHTML = `<td>${esc(u.name)}</td><td colspan="4" class="klein">${esc(t('admin_all'))}</td>`;
          body.appendChild(tr);
          return;
        }
        const own = admin.rights[u.id];
        tr.innerHTML = `<td>${esc(u.name)}${u.technical ? `<div class="klein">${esc(t('technical_user'))}</div>` : ''}</td>
          <td><input type="checkbox" class="eigen"${own ? ' checked' : ''} aria-label="${esc(t('rights_own'))}"></td>`;
        ['live', 'history', 'delete'].forEach((kind) => {
          const td = document.createElement('td');
          const chips = document.createElement('div');
          chips.className = 'chips';
          const current = own ? new Set(own[kind] || []) : null;
          d.persons.forEach((p) => {
            const on = current ? current.has(p.entity_id) : this._ruleAllows(kind, u, p);
            const chip = document.createElement('label');
            chip.className = `chip${on ? (own ? ' an' : ' regel') : ''}${own ? '' : ' fest'}`;
            chip.innerHTML = `<input type="checkbox"${on ? ' checked' : ''}${own ? '' : ' disabled'}>${esc(p.name)}`;
            chip.querySelector('input').addEventListener('change', async (e) => {
              if (!e.target.checked && !await this._confirm(t('rights_title'),
                t('confirm_rights_remove', { user: u.name, person: p.name, right: t(`right_${kind}`) }), t('remove'), true)) {
                e.target.checked = true;
                return;
              }
              const next = { ...admin.rights[u.id] };
              const set = new Set(next[kind] || []);
              if (e.target.checked) set.add(p.entity_id); else set.delete(p.entity_id);
              next[kind] = [...set];
              if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: next }) !== null) {
                admin.rights[u.id] = next;
                chip.classList.toggle('an', e.target.checked);
              } else e.target.checked = !e.target.checked;
            });
            chips.appendChild(chip);
          });
          td.appendChild(chips);
          if (!own) td.insertAdjacentHTML('beforeend', `<div class="regelhinweis">${esc(t('by_rule'))}</div>`);
          tr.appendChild(td);
        });
        tr.querySelector('.eigen').addEventListener('change', async (e) => {
          if (e.target.checked) {
            const start = {};
            ['live', 'history', 'delete'].forEach((kind) => {
              start[kind] = d.persons.filter((p) => this._ruleAllows(kind, u, p)).map((p) => p.entity_id);
            });
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: start }) !== null) admin.rights[u.id] = start;
          } else {
            if (!await this._confirm(t('rights_title'), t('confirm_rights_rules', { user: u.name }), t('save'), true)) {
              e.target.checked = true;
              return;
            }
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: null }) !== null) delete admin.rights[u.id];
          }
          this._redrawRights();
        });
        body.appendChild(tr);
      });
      box.appendChild(table);
    }

    _ruleAllows(kind, user, person) {
      const level = this._data.admin.rights_default[kind];
      if (level === 'all') return true;
      if (level === 'own') return person.user_id === user.id;
      return false;
    }

    // --- fixing a category for users (administrators) ---------------------------------------------------
    async _lockDialog(category) {
      const t = this._t;
      const lock = { mode: 'none', except: [], users: [], ...(this._data.admin.locks[category] || {}) };
      const users = this._data.admin.users.filter((u) => !u.is_admin && u.active && (!u.technical || this._showTechnical));
      const userList = (cls, chosen) => `<div class="liste ${cls}">${users.length ? users.map((u) => `<label><input type="checkbox" value="${esc(u.id)}"${chosen.includes(u.id) ? ' checked' : ''}>${esc(u.name)}</label>`).join('') : `<span class="klein">${esc(t('no_users'))}</span>`}</div>`;
      const html = `<h3>${esc(t('lock_title', { name: t(`cat_${category}`) }))}</h3>
        <div class="text">${esc(t('lock_text'))}</div>
        <label><input type="radio" name="modus" value="none"${lock.mode === 'none' ? ' checked' : ''}>${esc(t('lock_none'))}</label>
        <label><input type="radio" name="modus" value="all"${lock.mode === 'all' ? ' checked' : ''}>${esc(t('lock_all'))}</label>
        <div class="klein" style="margin-left:28px">${esc(t('lock_except'))}</div>${userList('ausser', lock.except)}
        <label><input type="radio" name="modus" value="selected"${lock.mode === 'selected' ? ' checked' : ''}>${esc(t('lock_selected'))}</label>
        ${userList('nur', lock.users)}`;
      const result = await this._dialog(html, t('save'), false, (win) => ({
        mode: win.querySelector('input[name="modus"]:checked').value,
        except: [...win.querySelectorAll('.ausser input:checked')].map((i) => i.value),
        users: [...win.querySelectorAll('.nur input:checked')].map((i) => i.value),
      }));
      if (!result) return;
      if (await this._ws({ type: 'whereabouts/settings/lock', category, mode: result.mode, except: result.except, users: result.users }) !== null) {
        this._data.admin.locks[category] = result;
        this._rerenderCategory(category);
        const toc = this.querySelector(`.toc a[data-ziel="${category}"]`);
        if (toc) toc.title = this._lockTitle(category);
      }
    }

    // --- address sensors (administrators) --------------------------------------------------------------------
    _sensors(box) {
      const t = this._t;
      const options = this._data.admin.options;
      const address = this._data.admin.address || { auto: {}, sensors: [] };
      const sensors = { ...(options.address_sensors || {}) };
      this._data.persons.forEach((p) => {
        const known = address.sensors.map((s) => ({ value: s.entity_id, label: `${s.name} (${s.entity_id})` }));
        const current = sensors[p.entity_id] || '';
        if (current && !known.some((o) => o.value === current)) known.push({ value: current, label: current });
        const choices = [{ value: '', label: t('address_auto') }, ...known];
        const row = this._row({ key: 'address_sensor', sel: sel(choices), label: t('st_address_sensor_for', { name: p.name }) },
          current, false, async (value) => {
            sensors[p.entity_id] = value || null;
            const ok = await this._saveOption({ key: 'address_sensors' }, sensors);
            note.hidden = Boolean(value);
            return ok;
          });
        const auto = address.auto[p.entity_id] || {};
        const note = document.createElement('div');
        note.className = 'klein';
        note.style.gridColumn = '1 / -1';
        note.textContent = auto.sensor
          ? `${t('address_auto_found', { id: auto.sensor })}${auto.ok ? ' ✓' : ` – ${t('address_auto_off')}`}`
          : t('address_auto_missing');
        if (!auto.sensor || !auto.ok) note.classList.add('schlecht');
        note.hidden = Boolean(current);
        row.appendChild(note);
        box.appendChild(row);
      });
    }

    // --- import and export ---------------------------------------------------------------------------------
    _dataSection(box) {
      const t = this._t;
      const d = this._data;
      const viewable = d.persons.filter((p) => (d.rights.history || []).includes(p.entity_id));
      const head = (icon, title) => {
        const el = document.createElement('div');
        el.className = 'abschnitt-kopf';
        el.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${esc(title)}`;
        return el;
      };
      box.appendChild(head('mdi:download', t('export_title')));
      const exportRow = document.createElement('div');
      exportRow.className = 'zeile';
      exportRow.style.borderTop = 'none';
      exportRow.innerHTML = `<div class="beschriftung"><span>${esc(t('export_data'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer"><button class="knopf voll laden" style="width:auto"${viewable.length ? '' : ' disabled'}><ha-icon icon="mdi:download"></ha-icon>${esc(t('export_data'))}</button></div>
        <div class="infotext" hidden>${esc(t('si_export'))}</div>`;
      this._infoToggle(exportRow);
      exportRow.querySelector('.laden').addEventListener('click', async () => {
        const persons = viewable.map((p) => {
          const own = ((this._data.effective.persons || {}).person_settings || {})[p.entity_id] || {};
          return { id: p.entity_id, name: own.name || p.name, color: own.color || S.personColor(this._hass, {}, p.entity_id) };
        });
        const days = new Set();
        await Promise.all(persons.map(async (p) => {
          try { ((await this._hass.callWS({ type: 'whereabouts/days', person: p.id })).days || []).forEach((x) => days.add(x)); } catch (err) { /* all days */ }
        }));
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        days.add(today);
        D.openDownloadDialog(S, { hass: this._hass, t, persons, selected: persons.map((p) => p.id), days, first: [...days].sort()[0] });
      });
      box.appendChild(exportRow);
      if (!this._admin) return;

      box.appendChild(head('mdi:upload', t('import_title')));
      const importHead = document.createElement('div');
      importHead.className = 'zeile breit';
      importHead.style.borderTop = 'none';
      importHead.innerHTML = `<div class="beschriftung"><span class="klein">${esc(t('import_intro'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t('si_import'))}</div>`;
      this._infoToggle(importHead);
      box.appendChild(importHead);
      box.appendChild(this._row({ key: 'import_person', label: t('import_person'), info: t('si_import_person'),
        sel: sel([{ value: '', label: t('import_person_file') }, ...d.persons.map((p) => ({ value: p.entity_id, label: p.name }))]) },
      this._import.person, false, (value) => { this._import.person = value || ''; return true; }));
      box.appendChild(this._row({ key: 'import_mode', label: t('import_mode'), info: t('si_import_mode'),
        sel: sel(['merge', 'skip', 'replace'].map((v) => ({ value: v, label: t(`import_mode_${v}`) }))) },
      this._import.mode, false, (value) => { this._import.mode = value || 'merge'; return true; }));
      const area = document.createElement('div');
      area.innerHTML = `<div class="ablage" tabindex="0" role="button">${esc(t('drop_file'))}</div>
        <input type="file" accept=".csv,.zip,.gpx" hidden>
        <div class="ergebnis"></div>
        ${this._formatHelpHtml()}`;
      const drop = area.querySelector('.ablage');
      const input = area.querySelector('input[type="file"]');
      const take = (f) => { if (f) this._importFile(f, area); };
      drop.addEventListener('click', () => input.click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      input.addEventListener('change', () => { take(input.files[0]); input.value = ''; });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drueber'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drueber'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drueber'); take(e.dataTransfer.files[0]); });
      area.querySelector('.kopieren').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const text = area.querySelector('pre.prompt').textContent;
        try {
          await navigator.clipboard.writeText(text);
          button.innerHTML = `<ha-icon icon="mdi:check"></ha-icon>${esc(t('copied'))}`;
        } catch (err) {
          const range = document.createRange();
          range.selectNodeContents(area.querySelector('pre.prompt'));
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          this._toast(t('copy_manually'));
        }
      });
      area.querySelectorAll('.info').forEach((info) => info.addEventListener('click', () => {
        const text = info.parentElement.nextElementSibling;
        text.hidden = !text.hidden;
        info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      }));
      box.appendChild(area);
    }

    // "What must the file look like?" and a prompt for an AI assistant.
    _formatHelpHtml() {
      const t = this._t;
      const anchor = S.language(this._hass) === 'de' ? '#deutsch' : '#english';
      const example = [
        'person,date,start,end,state,latitude,longitude,address',
        'alex,2026-06-24,00:00:00,08:12:40,home,52.528526,13.406622,',
        'alex,2026-06-24,08:20:11,08:35:02,not_home,52.531000,13.421000,"Main Street 1, Springfield"',
        'alex,2026-06-24,08:41:02,16:58:30,Work,52.509000,13.388000,',
      ].join('\n');
      return `<details class="hilfe"><summary>${esc(t('format_help'))}</summary>
          <p>${esc(t('format_help_csv'))}</p>
          <pre>${esc(example)}</pre>
          <ul>
            <li>${esc(t('format_col_person'))}</li><li>${esc(t('format_col_date'))}</li><li>${esc(t('format_col_time'))}</li>
            <li>${esc(t('format_col_state'))}</li><li>${esc(t('format_col_coords'))}</li><li>${esc(t('format_col_address'))}</li>
          </ul>
          <p>${esc(t('format_help_gpx'))}</p>
          <p>${esc(t('format_help_zip'))}</p>
          <p><a class="verweis" style="justify-self:start" href="${FORMAT_URL}${anchor}" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('format_more'))}</a></p>
        </details>
        <details class="hilfe"><summary>${esc(t('ai_help'))}</summary>
          <div class="reihe"><span style="flex:1 1 200px">${esc(t('ai_help_text'))}</span>
            <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
          <div class="infotext" hidden>${esc(t('ai_privacy'))}</div>
          <pre class="prompt">${esc(t('ai_prompt'))}</pre>
          <div class="reihe"><button class="knopf kopieren" type="button"><ha-icon icon="mdi:content-copy"></ha-icon>${esc(t('copy'))}</button></div>
        </details>`;
    }

    async _importCall(fileObject, preview, days) {
      const form = new FormData();
      form.append('file', fileObject);
      form.append('person', this._import.person || '');
      form.append('replace', this._import.mode === 'replace' ? 'true' : 'false');
      form.append('mode', this._import.mode || 'merge');
      form.append('preview', preview ? 'true' : 'false');
      if (days) form.append('days', days.join(','));
      const response = await this._hass.fetchWithAuth('/api/whereabouts/import', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw body;
      return body;
    }

    async _importFile(fileObject, root) {
      const t = this._t;
      const out = root.querySelector('.ergebnis');
      const nameOf = (key) => this._personName(`person.${key}`);
      out.textContent = t('import_checking');
      let preview;
      try {
        preview = await this._importCall(fileObject, true);
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${esc(maybe(t, `import_error_${err.error}`, t('import_failed')))}${err.detail ? ` (${esc(err.detail)})` : ''}</span>`;
        return;
      }
      out.textContent = '';
      const days = await this._importPreview(fileObject, preview, nameOf);
      if (!days) { out.textContent = t('import_cancelled'); return; }
      out.textContent = t('loading');
      try {
        const result = await this._importCall(fileObject, false, days);
        out.innerHTML = `<span class="ok">${esc(t('import_result', {
          added: result.added, skipped: result.skipped, days: result.days, persons: result.persons.map(nameOf).join(', '),
        }))}</span>`;
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${esc(t('import_failed'))}</span>`;
      }
    }

    // Window with the plan per day; resolves with the ticked days ("person|date") or null.
    _importPreview(fileObject, preview, nameOf) {
      const t = this._t;
      const plan = preview.plan || [];
      const replace = preview.mode === 'replace';
      const chosen = new Set(plan.filter((d) => d.new > 0).map((d) => `${d.person}|${d.date}`));
      const placeOf = (e) => (e.state === 'not_home' && e.address ? e.address : S.placeText(t, e.state));
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog';
        const render = () => {
          const total = plan.filter((d) => chosen.has(`${d.person}|${d.date}`)).reduce((n, d) => n + d.new, 0);
          const nothing = plan.filter((d) => d.new === 0).length;
          overlay.innerHTML = `<div class="fenster breit" role="dialog" aria-modal="true">
            <h3>${esc(t('import_preview_title'))}</h3>
            <div class="text">${esc(t('import_preview', { file: fileObject.name, n: preview.total, days: preview.days, persons: preview.persons.map(nameOf).join(', '), from: preview.first, to: preview.last }))}</div>
            ${replace ? `<div class="warnung" style="margin:8px 0">${esc(t('confirm_import_replace'))}</div>` : ''}
            <div class="vorschau-tabelle"><table>
              <thead><tr><th><input type="checkbox" class="alle"${plan.some((d) => d.new > 0) && plan.every((d) => d.new === 0 || chosen.has(`${d.person}|${d.date}`)) ? ' checked' : ''}${plan.some((d) => d.new > 0) ? '' : ' disabled'} aria-label="${esc(t('select_all'))}"></th>
                <th>${esc(t('col_date'))}</th><th>${esc(t('col_person'))}</th><th>${esc(t('import_existing'))}</th><th>${esc(t('import_new'))}</th><th>${esc(t('import_status'))}</th><th></th></tr></thead>
              <tbody>${plan.map((d, i) => `<tr>
                <td><input type="checkbox" data-i="${i}"${chosen.has(`${d.person}|${d.date}`) ? ' checked' : ''}${d.new === 0 ? ' disabled' : ''}></td>
                <td>${esc(d.date)}</td><td>${esc(nameOf(d.person))}</td><td>${d.existing}</td><td>${d.new}</td>
                <td>${esc(t(`import_status_${d.status}`))}</td>
                <td>${d.new ? `<button class="auf" type="button" data-i="${i}">${esc(t('import_show'))}</button>` : ''}</td></tr>
                <tr class="details" data-for="${i}" hidden><td></td><td colspan="6">${d.entries.map((e) => `${esc(e.start.slice(0, 5))}–${esc(e.end.slice(0, 5))} ${esc(placeOf(e))}`).join('<br>')}${d.new > d.entries.length ? '<br>…' : ''}</td></tr>`).join('')}
              </tbody></table></div>
            <div class="text">${esc(t('import_summary', { n: total, days: chosen.size, none: nothing }))}</div>
            <div class="knoepfe"><button class="knopf" data-wahl="cancel">${esc(t('cancel'))}</button>
              <button class="knopf voll" data-wahl="ok"${chosen.size ? '' : ' disabled'}${replace ? ' style="background:var(--error-color,#db4437);border-color:var(--error-color,#db4437)"' : ''}>${esc(t('import_now'))}</button></div>
          </div>`;
          overlay.querySelectorAll('tbody input[data-i]').forEach((box) => box.addEventListener('change', () => {
            const d = plan[Number(box.dataset.i)];
            const key = `${d.person}|${d.date}`;
            if (box.checked) chosen.add(key); else chosen.delete(key);
            render();
          }));
          overlay.querySelector('.alle').addEventListener('change', (e) => {
            plan.forEach((d) => { if (d.new) { if (e.target.checked) chosen.add(`${d.person}|${d.date}`); else chosen.delete(`${d.person}|${d.date}`); } });
            render();
          });
          overlay.querySelectorAll('button.auf').forEach((b) => b.addEventListener('click', () => {
            const row = overlay.querySelector(`tr.details[data-for="${b.dataset.i}"]`);
            row.hidden = !row.hidden;
            b.textContent = t(row.hidden ? 'import_show' : 'import_hide');
          }));
          overlay.querySelector('[data-wahl="cancel"]').addEventListener('click', () => close(null));
          overlay.querySelector('[data-wahl="ok"]').addEventListener('click', () => close([...chosen]));
        };
        const close = (value) => { document.removeEventListener('keydown', key); overlay.remove(); resolve(value); };
        const key = (e) => { if (e.key === 'Escape') close(null); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        document.addEventListener('keydown', key);
        (this.querySelector('.wa-set') || this).appendChild(overlay);
        render();
      });
    }

    // --- diagnostics (administrators) ---------------------------------------------------------------------------
    async _loadDiagnostics() {
      const box = this.querySelector('.felder[data-kat="diagnostics"]');
      if (!box || !this._admin) return;
      const t = this._t;
      box.innerHTML = `<p class="kat-text">${esc(t('loading'))}</p>`;
      let diag;
      try { diag = await this._hass.callWS({ type: 'whereabouts/settings/diagnostics' }); } catch (err) {
        box.innerHTML = `<p class="kat-text schlecht">${esc(t('load_failed'))}</p>`;
        return;
      }
      const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
      box.innerHTML = `${diag.osm_paused ? `<div class="warnung">${esc(t('osm_paused'))}</div>` : ''}
        <div class="tabellenrahmen"><table class="tabelle"><thead><tr>
          <th>${esc(t('col_person'))}</th><th>${esc(t('diag_trackers'))}</th><th>${esc(t('diag_address'))}</th><th>${esc(t('diag_history'))}</th>
        </tr></thead><tbody>
        ${diag.persons.map((p) => `<tr>
          <td><b>${esc(p.name)}</b><div class="klein">${esc(S.placeText(t, p.state))}${p.source ? ` · ${esc(t('diag_source', { id: p.source }))}` : ''}</div></td>
          <td>${p.trackers.length ? p.trackers.map((tr) => `<div>${esc(tr.name)} <span class="klein">(${esc(maybe(t, `source_${tr.source_type}`, tr.source_type || '?'))}, ${esc(S.placeText(t, tr.state))}${tr.last_updated ? `, ${esc(S.agoText(t, tr.last_updated))}` : ''})</span></div>`).join('') : `<span class="klein">${esc(t('diag_no_trackers'))}</span>`}</td>
          <td>${p.address_sensor_ok ? `<span class="ok">✓</span> <span class="klein">${esc(p.address_sensor)}</span>`
            : `<span class="schlecht">✗</span> <span class="klein">${esc(p.address_sensor ? t('diag_sensor_off', { id: p.address_sensor }) : t('diag_no_sensor'))}</span>`}</td>
          <td>${p.history ? `${esc(t('diag_days', { n: p.history.days, from: p.history.first, to: p.history.last }))}<div class="klein">${esc(kb(p.history.bytes))}${p.recorded ? '' : ` · ${esc(t('diag_not_recorded'))}`}</div>`
            : `<span class="klein">${esc(p.recorded ? t('diag_no_history_yet') : t('diag_not_recorded'))}</span>`}</td>
        </tr>`).join('')}</tbody></table></div>
        <p class="kat-text klein">${esc(t('diag_folder', { folder: diag.folder }))}</p>`;
    }

    // --- unsaved changes ---------------------------------------------------------------------------------------
    // Asked by the page before switching tabs: true = may leave.
    async confirmLeave() {
      if (!this._pending.size) return true;
      const t = this._t;
      const items = [...this._pending.entries()];
      const choice = await this._choice(t('leave_title'),
        `<div class="text">${esc(t('leave_text'))}</div><ul>${items.map(([id, p]) => `<li><a href="#" class="feldlink" data-id="${esc(id)}">${esc(p.label)}</a></li>`).join('')}</ul>`,
        [{ id: 'cancel', label: t('cancel') }, { id: 'discard', label: t('discard'), danger: true }, { id: 'save', label: t('save_now'), main: true }]);
      if (choice && choice.startsWith('field:')) {
        this._goToField(choice.slice(6));
        return false;
      }
      if (choice === 'save') {
        let ok = true;
        for (const p of [...this._pending.values()]) ok = (await p.save()) && ok;
        return ok;
      }
      if (choice === 'discard') {
        [...this._pending.values()].forEach((p) => p.discard());
        this._pending.clear();
        return true;
      }
      return false;
    }

    _draftKey() {
      return `whereabouts-drafts-${(this._data && this._data.user && this._data.user.id) || 'x'}`;
    }

    _storeDrafts() {
      const drafts = [...this._pending.values()].map((p) => p.draft).filter(Boolean);
      try {
        if (drafts.length) window.localStorage.setItem(this._draftKey(), JSON.stringify(drafts));
      } catch (err) {
        // storage not available: nothing to keep
      }
    }

    _readDrafts() {
      try {
        const drafts = JSON.parse(window.localStorage.getItem(this._draftKey()) || '[]');
        return Array.isArray(drafts) ? drafts : [];
      } catch (err) {
        return [];
      }
    }

    // Throw away unsaved changes in one area (before it is reset).
    _discardIn(category) {
      const card = this.querySelector(`#kat-${category}`);
      if (!card) return;
      [...this._pending.entries()].forEach(([id, p]) => {
        if (!card.querySelector(`[data-pid="${window.CSS.escape(id)}"]`)) return;
        p.discard();
        this._pending.delete(id);
      });
    }

    _forgetDraft(id) {
      const drafts = this._readDrafts();
      const rest = drafts.filter((d) => d.id !== id);
      if (rest.length === drafts.length) return;
      try {
        if (rest.length) window.localStorage.setItem(this._draftKey(), JSON.stringify(rest));
        else window.localStorage.removeItem(this._draftKey());
      } catch (err) { /* nothing */ }
    }

    _clearDrafts() {
      try { window.localStorage.removeItem(this._draftKey()); } catch (err) { /* nothing */ }
    }

    _showDrafts() {
      const box = this.querySelector('.entwuerfe');
      const drafts = this._readDrafts();
      if (!box || !drafts.length) return;
      const t = this._t;
      drafts.forEach((d) => {
        const entry = d.id && this._savables.get(d.id);
        const card = entry && entry.row.closest('.kat');
        if (card) this._setOpen(card.dataset.kat, true);
      });
      box.innerHTML = `<div class="banner"><ha-icon icon="mdi:content-save-alert"></ha-icon>
        <span class="text">${esc(t('drafts_found'))}: ${drafts.map((d, i) => `<a href="#" class="feldlink" data-i="${i}">${esc(d.label)}</a>`).join(', ')}</span>
        <button class="knopf" data-wahl="verwerfen">${esc(t('discard'))}</button>
        <button class="knopf voll" data-wahl="speichern">${esc(t('save'))}</button></div>`;
      box.querySelectorAll('.feldlink').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const draft = drafts[Number(a.dataset.i)];
        if (draft && draft.id && this._savables.has(draft.id)) this._goToField(draft.id, draft.value);
      }));
      box.querySelector('[data-wahl="verwerfen"]').addEventListener('click', () => { this._clearDrafts(); box.innerHTML = ''; });
      box.querySelector('[data-wahl="speichern"]').addEventListener('click', async () => {
        let ok = true;
        for (const draft of drafts) ok = (await this._applyDraft(draft)) && ok;
        if (ok) { this._clearDrafts(); this._setSuccess(t('drafts_saved')); }
        await this._load();
      });
    }

    async _applyDraft(draft) {
      const withUser = (message) => (draft.user ? { ...message, user_id: draft.user } : message);
      const scope = draft.scope === 'defaults' ? 'defaults' : 'own';
      if (draft.kind === 'personal') {
        if ((draft.scope === 'defaults' || draft.user) && !this._admin) return true;
        return this._ws(withUser({ type: 'whereabouts/settings/save', scope, category: draft.category, values: { [draft.key]: draft.value } })) !== null;
      }
      if (draft.kind === 'option') {
        if (!this._admin) return true;
        const value = draft.key === 'carto_api_key' ? extractCartoKey(draft.value) : draft.value;
        if (value === null) return false;
        return this._ws({ type: 'whereabouts/settings/options', values: { [draft.key]: value } }) !== null;
      }
      if (draft.kind === 'person') {
        let values = draft.scope === 'defaults' ? this._data.defaults[draft.category] : this._data.effective[draft.category];
        if (draft.user) {
          try { values = (await this._hass.callWS({ type: 'whereabouts/settings/user', user_id: draft.user })).effective[draft.category]; } catch (err) { return false; }
        }
        const settings = { ...(values.person_settings || {}) };
        const entry = { ...(settings[draft.person] || {}), ...draft.value };
        settings[draft.person] = Object.fromEntries(Object.entries(entry).filter(([k, v]) => v && !(k === 'show_in' && v === 'both')));
        if (!Object.keys(settings[draft.person]).length) delete settings[draft.person];
        return this._ws(withUser({ type: 'whereabouts/settings/save', scope, category: draft.category,
          values: { persons: values.persons || [], person_settings: settings } })) !== null;
      }
      return true;
    }

    // --- dialogs ---------------------------------------------------------------------------------------------------
    _confirm(title, text, ok, danger) {
      return this._dialog(`<h3>${esc(title)}</h3><div class="text">${esc(text)}</div>`, ok, danger, () => true)
        .then((value) => Boolean(value));
    }

    _dialog(html, ok, danger, read) {
      return this._choice(null, html, [
        { id: 'cancel', label: this._t('cancel') },
        { id: 'ok', label: ok, main: true, danger },
      ], read);
    }

    // buttons: [{ id, label, main, danger }]; resolves with the id (or read(window) for "ok"),
    // or "field:<id>" when a field link in the text was clicked.
    _choice(title, html, buttons, read) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog';
        overlay.innerHTML = `<div class="fenster" role="dialog" aria-modal="true">${title ? `<h3>${esc(title)}</h3>` : ''}${html}
          <div class="knoepfe">${buttons.map((b) => `<button class="knopf${b.main ? ' voll' : ''}${b.danger && !b.main ? ' gefahr' : ''}" data-wahl="${b.id}"${b.main && b.danger ? ' style="background:var(--error-color,#db4437);border-color:var(--error-color,#db4437)"' : ''}>${esc(b.label)}</button>`).join('')}</div></div>`;
        const close = (value) => { document.removeEventListener('keydown', key); overlay.remove(); resolve(value); };
        const key = (e) => { if (e.key === 'Escape') close(read ? null : 'cancel'); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(read ? null : 'cancel'); });
        overlay.querySelectorAll('[data-wahl]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.wahl;
          if (read) close(id === 'ok' ? read(overlay.querySelector('.fenster')) : null);
          else close(id);
        }));
        overlay.querySelectorAll('.feldlink').forEach((a) => a.addEventListener('click', (e) => {
          e.preventDefault();
          close(`field:${a.dataset.id}`);
        }));
        document.addEventListener('keydown', key);
        (this.querySelector('.wa-set') || this).appendChild(overlay);
        overlay.querySelector('[data-wahl="cancel"]').focus();
      });
    }

    _toast(text, error, ok) {
      let toast = this.querySelector('.toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        (this.querySelector('.wa-set') || this).appendChild(toast);
      }
      toast.textContent = text;
      toast.classList.toggle('fehler', Boolean(error));
      toast.classList.toggle('ok', Boolean(ok));
      toast.classList.add('an');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove('an'), error ? 5000 : 1600);
    }
  }

  if (!customElements.get('whereabouts-settings')) customElements.define('whereabouts-settings', WhereaboutsSettings);
}
