// Whereabouts – settings page (third tab of the sidebar page).
// Controls are Home Assistant's own (<ha-selector>), so the page looks and
// behaves like Home Assistant's settings and follows the theme.

// --- what is on the page -------------------------------------------------------
const B = { boolean: {} };
const sel = (options) => ({ select: { mode: 'dropdown', options } });
const num = (min, max, step, unit) => ({ number: { min, max, step, mode: 'box', unit_of_measurement: unit } });
const PERSONS = { entity: { multiple: true, filter: { domain: 'person' } } };

// Personal categories: every user for themselves (unless locked). weight: main | more
const PERSONAL = [
  { id: 'views', icon: 'mdi:tab', weight: 'main', fields: [
    { key: 'view_live', sel: B }, { key: 'view_history', sel: B }, { key: 'view_settings', sel: B },
    { key: 'start_view', sel: (t) => sel(['live', 'history', 'settings'].map((v) => ({ value: v, label: t(`opt_view_${v}`) }))) },
  ] },
  { id: 'persons', icon: 'mdi:account-multiple', weight: 'main', custom: 'persons' },
  { id: 'map', icon: 'mdi:map', weight: 'main', fields: [
    { key: 'map_style', sel: (t) => sel(['auto', 'light', 'dark'].map((v) => ({ value: v, label: t(`ed_style_${v}`) }))) },
    { key: 'tiles', preview: true },
    { key: 'map_link', sel: (t) => sel(['google', 'apple', 'osm', 'waze', 'here', 'none'].map((v) => ({ value: v, label: t(`ed_link_${v}`) }))) },
    { key: 'map_link_choice', sel: B },
  ] },
  { id: 'zones', icon: 'mdi:map-marker-circle', weight: 'more', fields: [
    { key: 'show_zones', sel: B }, { key: 'zone_color_home', sel: { color_rgb: {} }, color: true },
    { key: 'zone_color', sel: { color_rgb: {} }, color: true }, { key: 'zone_names_zoom', sel: num(1, 20, 1) },
  ] },
  { id: 'live', icon: 'mdi:map-marker-account', weight: 'more', fields: [
    { key: 'show_info_bar', sel: B }, { key: 'show_status_bar', sel: B }, { key: 'show_accuracy', sel: B },
    { key: 'follow', sel: B }, { key: 'live_refresh_interval', sel: num(5, 3600, 5, 's') },
  ] },
  { id: 'history', icon: 'mdi:map-clock', weight: 'more', fields: [
    { key: 'default_view', sel: (t) => sel(['map', 'table'].map((v) => ({ value: v, label: t(`ed_view_${v}`) }))) },
    { key: 'show_legend', sel: B }, { key: 'show_export', sel: B }, { key: 'history_refresh_interval', sel: num(30, 3600, 10, 's') },
  ] },
];

