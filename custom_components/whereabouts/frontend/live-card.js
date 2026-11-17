// Whereabouts – "Where is…?" card: all persons live on a map with an info bar.
// Data comes only from the Home Assistant states (nothing is stored).

export const LIVE_DEFAULTS = {
  title: '',
  persons: [],
  show_info_bar: true,
  show_status_bar: true,
  show_zones: true,
  show_accuracy: true,
  zone_names_zoom: 14,
  refresh_interval: 30,
  follow: true,
};

const MAX_ACCURACY = 1000; // larger accuracy circles are not drawn

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
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._follow = true;
      this._last = {};
      this._dark = null;
      this._programmatic = false;
    }

    setConfig(config) {
      this._config = { ...S.DEFAULTS_MAP, ...LIVE_DEFAULTS, ...(config || {}) };
      this._follow = this._config.follow !== false;
      if (this._built) {
        // Rebuild after a change in the editor
        this._teardown();
        this._built = false;
        if (this._hass) this.hass = this._hass;
      }
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._built) {
        this._built = true;
        this._start();
        return;
      }
      if (!this._ready) return;
      const dark = S.isDark(hass, this._config.map_style);
      if (this._map && dark !== this._dark) this._setTiles(dark);
      if (this._changed()) this._update();
    }

    connectedCallback() {
      if (this._config && this._built) S.applyHeight(this, this._config);
      if (this._ready) {
        this._startBackground();
        if (this._map) setTimeout(() => this._map && this._map.invalidateSize(), 0);
      }
    }

    disconnectedCallback() {
      this._stopBackground();
    }

    getCardSize() {
      return 8;
    }

    getGridOptions() {
      return { columns: 'full', rows: 8, min_rows: 4 };
    }

    // --- start --------------------------------------------------------------
    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      let info;
      try {
        info = await S.integrationInfo(this._hass);
      } catch (err) {
        this.innerHTML = S.messageHtml(this._t('not_set_up'));
        return;
      }
      if (!info.live_card) {
        this.innerHTML = S.messageHtml(this._t('card_off'));
        return;
      }
      this._persons = this._personList();
      if (!this._persons.length) {
        this.innerHTML = S.messageHtml(this._t('no_persons'));
        return;
      }
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
      this._zoneLayer = null;
      this._zoneSignature = '';
      this._last = {};
      this._ready = false;
      this.innerHTML = '';
    }

    _personList() {
      const configured = (this._config.persons || []).filter((id) => this._hass.states[id]);
      const ids = configured.length ? configured : S.allPersonIds(this._hass);
      return ids.map((id) => ({
        id,
        key: id.replace(/[^a-z0-9_]/gi, '_'),
        name: S.personName(this._hass, this._config, id),
        color: S.safeColor(S.personColor(this._hass, this._config, id), S.PALETTE[0]),
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
      this._interval = Math.max(5, Number(this._config.refresh_interval) || 30);
      this._rest = this._interval;
      this._tick = setInterval(() => {
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
      if (this._zoneSig() !== this._zoneSignature) changed = true;
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
          .alle { position: absolute; left: 12px; bottom: 26px; z-index: 1000; width: 44px; height: 44px; border-radius: 50%;
                  border: none; cursor: pointer; color: var(--wa-text); background: var(--wa-glas);
                  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,.18);
                  display: flex; align-items: center; justify-content: center; }
          .alle.aktiv { color: #fff; background: #555; }
          .wa-live.dark .alle.aktiv { background: #e8eaed; color: #202124; }
          .alle svg { width: 22px; height: 22px; }
          .wa-marker .rund { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--farbe);
                             background: var(--farbe) center/cover no-repeat; box-sizing: border-box;
                             box-shadow: 0 2px 6px rgba(0,0,0,.35); color: #fff; font-weight: 700; font-size: 18px;
                             display: flex; align-items: center; justify-content: center; }
          .wa-marker .spitze { position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
                               width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent;
                               border-top: 9px solid var(--farbe); }
          .wa-live .zonen-name { background: transparent; border: none; box-shadow: none; font-weight: 600;
                                 color: #555; text-shadow: 0 0 3px #fff, 0 0 3px #fff; padding: 0; }
          .wa-live.dark .zonen-name { color: #ddd; text-shadow: 0 0 3px #000, 0 0 3px #000; }
          .wa-live .zonen-name::before { display: none; }
          .wa-live.zonen-aus .zonen-name { display: none; }
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
            ${c.show_info_bar ? `<div class="leiste">${this._persons.map((p) => `
              <button class="person p-${p.key}" data-person="${p.key}" type="button" title="${S.escapeHtml(t('jump_to', { name: p.name }))}">
                <div class="bild"></div>
                <div class="text">
                  <div class="kopf"><span class="name">${S.escapeHtml(p.name)}</span><span class="status"></span></div>
                  <div class="adresse"></div>
                  <div class="ortung"></div>
                </div>
              </button>`).join('')}</div>` : ''}
            <button class="alle${this._follow ? ' aktiv' : ''}" type="button" title="${S.escapeHtml(t('show_all'))}" aria-label="${S.escapeHtml(t('show_all'))}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
            </button>
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
      this.querySelector('.alle').addEventListener('click', () => { this._setFollow(true); this._fitAll(true); });
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
        this._map = L.map(this.querySelector('.wa-map'), { zoomControl: false })
          .setView([home.latitude || 0, home.longitude || 0], 12);
        L.control.zoom({ position: 'bottomright' }).addTo(this._map);
        this._setTiles(S.isDark(this._hass, this._config.map_style));
        ['dragstart', 'zoomstart'].forEach((ev) => this._map.on(ev, () => { if (!this._programmatic) this._setFollow(false); }));
        const zoneNames = () => this.querySelector('.wa-live')
          .classList.toggle('zonen-aus', this._map.getZoom() < Number(this._config.zone_names_zoom || 14));
        this._map.on('zoomend', zoneNames);
        zoneNames();
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
      this._tiles = S.setTiles(this._map, this._tiles, this._config, dark, this.querySelector('.wa-map'));
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
    }

    _data(p) {
      const states = this._hass.states;
      const st = states[p.id];
      if (!st) return null;
      const pos = S.position(states, st);
      return { st, picture: st.attributes.entity_picture || '', pos };
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
      if (url) { el.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`; el.textContent = ''; }
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
          const href = S.mapLink(this._config.map_link, d.pos.lat, d.pos.lon);
          if (href) link.href = href; else link.removeAttribute('href');
        } else {
          link.textContent = t('no_position');
          link.removeAttribute('href');
        }
      });
      bar.querySelector('.zuletzt').textContent = this._updated
        ? t('updated', { time: t('time', { time: S.clock(this._hass, this._updated, true) }) }) : '–';
      this._renderCountdown();
    }

    _renderCountdown() {
      const rest = this.querySelector('.statusbar .rest');
      if (rest) rest.textContent = this._t('reload_in', { n: this._rest });
      const ring = this.querySelector('.neuladen .ring');
      if (ring) {
        const length = 2 * Math.PI * 15;
        ring.style.strokeDasharray = length.toFixed(2);
        ring.style.strokeDashoffset = (length * (1 - this._rest / this._interval)).toFixed(2);
      }
    }

    _goTo(key) {
      const p = this._persons.find((x) => x.key === key);
      const d = p && this._data(p);
      if (!this._map || !d || !d.pos) return;
      this._setFollow(false);
      this._move(() => this._map.flyTo([d.pos.lat, d.pos.lon], Math.max(this._map.getZoom(), 16), { duration: 0.8 }));
      if (this._markers[key]) this._markers[key].setZIndexOffset(2000);
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

    _drawPersons() {
      const L = window.L;
      this._persons.forEach((p, i) => {
        const d = this._data(p);
        if (!d || !d.pos) {
          if (this._markers[p.key]) { this._map.removeLayer(this._markers[p.key]); delete this._markers[p.key]; }
          if (this._circles[p.key]) { this._map.removeLayer(this._circles[p.key]); delete this._circles[p.key]; }
          return;
        }
        const pos = [d.pos.lat, d.pos.lon];
        if (!this._markers[p.key] || this._markers[p.key]._waPicture !== d.picture) {
          if (this._markers[p.key]) this._map.removeLayer(this._markers[p.key]);
          const inner = d.picture
            ? `<div class="rund" style="background-image:url(&quot;${S.escapeHtml(d.picture.replace(/"/g, '%22'))}&quot;)"></div>`
            : `<div class="rund">${S.escapeHtml(p.name.charAt(0))}</div>`;
          const icon = L.divIcon({
            className: `wa-marker p-${p.key}`,
            html: `<div style="--farbe:${p.color}">${inner}<div class="spitze"></div></div>`,
            iconSize: [44, 44], iconAnchor: [22, 52],
          });
          const marker = L.marker(pos, { icon, zIndexOffset: 1000 + i, keyboard: false, title: p.name }).addTo(this._map);
          marker._waPicture = d.picture;
          marker.on('click', () => this._goTo(p.key));
          this._markers[p.key] = marker;
        } else {
          this._markers[p.key].setLatLng(pos);
        }
        const circle = this._config.show_accuracy && d.pos.accuracy > 0 && d.pos.accuracy <= MAX_ACCURACY && d.st.state === 'not_home';
        if (circle) {
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

    _zones() {
      if (!this._config.show_zones) return [];
      const states = this._hass.states;
      return Object.keys(states).filter((id) => id.startsWith('zone.')).map((id) => states[id])
        .filter((z) => z.attributes && !z.attributes.passive
          && Number.isFinite(Number(z.attributes.latitude)) && Number.isFinite(Number(z.attributes.longitude)));
    }

    _zoneSig() {
      return this._zones().map((z) => {
        const a = z.attributes;
        return [z.entity_id, a.latitude, a.longitude, a.radius, a.friendly_name].join('|');
      }).join(';');
    }

    _drawZones() {
      const signature = this._zoneSig();
      if (signature === this._zoneSignature && this._zoneLayer) return;
      this._zoneSignature = signature;
      const L = window.L;
      if (this._zoneLayer) this._map.removeLayer(this._zoneLayer);
      this._zoneLayer = L.layerGroup().addTo(this._map);
      this._zones().forEach((z) => {
        const a = z.attributes;
        const home = z.entity_id === 'zone.home';
        const color = home ? '#2e7d32' : '#ef6c00';
        L.circle([Number(a.latitude), Number(a.longitude)], {
          radius: Number(a.radius) || 100, color, weight: 1.5, opacity: 0.7, fillColor: color, fillOpacity: 0.1, interactive: false,
        }).addTo(this._zoneLayer).bindTooltip(home ? this._t('home') : (a.friendly_name || z.entity_id), {
          permanent: true, direction: 'center', offset: [0, 14], className: 'zonen-name',
        });
      });
    }
  }

  if (!customElements.get('whereabouts-live-card')) customElements.define('whereabouts-live-card', WhereaboutsLiveCard);
}
