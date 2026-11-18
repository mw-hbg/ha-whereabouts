// Whereabouts – visual editor for both cards (uses Home Assistant's own <ha-form>).

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
};
const rgbToHex = (rgb) => (Array.isArray(rgb) && rgb.length === 3
  ? `#${rgb.map((v) => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  : undefined);

const ZONE_COLORS = ['zone_color_home', 'zone_color'];
const HELP = ['title', 'persons', 'picture', 'map_link_choice'];

// defaults: { live: LIVE_DEFAULTS, history: HISTORY_DEFAULTS } (passed in, so no module is loaded twice)
export function defineEditor(S, defaults) {
  class WhereaboutsCardEditor extends HTMLElement {
    set hass(hass) {
      this._hass = hass;
      if (!this._t) {
        S.loadTranslations(S.language(hass)).then(() => {
          this._t = S.translator(hass);
          this._render();
        });
        // Only the persons Whereabouts works with (and this user may see).
        S.subscribeInfo(hass, (info) => {
          this._info = info;
          this._render();
        });
      } else if (this._form) {
        this._form.hass = hass;
      }
    }

    setConfig(config) {
      this._config = { ...(config || {}) };
      this._render();
    }

    get _defaults() {
      return { ...S.DEFAULTS_MAP, ...(this.kind === 'history' ? defaults.history : defaults.live) };
    }

    // Persons this card can show: Whereabouts' persons that the user may see here.
    _available() {
      const info = this._info || {};
      if (this.kind === 'history') return (info.persons || []).map((p) => p.entity_id);
      return info.shown || info.base || [];
    }

    // Persons whose settings are shown: the chosen ones, or all.
    _shownPersons() {
      const available = this._available();
      const chosen = (this._config.persons || []).filter((id) => available.includes(id));
      return chosen.length ? chosen : available;
    }

    _schema() {
      const t = this._t;
      const live = this.kind !== 'history';
      const select = (name, values) => ({
        name,
        selector: { select: { mode: 'dropdown', options: values.map((v) => ({ value: v, label: t(`ed_${name === 'map_style' ? 'style' : name === 'map_link' ? 'link' : name === 'default_view' ? 'view' : name === 'height_mode' ? 'height' : name}_${v}`) })) } },
      });
      const persons = this._shownPersons().map((id, index) => ({
        type: 'expandable',
        name: `ps_${index}`,
        title: t('ed_person', { name: S.personName(this._hass, {}, id) }),
        schema: [
          { name: 'name', selector: { text: {} } },
          { name: 'color', selector: { color_rgb: {} } },
          { name: 'picture', selector: { text: {} } },
          ...(live ? [{ name: 'address_sensor', selector: { entity: { filter: { domain: 'sensor' } } } }] : []),
        ],
      }));
      const map = [
        select('map_style', ['auto', 'light', 'dark']),
        select('tiles', ['esri', 'osm', 'carto']),
        ...(live ? [select('map_link', ['google', 'apple', 'osm', 'waze', 'here', 'none'])] : []),
        ...(live && this._data().map_link !== 'none' ? [{ name: 'map_link_choice', selector: { boolean: {} } }] : []),
        select('height_mode', ['auto', 'full', 'fixed']),
        ...(this._data().height_mode !== 'fixed' ? [] : [{ name: 'height', selector: { number: { min: 200, max: 2000, step: 10, mode: 'box', unit_of_measurement: 'px' } } }]),
      ];
      const display = live
        ? [
          { name: 'show_info_bar', selector: { boolean: {} } },
          { name: 'show_status_bar', selector: { boolean: {} } },
          { name: 'show_accuracy', selector: { boolean: {} } },
          { name: 'follow', selector: { boolean: {} } },
          { name: 'auto_refresh', selector: { boolean: {} } },
          { name: 'refresh_interval', disabled: this._data().auto_refresh === false, selector: { number: { min: 5, max: 3600, step: 5, mode: 'box', unit_of_measurement: 's' } } },
        ]
        : [
          select('default_view', ['map', 'table']),
          { name: 'show_legend', selector: { boolean: {} } },
          { name: 'show_export', selector: { boolean: {} } },
          { name: 'auto_refresh', selector: { boolean: {} } },
          { name: 'refresh_interval', disabled: this._data().auto_refresh === false, selector: { number: { min: 10, max: 3600, step: 5, mode: 'box', unit_of_measurement: 's' } } },
        ];
      const zones = [
        { name: 'show_zones', selector: { boolean: {} } },
        ...(this._data().show_zones ? [
          { name: 'zone_color_home', selector: { color_rgb: {} } },
          { name: 'zone_color', selector: { color_rgb: {} } },
          { name: 'zone_names_zoom', selector: { number: { min: 1, max: 20, step: 1, mode: 'box' } } },
        ] : []),
      ];
      return [
        { name: 'title', selector: { text: {} } },
        { name: 'persons', selector: { select: { multiple: true, mode: 'list', options: this._available().map((id) => ({ value: id, label: S.personName(this._hass, {}, id) })) } } },
        ...persons,
        { type: 'expandable', name: '', flatten: true, title: t('ed_appearance'), schema: map },
        { type: 'expandable', name: '', flatten: true, title: t('ed_zones'), schema: zones },
        { type: 'expandable', name: '', flatten: true, title: t('ed_display'), schema: display },
      ];
    }

    // Config -> form data (defaults filled in, person settings per index)
    _data() {
      const data = { ...this._defaults, ...this._config };
      ZONE_COLORS.forEach((key) => { data[key] = hexToRgb(data[key]); });
      const settings = this._config.person_settings || {};
      (this._hass ? this._shownPersons() : []).forEach((id, index) => {
        const own = settings[id] || {};
        data[`ps_${index}`] = {
          name: own.name || '', color: hexToRgb(own.color), picture: own.picture || '', address_sensor: own.address_sensor || '',
        };
      });
      return data;
    }

    _render() {
      if (!this._hass || !this._t || !this._config || !this._info) return;
      if (!this._form) {
        this._form = document.createElement('ha-form');
        this._form.computeLabel = (schema) => this._t(`ed_${schema.name}`);
        this._form.computeHelper = (schema) => (HELP.includes(schema.name) ? this._t(`ed_${schema.name}_help`) : undefined);
        this._form.addEventListener('value-changed', (e) => this._changed(e.detail.value));
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      this._form.data = this._data();
      this._warnColors();
    }

    // Warning above the form when two persons of this card get (nearly) the same colour.
    _warnColors() {
      const entries = this._shownPersons().map((id) => ({
        name: S.personName(this._hass, this._config, id), color: S.personColor(this._hass, this._config, id),
      }));
      const pairs = S.similarColors(entries);
      if (!this._alert) {
        this._alert = document.createElement('ha-alert');
        this._alert.setAttribute('alert-type', 'warning');
        this._alert.style.display = 'block';
        this._alert.style.marginBottom = '12px';
        this.insertBefore(this._alert, this._form);
      }
      this._alert.hidden = !pairs.length;
      this._alert.textContent = pairs.length
        ? this._t('ed_similar_colors', { pairs: pairs.map((p) => p.join(' / ')).join(', ') }) : '';
    }

    _changed(value) {
      const ids = this._shownPersons();
      const config = { type: this._config.type };
      const defaults = this._defaults;
      Object.keys(value).forEach((key) => {
        if (key.startsWith('ps_')) return;
        const v = ZONE_COLORS.includes(key) ? rgbToHex(value[key]) : value[key];
        // keep the YAML short: leave out defaults and empty values
        if (v === '' || v === undefined || (Array.isArray(v) && !v.length) || v === defaults[key]) return;
        config[key] = v;
      });
      const settings = {};
      ids.forEach((id, index) => {
        const ps = value[`ps_${index}`] || {};
        const entry = {};
        if (ps.name) entry.name = ps.name;
        const color = rgbToHex(ps.color);
        if (color) entry.color = color;
        if (ps.picture) entry.picture = ps.picture.trim();
        if (ps.address_sensor) entry.address_sensor = ps.address_sensor;
        if (Object.keys(entry).length) settings[id] = entry;
      });
      // keep settings of persons that are currently not shown
      Object.entries(this._config.person_settings || {}).forEach(([id, entry]) => { if (!ids.includes(id)) settings[id] = entry; });
      if (Object.keys(settings).length) config.person_settings = settings;
      this._config = config;
      this._render();
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
    }
  }

  if (!customElements.get('whereabouts-card-editor')) customElements.define('whereabouts-card-editor', WhereaboutsCardEditor);
}
