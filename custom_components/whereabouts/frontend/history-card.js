// Whereabouts – "Location history" card: the stays of a day or a period as
// route, heatmap or table. Data only through the integration's WebSocket API
// (checked per user).

export const HISTORY_DEFAULTS = {
  title: '',
  persons: [],
  default_view: 'map', // map (route) | heat | table
  start_period: 'today', // today | 3d | 7d | 4w
  simplify_points: 400, // points hidden from this many entries on (0 = always shown)
  show_legend: true,
  show_export: true,
  auto_refresh: true,
  refresh_interval: 30,
};

const CHECK = '<div class="checkbox"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"></polyline></svg></div>';
const BIN = '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12M8 9h8v10H8V9m7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3m0 8a5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5 5 5 0 0 1-5 5m0-12.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5Z"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"/></svg>';
const CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5Z"/></svg>';
const SEP = '<span class="trenner">·</span>'; // the same separator as in "Where is…?"
const LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3m-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"/></svg>';

export function defineHistoryCard(S, D) {
  const { openDownloadDialog, exportEntries, DOWNLOAD_ICON } = D;
  const pickerModule = import(`./datepicker.js${S.QUERY}`);
  const esc = (v) => S.escapeHtml(v);

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
      this._hidden = new Set(); // persons switched off with their button (not stored)
      this._date = this._todayStr(); // first day
      this._to = this._date; // last day
      this._unit = 'day'; // day | days | week | month | year (how the arrows move)
      this._mode = 'route'; // route | heat
      this._withHome = true; // heatmap: include home
      this._points = [];
      this._map = null;
      this._tiles = [];
      this._routeLayer = null;
      this._markerLayer = null;
      this._heatLayer = null;
      this._legend = null;
      this._selectMode = false;
      this._selected = new Set();
      this._loadNo = 0;
      this._staleView = false;
      this._dark = null;
      this._signature = '';
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._keyHandler = (e) => this._key(e);
    }

    setConfig(config) {
      this._raw = { ...(config || {}) };
      this._applyConfig();
      if (this._info) { this._infoSig = null; this._onInfo(this._info); }
    }

    _applyConfig() {
      this._config = S.cardConfig(HISTORY_DEFAULTS, this._info && this._info.settings, this._raw, 'history');
      // Zone switch in the legend while a card setting fixes it: only shown differently until leaving
      if (this._zonesShown !== undefined) this._config.show_zones = this._zonesShown;
      // Start view and period: at the start and whenever they are changed
      const start = `${this._config.default_view}|${this._config.start_period}`;
      if (start !== this._startSig) {
        this._startSig = start;
        this._applyStart(true);
      }
    }

    // Start view (route / heat map / table) and start period - also what "Today" returns to.
    _applyStart(withPeriod = true) {
      const view = this._config.default_view;
      this._tableView = view === 'table' && !this._mapError;
      this._mode = view === 'heat' ? 'heat' : 'route';
      this._withHome = true;
      if (withPeriod) {
        const [from, to] = this._startRange();
        this._date = from;
        this._to = to;
        this._unit = from === to ? 'day' : 'days';
      }
    }

    _startRange() {
      const today = this._todayStr();
      const back = { '3d': 2, '7d': 6, '4w': 27 }[this._config.start_period] || 0;
      const d = new Date();
      d.setDate(d.getDate() - back);
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return [from, today];
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
      if (this._map) this._drawZones();
    }

    connectedCallback() {
      if (this._config && this._ready) S.applyHeight(this, this._config);
      if (this._ready) {
        this._startBackground();
        this.activate();
      }
    }

    disconnectedCallback() {
      this._stopBackground();
    }

    // Back on this map (other tab, other dashboard): everybody visible again.
    activate() {
      if (!this._ready) return;
      if (this._hidden.size) {
        this._hidden.clear();
        this._afterPersons();
      }
      this._overview();
    }

    // Map back on everything shown - as soon as the map has its size again.
    _overview() {
      if (!this._map || this._tableView) { this._staleView = true; return; }
      S.whenSized(this.querySelector('.wa-map'), () => this._fit());
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
      // While the integration reloads it is briefly unavailable: keep the card.
      clearTimeout(this._gone);
      if (!info.available && this._info && this._info.available && !info.confirmed) {
        this._gone = setTimeout(() => this._onInfo({ ...info, confirmed: true }), 8000);
        return;
      }
      const sig = JSON.stringify([info.available, info.history_card, info.persons, { ...(info.settings || {}), zones_in: null },
        info.panel_shown, info.is_admin, info.locked_keys]);
      if (sig === this._infoSig) {
        // only the zones were switched (e.g. in the legend): no rebuild
        if (this._ready && info.settings && this._info && info.settings.zones_in !== (this._info.settings || {}).zones_in) {
          this._info = info;
          this._applyConfig();
          this._zoneSignature = '';
          if (this._map) { this._drawZones(); this._showLegend(); }
        }
        return;
      }
      this._infoSig = sig;
      this._info = info;
      this._applyConfig();
      this._teardown();
      if (!info.available) { this.innerHTML = S.messageHtml(this._t('not_set_up')); return; }
      if (!info.history_card) { this.innerHTML = S.messageHtml(this._t('card_off')); return; }
      const allowed = info.persons || [];
      const wanted = this._config.persons || [];
      const chosen = (wanted.length ? wanted.map((id) => allowed.find((p) => p.entity_id === id)).filter(Boolean) : allowed)
        .filter((p) => S.showsIn(this._config, p.entity_id, 'history'));
      this._persons = chosen.map((p) => ({
        id: p.entity_id,
        key: p.entity_id.replace(/[^a-z0-9_]/gi, '_'),
        name: S.personName(this._hass, this._config, p.entity_id),
        color: S.safeColor(S.personColor(this._hass, this._config, p.entity_id), S.PALETTE[0]),
        picture: S.personPicture(this._hass, this._config, p.entity_id),
        canDelete: p.can_delete,
      }));
      if (!this._persons.length) { this.innerHTML = S.messageHtml(this._t('no_history_persons')); return; }
      this._hidden.forEach((id) => { if (!this._personById(id)) this._hidden.delete(id); });
      this._build();
      this._ready = true;
      this._startBackground();
      this._loadDays();
    }

    _teardown() {
      this._stopBackground();
      if (this._map) this._map.remove();
      this._map = null;
      this._tiles = [];
      this._legend = null;
      this._overviewButton = null;
      this._routeLayer = null;
      this._markerLayer = null;
      this._endLayer = null;
      this._heatLayer = null;
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._ready = false;
      this.innerHTML = '';
    }

    _personById(id) {
      return this._persons.find((p) => p.id === id);
    }

    // Days with data (all persons): the others are greyed out in the date picker.
    async _loadDays() {
      const all = new Set();
      await Promise.all(this._persons.map(async (p) => {
        try {
          const result = await this._hass.callWS({ type: 'whereabouts/days', person: p.id });
          (result.days || []).forEach((d) => all.add(d));
        } catch (err) {
          // without the list, every day can be picked
        }
      }));
      all.add(this._todayStr());
      this._days = all;
      this._first = [...all].sort()[0];
      this._updateDateControls();
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
        const card = this.querySelector('.wa-history');
        if (card) this._barObserver.observe(card);
      }
      this._auto = this._config.auto_refresh !== false;
      this._interval = Math.max(10, Number(this._config.refresh_interval) || 30);
      this._rest = this._interval;
      this._renderCountdown();
      this._timer = setInterval(() => {
        if (!this._auto) { this._renderCountdown(); return; }
        this._rest -= 1;
        if (this._rest <= 0) { this._rest = this._interval; this._autoRefresh(); }
        this._renderCountdown();
      }, 1000);
      document.addEventListener('keydown', this._keyHandler);
    }

    _stopBackground() {
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
      if (this._barObserver) { this._barObserver.disconnect(); this._barObserver = null; }
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      document.removeEventListener('keydown', this._keyHandler);
    }

    _renderCountdown() {
      const t = this._t;
      const button = this.querySelector('.neuladen');
      const rest = this.querySelector('.statusbar .rest');
      if (!button || !rest) return;
      const auto = this._auto !== false;
      button.classList.toggle('ohne-ring', !auto);
      const ring = button.querySelector('.ring');
      const length = 2 * Math.PI * 15;
      ring.style.strokeDasharray = length.toFixed(2);
      ring.style.strokeDashoffset = (length * (1 - this._rest / this._interval)).toFixed(2);
      rest.textContent = auto ? t('reload_in', { n: this._rest })
        : (this._loadedAt ? t('data_as_of', { when: S.standText(this._hass, t, this._loadedAt) }) : '');
      // fixed width: the numbers counting down do not move anything
      rest.style.minWidth = auto ? `${t('reload_in', { n: this._interval }).length}ch` : '';
    }

    _autoRefresh() {
      // Only when visible, for periods reaching today, and the user is not in the middle of something.
      if (document.hidden || !this.isConnected || this._loading) return;
      if (this._to < this._todayStr()) return;
      if (this._selectMode) return;
      if (this._map && this._map._popup && this._map.hasLayer(this._map._popup)) return;
      this._load({ fit: false, onlyIfChanged: true });
    }

    _key(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!this.isConnected || !this.offsetParent || document.querySelector('.wa-dp, .wa-dl')) return;
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
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    _multiDay() {
      return this._to !== this._date;
    }

    async _setPeriod(from, to, unit) {
      const today = this._todayStr();
      if (to > today) to = today;
      if (from > to) from = to;
      this._date = from;
      this._to = to;
      this._unit = unit || (from === to ? 'day' : 'days');
      this._updateDateControls();
      this._rest = this._interval;
      this._renderCountdown();
      this._selected.clear();
      await this._load({ fit: true });
    }

    async _step(direction) {
      const P = await pickerModule;
      const unit = this._unit === 'day' ? 'days' : this._unit;
      const [from, to] = P.shiftRange(this._date, this._to, unit, direction, this._todayStr());
      this._setPeriod(from, to, this._unit);
    }

    // "Today": first only today; only today already → everything as after opening
    // the page (start view and start period).
    _today() {
      const today = this._todayStr();
      if (this._date === today && this._to === today) {
        this._hidden.clear();
        if (this._selectMode) this._setSelectMode(false);
        this._applyStart(false);
        this._updatePersonButtons();
        this._updateView();
        const [from, to] = this._startRange();
        this._setPeriod(from, to, from === to ? 'day' : 'days');
        return;
      }
      this._setPeriod(today, today, 'day');
    }

    async _pick() {
      const P = await pickerModule;
      const result = await P.openDatePicker({
        t: this._t, lang: S.language(this._hass), from: this._date, to: this._to, today: this._todayStr(),
        days: this._days, first: this._first,
      });
      if (result) this._setPeriod(result.from, result.to, result.from === result.to ? 'day' : result.unit);
    }

    async _updateDateControls() {
      const P = await pickerModule;
      this._P = P;
      if (!this.querySelector('.nextDay')) return;
      const today = this._todayStr();
      const label = this.querySelector('.datum .text');
      if (label) label.textContent = P.rangeText(S.language(this._hass), this._date, this._to, Boolean(this._narrow));
      const isToday = this._to >= today;
      this.querySelector('.nextDay').disabled = isToday;
      this.querySelector('.prevDay').disabled = Boolean(this._first && this._date <= this._first);
      this.querySelectorAll('.prevDay, .nextDay').forEach((b) => {
        const prev = b.classList.contains('prevDay');
        b.title = this._t(this._multiDay() ? (prev ? 'prev_range' : 'next_range') : (prev ? 'prev_day' : 'next_day'));
      });
      const modes = this.querySelector('.modus');
      if (modes) modes.hidden = this._tableView;
      this._layout();
    }

    _visiblePersons() {
      return this._persons.filter((p) => !this._hidden.has(p.id));
    }

    _visiblePoints() {
      return this._points.filter((p) => !this._hidden.has(p.person));
    }

    // --- texts ------------------------------------------------------------------------
    _timeText(p) {
      const from = String(p.time || '').slice(0, 5);
      const to = String(p.end || '').slice(0, 5);
      return this._t('time', { time: to && to !== from ? `${from} – ${to}` : from });
    }

    _minutes(p) {
      const minutes = (v) => { const [h, m] = String(v || '').split(':').map(Number); return h * 60 + m; };
      if (!p.end || !p.time) return 0;
      return Math.max(0, minutes(p.end) - minutes(p.time));
    }

    _durationText(p) {
      const n = this._minutes(p);
      if (!(n > 0)) return '';
      const h = Math.floor(n / 60);
      const m = n % 60;
      if (!h) return this._t('duration_m', { m });
      return m ? this._t('duration_hm', { h, m }) : this._t('duration_h', { h });
    }

    _dayText(value, weekday = true) {
      const [y, m, d] = value.split('-').map(Number);
      const options = { day: '2-digit', month: '2-digit' };
      if (weekday) options.weekday = 'short';
      if (y !== new Date().getFullYear()) options.year = 'numeric';
      return new Date(y, m - 1, d).toLocaleDateString(S.language(this._hass), options);
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
      const personCss = this._persons.map((p) => `
          .personWahl .person.p-${p.key} { --farbe: ${p.color}; }
          .statusbar .wer.p-${p.key} { color: ${S.readableColor(p.color, S.cardBackground(this._hass))}; }`).join('');
      this.innerHTML = `
        ${S.leafletCss()}
        <ha-card class="wa-history${c.height_mode === 'fill' ? ' flach' : ''}" style="height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;${c.height_mode === 'fill' ? ' border-radius: 0; border: none; box-shadow: none;' : ''}">
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
            .segmented { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 8px; overflow: hidden; }
            .segmented[hidden] { display: none; }
            .controls .segmented .segment { font-family: inherit; font-size: 15px; padding: 8px 14px; border: none; border-right: 1px solid var(--divider-color);
                                  border-radius: 0; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer;
                                  display: inline-flex; align-items: center; gap: 6px; }
            .controls .segmented .segment:last-child { border-right: none; }
            .controls .segmented .segment.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .personWahl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .controls .personWahl .person { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 20px;
                                            border: 2px solid var(--farbe); background: var(--card-background-color); color: var(--primary-text-color); }
            .controls .personWahl .person .bild { width: 28px; height: 28px; border-radius: 50%; background: var(--farbe) center/cover no-repeat;
                                                  color: #fff; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
            .controls .personWahl .person .auge { display: inline-flex; }
            .controls .personWahl .person svg { width: 18px; height: 18px; fill: var(--farbe); }
            .controls .personWahl .person.aus { border-color: var(--divider-color); color: var(--secondary-text-color); }
            .controls .personWahl .person.aus .bild { filter: grayscale(1); opacity: .5; }
            .controls .personWahl .person.aus svg { fill: var(--secondary-text-color); }
            .controls .personWahl .alle-ein { display: inline-flex; align-items: center; gap: 6px; color: var(--primary-color);
                                              border-color: transparent; padding: 6px 10px; }
            .controls .personWahl .alle-ein svg { width: 18px; height: 18px; fill: currentColor; }
            .controls .personWahl .alle-ein[hidden] { display: none; }
            .controls button { font-family: inherit; font-size: 15px; padding: 8px 14px; border: 1px solid var(--divider-color);
                               border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
            .controls button:hover:not(:disabled) { filter: brightness(.96); }
            .controls button:disabled { opacity: 0.4; cursor: default; }
            .controls button.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .controls .datum { display: inline-flex; align-items: center; gap: 8px; }
            .controls .datum svg { width: 20px; height: 20px; fill: var(--secondary-text-color); }
            .neuladen { flex: 0 0 auto; position: relative; width: 34px; height: 34px; padding: 0; border: none; border-radius: 50%;
                        background: transparent; color: var(--primary-text-color); cursor: pointer;
                        display: inline-flex; align-items: center; justify-content: center; }
            .neuladen:hover { background: rgba(127,127,127,.15); }
            .neuladen.ohne-ring svg.ringe { display: none; }
            .neuladen svg.ringe { position: absolute; inset: 0; width: 34px; height: 34px; }
            .neuladen .ring-hg { fill: none; stroke: rgba(127,127,127,.25); stroke-width: 2; }
            .neuladen .ring { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 2; stroke-linecap: round;
                              transform: rotate(-90deg); transform-origin: 17px 17px; transition: stroke-dashoffset 1s linear; }
            .neuladen .pfeil { width: 18px; height: 18px; }
            .neuladen.dreht .pfeil { animation: wa-drehen .6s ease-in-out; }
            @keyframes wa-drehen { to { transform: rotate(360deg); } }
            .auswahl { display: none; flex: 0 0 auto; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--divider-color); flex-wrap: wrap; }
            .auswahl.aktiv { display: flex; }
            .auswahl span { font-size: 14px; color: var(--primary-text-color); margin-right: auto; }
            .auswahl button { font-family: inherit; font-size: 14px; padding: 7px 12px; border: 1px solid var(--divider-color);
                              border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
            .auswahl button:disabled { opacity: 0.5; cursor: default; }
            .auswahl button.loeschen { color: var(--error-color, #db4437); border: 1px solid var(--error-color, #db4437); }
            .auswahl button.loeschen:hover:not(:disabled) { background: var(--error-color, #db4437); color: #fff; }
            .leaflet-popup.wa-eintrag .leaflet-popup-content-wrapper { border-radius: 14px; background: var(--card-background-color, #fff);
                                                                       color: var(--primary-text-color, #222); }
            .leaflet-popup.wa-eintrag .leaflet-popup-tip { background: var(--card-background-color, #fff); }
            .leaflet-popup.wa-eintrag .leaflet-popup-content { margin: 12px 14px 10px; width: auto !important; min-width: 220px; max-width: 300px; }
            .popup { font-size: 14px; line-height: 1.35; }
            .popup .kopf { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
            .popup .punkt { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
            .popup .name { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .popup .zu { flex: 0 0 auto; width: 28px; height: 28px; margin: -4px -6px -4px 0; padding: 0; border: none; border-radius: 50%;
                         background: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
            .popup .zu svg { width: 18px; height: 18px; fill: var(--secondary-text-color, #666); }
            .popup .zu:hover { background: rgba(127,127,127,.15); }
            .popup .ortzeile { display: flex; align-items: flex-start; gap: 6px; }
            .popup .ort { font-size: 17px; font-weight: 500; overflow-wrap: anywhere; }
            .popup .karte { flex: 0 0 auto; display: inline-flex; padding: 3px; border-radius: 6px; margin-top: 1px; }
            .popup .karte svg { width: 16px; height: 16px; fill: var(--primary-color, #03a9f4); }
            .popup .karte:hover { background: rgba(127,127,127,.15); }
            .popup .art { font-size: 13px; color: var(--secondary-text-color, #666); margin-top: 1px; }
            .popup .zeit { font-size: 13px; color: var(--secondary-text-color, #666); margin-top: 4px; font-variant-numeric: tabular-nums; }
            .popup button.loeschen { margin: 10px 0 0 -6px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px;
                                     border: none; border-radius: 8px; background: none; cursor: pointer; font: inherit; font-size: 14px;
                                     color: var(--error-color, #db4437); }
            .popup button.loeschen svg { width: 16px; height: 16px; fill: currentColor; }
            .popup button.loeschen:hover:not(:disabled) { background: rgba(219,68,55,.1); }
            .legende { background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); padding: 8px 12px;
                       border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.25); font-size: 14px; line-height: 1.6; }
            .legende .eintrag { display: flex; align-items: center; gap: 6px; }
            .legende .linie { display: inline-block; width: 22px; height: 5px; border-radius: 2px; }
            .legende .hinweis { color: var(--secondary-text-color, #666); }
            .legende .abstand { width: 4px; }
            .legende .verlauf { width: 160px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, blue, cyan, lime, yellow, red); }
            .legende .skala { display: flex; justify-content: space-between; font-size: 12px; color: var(--secondary-text-color, #666); }
            .legende label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; margin-top: 4px; }
            .legende .zonen { margin-top: 6px; padding-top: 4px; border-top: 1px solid var(--divider-color, rgba(0,0,0,.12)); }
            .legende .zonen.fest { cursor: default; opacity: .55; }
            .legende input { margin: 0; accent-color: var(--primary-color); }
            .wa-dark .legende { background: #2b2d30; color: #e8e8e8; }
            .wa-dark .legende .hinweis, .wa-dark .legende .skala { color: #b0b4b9; }
            .wa-dark .legende .zonen { border-top-color: rgba(255,255,255,.15); }
            .routenSymbol { background: none; border: none; }
            .routenSymbol svg { display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45)); cursor: pointer; }
            .wa-map { flex: 1 1 auto; min-height: 300px; width: 100%; position: relative; overflow: hidden; }
            /* Sidebar page: the map takes exactly what is left (landscape phone, low windows) */
            .wa-history.flach .wa-map { min-height: 0; }
            .wa-history.niedrig .legende { padding: 4px 8px; font-size: 12px; line-height: 1.4; }
            .wa-history.niedrig .legende .hinweis { display: none; }
            .wa-history.niedrig .statusbar { padding: 2px 8px; line-height: 1.3; }
            .wa-history.niedrig .controls { padding-top: 6px; padding-bottom: 6px; }
            .wa-map .punkte-hinweis { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 900; max-width: calc(100% - 120px);
                                      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 16px; border: none; cursor: pointer;
                                      font: inherit; font-size: 13px; background: var(--card-background-color, #fff); color: var(--primary-text-color);
                                      box-shadow: 0 2px 8px rgba(0,0,0,.25); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .wa-map .punkte-hinweis[hidden] { display: none; }
            .wa-map .punkte-hinweis svg { flex: 0 0 auto; width: 18px; height: 18px; fill: var(--primary-color); }
            .wa-map.wa-dark .punkte-hinweis { background: #2b2d30; color: #e8e8e8; }
            .wa-map .niemand-hinweis { position: absolute; inset: 0; z-index: 900; display: flex; align-items: center; justify-content: center; pointer-events: none; }
            .wa-map .niemand-hinweis span { background: var(--card-background-color, #fff); color: var(--primary-text-color); padding: 10px 16px;
                                            border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.25); font-size: 15px; }
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
            .niemand { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 30px; text-align: center;
                       color: var(--secondary-text-color); font-size: 15px; }
            .niemand[hidden] { display: none; }
            .statusbar { display: flex; align-items: center; gap: 8px; text-align: center; font-size: 13px;
                         color: var(--secondary-text-color); padding: 4px 8px; line-height: 1.6; border-top: 1px solid var(--divider-color); }
            .statusbar .infos { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
            .statusbar .rest { flex: 0 0 auto; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
            .statusbar .trenner { margin: 0 6px; opacity: .6; }
            /* Full height (dashboard): keep clear of rounded screen corners and the home bar */
            .wa-history.flach .statusbar { padding-left: max(8px, env(safe-area-inset-left)); padding-right: max(8px, env(safe-area-inset-right));
                                           padding-bottom: calc(4px + env(safe-area-inset-bottom)); }
            .statusbar.fehler .status { color: var(--error-color, #db4437); }
            .statusbar .wer { font-weight: 600; }
            .statusbar .export { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13px; font-weight: 500;
                                 padding: 5px 10px; border: none; border-radius: 16px; background: none; color: var(--primary-color); cursor: pointer; }
            .statusbar .export:hover { background: rgba(127,127,127,.12); }
            .statusbar .export svg { width: 18px; height: 18px; fill: currentColor; }
            .statusbar.eng .export .text { display: none; }
            /* Narrow: one line, only symbols left and right */
            .statusbar.schmal .rest, .statusbar.schmal .zeit, .statusbar.schmal .export .text { display: none; }
            .statusbar.schmal .infos { flex-wrap: nowrap; }
            .statusbar.schmal .status { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .controls .ic { display: none; --mdc-icon-size: 20px; }
            .controls.schmal { display: grid; grid-template-columns: auto auto; justify-content: center; gap: 8px; padding: 8px 10px; }
            .controls.schmal .zone { min-width: 0; flex: none; }
            .controls.schmal .zone.links { grid-column: 1 / -1; justify-content: center; }
            .controls.schmal.einzeilig { display: flex; flex-wrap: nowrap; justify-content: center; }
            .controls.schmal.einzeilig .zone { flex: 0 0 auto; }
            .controls.schmal .ic { display: inline-flex; }
            .controls.schmal .txt { display: none; }
            .controls.schmal button { height: 38px; box-sizing: border-box; padding: 0 10px; font-size: 14px; line-height: 1;
                                      display: inline-flex; align-items: center; justify-content: center; }
            .controls.schmal .segmented .segment { height: 36px; padding: 0 10px; }
            .controls.schmal .today { display: none; }
            .controls.schmal .zone.mitte .nextDay { border-radius: 0 8px 8px 0; }
            .controls.schmal .zone.mitte { gap: 0; }
            .controls.schmal .zone.mitte button { border-radius: 0; margin-left: -1px; }
            .controls.schmal .zone.mitte button:first-child { border-radius: 8px 0 0 8px; margin-left: 0; }
            .controls.schmal .zone.mitte button:last-child { border-radius: 0 8px 8px 0; }
            .controls.schmal .datum { gap: 5px; }
            .controls.schmal .datum svg { width: 17px; height: 17px; }
            .controls.schmal .personWahl { justify-content: center; flex-wrap: nowrap; }
            .controls.schmal.umbruch .personWahl { flex-wrap: wrap; }
            .controls.schmal .personWahl .person { height: auto; padding: 3px 8px 3px 3px; gap: 6px; }
            .controls.schmal.ohne-namen .personWahl .pname { display: none; }
            .controls.schmal .personWahl .alle-ein { padding: 6px; }
            .controls.schmal.ohne-auge .personWahl .auge { display: none; }
            .controls.schmal.ohne-auge .personWahl .person { padding: 3px; }
            .controls.schmal.ohne-auge .personWahl .person.aus { border-style: dashed; }
            ${personCss}
`, '.wa-history')}</style>
          ${c.title ? `<div class="wa-titel">${esc(c.title)}</div>` : ''}
          <div class="controls">
            <div class="zone links">
              <div class="personWahl">
                ${this._persons.map((p) => `<button class="person p-${p.key}" data-wert="${esc(p.id)}" type="button">
                  <span class="bild"></span><span class="pname">${esc(p.name)}</span><span class="auge"></span></button>`).join('')}
                <button class="alle-ein" type="button" title="${esc(t('show_all'))}" aria-label="${esc(t('show_all'))}" hidden>${EYE}<span class="txt">${esc(t('show_all'))}</span></button>
              </div>
            </div>
            <div class="zone mitte">
              <button class="prevDay" aria-label="${esc(t('prev_range'))}">&larr;</button>
              <button class="datum" type="button" aria-label="${esc(t('pick_period'))}">${CALENDAR}<span class="text"></span></button>
              <button class="nextDay" aria-label="${esc(t('next_range'))}">&rarr;</button>
              <button class="today" title="${esc(t('today'))}" aria-label="${esc(t('today'))}"><ha-icon class="ic" icon="mdi:calendar-today"></ha-icon><span class="txt">${esc(t('today'))}</span></button>
            </div>
            <div class="zone rechts">
              <div class="aktionen">
                <div class="segmented modus" hidden>
                  <button class="segment" data-modus="route" title="${esc(t('view_route'))}" aria-label="${esc(t('view_route'))}"><ha-icon class="ic" icon="mdi:map-marker-path"></ha-icon><span class="txt">${esc(t('view_route'))}</span></button>
                  <button class="segment" data-modus="heat" title="${esc(t('view_heat'))}" aria-label="${esc(t('view_heat'))}"><ha-icon class="ic" icon="mdi:fire"></ha-icon><span class="txt">${esc(t('view_heat'))}</span></button>
                </div>
                <button class="auswahlBtn" style="display:none;" title="${esc(t('select_entries'))}" aria-label="${esc(t('select_entries'))}"><ha-icon class="ic" icon="mdi:checkbox-multiple-marked-outline"></ha-icon><span class="txt">${esc(t('select_entries'))}</span></button>
                <button class="ansicht"></button>
              </div>
            </div>
          </div>
          <div class="auswahl">
            <span class="anzahl"></span>
            <button class="alleBtn">${esc(t('select_all'))}</button>
            <button class="exportCsv">${esc(t('export_selected', { format: 'CSV' }))}</button>
            <button class="exportGpx">${esc(t('export_selected', { format: 'GPX' }))}</button>
            <button class="loeschenBtn loeschen" disabled>${esc(t('delete'))}</button>
          </div>
          <div class="wa-map"><button class="punkte-hinweis" type="button" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5m-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14m.5-7H9v2H7v1h2v2h1v-2h2V9h-2V7Z"/></svg><span class="text"></span></button></div>
          <div class="tabelle"></div>
          <div class="leer" style="display:none;"></div>
          <div class="niemand" hidden>${esc(t('no_person_selected'))}</div>
          <div class="statusbar">
            ${c.show_export ? `<button class="export" type="button" title="${esc(t('export_data'))}" aria-label="${esc(t('export_data'))}">${DOWNLOAD_ICON}<span class="text">${esc(t('export_data'))}</span></button>` : ''}
            <div class="infos"><span class="status"></span></div>
            <span class="rest"></span>
            <button class="neuladen" title="${esc(t('reload_now'))}" aria-label="${esc(t('reload_now'))}">
              <svg class="ringe" viewBox="0 0 34 34" aria-hidden="true"><circle class="ring-hg" cx="17" cy="17" r="15"/><circle class="ring" cx="17" cy="17" r="15"/></svg>
              <svg class="pfeil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
          </div>
        </ha-card>`;

      this._persons.forEach((p) => {
        const pic = this.querySelector(`.personWahl .p-${p.key} .bild`);
        if (p.picture) pic.style.backgroundImage = `url("${p.picture}")`;
        else pic.textContent = p.name.charAt(0);
      });
      this._updatePersonButtons();
      this._updateDateControls();
      this.querySelectorAll('.personWahl .person').forEach((b) => b.addEventListener('click', () => this._togglePerson(b.dataset.wert)));
      this.querySelector('.alle-ein').addEventListener('click', () => this._showAll());
      this.querySelector('.datum').addEventListener('click', () => this._pick());
      this.querySelector('.today').addEventListener('click', () => this._today());
      this.querySelector('.prevDay').addEventListener('click', () => this._step(-1));
      this.querySelector('.nextDay').addEventListener('click', () => this._step(1));
      this.querySelectorAll('.modus .segment').forEach((b) => b.addEventListener('click', () => this._setMode(b.dataset.modus)));
      this.querySelector('.ansicht').addEventListener('click', () => {
        this._tableView = !this._tableView;
        if (!this._tableView && this._selectMode) this._setSelectMode(false);
        this._updateView();
      });
      const reload = this.querySelector('.neuladen');
      reload.addEventListener('click', () => {
        reload.classList.remove('dreht'); void reload.offsetWidth; reload.classList.add('dreht');
        this._rest = this._interval;
        this._renderCountdown();
        this._load({ fit: false });
      });
      this.querySelector('.auswahlBtn').addEventListener('click', () => this._setSelectMode(!this._selectMode));
      this.querySelector('.alleBtn').addEventListener('click', () => this._selectAll());
      this.querySelector('.exportCsv').addEventListener('click', () => this._exportSelected('csv'));
      this.querySelector('.exportGpx').addEventListener('click', () => this._exportSelected('gpx'));
      this.querySelector('.loeschenBtn').addEventListener('click', () => this._deleteSelected());
      const exportButton = this.querySelector('.statusbar .export');
      if (exportButton) exportButton.addEventListener('click', () => this._download());
      this.querySelector('.punkte-hinweis').addEventListener('click', () => {
        if (this._map) this._map.setZoom(Math.max(13, this._map.getZoom() + 1));
      });
      this._initMap();
    }

    _updatePersonButtons() {
      this._persons.forEach((p) => {
        const b = this.querySelector(`.personWahl .p-${p.key}`);
        if (!b) return;
        const on = !this._hidden.has(p.id);
        b.classList.toggle('aus', !on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.title = this._t(on ? 'hide_person' : 'show_person', { name: p.name });
        b.querySelector('.auge').innerHTML = on ? EYE : EYE_OFF;
      });
      const all = this.querySelector('.alle-ein');
      if (all) all.hidden = !this._hidden.size;
    }

    async _initMap() {
      try {
        await S.loadLeaflet();
        await S.waitForCss(this);
        const home = this._hass.config || {};
        const mapDiv = this.querySelector('.wa-map');
        this._map = window.L.map(mapDiv, { zoomControl: false }).setView([home.latitude || 0, home.longitude || 0], 14);
        window.L.control.zoom({ position: 'bottomright', zoomInTitle: this._t('zoom_in'), zoomOutTitle: this._t('zoom_out') }).addTo(this._map);
        this._overviewButton = S.overviewControl(this._map, this._t('overview'), () => this._fit());
        this._gear = {};
        S.updateGear(this._map, this._gear, this._info, this._t('open_settings'));
        S.compactAttribution(this._map);
        this._setTiles(S.isDark(this._hass, this._config.map_style));
        S.watchZoneNames(this._map, mapDiv, this._config);
        this._map.on('zoomend', () => this._simplify());
        this._drawZones();
      } catch (err) {
        // Without a map the table still works.
        console.error('Whereabouts: map could not be loaded', err);
        this._mapError = true;
        this._tableView = true;
      }
      this._load({ fit: true });
    }

    _setTiles(dark) {
      const changed = this._dark !== null && this._dark !== dark;
      this._dark = dark;
      const box = this.querySelector('.wa-map');
      const notice = this._info && this._info.is_admin ? S.fallbackNotice(box, this._t) : null;
      this._tiles = S.setTiles(this._map, this._tiles, this._config, dark, box, notice);
      // start/end symbols and points follow light/dark
      if (changed && this._points.length) this._drawMap(false);
    }

    _drawZones() {
      const signature = S.zoneSignature(this._hass, this._config);
      if (signature === this._zoneSignature && (this._zoneLayer || !this._config.show_zones)) return;
      this._zoneSignature = signature;
      this._zoneLayer = S.drawZones(this._map, this._zoneLayer, this._hass, this._config, this._t);
      this._zoneLayer.eachLayer((layer) => layer.bringToBack && layer.bringToBack());
    }

    // --- persons ------------------------------------------------------------------------
    _togglePerson(id) {
      if (!this._personById(id)) return;
      if (this._hidden.has(id)) this._hidden.delete(id); else this._hidden.add(id);
      if (this._hidden.has(id)) [...this._selected].forEach((k) => { if (k.startsWith(`${id}|`)) this._selected.delete(k); });
      this._afterPersons();
    }

    _showAll() {
      this._hidden.clear();
      this._afterPersons();
    }

    _afterPersons() {
      this._updatePersonButtons();
      this._renderStatusText();
      this._updateView();
      this._updateSelection();
      this._drawMap(true);
    }

    _setMode(mode) {
      this._mode = mode;
      this._drawMap(true);
    }

    // --- data ---------------------------------------------------------------------------
    // options.fit: zoom the map to the route; options.onlyIfChanged: do not redraw unchanged data.
    async _load(options = {}) {
      const t = this._t;
      const P = await pickerModule;
      const fit = options.fit !== false;
      const number = ++this._loadNo;
      const bar = this.querySelector('.statusbar');
      const status = this.querySelector('.status');
      this._updateDateControls();
      if (!options.onlyIfChanged) {
        bar.classList.remove('fehler');
        status.textContent = t('loading');
      }
      const persons = this._persons;
      const first = this._date;
      const last = this._to;
      // Long periods: month by month, one request after the other (spares Home Assistant).
      const chunks = [];
      if (P.daysBetween(first, last) > P.LARGE_DAYS) {
        let start = first;
        while (start <= last) {
          const d = P.parseDate(start);
          const end = P.dateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
          chunks.push([start, end < last ? end : last]);
          start = P.addDays(end, 1);
        }
      } else chunks.push([first, last]);
      this._loading = true;
      const points = [];
      const failed = new Set();
      for (let i = 0; i < chunks.length; i += 1) {
        const [a, b] = chunks[i];
        if (chunks.length > 1) status.textContent = t('loading_month', { n: i + 1, total: chunks.length });
        // allSettled: if one person fails, the others are still shown.
        const results = await Promise.allSettled(persons.map((p) => this._hass.callWS(a === b
          ? { type: 'whereabouts/history', person: p.id, date: a }
          : { type: 'whereabouts/history', person: p.id, date: a, date_to: b })));
        if (number !== this._loadNo) { this._loading = false; return; } // something newer was requested meanwhile
        results.forEach((result, k) => {
          if (result.status === 'rejected') {
            failed.add(persons[k].name);
            console.error('Whereabouts: loading failed for', persons[k].id, result.reason);
            return;
          }
          (result.value.stays || []).forEach((s) => points.push({
            person: persons[k].id, date: s.date || a, time: s.start, end: s.end, state: s.state,
            lat: s.latitude, lon: s.longitude, address: s.address, times: s.times,
          }));
        });
      }
      this._loading = false;
      this._loadedAt = new Date();
      const order = (p) => `${p.date} ${p.time}`;
      points.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : a.person.localeCompare(b.person)));

      const signature = `${first}|${last}|${points.length}|${points.map((p) => `${this._keyOf(p)}${p.end}${p.address}`).join(',')}`;
      if (options.onlyIfChanged && signature === this._signature && !failed.size) return;
      this._signature = signature;

      this._points = points;
      this._anchor = null;
      this._lastRange = null;
      const present = new Set(points.map((p) => this._keyOf(p)));
      this._selected.forEach((k) => { if (!present.has(k)) this._selected.delete(k); });

      this._failed = [...failed];
      this.querySelector('.leer').textContent = failed.size ? t('load_failed') : t(this._multiDay() ? 'no_data_range' : 'no_data');
      bar.classList.toggle('fehler', failed.size > 0);
      this._renderStatusText();
      this._updateView();
      this._updateSelection();
      this._drawMap(fit);
    }

    // Status bar: names in their colour with the number of entries, then the period / times.
    async _renderStatusText() {
      const t = this._t;
      const P = await pickerModule;
      const status = this.querySelector('.status');
      if (!status) return;
      const failed = this._failed || [];
      const persons = this._visiblePersons().filter((p) => !failed.includes(p.name));
      const points = this._visiblePoints();
      const parts = [];
      if (!persons.length && !failed.length) parts.push(esc(t('no_person_selected')));
      else if (!points.length) { if (!failed.length) parts.push(esc(t(this._multiDay() ? 'no_data_range' : 'no_data'))); }
      else if (this._persons.length > 1) {
        parts.push(persons.map((p) => `<span class="wer p-${p.key}">${esc(p.name)}:</span> ${esc(this._countText(points.filter((x) => x.person === p.id).length))}`).join(SEP));
      } else parts.push(esc(this._countText(points.length)));
      let text = parts.join('');
      if (this._multiDay()) {
        text += `<span class="zeit">${text ? SEP : ''}${esc(P.rangeText(S.language(this._hass), this._date, this._to))}</span>`;
      } else if (points.length) {
        const end = points.reduce((max, p) => ((p.end || p.time) > max ? (p.end || p.time) : max), '');
        text += `<span class="zeit">${SEP}${esc(t('time', { time: t('range', { from: points[0].time.slice(0, 5), to: end.slice(0, 5) }) }))}</span>`;
      }
      if (failed.length) text += (text ? SEP : '') + esc(t('error_for', { names: failed.join(', ') }));
      if (this._mapError) text += (text ? SEP : '') + esc(t('map_unavailable'));
      status.innerHTML = text;
    }

    // Unique key: person, day and start of the stay.
    _keyOf(p) {
      return `${p.person}|${p.date}|${p.time}`;
    }

    _download() {
      openDownloadDialog(S, {
        hass: this._hass,
        t: this._t,
        persons: this._persons.map((p) => ({ id: p.id, name: p.name, color: p.color })),
        selected: this._visiblePersons().map((p) => p.id),
        from: this._date,
        to: this._to,
        days: this._days,
        first: this._first,
        mapImage: this._map && !this._tableView ? {
          current: () => this._mapPicture(false),
          whole: () => this._mapPicture(true),
        } : null,
      });
    }

    // --- map --------------------------------------------------------------------------
    _mapVisible() {
      const map = this.querySelector('.wa-map');
      return map.offsetWidth > 0 && map.offsetHeight > 0;
    }

    // Many entries: the small points only when zoomed in (setting "hide points from … entries", 0 = always shown).
    _large() {
      const limit = Number(this._config.simplify_points);
      if (!(limit > 0)) return false;
      return this._visiblePoints().length >= limit;
    }

    _simplify() {
      const plaque = this.querySelector('.punkte-hinweis');
      if (!this._map || !this._markerLayer) { if (plaque) plaque.hidden = true; return; }
      const show = !this._large() || this._map.getZoom() >= 13;
      if (show && !this._map.hasLayer(this._markerLayer)) this._markerLayer.addTo(this._map);
      if (!show && this._map.hasLayer(this._markerLayer)) this._map.removeLayer(this._markerLayer);
      if (plaque) {
        const n = this._markerLayer.getLayers().length;
        plaque.hidden = show || !n;
        plaque.querySelector('.text').textContent = this._t('points_hidden', { n });
      }
    }

    _heat() {
      return this._mode === 'heat';
    }

    // Layers of the route (or heatmap) for a map; used for the shown map and the picture.
    _buildLayers(forPicture) {
      const L = window.L;
      const visible = this._visiblePersons();
      const points = this._visiblePoints();
      if (this._heat()) {
        // Weighted by the time spent there (capped, so home does not outshine everything).
        const data = points.filter((p) => this._withHome || p.state !== 'home')
          .map((p) => [p.lat, p.lon, Math.max(0.08, Math.min(this._minutes(p), 240) / 240)]);
        const heat = L.heatLayer(data, { radius: 22, blur: 18, max: 1, minOpacity: 0.25 });
        const bounds = data.length ? L.latLngBounds(data.map((d) => [d[0], d[1]])) : null;
        return { heat, bounds };
      }
      const route = L.featureGroup();
      const markers = L.layerGroup();
      const ends = L.layerGroup();
      // Each person in its colour: line and small points; start = white circle with ▶, end = coloured circle with flag.
      // A period is one continuous route over all its days.
      visible.forEach((person) => {
        const own = points.filter((p) => p.person === person.id);
        if (!own.length) return;
        L.polyline(own.map((p) => [p.lat, p.lon]), { color: person.color, weight: 4, opacity: 0.8 }).addTo(route);
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
            ends.addLayer(marker);
          } else {
            marker = L.circleMarker([p.lat, p.lon], {
              radius: 5, color: this._dark ? S.shade(person.color, -0.35) : person.color, weight: 1, fillColor: person.color, fillOpacity: 0.6,
            });
            markers.addLayer(marker);
          }
          if (!forPicture) marker.bindPopup(() => this._popup(p), { className: 'wa-eintrag', closeButton: false, minWidth: 220, maxWidth: 300 });
        });
      });
      const bounds = route.getLayers().length ? route.getBounds() : null;
      return { route, markers, ends, bounds };
    }

    async _drawMap(fit) {
      if (!this._map) return;
      this._map.closePopup();
      [this._routeLayer, this._markerLayer, this._endLayer, this._heatLayer].forEach((layer) => {
        if (layer && this._map.hasLayer(layer)) this._map.removeLayer(layer);
      });
      this._routeLayer = this._markerLayer = this._endLayer = this._heatLayer = null;
      this._bounds = null;
      this._simplify();
      const mapDiv = this.querySelector('.wa-map');
      let hint = mapDiv.querySelector('.niemand-hinweis');
      const nobody = !this._visiblePersons().length;
      if (nobody && !hint) {
        hint = document.createElement('div');
        hint.className = 'niemand-hinweis';
        hint.innerHTML = `<span>${esc(this._t('no_person_selected'))}</span>`;
        mapDiv.appendChild(hint);
      } else if (!nobody && hint) hint.remove();
      if (this._heat()) {
        try { await S.loadHeat(); } catch (err) { this._mode = 'route'; }
      }
      this.querySelectorAll('.modus .segment').forEach((b) => b.classList.toggle('aktiv', b.dataset.modus === (this._heat() ? 'heat' : 'route')));
      this._showLegend();
      if (!this._visiblePoints().length) return;
      const layers = this._buildLayers(false);
      this._bounds = layers.bounds;
      if (layers.heat) {
        this._heatLayer = layers.heat.addTo(this._map);
      } else {
        this._routeLayer = layers.route.addTo(this._map);
        this._markerLayer = layers.markers;
        this._endLayer = layers.ends.addTo(this._map);
        this._simplify();
      }
      if (fit) {
        if (this._mapVisible()) this._fit();
        else this._staleView = true; // hidden (table): fit as soon as the map is shown
      }
    }

    // Start: white circle with ▶ in the person's colour (dark map: dark circle); end: coloured circle with a flag.
    // legend = true on a dark map: both dark with light grey outline and sign.
    _symbol(kind, color, size, legend = false) {
      const dark = Boolean(this._dark);
      const inside = dark ? '#2b2d30' : '#fff';
      const light = '#d0d0d0';
      let circle;
      let sign;
      if (kind === 'end') {
        const fill = legend && dark ? inside : color;
        const mark = legend && dark ? light : '#fff';
        circle = `<circle cx="12" cy="12" r="10.5" fill="${fill}" stroke="${legend && dark ? light : '#fff'}" stroke-width="2"/>`;
        sign = `<path d="M8.5 6.5v11" stroke="${mark}" stroke-width="1.8" stroke-linecap="round"/><path d="M9.3 6.8h7.2l-1.9 2.6 1.9 2.6H9.3z" fill="${mark}"/>`;
      } else {
        circle = `<circle cx="12" cy="12" r="10" fill="${inside}" stroke="${color}" stroke-width="3"/>`;
        sign = `<path d="M10 7.6v8.8l7-4.4z" fill="${color}"/>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${circle}${sign}</svg>`;
    }

    _fit() {
      this._staleView = false;
      if (!this._map || !this._bounds) return;
      this._map.invalidateSize();
      const legend = this.querySelector('.legende');
      const legendHeight = legend ? legend.getBoundingClientRect().height + 10 : 0;
      this._map.fitBounds(this._bounds, {
        paddingTopLeft: [30, 30], paddingBottomRight: [30, Math.max(30, legendHeight + 20)], maxZoom: 17,
      });
    }

    _legendHtml() {
      const t = this._t;
      const zones = this._zoneSwitchHtml();
      if (this._heat()) {
        return `<div class="verlauf"></div><div class="skala"><span>${esc(t('heat_little'))}</span><span>${esc(t('heat_much'))}</span></div>
          <label><input type="checkbox" class="mitZuhause"${this._withHome ? ' checked' : ''}>${esc(t('heat_with_home'))}</label>${zones}`;
      }
      const grey = this._dark ? '#d0d0d0' : '#666';
      return this._visiblePersons().map((p) => `<div class="eintrag"><span class="linie" style="background:${p.color}"></span>${esc(p.name)}</div>`).join('')
        + `<div class="eintrag hinweis">${this._symbol('start', grey, 18, true)}${esc(t('start'))}`
        + `<span class="abstand"></span>${this._symbol('end', grey, 18, true)}${esc(t('end'))}</div>${zones}`;
    }

    // "Show zones" in the legend: the same setting as on the settings page (zones_in).
    _zoneSwitchHtml() {
      const t = this._t;
      const locked = ((this._info && this._info.locked_keys) || []).includes('zones_in');
      const fixedByCard = this._raw && this._raw.show_zones !== undefined;
      const title = locked ? t('zones_switch_locked') : (fixedByCard ? t('zones_switch_card') : '');
      return `<label class="zonen${locked ? ' fest' : ''}"${title ? ` title="${esc(title)}"` : ''}><input type="checkbox" class="zonenZeigen"${this._config.show_zones ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(t('show_zones_short'))}</label>`;
    }

    async _toggleZones(show) {
      const fixedByCard = this._raw && this._raw.show_zones !== undefined;
      if (fixedByCard) {
        // the card's own setting wins: only shown differently until leaving
        this._zonesShown = show;
        this._applyConfig();
        this._zoneSignature = '';
        this._drawZones();
        return;
      }
      const current = (this._info && this._info.settings && this._info.settings.zones_in) || 'both';
      const live = current === 'both' || current === 'live';
      const zonesIn = show ? (live ? 'both' : 'history') : (live ? 'live' : 'none');
      this._config.show_zones = show;
      this._zoneSignature = '';
      this._drawZones();
      try {
        await this._hass.callWS({ type: 'whereabouts/settings/save', scope: 'own', category: 'zones', values: { zones_in: zonesIn } });
      } catch (err) {
        console.error('Whereabouts: zones setting not saved', err);
      }
    }

    _showLegend() {
      if (!this._map) return;
      if (this._legend) { this._map.removeControl(this._legend); this._legend = null; }
      if (!this._config.show_legend || !this._visiblePersons().length) return;
      const legend = window.L.control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = window.L.DomUtil.create('div', 'legende');
        div.innerHTML = this._legendHtml();
        window.L.DomEvent.disableClickPropagation(div);
        const box = div.querySelector('.mitZuhause');
        if (box) box.addEventListener('change', () => { this._withHome = box.checked; this._drawMap(false); });
        const zones = div.querySelector('.zonenZeigen');
        if (zones) zones.addEventListener('change', () => this._toggleZones(zones.checked));
        return div;
      };
      legend.addTo(this._map);
      this._legend = legend;
    }

    // Header: colour dot, name, close; the place large with a link to the map app; time and duration small;
    // delete as a red text button.
    _popup(p) {
      const t = this._t;
      const person = this._personById(p.person);
      const box = document.createElement('div');
      box.className = 'popup';
      const head = document.createElement('div');
      head.className = 'kopf';
      head.innerHTML = `<span class="punkt" style="background:${person.color}"></span><span class="name"></span>
        <button class="zu" type="button" title="${esc(t('close'))}" aria-label="${esc(t('close'))}">${CLOSE}</button>`;
      head.querySelector('.name').textContent = person.name;
      head.querySelector('.zu').addEventListener('click', (e) => { e.stopPropagation(); this._map.closePopup(); });
      const away = p.state === 'not_home' && p.address;
      const line = document.createElement('div');
      line.className = 'ortzeile';
      const place = document.createElement('div');
      place.className = 'ort';
      place.textContent = away ? p.address : S.placeText(t, p.state);
      line.appendChild(place);
      if (this._config.map_link !== 'none') {
        const link = document.createElement('a');
        link.className = 'karte';
        link.innerHTML = LINK;
        link.title = t('open_in_map');
        link.setAttribute('aria-label', t('open_in_map'));
        S.bindMapLink(link, this._config, t, Number(p.lat), Number(p.lon));
        line.appendChild(link);
      }
      box.append(head, line);
      if (away) {
        const kind = document.createElement('div');
        kind.className = 'art';
        kind.textContent = S.placeText(t, p.state);
        box.appendChild(kind);
      }
      const time = document.createElement('div');
      time.className = 'zeit';
      time.textContent = [this._multiDay() ? this._dayText(p.date) : '', this._timeText(p), this._durationText(p)].filter(Boolean).join(' · ');
      box.appendChild(time);
      if (person.canDelete) {
        const button = document.createElement('button');
        button.className = 'loeschen';
        button.type = 'button';
        button.innerHTML = `${BIN}<span>${esc(t('delete_entry'))}</span>`;
        button.addEventListener('click', (e) => { e.stopPropagation(); this._delete([this._keyOf(p)], button); });
        box.appendChild(button);
      }
      return box;
    }

    // --- map picture (JPG) ----------------------------------------------------------------------
    // whole = false: what is shown now; true: so that the whole route / heatmap fits.
    // Drawn on a hidden map whose tiles are loaded readable (CORS) - the shown map stays untouched.
    async _mapPicture(whole) {
      const L = window.L;
      const t = this._t;
      const source = this.querySelector('.wa-map');
      const width = whole ? 2000 : source.clientWidth;
      const height = whole ? 1400 : source.clientHeight;
      const holder = document.createElement('div');
      holder.className = 'wa-history';
      holder.style.cssText = `position:fixed;left:-${width + 200}px;top:0;width:${width}px;height:${height}px;`;
      const div = document.createElement('div');
      div.className = 'wa-map';
      div.style.cssText = `position:absolute;inset:0;width:${width}px;height:${height}px;min-height:0;`;
      holder.appendChild(div);
      this.appendChild(holder);
      try {
        const map = L.map(div, { zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false });
        if (whole && this._bounds) map.fitBounds(this._bounds, { padding: [60, 60], maxZoom: 17 });
        else map.setView(this._map.getCenter(), this._map.getZoom());
        const tiles = S.setTiles(map, [], { ...this._config, capture: true }, this._dark, div, null);
        let failed = 0;
        let loaded = 0;
        tiles.forEach((layer) => {
          layer.on('tileerror', () => { failed += 1; });
          layer.on('tileload', () => { loaded += 1; });
        });
        if (this._config.show_zones) S.drawZones(map, null, this._hass, this._config, t);
        if (this._visiblePoints().length) {
          const layers = this._buildLayers(true);
          if (layers.heat) layers.heat.addTo(map);
          else { layers.route.addTo(map); layers.markers.addTo(map); layers.ends.addTo(map); }
        }
        await new Promise((resolve) => {
          let pending = tiles.length;
          const done = () => { pending -= 1; if (pending <= 0) resolve(); };
          tiles.forEach((layer) => layer.once('load', done));
          setTimeout(resolve, 15000);
        });
        await new Promise((r) => setTimeout(r, 300));
        if (failed && !loaded) throw new Error('tainted');
        const blob = await this._compose(map, div, width, height);
        map.remove();
        return blob;
      } finally {
        holder.remove();
      }
    }

    async _compose(map, div, width, height) {
      const t = this._t;
      const P = await pickerModule;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height + 34;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = this._dark ? '#262626' : '#f2efe9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const origin = div.getBoundingClientRect();
      const rect = (el) => { const r = el.getBoundingClientRect(); return [r.left - origin.left, r.top - origin.top, r.width, r.height]; };
      const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
      // tiles
      if (div.classList.contains('wa-osm-dark')) ctx.filter = 'invert(1) hue-rotate(180deg) brightness(.9) contrast(.9)';
      div.querySelectorAll('.leaflet-tile-pane img.leaflet-tile-loaded').forEach((img) => {
        const [x, y, w, h] = rect(img);
        ctx.drawImage(img, x, y, w, h);
      });
      ctx.filter = 'none';
      // route, zones, points (SVG) and the heatmap (canvas)
      for (const svg of div.querySelectorAll('.leaflet-overlay-pane svg')) {
        const [x, y, w, h] = rect(svg);
        const copy = svg.cloneNode(true);
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        copy.setAttribute('width', w);
        copy.setAttribute('height', h);
        copy.style.transform = '';
        const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`);
        ctx.drawImage(img, x, y, w, h);
      }
      div.querySelectorAll('.leaflet-overlay-pane canvas').forEach((c) => {
        const [x, y, w, h] = rect(c);
        ctx.drawImage(c, x, y, w, h);
      });
      // start and end symbols
      for (const icon of div.querySelectorAll('.leaflet-marker-pane .routenSymbol svg')) {
        const [x, y, w, h] = rect(icon);
        const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.outerHTML)}`);
        ctx.drawImage(img, x, y, w, h);
      }
      // zone names
      if (map.getZoom() >= Number(this._config.zone_names_zoom || 14)) {
        ctx.font = '600 13px sans-serif';
        ctx.textAlign = 'center';
        div.querySelectorAll('.leaflet-tooltip-pane .zonen-name').forEach((tip) => {
          const [x, y, w, h] = rect(tip);
          ctx.lineWidth = 3;
          ctx.strokeStyle = this._dark ? '#000' : '#fff';
          ctx.fillStyle = this._dark ? '#ddd' : '#555';
          ctx.strokeText(tip.textContent, x + w / 2, y + h / 2 + 4);
          ctx.fillText(tip.textContent, x + w / 2, y + h / 2 + 4);
        });
      }
      // legend at the bottom left
      const persons = this._visiblePersons();
      ctx.textAlign = 'left';
      ctx.font = '14px sans-serif';
      if (this._config.show_legend && persons.length && !this._heat()) {
        const boxWidth = Math.max(...persons.map((p) => ctx.measureText(p.name).width)) + 56;
        const boxHeight = persons.length * 22 + 14;
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fillRect(12, height - boxHeight - 12, boxWidth, boxHeight);
        persons.forEach((p, i) => {
          const y = height - boxHeight - 12 + 20 + i * 22;
          ctx.fillStyle = p.color;
          ctx.fillRect(24, y - 7, 22, 5);
          ctx.fillStyle = '#222';
          ctx.fillText(p.name, 54, y);
        });
      } else if (this._config.show_legend && this._heat()) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fillRect(12, height - 52, 200, 40);
        const gradient = ctx.createLinearGradient(24, 0, 200, 0);
        ['blue', 'cyan', 'lime', 'yellow', 'red'].forEach((c, i) => gradient.addColorStop(i / 4, c));
        ctx.fillStyle = gradient;
        ctx.fillRect(24, height - 44, 176, 8);
        ctx.fillStyle = '#555';
        ctx.font = '12px sans-serif';
        ctx.fillText(t('heat_little'), 24, height - 20);
        ctx.textAlign = 'right';
        ctx.fillText(t('heat_much'), 200, height - 20);
        ctx.textAlign = 'left';
      }
      // line below: period, persons, map source
      const tiles = this._config.tiles === 'carto' && !this._config.carto_api_key ? 'esri' : this._config.tiles;
      const source = { esri: 'Esri, HERE, Garmin, © OpenStreetMap', osm: '© OpenStreetMap', carto: '© OpenStreetMap © CARTO' }[tiles] || '© OpenStreetMap';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, height, width, 34);
      ctx.fillStyle = '#333';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${P.rangeText(S.language(this._hass), this._date, this._to)} · ${persons.map((p) => p.name).join(', ')}`, 12, height + 22);
      ctx.textAlign = 'right';
      ctx.fillText(`Whereabouts · ${t('map_data')}: ${source}`, width - 12, height + 22);
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('tainted'))), 'image/jpeg', 0.9);
        } catch (err) {
          reject(new Error('tainted'));
        }
      });
    }

    // --- table --------------------------------------------------------------------------
    _renderTable() {
      const t = this._t;
      const box = this.querySelector('.tabelle');
      const points = this._visiblePoints();
      this._rows = points;
      if (!points.length) {
        box.innerHTML = '';
        return;
      }
      const withPerson = this._visiblePersons().length > 1;
      const withDate = this._multiDay();
      const rowStyle = (c) => `--zeile-bg:${c}14;--zeile-hover:${c}29;--zeile-sel:${c}47;--zeile-farbe:${c}`;
      let html = '<table><thead><tr>';
      if (this._selectMode) html += '<th class="wahl"></th>';
      if (withDate) html += `<th>${esc(t('col_date'))}</th>`;
      html += `<th>${esc(t('col_time'))}</th>`;
      if (withPerson) html += `<th>${esc(t('col_person'))}</th>`;
      html += `<th>${esc(t('col_place'))}</th><th>${esc(t('col_lat'))}</th><th>${esc(t('col_lon'))}</th></tr></thead><tbody>`;
      points.forEach((p, i) => {
        const person = this._personById(p.person);
        const key = this._keyOf(p);
        const classes = [];
        if (this._selectMode) classes.push('waehlbar');
        if (this._selectMode && this._selected.has(key)) classes.push('gewaehlt');
        html += `<tr data-key="${esc(key)}" data-index="${i}" class="${classes.join(' ')}" style="${rowStyle(person.color)}">`;
        if (this._selectMode) html += `<td class="wahl">${CHECK}</td>`;
        if (withDate) html += `<td>${esc(this._dayText(p.date))}</td>`;
        html += `<td>${esc(this._timeText(p))}</td>`;
        if (withPerson) html += `<td><span class="punkt" style="background:${person.color}"></span>${esc(person.name)}</td>`;
        html += `<td>${esc(this._placeText(p))}</td><td>${Number(p.lat).toFixed(6)}</td><td>${Number(p.lon).toFixed(6)}</td></tr>`;
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
      const index = Number(row.dataset.index);
      const key = row.dataset.key;
      if (!this._rows[index]) return;
      const single = e.ctrlKey || e.metaKey;
      const range = e.shiftKey;
      if (!this._selectMode) {
        if (!single && !range) return;
        this._selectMode = true;
        this.querySelector('.auswahlBtn').classList.add('aktiv');
        this.querySelector('.auswahl').classList.add('aktiv');
      }
      if (range && this._anchor != null && this._rows[this._anchor]) {
        const from = Math.min(this._anchor, index);
        const to = Math.max(this._anchor, index);
        for (let i = from; i <= to; i++) this._selected.add(this._keyOf(this._rows[i]));
        if (this._lastRange) {
          this._lastRange.forEach((k) => {
            const idx = this._rows.findIndex((p) => this._keyOf(p) === k);
            if (idx < from || idx > to) this._selected.delete(k);
          });
        }
        this._lastRange = this._rows.slice(from, to + 1).map((p) => this._keyOf(p));
      } else {
        if (this._selected.has(key)) this._selected.delete(key);
        else this._selected.add(key);
        this._anchor = index;
        this._lastRange = null;
      }
      this._renderTable();
      this._updateSelection();
    }

    _selectedPoints() {
      return this._points.filter((p) => this._selected.has(this._keyOf(p)));
    }

    _updateSelection() {
      const n = this._selected.size;
      const count = this.querySelector('.anzahl');
      if (!count) return;
      count.textContent = this._t('selected', { n });
      const deletable = this._selectedPoints().filter((p) => this._personById(p.person).canDelete).length;
      const del = this.querySelector('.loeschenBtn');
      del.style.display = this._persons.some((p) => p.canDelete) ? '' : 'none';
      del.disabled = deletable === 0;
      this.querySelectorAll('.exportCsv, .exportGpx').forEach((b) => { b.disabled = n === 0; });
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
      const all = this._visiblePoints().map((p) => this._keyOf(p));
      const allSelected = all.length > 0 && all.every((k) => this._selected.has(k));
      if (allSelected) this._selected.clear();
      else all.forEach((k) => this._selected.add(k));
      this._renderTable();
      this._updateSelection();
    }

    _exportSelected(format) {
      const entries = this._selectedPoints();
      if (!entries.length) return;
      exportEntries(S, { entries, format, name: `whereabouts_${this._date}${this._multiDay() ? `_${this._to}` : ''}_${this._t('selection_file')}` });
    }

    _deleteSelected() {
      const keys = this._selectedPoints().filter((p) => this._personById(p.person).canDelete).map((p) => this._keyOf(p));
      this._delete(keys, this.querySelector('.loeschenBtn'));
    }

    // --- delete ---------------------------------------------------------------------------
    // keys: "person|YYYY-MM-DD|HH:MM:SS" (start of the stay). A stay can consist of several rows (times).
    async _delete(keys, button) {
      const t = this._t;
      if (!keys.length) return;
      const byKey = new Map(this._points.map((p) => [this._keyOf(p), p]));
      // eslint-disable-next-line no-alert
      if (!confirm(keys.length === 1 ? t('confirm_delete_one') : t('confirm_delete_many', { n: keys.length }))) return;
      const original = button ? button.innerHTML : '';
      if (button) { button.disabled = true; if (!button.querySelector('svg')) button.textContent = t('deleting'); }
      try {
        // One request per person and day.
        const groups = new Map();
        keys.forEach((k) => {
          const p = byKey.get(k);
          if (!p) return;
          const times = Array.isArray(p.times) && p.times.length ? p.times : [p.time];
          const id = `${p.person}|${p.date}`;
          if (!groups.has(id)) groups.set(id, { person: p.person, date: p.date, times: [] });
          groups.get(id).times.push(...times);
        });
        for (const group of groups.values()) {
          if (!this._personById(group.person) || !this._personById(group.person).canDelete) continue;
          await this._hass.callWS({ type: 'whereabouts/delete', person: group.person, date: group.date, times: group.times });
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
    // Controls: with words in one row if that fits (computer), otherwise compact with
    // symbols - in one row if that fits (phone in landscape), otherwise two. Never three.
    _layout() {
      const bar = this.querySelector('.controls');
      if (!bar || !bar.clientWidth) return;
      const card = this.querySelector('.wa-history');
      if (card) card.classList.toggle('niedrig', card.clientHeight > 0 && card.clientHeight < 500);
      const width = (children) => {
        const visible = [...children].filter((el) => el.offsetParent !== null);
        return visible.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + Math.max(0, visible.length - 1) * 8;
      };
      const stages = ['ohne-namen', 'ohne-auge', 'umbruch'];
      bar.classList.remove('schmal', 'einzeilig', 'zeilen-3', ...stages);
      // Measure the wide row with the long date, whatever is shown right now.
      const label = this.querySelector('.datum .text');
      const shown = label ? label.textContent : '';
      if (label && this._P) label.textContent = this._P.rangeText(S.language(this._hass), this._date, this._to, false);
      const style = getComputedStyle(bar);
      const space = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const names = this.querySelector('.personWahl').getBoundingClientRect().width;
      const date = width(this.querySelector('.zone.mitte').children);
      const actions = width(this.querySelector('.aktionen').children);
      if (label) label.textContent = shown;
      const narrow = names + date + actions + 16 + 24 > space;
      bar.classList.toggle('schmal', narrow);
      if (narrow) {
        bar.classList.add('einzeilig');
        if (bar.scrollWidth > bar.clientWidth + 1) {
          bar.classList.remove('einzeilig');
          // Two rows - persons as far as there is room: picture, name and eye, then
          // without the name, then picture only, then in several rows.
          const persons = this.querySelector('.personWahl');
          const room = bar.clientWidth - 20;
          for (const stage of stages) {
            if (persons.scrollWidth <= room) break;
            bar.classList.add(stage);
          }
        }
      }
      // Status bar: words only if they fit in one row.
      const status = this.querySelector('.statusbar');
      if (status) {
        status.classList.toggle('eng', status.clientWidth < 520);
        status.classList.remove('schmal');
        const infos = status.querySelector('.infos');
        if (narrow || (infos && infos.offsetHeight > 34)) status.classList.add('schmal');
      }
      if (narrow !== this._narrow) {
        this._narrow = narrow;
        this._updateDateControls();
        this._renderStatusText();
      }
    }

    // --- map / table --------------------------------------------------------------------------
    _viewButton(button, icon, text) {
      button.innerHTML = `<ha-icon class="ic" icon="${icon}"></ha-icon><span class="txt">${esc(text)}</span>`;
      button.title = text;
      button.setAttribute('aria-label', text);
    }

    _updateView() {
      const t = this._t;
      const map = this.querySelector('.wa-map');
      const table = this.querySelector('.tabelle');
      const empty = this.querySelector('.leer');
      const button = this.querySelector('.ansicht');
      const selectButton = this.querySelector('.auswahlBtn');
      const nobody = !this._visiblePersons().length;
      const none = this._visiblePoints().length === 0 && !nobody;
      empty.style.display = none ? 'block' : 'none';
      this.querySelector('.niemand').hidden = !(nobody && this._tableView);
      button.style.display = this._mapError ? 'none' : '';
      if (this._tableView) {
        map.style.display = 'none';
        table.style.display = 'flex';
        table.style.flexDirection = 'column';
        this._viewButton(button, 'mdi:map', t('show_map'));
        button.classList.add('aktiv');
        selectButton.style.display = '';
        this._renderTable();
      } else {
        map.style.display = none ? 'none' : 'block'; // nobody shown: empty map with a hint
        table.style.display = 'none';
        this._viewButton(button, 'mdi:table', t('show_table'));
        button.classList.remove('aktiv');
        selectButton.style.display = 'none';
        if (this._map && !none && !nobody) {
          setTimeout(() => { if (this._staleView) this._fit(); else this._map.invalidateSize(); }, 0);
        }
      }
      const modes = this.querySelector('.modus');
      if (modes) modes.hidden = this._tableView;
      this._layout();
    }
  }

  if (!customElements.get('whereabouts-history-card')) customElements.define('whereabouts-history-card', WhereaboutsHistoryCard);
}