// Administration: integration options, rights, data
const ADMIN = [
  { id: 'rights', icon: 'mdi:account-key', custom: 'rights' },
  { id: 'sidebar', icon: 'mdi:dock-left', options: [
    { key: 'panel', sel: B }, { key: 'panel_title', sel: { text: {} }, text: true },
    { key: 'panel_icon', sel: { icon: {} }, text: true },
    { key: 'live_card', sel: B }, { key: 'show_persons_live', sel: PERSONS },
    { key: 'history_card', sel: B }, { key: 'show_persons_history', sel: PERSONS },
    { key: 'carto_api_key', sel: { text: {} }, text: true, link: { href: 'https://carto.com/basemaps/apikey/', label: 'carto_get_key' } },
  ] },
  { id: 'recording', icon: 'mdi:record-rec', options: [
    { key: 'record_persons', sel: PERSONS }, { key: 'min_interval', sel: num(10, 3600, 10, 's') },
    { key: 'same_place_distance', sel: num(10, 1000, 10, 'm') }, { key: 'retention_days', sel: num(0, 36500, 1, 'd'), confirm: 'retention' },
  ] },
  { id: 'addresses', icon: 'mdi:map-search', options: [
    { key: 'address_source', sel: (t) => sel(['phone_osm', 'phone', 'osm', 'off'].map((v) => ({ value: v, label: t(`opt_address_${v}`) }))) },
    { key: 'address_max_distance', sel: num(10, 5000, 10, 'm') },
  ], custom: 'sensors' },
  { id: 'data', icon: 'mdi:database-arrow-up-down', custom: 'data', everyone: true },
  { id: 'diagnostics', icon: 'mdi:stethoscope', custom: 'diagnostics' },
];

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
};
const rgbToHex = (rgb) => (Array.isArray(rgb) && rgb.length === 3
  ? `#${rgb.map((v) => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  : undefined);

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
  .wa-set .vorschauen { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .wa-set .vorschau { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 6px; border-radius: 12px; cursor: pointer;
                      border: 2px solid var(--divider-color); background: none; font: inherit; color: inherit; text-align: left; }
  .wa-set .vorschau:hover:not(:disabled) { border-color: var(--secondary-text-color); }
  .wa-set .vorschau.gewaehlt { border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
  .wa-set .vorschau:disabled { cursor: default; }
  .wa-set .vorschau .minikarte { height: 130px; border-radius: 8px; overflow: hidden; pointer-events: none; }
  .wa-set .vorschau .minikarte .leaflet-control-attribution { font-size: 8px; line-height: 1.2; }
  .wa-set .vorschau .name { font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 6px; }
  .wa-set .vorschau .name ha-icon { --mdc-icon-size: 18px; color: var(--primary-color); }
  .wa-set .vorschau .klein { min-height: 2.6em; }
  .wa-set .vorschau .fehlt { position: absolute; left: 6px; right: 6px; top: 6px; height: 130px; border-radius: 8px; display: flex;
                             align-items: center; justify-content: center; text-align: center; padding: 8px; box-sizing: border-box;
                             font-size: 13px; background: rgba(0,0,0,.6); color: #fff; }
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
    .wa-set .vorschauen { grid-template-columns: minmax(0, 1fr); }
    .wa-set .vorschau { flex-direction: row; align-items: center; }
    .wa-set .vorschau .minikarte { flex: 0 0 120px; height: 80px; }
    .wa-set .vorschau .fehlt { width: 120px; height: 80px; right: auto; }
  }
`;

export function defineSettingsPage(S) {
  // Text for a key that may be missing (e.g. an error code from the server)
  const maybe = (t, key, fallback) => { const text = t(key); return text === key ? fallback : text; };

  class WhereaboutsSettings extends HTMLElement {
    constructor() {
      super();
      this._scope = 'own';
      this._open = new Set();
      this._timers = {};
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
    }

    connectedCallback() {
      if (this._hass && !this._unsub && this._data) {
        this._unsub = S.subscribeInfo(this._hass, (info) => { this._info = info; this._refreshSoon(); });
      }
    }

    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      this._haSelector = await ensureSelector();
      await this._load();
      this._unsub = S.subscribeInfo(this._hass, (info) => { this._info = info; this._refreshSoon(); });
    }

    async _load() {
      try {
        this._data = await this._hass.callWS({ type: 'whereabouts/settings' });
      } catch (err) {
        this.innerHTML = S.messageHtml(this._t('settings_failed'));
        return;
      }
      this._render();
    }

    // Changed elsewhere (other tab, other user, integration reloaded): read again,
    // but never redraw while something on the page has the focus.
    _refreshSoon() {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(async () => {
        if (!this._data) return;
        let fresh;
        try { fresh = await this._hass.callWS({ type: 'whereabouts/settings' }); } catch (err) { return; }
        const old = JSON.stringify(this._data);
        this._data = fresh;
        const focused = this.contains(document.activeElement) && document.activeElement !== document.body;
        if (JSON.stringify(fresh) !== old && !focused && !this.querySelector('.dialog')) this._render();
      }, 600);
    }

    get _admin() { return this._data && this._data.is_admin; }

    _values(category) {
      const d = this._data;
      return this._scope === 'defaults' ? d.defaults[category] : d.effective[category];
    }

    _locked(category) {
      return this._scope === 'own' && this._data.locked.includes(category);
    }

    // --- page -------------------------------------------------------------------------
    _render() {
      const t = this._t;
      const esc = S.escapeHtml;
      const d = this._data;
      const scrollParent = this.parentElement;
      const scroll = scrollParent ? scrollParent.scrollTop : 0;
      const groups = [
        { title: t('grp_main'), items: PERSONAL.filter((c) => c.weight === 'main') },
        { title: t('grp_more'), items: PERSONAL.filter((c) => c.weight === 'more') },
        { title: t('grp_admin'), items: ADMIN.filter((c) => this._admin || c.everyone || c.id === 'rights') },
      ];
      const lockIcon = (id) => (PERSONAL.some((c) => c.id === id) && d.locked.includes(id) && this._scope === 'own'
        ? '<ha-icon class="schloss" icon="mdi:lock"></ha-icon>' : '');
      this.innerHTML = `${S.leafletCss()}<style>${CSS}</style>
        <div class="wa-set">
          <nav class="toc" aria-label="${esc(t('toc'))}">
            ${groups.filter((g) => g.items.length).map((g) => `<div class="gruppe">${esc(g.title)}</div>
              ${g.items.map((c) => `<a data-ziel="${c.id}"><ha-icon icon="${c.icon}"></ha-icon><span>${esc(t(`cat_${c.id}`))}</span>${lockIcon(c.id)}</a>`).join('')}`).join('')}
          </nav>
          <main>
            <div class="sprung"><select class="ein" aria-label="${esc(t('toc'))}">
              ${groups.filter((g) => g.items.length).map((g) => `<optgroup label="${esc(g.title)}">
                ${g.items.map((c) => `<option value="${c.id}">${esc(t(`cat_${c.id}`))}</option>`).join('')}</optgroup>`).join('')}
            </select></div>
            <div class="oben">
              <h1>${esc(t('settings_title'))}</h1>
              ${this._admin ? `<div class="umschalter" role="tablist">
                <button data-scope="own" class="${this._scope === 'own' ? 'aktiv' : ''}">${esc(t('scope_own'))}</button>
                <button data-scope="defaults" class="${this._scope === 'defaults' ? 'aktiv' : ''}">${esc(t('scope_defaults'))}</button>
              </div>` : ''}
            </div>
            <p class="hinweis">${esc(this._scope === 'defaults' ? t('scope_defaults_text') : t('scope_own_text'))}</p>
            ${PERSONAL.map((c) => this._categoryHtml(c, true)).join('')}
            ${ADMIN.filter((c) => this._admin || c.everyone || c.id === 'rights').map((c) => this._categoryHtml(c, false)).join('')}
            ${this._scope === 'own' ? `<div class="fuss"><button class="knopf gefahr alles-zurueck"><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_all'))}</button></div>` : ''}
            <p class="hinweis klein">Whereabouts ${esc(d.version)}</p>
          </main>
        </div>`;
      this._wire();
      if (scrollParent) scrollParent.scrollTop = scroll;
    }

    _categoryHtml(c, personal) {
      const t = this._t;
      const esc = S.escapeHtml;
      const locked = personal && this._locked(c.id);
      const foldable = c.weight === 'more' || c.id === 'diagnostics';
      const closed = foldable && !this._open.has(c.id);
      const own = this._data.own[c.id];
      const canReset = personal && !locked && (this._scope === 'own' ? own && Object.keys(own).length
        : this._data.admin && this._data.admin.defaults && true);
      const lock = personal && this._admin ? this._lockState(c.id) : null;
      return `<ha-card class="kat${closed ? ' zu' : ''}${locked ? ' gesperrt' : ''}" id="kat-${c.id}" data-kat="${c.id}">
        <div class="kat-kopf${foldable ? ' klapp' : ''}">
          <ha-icon class="symbol" icon="${c.icon}"></ha-icon>
          <h2>${esc(t(`cat_${c.id}`))}</h2>
          ${locked ? `<span class="marke"><ha-icon icon="mdi:lock"></ha-icon>${esc(t('locked_badge'))}</span>` : ''}
          ${lock ? `<button class="knopf rund sperre" title="${esc(t(`lock_${lock}`))}" aria-label="${esc(t(`lock_${lock}`))}"><ha-icon icon="${lock === 'none' ? 'mdi:lock-open-variant-outline' : 'mdi:lock'}"></ha-icon></button>` : ''}
          ${!personal && !this._admin && c.id !== 'data' ? `<span class="marke"><ha-icon icon="mdi:shield-account"></ha-icon>${esc(t('admin_badge'))}</span>` : ''}
          ${foldable ? '<ha-icon class="pfeil" icon="mdi:chevron-down"></ha-icon>' : ''}
        </div>
        <div class="kat-inhalt">
          <p class="kat-text">${esc(t(`cd_${c.id}`))}</p>
          <div class="felder" data-kat="${c.id}"></div>
          ${canReset ? `<div class="fuss"><button class="knopf gefahr zurueck" data-kat="${c.id}"><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_category'))}</button></div>` : ''}
        </div>
      </ha-card>`;
    }

    _lockState(category) {
      const lock = (this._data.admin && this._data.admin.locks[category]) || {};
      return lock.mode || 'none';
    }

    _wire() {
      const t = this._t;
      this.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', () => this._jump(a.dataset.ziel)));
      const jump = this.querySelector('.sprung select');
      jump.addEventListener('change', () => this._jump(jump.value));
      this.querySelectorAll('.umschalter button').forEach((b) => b.addEventListener('click', () => {
        if (this._scope === b.dataset.scope) return;
        this._scope = b.dataset.scope;
        this._render();
      }));
      this.querySelectorAll('.kat-kopf.klapp').forEach((head) => head.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const card = head.closest('.kat');
        card.classList.toggle('zu');
        if (card.classList.contains('zu')) this._open.delete(card.dataset.kat);
        else {
          this._open.add(card.dataset.kat);
          if (card.dataset.kat === 'diagnostics') this._loadDiagnostics();
        }
      }));
      this.querySelectorAll('.sperre').forEach((b) => b.addEventListener('click', () => this._lockDialog(b.closest('.kat').dataset.kat)));
      this.querySelectorAll('.zurueck').forEach((b) => b.addEventListener('click', () => this._resetCategory(b.dataset.kat)));
      const all = this.querySelector('.alles-zurueck');
      if (all) {
        all.addEventListener('click', async () => {
          if (!await this._confirm(t('reset_all'), t('confirm_reset_all'), t('reset'), true)) return;
          await this._ws({ type: 'whereabouts/settings/reset', scope: 'own' }, true);
          await this._load();
        });
      }
      PERSONAL.forEach((c) => {
        const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
        if (c.custom === 'persons') this._persons(box, c.id);
        else c.fields.forEach((f) => box.appendChild(f.preview
          ? this._tilesPreview(c.id, f)
          : this._row(f, this._values(c.id)[f.key], this._locked(c.id), (value) => this._savePersonal(c.id, f.key, value))));
      });
      ADMIN.forEach((c) => {
        const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
        if (!box) return;
        if (this._admin && c.options) {
          const options = this._data.admin.options;
          c.options.forEach((f) => box.appendChild(this._row(f, options[f.key], false, (value) => this._saveOption(f, value))));
        }
        if (c.custom === 'rights') this._rights(box);
        if (c.custom === 'sensors' && this._admin) this._sensors(box);
        if (c.custom === 'data') this._dataSection(box);
        if (c.custom === 'diagnostics' && this._open.has('diagnostics')) this._loadDiagnostics();
      });
      this._watchToc();
    }

    _jump(id) {
      const card = this.querySelector(`#kat-${id}`);
      if (!card) return;
      if (card.classList.contains('zu')) {
        card.classList.remove('zu');
        this._open.add(id);
        if (id === 'diagnostics') this._loadDiagnostics();
      }
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

    // --- one setting: label, ⓘ, control -----------------------------------------------------
    _row(field, value, disabled, onChange) {
      const t = this._t;
      const row = document.createElement('div');
      const selector = typeof field.sel === 'function' ? field.sel(t) : field.sel;
      const isSwitch = 'boolean' in selector;
      row.className = `zeile${isSwitch ? ' schalter-zeile' : ''}`;
      const label = t(`st_${field.key}`);
      row.innerHTML = `<div class="beschriftung"><span>${S.escapeHtml(label)}</span>
          <button class="info" type="button" aria-expanded="false" title="${S.escapeHtml(t('more_info'))}" aria-label="${S.escapeHtml(t('more_info'))}: ${S.escapeHtml(label)}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer${isSwitch ? ' schalter' : ''}"></div>
        <div class="infotext" hidden>${S.escapeHtml(t(`si_${field.key}`))}</div>`;
      const info = row.querySelector('.info');
      info.addEventListener('click', () => {
        const text = row.querySelector('.infotext');
        text.hidden = !text.hidden;
        info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      });
      row.querySelector('.steuer').appendChild(this._control(selector, field, value, disabled, onChange));
      if (field.link) {
        const link = document.createElement('a');
        link.className = 'verweis';
        link.href = field.link.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.innerHTML = `<ha-icon icon="mdi:open-in-new"></ha-icon>${S.escapeHtml(t(field.link.label))}`;
        row.appendChild(link);
      }
      return row;
    }

    _control(selector, field, value, disabled, onChange) {
      const shown = field.color ? hexToRgb(value) : value;
      const emit = (v) => {
        const out = field.color ? rgbToHex(v) : v;
        if (field.text || 'number' in selector) {
          clearTimeout(this._timers[field.key]);
          this._timers[field.key] = setTimeout(() => onChange(out), 700);
        } else onChange(out);
      };
      if (this._haSelector) {
        const el = document.createElement('ha-selector');
        el.hass = this._hass;
        el.selector = selector;
        el.value = shown;
        el.disabled = disabled;
        el.required = false;
        el.addEventListener('value-changed', (e) => { e.stopPropagation(); el.value = e.detail.value; emit(e.detail.value); });
        return el;
      }
      return this._plainControl(selector, field, value, disabled, emit);
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
      } else if ('entity' in selector && selector.entity.multiple) {
        el = document.createElement('div');
        el.className = 'chips';
        const chosen = new Set(value || []);
        this._data.persons.forEach((p) => {
          const chip = document.createElement('label');
          chip.className = `chip${chosen.has(p.entity_id) ? ' an' : ''}`;
          chip.innerHTML = `<input type="checkbox"${chosen.has(p.entity_id) ? ' checked' : ''}${disabled ? ' disabled' : ''}>${S.escapeHtml(p.name)}`;
          chip.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) chosen.add(p.entity_id); else chosen.delete(p.entity_id);
            chip.classList.toggle('an', e.target.checked);
            emit([...chosen]);
          });
          el.appendChild(chip);
        });
        return el;
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

    // --- saving -------------------------------------------------------------------------------
    async _ws(message, quiet) {
      try {
        const result = await this._hass.callWS(message);
        if (!quiet) this._toast(this._t('saved'));
        return result === undefined || result === null ? true : result;
      } catch (err) {
        this._toast(this._t('save_failed', { error: (err && (err.message || err.code)) || err }), true);
        return null;
      }
    }

    async _savePersonal(category, key, value) {
      const scope = this._scope;
      const ok = await this._ws({ type: 'whereabouts/settings/save', scope, category, values: { [key]: value } });
      if (ok === null) return;
      if (scope === 'defaults') this._data.defaults[category][key] = value;
      else {
        this._data.own[category] = { ...(this._data.own[category] || {}), [key]: value };
        this._data.effective[category][key] = value;
      }
      this._updateResetButton(category);
    }

    _updateResetButton(category) {
      const card = this.querySelector(`#kat-${category}`);
      if (!card || card.querySelector('.zurueck') || this._scope !== 'own') return;
      const foot = document.createElement('div');
      foot.className = 'fuss';
      foot.innerHTML = `<button class="knopf gefahr zurueck" data-kat="${category}"><ha-icon icon="mdi:restore"></ha-icon>${S.escapeHtml(this._t('reset_category'))}</button>`;
      foot.querySelector('button').addEventListener('click', () => this._resetCategory(category));
      card.querySelector('.kat-inhalt').appendChild(foot);
    }

    async _resetCategory(category) {
      const t = this._t;
      const text = this._scope === 'defaults' ? t('confirm_reset_defaults', { name: t(`cat_${category}`) })
        : t('confirm_reset_category', { name: t(`cat_${category}`) });
      if (!await this._confirm(t('reset_category'), text, t('reset'), true)) return;
      await this._ws({ type: 'whereabouts/settings/reset', scope: this._scope, category }, true);
      await this._load();
    }

    async _saveOption(field, value) {
      const t = this._t;
      if (field.confirm === 'retention' && Number(value) > 0) {
        const ok = await this._confirm(t('st_retention_days'), t('confirm_retention', { n: value }), t('save'), true);
        if (!ok) { this._render(); return; }
      }
      const ok = await this._ws({ type: 'whereabouts/settings/options', values: { [field.key]: value } });
      if (ok !== null) this._data.admin.options[field.key] = value;
    }

    // --- persons (personal) -----------------------------------------------------------------------
    _selectablePersons() {
      const rights = this._data.rights;
      const allowed = new Set([...(rights.live || []), ...(rights.history || [])]);
      return this._data.persons.filter((p) => this._scope === 'defaults' || allowed.has(p.entity_id));
    }

    _persons(box, category) {
      const t = this._t;
      const esc = S.escapeHtml;
      const locked = this._locked(category);
      const values = this._values(category);
      const settings = { ...(values.person_settings || {}) };
      const all = this._selectablePersons();
      const chosen = (values.persons || []).filter((id) => all.some((p) => p.entity_id === id));
      const order = chosen.length ? [...chosen, ...all.map((p) => p.entity_id).filter((id) => !chosen.includes(id))]
        : all.map((p) => p.entity_id);
      const shown = new Set(chosen.length ? chosen : order);
      const colorOf = (id) => (settings[id] && settings[id].color) || S.personColor(this._hass, {}, id);
      const save = () => {
        const list = order.filter((id) => shown.has(id));
        const allInOrder = list.length === all.length && list.every((id, i) => id === all[i].entity_id);
        const cleaned = {};
        Object.entries(settings).forEach(([id, entry]) => {
          const e = Object.fromEntries(Object.entries(entry).filter(([, v]) => v));
          if (Object.keys(e).length) cleaned[id] = e;
        });
        clearTimeout(this._timers.persons);
        this._timers.persons = setTimeout(async () => {
          const ok = await this._ws({ type: 'whereabouts/settings/save', scope: this._scope, category,
            values: { persons: allInOrder ? [] : list, person_settings: cleaned } });
          if (ok === null) return;
          const target = this._scope === 'defaults' ? this._data.defaults[category] : this._data.effective[category];
          target.persons = allInOrder ? [] : list;
          target.person_settings = cleaned;
          if (this._scope === 'own') this._data.own[category] = { persons: target.persons, person_settings: cleaned };
          this._updateResetButton(category);
        }, 600);
        warn();
      };
      const warnBox = document.createElement('div');
      warnBox.className = 'warnung';
      warnBox.hidden = true;
      const warn = () => {
        const entries = order.filter((id) => shown.has(id)).map((id) => ({ name: nameOf(id), color: colorOf(id) }));
        const pairs = S.similarColors(entries);
        warnBox.hidden = !pairs.length;
        warnBox.textContent = pairs.length ? t('ed_similar_colors', { pairs: pairs.map((p) => p.join(' / ')).join(', ') }) : '';
      };
      const personOf = (id) => this._data.persons.find((p) => p.entity_id === id) || { entity_id: id, name: id, picture: '' };
      const nameOf = (id) => (settings[id] && settings[id].name) || personOf(id).name;
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
          row.innerHTML = `
            <div class="reihenfolge">
              <button class="knopf rund hoch" title="${esc(t('move_up'))}" aria-label="${esc(t('move_up'))}" ${index === 0 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-up"></ha-icon></button>
              <button class="knopf rund runter" title="${esc(t('move_down'))}" aria-label="${esc(t('move_down'))}" ${index === order.length - 1 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            </div>
            <div class="bild"></div>
            <div>
              <label class="chip${shown.has(id) ? ' an' : ''}" style="margin-bottom:8px"><input type="checkbox" class="zeigen"${shown.has(id) ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(p.name)}</label>
              <div class="felder">
                <input class="ein name" placeholder="${esc(t('ps_name_placeholder', { name: p.name }))}" aria-label="${esc(t('ed_name'))}" value="${esc(own.name || '')}" ${locked ? 'disabled' : ''}>
                <input class="ein farbe" type="color" aria-label="${esc(t('ed_color'))}" value="${esc(colorOf(id).toLowerCase())}" ${locked ? 'disabled' : ''}>
                <div class="bildzeile">
                  <input class="ein bildurl" placeholder="${esc(t('ps_picture_placeholder'))}" aria-label="${esc(t('ed_picture'))}" value="${esc(own.picture || '')}" ${locked ? 'disabled' : ''}>
                  <button class="knopf rund hochladen" title="${esc(t('upload_picture'))}" aria-label="${esc(t('upload_picture'))}" ${locked ? 'disabled' : ''}><ha-icon icon="mdi:upload"></ha-icon></button>
                  <input type="file" accept="image/*" hidden>
                </div>
              </div>
            </div>
            <button class="info" type="button" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}" aria-expanded="false"><ha-icon icon="mdi:information-outline"></ha-icon></button>
            <div class="infotext" hidden style="grid-column:1/-1">${esc(t('si_person'))}</div>`;
          const picture = () => {
            const url = S.safeUrl(own.picture) || S.safeUrl(p.picture);
            const el = row.querySelector('.bild');
            el.style.backgroundImage = url ? `url("${url}")` : '';
            el.textContent = url ? '' : nameOf(id).charAt(0);
          };
          picture();
          row.querySelector('.zeigen').addEventListener('change', (e) => {
            if (e.target.checked) shown.add(id); else shown.delete(id);
            row.classList.toggle('aus', !e.target.checked);
            e.target.closest('.chip').classList.toggle('an', e.target.checked);
            save();
          });
          row.querySelector('.name').addEventListener('input', (e) => { settings[id] = { ...settings[id], name: e.target.value.trim() }; picture(); save(); });
          row.querySelector('.farbe').addEventListener('input', (e) => {
            settings[id] = { ...settings[id], color: e.target.value.toUpperCase() };
            row.style.setProperty('--farbe', e.target.value);
            save();
          });
          row.querySelector('.bildurl').addEventListener('input', (e) => {
            settings[id] = { ...settings[id], picture: e.target.value.trim() };
            own.picture = e.target.value.trim();
            picture();
            save();
          });
          const file = row.querySelector('input[type="file"]');
          row.querySelector('.hochladen').addEventListener('click', () => file.click());
          file.addEventListener('change', async () => {
            if (!file.files.length) return;
            const url = await this._upload(file.files[0]);
            if (!url) return;
            settings[id] = { ...settings[id], picture: url };
            own.picture = url;
            row.querySelector('.bildurl').value = url;
            picture();
            save();
          });
          const move = (delta) => {
            const j = index + delta;
            [order[index], order[j]] = [order[j], order[index]];
            draw();
            save();
          };
          row.querySelector('.hoch').addEventListener('click', () => move(-1));
          row.querySelector('.runter').addEventListener('click', () => move(1));
          const info = row.querySelector('.info');
          info.addEventListener('click', () => {
            const text = row.querySelector('.infotext');
            text.hidden = !text.hidden;
            info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
          });
          box.appendChild(row);
        });
        warn();
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

    // --- map style with small example maps (Stuttgart) ------------------------------------------------
    _tilesPreview(category, field) {
      const t = this._t;
      const esc = S.escapeHtml;
      const locked = this._locked(category);
      const values = this._values(category);
      const key = (this._info && this._info.settings && this._info.settings.carto_api_key)
        || (this._data.admin && this._data.admin.options.carto_api_key) || '';
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t(`st_${field.key}`))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${esc(t(`si_${field.key}`))}</div>
        <div class="vorschauen" role="radiogroup" aria-label="${esc(t(`st_${field.key}`))}">
          ${['esri', 'osm', 'carto'].map((v) => `<button class="vorschau${values.tiles === v ? ' gewaehlt' : ''}" type="button" role="radio"
              aria-checked="${values.tiles === v}" data-wert="${v}"${locked ? ' disabled' : ''}>
              <div class="minikarte"></div>
              <div class="name">${values.tiles === v ? '<ha-icon icon="mdi:check-circle"></ha-icon>' : ''}${esc(t(`ed_tiles_${v}`))}</div>
              <div class="klein">${esc(t(`tiles_note_${v}`))}</div>
              ${v === 'carto' && !key ? `<div class="fehlt">${esc(t('tiles_no_key'))}</div>` : ''}
            </button>`).join('')}
        </div>`;
      this._infoToggle(row);
      row.querySelectorAll('.vorschau').forEach((button) => button.addEventListener('click', async () => {
        if (button.classList.contains('gewaehlt')) return;
        await this._savePersonal(category, 'tiles', button.dataset.wert);
        row.querySelectorAll('.vorschau').forEach((b) => {
          const on = b === button;
          b.classList.toggle('gewaehlt', on);
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          const name = b.querySelector('.name');
          const icon = name.querySelector('ha-icon');
          if (on && !icon) name.insertAdjacentHTML('afterbegin', '<ha-icon icon="mdi:check-circle"></ha-icon>');
          if (!on && icon) icon.remove();
        });
      }));
      // Small, fixed maps of Stuttgart in light or dark, as the cards will show them
      S.loadLeaflet().then(() => {
        const dark = S.isDark(this._hass, values.map_style);
        row.querySelectorAll('.vorschau').forEach((button) => {
          const box = button.querySelector('.minikarte');
          const map = window.L.map(box, {
            zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
            keyboard: false, touchZoom: false, tap: false, attributionControl: true,
          }).setView([48.7784, 9.1800], 13);
          map.attributionControl.setPrefix(false);
          S.setTiles(map, [], { tiles: button.dataset.wert, carto_api_key: key }, dark, box, null);
          setTimeout(() => map.invalidateSize(), 50);
        });
      }).catch(() => {});
      return row;
    }

    // --- rights ---------------------------------------------------------------------------------------
    _rights(box) {
      const t = this._t;
      const esc = S.escapeHtml;
      const d = this._data;
      const nameOf = (id) => (d.persons.find((p) => p.entity_id === id) || { name: id }).name;
      const list = (ids) => (ids.length ? ids.map(nameOf).join(', ') : t('nobody'));
      if (!this._admin) {
        box.innerHTML = `<div class="tabellenrahmen"><table class="tabelle">
          ${['live', 'history', 'delete'].map((k) => `<tr><th>${esc(t(`right_${k}`))}</th><td>${esc(list(d.rights[k] || []))}</td></tr>`).join('')}
          </table></div><p class="kat-text klein">${esc(t('rights_by_admin'))}</p>`;
        return;
      }
      const admin = d.admin;
      const levels = ['all', 'own', 'none'];
      const head = document.createElement('div');
      ['live', 'history', 'delete'].forEach((kind) => {
        head.appendChild(this._row({ key: `rights_default_${kind}`, sel: sel(levels.map((v) => ({ value: v, label: t(`level_${v}`) }))) },
          admin.rights_default[kind], false, async (value) => {
            const before = admin.rights_default[kind];
            if (levels.indexOf(value) > levels.indexOf(before)
              && !await this._confirm(t('rights_title'), t('confirm_rights_less'), t('save'), true)) { this._render(); return; }
            if (await this._ws({ type: 'whereabouts/settings/rights_default', levels: { [kind]: value } }) !== null) admin.rights_default[kind] = value;
          }));
      });
      box.appendChild(head);
      const users = admin.users.filter((u) => u.active);
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
        tr.innerHTML = `<td>${esc(u.name)}</td><td><input type="checkbox" class="eigen"${own ? ' checked' : ''} aria-label="${esc(t('rights_own'))}"></td>`;
        ['live', 'history', 'delete'].forEach((kind) => {
          const td = document.createElement('td');
          const chips = document.createElement('div');
          chips.className = 'chips';
          const current = own ? new Set(own[kind] || []) : null;
          d.persons.forEach((p) => {
            const on = current ? current.has(p.entity_id) : this._ruleAllows(kind, u, p);
            const chip = document.createElement('label');
            chip.className = `chip${on ? ' an' : ''}${own ? '' : ' fest'}`;
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
          this._render();
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

    // --- locks (administrators) ---------------------------------------------------------------------------
    async _lockDialog(category) {
      const t = this._t;
      const esc = S.escapeHtml;
      const lock = { mode: 'none', except: [], users: [], ...(this._data.admin.locks[category] || {}) };
      const users = this._data.admin.users.filter((u) => !u.is_admin && u.active);
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
        this._render();
      }
    }

    // --- address sensors (administrators) --------------------------------------------------------------------
    _sensors(box) {
      const options = this._data.admin.options;
      const sensors = { ...(options.address_sensors || {}) };
      this._data.persons.forEach((p) => {
        box.appendChild(this._row({ key: 'address_sensor', sel: { entity: { filter: { domain: 'sensor' } } }, labelName: p.name },
          sensors[p.entity_id] || '', false, async (value) => {
            sensors[p.entity_id] = value || null;
            await this._saveOption({ key: 'address_sensors' }, sensors);
          }));
        const label = box.lastChild.querySelector('.beschriftung span');
        label.textContent = this._t('st_address_sensor_for', { name: p.name });
      });
    }

    // --- import and export ---------------------------------------------------------------------------------
    _dataSection(box) {
      const t = this._t;
      const esc = S.escapeHtml;
      const d = this._data;
      const historyPersons = d.persons.filter((p) => (d.rights.history || []).includes(p.entity_id));
      const today = new Date().toISOString().slice(0, 10);
      const exportBox = document.createElement('div');
      exportBox.innerHTML = `
        <div class="zeile breit"><div class="beschriftung"><span><b>${esc(t('export_title'))}</b></span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
          <div class="infotext" hidden>${esc(t('si_export'))}</div>
          <div class="felder" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
            <select class="ein person" aria-label="${esc(t('col_person'))}">${historyPersons.map((p) => `<option value="${esc(p.entity_id)}">${esc(p.name)}</option>`).join('')}</select>
            <input class="ein von" type="date" value="${today}" max="${today}" aria-label="${esc(t('from'))}">
            <input class="ein bis" type="date" value="${today}" max="${today}" aria-label="${esc(t('to'))}">
            <select class="ein format" aria-label="${esc(t('format'))}"><option value="csv">CSV</option><option value="gpx">GPX</option></select>
            <button class="knopf voll laden"${historyPersons.length ? '' : ' disabled'}><ha-icon icon="mdi:download"></ha-icon>${esc(t('download'))}</button>
          </div></div>`;
      this._infoToggle(exportBox);
      exportBox.querySelector('.laden').addEventListener('click', () => this._export(exportBox));
      box.appendChild(exportBox);
      if (!this._admin) return;
      const importBox = document.createElement('div');
      importBox.innerHTML = `
        <div class="zeile breit"><div class="beschriftung"><span><b>${esc(t('import_title'))}</b></span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
          <div class="infotext" hidden>${esc(t('si_import'))}</div></div>
        <div class="ablage" tabindex="0" role="button">${esc(t('drop_file'))}</div>
        <input type="file" accept=".csv,.zip,.gpx" hidden>
        <div class="zeile"><div class="beschriftung"><span>${esc(t('import_person'))}</span></div>
          <div class="steuer"><select class="ein ziel"><option value="">${esc(t('import_person_file'))}</option>
          ${d.persons.map((p) => `<option value="${esc(p.entity_id)}">${esc(p.name)}</option>`).join('')}</select></div></div>
        <div class="zeile schalter-zeile"><div class="beschriftung"><span>${esc(t('import_replace'))}</span></div>
          <div class="steuer schalter"><input type="checkbox" class="ersetzen"></div></div>
        <div class="ergebnis"></div>`;
      this._infoToggle(importBox);
      const drop = importBox.querySelector('.ablage');
      const input = importBox.querySelector('input[type="file"]');
      const take = (f) => { if (f) this._importFile(f, importBox); };
      drop.addEventListener('click', () => input.click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      input.addEventListener('change', () => take(input.files[0]));
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drueber'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drueber'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drueber'); take(e.dataTransfer.files[0]); });
      box.appendChild(importBox);
    }

    _infoToggle(root) {
      root.querySelectorAll('.info').forEach((info) => info.addEventListener('click', () => {
        const text = info.closest('.zeile').querySelector('.infotext');
        text.hidden = !text.hidden;
        info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      }));
    }

    async _export(root) {
      const person = root.querySelector('.person').value;
      let from = root.querySelector('.von').value;
      let to = root.querySelector('.bis').value;
      if (!person || !from || !to) return;
      if (from > to) [from, to] = [to, from];
      const format = root.querySelector('.format').value;
      try {
        const response = await this._hass.fetchWithAuth(`/api/whereabouts/export?person=${encodeURIComponent(person)}&from=${from}&to=${to}&format=${format}`);
        if (!response.ok) throw new Error(`${response.status}`);
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `whereabouts_${person.split('.')[1]}_${from}${from === to ? '' : `_${to}`}.${format}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      } catch (err) {
        this._toast(this._t('export_failed'), true);
      }
    }

    async _importCall(fileObject, root, preview) {
      const form = new FormData();
      form.append('file', fileObject);
      form.append('person', root.querySelector('.ziel').value);
      form.append('replace', root.querySelector('.ersetzen').checked ? 'true' : 'false');
      form.append('preview', preview ? 'true' : 'false');
      const response = await this._hass.fetchWithAuth('/api/whereabouts/import', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw body;
      return body;
    }

    async _importFile(fileObject, root) {
      const t = this._t;
      const out = root.querySelector('.ergebnis');
      const nameOf = (key) => (this._data.persons.find((p) => p.entity_id === `person.${key}`) || { name: key }).name;
      out.textContent = t('loading');
      let preview;
      try {
        preview = await this._importCall(fileObject, root, true);
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${S.escapeHtml(maybe(t, `import_error_${err.error}`, t('import_failed')))}${err.detail ? ` (${S.escapeHtml(err.detail)})` : ''}</span>`;
        return;
      }
      const summary = t('import_preview', {
        file: fileObject.name, n: preview.total, days: preview.days, persons: preview.persons.map(nameOf).join(', '),
        from: preview.first, to: preview.last,
      });
      out.textContent = summary;
      const replace = root.querySelector('.ersetzen').checked;
      if (!await this._confirm(t('import_title'), `${summary}\n\n${replace ? t('confirm_import_replace') : t('confirm_import')}`, t('import_now'), replace)) {
        out.textContent = t('import_cancelled');
        return;
      }
      out.textContent = t('loading');
      try {
        const result = await this._importCall(fileObject, root, false);
        out.innerHTML = `<span class="ok">${S.escapeHtml(t('import_result', {
          added: result.added, skipped: result.skipped, days: result.days, persons: result.persons.map(nameOf).join(', '),
        }))}</span>`;
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${S.escapeHtml(t('import_failed'))}</span>`;
      }
    }

    // --- diagnostics (administrators) ---------------------------------------------------------------------------
    async _loadDiagnostics() {
      const box = this.querySelector('.felder[data-kat="diagnostics"]');
      if (!box || !this._admin) return;
      const t = this._t;
      const esc = S.escapeHtml;
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

    // --- dialogs ---------------------------------------------------------------------------------------------------
    _confirm(title, text, ok, danger) {
      const esc = S.escapeHtml;
      return this._dialog(`<h3>${esc(title)}</h3><div class="text">${esc(text)}</div>`, ok, danger, () => true)
        .then((value) => Boolean(value));
    }

    _dialog(html, ok, danger, read) {
      const t = this._t;
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog';
        overlay.innerHTML = `<div class="fenster" role="dialog" aria-modal="true">${html}
          <div class="knoepfe"><button class="knopf abbrechen">${S.escapeHtml(t('cancel'))}</button>
          <button class="knopf voll bestaetigen"${danger ? ' style="background:var(--error-color,#db4437);border-color:var(--error-color,#db4437)"' : ''}>${S.escapeHtml(ok)}</button></div></div>`;
        const close = (value) => { document.removeEventListener('keydown', key); overlay.remove(); resolve(value); };
        const key = (e) => { if (e.key === 'Escape') close(null); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        overlay.querySelector('.abbrechen').addEventListener('click', () => close(null));
        overlay.querySelector('.bestaetigen').addEventListener('click', () => close(read(overlay.querySelector('.fenster'))));
        document.addEventListener('keydown', key);
        this.querySelector('.wa-set').appendChild(overlay);
        overlay.querySelector('.abbrechen').focus();
      });
    }

    _toast(text, error) {
      let toast = this.querySelector('.toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        this.querySelector('.wa-set').appendChild(toast);
      }
      toast.textContent = text;
      toast.classList.toggle('fehler', Boolean(error));
      toast.classList.add('an');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove('an'), error ? 5000 : 1600);
    }
  }

  if (!customElements.get('whereabouts-settings')) customElements.define('whereabouts-settings', WhereaboutsSettings);
}
