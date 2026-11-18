// Whereabouts – "Location history" card: the stays of a day or a period as route or table.
// Data only through the integration's WebSocket API (checked per user).

export const HISTORY_DEFAULTS = {
  title: '',
  persons: [],
  default_view: 'map', // map | table
  show_legend: true,
  show_export: true,
  auto_refresh: true,
  refresh_interval: 30,
};

const CHECK = '<div class="checkbox"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"></polyline></svg></div>';
const BIN = '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12M8 9h8v10H8V9m7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
const MAX_DAYS = 31;

export function defineHistoryCard(S, D) {
  const { openDownloadDialog, DOWNLOAD_ICON } = D;
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
      this._range = false; // false = one day, true = period
      this._date = this._todayStr(); // first day
      this._to = this._date; // last day (= first day in day mode)
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
      this._tableView = this._config.default_view === 'table';
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
      const sig = JSON.stringify([info.available, info.history_card, info.persons, info.settings]);
      if (sig === this._infoSig) return;
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
        canDelete: p.can_delete,
      }));
      if (!this._persons.length) { this.innerHTML = S.messageHtml(this._t('no_history_persons')); return; }
      this._hidden.forEach((id) => { if (!this._personById(id)) this._hidden.delete(id); });
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
      this._zoneLayer = null;
      this._zoneSignature = '';
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

    // Automatic reload: "Reload in 12 s" and a ring around the button;
    // switched off: how current the shown data is, the button stays.
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
    }

    _autoRefresh() {
      // Only when visible and the user is not in the middle of something.
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

    _addDays(value, delta) {
      const [y, m, d] = value.split('-').map(Number);
      return this._dateStr(new Date(y, m - 1, d + delta));
    }

    _days(from, to) {
      const a = from.split('-').map(Number);
      const b = to.split('-').map(Number);
      return Math.round((new Date(b[0], b[1] - 1, b[2]) - new Date(a[0], a[1] - 1, a[2])) / 86400000) + 1;
    }

    // Arrows: one day, or the length of the period.
    _step(direction) {
      const n = this._range ? this._days(this._date, this._to) : 1;
      this._setPeriod(this._addDays(this._date, direction * n), this._addDays(this._to, direction * n));
    }

    _valid(value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
    }

    // Every change of date: empty, invalid or future dates jump to today; at most 31 days.
    _setPeriod(from, to, fixed = 'from') {
      const today = this._todayStr();
      if (!this._valid(from) || from > today) from = today;
      if (!this._range) to = from;
      if (!this._valid(to) || to > today) to = today;
      if (to < from) { if (fixed === 'from') to = from; else from = to; }
      if (this._days(from, to) > MAX_DAYS) {
        if (fixed === 'from') to = this._addDays(from, MAX_DAYS - 1);
        else from = this._addDays(to, -(MAX_DAYS - 1));
        if (to > today) { to = today; from = this._addDays(today, -(MAX_DAYS - 1)); }
      }
      this._date = from;
      this._to = to;
      this._updateDateControls();
      this._rest = this._interval;
      this._renderCountdown();
      this._selected.clear();
      this._load({ fit: true });
    }

    // "Today": the same length, ending today.
    _today() {
      const today = this._todayStr();
      const n = this._range ? this._days(this._date, this._to) : 1;
      this._setPeriod(this._addDays(today, -(n - 1)), today);
    }

    _setRange(on) {
      if (on === this._range) return;
      this._range = on;
      this.querySelectorAll('.modus .segment').forEach((b) => b.classList.toggle('aktiv', (b.dataset.modus === 'range') === on));
      this.querySelector('.bis-feld').hidden = !on;
      // Period: starts with the last 7 days up to the shown day; day: the last day of the period.
      if (on) this._setPeriod(this._addDays(this._date, -6), this._date, 'to');
      else this._setPeriod(this._to, this._to);
    }

    _updateDateControls() {
      const today = this._todayStr();
      const from = this.querySelector('.datum');
      const to = this.querySelector('.datum-bis');
      from.max = today;
      from.value = this._date;
      to.max = today;
      to.min = this._date;
      to.value = this._to;
      const isToday = this._to >= today;
      this.querySelector('.nextDay').disabled = isToday;
      this.querySelector('.today').disabled = isToday && (!this._range || this._date === this._addDays(today, -(this._days(this._date, this._to) - 1)));
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

    // "2 h 36 min" from start and end of a stay (same day).
    _durationText(p) {
      const minutes = (v) => { const [h, m] = String(v || '').split(':').map(Number); return h * 60 + m; };
      if (!p.end || !p.time) return '';
      const n = minutes(p.end) - minutes(p.time);
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
          .personWahl .person.p-${p.key}.aktiv { background: ${p.color}; border-color: ${p.color}; color: #fff; }
          .statusbar .wer.p-${p.key} { color: ${p.color}; }`).join('');
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
            .controls .personWahl .person { color: var(--secondary-text-color); background: var(--secondary-background-color, rgba(127,127,127,.12));
                                            border-color: transparent; }
            .controls .personWahl .person:hover { filter: brightness(.95); }
            .bis-feld { display: inline-flex; align-items: center; gap: 6px; }
            .bis-feld[hidden] { display: none; }
            .controls button.icon svg { width: 20px; height: 20px; fill: currentColor; display: block; }
            .controls button.herunterladen { padding: 7px 9px; }
            .niemand { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 30px; text-align: center;
                       color: var(--secondary-text-color); font-size: 15px; }
            .niemand[hidden] { display: none; }
            .wa-map .niemand-hinweis { position: absolute; inset: 0; z-index: 900; display: flex; align-items: center; justify-content: center;
                                       pointer-events: none; }
            .wa-map .niemand-hinweis span { background: var(--card-background-color, #fff); color: var(--primary-text-color); padding: 10px 16px;
                                            border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.25); font-size: 15px; }
            ${personCss}
            .controls button { font-family: inherit; font-size: 15px; padding: 8px 14px; border: 1px solid var(--divider-color);
                               border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
            .controls button:hover:not(:disabled) { background: var(--secondary-background-color); }
            .controls button:disabled { opacity: 0.4; cursor: default; }
            .controls button.aktiv { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .controls button.icon { padding: 8px 12px; font-size: 18px; line-height: 1; }
            .neuladen { flex: 0 0 auto; position: relative; width: 34px; height: 34px; padding: 0; border: none; border-radius: 50%;
                        background: transparent; color: var(--primary-text-color); cursor: pointer;
                        display: inline-flex; align-items: center; justify-content: center; }
            .neuladen:hover { background: rgba(127,127,127,.15); }
            .neuladen.ohne-ring svg.ringe { display: none; }
            .neuladen svg.ringe { position: absolute; inset: 0; width: 34px; height: 34px; }
            .neuladen .ring-hg { fill: none; stroke: rgba(127,127,127,.25); stroke-width: 2; }
            .neuladen .ring { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 2; stroke-linecap: round;
                              transform: rotate(-90deg); transform-origin: 17px 17px; transition: stroke-dashoffset 1s linear; }
            .neuladen.still .ring { transition: none; }
            .neuladen .pfeil { width: 18px; height: 18px; }
            .neuladen.dreht .pfeil { animation: wa-drehen .6s ease-in-out; }
            @keyframes wa-drehen { to { transform: rotate(360deg); } }
            .controls .segmented .segment { border: none; border-right: 1px solid var(--divider-color); border-radius: 0; }
            .controls .segmented .segment:last-child { border-right: none; }
            .auswahl { display: none; flex: 0 0 auto; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--divider-color); }
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
            .popup .ort { font-size: 17px; font-weight: 500; overflow-wrap: anywhere; }
            .popup .art { font-size: 13px; color: var(--secondary-text-color, #666); margin-top: 1px; }
            .popup .zeit { font-size: 13px; color: var(--secondary-text-color, #666); margin-top: 4px; font-variant-numeric: tabular-nums; }
            .popup button.loeschen { margin: 10px 0 0 -6px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px;
                                     border: none; border-radius: 8px; background: none; cursor: pointer; font: inherit; font-size: 14px;
                                     color: var(--error-color, #db4437); }
            .popup button.loeschen svg { width: 16px; height: 16px; fill: currentColor; }
            .popup button.loeschen:hover:not(:disabled) { background: rgba(219,68,55,.1); }
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
            .statusbar .infos { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
            .statusbar .rest { font-variant-numeric: tabular-nums; }
            .statusbar { display: flex; align-items: center; gap: 8px; text-align: center; font-size: 13px;
                         color: var(--secondary-text-color); padding: 4px 8px 4px 14px; line-height: 1.6; border-top: 1px solid var(--divider-color); }
            .statusbar.fehler .status { color: var(--error-color, #db4437); }
            .statusbar .wer { font-weight: 500; }
`, '.wa-history')}</style>
          ${c.title ? `<div class="wa-titel">${esc(c.title)}</div>` : ''}
          <div class="controls">
            <div class="zone links">
              <div class="personWahl">
                ${this._persons.map((p) => `<button class="person p-${p.key}${this._hidden.has(p.id) ? '' : ' aktiv'}" data-wert="${esc(p.id)}" aria-pressed="${this._hidden.has(p.id) ? 'false' : 'true'}" title="${esc(t(this._hidden.has(p.id) ? 'show_person' : 'hide_person', { name: p.name }))}">${esc(p.name)}</button>`).join('')}
              </div>
            </div>
            <div class="zone mitte">
              <div class="segmented modus">
                <button class="segment${this._range ? '' : ' aktiv'}" data-modus="day">${esc(t('mode_day'))}</button>
                <button class="segment${this._range ? ' aktiv' : ''}" data-modus="range">${esc(t('mode_range'))}</button>
              </div>
              <button class="prevDay" title="${esc(t(this._range ? 'prev_range' : 'prev_day'))}" aria-label="${esc(t('prev_day'))}">&larr;</button>
              <input type="date" class="datum" aria-label="${esc(t('date'))}">
              <span class="bis-feld"${this._range ? '' : ' hidden'}><span class="bis">–</span><input type="date" class="datum-bis" aria-label="${esc(t('to'))}"></span>
              <button class="nextDay" title="${esc(t(this._range ? 'next_range' : 'next_day'))}" aria-label="${esc(t('next_day'))}">&rarr;</button>
              <button class="today">${esc(t('today'))}</button>
            </div>
            <div class="zone rechts">
              <div class="aktionen">
                <button class="auswahlBtn" style="display:none;">${esc(t('multi_select'))}</button>
                <button class="ansicht"></button>
                ${c.show_export ? `<button class="icon herunterladen" title="${esc(t('download_title'))}" aria-label="${esc(t('download_title'))}">${DOWNLOAD_ICON}</button>` : ''}
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
          <div class="niemand" hidden>${esc(t('no_person_selected'))}</div>
          <div class="statusbar">
            <div class="infos"><span class="status"></span>
              <span class="rest"></span>
            </div>
            <button class="neuladen" title="${esc(t('reload_now'))}" aria-label="${esc(t('reload_now'))}">
              <svg class="ringe" viewBox="0 0 34 34" aria-hidden="true"><circle class="ring-hg" cx="17" cy="17" r="15"/><circle class="ring" cx="17" cy="17" r="15"/></svg>
              <svg class="pfeil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
          </div>
        </ha-card>`;

      this._updateDateControls();
      this.querySelectorAll('.personWahl .person').forEach((button) => {
        button.addEventListener('click', () => this._togglePerson(button.dataset.wert));
      });
      this.querySelectorAll('.modus .segment').forEach((b) => b.addEventListener('click', () => this._setRange(b.dataset.modus === 'range')));
      // Typing reports every digit (e.g. year "0002"): wait a moment and ignore unfinished years.
      const watch = (field, apply, current) => {
        field.addEventListener('change', (e) => {
          clearTimeout(this._dateTimer);
          const value = e.target.value;
          if (value && Number(value.slice(0, 4)) < 2000) return;
          this._dateTimer = setTimeout(() => apply(value), 400);
        });
        field.addEventListener('blur', (e) => {
          clearTimeout(this._dateTimer);
          const value = e.target.value;
          const unfinished = value && Number(value.slice(0, 4)) < 2000;
          if (unfinished || value !== current()) apply(unfinished ? '' : value);
        });
      };
      watch(this.querySelector('.datum'), (v) => {
        if (!this._range) { this._setPeriod(v, v); return; }
        // Moving the first day keeps the length when possible.
        this._setPeriod(v, this._valid(v) ? this._addDays(v, this._days(this._date, this._to) - 1) : this._to);
      }, () => this._date);
      watch(this.querySelector('.datum-bis'), (v) => this._setPeriod(this._date, v, 'to'), () => this._to);
      this.querySelector('.today').addEventListener('click', () => this._today());
      this.querySelector('.prevDay').addEventListener('click', () => this._step(-1));
      this.querySelector('.nextDay').addEventListener('click', () => this._step(1));
      const download = this.querySelector('.herunterladen');
      if (download) download.addEventListener('click', () => this._download());
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
      this.querySelector('.loeschenBtn').addEventListener('click', () => this._delete([...this._selected], this.querySelector('.loeschenBtn')));
      this._initMap();
    }

    async _initMap() {
      try {
        await S.loadLeaflet();
        await S.waitForCss(this);
        const home = this._hass.config || {};
        const mapDiv = this.querySelector('.wa-map');
        this._map = window.L.map(mapDiv, { zoomControl: false }).setView([home.latitude || 0, home.longitude || 0], 14);
        window.L.control.zoom({ position: 'bottomright', zoomInTitle: this._t('zoom_in'), zoomOutTitle: this._t('zoom_out') }).addTo(this._map);
        this._setTiles(S.isDark(this._hass, this._config.map_style));
        S.watchZoneNames(this._map, mapDiv, this._config);
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
      this._dark = dark;
      const box = this.querySelector('.wa-map');
      const notice = this._info && this._info.is_admin ? S.fallbackNotice(box, this._t) : null;
      this._tiles = S.setTiles(this._map, this._tiles, this._config, dark, box, notice);
    }

    _drawZones() {
      const signature = S.zoneSignature(this._hass, this._config);
      if (signature === this._zoneSignature && (this._zoneLayer || !this._config.show_zones)) return;
      this._zoneSignature = signature;
      this._zoneLayer = S.drawZones(this._map, this._zoneLayer, this._hass, this._config, this._t);
      this._zoneLayer.eachLayer((layer) => layer.bringToBack && layer.bringToBack());
    }

    // --- data ---------------------------------------------------------------------------
    // Person button: hide or show (only until reload); the map zooms to what is left.
    _togglePerson(id) {
      const person = this._personById(id);
      if (!person) return;
      if (this._hidden.has(id)) this._hidden.delete(id); else this._hidden.add(id);
      const on = !this._hidden.has(id);
      const button = this.querySelector(`.personWahl .p-${person.key}`);
      if (button) {
        button.classList.toggle('aktiv', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        button.title = this._t(on ? 'hide_person' : 'show_person', { name: person.name });
      }
      [...this._selected].forEach((k) => { if (k.startsWith(`${id}|`) && !on) this._selected.delete(k); });
      this._renderStatusText();
      this._updateView();
      this._updateSelection();
      this._drawMap(true);
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
      const persons = this._persons;
      const day = this._date;
      const last = this._to;
      const request = (p) => (last !== day
        ? { type: 'whereabouts/history', person: p.id, date: day, date_to: last }
        : { type: 'whereabouts/history', person: p.id, date: day });
      // allSettled: if one person fails, the others are still shown.
      const results = await Promise.allSettled(persons.map((p) => this._hass.callWS(request(p))));
      if (number !== this._loadNo) return; // something newer was requested meanwhile
      this._loadedAt = new Date();

      const points = [];
      const failed = [];
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          failed.push(persons[i].name);
          console.error('Whereabouts: loading failed for', persons[i].id, result.reason);
          return;
        }
        (result.value.stays || []).forEach((s) => points.push({
          person: persons[i].id, date: s.date || day, time: s.start, end: s.end, state: s.state,
          lat: s.latitude, lon: s.longitude, address: s.address, times: s.times,
        }));
      });
      const order = (p) => `${p.date} ${p.time}`;
      points.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : a.person.localeCompare(b.person)));

      const signature = `${day}|${last}|${points.map((p) => `${this._keyOf(p)}${p.end}${p.address}`).join(',')}`;
      if (options.onlyIfChanged && signature === this._signature && !failed.length) return;
      this._signature = signature;

      this._points = points;
      this._anchor = null;
      this._lastRange = null;
      const present = new Set(points.map((p) => this._keyOf(p)));
      this._selected.forEach((k) => { if (!present.has(k)) this._selected.delete(k); });

      this._failed = failed;
      this.querySelector('.leer').textContent = failed.length ? t('load_failed') : t(last !== day ? 'no_data_range' : 'no_data');
      bar.classList.toggle('fehler', failed.length > 0);
      this._renderStatusText();

      this._updateView();
      this._updateSelection();
      this._drawMap(fit);
    }

    // Status bar: names in their colour with the number of entries, then the period / times.
    _renderStatusText() {
      const t = this._t;
      const esc = S.escapeHtml;
      const status = this.querySelector('.status');
      if (!status) return;
      const failed = this._failed || [];
      const persons = this._visiblePersons().filter((p) => !failed.includes(p.name));
      const points = this._visiblePoints();
      const parts = [];
      const multiDay = this._to !== this._date;
      if (!persons.length && !failed.length) parts.push(esc(t('no_person_selected')));
      else if (!points.length) { if (!failed.length) parts.push(esc(t(multiDay ? 'no_data_range' : 'no_data'))); }
      else if (persons.length > 1 || this._persons.length > 1) {
        parts.push(persons.map((p) => `<span class="wer p-${p.key}">${esc(p.name)}</span>: ${esc(this._countText(points.filter((x) => x.person === p.id).length))}`).join(' · '));
      } else parts.push(esc(this._countText(points.length)));
      let text = parts.join('');
      if (multiDay) {
        text += `${text ? ' — ' : ''}${esc(t('range', { from: this._dayText(this._date, false), to: this._dayText(this._to, false) }))}`;
      } else if (points.length) {
        const end = points.reduce((max, p) => ((p.end || p.time) > max ? (p.end || p.time) : max), '');
        text += ` — ${esc(t('time', { time: t('range', { from: points[0].time.slice(0, 5), to: end.slice(0, 5) }) }))}`;
      }
      if (failed.length) text += (text ? ' · ' : '') + esc(t('error_for', { names: failed.join(', ') }));
      if (this._mapError) text += (text ? ' · ' : '') + esc(t('map_unavailable'));
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
      });
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
      const mapDiv = this.querySelector('.wa-map');
      let hint = mapDiv.querySelector('.niemand-hinweis');
      const nobody = !this._visiblePersons().length;
      if (nobody && !hint) {
        hint = document.createElement('div');
        hint.className = 'niemand-hinweis';
        hint.innerHTML = `<span>${S.escapeHtml(this._t('no_person_selected'))}</span>`;
        mapDiv.appendChild(hint);
      } else if (!nobody && hint) hint.remove();
      if (!this._visiblePoints().length) return;

      const L = window.L;
      this._routeLayer = L.featureGroup();
      this._markerLayer = L.layerGroup();
      // Each person in its colour: line and small points; start = white circle with ▶, end = coloured circle with flag.
      // A period is one continuous route over all its days.
      this._visiblePersons().forEach((person) => {
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
          marker.bindPopup(() => this._popup(p), { className: 'wa-eintrag', closeButton: false, minWidth: 220, maxWidth: 300 });
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
      if (!this._config.show_legend || !this._visiblePersons().length) return;
      const legend = window.L.control({ position: 'bottomleft' });
      legend.onAdd = () => {
        const div = window.L.DomUtil.create('div', 'legende');
        div.innerHTML = this._visiblePersons().map((p) =>
          `<div class="eintrag"><span class="linie" style="background:${p.color}"></span>${S.escapeHtml(p.name)}</div>`).join('')
          + `<div class="eintrag hinweis">${this._symbol('start', '#666', 18)}${S.escapeHtml(this._t('start'))}`
          + `<span class="abstand"></span>${this._symbol('end', '#666', 18)}${S.escapeHtml(this._t('end'))}</div>`;
        return div;
      };
      legend.addTo(this._map);
      this._legend = legend;
    }

    // Header: colour dot, name, close; the place large; time and duration small; delete as a red text button.
    _popup(p) {
      const t = this._t;
      const person = this._personById(p.person);
      const box = document.createElement('div');
      box.className = 'popup';
      const head = document.createElement('div');
      head.className = 'kopf';
      const dot = document.createElement('span');
      dot.className = 'punkt';
      dot.style.background = person.color;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = person.name;
      const close = document.createElement('button');
      close.className = 'zu';
      close.type = 'button';
      close.title = t('close');
      close.setAttribute('aria-label', t('close'));
      close.innerHTML = CLOSE;
      close.addEventListener('click', (e) => { e.stopPropagation(); this._map.closePopup(); });
      head.append(dot, name, close);
      const place = document.createElement('div');
      place.className = 'ort';
      const away = p.state === 'not_home' && p.address;
      place.textContent = away ? p.address : S.placeText(t, p.state);
      box.append(head, place);
      if (away) {
        const kind = document.createElement('div');
        kind.className = 'art';
        kind.textContent = S.placeText(t, p.state);
        box.appendChild(kind);
      }
      const time = document.createElement('div');
      time.className = 'zeit';
      const duration = this._durationText(p);
      time.textContent = [this._to !== this._date ? this._dayText(p.date) : '', this._timeText(p), duration].filter(Boolean).join(' · ');
      box.appendChild(time);
      if (person.canDelete) {
        const button = document.createElement('button');
        button.className = 'loeschen';
        button.type = 'button';
        button.innerHTML = `${BIN}<span>${S.escapeHtml(t('delete_entry'))}</span>`;
        button.addEventListener('click', (e) => { e.stopPropagation(); this._delete([this._keyOf(p)], button); });
        box.appendChild(button);
      }
      return box;
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
      const withDate = this._to !== this._date;
      const rowStyle = (c) => `--zeile-bg:${c}14;--zeile-hover:${c}29;--zeile-sel:${c}47;--zeile-farbe:${c}`;
      let html = '<table><thead><tr>';
      if (this._selectMode) html += '<th class="wahl"></th>';
      if (withDate) html += `<th>${S.escapeHtml(t('col_date'))}</th>`;
      html += `<th>${S.escapeHtml(t('col_time'))}</th>`;
      if (withPerson) html += `<th>${S.escapeHtml(t('col_person'))}</th>`;
      html += `<th>${S.escapeHtml(t('col_place'))}</th><th>${S.escapeHtml(t('col_lat'))}</th><th>${S.escapeHtml(t('col_lon'))}</th></tr></thead><tbody>`;
      points.forEach((p, i) => {
        const person = this._personById(p.person);
        const key = this._keyOf(p);
        const classes = [];
        if (this._selectMode && person.canDelete) classes.push('waehlbar');
        if (this._selectMode && this._selected.has(key)) classes.push('gewaehlt');
        html += `<tr data-key="${S.escapeHtml(key)}" data-index="${i}" class="${classes.join(' ')}" style="${rowStyle(person.color)}">`;
        if (this._selectMode) html += `<td class="wahl">${CHECK}</td>`;
        if (withDate) html += `<td>${S.escapeHtml(this._dayText(p.date))}</td>`;
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
      const own = this._rows[index] && this._personById(this._rows[index].person);
      if (!own || !own.canDelete) return; // only entries the user may delete can be selected
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
        for (let i = from; i <= to; i++) {
          if (this._personById(this._rows[i].person).canDelete) this._selected.add(this._keyOf(this._rows[i]));
        }
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
      const all = this._visiblePoints().filter((p) => this._personById(p.person).canDelete).map((p) => this._keyOf(p));
      const allSelected = all.length > 0 && all.every((k) => this._selected.has(k));
      if (allSelected) this._selected.clear();
      else all.forEach((k) => this._selected.add(k));
      this._renderTable();
      this._updateSelection();
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
      const nobody = !this._visiblePersons().length;
      const none = this._visiblePoints().length === 0 && !nobody;
      empty.style.display = none ? 'block' : 'none';
      const noPerson = this.querySelector('.niemand');
      noPerson.hidden = !(nobody && this._tableView);
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
        map.style.display = none ? 'none' : 'block'; // nobody shown: empty map with a hint
        table.style.display = 'none';
        button.textContent = t('show_table');
        button.classList.remove('aktiv');
        selectButton.style.display = 'none';
        if (this._map && !none && !nobody) {
          setTimeout(() => { if (this._staleView) this._fit(); else this._map.invalidateSize(); }, 0);
        }
      }
      this._layout();
    }
  }

  if (!customElements.get('whereabouts-history-card')) customElements.define('whereabouts-history-card', WhereaboutsHistoryCard);
}
