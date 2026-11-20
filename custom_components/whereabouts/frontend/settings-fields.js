// Whereabouts – settings page: one setting (label, ⓘ, control) and saving.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { ADMIN, hexToRgb, rgbToHex, same, esc, rich } = ctx;

  return class extends Base {
    // --- one setting: label, ⓘ, control -----------------------------------------------------
    // draft: { kind, scope, user, category, key, label } – how an unsaved text/number value is saved later.
    _row(field, value, disabled, onChange, draft) {
      const t = this._t;
      const row = document.createElement('div');
      const selector = typeof field.sel === 'function' ? field.sel(t) : field.sel;
      const isSwitch = 'boolean' in selector;
      row.className = `zeile${isSwitch ? ' schalter-zeile' : ''}`;
      const label = field.label || t(`st_${field.key}`);
      const origin = draft && draft.category ? this._originHtml(draft.category, field.key) : '';
      const fixedNote = disabled && draft && draft.category && this._fixedKey(draft.category, field.key) && !this._locked(draft.category)
        ? `<span class="herkunft">${esc(t('locked_badge'))}</span>` : '';
      row.innerHTML = `<div class="beschriftung"><span>${esc(label)}</span>${origin}${fixedNote}
          <button class="info" type="button" aria-expanded="false" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}: ${esc(label)}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer${isSwitch ? ' schalter' : ''}"></div>
        <div class="infotext" hidden>${rich(field.info || t(`si_${field.key}`))}</div>`;
      this._infoToggle(row);
      const typed = Boolean(field.text || 'number' in selector);
      if (!typed) {
        row.querySelector('.steuer').appendChild(this._control(selector, field, value, disabled, onChange));
        return row;
      }
      // Text and numbers: only "Save" or Enter saves.
      const id = `${draft ? `${draft.kind}:${draft.scope || ''}:${draft.user || ''}:${draft.category || ''}:` : ''}${field.key}${field.idSuffix || ''}`;
      const savable = this._savable(row, {
        id, label, initial: value ?? (field.text ? '' : value), draft,
        save: (v) => onChange(v),
      });
      const control = this._control(selector, field, value, disabled, (v) => savable.set(field.text ? (v ?? '') : v));
      savable.reset = (v) => { if (control.tagName === 'HA-SELECTOR') control.value = v; else control.value = v ?? ''; };
      savable.focus = () => { const input = control.tagName === 'HA-SELECTOR' ? control : control; input.focus && input.focus(); };
      row.querySelector('.steuer').appendChild(control);
      return row;
    }

    // A "Not saved · Save" line for a row. Returns { set(value), reset, focus }.
    _savable(row, spec) {
      const t = this._t;
      const line = document.createElement('div');
      line.className = 'speicher';
      const unsavedHtml = `<span class="ungespeichert">${esc(t('not_saved'))}</span>
        <button class="knopf verwerfen" type="button" data-immer="1"><ha-icon icon="mdi:undo"></ha-icon>${esc(t('discard'))}</button>
        <button class="knopf voll speichern" type="button" data-immer="1"><ha-icon icon="mdi:content-save"></ha-icon>${esc(t('save'))}</button>`;
      line.innerHTML = unsavedHtml;
      row.appendChild(line);
      row.dataset.pid = spec.id;
      const state = { initial: spec.initial, current: spec.initial };
      const showSaved = () => {
        line.classList.add('an');
        line.innerHTML = `<span class="gespeichert">${esc(t('saved_check'))}</span>`;
        clearTimeout(line._timer);
        line._timer = setTimeout(() => {
          if (line.querySelector('.gespeichert')) line.classList.remove('an');
        }, 2500);
      };
      const showUnsaved = () => {
        if (!line.querySelector('.speichern')) {
          line.innerHTML = unsavedHtml;
          line.querySelector('.speichern').addEventListener('click', () => api.save());
          line.querySelector('.verwerfen').addEventListener('click', () => api.discard());
        }
        line.classList.add('an');
      };
      const api = {
        set: (v) => {
          state.current = v;
          const dirty = !same(v, state.initial);
          if (dirty) {
            showUnsaved();
            this._pending.set(spec.id, {
              label: spec.label,
              draft: spec.draft ? { ...spec.draft, id: spec.id, value: v } : null,
              save: () => api.save(),
              discard: () => api.discard(),
            });
          } else {
            if (line.querySelector('.speichern')) line.classList.remove('an');
            this._pending.delete(spec.id);
          }
        },
        save: async () => {
          if (same(state.current, state.initial)) return true;
          const value = state.current;
          // From the click on: no longer "unsaved" (the page may be rebuilt meanwhile).
          const pending = this._pending.get(spec.id);
          this._pending.delete(spec.id);
          const button = line.querySelector('.speichern');
          if (button) button.disabled = true;
          const ok = await spec.save(value);
          if (button) button.disabled = false;
          if (ok === false || ok === null) {
            if (pending && row.isConnected) this._pending.set(spec.id, pending);
            return false;
          }
          state.initial = value;
          if (row.isConnected) showSaved();
          return true;
        },
        // Back to the saved value.
        discard: () => {
          api.reset(state.initial);
          api.set(state.initial);
          this._forgetDraft(spec.id);
        },
        reset: () => {},
        focus: () => {},
      };
      line.querySelector('.speichern').addEventListener('click', () => api.save());
      line.querySelector('.verwerfen').addEventListener('click', () => api.discard());
      row.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        if (!this._pending.has(spec.id)) return;
        e.preventDefault();
        api.save();
      });
      this._savables.set(spec.id, { api, row });
      return api;
    }

    // Jump to an unsaved field (from the leave dialog or the drafts hint).
    _goToField(id, value) {
      const entry = this._savables.get(id);
      if (!entry) return;
      const card = entry.row.closest('.kat');
      if (card) this._setOpen(card.dataset.kat, true);
      if (value !== undefined) { entry.api.reset(value); entry.api.set(value); }
      this._scrollTo(entry.row, 'center');
      entry.row.classList.remove('blitz');
      void entry.row.offsetWidth;
      entry.row.classList.add('blitz');
      // Remove it again: a page shown again would replay the animation.
      entry.row.addEventListener('animationend', () => entry.row.classList.remove('blitz'), { once: true });
      setTimeout(() => entry.api.focus(), 400);
    }

    _control(selector, field, value, disabled, emit) {
      const shown = field.color ? hexToRgb(value) : value;
      const out = (v) => emit(field.color ? rgbToHex(v) : v);
      // Switches: Home Assistant's switch itself (sits centred in the row, no extra space)
      if ('boolean' in selector && customElements.get('ha-switch')) {
        const el = document.createElement('ha-switch');
        el.checked = Boolean(value);
        el.disabled = disabled;
        el.addEventListener('change', (e) => { e.stopPropagation(); out(el.checked); });
        return el;
      }
      if (this._haSelector) {
        const el = document.createElement('ha-selector');
        el.hass = this._hass;
        el.selector = selector;
        el.value = shown;
        el.disabled = disabled;
        // required: no "clear" cross in selections
        el.required = 'select' in selector;
        el.addEventListener('value-changed', (e) => { e.stopPropagation(); el.value = e.detail.value; out(e.detail.value); });
        if (field.color) el.classList.add('farbfeld');
        if (field.placeholder) el.placeholder = this._placeholder(field);
        return el;
      }
      return this._plainControl(selector, field, value, disabled, out);
    }

    _placeholder(field) {
      // the dashboard's name: what Home Assistant shows when the field is empty
      if (field.placeholder === 'panel_title') return String((this._hass.config && this._hass.config.language) || '').startsWith('de') ? 'Standorte' : 'Whereabouts';
      return this._t(field.placeholder);
    }

    // Without Home Assistant's form elements: plain inputs.
    _plainControl(selector, field, value, disabled, emit) {
      let el;
      if ('boolean' in selector) {
        el = document.createElement('input');
        el.type = 'checkbox';
        el.checked = Boolean(value);
        el.addEventListener('change', () => emit(el.checked));
      } else if ('select' in selector) {
        el = document.createElement('select');
        el.className = 'ein';
        selector.select.options.forEach((o) => el.add(new Option(o.label, o.value, false, o.value === value)));
        el.addEventListener('change', () => emit(el.value));
      } else if ('color_rgb' in selector) {
        el = document.createElement('input');
        el.type = 'color';
        el.className = 'ein';
        el.value = (value || '#000000').toLowerCase();
        el.addEventListener('change', () => emit(hexToRgb(el.value)));
      } else {
        el = document.createElement('input');
        el.className = 'ein';
        el.type = 'number' in selector ? 'number' : 'text';
        if ('number' in selector) { el.min = selector.number.min; el.max = selector.number.max; el.step = selector.number.step; }
        el.value = value === undefined || value === null ? '' : value;
        if (field.placeholder) el.placeholder = this._placeholder(field);
        el.addEventListener('input', () => emit('number' in selector ? Number(el.value) : el.value));
      }
      el.disabled = disabled;
      return el;
    }

    // Ticks for persons (instead of Home Assistant's entity picker).
    _checkList(persons, chosen, disabled, onChange, extra) {
      const box = document.createElement('div');
      box.className = 'liste-haken';
      const set = new Set(chosen);
      persons.forEach((p) => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${esc(p.entity_id)}"${set.has(p.entity_id) ? ' checked' : ''}${disabled ? ' disabled' : ''}>
          <span>${esc(p.name)}</span>${extra ? `<span class="klein">${esc(extra(p) || '')}</span>` : ''}`;
        label.querySelector('input').addEventListener('change', async (e) => {
          const next = new Set(set);
          if (e.target.checked) next.add(p.entity_id); else next.delete(p.entity_id);
          const ok = await onChange([...persons.map((x) => x.entity_id).filter((id) => next.has(id))], e.target);
          if (ok === false) { e.target.checked = !e.target.checked; return; }
          if (e.target.checked) set.add(p.entity_id); else set.delete(p.entity_id);
        });
        box.appendChild(label);
      });
      return box;
    }

    _infoToggle(root) {
      root.querySelectorAll('.info').forEach((info) => {
        if (info.dataset.verbunden) return;
        info.dataset.verbunden = '1';
        info.addEventListener('click', () => {
          const text = info.closest('.zeile, .person').querySelector('.infotext');
          text.hidden = !text.hidden;
          info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
        });
      });
    }

    // --- saving -------------------------------------------------------------------------------
    // quiet: no message (the field shows "Saved ✓" itself); errors always.
    async _ws(message, quiet = true) {
      try {
        const result = await this._hass.callWS(message);
        if (!quiet) this._toast(this._t('saved'), false, true);
        return result === undefined || result === null ? true : result;
      } catch (err) {
        this._toast(this._t('save_failed', { error: (err && (err.message || err.code)) || err }), true);
        return null;
      }
    }

    _saveMessage(category, values) {
      const message = { type: 'whereabouts/settings/save', scope: this._scope === 'defaults' ? 'defaults' : 'own', category, values };
      if (this._scope === 'user' && this._user) message.user_id = this._user.id;
      return message;
    }

    // Hiding the settings view: say how to come back (administrators: gear in the maps).
    async _savePersonalChecked(category, key, value) {
      const t = this._t;
      if (key === 'view_settings' && value === false && this._scope === 'own') {
        if (!await this._confirm(t('st_view_settings'), t(this._admin ? 'confirm_hide_settings_admin' : 'confirm_hide_settings'), t('hide'), false)) {
          this._rerenderCategory(category);
          return false;
        }
      }
      return this._savePersonal(category, key, value);
    }

    async _savePersonal(category, key, value) {
      const ok = await this._ws(this._saveMessage(category, { [key]: value }));
      if (ok === null) return false;
      // Like the server: a value equal to the standard is no own value.
      const standard = this._standard(category, key);
      const plain = same(value, standard);
      const mirror = (own) => {
        const next = { ...(own[category] || {}) };
        if (plain) delete next[key]; else next[key] = value;
        if (Object.keys(next).length) own[category] = next; else delete own[category];
      };
      if (this._scope === 'defaults') this._data.defaults[category][key] = value;
      else if (this._scope === 'user' && this._user) {
        mirror(this._user.own);
        this._user.effective[category][key] = value;
      } else {
        mirror(this._data.own);
        this._data.effective[category][key] = value;
      }
      this._refreshFoot(category);
      this._updateOrigin(category, key);
      this._applyNeeds(category);
      this._updateSummary(category);
      this._colorWarnings(category);
      return true;
    }

    // Whole category back to the built-in values; administrators with other users may do it for everybody.
    async _resetCategory(category) {
      const t = this._t;
      const name = t(`cat_${category}`);
      const text = this._scope === 'defaults' ? t('confirm_reset_defaults', { name })
        : this._scope === 'user' ? t('confirm_reset_user', { name, user: this._user.name })
          : t('confirm_reset_category', { name });
      const everyoneBox = this._admin && this._scope === 'own' && this._hasOtherUsers()
        ? `<label style="margin-top:12px"><input type="checkbox" class="fuer-alle">${esc(t('reset_for_everyone'))}</label>` : '';
      const result = await this._dialog(`<h3>${esc(t('reset_category'))}</h3><div class="text">${esc(text)}</div>${everyoneBox}`,
        t('reset'), true, (win) => ({ everyone: Boolean(win.querySelector('.fuer-alle') && win.querySelector('.fuer-alle').checked) }));
      if (!result) return;
      this._discardIn(category);
      const key = `${this._scopeKey()}:${category}`;
      let restore = null;
      if (this._scope === 'defaults') {
        // the defaults: back to the built-in values; restore = save the old defaults again
        const before = JSON.parse(JSON.stringify(this._data.defaults[category]));
        if (await this._ws({ type: 'whereabouts/settings/reset', scope: 'defaults', category }, true) === null) return;
        restore = () => this._ws({ type: 'whereabouts/settings/save', scope: 'defaults', category, values: before }, true);
      } else {
        const message = { type: 'whereabouts/settings/reset', scope: 'own', category, factory: true, everyone: result.everyone };
        if (this._scope === 'user') message.user_id = this._user.id;
        const answer = await this._ws(message, true);
        if (answer === null) return;
        const token = answer && answer.undo;
        if (token) restore = () => this._ws({ type: 'whereabouts/settings/restore', token }, true);
      }
      if (restore) {
        this._catUndo.set(key, { restore, until: Date.now() + 30000 });
        setTimeout(() => {
          const entry = this._catUndo.get(key);
          if (entry && entry.until <= Date.now()) { this._catUndo.delete(key); this._refreshFoot(category); }
        }, 30100);
      }
      await this._load();
    }

    async _saveOption(field, value) {
      const t = this._t;
      if (field.confirm === 'retention' && Number(value) > 0) {
        // how many days would disappear tonight
        let files = null;
        try { files = (await this._hass.callWS({ type: 'whereabouts/settings/retention_preview', days: Number(value) })).files; } catch (err) { files = null; }
        const text = files ? t('confirm_retention_count', { n: value, files }) : t('confirm_retention', { n: value });
        const ok = await this._confirm(t('st_retention_days'), text, t('save'), true);
        if (!ok) { this._redrawAdmin('recording'); return false; }
      }
      if (field.confirm === 'panel' && value === false) {
        const ok = await this._confirm(t('st_panel_hidden'), t('confirm_hide_panel'), t('hide'), false);
        if (!ok) { this._redrawAdmin('sidebar'); return false; }
      }
      this._noteAnchor(); // the sidebar entry may make Home Assistant rebuild the page
      this._storeView();
      const ok = await this._ws({ type: 'whereabouts/settings/options', values: { [field.key]: value } });
      if (ok === null) return false;
      this._data.admin.options[field.key] = value;
      ['sidebar', 'recording', 'addresses'].forEach((id) => this._updateSummary(id));
      // fields that depend on this one (e.g. the distance only with the phone as source), markers
      const owner = ADMIN.find((c) => (c.options || []).some((f) => f.key === field.key));
      const typed = field.text || 'number' in ((typeof field.sel === 'function' ? field.sel(t) : field.sel) || {});
      if (owner && !typed) this._redrawAdmin(owner.id);
      else {
        this._refreshOptionMarker(field.key);
        const group = owner && (owner.options.find((f) => f.key === field.key) || {}).group;
        const summary = group && this.querySelector(`#kat-${owner.id} details.unter .kurz2`);
        if (summary) summary.textContent = this._groupSummary(group);
      }
      if (field.key === 'address_sensors' || field.key === 'address_source') this._redrawAdmin('addresses');
      ADMIN.filter((c) => (c.reset || []).includes(field.key)).forEach((c) => this._refreshAdminFoot(c.id));
      return true;
    }
  };
};
