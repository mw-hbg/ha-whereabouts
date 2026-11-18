// Whereabouts – "Where is…?" card: all persons live on a map with an info bar.
// Data comes only from the Home Assistant states (nothing is stored).

export const LIVE_DEFAULTS = {
  title: '',
  persons: [],
  show_info_bar: true,
  show_status_bar: true,
  show_accuracy: true,
  auto_refresh: true,
  refresh_interval: 30,
  follow: true,
};

const MAX_ACCURACY = 1000; // larger accuracy circles are not drawn
const CLUSTER_PX = 46; // pins closer than this (on screen) become one pin
const AVATAR = 38; // size of a picture in a pin

export function defineLiveCard(S) {
  class WhereaboutsLiveCard extends HTMLElement {
    static getConfigElement() {
      const el = document.createElement('whereabouts-card-editor');
      el.kind = 'live';
      return el;
    }

    static getStubConfig() {
      return { type: 'custom:whereabouts-live-card' };
    }

    constructor() {
      super();
      this._map = null;
      this._tiles = [];
      this._markers = {};
      this._circles = {};
      this._groups = [];
      this._panel = null;
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._follow = true;
      this._last = {};
      this._dark = null;
      this._programmatic = false;
    }

    setConfig(config) {
      this._raw = { ...(config || {}) };
      this._applyConfig();
      // Changed in the editor: draw again with the new settings
      if (this._info) { this._infoSig = null; this._onInfo(this._info); }
    }

    _applyConfig() {
      this._config = S.cardConfig(LIVE_DEFAULTS, this._info && this._info.settings, this._raw, 'live');
      this._follow = this._config.follow !== false;
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._started) {
        this._started = true;
        this._start();
        return;
      }
      if (!this._ready) return;
      const dark = S.isDark(hass, this._config.map_style);
      if (this._map && dark !== this._dark) this._setTiles(dark);
      if (this._changed()) this._update();
    }

    connectedCallback() {
      if (this._config && this._ready) S.applyHeight(this, this._config);
      if (this._ready) {
        this._startBackground();
        if (this._map) setTimeout(() => this._map && this._map.invalidateSize(), 0);
      }
    }

    disconnectedCallback() {
      this._stopBackground();
      this._closePanel(false);
    }

    getCardSize() {
      return 8;
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
      const sig = JSON.stringify([info.available, info.live_card, info.shown, info.settings]);
      if (sig === this._infoSig) return;
      this._infoSig = sig;
      this._info = info;
      this._applyConfig();
      this._teardown();
      if (!info.available) { this.innerHTML = S.messageHtml(this._t('not_set_up')); return; }
      if (!info.live_card) { this.innerHTML = S.messageHtml(this._t('card_off')); return; }
      this._persons = this._personList();
      if (!this._persons.length) { this.innerHTML = S.messageHtml(this._t('no_persons')); return; }
      this._build();
      this._ready = true;
      this._startBackground();
    }

    _teardown() {
      this._stopBackground();
      if (this._map) this._map.remove();
      this._map = null;
      this._tiles = [];
      this._markers = {};
      this._circles = {};
      this._groups = [];
      this._panel = null;
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._last = {};
      this._ready = false;
      this.innerHTML = '';
    }

    // Shown persons of the integration, narrowed by the card's own selection
    _personList() {
      const shown = this._info.shown || [];
      const configured = (this._config.persons || []).filter((id) => shown.includes(id));
      const ids = configured.length ? configured : shown;
      return ids.map((id) => ({
        id,
        key: id.replace(/[^a-z0-9_]/gi, '_'),
        name: S.personName(this._hass, this._config, id),
        color: S.safeColor(S.personColor(this._hass, this._config, id), S.PALETTE[0]),
        picture: S.safeUrl(S.personSettings(this._config, id).picture),
        sensor: S.personSettings(this._config, id).address_sensor || null,
      }));
    }

    _sensorFor(p) {
      if (p.sensor) return p.sensor;
      if (p.autoSensor === undefined) p.autoSensor = S.findAddressSensor(this._hass, this._hass.states[p.id]);
      return p.autoSensor;
    }

    // --- background -----------------------------------------------------------
    _startBackground() {
      this._stopBackground();
      const mapDiv = this.querySelector('.wa-map');
      if (mapDiv && window.ResizeObserver) {
        this._resizeObserver = new ResizeObserver(() => {
          if (!this._map) return;
          this._map.invalidateSize();
          if (this._follow) this._fitAll(false);
        });
        this._resizeObserver.observe(mapDiv);
      }
      this._auto = this._config.auto_refresh !== false;
      this._interval = Math.max(5, Number(this._config.refresh_interval) || 30);
      this._rest = this._interval;
      this._tick = setInterval(() => {
        if (!this._auto) { this._renderCountdown(); return; }
        this._rest -= 1;
        if (this._rest <= 0) this._reload();
        else this._renderCountdown();
      }, 1000);
    }

    _stopBackground() {
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
      if (this._tick) { clearInterval(this._tick); this._tick = null; }
    }

    // Redraw only when one of the watched entities changed.
    _changed() {
      const states = this._hass.states;
      let changed = false;
      this._persons.forEach((p) => {
        const trackers = (states[p.id] && states[p.id].attributes.device_trackers) || [];
        [p.id, this._sensorFor(p), ...trackers].filter(Boolean).forEach((id) => {
          if (states[id] !== this._last[id]) { changed = true; this._last[id] = states[id]; }
        });
      });
      if (S.zoneSignature(this._hass, this._config) !== this._zoneSignature) changed = true;
      return changed;
    }

    // --- layout ---------------------------------------------------------------
    _build() {
      const t = this._t;
      const c = this._config;
      this.style.display = 'block';
      S.applyHeight(this, c);
      const personCss = this._persons.map((p) => `.wa-live .p-${p.key} { --farbe: ${p.color}; }`).join('\n');
      const title = c.title || '';
      this.innerHTML = `
        ${S.leafletCss()}
        <style>${S.scopeCss(`
          ${S.MAP_CSS}
          .wa-live { height: 100%; width: 100%; display: flex; flex-direction: column; overflow: hidden;
                     font-family: var(--paper-font-body1_-_font-family, inherit); border-radius: var(--ha-card-border-radius, 12px);
                     --wa-glas: rgba(255,255,255,.86); --wa-text: #1d1d1f; --wa-leise: #5f6368; color: var(--wa-text); }
          .wa-live.dark { --wa-glas: rgba(32,33,36,.84); --wa-text: #f1f3f4; --wa-leise: #b0b4b9; }
          ${personCss}
          .wa-titel { padding: 10px 14px; font-size: 1.1em; font-weight: 600; color: var(--primary-text-color);
                      background: var(--card-background-color); border-bottom: 1px solid var(--divider-color); }
          .bereich { position: relative; flex: 1 1 auto; min-height: 0; }
          .wa-map { position: absolute; inset: 0; z-index: 0; }
          .leiste { position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000;
                    display: flex; gap: 10px; align-items: stretch; pointer-events: none; }
          .person { pointer-events: auto; flex: 1 1 0; min-width: 0; display: flex; gap: 12px; align-items: center;
                    padding: 10px 14px; border-radius: 14px; cursor: pointer; text-align: left;
                    border: none; border-left: 5px solid var(--farbe); font: inherit; color: inherit;
                    background: var(--wa-glas); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                    box-shadow: 0 2px 10px rgba(0,0,0,.18); transition: transform .1s; }
          .person:active { transform: scale(.985); }
          .person:focus-visible { outline: 2px solid var(--farbe); outline-offset: 2px; }
          .bild { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 50%; border: 3px solid var(--farbe);
                  background: var(--farbe) center/cover no-repeat; color: #fff; font-weight: 700; font-size: 20px;
                  display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
          .text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
          .kopf { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
          .name { font-weight: 700; font-size: 1.15em; color: var(--farbe); }
          .status { font-weight: 600; }
          .status .seit { font-weight: 400; color: var(--wa-leise); }
          .adresse, .ortung { font-size: .92em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .ortung { color: var(--wa-leise); }
          .wa-marker { background: none; border: none; }
          .wa-marker .pin { position: relative; display: inline-flex; flex-wrap: wrap; gap: 3px; padding: 3px; box-sizing: border-box;
                            border-radius: 999px; background: var(--rand); box-shadow: 0 2px 7px rgba(0,0,0,.4); cursor: pointer;
                            transition: transform .15s; }
          .wa-marker .pin:hover { transform: translateY(-2px); }
          .wa-marker .pin.raster { border-radius: 24px; width: ${2 * AVATAR + 9}px; }
          .wa-marker .rund { width: ${AVATAR}px; height: ${AVATAR}px; border-radius: 50%; box-sizing: border-box;
                             border: 2px solid rgba(255,255,255,.9); background: var(--farbe) center/cover no-repeat;
                             color: #fff; font-weight: 700; font-size: 17px;
                             display: flex; align-items: center; justify-content: center; }
          .wa-marker .rund.mehr { background: rgba(0,0,0,.55); font-size: 14px; }
          .wa-marker .spitze { position: absolute; left: 50%; bottom: -8px; transform: translateX(-50%);
                               width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent;
                               border-top: 10px solid var(--spitze); }
          .infofenster { position: absolute; z-index: 1100; left: 0; top: 0; width: min(320px, calc(100% - 16px)); box-sizing: border-box;
                         padding: 12px 14px 12px; border-radius: 14px; background: var(--wa-glas); color: var(--wa-text);
                         backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 6px 22px rgba(0,0,0,.28);
                         transform-origin: 0 0; will-change: transform, opacity; }
          .infofenster[hidden] { display: none; }
          .infofenster.gleitet { transition: transform .45s cubic-bezier(.2,.85,.25,1), opacity .3s ease-out; }
          .infofenster.weg { transition: transform .2s ease-in, opacity .2s ease-in; opacity: 0; }
          .infofenster .zipfel { position: absolute; bottom: -9px; width: 0; height: 0; margin-left: -9px;
                                 border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 9px solid var(--wa-glas); }
          .infofenster .zu { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; border: none; border-radius: 50%;
                             background: transparent; color: var(--wa-leise); cursor: pointer; font-size: 20px; line-height: 1;
                             display: flex; align-items: center; justify-content: center; }
          .infofenster .zu:hover { background: rgba(127,127,127,.18); color: var(--wa-text); }
          .infofenster .eintrag + .eintrag { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(127,127,127,.25); }
          .infofenster .eintrag { display: flex; gap: 10px; align-items: flex-start; }
          .infofenster .eintrag:first-of-type { padding-right: 26px; }
          .infofenster .bild { width: 36px; height: 36px; font-size: 15px; border-width: 2px; }
          .infofenster .zeilen { min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: .92em; line-height: 1.35; }
          .infofenster .wer { font-weight: 700; color: var(--farbe); font-size: 1.08em; }
          .infofenster .ort { font-weight: 600; overflow-wrap: anywhere; }
          .infofenster .ort .seit, .infofenster .leise { font-weight: 400; color: var(--wa-leise); }
          .infofenster.unten .zipfel { bottom: auto; top: -9px; border-top: none; border-bottom: 9px solid var(--wa-glas); }
          .infofenster.rechts .zipfel, .infofenster.links .zipfel { bottom: auto; margin: -9px 0 0; border: 9px solid transparent; }
          .infofenster.rechts .zipfel { left: -18px !important; border-right-color: var(--wa-glas); }
          .infofenster.links .zipfel { left: auto !important; right: -18px; border-left-color: var(--wa-glas); }
          .infofenster a { color: inherit; text-decoration: underline dotted; text-underline-offset: 2px; font-variant-numeric: tabular-nums; }
          .infofenster a:hover { color: var(--primary-color, #03a9f4); text-decoration-style: solid; }
          .wa-live .leaflet-bottom.leaflet-right .leaflet-control-zoom { margin-bottom: 24px; }
          .statusbar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 14px;
                       font-size: 13px; color: var(--secondary-text-color, var(--wa-leise));
                       background: var(--card-background-color, var(--wa-glas));
                       border-top: 1px solid var(--divider-color, rgba(0,0,0,.12)); }
          .statusbar .infos { flex: 1 1 auto; min-width: 0; text-align: center; line-height: 1.6; }
          .statusbar .eintrag { white-space: nowrap; }
          .statusbar .trenner { margin: 0 6px; opacity: .6; }
          .statusbar .wer { font-weight: 600; color: var(--farbe); }
          .statusbar a { color: inherit; text-decoration: underline dotted; text-underline-offset: 2px; font-variant-numeric: tabular-nums; }
          .statusbar a:hover { color: var(--primary-color, #03a9f4); text-decoration-style: solid; }
          .statusbar .zahl { font-variant-numeric: tabular-nums; }
          .neuladen { flex: 0 0 auto; position: relative; width: 34px; height: 34px; border: none; border-radius: 50%;
                      background: transparent; color: var(--primary-text-color, var(--wa-text)); cursor: pointer;
                      display: flex; align-items: center; justify-content: center; padding: 0; }
          .neuladen:hover { background: rgba(127,127,127,.15); }
          .neuladen.ohne-ring svg:not(.pfeil) { display: none; }
          .neuladen svg { position: absolute; inset: 0; width: 34px; height: 34px; }
          .neuladen .ring-hg { fill: none; stroke: rgba(127,127,127,.25); stroke-width: 2; }
          .neuladen .ring { fill: none; stroke: var(--primary-color, #03a9f4); stroke-width: 2; stroke-linecap: round;
                            transform: rotate(-90deg); transform-origin: 17px 17px; transition: stroke-dashoffset 1s linear; }
          .neuladen .pfeil { width: 18px; height: 18px; position: static; }
          .neuladen.dreht .pfeil { animation: wa-drehen .6s ease-in-out; }
          @keyframes wa-drehen { to { transform: rotate(360deg); } }
          @media (max-width: 640px) {
            .leiste { flex-direction: column; top: 8px; left: 8px; right: 8px; gap: 6px; }
            .person { padding: 7px 10px; gap: 10px; border-radius: 12px; }
            .bild { width: 38px; height: 38px; font-size: 16px; border-width: 2px; }
            .name { font-size: 1.05em; }
            .adresse, .ortung { font-size: .86em; }
            .statusbar { padding-left: 8px; font-size: 12px; }
          }
`, '.wa-live')}</style>
        <div class="wa-live">
          ${title ? `<div class="wa-titel">${S.escapeHtml(title)}</div>` : ''}
          <div class="bereich">
            <div class="wa-map"></div>
            <div class="infofenster" hidden role="dialog"></div>
            ${c.show_info_bar ? `<div class="leiste">${this._persons.map((p) => `
              <button class="person p-${p.key}" data-person="${p.key}" type="button" title="${S.escapeHtml(t('jump_to', { name: p.name }))}">
                <div class="bild"></div>
                <div class="text">
                  <div class="kopf"><span class="name">${S.escapeHtml(p.name)}</span><span class="status"></span></div>
                  <div class="adresse"></div>
                  <div class="ortung"></div>
                </div>
              </button>`).join('')}</div>` : ''}
          </div>
          ${c.show_status_bar ? `<div class="statusbar">
            <div class="infos">
              ${this._persons.map((p) => `<span class="eintrag p-${p.key}"><span class="wer">${S.escapeHtml(p.name)}:</span> <a class="koord" target="_blank" rel="noopener noreferrer" title="${S.escapeHtml(t('open_in_map'))}">–</a></span><span class="trenner">·</span>`).join('')}
              <span class="eintrag zuletzt">–</span><span class="trenner">·</span>
              <span class="eintrag rest"></span>
            </div>
            <button class="neuladen" type="button" title="${S.escapeHtml(t('reload_now'))}" aria-label="${S.escapeHtml(t('reload_now'))}">
              <svg viewBox="0 0 34 34" aria-hidden="true"><circle class="ring-hg" cx="17" cy="17" r="15"/><circle class="ring" cx="17" cy="17" r="15"/></svg>
              <svg class="pfeil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4a8 8 0 1 0 7.74 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
          </div>` : ''}
        </div>`;

      this.querySelectorAll('.person').forEach((b) => b.addEventListener('click', () => this._goTo(b.dataset.person)));
      const reload = this.querySelector('.neuladen');
      if (reload) {
        reload.addEventListener('click', () => {
          reload.classList.remove('dreht'); void reload.offsetWidth; reload.classList.add('dreht');
          this._reload();
        });
      }
      this._changed();
      this._renderBar();
      this._renderStatus();
      this._startMap();
    }

    _reload() {
      this._rest = this._interval;
      this._zoneSignature = '';
      this._changed();
      this._update();
    }

    async _startMap() {
      try {
        await S.loadLeaflet();
        await S.waitForCss(this);
        const L = window.L;
        const home = this._hass.config || {};
        const mapDiv = this.querySelector('.wa-map');
        this._map = L.map(mapDiv, { zoomControl: false })
          .setView([home.latitude || 0, home.longitude || 0], 12);
        L.control.zoom({ position: 'bottomright' }).addTo(this._map);
        this._setTiles(S.isDark(this._hass, this._config.map_style));
        ['dragstart', 'zoomstart'].forEach((ev) => this._map.on(ev, () => { if (!this._programmatic) this._setFollow(false); }));
        S.watchZoneNames(this._map, mapDiv, this._config);
        // Pins close together on screen become one pin: group again after zooming.
        this._map.on('zoomend', () => this._drawPersons());
        this._map.on('move zoom', () => this._placePanel(false));
        this._map.on('click', () => this._closePanel(true));
        this._update();
        this._fitAll(false);
      } catch (err) {
        console.error('Whereabouts: map could not be loaded', err);
        const map = this.querySelector('.wa-map');
        if (map) map.innerHTML = `<div style="padding:16px">${S.escapeHtml(this._t('map_unavailable'))}</div>`;
      }
    }

    _setTiles(dark) {
      this._dark = dark;
      this.querySelector('.wa-live').classList.toggle('dark', dark);
      const box = this.querySelector('.wa-map');
      const notice = this._info && this._info.is_admin ? S.fallbackNotice(box, this._t) : null;
      this._tiles = S.setTiles(this._map, this._tiles, this._config, dark, box, notice);
    }

    // --- display ----------------------------------------------------------------
    _update() {
      this._updated = new Date();
      this._renderBar();
      this._renderStatus();
      if (!this._map) return;
      this._drawZones();
      this._drawPersons();
      if (this._follow) this._fitAll(true);
      this._renderPanel();
    }

    _data(p) {
      const states = this._hass.states;
      const st = states[p.id];
      if (!st) return null;
      const pos = S.position(states, st);
      return { st, picture: p.picture || S.safeUrl(st.attributes.entity_picture), pos };
    }

    // Zone name or (away) the Companion app's address
    _placeLine(p, d) {
      const t = this._t;
      if (d.st.state !== 'not_home') return S.placeText(t, d.st.state);
      return S.phoneAddress(this._hass, this._sensorFor(p)) || S.placeText(t, d.st.state);
    }

    _renderBar() {
      const t = this._t;
      this._persons.forEach((p) => {
        const button = this.querySelector(`.leiste .p-${p.key}`);
        if (!button) return;
        const d = this._data(p);
        const status = button.querySelector('.status');
        const address = button.querySelector('.adresse');
        const fix = button.querySelector('.ortung');
        if (!d) {
          status.textContent = t('not_found');
          address.textContent = '';
          fix.textContent = '';
          return;
        }
        this._setPicture(button.querySelector('.bild'), d.picture, p.name);
        status.textContent = `${S.placeText(t, d.st.state)} `;
        const since = document.createElement('span');
        since.className = 'seit';
        since.textContent = t('since', { time: S.sinceText(this._hass, t, d.st.last_changed) });
        status.append(since);
        const text = d.st.state === 'not_home' ? S.phoneAddress(this._hass, this._sensorFor(p)) : '';
        address.textContent = text;
        address.style.display = text ? '' : 'none';
        fix.textContent = t('last_fix', { ago: S.agoText(t, d.st.last_updated) });
        button.title = t('jump_to', { name: p.name }) + (text ? `\n${text}` : '');
      });
    }

    _setPicture(el, url, name) {
      if (el.dataset.url === url) return;
      el.dataset.url = url;
      if (url) { el.style.backgroundImage = `url("${url}")`; el.textContent = ''; }
      else { el.style.backgroundImage = ''; el.textContent = name.charAt(0); }
    }

    _renderStatus() {
      const bar = this.querySelector('.statusbar');
      if (!bar) return;
      const t = this._t;
      this._persons.forEach((p) => {
        const link = bar.querySelector(`.p-${p.key} .koord`);
        const d = this._data(p);
        if (d && d.pos) {
          link.textContent = `${d.pos.lat.toFixed(5)}, ${d.pos.lon.toFixed(5)}`;
          S.bindMapLink(link, this._config, t, d.pos.lat, d.pos.lon);
        } else {
          link.textContent = t('no_position');
          link.removeAttribute('href');
          link.onclick = null;
        }
      });
      this._renderCountdown();
    }

    // Automatic reload: "Updated 14:05:12 · Reload in 12 s" with a ring;
    // switched off: only how current the data is, the button stays.
    _renderCountdown() {
      const t = this._t;
      const bar = this.querySelector('.statusbar');
      if (!bar) return;
      const auto = this._auto !== false;
      const last = bar.querySelector('.zuletzt');
      const rest = bar.querySelector('.rest');
      last.textContent = auto
        ? (this._updated ? t('updated', { time: t('time', { time: S.clock(this._hass, this._updated, true) }) }) : '–')
        : (this._updated ? t('data_as_of', { when: S.standText(this._hass, t, this._updated) }) : '–');
      rest.textContent = auto ? t('reload_in', { n: this._rest }) : '';
      rest.hidden = !auto;
      if (rest.previousElementSibling) rest.previousElementSibling.hidden = !auto;
      const button = bar.querySelector('.neuladen');
      button.classList.toggle('ohne-ring', !auto);
      const ring = button.querySelector('.ring');
      const length = 2 * Math.PI * 15;
      ring.style.strokeDasharray = length.toFixed(2);
      ring.style.strokeDashoffset = (length * (1 - this._rest / this._interval)).toFixed(2);
    }

    // Info bar: move to the person (no zoom out/in), then open the info window.
    _goTo(key) {
      const p = this._persons.find((x) => x.key === key);
      const d = p && this._data(p);
      if (!this._map || !d || !d.pos) return;
      this._setFollow(false);
      const target = [d.pos.lat, d.pos.lon];
      const zoom = Math.max(this._map.getZoom(), 15);
      const point = this._map.latLngToContainerPoint(target);
      const size = this._map.getSize();
      const visible = point.x > 40 && point.x < size.x - 40 && point.y > this._topFree() + 60 && point.y < size.y - 40;
      if (visible && zoom === this._map.getZoom()) { this._openPanel(key); return; }
      this._move(() => this._map.setView(target, zoom, { animate: true, duration: 0.5 }));
      this._map.once('moveend', () => this._openPanel(key));
    }

    _setFollow(on) {
      this._follow = on;
      const button = this.querySelector('.alle');
      if (button) button.classList.toggle('aktiv', on);
    }

    // Map movements from code must not switch following off.
    _move(fn) {
      this._programmatic = true;
      fn();
      clearTimeout(this._moveTimer);
      this._map.once('moveend', () => { this._moveTimer = setTimeout(() => { this._programmatic = false; }, 50); });
    }

    _topFree() {
      const bar = this.querySelector('.leiste');
      return bar ? bar.getBoundingClientRect().height + 30 : 30;
    }

    _fitAll(animate) {
      if (!this._map) return;
      const points = this._persons.map((p) => this._data(p)).filter((d) => d && d.pos).map((d) => [d.pos.lat, d.pos.lon]);
      if (!points.length) return;
      const size = this._map.getSize();
      if (!size.x || !size.y) return;
      this._move(() => {
        if (points.length === 1) this._map.setView(points[0], 16, { animate });
        else {
          this._map.fitBounds(window.L.latLngBounds(points), {
            paddingTopLeft: [50, this._topFree() + 40], paddingBottomRight: [60, 50], maxZoom: 16, animate,
          });
        }
      });
    }

    // --- pins -------------------------------------------------------------------
    // Persons whose pins would overlap on screen form one group (one pin).
    _grouping() {
      const items = this._persons.map((p) => ({ p, d: this._data(p) })).filter((x) => x.d && x.d.pos);
      const groups = [];
      items.forEach((item) => {
        item.pt = this._map.latLngToLayerPoint([item.d.pos.lat, item.d.pos.lon]);
        const group = groups.find((g) => g.items.some((o) => o.pt.distanceTo(item.pt) < CLUSTER_PX));
        if (group) group.items.push(item); else groups.push({ items: [item] });
      });
      groups.forEach((g) => {
        g.key = g.items.map((x) => x.p.key).join('+');
        g.lat = g.items.reduce((sum, x) => sum + x.d.pos.lat, 0) / g.items.length;
        g.lon = g.items.reduce((sum, x) => sum + x.d.pos.lon, 0) / g.items.length;
      });
      return groups;
    }

    _avatar(p, picture) {
      return picture
        ? `<div class="rund" style="--farbe:${p.color};background-image:url(&quot;${S.escapeHtml(picture)}&quot;)"></div>`
        : `<div class="rund" style="--farbe:${p.color}">${S.escapeHtml(p.name.charAt(0))}</div>`;
    }

    _icon(group) {
      const items = group.items;
      const n = items.length;
      const grid = n >= 4;
      const shown = n > 4 ? items.slice(0, 3) : items;
      const colors = items.map((x) => x.p.color);
      const rand = n === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(', ')})`;
      const tip = colors[Math.floor((n - 1) / 2)];
      const avatars = shown.map((x) => this._avatar(x.p, x.d.picture)).join('')
        + (n > 4 ? `<div class="rund mehr">+${n - 3}</div>` : '');
      const columns = grid ? 2 : n;
      const width = columns * AVATAR + (columns - 1) * 3 + 6;
      const height = (grid ? 2 : 1) * AVATAR + (grid ? 3 : 0) + 6;
      return window.L.divIcon({
        className: 'wa-marker',
        html: `<div class="pin${grid ? ' raster' : ''}" style="--rand:${rand};--spitze:${tip}">${avatars}<div class="spitze"></div></div>`,
        iconSize: [width, height], iconAnchor: [width / 2, height + 9],
      });
    }

    _drawPersons() {
      if (!this._map) return;
      const L = window.L;
      this._groups = this._grouping();
      const keep = new Set();
      this._groups.forEach((g, i) => {
        keep.add(g.key);
        const signature = g.items.map((x) => `${x.p.key}|${x.d.picture}|${x.p.color}`).join(';');
        const old = this._markers[g.key];
        if (old && old._waSig === signature) { old.setLatLng([g.lat, g.lon]); return; }
        if (old) this._map.removeLayer(old);
        const marker = L.marker([g.lat, g.lon], {
          icon: this._icon(g), zIndexOffset: 1000 + i, keyboard: false, title: g.items.map((x) => x.p.name).join(', '),
        }).addTo(this._map);
        marker._waSig = signature;
        marker.on('click', (e) => { if (e.originalEvent) window.L.DomEvent.stopPropagation(e.originalEvent); this._openPanel(g.items[0].p.key); });
        this._markers[g.key] = marker;
      });
      Object.keys(this._markers).forEach((key) => {
        if (!keep.has(key)) { this._map.removeLayer(this._markers[key]); delete this._markers[key]; }
      });
      this._drawCircles();
      this._placePanel(false);
    }

    _drawCircles() {
      const L = window.L;
      this._persons.forEach((p) => {
        const d = this._data(p);
        const circle = d && d.pos && this._config.show_accuracy && d.pos.accuracy > 0
          && d.pos.accuracy <= MAX_ACCURACY && d.st.state === 'not_home';
        if (circle) {
          const pos = [d.pos.lat, d.pos.lon];
          if (!this._circles[p.key]) {
            this._circles[p.key] = L.circle(pos, {
              radius: d.pos.accuracy, color: p.color, weight: 1, opacity: 0.6, fillColor: p.color, fillOpacity: 0.12, interactive: false,
            }).addTo(this._map);
          } else {
            this._circles[p.key].setLatLng(pos).setRadius(d.pos.accuracy);
          }
        } else if (this._circles[p.key]) {
          this._map.removeLayer(this._circles[p.key]);
          delete this._circles[p.key];
        }
      });
    }

    // --- info window ----------------------------------------------------------------
    _groupOf(key) {
      return this._groups.find((g) => g.items.some((x) => x.p.key === key));
    }

    // Slides from the person's entry in the info bar (or from the top) to the pin.
    _openPanel(key) {
      const group = this._groupOf(key);
      const box = this.querySelector('.infofenster');
      if (!group || !box) return;
      const same = this._panel && this._panel.key === key && !box.hidden;
      this._panel = { key };
      this._renderPanel();
      box.hidden = false;
      box.classList.remove('gleitet', 'weg');
      this._makeRoom();
      this._placePanel(false);
      if (same) return;
      const area = this.querySelector('.bereich').getBoundingClientRect();
      const end = box.getBoundingClientRect();
      const source = this.querySelector(`.leiste .p-${key}`);
      let from;
      if (source && source.offsetParent) {
        const r = source.getBoundingClientRect();
        from = { x: r.left - area.left, y: r.top - area.top, w: r.width, h: r.height };
      } else {
        from = { x: (area.width - end.width) / 2, y: -end.height, w: end.width, h: end.height };
      }
      const to = { x: end.left - area.left, y: end.top - area.top };
      const sx = Math.max(0.3, from.w / end.width);
      const sy = Math.max(0.2, from.h / end.height);
      box.style.transform = `translate(${from.x}px, ${from.y}px) scale(${sx}, ${sy})`;
      box.style.opacity = '0.4';
      void box.offsetWidth;
      box.classList.add('gleitet');
      box.style.transform = `translate(${to.x}px, ${to.y}px)`;
      box.style.opacity = '1';
      clearTimeout(this._panelTimer);
      this._panelTimer = setTimeout(() => box.classList.remove('gleitet'), 480);
    }

    _closePanel(animate) {
      const box = this.querySelector('.infofenster');
      if (!this._panel || !box) return;
      this._panel = null;
      clearTimeout(this._panelTimer);
      if (!animate) { box.hidden = true; return; }
      box.classList.remove('gleitet');
      box.classList.add('weg');
      box.style.transform += ' translateY(-12px)';
      this._panelTimer = setTimeout(() => { box.hidden = true; box.classList.remove('weg'); box.style.opacity = ''; }, 210);
    }

    _renderPanel() {
      const box = this.querySelector('.infofenster');
      if (!this._panel || !box) return;
      const group = this._groupOf(this._panel.key);
      if (!group) { this._closePanel(false); return; }
      const t = this._t;
      const esc = S.escapeHtml;
      box.innerHTML = `<button class="zu" type="button" title="${esc(t('close'))}" aria-label="${esc(t('close'))}">&times;</button>`
        + group.items.map(({ p, d }) => `
          <div class="eintrag" style="--farbe:${p.color}">
            <div class="bild"></div>
            <div class="zeilen">
              <div class="wer">${esc(p.name)}</div>
              <div class="ort">${esc(this._placeLine(p, d))} <span class="seit">${esc(t('since', { time: S.sinceText(this._hass, t, d.st.last_changed) }))}</span></div>
              <div class="leise">${esc(t('info_seen'))} ${esc(S.agoText(t, d.st.last_updated))} · ${esc(t('time', { time: S.clock(this._hass, new Date(d.st.last_updated)) }))}</div>
              <div><a class="koord" data-person="${p.key}" title="${esc(t('open_in_map'))}">${d.pos.lat.toFixed(5)}, ${d.pos.lon.toFixed(5)}</a>${d.pos.accuracy > 0 ? ` <span class="leise">± ${Math.round(d.pos.accuracy)} m</span>` : ''}</div>
            </div>
          </div>`).join('')
        + '<div class="zipfel"></div>';
      group.items.forEach(({ p, d }) => {
        const entry = box.querySelector(`.koord[data-person="${p.key}"]`);
        S.bindMapLink(entry, this._config, t, d.pos.lat, d.pos.lon);
        this._setPicture(entry.closest('.eintrag').querySelector('.bild'), d.picture, p.name);
      });
      box.querySelector('.zu').addEventListener('click', (e) => { e.stopPropagation(); this._closePanel(true); });
      ['click', 'dblclick', 'mousedown', 'touchstart', 'wheel'].forEach((ev) => box.addEventListener(ev, (e) => e.stopPropagation()));
      this._placePanel(false);
    }

    // Where the window sits: above the pin (below the info bar if possible),
    // otherwise below the pin; the map moves only if neither fits.
    _panelPosition() {
      const group = this._panel && this._groupOf(this._panel.key);
      const box = this.querySelector('.infofenster');
      if (!group || !box || !this._map) return null;
      const marker = this._markers[group.key];
      const iconHeight = marker ? marker.options.icon.options.iconSize[1] + 9 : 50;
      const gap = (marker ? marker.options.icon.options.iconSize[0] / 2 : 22) + 14;
      const pt = this._map.latLngToContainerPoint([group.lat, group.lon]);
      const size = this._map.getSize();
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      let x = Math.min(Math.max(8, pt.x - w / 2), size.x - w - 8);
      const barTop = this.querySelector('.leiste') ? this._topFree() - 20 : 8;
      const above = pt.y - iconHeight - 12 - h;
      const below = pt.y + 14;
      let y = above;
      let side = '';
      let fits = true;
      if (above >= barTop) y = above;
      else if (below + h <= size.y - 8) side = 'unten';
      else if (above >= 8) y = above; // over the info bar
      else if (h <= size.y - 16 && (pt.x + gap + w <= size.x - 8 || pt.x - gap - w >= 8)) {
        // low map: next to the pin
        side = pt.x + gap + w <= size.x - 8 ? 'rechts' : 'links';
        x = side === 'rechts' ? pt.x + gap : pt.x - gap - w;
        y = Math.min(Math.max(8, pt.y - iconHeight / 2 - h / 2), size.y - h - 8);
      } else fits = false;
      if (side === 'unten') y = below;
      const tip = side === 'rechts' || side === 'links' ? Math.min(Math.max(16, pt.y - iconHeight / 2 - y), h - 16)
        : Math.min(Math.max(16, pt.x - x), w - 16);
      return { x, y, w, h, side, fits, tip, pinX: pt.x, pinY: pt.y };
    }

    _placePanel() {
      const box = this.querySelector('.infofenster');
      const at = this._panelPosition();
      if (!at || box.hidden || box.classList.contains('gleitet') || box.classList.contains('weg')) return;
      box.style.transform = `translate(${at.x}px, ${at.y}px)`;
      ['unten', 'rechts', 'links'].forEach((side) => box.classList.toggle(side, at.side === side));
      const tip = box.querySelector('.zipfel');
      if (tip) {
        const sideways = at.side === 'rechts' || at.side === 'links';
        tip.style.left = sideways ? '' : `${at.tip}px`;
        tip.style.top = sideways ? `${at.tip}px` : '';
      }
    }

    // Pan only if the window fits nowhere or the pin is at the very edge.
    _makeRoom() {
      const at = this._panelPosition();
      if (!at) return;
      const size = this._map.getSize();
      let dy = 0;
      if (!at.fits) dy = at.y - 8;
      else if (at.pinY > size.y - 20) dy = at.pinY - (size.y - 20);
      let dx = 0;
      if (at.pinX < 24) dx = at.pinX - 24;
      else if (at.pinX > size.x - 24) dx = at.pinX - (size.x - 24);
      if (!dx && !dy) return;
      this._setFollow(false);
      this._move(() => this._map.panBy([dx, dy], { animate: false }));
    }

    _drawZones() {
      const signature = S.zoneSignature(this._hass, this._config);
      if (signature === this._zoneSignature && this._zoneLayer) return;
      this._zoneSignature = signature;
      this._zoneLayer = S.drawZones(this._map, this._zoneLayer, this._hass, this._config, this._t);
    }
  }

  if (!customElements.get('whereabouts-live-card')) customElements.define('whereabouts-live-card', WhereaboutsLiveCard);
}
