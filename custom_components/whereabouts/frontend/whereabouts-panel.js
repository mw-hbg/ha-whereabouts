// Whereabouts – page in the sidebar: "Where is…?", "Location history" and the settings.
// The two maps are the same cards as in dashboards; the settings page is settings-page.js.

const query = new URL(import.meta.url).search;
const load = (name) => import(`./${name}${query}`);

const VIEWS = [
  { id: 'live', icon: 'mdi:map-marker-account', label: 'live_title' },
  { id: 'history', icon: 'mdi:map-clock', label: 'history_title' },
  { id: 'settings', icon: 'mdi:cog', label: 'settings_title' },
];

const CSS = `
  whereabouts-panel { display: block; height: 100%; overflow: hidden; }
  .wa-panel { display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden; overscroll-behavior: none;
              background: var(--primary-background-color);
              color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
  /* "Light or dark" under Views: the whole view in a fixed mode, independent of Home Assistant */
  .wa-panel.wap-dunkel { color-scheme: dark;
    --primary-background-color: #111111; --secondary-background-color: #282828; --card-background-color: #1c1c1c;
    --ha-card-background: #1c1c1c; --primary-text-color: #e1e1e1; --secondary-text-color: #9b9b9b; --disabled-text-color: #6f6f6f;
    --divider-color: rgba(225,225,225,.12); --app-header-background-color: #101e24; --app-header-text-color: #e1e1e1;
    --mdc-text-field-fill-color: #2a2a2a; --input-fill-color: #2a2a2a; --mdc-text-field-ink-color: #e1e1e1;
    --mdc-text-field-label-ink-color: #9b9b9b; --mdc-select-fill-color: #2a2a2a; --mdc-select-ink-color: #e1e1e1;
    --mdc-theme-surface: #1c1c1c; --mdc-theme-text-primary-on-background: #e1e1e1; --code-editor-background-color: #1c1c1c; }
  .wa-panel.wap-hell { color-scheme: light;
    --primary-background-color: #fafafa; --secondary-background-color: #e5e5e5; --card-background-color: #ffffff;
    --ha-card-background: #ffffff; --primary-text-color: #212121; --secondary-text-color: #727272; --disabled-text-color: #bdbdbd;
    --divider-color: rgba(0,0,0,.12); --app-header-background-color: #03a9f4; --app-header-text-color: #ffffff;
    --mdc-text-field-fill-color: #f5f5f5; --input-fill-color: #f5f5f5; --mdc-text-field-ink-color: #212121;
    --mdc-text-field-label-ink-color: #727272; --mdc-select-fill-color: #f5f5f5; --mdc-select-ink-color: #212121;
    --mdc-theme-surface: #ffffff; --mdc-theme-text-primary-on-background: #212121; }
  .wa-panel .wap-kopf { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; height: var(--header-height, 56px);
                    padding: 0 4px 0 12px; box-sizing: border-box;
                    background: var(--app-header-background-color, var(--primary-color));
                    color: var(--app-header-text-color, #fff);
                    border-bottom: var(--app-header-border-bottom, none); }
  .wa-panel .wap-menue { display: none; width: 48px; height: 48px; margin-left: -8px; border: none; border-radius: 50%;
                     background: none; color: inherit; cursor: pointer; align-items: center; justify-content: center; }
  .wa-panel .wap-menue.wap-an { display: inline-flex; }
  .wa-panel .wap-menue svg { width: 24px; height: 24px; }
  .wa-panel .wap-titel { flex: 0 1 auto; min-width: 0; font-size: 20px; font-weight: 400; white-space: nowrap;
                     overflow: hidden; text-overflow: ellipsis; margin-right: 16px; }
  .wa-panel .wap-reiter { flex: 1 1 auto; min-width: 0; display: flex; justify-content: flex-start; height: 100%; overflow: hidden; }
  .wa-panel .wap-reiter button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; height: 100%;
                             padding: 0 16px; border: none; background: none; color: inherit; opacity: .75; cursor: pointer;
                             font: inherit; font-size: 15px; font-weight: 500;
                             border-bottom: 2px solid transparent; box-sizing: border-box; }
  .wa-panel .wap-reiter button:hover { opacity: 1; background: rgba(255,255,255,.08); }
  .wa-panel .wap-reiter button.wap-aktiv { opacity: 1; border-bottom-color: currentColor; }
  .wa-panel .wap-reiter ha-icon { --mdc-icon-size: 22px; }
  .wa-panel .wap-reiter.wap-symbole .wap-text { display: none; }
  .wa-panel .wap-reiter.wap-symbole button { padding: 0 14px; }
  .wa-panel .wap-inhalt { position: relative; flex: 1 1 auto; min-height: 0; }
  .wa-panel .wap-seite { position: absolute; inset: 0; display: none; }
  .wa-panel .wap-seite.wap-aktiv { display: block; }
  .wa-panel .wap-seite.wap-karte { padding: 0; }
  .wa-panel .wap-seite.wap-einstellungen { overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .wa-panel .wap-leer { padding: 32px 16px; text-align: center; color: var(--secondary-text-color); }
`;

