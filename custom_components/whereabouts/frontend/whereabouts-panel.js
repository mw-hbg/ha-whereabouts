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
  whereabouts-panel { display: block; height: 100%; }
  .wa-panel { display: flex; flex-direction: column; height: 100%; background: var(--primary-background-color);
              color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
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
                             font: inherit; font-size: 14px; font-weight: 500; letter-spacing: .02em; text-transform: uppercase;
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
  .wa-panel .wap-seite.wap-einstellungen { overflow: auto; }
  .wa-panel .wap-leer { padding: 32px 16px; text-align: center; color: var(--secondary-text-color); }
`;

const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"/></svg>';

(async () => {
  const [S] = await Promise.all([load('shared.js'), load('whereabouts-cards.js')]);
  await Promise.all(['whereabouts-live-card', 'whereabouts-history-card'].map((n) => customElements.whenDefined(n)));
  const settingsModule = await load('settings-page.js');
  settingsModule.defineSettingsPage(S);

  class WhereaboutsPanel extends HTMLElement {
    constructor() {
      super();
      this._pages = {};
      this._view = null;
    }

    set hass(hass) {
      const first = !this._hass;
      this._hass = hass;
      Object.values(this._pages).forEach((el) => { if (el && el.tagName) el.hass = hass; });
      if (first) this._start();
      else this._menuButton();
    }

    get hass() { return this._hass; }

    set narrow(value) { this._narrow = value; this._menuButton(); this._fitTabs(); }

    set route(route) {
      this._route = route;
      if (this._ready) this._show(this._viewFromRoute());
    }

    set panel(panel) { this._panel = panel; }

    connectedCallback() {
      if (this._ready && this._view) this._show(this._view);
    }

    disconnectedCallback() {
      if (this._tabObserver) { this._tabObserver.disconnect(); this._tabObserver = null; }
    }

    async _start() {
      await S.loadTranslations(S.language(this._hass));
      this._t = S.translator(this._hass);
      S.subscribeInfo(this._hass, (info) => this._onInfo(info));
    }

    _onInfo(info) {
      this._info = info;
      const settings = info.settings || {};
      const visible = VIEWS.filter((v) => {
        if (v.id === 'live') return info.live_card && settings.view_live !== false;
        if (v.id === 'history') return info.history_card && settings.view_history !== false;
        return settings.view_settings !== false;
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
            <div class="wap-titel">${esc(title)}</div>
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

    _navigate(view) {
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
      this._view = view;
      this._root.querySelectorAll('.wap-reiter button').forEach((b) => {
        const on = b.dataset.view === view;
        b.classList.toggle('wap-aktiv', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      this._root.querySelectorAll('.wap-seite').forEach((page) => page.classList.toggle('wap-aktiv', page.dataset.view === view));
      if (!this._pages[view]) this._pages[view] = this._createPage(view);
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
