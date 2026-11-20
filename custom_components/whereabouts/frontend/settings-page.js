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
    { key: 'tiles', custom: 'tiles' },
    { key: 'map_link', sel: (t) => sel(['google', 'apple', 'osm', 'waze', 'here', 'none'].map((v) => ({ value: v, label: t(`ed_link_${v}`) }))) },
    { key: 'map_link_choice', sel: B },
    { key: 'map_link_apps', custom: 'apps', needs: 'map_link_choice', hideOff: true },
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
    { key: 'default_view', sel: (t) => sel(['map', 'heat', 'table'].map((v) => ({ value: v, label: t(`ed_view_${v}`) }))) },
    { key: 'start_period', sel: (t) => sel(['today', '3d', '7d', '4w'].map((v) => ({ value: v, label: t(`start_period_${v}`) }))) },
    { key: 'show_legend', sel: B }, { key: 'show_export', sel: B },
    { key: 'simplify_points', sel: num(0, 100000, 50) },
    { key: 'history_auto_refresh', sel: B },
    { key: 'history_refresh_interval', sel: num(10, 3600, 5, 's'), needs: 'history_auto_refresh' },
  ] },
];

// Administration: integration options, rights, data
const ADMIN = [
  { id: 'base', icon: 'mdi:account-group', custom: 'base' },
  { id: 'rights', icon: 'mdi:account-key', custom: 'rights' },
  // "Dashboard": the entry in the sidebar (shown as "hide in the sidebar", stored as "panel")
  { id: 'sidebar', icon: 'mdi:view-dashboard', reset: ['panel', 'panel_title', 'panel_icon'], options: [
    { key: 'panel', invert: true, label: 'st_panel_hidden', info: 'si_panel_hidden', sel: B, confirm: 'panel' },
    { key: 'panel_title', sel: { text: {} }, text: true, placeholder: 'panel_title' },
    { key: 'panel_icon', sel: { icon: {} }, text: true, emptyIs: 'mdi:map-marker-radius' },
  ] },
  { id: 'recording', icon: 'mdi:record-rec', reset: ['min_interval', 'same_place_distance', 'retention_days'], options: [
    { key: 'record_persons', persons: true },
    { key: 'min_interval', sel: num(10, 3600, 10, 's'), group: 'precision' },
    { key: 'same_place_distance', sel: num(10, 1000, 10, 'm'), group: 'precision' },
    { key: 'retention_days', sel: num(0, 36500, 1, 'd'), confirm: 'retention', group: 'precision' },
  ] },
  { id: 'addresses', icon: 'mdi:map-search', reset: ['address_source', 'address_max_distance', 'address_sensors'], options: [
    { key: 'address_source', sel: (t) => sel(['phone_osm', 'phone', 'osm', 'off'].map((v) => ({ value: v, label: t(`opt_address_${v}`) }))) },
    { key: 'address_max_distance', sel: num(10, 5000, 10, 'm'), hideWhen: (o) => o.address_source === 'osm' || o.address_source === 'off' },
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
// "Restore own values" after resetting an administration category: category id -> { restore(), until }.
// Kept outside the page, because Home Assistant may rebuild the page (sidebar entry).
const OPTION_UNDO = new Map();
const PAGES = new Set(); // settings pages on screen
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

// The page is put together from these parts (settings-<name>.js), each a class
// extending the one before. Loaded with the same "?v=<version>" as this file.
const PARTS = ['values', 'layout', 'fields', 'persons', 'map', 'zones', 'admin', 'users', 'data', 'diagnostics', 'dialogs'];

export async function defineSettingsPage(S, D) {
  if (customElements.get('whereabouts-settings')) return;
  const query = new URL(import.meta.url).search;
  const [{ CSS }, ...parts] = await Promise.all(['styles', ...PARTS].map((name) => import(`./settings-${name}.js${query}`)));
  // Text for a key that may be missing (e.g. an error code from the server)
  const maybe = (t, key, fallback) => { const text = t(key); return text === key ? fallback : text; };
  const esc = (v) => S.escapeHtml(v);
  // ⓘ texts: paragraphs (blank line) and **bold keywords**
  const rich = (v) => String(v ?? '').split(/\n\s*\n/).map((part) => `<p style="margin:0 0 6px">${esc(part.trim())
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');
  const VIEW_KEY = 'whereabouts-settings-view';
  const KEEP_VIEW_MS = 60000; // back within a minute: same place; later: page from the top

  class SettingsBase extends HTMLElement {
    constructor() {
      super();
      this._scope = 'own'; // own | defaults | user
      this._user = null; // the user whose settings an administrator edits (scope "user")
      this._open = null; // categories that are open (not stored); null = start state
      this._pending = new Map(); // unsaved text/number fields: id -> { label, draft, save, discard }
      this._savables = new Map(); // id -> { api, row }
      this._showTechnical = false;
      this._import = { person: '', mode: 'merge' };
      this._lastAnchor = null; // where the page was last seen (kept while scrolling)
      // "Restore" for 30 s after going back to the standard: one setting / a whole category
      this._undo = new Map(); // `${scope}:${user}:${category}:${key}` -> { restore(), until }
      this._catUndo = new Map(); // `${scope}:${user}:${category}` -> { restore(), until }
      this._onScroll = () => {
        if (this._scrollFrame) return;
        this._scrollFrame = requestAnimationFrame(() => { this._scrollFrame = null; this._noteAnchor(); if (this._tocUpdate) this._tocUpdate(); });
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
      PAGES.delete(this);
      if (this._unsub) { this._unsub(); this._unsub = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      window.removeEventListener('beforeunload', this._beforeUnload);
      document.removeEventListener('scroll', this._onScroll, true);
      // Left through Home Assistant's sidebar (or rebuilt by it): keep what was not saved and where we were.
      if (this._pending.size) this._storeDrafts();
      this._storeView();
    }

    connectedCallback() {
      PAGES.add(this);
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
  }

  const ctx = {
    S, D, maybe, esc, rich, VIEW_KEY, KEEP_VIEW_MS, CSS,
    B, sel, num, PERSONAL, ADMIN, TILE_LINKS, FORMAT_URL, hexToRgb, rgbToHex, same,
    OPTION_UNDO, PAGES, CARTO_STYLES, CARTO_FIELDS, extractCartoKey, ensureSelector,
  };
  const WhereaboutsSettings = parts.reduce((Base, part) => part.default(ctx, Base), SettingsBase);
  if (!customElements.get('whereabouts-settings')) customElements.define('whereabouts-settings', WhereaboutsSettings);
}
