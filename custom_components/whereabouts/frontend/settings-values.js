// Whereabouts – settings page: whose values, own value or standard, markers, scroll position.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { PERSONAL, same, esc, VIEW_KEY, KEEP_VIEW_MS, S } = ctx;

  return class extends Base {
    // --- whose values ----------------------------------------------------------------------
    _values(category) {
      if (this._scope === 'defaults') return this._data.defaults[category];
      if (this._scope === 'user' && this._user) return this._user.effective[category];
      return this._data.effective[category];
    }

    _ownValues(category) {
      if (this._scope === 'user' && this._user) return this._user.own[category] || {};
      return this._data.own[category] || {};
    }

    // Fixed for the viewer (non-administrators): whole category or single keys.
    _locked(category) {
      return this._scope === 'own' && this._data.locked.includes(category);
    }

    _fixedKey(category, key) {
      if (this._scope !== 'own' || this._admin) return false;
      const keys = (this._data.field_locks || {})[category] || [];
      return keys.includes('*') || keys.includes(key);
    }

    _userLocks(category) {
      return (this._user && this._user.field_locks && this._user.field_locks[category]) || [];
    }

    _personName(id) {
      const p = (this._data.admin ? this._data.admin.all_persons : this._data.persons).find((x) => x.entity_id === id)
        || this._data.persons.find((x) => x.entity_id === id);
      return p ? p.name : id;
    }

    _userName(id) {
      const u = this._data.admin && this._data.admin.users.find((x) => x.id === id);
      return u ? u.name : id;
    }

    _flag(userId, name) {
      const admin = this._data.admin;
      const own = (admin.user_flags || {})[userId] || {};
      return name in own ? Boolean(own[name]) : Boolean((admin.all_flags || {})[name]);
    }

    // Are there users besides administrators (technical ones like MQTT not counted)?
    // Without them the page shows nothing about other users (no locks, no defaults, no table).
    _hasOtherUsers() {
      return Boolean(this._data && this._data.admin && this._data.admin.has_other_users);
    }

    // --- own value or standard ---------------------------------------------------------------------
    _scopeKey() {
      return `${this._scope}:${(this._scope === 'user' && this._user && this._user.id) || ''}`;
    }

    // What applies without an own value: the defaults (built-in values when editing the defaults).
    _standard(category, key) {
      if (this._scope === 'defaults') return (this._data.factory[category] || {})[key];
      return (this._data.defaults[category] || {})[key];
    }

    _isOwn(category, key) {
      if (this._scope === 'defaults') return !same(this._values(category)[key], this._standard(category, key));
      if (this._locked(category)) return false;
      return Object.prototype.hasOwnProperty.call(this._ownValues(category), key);
    }

    // Everything of a category at the built-in values ("Reset to standard" has nothing to do)
    _allFactory(category) {
      const values = this._values(category) || {};
      const factory = this._data.factory[category] || {};
      return Object.keys(factory).every((key) => same(values[key], factory[key]));
    }

    // Readable value for "Standard would be: …"
    _valueText(field, value) {
      const t = this._t;
      if (value === undefined || value === null || value === '') return t('value_empty');
      if (typeof value === 'boolean') return t(value ? 'value_on' : 'value_off');
      const selector = field && (typeof field.sel === 'function' ? field.sel(t) : field.sel);
      if (selector && selector.select) {
        const option = selector.select.options.find((o) => o.value === value);
        if (option) return option.label;
      }
      if (Array.isArray(value)) return value.length ? value.join(', ') : t('value_empty');
      if (typeof value === 'object') return t('value_custom');
      return `${value}${selector && selector.number && selector.number.unit_of_measurement ? ` ${selector.number.unit_of_measurement}` : ''}`;
    }

    _ringHtml() {
      return '<svg viewBox="0 0 22 22" aria-hidden="true"><circle class="ring-hg" cx="11" cy="11" r="9"/><circle class="ring" cx="11" cy="11" r="9"/></svg>';
    }

    // Fills a marker: own value → dot + arrow; within 30 s after the arrow → "Restore" with a ring.
    // spec: { undoKey, own, standardText, back: async () => bool, restore: async () => bool, redraw() }
    _fillMarker(holder, spec) {
      if (!holder) return;
      const t = this._t;
      holder.innerHTML = '';
      holder.classList.add('marker');
      const pending = this._undo.get(spec.undoKey);
      if (pending && pending.until > Date.now()) {
        const left = (pending.until - Date.now()) / 1000;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wiederherstellen';
        button.title = t('restore_title');
        button.innerHTML = `${this._ringHtml()}<ha-icon icon="mdi:undo"></ha-icon>${esc(t('restore'))}`;
        button.querySelector('.ring').style.animationDelay = `-${Math.max(0, 30 - left)}s`;
        button.addEventListener('click', async (e) => {
          e.stopPropagation();
          button.disabled = true;
          this._undo.delete(spec.undoKey);
          if (await pending.restore() === false) button.disabled = false;
          spec.redraw();
        });
        holder.appendChild(button);
        return;
      }
      if (!spec.own) return;
      const dot = document.createElement('span');
      dot.className = 'punkt-eigen';
      const title = spec.standardText !== undefined ? t('own_value_hint', { value: spec.standardText }) : t('own_value');
      dot.title = title;
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', title);
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'zurueck-pfeil';
      back.title = t('back_to_standard');
      back.setAttribute('aria-label', `${t('back_to_standard')} (${title})`);
      back.innerHTML = '<ha-icon icon="mdi:undo-variant"></ha-icon>';
      back.addEventListener('click', async (e) => {
        e.stopPropagation();
        back.disabled = true;
        const restore = spec.restore;
        if (await spec.back() === false) { back.disabled = false; return; }
        const until = Date.now() + 30000;
        this._undo.set(spec.undoKey, { restore, until });
        setTimeout(() => {
          const entry = this._undo.get(spec.undoKey);
          if (entry && entry.until <= Date.now()) { this._undo.delete(spec.undoKey); spec.redraw(); }
        }, 30100);
        spec.redraw();
      });
      holder.append(dot, back);
    }

    // Marker of a normal setting (personal category)
    _settingMarker(holder, category, key, field) {
      const current = this._values(category)[key];
      const standard = this._standard(category, key);
      this._fillMarker(holder, {
        undoKey: `${this._scopeKey()}:${category}:${key}`,
        own: this._isOwn(category, key),
        standardText: this._valueText(field, standard),
        back: () => this._savePersonal(category, key, JSON.parse(JSON.stringify(standard ?? null))),
        restore: () => this._savePersonal(category, key, current),
        redraw: () => this._redrawCategory(category),
      });
    }

    // After a change of one setting: the category again, but nothing else on the page
    _redrawCategory(category) {
      if (PERSONAL.some((c) => c.id === category)) this._rerenderCategory(category);
      else this._redrawAdmin(category);
    }

    _editableUsers() {
      return this._data.admin.users.filter((u) => u.active && !u.is_admin && (this._showTechnical || !u.technical));
    }

    // --- scroll position: kept across redraws and when Home Assistant rebuilds the page ----------
    _scroller() {
      let el = this.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      }
      return document.scrollingElement;
    }

    // Scroll only our own area (scrollIntoView would also move Home Assistant's page around it).
    _scrollTo(el, block) {
      const scroller = this._scroller();
      if (!el || !scroller) return;
      const own = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
      const top = el.getBoundingClientRect().top - own;
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      const target = block === 'center'
        ? scroller.scrollTop + top - (scroller.clientHeight - el.offsetHeight) / 2
        : scroller.scrollTop + top - margin - 8;
      scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }

    _anchor() {
      const cards = [...this.querySelectorAll('.kat')];
      const top = Math.max(0, this._scroller() === document.scrollingElement ? 0 : this._scroller().getBoundingClientRect().top);
      const card = cards.find((c) => c.getBoundingClientRect().bottom > top + 10);
      return card ? { id: card.dataset.kat, offset: card.getBoundingClientRect().top - top } : null;
    }

    _restoreAnchor(anchor) {
      if (!anchor) return;
      const card = this.querySelector(`#kat-${anchor.id}`);
      const scroller = this._scroller();
      if (!card || !scroller) return;
      const top = Math.max(0, scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top);
      scroller.scrollTop += card.getBoundingClientRect().top - top - anchor.offset;
    }

    // Only while the page is shown: once Home Assistant has taken it away nothing can be measured.
    _noteAnchor() {
      if (!this.isConnected || !this.getClientRects().length || !this.querySelector('.kat')) return;
      this._lastAnchor = this._anchor();
    }

    // Called by the sidebar page when another tab is shown.
    deactivate() {
      this._noteAnchor();
      this._leftAt = Date.now();
    }

    // Back on this tab: within a minute the same place, later the page as when opened.
    activate() {
      if (!this._data) return;
      const away = this._leftAt ? Date.now() - this._leftAt : 0;
      this._leftAt = null;
      if (away <= KEEP_VIEW_MS) {
        const anchor = this._lastAnchor;
        S.whenSized(this.querySelector('.wa-set'), () => this._restoreAnchor(anchor));
        return;
      }
      this._resetView();
    }

    // Start state: own settings, main areas open, at the top. Areas with unsaved changes stay open.
    _resetView() {
      const unsaved = new Set([...this._pending.keys()].map((id) => {
        const row = this.querySelector(`[data-pid="${window.CSS.escape(id)}"]`);
        const card = row && row.closest('.kat');
        return card && card.dataset.kat;
      }).filter(Boolean));
      const start = new Set(PERSONAL.filter((c) => c.weight === 'main').map((c) => c.id));
      if (this._scope !== 'own' && !this._pending.size) {
        this._scope = 'own';
        this._user = null;
        this._open = start;
        this._pendingAnchor = null;
        this._render();
      } else {
        this.querySelectorAll('.kat').forEach((card) => {
          const id = card.dataset.kat;
          this._setOpen(id, unsaved.size ? unsaved.has(id) : start.has(id));
        });
      }
      this._lastAnchor = null;
      S.whenSized(this.querySelector('.wa-set'), () => requestAnimationFrame(() => {
        const scroller = this._scroller();
        if (scroller) scroller.scrollTop = 0;
      }));
    }

    _storeView() {
      if (!this._data) return;
      const shown = this.isConnected && this.getClientRects().length && this.querySelector('.kat');
      try {
        window.sessionStorage.setItem(VIEW_KEY, JSON.stringify({
          time: Date.now(), anchor: shown ? this._anchor() : this._lastAnchor, open: this._open ? [...this._open] : null,
          scope: this._scope === 'user' ? 'own' : this._scope, success: this._success,
        }));
      } catch (err) { /* no storage */ }
    }

    _restoreView() {
      try {
        const view = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) || 'null');
        window.sessionStorage.removeItem(VIEW_KEY);
        if (!view || Date.now() - view.time > KEEP_VIEW_MS) return;
        if (view.open) this._open = new Set(view.open);
        if (view.scope) this._scope = view.scope;
        this._pendingAnchor = view.anchor;
        this._lastAnchor = view.anchor;
        if (view.success && view.success.until > Date.now()) this._success = view.success;
      } catch (err) { /* nothing */ }
    }
  };
};
