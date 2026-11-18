// Whereabouts – window "Download location data" (history card and settings page).
// One file, or a ZIP when the chosen splitting gives more than one file.

const CSS = `
  .wa-dl { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px;
           background: rgba(0,0,0,.45); font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); }
  .wa-dl .fenster { width: min(520px, 100%); max-height: 92vh; overflow: auto; box-sizing: border-box; padding: 20px 22px 16px;
                    background: var(--card-background-color, #fff); color: var(--primary-text-color, #222);
                    border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .wa-dl h3 { margin: 0 0 14px; font-size: 20px; font-weight: 400; display: flex; align-items: center; gap: 10px; }
  .wa-dl h3 svg { width: 24px; height: 24px; fill: var(--primary-color, #03a9f4); }
  .wa-dl .abschnitt { margin: 0 0 14px; }
  .wa-dl .titel { font-size: 13px; font-weight: 500; color: var(--secondary-text-color, #666); margin: 0 0 6px; }
  .wa-dl .reihe { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .wa-dl .segmente { display: inline-flex; border: 1px solid var(--divider-color, #ddd); border-radius: 18px; overflow: hidden; }
  .wa-dl .segmente button { font: inherit; font-size: 14px; padding: 6px 14px; border: none; background: none; cursor: pointer;
                            color: var(--primary-text-color, #222); }
  .wa-dl .segmente button.an { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .wa-dl input[type="date"] { font: inherit; font-size: 14px; padding: 7px 9px; border: 1px solid var(--divider-color, #ddd);
                              border-radius: 8px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); }
  .wa-dl label { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; cursor: pointer; }
  .wa-dl label.aus { opacity: .45; cursor: default; }
  .wa-dl .punkt { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
  .wa-dl input[type="checkbox"], .wa-dl input[type="radio"] { accent-color: var(--primary-color, #03a9f4); margin: 0; }
  .wa-dl .hinweis { font-size: 13px; color: var(--secondary-text-color, #666); margin: 4px 0 0; }
  .wa-dl .fehler { font-size: 13px; color: var(--error-color, #db4437); min-height: 1em; }
  .wa-dl .knoepfe { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .wa-dl .knoepfe button { font: inherit; font-size: 14px; font-weight: 500; padding: 8px 16px; border-radius: 18px; cursor: pointer;
                           border: 1px solid var(--divider-color, #ddd); background: none; color: var(--primary-color, #03a9f4); }
  .wa-dl .knoepfe button.los { background: var(--primary-color, #03a9f4); border-color: var(--primary-color, #03a9f4);
                               color: var(--text-primary-color, #fff); }
  .wa-dl .knoepfe button:disabled { opacity: .5; cursor: default; }
`;

export const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>';

const MAX_DAYS = 3660;