const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"/></svg>';

(async () => {
  const [S] = await Promise.all([load('shared.js'), load('whereabouts-cards.js')]);
  await Promise.all(['whereabouts-live-card', 'whereabouts-history-card'].map((n) => customElements.whenDefined(n)));
  const [settingsModule, download] = await Promise.all([load('settings-page.js'), load('download.js')]);
  settingsModule.defineSettingsPage(S, download);

  class WhereaboutsPanel extends HTMLElement {
    constructor() {
      super();
      this._pages = {};
      this._view = null;
      // Home Assistant may create the element (and set hass, route ...) before
      // this class is defined: take those values over now.
      ['panel', 'narrow', 'route', 'hass'].forEach((name) => {
        if (Object.prototype.hasOwnProperty.call(this, name)) {
          const value = this[name];
          delete this[name];
          this[name] = value;
        }
      });
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      Object.values(this._pages).forEach((el) => { if (el && el.tagName) el.hass = hass; });
      if (first) this._start();
      else { this._menuButton(); this._applyTheme(); }
    }

    // "Light or dark" under Views: auto = nothing to do (like Home Assistant); otherwise the
    // view gets its own colours - only when they differ from Home Assistant's.
    _applyTheme() {
      if (!this._root || !this._info) return;
      const settings = this._info.settings || {};
      const view = this._view || 'live';
      const mode = (settings.theme === 'custom' ? settings[`theme_${view}`] : settings.theme) || 'auto';
      const haDark = Boolean(this._hass && this._hass.themes && this._hass.themes.darkMode);
      this._root.classList.toggle('wap-dunkel', mode === 'dark' && !haDark);
      this._root.classList.toggle('wap-hell', mode === 'light' && haDark);
    }

    get hass() { return this._hass; }

    set narrow(value) { this._narrow = value; this._menuButton(); this._fitTabs(); }

    set route(route) {
      this._route = route;
      if (this._ready) this._show(this._viewFromRoute());
    }

    set panel(panel) { this._panel = panel; }

    connectedCallback() {
      if (this._root) this._watch();
      if (this._ready && this._view) this._show(this._view);
    }

    disconnectedCallback() {
      if (this._tabObserver) { this._tabObserver.disconnect(); this._tabObserver = null; }
      this._unwatch();
    }

    _watch() {
      this._unwatch();
      window.addEventListener('resize', this._refit);
      window.addEventListener('orientationchange', this._refit);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', this._refit);
      if (window.ResizeObserver) {
        this._sizeObserver = new ResizeObserver(() => this._fitHeight());
        this._sizeObserver.observe(document.documentElement);
      }
      this._refit();
    }

    _unwatch() {
      window.removeEventListener('resize', this._refit);
      window.removeEventListener('orientationchange', this._refit);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._refit);
      if (this._sizeObserver) { this._sizeObserver.disconnect(); this._sizeObserver = null; }
    }

    // After turning the phone the new size arrives in steps: measure again a few times.
    _refit = () => {
      this._unshift();
      this._fitHeight();
      requestAnimationFrame(() => this._fitHeight());
      [150, 400, 800].forEach((ms) => setTimeout(() => this._fitHeight(), ms));
    };

    // After turning the phone or a size change Home Assistant's page around the panel may
    // have moved: put every scrolled container above us back to the top - once, not while
    // scrolling (that would fight the iPhone's scrolling and make it jerk).
    _unshift = () => {
      let el = this;
      while (el) {
        if (el !== this && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; }
        el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      }
      const page = document.scrollingElement;
      if (page && (page.scrollTop || page.scrollLeft)) { page.scrollTop = 0; page.scrollLeft = 0; }
    };

    // Exactly as high as the visible area below Home Assistant's own top margin
    // (iPhone: status bar / safe area, browser bars). 100dvh alone is too high there,
    // and then the whole page scrolls instead of only the content.
    _fitHeight = () => {
      if (!this._root || !this.isConnected) return;
      const top = Math.max(0, this.getBoundingClientRect().top);
      const viewport = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      // Only the visible area counts: Home Assistant's container grows with us and
      // would keep an old height after zooming.
      this._root.style.height = `${Math.max(200, Math.floor(viewport - top))}px`;
    };

    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      S.subscribeInfo(this._hass, (info) => this._onInfo(info));
    }

    _onInfo(info) {
      // While the integration reloads (every option change) it is briefly
      // unavailable: keep the page instead of rebuilding it.
      clearTimeout(this._gone);
      if (!info.available && this._info && this._info.available) {
        this._gone = setTimeout(() => this._onInfo({ ...info, confirmed: true }), 8000);
        if (!info.confirmed) return;
      }
      this._info = info;
      const settings = info.settings || {};
      const visible = VIEWS.filter((v) => {
        if (v.id === 'live') return settings.view_live !== false;
        if (v.id === 'history') return settings.view_history !== false;
        // Settings managed by the administrator: no tab (the address still explains it).
        return settings.view_settings !== false && !info.settings_hidden;
      }).map((v) => v.id);
      const sig = JSON.stringify([info.available, visible]);
      if (!this._ready || sig !== this._sig) {
        this._sig = sig;
        this._visible = visible;
        this._build();
      }
      this._ready = true;
      this._show(this._viewFromRoute());
    }

    _viewFromRoute() {
      const path = ((this._route && this._route.path) || '').replace(/^\//, '').split('/')[0];
      if (VIEWS.some((v) => v.id === path)) return path;
      const start = (this._info && this._info.settings && this._info.settings.start_view) || 'live';
      return this._visible.includes(start) ? start : (this._visible[0] || 'settings');
    }

    _build() {
      const t = this._t;
      const esc = S.escapeHtml;
      const title = (this._panel && this._panel.title) || t('panel_title');
      if (!this._styled) {
        const style = document.createElement('style');
        style.textContent = CSS;
        this.appendChild(style);
        this._styled = true;
      }
      if (this._root) this._root.remove();
      Object.values(this._pages).forEach((el) => el && el.remove && el.remove());
      this._pages = {};
      this._root = document.createElement('div');
      this._root.className = 'wa-panel';
      if (!this._info.available) {
        this._root.innerHTML = `<div class="wap-kopf"><button class="wap-menue" type="button" aria-label="Menu">${MENU_ICON}</button><div class="wap-titel">${esc(title)}</div></div>
          <div class="wap-leer">${esc(t('not_set_up'))}</div>`;
      } else {
        this._root.innerHTML = `
          <div class="wap-kopf">
            <button class="wap-menue" type="button" title="${esc(t('menu'))}" aria-label="${esc(t('menu'))}">${MENU_ICON}</button>
            <nav class="wap-reiter" role="tablist">
              ${VIEWS.filter((v) => this._visible.includes(v.id)).map((v) => `
                <button type="button" role="tab" data-view="${v.id}" title="${esc(t(v.label))}" aria-label="${esc(t(v.label))}">
                  <ha-icon icon="${v.icon}"></ha-icon><span class="wap-text">${esc(t(v.label))}</span>
                </button>`).join('')}
            </nav>
          </div>
          <div class="wap-inhalt">
            ${VIEWS.map((v) => `<div class="wap-seite ${v.id === 'settings' ? 'wap-einstellungen' : 'wap-karte'}" data-view="${v.id}"></div>`).join('')}
          </div>`;
        this._root.querySelectorAll('.wap-reiter button').forEach((b) => b.addEventListener('click', () => this._navigate(b.dataset.view)));
      }
      this.appendChild(this._root);
      this._watch();
      this._root.querySelector('.wap-menue').addEventListener('click', () => {
        this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
      });
      this._menuButton();
      const nav = this._root.querySelector('.wap-reiter');
      if (nav && window.ResizeObserver) {
        if (this._tabObserver) this._tabObserver.disconnect();
        this._tabObserver = new ResizeObserver(() => this._fitTabs());
        this._tabObserver.observe(this._root.querySelector('.wap-kopf'));
      }
      this._fitTabs();
    }

    _menuButton() {
      const button = this._root && this._root.querySelector('.wap-menue');
      if (!button) return;
      const hidden = this._hass && this._hass.dockedSidebar === 'always_hidden';
      button.classList.toggle('wap-an', Boolean(this._narrow || hidden));
    }

    // Names next to the symbols only if there is room for them.
    _fitTabs() {
      const nav = this._root && this._root.querySelector('.wap-reiter');
      if (!nav) return;
      nav.classList.remove('wap-symbole');
      if (nav.scrollWidth > nav.clientWidth + 1) nav.classList.add('wap-symbole');
    }

    async _navigate(view) {
      // Unsaved fields on the settings page: ask first.
      const settings = this._pages.settings;
      if (this._view === 'settings' && view !== 'settings' && settings && settings.confirmLeave && !await settings.confirmLeave()) return;
      const base = (this._panel && this._panel.url_path) || 'whereabouts';
      const path = `/${base}/${view}`;
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
        window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
      }
      this._show(view);
    }

    _show(view) {
      if (!this._root || !this._info || !this._info.available) return;
      if (!this._visible.includes(view) && view !== 'settings') view = this._visible[0] || 'settings';
      // The tab that is left may want to remember where it was (before it is hidden).
      const left = this._shown && this._shown !== view ? this._pages[this._shown] : null;
      if (left && left.deactivate) left.deactivate();
      this._view = view;
      this._applyTheme();
      this._root.querySelectorAll('.wap-reiter button').forEach((b) => {
        const on = b.dataset.view === view;
        b.classList.toggle('wap-aktiv', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      this._root.querySelectorAll('.wap-seite').forEach((page) => page.classList.toggle('wap-aktiv', page.dataset.view === view));
      const changed = this._shown !== view;
      this._shown = view;
      if (!this._pages[view]) this._pages[view] = this._createPage(view);
      else if (changed && this._pages[view].activate) this._pages[view].activate(); // back on this tab
    }

    _createPage(view) {
      const holder = this._root.querySelector(`.wap-seite[data-view="${view}"]`);
      let el;
      if (view === 'settings') {
        el = document.createElement('whereabouts-settings');
      } else {
        el = document.createElement(view === 'live' ? 'whereabouts-live-card' : 'whereabouts-history-card');
        el.setConfig({ type: `custom:${el.localName}`, height_mode: 'fill' });
      }
      holder.appendChild(el);
      el.hass = this._hass;
      return el;
    }
  }

  if (!customElements.get('whereabouts-panel')) customElements.define('whereabouts-panel', WhereaboutsPanel);
})().catch((err) => console.error('Whereabouts: page could not be loaded', err));
