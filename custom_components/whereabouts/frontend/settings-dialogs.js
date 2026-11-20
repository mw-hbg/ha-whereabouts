// Whereabouts – settings page: unsaved changes, new users, dialogs and messages.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { same, extractCartoKey, esc } = ctx;

  return class extends Base {
    // --- unsaved changes ---------------------------------------------------------------------------------------
    // Asked by the page before switching tabs: true = may leave.
    async confirmLeave() {
      if (!this._pending.size) return true;
      const t = this._t;
      const items = [...this._pending.entries()];
      const choice = await this._choice(t('leave_title'),
        `<div class="text">${esc(t('leave_text'))}</div><ul>${items.map(([id, p]) => `<li><a href="#" class="feldlink" data-id="${esc(id)}">${esc(p.label)}</a></li>`).join('')}</ul>`,
        [{ id: 'cancel', label: t('cancel') }, { id: 'discard', label: t('discard'), danger: true }, { id: 'save', label: t('save_now'), main: true }]);
      if (choice && choice.startsWith('field:')) {
        this._goToField(choice.slice(6));
        return false;
      }
      if (choice === 'save') {
        let ok = true;
        for (const p of [...this._pending.values()]) ok = (await p.save()) && ok;
        return ok;
      }
      if (choice === 'discard') {
        [...this._pending.values()].forEach((p) => p.discard());
        this._pending.clear();
        return true;
      }
      return false;
    }

    _draftKey() {
      return `whereabouts-drafts-${(this._data && this._data.user && this._data.user.id) || 'x'}`;
    }

    _storeDrafts() {
      const drafts = [...this._pending.values()].map((p) => p.draft).filter(Boolean);
      try {
        if (drafts.length) window.localStorage.setItem(this._draftKey(), JSON.stringify(drafts));
      } catch (err) {
        // storage not available: nothing to keep
      }
    }

    _readDrafts() {
      try {
        const drafts = JSON.parse(window.localStorage.getItem(this._draftKey()) || '[]');
        return Array.isArray(drafts) ? drafts : [];
      } catch (err) {
        return [];
      }
    }

    // Throw away unsaved changes in one area (before it is reset).
    _discardIn(category) {
      const card = this.querySelector(`#kat-${category}`);
      if (!card) return;
      [...this._pending.entries()].forEach(([id, p]) => {
        if (!card.querySelector(`[data-pid="${window.CSS.escape(id)}"]`)) return;
        p.discard();
        this._pending.delete(id);
      });
    }

    _forgetDraft(id) {
      const drafts = this._readDrafts();
      const rest = drafts.filter((d) => d.id !== id);
      if (rest.length === drafts.length) return;
      try {
        if (rest.length) window.localStorage.setItem(this._draftKey(), JSON.stringify(rest));
        else window.localStorage.removeItem(this._draftKey());
      } catch (err) { /* nothing */ }
    }

    _clearDrafts() {
      try { window.localStorage.removeItem(this._draftKey()); } catch (err) { /* nothing */ }
    }

    _showDrafts() {
      const box = this.querySelector('.entwuerfe');
      const drafts = this._readDrafts();
      if (!box || !drafts.length) return;
      const t = this._t;
      drafts.forEach((d) => {
        const entry = d.id && this._savables.get(d.id);
        const card = entry && entry.row.closest('.kat');
        if (card) this._setOpen(card.dataset.kat, true);
      });
      box.innerHTML = `<div class="banner"><ha-icon icon="mdi:content-save-alert"></ha-icon>
        <span class="text">${esc(t('drafts_found'))}: ${drafts.map((d, i) => `<a href="#" class="feldlink" data-i="${i}">${esc(d.label)}</a>`).join(', ')}</span>
        <button class="knopf" data-wahl="verwerfen">${esc(t('discard'))}</button>
        <button class="knopf voll" data-wahl="speichern">${esc(t('save'))}</button></div>`;
      box.querySelectorAll('.feldlink').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        const draft = drafts[Number(a.dataset.i)];
        if (draft && draft.id && this._savables.has(draft.id)) this._goToField(draft.id, draft.value);
      }));
      box.querySelector('[data-wahl="verwerfen"]').addEventListener('click', () => { this._clearDrafts(); box.innerHTML = ''; });
      box.querySelector('[data-wahl="speichern"]').addEventListener('click', async () => {
        let ok = true;
        for (const draft of drafts) ok = (await this._applyDraft(draft)) && ok;
        if (ok) { this._clearDrafts(); this._setSuccess(t('drafts_saved')); }
        await this._load();
      });
    }

    async _applyDraft(draft) {
      const withUser = (message) => (draft.user ? { ...message, user_id: draft.user } : message);
      const scope = draft.scope === 'defaults' ? 'defaults' : 'own';
      if (draft.kind === 'personal') {
        if ((draft.scope === 'defaults' || draft.user) && !this._admin) return true;
        return this._ws(withUser({ type: 'whereabouts/settings/save', scope, category: draft.category, values: { [draft.key]: draft.value } })) !== null;
      }
      if (draft.kind === 'option') {
        if (!this._admin) return true;
        const value = draft.key === 'carto_api_key' ? extractCartoKey(draft.value) : draft.value;
        if (value === null) return false;
        return this._ws({ type: 'whereabouts/settings/options', values: { [draft.key]: value } }) !== null;
      }
      if (draft.kind === 'person') {
        let values = draft.scope === 'defaults' ? this._data.defaults[draft.category] : this._data.effective[draft.category];
        if (draft.user) {
          try { values = (await this._hass.callWS({ type: 'whereabouts/settings/user', user_id: draft.user })).effective[draft.category]; } catch (err) { return false; }
        }
        const settings = { ...(values.person_settings || {}) };
        const entry = { ...(settings[draft.person] || {}), ...draft.value };
        settings[draft.person] = Object.fromEntries(Object.entries(entry).filter(([k, v]) => v && !(k === 'show_in' && v === 'both')));
        if (!Object.keys(settings[draft.person]).length) delete settings[draft.person];
        return this._ws(withUser({ type: 'whereabouts/settings/save', scope, category: draft.category,
          values: { persons: values.persons || [], person_settings: settings } })) !== null;
      }
      return true;
    }

    // --- new users: which settings they start with, and their rights ---------------------------------------
    async _askNewUsers() {
      const t = this._t;
      const admin = this._data.admin;
      if (!admin || this._askedNew || this._scope !== 'own' || !this._hasOtherUsers()) return;
      const ids = (admin.pending_users || []).filter((id) => admin.users.some((u) => u.id === id));
      if (!ids.length) return;
      this._askedNew = true; // once per opening of the page ("Later" asks again next time)
      const users = ids.map((id) => admin.users.find((u) => u.id === id));
      const kinds = ['live', 'history', 'delete'];
      const persons = this._data.persons;
      const rightsHtml = users.map((u) => `<div class="person-recht" data-user="${esc(u.id)}"><b>${esc(u.name)}</b>
        ${kinds.map((kind) => `<div class="rechtzeile"><span>${esc(t(`right_${kind}`))}</span><span class="chips">${persons.map((p) => `<label class="chip"><input type="checkbox" data-kind="${kind}" value="${esc(p.entity_id)}"${this._ruleAllows(kind, u, p) ? ' checked' : ''}>${esc(p.name)}</label>`).join('')}</span></div>`).join('')}</div>`).join('');
      const html = `<h3>${esc(t(users.length > 1 ? 'new_users_title_many' : 'new_users_title', { name: users[0].name, n: users.length }))}</h3>
        <div class="text">${esc(t('new_users_text', { names: users.map((u) => u.name).join(', ') }))}</div>
        <div class="neue-benutzer" style="margin-top:10px">
          ${['copy', 'sync', 'factory', 'later'].map((v, i) => `<label><input type="radio" name="start" value="${v}"${i === 0 ? ' checked' : ''}>${esc(t(`new_users_${v}`))}</label>`).join('')}
          <div class="klein" style="margin:10px 0 4px">${esc(t('new_users_rights'))}</div>
          ${rightsHtml}
        </div>`;
      const result = await this._dialog(html, t('save'), false, (win) => ({
        action: win.querySelector('input[name="start"]:checked').value,
        rights: Object.fromEntries([...win.querySelectorAll('.person-recht')].map((el) => [el.dataset.user,
          Object.fromEntries(kinds.map((kind) => [kind, [...el.querySelectorAll(`input[data-kind="${kind}"]:checked`)].map((i) => i.value)]))])),
      }));
      const action = result ? result.action : 'later';
      if (action !== 'later') await this._ws({ type: 'whereabouts/settings/new_users', user_ids: ids, action }, true);
      if (result) {
        for (const u of users) {
          const wanted = result.rights[u.id];
          const rules = Object.fromEntries(kinds.map((kind) => [kind, persons.filter((p) => this._ruleAllows(kind, u, p)).map((p) => p.entity_id)]));
          if (wanted && !same(wanted, rules)) await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: wanted }, true);
        }
      }
      if (result) {
        this._setSuccess(t(action === 'later' ? 'new_users_later_done' : 'new_users_done'), 'rights');
        await this._load();
      }
    }

    // --- dialogs ---------------------------------------------------------------------------------------------------
    _confirm(title, text, ok, danger) {
      return this._dialog(`<h3>${esc(title)}</h3><div class="text">${esc(text)}</div>`, ok, danger, () => true)
        .then((value) => Boolean(value));
    }

    _dialog(html, ok, danger, read) {
      return this._choice(null, html, [
        { id: 'cancel', label: this._t('cancel') },
        { id: 'ok', label: ok, main: true, danger },
      ], read);
    }

    // buttons: [{ id, label, main, danger }]; resolves with the id (or read(window) for "ok"),
    // or "field:<id>" when a field link in the text was clicked.
    _choice(title, html, buttons, read) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog';
        overlay.innerHTML = `<div class="fenster" role="dialog" aria-modal="true">${title ? `<h3>${esc(title)}</h3>` : ''}${html}
          <div class="knoepfe">${buttons.map((b) => `<button class="knopf${b.main ? ' voll' : ''}${b.danger && !b.main ? ' gefahr' : ''}" data-wahl="${b.id}"${b.main && b.danger ? ' style="background:var(--error-color,#db4437);border-color:var(--error-color,#db4437)"' : ''}>${esc(b.label)}</button>`).join('')}</div></div>`;
        const close = (value) => { document.removeEventListener('keydown', key); overlay.remove(); resolve(value); };
        const key = (e) => { if (e.key === 'Escape') close(read ? null : 'cancel'); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(read ? null : 'cancel'); });
        overlay.querySelectorAll('[data-wahl]').forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.wahl;
          if (read) close(id === 'ok' ? read(overlay.querySelector('.fenster')) : null);
          else close(id);
        }));
        overlay.querySelectorAll('.feldlink').forEach((a) => a.addEventListener('click', (e) => {
          e.preventDefault();
          close(`field:${a.dataset.id}`);
        }));
        document.addEventListener('keydown', key);
        (this.querySelector('.wa-set') || this).appendChild(overlay);
        overlay.querySelector('[data-wahl="cancel"]').focus();
      });
    }

    _toast(text, error, ok) {
      let toast = this.querySelector('.toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        (this.querySelector('.wa-set') || this).appendChild(toast);
      }
      toast.textContent = text;
      toast.classList.toggle('fehler', Boolean(error));
      toast.classList.toggle('ok', Boolean(ok));
      toast.classList.add('an');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => toast.classList.remove('an'), error ? 5000 : 1600);
    }
  };
};
