// Whereabouts – "Location history" card: the stays of a day as route or table.
// Data only through the integration's WebSocket API (checked per user).

export const HISTORY_DEFAULTS = {
  title: '',
  persons: [],
  default_view: 'map', // map | table
  show_legend: true,
  show_export: true,
  refresh_interval: 120,
};

const CHECK = '<div class="checkbox"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"></polyline></svg></div>';
const BIN = '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12M8 9h8v10H8V9m7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg>';

export function defineHistoryCard(S) {
  class WhereaboutsHistoryCard extends HTMLElement {
    static getConfigElement() {
      const el = document.createElement('whereabouts-card-editor');
      el.kind = 'history';
      return el;
    }

    static getStubConfig() {
      return { type: 'custom:whereabouts-history-card' };
    }

    constructor() {
      super();
      this._person = 'all';
      this._date = this._todayStr();
      this._points = [];
      this._map = null;
      this._tiles = [];
      this._routeLayer = null;
      this._markerLayer = null;
      this._legend = null;
      this._selectMode = false;
      this._selected = new Set();
      this._loadNo = 0;
      this._staleView = false;
      this._dark = null;
      this._signature = '';
      this._keyHandler = (e) => this._key(e);
    }

    setConfig(config) {
      this._config = { ...S.DEFAULTS_MAP, ...HISTORY_DEFAULTS, ...(config || {}) };
      this._tableView = this._config.default_view === 'table';
      if (this._info) { this._infoSig = null; this._onInfo(this._info); }
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._started) {
        this._started = true;
        this._start();
        return;
      }
      const dark = S.isDark(hass, this._config.map_style);
      if (this._map && dark !== this._dark) this._setTiles(dark);
    }

    connectedCallback() {
      if (this._config && this._ready) S.applyHeight(this, this._config);
      if (this._ready) this._startBackground();
    }

    disconnectedCallback() {
      this._stopBackground();
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 'full', rows: 8, min_rows: 4 };
    }

    // --- start ----------------------------------------------------------------
    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      S.subscribeInfo(this._hass, (info) => this._onInfo(info));
    }

    // Called at the start and whenever the integration's options change.
    _onInfo(info) {
      const sig = JSON.stringify([info.available, info.history_card, info.persons]);
      if (sig === this._infoSig) return;
      this._infoSig = sig;
      this._info = info;
      this._teardown();
      if (!info.available) { this.innerHTML = S.messageHtml(this._t('not_set_up')); return; }
      if (!info.history_card) { this.innerHTML = S.messageHtml(this._t('card_off')); return; }
      const allowed = info.persons || [];
      const wanted = this._config.persons || [];
      const chosen = wanted.length ? wanted.map((id) => allowed.find((p) => p.entity_id === id)).filter(Boolean) : allowed;
      this._persons = chosen.map((p) => ({
        id: p.entity_id,
        key: p.entity_id.replace(/[^a-z0-9_]/gi, '_'),
        name: S.personName(this._hass, this._config, p.entity_id),
        color: S.safeColor(S.personColor(this._hass, this._config, p.entity_id), S.PALETTE[0]),
        canDelete: p.can_delete,
      }));
      if (!this._persons.length) { this.innerHTML = S.messageHtml(this._t('no_history_persons')); return; }
      if (!this._persons.some((p) => p.id === this._person)) this._person = this._persons.length === 1 ? this._persons[0].id : 'all';
      this._build();
      this._ready = true;
      this._startBackground();
    }

    _teardown() {
      this._stopBackground();
      if (this._map) this._map.remove();
      this._map = null;
      this._tiles = [];
      this._legend = null;
      this._routeLayer = null;
      this._markerLayer = null;
      this._ready = false;
      this.innerHTML = '';
    }

    _personById(id) {
      return this._persons.find((p) => p.id === id);
    }

    // --- background: resize, auto refresh, keyboard --------------------------------
    _startBackground() {
      this._stopBackground();
      const map = this.querySelector('.wa-map');
      if (map && window.ResizeObserver) {
        this._resizeObserver = new ResizeObserver(() => { if (this._map) this._map.invalidateSize(); });
        this._resizeObserver.observe(map);
        this._barObserver = new ResizeObserver(() => this._layout());
        this._barObserver.observe(this.querySelector('.controls'));
      }
      const seconds = Math.max(30, Number(this._config.refresh_interval) || 120);
      this._timer = setInterval(() => this._autoRefresh(), seconds * 1000);
      document.addEventListener('keydown', this._keyHandler);
    }

    _stopBackground() {
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
      if (this._barObserver) { this._barObserver.disconnect(); this._barObserver = null; }
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      document.removeEventListener('keydown', this._keyHandler);
    }

    _autoRefresh() {
      // Only today, visible, and when the user is not in the middle of something.
      if (this._date !== this._todayStr()) return;
      if (document.hidden || !this.isConnected) return;
      if (this._selectMode) return;
      if (this._map && this._map._popup && this._map.hasLayer(this._map._popup)) return;
      this._load({ fit: false, onlyIfChanged: true });
    }

    _key(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!this.isConnected || !this.offsetParent) return;
      const path = e.composedPath();
      const target = path[0];
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (path.some((el) => el.classList && el.classList.contains('leaflet-container'))) return;
      const button = this.querySelector(e.key === 'ArrowLeft' ? '.prevDay' : '.nextDay');
      if (!button || button.disabled) return;
      e.preventDefault();
      button.click();
    }

    // --- dates (local dates, never UTC) -----------------------------------------------
    _todayStr() {
      return this._dateStr(new Date());
    }

    _dateStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _shift(delta) {
      const [y, m, d] = this._date.split('-').map(Number);
      return this._dateStr(new Date(y, m - 1, d + delta));
    }

    // Every change of date: empty, invalid or future dates jump to today.
    _setDate(value) {
      const today = this._todayStr();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value > today) value = today;
      this._date = value;
      this._updateDateControls();
      this._selected.clear();
      this._load({ fit: true });
    }

    _updateDateControls() {
      const today = this._todayStr();
      const field = this.querySelector('.datum');
      field.max = today;
      field.value = this._date;
      const isToday = this._date >= today;
      this.querySelector('.nextDay').disabled = isToday;
      this.querySelector('.today').disabled = isToday;
    }

    // --- texts ------------------------------------------------------------------------
    _timeText(p) {
      const from = String(p.time || '').slice(0, 5);
      const to = String(p.end || '').slice(0, 5);
      return this._t('time', { time: to && to !== from ? `${from} – ${to}` : from });
    }

    _placeText(p) {
      const place = S.placeText(this._t, p.state);
      return p.state === 'not_home' && p.address ? `${place} – ${p.address}` : place;
    }

    _countText(n) {
      return n === 1 ? this._t('entry') : this._t('entries', { n });
    }

    // --- layout -----------------------------------------------------------------------
    _build() {
      const t = this._t;
      const c = this._config;
      this.style.display = 'block';
      S.applyHeight(this, c);
      const multi = this._persons.length > 1;
      const personCss = this._persons.map((p) => `
          .personWahl .p-${p.key} .farbpunkt { background: ${p.color}; }
          .personWahl .segment.p-${p.key}.aktiv { background: ${p.color}; color: #fff; }
          .leaflet-popup.popup-${p.key} .leaflet-popup-content-wrapper { box-shadow: inset 4px 0 0 ${p.color}, 0 3px 14px rgba(0,0,0,0.3); }`).join('');
      const gradient = this._persons.map((p) => p.color).join(', ');
      const esc = S.escapeHtml;
      this.innerHTML = `
        ${S.leafletCss()}
        <ha-card class="wa-history" style="height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
          <style>${S.scopeCss(`
            ${S.MAP_CSS}
            .wa-titel { padding: 12px 14px 0; font-size: 1.1em; font-weight: 600; }
            .controls { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; padding: 10px 14px;
                        border-bottom: 1px solid var(--divider-color); flex-wrap: wrap; }
            .zone { display: flex; align-items: center; gap: 8px; flex: 1 1 0; min-width: max-content; }
            .zone.mitte { justify-content: center; }
            .zone.rechts { justify-content: flex-end; flex-wrap: wrap; }
            .aktionen { display: flex; gap: 8px; align-items: center; }
            .controls.zeilen-3 .zone { min-width: 0; flex: 0 0 100%; justify-content: center; flex-wrap: wrap; }
            .controls input[type="date"] { font-family: inherit; font-size: 15px; padding: 7px 10px; border: 1px solid var(--divider-color);
                                            border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); }
            .segmented { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 8px; overflow: hidden; }
            .segmented .segment { font-family: inherit; font-size: 15px; padding: 8px 14px; border: none; border-right: 1px solid var(--divider-color);
                                  background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer;
                                  display: inline-flex; align-items: center; gap: 6px; }
            .segmented .segment:last-child { border-right: none; }
            .segmented .segment:hover { background: var(--secondary-background-color); }
            .personWahl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .personWahl .farbpunkt { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
            .personWahl .p-all .farbpunkt { background: conic-gradient(${gradient}); }
            .personWahl .segment.aktiv .farbpunkt { display: none; }
            .personWahl .segment.p-all.aktiv { background: linear-gradient(90deg, ${gradient}); color: #fff; }
            ${personCss}
            .controls button { font-family: inherit; font-size: 15px; padding: 8px 14px; border: 1px solid var(--divider-color);
                               border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
            .controls button:hover:not(:disabled) { background: var(--secondary-background-color); }
            .controls button:disabled { opacity: 0.4; cursor: default; }
            .controls button.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .controls button.icon { padding: 8px 12px; font-size: 18px; line-height: 1; }
            .controls .segmented .segment { border: none; border-right: 1px solid var(--divider-color); border-radius: 0; }
            .controls .segmented .segment:last-child { border-right: none; }
            .auswahl { display: none; flex: 0 0 auto; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--divider-color); }
            .auswahl.aktiv { display: flex; }
            .auswahl span { font-size: 14px; color: var(--primary-text-color); margin-right: auto; }
            .auswahl button { font-family: inherit; font-size: 14px; padding: 7px 12px; border: 1px solid var(--divider-color);
                              border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
            .auswahl button:disabled { opacity: 0.5; cursor: default; }
            .auswahl button.loeschen, .popup button.loeschen { color: var(--error-color, #db4437); border: 1px solid var(--error-color, #db4437); }
            .auswahl button.loeschen:hover:not(:disabled), .popup button.loeschen:hover:not(:disabled) { background: var(--error-color, #db4437); color: #fff; }
            .popup { display: flex; align-items: center; gap: 8px; font-size: 14px; }
            .popup .marke { white-space: nowrap; flex: 0 0 auto; color: #fff; font-size: 12px; font-weight: 600; padding: 2px 7px; border-radius: 8px; }
            .popup .text { min-width: 160px; max-width: 280px; }
            .popup button.loeschen { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;
                                     padding: 0; border-radius: 6px; background: transparent; cursor: pointer; flex: 0 0 auto; }
            .popup button.loeschen svg { width: 20px; height: 20px; fill: var(--error-color, #db4437); }
            .popup button.loeschen:hover:not(:disabled) svg { fill: #fff; }
            .popup button.loeschen:disabled { opacity: 0.5; cursor: default; }
            .legende { background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); padding: 8px 12px;
                       border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); font-size: 14px; line-height: 1.6; }
            .legende .eintrag { display: flex; align-items: center; gap: 6px; }
            .legende .linie { display: inline-block; width: 22px; height: 5px; border-radius: 2px; }
            .legende .hinweis { color: var(--secondary-text-color, #666); }
            .legende .abstand { width: 4px; }
            .routenSymbol { background: none; border: none; }
            .routenSymbol svg { display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45)); cursor: pointer; }
            .wa-map { flex: 1 1 auto; min-height: 300px; width: 100%; position: relative; overflow: hidden; }
            .tabelle { display: none; flex: 1 1 auto; overflow: auto; padding: 0 14px 14px; box-sizing: border-box; }
            .tabelle table { width: 100%; border-collapse: collapse; font-size: 15px; }
            .tabelle th, .tabelle td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--divider-color); }
            .tabelle th { position: sticky; top: 0; background: var(--card-background-color); z-index: 1; }
            .tabelle .wahl { width: 22px; padding-right: 0; }
            .tabelle tbody tr { user-select: none; -webkit-user-select: none; }
            .tabelle tr.waehlbar { cursor: pointer; }
            .tabelle tbody td { background: var(--zeile-bg); }
            .tabelle tbody td:first-child { box-shadow: inset 3px 0 0 var(--zeile-farbe); }
            .tabelle tr.waehlbar:hover td { background: var(--zeile-hover); }
            .tabelle tr.gewaehlt td, .tabelle tr.gewaehlt:hover td { background: var(--zeile-sel); }
            .tabelle .punkt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
            .tabelle .checkbox { width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid var(--secondary-text-color);
                                 display: flex; align-items: center; justify-content: center; }
            .tabelle tr.gewaehlt .checkbox { background: var(--primary-color); border-color: var(--primary-color); }
            .tabelle .checkbox svg { width: 12px; height: 12px; fill: none; stroke: #fff; stroke-width: 3; display: none; }
            .tabelle tr.gewaehlt .checkbox svg { display: block; }
            .leer { padding: 30px; text-align: center; color: var(--secondary-text-color); font-size: 14px; }
            .statusbar { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; text-align: center; font-size: 13px;
                         color: var(--secondary-text-color); padding: 8px 14px; line-height: 1.6; border-top: 1px solid var(--divider-color); }
            .statusbar.fehler .status { color: var(--error-color, #db4437); }
            .statusbar .export { display: inline-flex; gap: 6px; }
            .statusbar .export button { font: inherit; font-size: 12px; padding: 3px 8px; border: 1px solid var(--divider-color);
                                        border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
            .statusbar .export button:hover { background: var(--secondary-background-color); }
`, '.wa-history')}</style>
          ${c.title ? `<div class="wa-titel">${esc(c.title)}</div>` : ''}
          <div class="controls">
            <div class="zone links">
              <div class="personWahl">
                ${multi ? `<div class="segmented"><button class="segment p-all${this._person === 'all' ? ' aktiv' : ''}" data-wert="all"><span class="farbpunkt"></span>${esc(t('all'))}</button></div>` : ''}
                <div class="segmented">
                  ${this._persons.map((p) => `<button class="segment p-${p.key}${this._person === p.id ? ' aktiv' : ''}" data-wert="${esc(p.id)}"><span class="farbpunkt"></span>${esc(p.name)}</button>`).join('')}
                </div>
              </div>
            </div>
            <div class="zone mitte">
              <button class="prevDay" title="${esc(t('prev_day'))}" aria-label="${esc(t('prev_day'))}">&larr;</button>
              <input type="date" class="datum" aria-label="${esc(t('date'))}">
              <button class="nextDay" title="${esc(t('next_day'))}" aria-label="${esc(t('next_day'))}">&rarr;</button>
              <button class="today">${esc(t('today'))}</button>
            </div>
            <div class="zone rechts">
              <div class="aktionen">
                <button class="auswahlBtn" style="display:none;">${esc(t('multi_select'))}</button>
                <button class="ansicht"></button>
                <button class="refresh icon" title="${esc(t('refresh'))}" aria-label="${esc(t('refresh'))}">&#x21bb;</button>
              </div>
            </div>
          </div>
          <div class="auswahl">
            <span class="anzahl"></span>
            <button class="alleBtn">${esc(t('select_all'))}</button>
            <button class="loeschenBtn loeschen" disabled>${esc(t('delete'))}</button>
          </div>
          <div class="wa-map"></div>
          <div class="tabelle"></div>
          <div class="leer" style="display:none;"></div>
          <div class="statusbar"><span class="status"></span>
            ${c.show_export ? `<span class="export"><button data-format="csv">${esc(t('export_csv'))}</button><button data-format="gpx">${esc(t('export_gpx'))}</button></span>` : ''}
          </div>
        </ha-card>`;

      this._updateDateControls();
      this.querySelectorAll('.personWahl .segment').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.wert === this._person) return;
          this._person = button.dataset.wert;
          this.querySelectorAll('.personWahl .segment').forEach((b) => b.classList.toggle('aktiv', b === button));
          this._selected.clear();
          this._load({ fit: true });
        });
      });
      const field = this.querySelector('.datum');
      // Typing reports every digit (e.g. year "0002"): wait a moment and ignore unfinished years.
      field.addEventListener('change', (e) => {
        clearTimeout(this._dateTimer);
        const value = e.target.value;
        if (value && Number(value.slice(0, 4)) < 2000) return;
        this._dateTimer = setTimeout(() => this._setDate(value), 400);
      });
      field.addEventListener('blur', (e) => {
        clearTimeout(this._dateTimer);
        const value = e.target.value;
        const unfinished = value && Number(value.slice(0, 4)) < 2000;
        if (unfinished || value !== this._date) this._setDate(unfinished ? '' : value);
      });
      this.querySelector('.today').addEventListener('click', () => this._setDate(this._todayStr()));
      this.querySelector('.prevDay').addEventListener('click', () => this._setDate(this._shift(-1)));
      this.querySelector('.nextDay').addEventListener('click', () => this._setDate(this._shift(1)));
      this.querySelector('.ansicht').addEventListener('click', () => {
        this._tableView = !this._tableView;
        if (!this._tableView && this._selectMode) this._setSelectMode(false);
        this._updateView();
      });
      this.querySelector('.refresh').addEventListener('click', () => this._load({ fit: false }));
      this.querySelector('.auswahlBtn').addEventListener('click', () => this._setSelectMode(!this._selectMode));
      this.querySelector('.alleBtn').addEventListener('click', () => this._selectAll());
      this.querySelector('.loeschenBtn').addEventListener('click', () => this._delete([...this._selected], this.querySelector('.loeschenBtn')));
      this.querySelectorAll('.export button').forEach((b) => b.addEventListener('click', () => this._export(b.dataset.format)));
      this._initMap();
    }

    async _initMap() {
      try {
        await S.loadLeaflet();
        await S.waitForCss(this);
        const home = this._hass.config || {};
        this._map = window.L.map(this.querySelector('.wa-map')).setView([home.latitude || 0, home.longitude || 0], 14);
        this._setTiles(S.isDark(this._hass, this._config.map_style));
      } catch (err) {
        // Without a map the table still works.
        console.error('Whereabouts: map could not be loaded', err);
        this._mapError = true;
        this._tableView = true;
      }
      this._load({ fit: true });
    }

    _setTiles(dark) {
      this._dark = dark;
      this._tiles = S.setTiles(this._map, this._tiles, this._config, dark, this.querySelector('.wa-map'));
    }

    // --- data ---------------------------------------------------------------------------
    _selectedPersons() {
      return this._person === 'all' ? this._persons : this._persons.filter((p) => p.id === this._person);
    }

    // options.fit: zoom the map to the route (day/person changed); false = keep the view.
    // options.onlyIfChanged: do not redraw when the data is the same.
    async _load(options = {}) {
      const t = this._t;
      const fit = options.fit !== false;
      const number = ++this._loadNo;
      const bar = this.querySelector('.statusbar');
      const status = this.querySelector('.status');
      this._updateDateControls(); // the page may have been open over midnight
      if (!options.onlyIfChanged) {
        bar.classList.remove('fehler');
        status.textContent = t('loading');
      }
      const persons = this._selectedPersons();
      const day = this._date;
      // allSettled: if one person fails, the others are still shown.
      const results = await Promise.allSettled(persons.map((p) =>
        this._hass.callWS({ type: 'whereabouts/history', person: p.id, date: day })));
      if (number !== this._loadNo) return; // something newer was requested meanwhile

      const points = [];
      const failed = [];
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          failed.push(persons[i].name);
          console.error('Whereabouts: loading failed for', persons[i].id, result.reason);
          return;
        }
        (result.value.stays || []).forEach((s) => points.push({
          person: persons[i].id, time: s.start, end: s.end, state: s.state,
          lat: s.latitude, lon: s.longitude, address: s.address, times: s.times,
        }));
      });
      points.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.person.localeCompare(b.person)));

      const signature = `${day}|${points.map((p) => `${this._keyOf(p)}${p.end}${p.address}`).join(',')}`;
      if (options.onlyIfChanged && signature === this._signature && !failed.length) return;
      this._signature = signature;

      this._points = points;
      this._anchor = null;
      this._lastRange = null;
      const present = new Set(points.map((p) => this._keyOf(p)));
      this._selected.forEach((k) => { if (!present.has(k)) this._selected.delete(k); });

      let text;
      const range = () => {
        const end = points.reduce((max, p) => ((p.end || p.time) > max ? (p.end || p.time) : max), '');
        return ` — ${t('time', { time: t('range', { from: points[0].time.slice(0, 5), to: end.slice(0, 5) }) })}`;
      };
      if (!points.length) text = failed.length ? '' : t('no_data');
      else if (persons.length > 1) {
        text = persons.filter((p) => !failed.includes(p.name))
          .map((p) => `${p.name}: ${this._countText(points.filter((x) => x.person === p.id).length)}`).join(' · ') + range();
      } else text = this._countText(points.length) + range();
      this.querySelector('.leer').textContent = failed.length ? t('load_failed') : t('no_data');
      if (failed.length) text = (text ? `${text} · ` : '') + t('error_for', { names: failed.join(', ') });
      if (this._mapError) text += (text ? ' · ' : '') + t('map_unavailable');
      bar.classList.toggle('fehler', failed.length > 0);
      status.textContent = text;

      this._updateView();
      this._updateSelection();
      this._drawMap(fit);
    }

    // Unique key (with "All" the same time can occur for several persons).
    _keyOf(p) {
      return `${p.person}|${p.time}`;
    }

    async _export(format) {
      const persons = this._selectedPersons();
      for (const p of persons) {
        const url = `/api/whereabouts/export?person=${encodeURIComponent(p.id)}&from=${this._date}&to=${this._date}&format=${format}`;
        try {
          const response = await this._hass.fetchWithAuth(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `whereabouts_${p.id.split('.')[1]}_${this._date}.${format}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 10000);
        } catch (err) {
          console.error('Whereabouts: export failed', err);
        }
      }
    }

    // --- map --------------------------------------------------------------------------
    _mapVisible() {
      const map = this.querySelector('.wa-map');
      return map.offsetWidth > 0 && map.offsetHeight > 0;
    }

    _drawMap(fit) {
      if (!this._map) return;
      this._map.closePopup();
      if (this._routeLayer) { this._map.removeLayer(this._routeLayer); this._routeLayer = null; }
      if (this._markerLayer) { this._map.removeLayer(this._markerLayer); this._markerLayer = null; }
      this._showLegend();
      if (!this._points.length) return;

      const L = window.L;
      this._routeLayer = L.featureGroup();
      this._markerLayer = L.layerGroup();
      // Each person in its colour: line and small points; start = white circle with ▶, end = coloured circle with flag.
      this._persons.forEach((person) => {
        const own = this._points.filter((p) => p.person === person.id);
        if (!own.length) return;
        L.polyline(own.map((p) => [p.lat, p.lon]), { color: person.color, weight: 4, opacity: 0.8 }).addTo(this._routeLayer);
        own.forEach((p, i) => {
          const isStart = i === 0 && own.length > 1;
          const isEnd = i === own.length - 1;
          let marker;
          if (isStart || isEnd) {
            marker = L.marker([p.lat, p.lon], {
              icon: L.divIcon({
                className: 'routenSymbol', html: this._symbol(isEnd ? 'end' : 'start', person.color, 32),
                iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -15],
              }),
              zIndexOffset: isEnd ? 1000 : 500,
              title: `${this._t(isEnd ? 'end' : 'start')} ${person.name}`,
            });
          } else {
            marker = L.circleMarker([p.lat, p.lon], { radius: 5, color: person.color, weight: 1, fillColor: person.color, fillOpacity: 0.6 });
          }
          marker.bindPopup(() => this._popup(p), { className: `popup-${person.key}` });
          this._markerLayer.addLayer(marker);
        });
      });
      this._routeLayer.addTo(this._map);
      this._markerLayer.addTo(this._map);
      if (fit) {
        if (this._mapVisible()) this._fit();
        else this._staleView = true; // hidden (table): fit as soon as the map is shown
      }
    }

    _symbol(kind, color, size) {
      const circle = kind === 'end'
        ? `<circle cx="12" cy="12" r="10.5" fill="${color}" stroke="#fff" stroke-width="2"/>`
        : `<circle cx="12" cy="12" r="10" fill="#fff" stroke="${color}" stroke-width="3"/>`;
      const sign = kind === 'end'
        ? '<path d="M8.5 6.5v11" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M9.3 6.8h7.2l-1.9 2.6 1.9 2.6H9.3z" fill="#fff"/>'
        : `<path d="M10 7.6v8.8l7-4.4z" fill="${color}"/>`;
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${circle}${sign}</svg>`;
    }

    _fit() {
      this._staleView = false;
      if (!this._map || !this._routeLayer) return;
      this._map.invalidateSize();
      const legend = this.querySelector('.legende');
      const legendHeight = legend ? legend.getBoundingClientRect().height + 10 : 0;
      this._map.fitBounds(this._routeLayer.getBounds(), {
        paddingTopLeft: [30, 30], paddingBottomRight: [30, Math.max(30, legendHeight + 20)], maxZoom: 17,
      });
    }

    _showLegend() {
      if (!this._map) return;
      if (this._legend) { this._map.removeControl(this._legend); this._legend = null; }
      if (!this._config.show_legend) return;
      const legend = window.L.control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = window.L.DomUtil.create('div', 'legende');
        div.innerHTML = this._selectedPersons().map((p) =>
          `<div class="eintrag"><span class="linie" style="background:${p.color}"></span>${S.escapeHtml(p.name)}</div>`).join('')
          + `<div class="eintrag hinweis">${this._symbol('start', '#666', 18)}${S.escapeHtml(this._t('start'))}`
          + `<span class="abstand"></span>${this._symbol('end', '#666', 18)}${S.escapeHtml(this._t('end'))}</div>`;
        return div;
      };
      legend.addTo(this._map);
      this._legend = legend;
    }

    _popup(p) {
      const person = this._personById(p.person);
      const box = document.createElement('div');
      box.className = 'popup';
      const name = document.createElement('span');
      name.className = 'marke';
      name.style.background = person.color;
      name.textContent = person.name;
      box.appendChild(name);
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = `${this._timeText(p)} — ${this._placeText(p)}`;
      box.appendChild(text);
      if (person.canDelete) {
        const button = document.createElement('button');
        button.className = 'loeschen';
        button.title = this._t('delete_entry');
        button.setAttribute('aria-label', this._t('delete_entry'));
        button.innerHTML = BIN;
        button.addEventListener('click', (e) => { e.stopPropagation(); this._delete([this._keyOf(p)], button); });
        box.appendChild(button);
      }
      return box;
    }

    // --- table --------------------------------------------------------------------------
    _renderTable() {
      const t = this._t;
      const box = this.querySelector('.tabelle');
      if (!this._points.length) {
        box.innerHTML = `<p style="color:var(--secondary-text-color);font-size:14px;padding:14px;">${S.escapeHtml(t('no_data'))}</p>`;
        return;
      }
      const withPerson = this._person === 'all';
      const rowStyle = (c) => `--zeile-bg:${c}14;--zeile-hover:${c}29;--zeile-sel:${c}47;--zeile-farbe:${c}`;
      let html = '<table><thead><tr>';
      if (this._selectMode) html += '<th class="wahl"></th>';
      html += `<th>${S.escapeHtml(t('col_time'))}</th>`;
      if (withPerson) html += `<th>${S.escapeHtml(t('col_person'))}</th>`;
      html += `<th>${S.escapeHtml(t('col_place'))}</th><th>${S.escapeHtml(t('col_lat'))}</th><th>${S.escapeHtml(t('col_lon'))}</th></tr></thead><tbody>`;
      this._points.forEach((p, i) => {
        const person = this._personById(p.person);
        const key = this._keyOf(p);
        const classes = [];
        if (this._selectMode && person.canDelete) classes.push('waehlbar');
        if (this._selectMode && this._selected.has(key)) classes.push('gewaehlt');
        html += `<tr data-key="${S.escapeHtml(key)}" data-index="${i}" class="${classes.join(' ')}" style="${rowStyle(person.color)}">`;
        if (this._selectMode) html += `<td class="wahl">${CHECK}</td>`;
        html += `<td>${S.escapeHtml(this._timeText(p))}</td>`;
        if (withPerson) html += `<td><span class="punkt" style="background:${person.color}"></span>${S.escapeHtml(person.name)}</td>`;
        html += `<td>${S.escapeHtml(this._placeText(p))}</td><td>${Number(p.lat).toFixed(6)}</td><td>${Number(p.lon).toFixed(6)}</td></tr>`;
      });
      box.innerHTML = `${html}</tbody></table>`;
      box.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('mousedown', (e) => { if (e.shiftKey) e.preventDefault(); });
        tr.addEventListener('click', (e) => this._rowClick(e, tr));
        // macOS: Ctrl+click opens the context menu instead of "click".
        tr.addEventListener('contextmenu', (e) => { if (!e.ctrlKey) return; e.preventDefault(); this._rowClick(e, tr); });
      });
    }

    // Click: toggle (in select mode, also on phones); Ctrl/Cmd: single; Shift: range (like Finder).
    _rowClick(e, row) {
      if (!this._persons.some((p) => p.canDelete)) return;
      const index = Number(row.dataset.index);
      const key = row.dataset.key;
      const own = this._points[index] && this._personById(this._points[index].person);
      if (!own || !own.canDelete) return; // only entries the user may delete can be selected
      const single = e.ctrlKey || e.metaKey;
      const range = e.shiftKey;
      if (!this._selectMode) {
        if (!single && !range) return;
        this._selectMode = true;
        this.querySelector('.auswahlBtn').classList.add('aktiv');
        this.querySelector('.auswahl').classList.add('aktiv');
      }
      if (range && this._anchor != null && this._points[this._anchor]) {
        const from = Math.min(this._anchor, index);
        const to = Math.max(this._anchor, index);
        for (let i = from; i <= to; i++) {
          if (this._personById(this._points[i].person).canDelete) this._selected.add(this._keyOf(this._points[i]));
        }
        if (this._lastRange) {
          this._lastRange.forEach((k) => {
            const idx = this._points.findIndex((p) => this._keyOf(p) === k);
            if (idx < from || idx > to) this._selected.delete(k);
          });
        }
        this._lastRange = this._points.slice(from, to + 1).map((p) => this._keyOf(p));
      } else {
        if (this._selected.has(key)) this._selected.delete(key);
        else this._selected.add(key);
        this._anchor = index;
        this._lastRange = null;
      }
      this._renderTable();
      this._updateSelection();
    }

    _updateSelection() {
      const n = this._selected.size;
      this.querySelector('.anzahl').textContent = this._t('selected', { n });
      this.querySelector('.loeschenBtn').disabled = n === 0;
    }

    _setSelectMode(on) {
      this._selectMode = on;
      this._anchor = null;
      this._lastRange = null;
      if (!on) this._selected.clear();
      this.querySelector('.auswahlBtn').classList.toggle('aktiv', on);
      this.querySelector('.auswahl').classList.toggle('aktiv', on);
      if (this._tableView) this._renderTable();
      this._updateSelection();
    }

    _selectAll() {
      const all = this._points.filter((p) => this._personById(p.person).canDelete).map((p) => this._keyOf(p));
      const allSelected = all.length > 0 && all.every((k) => this._selected.has(k));
      if (allSelected) this._selected.clear();
      else all.forEach((k) => this._selected.add(k));
      this._renderTable();
      this._updateSelection();
    }

    // --- delete ---------------------------------------------------------------------------
    // keys: "person|HH:MM:SS" (start of the stay). A stay can consist of several rows (times).
    async _delete(keys, button) {
      const t = this._t;
      if (!keys.length) return;
      const day = this._date; // keep: the user may change the day meanwhile
      const byKey = new Map(this._points.map((p) => [this._keyOf(p), p]));
      // eslint-disable-next-line no-alert
      if (!confirm(keys.length === 1 ? t('confirm_delete_one') : t('confirm_delete_many', { n: keys.length }))) return;
      const original = button ? button.innerHTML : '';
      if (button) { button.disabled = true; if (!button.querySelector('svg')) button.textContent = t('deleting'); }
      try {
        const perPerson = {};
        keys.forEach((k) => {
          const [person, time] = [k.slice(0, k.lastIndexOf('|')), k.slice(k.lastIndexOf('|') + 1)];
          const p = byKey.get(k);
          const times = p && Array.isArray(p.times) && p.times.length ? p.times : [time];
          (perPerson[person] = perPerson[person] || []).push(...times);
        });
        for (const person of Object.keys(perPerson)) {
          if (!this._personById(person) || !this._personById(person).canDelete) continue;
          await this._hass.callWS({ type: 'whereabouts/delete', person, date: day, times: perPerson[person] });
        }
      } catch (err) {
        console.error('Whereabouts: deleting failed', err);
        // eslint-disable-next-line no-alert
        alert(t('delete_failed', { error: (err && (err.message || err.code)) || err }));
        if (button) { button.innerHTML = original; button.disabled = false; }
        return;
      }
      if (button) button.innerHTML = original;
      if (this._map) this._map.closePopup();
      if (this._selectMode) this._setSelectMode(false);
      await this._load({ fit: false });
    }

    // --- layout of the control bar: one line or three centred lines ---------------------------
    _layout() {
      const bar = this.querySelector('.controls');
      if (!bar || !bar.clientWidth) return;
      const width = (children) => {
        const visible = [...children].filter((el) => el.offsetParent !== null);
        return visible.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + Math.max(0, visible.length - 1) * 8;
      };
      const style = getComputedStyle(bar);
      const space = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const names = this.querySelector('.personWahl').getBoundingClientRect().width;
      const date = width(this.querySelector('.zone.mitte').children);
      const actions = width(this.querySelector('.aktionen').children);
      bar.classList.toggle('zeilen-3', names + date + actions + 16 + 24 > space);
    }

    // --- map / table --------------------------------------------------------------------------
    _updateView() {
      const t = this._t;
      const map = this.querySelector('.wa-map');
      const table = this.querySelector('.tabelle');
      const empty = this.querySelector('.leer');
      const button = this.querySelector('.ansicht');
      const selectButton = this.querySelector('.auswahlBtn');
      const none = this._points.length === 0;
      empty.style.display = none ? 'block' : 'none';
      button.style.display = this._mapError ? 'none' : '';
      const canSelect = this._persons.some((p) => p.canDelete);
      if (this._tableView) {
        map.style.display = 'none';
        table.style.display = 'flex';
        table.style.flexDirection = 'column';
        button.textContent = t('show_map');
        button.classList.add('aktiv');
        selectButton.style.display = canSelect ? '' : 'none';
        this._renderTable();
      } else {
        map.style.display = none ? 'none' : 'block';
        table.style.display = 'none';
        button.textContent = t('show_table');
        button.classList.remove('aktiv');
        selectButton.style.display = 'none';
        if (this._map && !none) {
          setTimeout(() => { if (this._staleView) this._fit(); else this._map.invalidateSize(); }, 0);
        }
      }
      this._layout();
    }
  }

  if (!customElements.get('whereabouts-history-card')) customElements.define('whereabouts-history-card', WhereaboutsHistoryCard);
}
