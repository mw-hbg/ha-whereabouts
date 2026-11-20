// Whereabouts – settings page: import and export.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { sel, FORMAT_URL, maybe, esc, rich, S, D } = ctx;

  return class extends Base {
    // --- import and export ---------------------------------------------------------------------------------
    _dataSection(box) {
      const t = this._t;
      const d = this._data;
      const viewable = d.persons.filter((p) => (d.rights.history || []).includes(p.entity_id));
      const head = (icon, title) => {
        const el = document.createElement('div');
        el.className = 'abschnitt-kopf';
        el.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${esc(title)}`;
        return el;
      };
      box.appendChild(head('mdi:download', t('export_title')));
      const exportRow = document.createElement('div');
      exportRow.className = 'zeile';
      exportRow.style.borderTop = 'none';
      exportRow.innerHTML = `<div class="beschriftung"><span>${esc(t('export_data'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer"><button class="knopf voll laden" style="width:auto"${viewable.length ? '' : ' disabled'}><ha-icon icon="mdi:download"></ha-icon>${esc(t('export_data'))}</button></div>
        <div class="infotext" hidden>${rich(t('si_export'))}</div>`;
      this._infoToggle(exportRow);
      exportRow.querySelector('.laden').addEventListener('click', async () => {
        const persons = viewable.map((p) => {
          const own = ((this._data.effective.persons || {}).person_settings || {})[p.entity_id] || {};
          return { id: p.entity_id, name: own.name || p.name, color: own.color || S.personColor(this._hass, {}, p.entity_id) };
        });
        const days = new Set();
        await Promise.all(persons.map(async (p) => {
          try { ((await this._hass.callWS({ type: 'whereabouts/days', person: p.id })).days || []).forEach((x) => days.add(x)); } catch (err) { /* all days */ }
        }));
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        days.add(today);
        D.openDownloadDialog(S, { hass: this._hass, t, persons, selected: persons.map((p) => p.id), days, first: [...days].sort()[0] });
      });
      box.appendChild(exportRow);
      if (!this._admin) return;

      box.appendChild(head('mdi:upload', t('import_title')));
      const importHead = document.createElement('div');
      importHead.className = 'zeile breit';
      importHead.style.borderTop = 'none';
      importHead.innerHTML = `<div class="beschriftung"><span class="klein">${esc(t('import_intro'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_import'))}</div>`;
      this._infoToggle(importHead);
      box.appendChild(importHead);
      box.appendChild(this._row({ key: 'import_person', label: t('import_person'), info: t('si_import_person'),
        sel: sel([{ value: 'file', label: t('import_person_file') }, ...d.persons.map((p) => ({ value: p.entity_id, label: p.name }))]) },
      this._import.person || 'file', false, (value) => { this._import.person = value && value !== 'file' ? value : ''; return true; }));
      box.appendChild(this._row({ key: 'import_mode', label: t('import_mode'), info: t('si_import_mode'),
        sel: sel(['merge', 'skip', 'replace'].map((v) => ({ value: v, label: t(`import_mode_${v}`) }))) },
      this._import.mode, false, (value) => { this._import.mode = value || 'merge'; return true; }));
      const area = document.createElement('div');
      area.innerHTML = `<div class="ablage" tabindex="0" role="button">${esc(t('drop_file'))}</div>
        <input type="file" accept=".csv,.zip,.gpx" hidden>
        <div class="ergebnis"></div>
        ${this._formatHelpHtml()}`;
      const drop = area.querySelector('.ablage');
      const input = area.querySelector('input[type="file"]');
      const take = (f) => { if (f) this._importFile(f, area); };
      drop.addEventListener('click', () => input.click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      input.addEventListener('change', () => { take(input.files[0]); input.value = ''; });
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drueber'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drueber'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drueber'); take(e.dataTransfer.files[0]); });
      area.querySelector('.kopieren').addEventListener('click', async (e) => {
        const button = e.currentTarget;
        const text = area.querySelector('pre.prompt').textContent;
        try {
          await navigator.clipboard.writeText(text);
          button.innerHTML = `<ha-icon icon="mdi:check"></ha-icon>${esc(t('copied'))}`;
        } catch (err) {
          const range = document.createRange();
          range.selectNodeContents(area.querySelector('pre.prompt'));
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          this._toast(t('copy_manually'));
        }
      });
      area.querySelectorAll('.info').forEach((info) => info.addEventListener('click', () => {
        const text = info.parentElement.nextElementSibling;
        text.hidden = !text.hidden;
        info.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      }));
      box.appendChild(area);
    }

    // "What must the file look like?" and a prompt for an AI assistant.
    _formatHelpHtml() {
      const t = this._t;
      const anchor = S.language(this._hass) === 'de' ? '#deutsch' : '#english';
      const example = [
        'person,date,start,end,state,latitude,longitude,address',
        'alex,2026-06-24,00:00:00,08:12:40,home,52.528526,13.406622,',
        'alex,2026-06-24,08:20:11,08:35:02,not_home,52.531000,13.421000,"Main Street 1, Springfield"',
        'alex,2026-06-24,08:41:02,16:58:30,Work,52.509000,13.388000,',
      ].join('\n');
      return `<details class="hilfe"><summary>${esc(t('format_help'))}</summary>
          <p>${esc(t('format_help_csv'))}</p>
          <pre>${esc(example)}</pre>
          <ul>
            <li>${esc(t('format_col_person'))}</li><li>${esc(t('format_col_date'))}</li><li>${esc(t('format_col_time'))}</li>
            <li>${esc(t('format_col_state'))}</li><li>${esc(t('format_col_coords'))}</li><li>${esc(t('format_col_address'))}</li>
          </ul>
          <p>${esc(t('format_help_gpx'))}</p>
          <p>${esc(t('format_help_zip'))}</p>
          <p><a class="verweis" style="justify-self:start" href="${FORMAT_URL}${anchor}" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('format_more'))}</a></p>
        </details>
        <details class="hilfe"><summary>${esc(t('ai_help'))}</summary>
          <div class="reihe"><span style="flex:1 1 200px">${esc(t('ai_help_text'))}</span>
            <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
          <div class="infotext" hidden>${rich(t('ai_privacy'))}</div>
          <pre class="prompt">${esc(t('ai_prompt'))}</pre>
          <div class="reihe"><button class="knopf kopieren" type="button"><ha-icon icon="mdi:content-copy"></ha-icon>${esc(t('copy'))}</button></div>
        </details>`;
    }

    async _importCall(fileObject, preview, days) {
      const form = new FormData();
      form.append('file', fileObject);
      form.append('person', this._import.person || '');
      form.append('replace', this._import.mode === 'replace' ? 'true' : 'false');
      form.append('mode', this._import.mode || 'merge');
      form.append('preview', preview ? 'true' : 'false');
      if (days) form.append('days', days.join(','));
      const response = await this._hass.fetchWithAuth('/api/whereabouts/import', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw body;
      return body;
    }

    async _importFile(fileObject, root) {
      const t = this._t;
      const out = root.querySelector('.ergebnis');
      const nameOf = (key) => this._personName(`person.${key}`);
      out.textContent = t('import_checking');
      let preview;
      try {
        preview = await this._importCall(fileObject, true);
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${esc(maybe(t, `import_error_${err.error}`, t('import_failed')))}${err.detail ? ` (${esc(err.detail)})` : ''}</span>`;
        return;
      }
      out.textContent = '';
      const days = await this._importPreview(fileObject, preview, nameOf);
      if (!days) { out.textContent = t('import_cancelled'); return; }
      out.textContent = t('loading');
      try {
        const result = await this._importCall(fileObject, false, days);
        out.innerHTML = `<span class="ok">${esc(t('import_result', {
          added: result.added, skipped: result.skipped, days: result.days, persons: result.persons.map(nameOf).join(', '),
        }))}</span>`;
      } catch (err) {
        out.innerHTML = `<span class="schlecht">${esc(t('import_failed'))}</span>`;
      }
    }

    // Window with the plan per day; resolves with the ticked days ("person|date") or null.
    _importPreview(fileObject, preview, nameOf) {
      const t = this._t;
      const plan = preview.plan || [];
      const replace = preview.mode === 'replace';
      const chosen = new Set(plan.filter((d) => d.new > 0).map((d) => `${d.person}|${d.date}`));
      const placeOf = (e) => (e.state === 'not_home' && e.address ? e.address : S.placeText(t, e.state));
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog';
        const render = () => {
          const total = plan.filter((d) => chosen.has(`${d.person}|${d.date}`)).reduce((n, d) => n + d.new, 0);
          const nothing = plan.filter((d) => d.new === 0).length;
          overlay.innerHTML = `<div class="fenster breit" role="dialog" aria-modal="true">
            <h3>${esc(t('import_preview_title'))}</h3>
            <div class="text">${esc(t('import_preview', { file: fileObject.name, n: preview.total, days: preview.days, persons: preview.persons.map(nameOf).join(', '), from: preview.first, to: preview.last }))}</div>
            ${replace ? `<div class="warnung" style="margin:8px 0">${esc(t('confirm_import_replace'))}</div>` : ''}
            <div class="vorschau-tabelle"><table>
              <thead><tr><th><input type="checkbox" class="alle"${plan.some((d) => d.new > 0) && plan.every((d) => d.new === 0 || chosen.has(`${d.person}|${d.date}`)) ? ' checked' : ''}${plan.some((d) => d.new > 0) ? '' : ' disabled'} aria-label="${esc(t('select_all'))}"></th>
                <th>${esc(t('col_date'))}</th><th>${esc(t('col_person'))}</th><th>${esc(t('import_existing'))}</th><th>${esc(t('import_new'))}</th><th>${esc(t('import_status'))}</th><th></th></tr></thead>
              <tbody>${plan.map((d, i) => `<tr>
                <td><input type="checkbox" data-i="${i}"${chosen.has(`${d.person}|${d.date}`) ? ' checked' : ''}${d.new === 0 ? ' disabled' : ''}></td>
                <td>${esc(d.date)}</td><td>${esc(nameOf(d.person))}</td><td>${d.existing}</td><td>${d.new}</td>
                <td>${esc(t(`import_status_${d.status}`))}</td>
                <td>${d.new ? `<button class="auf" type="button" data-i="${i}">${esc(t('import_show'))}</button>` : ''}</td></tr>
                <tr class="details" data-for="${i}" hidden><td></td><td colspan="6">${d.entries.map((e) => `${esc(e.start.slice(0, 5))}–${esc(e.end.slice(0, 5))} ${esc(placeOf(e))}`).join('<br>')}${d.new > d.entries.length ? '<br>…' : ''}</td></tr>`).join('')}
              </tbody></table></div>
            <div class="text">${esc(t('import_summary', { n: total, days: chosen.size, none: nothing }))}</div>
            <div class="knoepfe"><button class="knopf" data-wahl="cancel">${esc(t('cancel'))}</button>
              <button class="knopf voll" data-wahl="ok"${chosen.size ? '' : ' disabled'}${replace ? ' style="background:var(--error-color,#db4437);border-color:var(--error-color,#db4437)"' : ''}>${esc(t('import_now'))}</button></div>
          </div>`;
          overlay.querySelectorAll('tbody input[data-i]').forEach((box) => box.addEventListener('change', () => {
            const d = plan[Number(box.dataset.i)];
            const key = `${d.person}|${d.date}`;
            if (box.checked) chosen.add(key); else chosen.delete(key);
            render();
          }));
          overlay.querySelector('.alle').addEventListener('change', (e) => {
            plan.forEach((d) => { if (d.new) { if (e.target.checked) chosen.add(`${d.person}|${d.date}`); else chosen.delete(`${d.person}|${d.date}`); } });
            render();
          });
          overlay.querySelectorAll('button.auf').forEach((b) => b.addEventListener('click', () => {
            const row = overlay.querySelector(`tr.details[data-for="${b.dataset.i}"]`);
            row.hidden = !row.hidden;
            b.textContent = t(row.hidden ? 'import_show' : 'import_hide');
          }));
          overlay.querySelector('[data-wahl="cancel"]').addEventListener('click', () => close(null));
          overlay.querySelector('[data-wahl="ok"]').addEventListener('click', () => close([...chosen]));
        };
        const close = (value) => { document.removeEventListener('keydown', key); overlay.remove(); resolve(value); };
        const key = (e) => { if (e.key === 'Escape') close(null); };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        document.addEventListener('keydown', key);
        (this.querySelector('.wa-set') || this).appendChild(overlay);
        render();
      });
    }
  };
};