// persons: [{ id, name, color }] (only those the user may see); selected: ids ticked at the start
export function openDownloadDialog(S, { hass, t, persons, selected, from, to }) {
  const esc = S.escapeHtml;
  if (!document.getElementById('wa-dl-css')) {
    const style = document.createElement('style');
    style.id = 'wa-dl-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = {
    range: Boolean(to && to !== from),
    from: from || today,
    to: to || from || today,
    persons: new Set(selected && selected.length ? selected : persons.map((p) => p.id)),
    format: 'csv',
    perDay: false,
    perPerson: false,
  };
  const box = document.createElement('div');
  box.className = 'wa-dl';
  const close = () => { document.removeEventListener('keydown', key); box.remove(); };
  const key = (e) => { if (e.key === 'Escape') close(); };

  const render = () => {
    const days = state.range ? Math.round((new Date(state.to) - new Date(state.from)) / 86400000) + 1 : 1;
    const several = state.persons.size > 1;
    const files = (state.perDay && days > 1 ? days : 1) * (state.perPerson && several ? state.persons.size : 1);
    box.innerHTML = `<div class="fenster" role="dialog" aria-modal="true" aria-label="${esc(t('download_title'))}">
      <h3>${DOWNLOAD_ICON}${esc(t('download_title'))}</h3>
      <div class="abschnitt"><div class="titel">${esc(t('download_period'))}</div>
        <div class="reihe">
          <div class="segmente" role="tablist">
            <button type="button" data-modus="tag" class="${state.range ? '' : 'an'}">${esc(t('mode_day'))}</button>
            <button type="button" data-modus="zeitraum" class="${state.range ? 'an' : ''}">${esc(t('mode_range'))}</button>
          </div>
          <input type="date" class="von" value="${state.from}" max="${today}" aria-label="${esc(t('from'))}">
          ${state.range ? `<span>–</span><input type="date" class="bis" value="${state.to}" max="${today}" aria-label="${esc(t('to'))}">` : ''}
        </div></div>
      <div class="abschnitt"><div class="titel">${esc(t('download_persons'))}</div>
        ${persons.map((p) => `<label><input type="checkbox" class="person" value="${esc(p.id)}"${state.persons.has(p.id) ? ' checked' : ''}>
          <span class="punkt" style="background:${S.safeColor(p.color, '#888')}"></span>${esc(p.name)}</label>`).join('')}
      </div>
      <div class="abschnitt"><div class="titel">${esc(t('format'))}</div>
        <div class="reihe">
          <label><input type="radio" name="format" value="csv"${state.format === 'csv' ? ' checked' : ''}>CSV (${esc(t('format_csv_hint'))})</label>
          <label><input type="radio" name="format" value="gpx"${state.format === 'gpx' ? ' checked' : ''}>GPX (${esc(t('format_gpx_hint'))})</label>
        </div></div>
      <div class="abschnitt"><div class="titel">${esc(t('download_per_day'))}</div>
        <label class="${days > 1 ? '' : 'aus'}"><input type="radio" name="tag" value="0"${state.perDay ? '' : ' checked'}${days > 1 ? '' : ' disabled'}>${esc(t('download_one_file'))}</label>
        <label class="${days > 1 ? '' : 'aus'}"><input type="radio" name="tag" value="1"${state.perDay ? ' checked' : ''}${days > 1 ? '' : ' disabled'}>${esc(t('download_each_day'))}</label>
      </div>
      ${several ? `<div class="abschnitt"><div class="titel">${esc(t('download_per_person'))}</div>
        <label><input type="radio" name="person" value="0"${state.perPerson ? '' : ' checked'}>${esc(t('download_together'))}</label>
        <label><input type="radio" name="person" value="1"${state.perPerson ? ' checked' : ''}>${esc(t('download_each_person'))}</label>
      </div>` : ''}
      <p class="hinweis">${esc(files > 1 ? t('download_zip', { n: files }) : t('download_single'))}</p>
      <div class="fehler"></div>
      <div class="knoepfe"><button type="button" class="abbrechen">${esc(t('cancel'))}</button>
        <button type="button" class="los"${state.persons.size ? '' : ' disabled'}>${esc(t('download'))}</button></div>
    </div>`;
    box.querySelectorAll('.segmente button').forEach((b) => b.addEventListener('click', () => {
      state.range = b.dataset.modus === 'zeitraum';
      if (!state.range) state.to = state.from;
      render();
    }));
    box.querySelector('.von').addEventListener('change', (e) => {
      state.from = e.target.value || today;
      if (!state.range || state.to < state.from) state.to = state.from;
      render();
    });
    const bis = box.querySelector('.bis');
    if (bis) bis.addEventListener('change', (e) => { state.to = e.target.value || state.from; render(); });
    box.querySelectorAll('.person').forEach((c) => c.addEventListener('change', () => {
      if (c.checked) state.persons.add(c.value); else state.persons.delete(c.value);
      render();
    }));
    box.querySelectorAll('input[name="format"]').forEach((r) => r.addEventListener('change', () => { state.format = r.value; }));
    box.querySelectorAll('input[name="tag"]').forEach((r) => r.addEventListener('change', () => { state.perDay = r.value === '1'; render(); }));
    box.querySelectorAll('input[name="person"]').forEach((r) => r.addEventListener('change', () => { state.perPerson = r.value === '1'; render(); }));
    box.querySelector('.abbrechen').addEventListener('click', close);
    box.querySelector('.los').addEventListener('click', () => download());
  };

  const download = async () => {
    const error = box.querySelector('.fehler');
    let first = state.from;
    let last = state.range ? state.to : state.from;
    if (last < first) [first, last] = [last, first];
    if ((new Date(last) - new Date(first)) / 86400000 > MAX_DAYS) { error.textContent = t('download_too_long'); return; }
    const button = box.querySelector('.los');
    button.disabled = true;
    button.textContent = t('loading');
    const ids = persons.map((p) => p.id).filter((id) => state.persons.has(id));
    const query = new URLSearchParams({
      persons: ids.join(','), from: first, to: last, format: state.format,
      split_day: state.perDay ? '1' : '0', split_person: state.perPerson ? '1' : '0',
    });
    try {
      const response = await hass.fetchWithAuth(`/api/whereabouts/export?${query}`);
      if (!response.ok) throw new Error(`${response.status}`);
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = match ? match[1] : `whereabouts.${state.format}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      close();
    } catch (err) {
      error.textContent = t('export_failed');
      button.disabled = false;
      button.textContent = t('download');
    }
  };

  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(box);
  render();
}
