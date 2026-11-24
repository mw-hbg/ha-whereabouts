// Whereabouts – settings page: log and trash of the data maintenance (0.7.3, administrators only).
// "What was done when" below the data maintenance, "Restore" while the backup is kept,
// deleting entries, "Keep the trash", sizes of the trash and of the history.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { esc, ADMIN } = ctx;
  const PAGE = 30; // entries shown at first ("Show more" adds as many)
  const HINT = 300;

  return class extends Base {
    // --- sizes ------------------------------------------------------------------------------------------
    _bytes(n) {
      const lang = (this._hass && ((this._hass.locale && this._hass.locale.language) || this._hass.language)) || 'en';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let value = Number(n) || 0;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
      const digits = unit === 0 || value >= 100 ? 0 : 1;
      return `${new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} ${units[unit]}`;
    }

    _personName(key) {
      const id = `person.${key}`;
      const lists = [(this._data && this._data.persons) || [], (this._data && this._data.admin && this._data.admin.all_persons) || []];
      for (const list of lists) {
        const found = list.find((p) => p.entity_id === id);
        if (found && found.name) return found.name;
      }
      return key;
    }

    // The text below an option (see "note" in settings-page.js)
    _optionNote(kind) {
      const t = this._t;
      const admin = (this._data && this._data.admin) || {};
      if (kind === 'history_size') {
        const size = admin.history_size;
        if (!size || !size.days) return t('size_history_empty');
        const persons = Object.entries(size.persons || {}).map(([key, p]) => t('size_person', { name: this._personName(key), size: this._bytes(p.bytes) }));
        return t('size_history', { size: this._bytes(size.bytes), days: size.days, persons: persons.join(' · ') });
      }
      if (kind === 'trash_size') {
        const journal = this._journal || admin.journal;
        const text = journal ? t('size_trash', { n: journal.trash_entries || 0, size: this._bytes(journal.trash_bytes || 0) }) : '';
        const never = Number((admin.options || {}).trash_days) === 0 ? t('trash_never_hint') : '';
        return [text, never].filter(Boolean).join(' ');
      }
      return '';
    }

    _journalSummary() {
      const t = this._t;
      const admin = (this._data && this._data.admin) || {};
      const journal = this._journal || admin.journal || {};
      const days = Number((admin.options || {}).trash_days);
      return [t('sum_journal', { n: journal.entries || 0 }), t('size_trash_short', { size: this._bytes(journal.trash_bytes || 0) }),
        days > 0 ? t('sum_trash_days', { n: days }) : t('sum_trash_forever')].join(' · ');
    }

    // --- the subsection below the data maintenance ----------------------------------------------------------
    _journalSection(box) {
      const t = this._t;
      const c = ADMIN.find((x) => x.id === 'maintenance');
      const admin = this._data.admin || {};
      const journal = admin.journal || {};
      const part = this._subsection('sub_journal', t('sub_journal'), this._journalSummary(), Boolean(journal.hint));
      box.appendChild(part.el);
      this._journalPart = part;
      const intro = document.createElement('div');
      intro.className = 'hinweis';
      intro.style.margin = '4px 0 8px';
      intro.textContent = t('journal_intro');
      part.inner.appendChild(intro);
      (c.options || []).filter((f) => f.late).forEach((f) => part.inner.appendChild(this._adminOptionRow(c, f)));
      const list = document.createElement('div');
      list.className = 'protokoll';
      part.inner.appendChild(list);
      this._journalShown = PAGE;
      const load = () => { if (part.el.open) this._journalRefresh(); };
      part.el.addEventListener('toggle', load);
      setTimeout(load, 0); // opened before: load once the section is on the page
    }

    async _journalRefresh() {
      const part = this._journalPart;
      if (!part || !part.el.isConnected) return;
      let data;
      try { data = await this._hass.callWS({ type: 'whereabouts/journal/list' }); } catch (err) { return; }
      this._journal = data;
      if (this._data.admin) this._data.admin.journal = { entries: data.entries, hint: data.hint, trash_bytes: data.trash_bytes, trash_entries: data.trash_entries };
      part.summary.textContent = this._journalSummary();
      part.summary.classList.toggle('warn', Boolean(data.hint));
      const note = part.inner.querySelector('[data-notiz="trash_size"]');
      if (note) note.textContent = this._optionNote('trash_size');
      this._updateSummary('maintenance');
      this._journalList(part.inner.querySelector('.protokoll'), data);
    }

    // After every change of stored data from this page the log is read again.
    async _ws(message, quiet) {
      const result = await super._ws(message, quiet);
      if (result !== null && message && message.preview === false
        && /^whereabouts\/(maintenance|addresses\/start)/.test(message.type || '')) this._journalRefresh();
      return result;
    }

    _journalTime(iso) {
      const lang = (this._hass && ((this._hass.locale && this._hass.locale.language) || this._hass.language)) || 'en';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso || '';
      return date.toLocaleString(lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    _journalDate(value) {
      if (!value) return '';
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }

    _journalLine(e) {
      const t = this._t;
      const persons = (e.persons || []).map((key) => this._personName(key)).join(', ');
      const range = e.from || e.to
        ? (e.from === e.to ? this._journalDate(e.from) : `${this._journalDate(e.from) || '…'} – ${this._journalDate(e.to) || '…'}`)
        : t('journal_all_days');
      const facts = [persons || t('journal_all_persons'), range];
      if (e.action === 'addresses') {
        facts.push(e.status === 'running' || e.status === 'paused' ? t('journal_addr_running', { total: e.total || 0 })
          : t('journal_addr_found', { n: e.rows || 0, total: e.total || 0 }));
        if (e.status === 'cancelled') facts.push(t('journal_cancelled'));
      } else {
        facts.push(t('journal_counts', { rows: e.rows || 0, days: e.days || 0 }));
      }
      if (e.trash) facts.push(this._bytes(e.size || 0));
      return facts.join(' · ');
    }

    _journalList(el, data) {
      const t = this._t;
      if (!el) return;
      const items = data.items || [];
      const shown = items.slice(0, this._journalShown || PAGE);
      el.innerHTML = `${data.entries >= HINT ? `<div class="warnung" style="margin:8px 0">${esc(t('journal_hint', { n: data.entries }))}</div>` : ''}
        ${items.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
          <button class="knopf gefahr aufraeumen" type="button" style="width:auto"><ha-icon icon="mdi:delete-sweep"></ha-icon>${esc(t('journal_delete_older'))}</button></div>` : ''}
        ${items.length ? '' : `<div class="hinweis" style="margin:6px 0">${esc(t('journal_empty'))}</div>`}
        <div class="eintraege">${shown.map((e) => `<div class="eintrag" data-id="${esc(e.id)}" style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--divider-color)">
          <div style="flex:1;min-width:0">
            <div><b>${esc(t(`journal_action_${e.action}`))}</b> <span class="klein">${esc(this._journalTime(e.time))}${e.user ? ` · ${esc(e.user)}` : ''}</span></div>
            <div class="klein">${esc(this._journalLine(e))}</div>
            ${e.action === 'restore' && e.ref_action ? `<div class="klein">${esc(t('journal_restored_from', { action: t(`journal_action_${e.ref_action}`) }))}</div>` : ''}
            ${e.restored ? `<div class="klein">${esc(t('journal_was_restored'))}</div>` : ''}
            ${e.expired ? `<div class="klein">${esc(t('journal_expired'))}</div>` : ''}
          </div>
          ${e.trash ? `<button class="knopf wiederherstellen" type="button" style="width:auto"><ha-icon icon="mdi:backup-restore"></ha-icon>${esc(t('journal_restore'))}</button>` : ''}
          <button class="knopf loeschen" type="button" style="width:auto" aria-label="${esc(t('journal_delete'))}" title="${esc(t('journal_delete'))}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
        </div>`).join('')}</div>
        ${items.length > shown.length ? `<button class="knopf mehr" type="button" style="width:auto;margin-top:8px">${esc(t('journal_more', { n: items.length - shown.length }))}</button>` : ''}`;
      el.querySelectorAll('.eintrag').forEach((row) => {
        const entry = items.find((e) => e.id === row.dataset.id);
        const restore = row.querySelector('.wiederherstellen');
        if (restore) restore.addEventListener('click', () => this._journalRestore(entry));
        row.querySelector('.loeschen').addEventListener('click', () => this._journalDelete(entry));
      });
      const more = el.querySelector('.mehr');
      if (more) more.addEventListener('click', () => { this._journalShown = (this._journalShown || PAGE) + PAGE; this._journalList(el, data); });
      const older = el.querySelector('.aufraeumen');
      if (older) older.addEventListener('click', () => this._journalDeleteOlder());
    }

    // --- restoring ----------------------------------------------------------------------------------------
    async _journalRestore(entry) {
      const t = this._t;
      let preview;
      try { preview = await this._hass.callWS({ type: 'whereabouts/journal/restore', entry: entry.id }); } catch (err) {
        this._toast(t('journal_restore_gone'), true);
        this._journalRefresh();
        return;
      }
      const changed = preview.changed || [];
      const days = changed.map((name) => {
        const cut = name.lastIndexOf('_');
        return `${this._personName(name.slice(0, cut))} ${this._journalDate(name.slice(cut + 1))}`;
      });
      const html = `<h3>${esc(t('journal_restore_title', { action: t(`journal_action_${entry.action}`) }))}</h3>
        <div class="text">${esc(t('journal_restore_text', { days: entry.days || 0, time: this._journalTime(entry.time) }))}</div>
        ${changed.length ? `<div class="warnung" style="margin:8px 0">${esc(t('journal_restore_changed', { n: changed.length }))}<br>${days.slice(0, 20).map(esc).join('<br>')}${days.length > 20 ? '<br>…' : ''}</div>` : ''}
        <div class="text klein" style="margin-top:8px">${esc(t('journal_restore_undo'))}</div>`;
      const ok = await this._dialog(html, t('journal_restore'), changed.length > 0, () => true);
      if (!ok) return;
      const done = await this._ws({ type: 'whereabouts/journal/restore', entry: entry.id, preview: false });
      if (!done) return;
      this._toast(t('journal_restore_done', { days: done.days }), false, true);
      this._journalRefresh();
    }

    // --- deleting entries ---------------------------------------------------------------------------------
    async _journalDelete(entry) {
      const t = this._t;
      const text = entry.trash ? t('journal_delete_text_trash') : t('journal_delete_text');
      if (!await this._confirm(t('journal_delete'), text, t('delete'), true)) return;
      const done = await this._ws({ type: 'whereabouts/journal/delete', ids: [entry.id] });
      if (done) this._journalRefresh();
    }

    async _journalDeleteOlder() {
      const t = this._t;
      const html = `<h3>${esc(t('journal_delete_older'))}</h3>
        <div class="text">${esc(t('journal_delete_older_text'))}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
          <input type="number" class="tage" min="0" max="36500" step="1" value="90" style="width:90px" aria-label="${esc(t('journal_days'))}">
          <span>${esc(t('journal_days'))}</span></div>`;
      const days = await this._dialog(html, t('delete'), true, (win) => Number(win.querySelector('.tage').value));
      if (days === null || days === undefined || !Number.isFinite(days) || days < 0) return;
      // 0 days: everything (up to and including today)
      const limit = new Date(Date.now() - (days - (days === 0 ? 1 : 0)) * 86400000);
      const before = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
      const done = await this._ws({ type: 'whereabouts/journal/delete', before });
      if (done) {
        this._toast(t('journal_deleted', { n: done.deleted }), false, true);
        this._journalRefresh();
      }
    }
  };
};
