// Whereabouts – settings page: page layout, category feet, success box, administration categories, personal categories.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { sel, PERSONAL, ADMIN, same, OPTION_UNDO, PAGES, CARTO_STYLES, CSS, esc, S } = ctx;

  return class extends Base {
    // --- page -------------------------------------------------------------------------
    _groups() {
      const t = this._t;
      return [
        { title: t('grp_tasks'), items: ADMIN.filter((c) => c.tasks && this._showAdminCategory(c)) },
        { title: t('grp_main'), items: PERSONAL.filter((c) => c.weight === 'main') },
        { title: t('grp_more'), items: PERSONAL.filter((c) => c.weight === 'more') },
        { title: t('grp_admin'), items: ADMIN.filter((c) => !c.tasks && this._showAdminCategory(c)) },
      ].filter((g) => g.items.length);
    }

    // "Users" only with other users (administrators) or as "your rights" (everybody else).
    _showAdminCategory(c) {
      if (c.id === 'rights') return this._admin ? this._hasOtherUsers() : true;
      return this._admin || c.everyone;
    }

    _render() {
      const t = this._t;
      const d = this._data;
      const anchor = this._pendingAnchor || (this.querySelector('.kat') ? this._anchor() : null);
      this._pendingAnchor = null;
      this._pending.clear();
      this._savables.clear();
      if (d.settings_hidden) {
        this.innerHTML = `<style>${CSS}</style><div class="wa-set"><main><div class="verwaltet">
          <ha-icon icon="mdi:account-lock"></ha-icon>${esc(t('settings_managed'))}</div></main></div>`;
        return;
      }
      if (!this._open) {
        this._open = new Set(PERSONAL.filter((c) => c.weight === 'main').map((c) => c.id));
        // something running or open: the tasks are shown right away
        if (this._admin && (this._job.status !== 'idle' || this._openTaskCount() > 0)) this._open.add('tasks');
      }
      const groups = this._groups();
      const lockIcon = (id) => (PERSONAL.some((c) => c.id === id) && d.locked.includes(id) && this._scope === 'own'
        ? '<ha-icon class="schloss" icon="mdi:lock"></ha-icon>' : '');
      const all = groups.flatMap((g) => g.items.map((c) => c.id));
      const allOpen = all.every((id) => this._open.has(id));
      this.innerHTML = `${S.leafletCss()}<style>${CSS}</style>
        <div class="wa-set">
          <nav class="toc" aria-label="${esc(t('toc'))}">
            ${groups.map((g) => `<div class="gruppe">${esc(g.title)}</div>
              ${g.items.map((c) => `<a data-ziel="${c.id}"><ha-icon icon="${c.icon}"></ha-icon><span>${esc(this._catTitle(c.id))}</span>${lockIcon(c.id)}</a>`).join('')}`).join('')}
          </nav>
          <main>
            <div class="sprung"><select class="ein" aria-label="${esc(t('toc'))}">
              ${groups.map((g) => `<optgroup label="${esc(g.title)}">
                ${g.items.map((c) => `<option value="${c.id}">${esc(this._catTitle(c.id))}</option>`).join('')}</optgroup>`).join('')}
            </select></div>
            <div class="oben">
              <h1>${esc(t('settings_title'))}</h1>
              <button class="kopfinfo" type="button" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}" aria-expanded="${this._headInfo ? 'true' : 'false'}"><ha-icon icon="mdi:information-outline"></ha-icon></button>
              <span class="rolle">${this._admin ? '<ha-icon icon="mdi:shield-account"></ha-icon>' : '<ha-icon icon="mdi:account"></ha-icon>'}${esc(this._admin ? t('role_admin', { name: d.user.name }) : d.user.name)}</span>
              <button class="knopf alle-klappen" type="button"><ha-icon icon="${allOpen ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}"></ha-icon>${esc(t(allOpen ? 'collapse_all' : 'expand_all'))}</button>
            </div>
            <div class="entwuerfe"></div>
            <div class="erfolg-oben"></div>
            ${this._scope === 'defaults' ? `<div class="banner standard"><ha-icon icon="mdi:account-multiple"></ha-icon><span class="text">${esc(t('editing_defaults'))}</span><button class="knopf voll fertig" type="button">${esc(t('done'))}</button></div>` : ''}
            ${this._scope === 'user' && this._user ? `<div class="banner standard"><ha-icon icon="mdi:account-edit"></ha-icon><span class="text">${esc(t('editing_user', { name: this._user.name }))}${this._flag(this._user.id, 'hide_settings') ? ` ${esc(t('editing_user_hidden', { name: this._user.name }))}` : ''}${this._user.synced ? ` ${esc(t('editing_user_synced', { name: this._user.name }))}` : ''}</span><button class="knopf voll fertig" type="button">${esc(t('done'))}</button></div>` : ''}
            <div class="kopfhinweise"${this._headInfo ? '' : ' hidden'}>
              <p class="hinweis">${esc(this._scope === 'defaults' ? t('scope_defaults_text') : this._scope === 'user' ? t('scope_user_text') : t(this._hasOtherUsers() || !this._admin ? 'scope_own_text' : 'scope_own_text_single'))}</p>
              <p class="hinweis">${esc(t('marker_explain'))}</p>
              ${this._admin && this._scope !== 'user' && this._hasOtherUsers() ? `<p class="hinweis">${esc(t('lock_explain'))} ${esc(t('lock_explain_users'))}</p>` : ''}
              ${this._admin && !this._hasOtherUsers() ? `<p class="hinweis">${esc(t('single_user_hint'))}</p>` : ''}
            </div>
            ${!this._admin && (d.locked.length || Object.keys(d.field_locks || {}).length) ? `<div class="banner"><ha-icon icon="mdi:lock"></ha-icon><span class="text">${esc(t('locked_hint'))}</span></div>` : ''}
            ${ADMIN.filter((c) => c.tasks && this._showAdminCategory(c)).map((c) => this._categoryHtml(c, false)).join('')}
            ${PERSONAL.map((c) => this._categoryHtml(c, true)).join('')}
            ${ADMIN.filter((c) => !c.tasks && this._showAdminCategory(c)).map((c) => this._categoryHtml(c, false)).join('')}
            ${this._scope === 'own' ? `<div class="fuss"><button class="knopf gefahr alles-zurueck"><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_all'))}</button></div>` : ''}
            <p class="hinweis klein">Whereabouts ${esc(d.version)}</p>
          </main>
        </div>`;
      this._wire();
      this._showDrafts();
      this._showSuccess();
      this._askNewUsers().then(() => this._askZoneChanges()).then(() => this._askRecorderOffer());
      requestAnimationFrame(() => { this._restoreAnchor(anchor); this._noteAnchor(); });
    }

    _categoryHtml(c, personal) {
      const t = this._t;
      const locked = personal && this._locked(c.id);
      const closed = !this._open.has(c.id);
      const lock = personal && this._admin && this._scope !== 'user' && this._hasOtherUsers() ? this._lockState(c.id) : null;
      const userWhole = personal && this._scope === 'user' && this._userLocks(c.id).includes('*');
      return `<ha-card class="kat${closed ? ' zu' : ''}${locked ? ' gesperrt' : ''}" id="kat-${c.id}" data-kat="${c.id}">
        <div class="kat-kopf" role="button" tabindex="0" aria-expanded="${closed ? 'false' : 'true'}">
          <ha-icon class="symbol" icon="${c.icon}"></ha-icon>
          <div class="titelblock"><h2>${esc(this._catTitle(c.id))}</h2><div class="kurz">${esc(this._summary(c.id))}</div></div>
          ${locked ? `<span class="marke"><ha-icon icon="mdi:lock"></ha-icon>${esc(t('locked_badge'))}</span>` : ''}
          ${personal && this._scope === 'user' ? `<button class="knopf ganz${userWhole ? ' voll' : ''}" type="button" data-kat="${c.id}"><ha-icon icon="${userWhole ? 'mdi:lock' : 'mdi:lock-open-variant-outline'}"></ha-icon>${esc(t(userWhole ? 'fix_category_off' : 'fix_category', { name: this._user.name }))}</button>` : ''}
          ${lock ? `<button class="knopf rund sperre" title="${esc(this._lockTitle(c.id))}" aria-label="${esc(this._lockTitle(c.id))}"${this._syncAll ? ' disabled' : ''}><ha-icon icon="${lock === 'none' ? 'mdi:lock-open-variant-outline' : 'mdi:lock'}"></ha-icon></button>` : ''}
          ${!personal && !this._admin && c.id !== 'data' ? `<span class="marke"><ha-icon icon="mdi:shield-account"></ha-icon>${esc(t('admin_badge'))}</span>` : ''}
          <ha-icon class="pfeil" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="kat-inhalt">
          <p class="kat-text">${esc(t(c.id === 'rights' && !this._admin ? 'cd_rights_self' : `cd_${c.id}`))}</p>
          <div class="felder" data-kat="${c.id}"></div>
          ${personal ? this._footHtml(c.id, locked) : this._adminFootHtml(c)}
        </div>
      </ha-card>`;
    }

    // "For all users" (administrators with other users) and "Reset to standard" (= built-in values,
    // greyed out when everything is standard; afterwards 30 s "Restore own values").
    _catTitle(id) {
      return this._t(id === 'rights' && !this._admin ? 'cat_rights_self' : `cat_${id}`);
    }

    _footHtml(category, locked) {
      const t = this._t;
      const promote = this._admin && this._scope === 'own' && this._hasOtherUsers();
      const undo = this._catUndo.get(`${this._scopeKey()}:${category}`);
      const restoring = undo && undo.until > Date.now();
      const plain = this._allFactory(category);
      if (locked && !promote) return '<div class="fuss" hidden></div>';
      const left = restoring ? Math.max(0, 30 - (undo.until - Date.now()) / 1000) : 0;
      return `<div class="fuss">
        ${promote ? `<button class="knopf standard-setzen" data-kat="${category}"${this._syncAll ? ' disabled' : ''}><ha-icon icon="mdi:account-multiple-check"></ha-icon>${esc(t('promote_category'))}</button>` : ''}
        ${locked ? '' : restoring
    ? `<button class="knopf wiederherstellen kat-wieder" data-kat="${category}" data-left="${left}">${this._ringHtml()}<ha-icon icon="mdi:undo"></ha-icon>${esc(t('restore_own_values'))}</button>`
    : `<button class="knopf gefahr zurueck" data-kat="${category}"${plain ? ` disabled title="${esc(t('all_standard'))}"` : ''}><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_category'))}</button>`}
      </div>`;
    }

    // Administration: "Reset to standard" greyed out when every option has its built-in value;
    // afterwards 30 s "Restore own values" (like the personal categories).
    _adminFootHtml(c) {
      if (!this._admin || !c.reset) return '';
      const t = this._t;
      const undo = OPTION_UNDO.get(c.id);
      if (undo && undo.until > Date.now()) {
        const left = Math.max(0, 30 - (undo.until - Date.now()) / 1000);
        return `<div class="fuss"><button class="knopf wiederherstellen opt-wieder" data-kat="${c.id}" data-left="${left}">${this._ringHtml()}<ha-icon icon="mdi:undo"></ha-icon>${esc(t('restore_own_values'))}</button></div>`;
      }
      const plain = this._optionsPlain(c);
      return `<div class="fuss"><button class="knopf gefahr optionen-zurueck" data-kat="${c.id}"${plain ? ` disabled title="${esc(t('all_standard'))}"` : ''}><ha-icon icon="mdi:restore"></ha-icon>${esc(t('reset_category'))}</button></div>`;
    }

    // All options of an administration category have their built-in value?
    _optionsPlain(c) {
      const options = this._data.admin.options || {};
      const defaults = this._data.admin.option_defaults || {};
      return c.reset.filter((key) => key in defaults).every((key) => {
        const f = (c.options || []).find((x) => x.key === key) || {};
        const norm = (v) => (f.emptyIs && !v ? f.emptyIs : v);
        return same(norm(options[key]), norm(defaults[key]));
      });
    }

    _refreshAdminFoot(id) {
      const c = ADMIN.find((x) => x.id === id);
      const card = this.querySelector(`#kat-${id}`);
      if (!c || !c.reset || !card || !this._data || !this._data.admin) return;
      const old = card.querySelector('.fuss');
      const holder = document.createElement('div');
      holder.innerHTML = this._adminFootHtml(c);
      const foot = holder.firstElementChild;
      if (!foot) return;
      if (old) old.replaceWith(foot); else card.querySelector('.kat-inhalt').appendChild(foot);
      this._wireFoot(foot);
    }

    _refreshFoot(category) {
      const card = this.querySelector(`#kat-${category}`);
      if (!card) return;
      const old = card.querySelector('.fuss');
      const holder = document.createElement('div');
      holder.innerHTML = this._footHtml(category, this._locked(category));
      const foot = holder.firstElementChild;
      if (old) old.replaceWith(foot); else card.querySelector('.kat-inhalt').appendChild(foot);
      this._wireFoot(foot);
    }

    _wireFoot(root) {
      const t = this._t;
      root.querySelectorAll('.zurueck').forEach((b) => b.addEventListener('click', () => this._resetCategory(b.dataset.kat)));
      root.querySelectorAll('.kat-wieder').forEach((b) => {
        b.querySelector('.ring').style.animationDelay = `-${b.dataset.left}s`;
        b.addEventListener('click', async () => {
          const key = `${this._scopeKey()}:${b.dataset.kat}`;
          const undo = this._catUndo.get(key);
          this._catUndo.delete(key);
          b.disabled = true;
          if (undo) await undo.restore();
          await this._load();
        });
      });
      root.querySelectorAll('.standard-setzen').forEach((b) => b.addEventListener('click', async () => {
        const name = t(`cat_${b.dataset.kat}`);
        if (!await this._confirm(t('make_default'), t('confirm_make_default', { name }), t('make_default'), false)) return;
        if (await this._ws({ type: 'whereabouts/settings/promote', category: b.dataset.kat }, true) !== null) {
          this._setSuccess(t('success_make_default', { name }), b.dataset.kat);
          await this._load();
        }
      }));
      root.querySelectorAll('.optionen-zurueck').forEach((b) => b.addEventListener('click', async () => {
        const c = ADMIN.find((x) => x.id === b.dataset.kat);
        const name = t(`cat_${c.id}`);
        if (!await this._confirm(t('reset_category'), t('confirm_reset_options', { name }), t('reset'), true)) return;
        this._discardIn(c.id);
        this._noteAnchor();
        this._storeView();
        const options = this._data.admin.options || {};
        const before = JSON.parse(JSON.stringify(Object.fromEntries(c.reset.filter((k) => k in options).map((k) => [k, options[k]]))));
        if (await this._ws({ type: 'whereabouts/settings/options_reset', keys: c.reset }, true) !== null) {
          OPTION_UNDO.set(c.id, { restore: () => this._ws({ type: 'whereabouts/settings/options', values: before }, true), until: Date.now() + 30000 });
          setTimeout(() => {
            const entry = OPTION_UNDO.get(c.id);
            if (entry && entry.until <= Date.now()) {
              OPTION_UNDO.delete(c.id);
              // the page may have been rebuilt meanwhile: every page on screen
              PAGES.forEach((page) => page._refreshAdminFoot(c.id));
            }
          }, 30100);
          this._setSuccess(t('success_reset', { name }), c.id);
          this._reloadSoon(1200);
        }
      }));
      root.querySelectorAll('.opt-wieder').forEach((b) => {
        b.querySelector('.ring').style.animationDelay = `-${b.dataset.left}s`;
        b.addEventListener('click', async () => {
          const undo = OPTION_UNDO.get(b.dataset.kat);
          OPTION_UNDO.delete(b.dataset.kat);
          b.disabled = true;
          this._noteAnchor();
          this._storeView();
          if (undo) await undo.restore();
          await this._load();
        });
      });
    }

    // --- success box (green, stays a few seconds, survives redraws) ----------------------------------
    _setSuccess(text, category) {
      this._success = { text, category: category || '', until: Date.now() + 8000 };
      this._showSuccess();
    }

    _showSuccess() {
      this.querySelectorAll('.erfolg').forEach((el) => el.remove());
      const s = this._success;
      if (!s || s.until < Date.now()) { this._success = null; return; }
      const box = document.createElement('div');
      box.className = 'erfolg';
      box.setAttribute('role', 'status');
      box.innerHTML = `<ha-icon icon="mdi:check-circle"></ha-icon><span class="text">${esc(s.text)}</span>
        <button type="button" aria-label="${esc(this._t('close'))}"><ha-icon icon="mdi:close"></ha-icon></button>`;
      box.querySelector('button').addEventListener('click', () => { this._success = null; box.remove(); });
      const card = s.category && this.querySelector(`#kat-${s.category} .kat-inhalt`);
      if (card) card.appendChild(box); else (this.querySelector('.erfolg-oben') || this).appendChild(box);
      clearTimeout(this._successTimer);
      this._successTimer = setTimeout(() => { this._success = null; box.remove(); }, Math.max(0, s.until - Date.now()));
    }

    // Short info in a closed category's header.
    _summary(id) {
      const t = this._t;
      const d = this._data;
      const v = PERSONAL.some((c) => c.id === id) ? this._values(id) : null;
      const o = d.admin ? d.admin.options : {};
      const every = (auto, n) => (auto === false ? t('sum_refresh_off') : t('sum_refresh', { n }));
      switch (id) {
        case 'views': return ['live', 'history', 'settings'].filter((k) => v[`view_${k}`] !== false).map((k) => t(`opt_view_${k}`)).join(', ');
        case 'persons': {
          const all = this._selectablePersons();
          const shown = (v.persons || []).filter((x) => all.some((p) => p.entity_id === x));
          const ids = shown.length ? shown : all.map((p) => p.entity_id);
          const colorOf = (x) => ((v.person_settings || {})[x] || {}).color || S.personColor(this._hass, {}, x);
          const weak = ids.filter((x) => this._contrastHint(colorOf(x))).length;
          return `${t('sum_persons', { n: ids.length, of: all.length })}${weak ? ` · ${t('sum_contrast', { n: weak })}` : ''}`;
        }
        case 'map': return t(`ed_tiles_${v.tiles}`);
        case 'zones': {
          const zones = this._zoneList();
          const hidden = zones.filter((z) => (v.hidden_zones || []).includes(z.entity_id)).length;
          const count = hidden ? t('sum_zones_hidden', { n: zones.length, h: hidden }) : t('sum_zones', { n: zones.length });
          const colorOf = (z) => (v.zone_colors || {})[z.entity_id] || (z.entity_id === 'zone.home' ? v.zone_color_home : v.zone_color);
          const weak = v.zones_in === 'none' ? 0 : zones.filter((z) => !(v.hidden_zones || []).includes(z.entity_id) && this._contrastHint(colorOf(z))).length;
          return `${count} · ${t(`zones_in_${v.zones_in || 'both'}`)}${weak ? ` · ${t('sum_contrast', { n: weak })}` : ''}`;
        }
        case 'live': return every(v.live_auto_refresh, v.live_refresh_interval);
        case 'history': return `${t(`ed_view_${v.default_view}`)} · ${t(`start_period_${v.start_period || 'today'}`)} · ${every(v.history_auto_refresh, v.history_refresh_interval)}`;
        case 'base': return d.admin ? t('sum_persons', { n: d.persons.length, of: d.admin.all_persons.length }) : '';
        case 'rights': {
          if (!d.admin) return ['live', 'history', 'delete'].map((k) => `${t(`sum_right_${k}`)}: ${(d.rights[k] || []).length}`).join(' · ');
          const r = d.admin.rights_default;
          return ['live', 'history', 'delete'].map((k) => `${t(`sum_right_${k}`)}: ${t(`level_${r[k]}`)}`).join(' · ');
        }
        case 'sidebar': return o.panel === false ? t('sum_no_entry') : t('sum_entry', { name: o.panel_title || this._placeholder({ placeholder: 'panel_title' }) });
        case 'recording': {
          const n = (o.record_persons || []).length;
          return n ? t('sum_recording', { n }) : t('sum_recording_none');
        }
        case 'addresses': return o.address_source ? t(`opt_address_${o.address_source}`) : '';
        case 'data': return t('sum_data');
        case 'tasks': return this._tasksSummary();
        case 'maintenance': {
          const job = (d.admin && d.admin.address_job) || {};
          return ['running', 'paused'].includes(job.status)
            ? t('sum_address_job', { done: job.done || 0, total: job.total || 0 })
            : t('sum_maintenance');
        }
        case 'journal': {
          // 0.7.3: many entries in the log - suggest cleaning up (also when the category is closed)
          const journal = d.admin && d.admin.journal;
          const main = this._journalSummary ? this._journalSummary() : '';
          return journal && journal.hint ? `${main} · ${t('journal_hint_short', { n: journal.entries })}` : main;
        }
        case 'diagnostics': {
          const stored = d.admin && d.admin.stored;
          return stored ? t('sum_stored', { persons: stored.persons, days: stored.days }) : '';
        }
        default: return '';
      }
    }

    _lockState(category) {
      const lock = (this._data.admin && this._data.admin.locks[category]) || {};
      return lock.mode || 'none';
    }

    // "Fixed for all users except Robin" – shown as tooltip on the lock.
    _lockTitle(category) {
      const t = this._t;
      const lock = (this._data.admin && this._data.admin.locks[category]) || {};
      const names = (ids) => (ids || []).map((id) => this._userName(id)).join(', ');
      if (lock.mode === 'all') return lock.except && lock.except.length ? t('lock_state_all_except', { names: names(lock.except) }) : t('lock_state_all');
      if (lock.mode === 'selected') return t('lock_state_selected', { names: names(lock.users) || t('nobody') });
      return t('lock_state_none');
    }

    _wire() {
      const t = this._t;
      this.querySelectorAll('.toc a').forEach((a) => a.addEventListener('click', () => this._jump(a.dataset.ziel)));
      const jump = this.querySelector('.sprung select');
      jump.addEventListener('change', () => this._jump(jump.value));
      this.querySelectorAll('.fertig').forEach((b) => b.addEventListener('click', async () => {
        if (!await this.confirmLeave()) return;
        this._scope = 'own';
        this._user = null;
        this._open.add('rights');
        this._render();
        requestAnimationFrame(() => this._jump('rights'));
      }));
      this.querySelectorAll('.kat-kopf').forEach((head) => {
        const toggle = (e) => {
          if (e.target.closest('button')) return;
          this._setOpen(head.closest('.kat').dataset.kat, head.closest('.kat').classList.contains('zu'));
        };
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
      });
      this.querySelector('.kopfinfo').addEventListener('click', (e) => {
        this._headInfo = !this._headInfo;
        this.querySelector('.kopfhinweise').hidden = !this._headInfo;
        e.currentTarget.setAttribute('aria-expanded', this._headInfo ? 'true' : 'false');
      });
      this.querySelector('.alle-klappen').addEventListener('click', () => {
        const ids = [...this.querySelectorAll('.kat')].map((c) => c.dataset.kat);
        const open = !ids.every((id) => this._open.has(id));
        ids.forEach((id) => this._setOpen(id, open));
      });
      this.querySelectorAll('.sperre').forEach((b) => b.addEventListener('click', () => this._lockDialog(b.closest('.kat').dataset.kat)));
      this.querySelectorAll('.kat-kopf .ganz').forEach((b) => b.addEventListener('click', () => {
        const whole = this._userLocks(b.dataset.kat).includes('*');
        this._setFieldLock(b.dataset.kat, whole ? [] : ['*']);
      }));
      this._wireFoot(this);
      const all = this.querySelector('.alles-zurueck');
      if (all) {
        all.addEventListener('click', async () => {
          if (!await this._confirm(t('reset_all'), t('confirm_reset_all'), t('reset'), true)) return;
          await this._ws({ type: 'whereabouts/settings/reset', scope: 'own' }, true);
          await this._load();
        });
      }
      PERSONAL.forEach((c) => this._fillPersonal(c));
      ADMIN.forEach((c) => this._fillAdmin(c));
      this._watchToc();
    }

    _redrawAdmin(id) {
      const c = ADMIN.find((x) => x.id === id);
      if (c) this._fillAdmin(c);
    }

    // An administration category: integration options (with markers), persons, rights, data ...
    _fillAdmin(c) {
      const t = this._t;
      const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
      if (!box) return;
      box.innerHTML = '';
      if (this._admin && c.options) {
        const options = this._data.admin.options;
        let group = null;
        c.options.forEach((f) => {
          if (f.hideWhen && f.hideWhen(options)) return;
          if (f.late) return; // drawn by the category's own part (e.g. "Keep the trash" below the log)
          const row = this._adminOptionRow(c, f);
          if (f.group) {
            if (!group) {
              group = this._subsection(`sub_${f.group}`, t(`sub_${f.group}`), this._groupSummary(f.group));
              box.appendChild(group.el);
            }
            group.inner.appendChild(row);
          } else box.appendChild(row);
        });
      }
      if (c.custom === 'base' && this._admin) this._base(box);
      if (c.custom === 'rights') this._rights(box);
      if (c.custom === 'sensors' && this._admin) this._sensors(box);
      if (c.custom === 'data') this._dataSection(box);
      if (c.custom === 'maintenance' && this._admin) this._maintenanceSection(box);
      if (c.custom === 'tasks' && this._admin) this._tasksSection(box);
      if (c.custom === 'journal' && this._admin && this._journalSection) this._journalSection(box);
      if (c.custom === 'diagnostics' && this._open.has('diagnostics')) {
        if (this._diag) this._showDiagnostics(); else this._loadDiagnostics();
      }
    }

    // One integration option as a row (with marker and an optional note below it, 0.7.3)
    _adminOptionRow(c, f) {
      const t = this._t;
      const options = this._data.admin.options;
      if (f.persons) return this._personsOption(f);
      const shown = f.invert ? !options[f.key] : options[f.key];
      const field = { ...f, label: f.label ? t(f.label) : undefined, info: f.info ? t(f.info) : undefined };
      const row = this._row(field, shown, false, (value) => this._saveOption(f, f.invert ? !value : value),
        { kind: 'option', key: f.key, label: field.label || t(`st_${f.key}`) });
      this._optionMarker(row, c.id, f);
      const note = f.note && this._optionNote ? this._optionNote(f.note) : '';
      if (note) {
        const el = document.createElement('div');
        el.className = 'klein notiz';
        el.dataset.notiz = f.note;
        el.style.cssText = 'grid-column:1 / -1;margin-top:4px';
        el.textContent = note;
        row.appendChild(el);
      }
      return row;
    }

    // Marker for an integration option: differs from its built-in value?
    _optionMarker(row, category, f, existing = null) {
      const options = this._data.admin.options;
      const defaults = this._data.admin.option_defaults || {};
      if (!(f.key in defaults)) return;
      const norm = (v) => (f.emptyIs && !v ? f.emptyIs : v);
      const current = options[f.key];
      const standard = defaults[f.key];
      let holder = existing;
      if (!holder) {
        holder = document.createElement('span');
        holder.dataset.opt = f.key;
        const label = row.querySelector('.beschriftung');
        label.insertBefore(holder, label.querySelector('.info'));
      }
      this._fillMarker(holder, {
        undoKey: `option:${f.key}`,
        own: !same(norm(current), norm(standard)),
        standardText: this._valueText(f, f.invert ? !standard : (standard === '' && f.placeholder ? this._placeholder(f) : standard)),
        back: () => this._saveOption({ ...f, confirm: null }, JSON.parse(JSON.stringify(standard ?? null))),
        restore: () => this._saveOption({ ...f, confirm: null }, current),
        // text and number fields: the whole category again (the field shows the new value)
        redraw: () => this._redrawAdmin(category),
      });
    }

    _refreshOptionMarker(key) {
      const holder = this.querySelector(`.marker[data-opt="${window.CSS.escape(key)}"]`);
      const owner = ADMIN.find((c) => (c.options || []).some((f) => f.key === key));
      if (!holder || !owner) return;
      this._optionMarker(holder.closest('.zeile'), owner.id, owner.options.find((f) => f.key === key), holder);
    }

    // A sub-area that opens and closes; stays open/closed across redraws.
    _subsection(id, title, summary, warn = false) {
      this._subOpen = this._subOpen || new Set();
      const el = document.createElement('details');
      el.className = 'unter';
      el.open = this._subOpen.has(id);
      el.innerHTML = `<summary><span class="titel">${esc(title)}</span><span class="kurz2${warn ? ' warn' : ''}">${esc(summary || '')}</span>
        <ha-icon class="pfeil2" icon="mdi:chevron-down"></ha-icon></summary><div class="innen"></div>`;
      el.addEventListener('toggle', () => { if (el.open) this._subOpen.add(id); else this._subOpen.delete(id); });
      return { el, inner: el.querySelector('.innen'), summary: el.querySelector('.kurz2') };
    }

    _groupSummary(group) {
      const t = this._t;
      const o = (this._data.admin && this._data.admin.options) || {};
      if (group === 'precision') {
        const size = this._data.admin && this._data.admin.history_size;
        return [t('sum_interval', { n: o.min_interval }), t('sum_same_place', { n: o.same_place_distance }),
          Number(o.max_gps_accuracy) > 0 ? t('sum_accuracy', { n: o.max_gps_accuracy }) : '',
          Number(o.retention_days) > 0 ? t('sum_keep_days', { n: o.retention_days }) : t('sum_keep_forever'),
          size && this._bytes ? this._bytes(size.bytes) : ''].filter(Boolean).join(' · ');
      }
      return '';
    }

    _setOpen(id, open) {
      const card = this.querySelector(`#kat-${id}`);
      if (!card) return;
      card.classList.toggle('zu', !open);
      card.querySelector('.kat-kopf').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        this._open.add(id);
        // only the first time: a click on the open area must not load (and flicker) again
        if (id === 'diagnostics' && !this._diag) this._loadDiagnostics();
        if (id === 'journal' && this._journalRefresh) this._journalRefresh();
      } else this._open.delete(id);
      const ids = [...this.querySelectorAll('.kat')].map((c) => c.dataset.kat);
      const allOpen = ids.every((x) => this._open.has(x));
      const button = this.querySelector('.alle-klappen');
      if (button) {
        button.innerHTML = `<ha-icon icon="${allOpen ? 'mdi:unfold-less-horizontal' : 'mdi:unfold-more-horizontal'}"></ha-icon>${esc(this._t(allOpen ? 'collapse_all' : 'expand_all'))}`;
      }
    }

    _updateSummary(id) {
      const el = this.querySelector(`#kat-${id} .kurz`);
      if (el) el.textContent = this._summary(id);
    }

    _jump(id) {
      const card = this.querySelector(`#kat-${id}`);
      if (!card) return;
      this._setOpen(id, true);
      // The clicked entry stays marked until the user scrolls himself
      this._tocChosen = id;
      this._markToc(id);
      this._scrollTo(card, 'start');
    }

    _markToc(id) {
      this.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('aktiv', a.dataset.ziel === id));
      const jump = this.querySelector('.sprung select');
      if (jump && document.activeElement !== jump) jump.value = id;
    }

    // Highlights the category that is in view (at the very bottom: the lowest visible one).
    _watchToc() {
      if (this._observer) this._observer.disconnect();
      if (!window.IntersectionObserver) return;
      const visible = new Map();
      const own = () => { this._tocChosen = null; };
      if (!this._tocListeners) {
        this._tocListeners = true;
        ['wheel', 'touchmove'].forEach((ev) => window.addEventListener(ev, own, { passive: true, capture: true }));
        window.addEventListener('keydown', (e) => { if (/^(Arrow|Page|Home|End| )/.test(e.key)) own(); }, { capture: true });
      }
      this._tocUpdate = () => {
        if (this._tocChosen) { this._markToc(this._tocChosen); return; }
        const scroller = this._scroller();
        const atBottom = scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
        const shown = [...visible.entries()].filter(([, top]) => top !== null).sort((a, b) => a[1] - b[1]);
        const best = atBottom ? shown[shown.length - 1] : shown[0];
        if (best) this._markToc(best[0]);
      };
      this._observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => visible.set(e.target.dataset.kat, e.isIntersecting ? e.boundingClientRect.top : null));
        this._tocUpdate();
      }, { rootMargin: '0px 0px -60% 0px' });
      this.querySelectorAll('.kat').forEach((card) => this._observer.observe(card));
    }

    // --- a personal category ------------------------------------------------------------------
    _fillPersonal(c) {
      const t = this._t;
      const box = this.querySelector(`.felder[data-kat="${c.id}"]`);
      box.innerHTML = '';
      if (c.custom === 'persons') { this._persons(box, c.id); return; }
      const values = this._values(c.id);
      const locked = this._locked(c.id);
      c.fields.forEach((f) => {
        let row;
        if (f.custom === 'tiles') row = this._tiles(c.id);
        else if (f.custom === 'zones') row = this._zones(c.id);
        else if (f.custom === 'apps') row = this._apps(c.id);
        else {
          const fixed = locked || this._fixedKey(c.id, f.key);
          row = this._row(f, values[f.key], fixed, (value) => this._savePersonalChecked(c.id, f.key, value)
            .then((ok) => { if (ok && f.redraw) this._rerenderCategory(c.id); return ok; }),
            { kind: 'personal', scope: this._scope, user: this._user && this._user.id, category: c.id, key: f.key, label: t(`st_${f.key}`) });
          if (fixed && !locked) row.classList.add('fest');
        }
        row.dataset.key = f.key;
        if (f.needs) row.dataset.needs = f.needs;
        if (f.hideOff) row.dataset.verstecken = '1';
        this._fieldLockButton(row, c.id, f.custom === 'tiles' ? ['tiles'] : f.custom === 'zones' ? ['hidden_zones', 'zone_colors']
          : f.custom === 'apps' ? ['map_link_apps'] : [f.key]);
        box.appendChild(row);
      });
      this._applyNeeds(c.id);
      this._fillMarkers(c.id);
      this._colorWarnings(c.id);
    }

    // Colour settings (zone colours): a hint that cannot be clicked away while the contrast is too low.
    _colorWarnings(category) {
      const box = this.querySelector(`.felder[data-kat="${category}"]`);
      if (!box) return;
      const values = this._values(category);
      box.querySelectorAll(':scope > .zeile[data-key]').forEach((row) => {
        const c = PERSONAL.find((x) => x.id === category);
        const field = c && c.fields && c.fields.find((f) => f.key === row.dataset.key);
        if (!field || !field.color) return;
        let note = row.querySelector(':scope > .kontrast');
        const text = values.zones_in === 'none' ? '' : this._contrastHint(values[field.key]);
        if (!note) { note = document.createElement('div'); note.className = 'kontrast'; row.appendChild(note); }
        note.hidden = !text;
        note.textContent = text;
      });
    }

    _fillMarkers(category) {
      const keys = new Set([...this.querySelectorAll(`.felder[data-kat="${category}"] .marker[data-mk]`)]
        .map((m) => m.dataset.mk.split('|')[1]));
      keys.forEach((key) => this._updateOrigin(category, key));
    }

    // Scope "user": a lock per setting fixes it for this user.
    _fieldLockButton(row, category, keys) {
      if (this._scope !== 'user' || !this._user) return;
      const locks = this._userLocks(category);
      const whole = locks.includes('*');
      const on = whole || keys.every((k) => locks.includes(k));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `feldschloss${on ? ' an' : ''}`;
      button.disabled = whole;
      const title = this._t(on ? 'field_fixed' : 'field_free', { name: this._user.name });
      button.title = title;
      button.setAttribute('aria-label', title);
      button.innerHTML = `<ha-icon icon="${on ? 'mdi:lock' : 'mdi:lock-open-variant-outline'}"></ha-icon>`;
      button.addEventListener('click', () => {
        const next = on ? locks.filter((k) => !keys.includes(k)) : [...new Set([...locks, ...keys])];
        this._setFieldLock(category, next);
      });
      const label = row.querySelector('.beschriftung');
      if (label) label.appendChild(button);
    }

    async _setFieldLock(category, keys) {
      const ok = await this._ws({ type: 'whereabouts/settings/field_lock', user_id: this._user.id, category, keys }, true);
      if (ok === null) return;
      this._user.field_locks = { ...(this._user.field_locks || {}), [category]: keys };
      if (!keys.length) delete this._user.field_locks[category];
      this._rerenderCategory(category);
    }

    // Only this category again (the rest of the page stays where it is).
    _rerenderCategory(category) {
      const old = this.querySelector(`#kat-${category}`);
      const c = PERSONAL.find((x) => x.id === category);
      if (!old || !c) { this._render(); return; }
      [...this._pending.keys()].filter((k) => k.includes(`:${category}:`)).forEach((k) => this._pending.delete(k));
      const holder = document.createElement('div');
      holder.innerHTML = this._categoryHtml(c, true);
      const card = holder.firstElementChild;
      old.replaceWith(card);
      const head = card.querySelector('.kat-kopf');
      const toggle = (e) => { if (!e.target.closest('button')) this._setOpen(category, card.classList.contains('zu')); };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
      card.querySelectorAll('.sperre').forEach((b) => b.addEventListener('click', () => this._lockDialog(category)));
      card.querySelectorAll('.kat-kopf .ganz').forEach((b) => b.addEventListener('click', () => {
        const whole = this._userLocks(category).includes('*');
        this._setFieldLock(category, whole ? [] : ['*']);
      }));
      this._wireFoot(card);
      this._fillPersonal(c);
      if (this._observer) this._observer.observe(card);
      this._showSuccess();
    }

    // Greys out what only matters when another setting is on.
    _applyNeeds(category) {
      const values = this._values(category);
      const box = this.querySelector(`.felder[data-kat="${category}"]`);
      if (!box) return;
      box.querySelectorAll('[data-needs]').forEach((row) => {
        const value = values[row.dataset.needs];
        const off = value === false || value === 'none';
        if (row.dataset.verstecken) { row.hidden = off; return; }
        row.classList.toggle('aus', off);
        row.querySelectorAll('ha-selector, input, select, button.knopf').forEach((el) => {
          if (el.dataset.immer) return;
          el.disabled = off || this._locked(category) || this._fixedKey(category, row.dataset.key);
        });
      });
      const zones = box.querySelector('.zonen');
      if (zones) zones.classList.toggle('aus', values.zones_in === 'none');
    }

    // Place for the marker (own value / restore) of a setting; filled by _updateOrigin.
    _originHtml(category, key) {
      if (!PERSONAL.some((c) => c.id === category)) return '';
      return `<span class="marker" data-mk="${esc(`${category}|${key}`)}"></span>`;
    }

    _updateOrigin(category, key) {
      this.querySelectorAll(`.felder[data-kat="${category}"] .marker[data-mk="${window.CSS.escape(`${category}|${key}`)}"]`).forEach((holder) => {
        const c = PERSONAL.find((x) => x.id === category);
        const field = c && c.fields ? c.fields.find((f) => f.key === key) : null;
        const extra = { key, sel: field && field.sel };
        this._settingMarker(holder, category, key, field || (key.startsWith('carto_') ? { sel: (tt) => sel(CARTO_STYLES.map((v) => ({ value: v, label: tt(`ed_carto_${v}`) }))) } : extra));
      });
    }
  };
};
