// Whereabouts – window "Export data" (history card and settings page).
// One file, or a ZIP when the chosen splitting gives more than one file; from the
// history card also a picture of the map (JPG).

const picker = import(`./datepicker.js${new URL(import.meta.url).search}`);

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
  .wa-dl .zeitraum { font: inherit; font-size: 14px; padding: 8px 12px; border: 1px solid var(--divider-color, #ddd); border-radius: 18px;
                     background: none; color: var(--primary-text-color, #222); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
  .wa-dl .zeitraum svg { width: 18px; height: 18px; fill: var(--secondary-text-color, #666); }
  .wa-dl .abschnitt.aus { opacity: .45; pointer-events: none; }
  .wa-dl .warnung { font-size: 13px; padding: 8px 12px; border-radius: 8px; background: rgba(255,166,0,.16);
                    border-left: 4px solid var(--warning-color, #ffa600); margin: 0 0 12px; }
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

const CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5Z"/></svg>';

// persons: [{ id, name, color }] (only those the user may see); selected: ids ticked at the start;
// days: Set of dates with data (or null); first: first date with data;
// mapImage: { current(), whole() } -> Promise<Blob> (history card only)
export function openDownloadDialog(S, { hass, t, persons, selected, from, to, days, first, mapImage }) {
  const esc = S.escapeHtml;
  const lang = S.language(hass);
  if (!document.getElementById('wa-dl-css')) {
    const style = document.createElement('style');
    style.id = 'wa-dl-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const state = {
    from: from || today,
    to: to || from || today,
    persons: new Set(selected && selected.length ? selected : persons.map((p) => p.id)),
    format: 'csv',
    area: 'current',
    perDay: false,
    perPerson: false,
  };
  const box = document.createElement('div');
  box.className = 'wa-dl';
  const close = () => { document.removeEventListener('keydown', key); box.remove(); };
  const key = (e) => { if (e.key === 'Escape' && !document.querySelector('.wa-dp')) close(); };

  const render = async () => {
    const P = await picker;
    const days = P.daysBetween(state.from, state.to);
    const several = state.persons.size > 1;
    const image = state.format === 'jpg';
    const files = (state.perDay && days > 1 ? days : 1) * (state.perPerson && several ? state.persons.size : 1);
    box.innerHTML = `<div class="fenster" role="dialog" aria-modal="true" aria-label="${esc(t('export_data'))}">
      <h3>${DOWNLOAD_ICON}${esc(t('export_data'))}</h3>
      <div class="abschnitt"><div class="titel">${esc(t('format'))}</div>
        <div class="reihe">
          <label><input type="radio" name="format" value="csv"${state.format === 'csv' ? ' checked' : ''}>CSV (${esc(t('format_csv_hint'))})</label>
          <label><input type="radio" name="format" value="gpx"${state.format === 'gpx' ? ' checked' : ''}>GPX (${esc(t('format_gpx_hint'))})</label>
          ${mapImage ? `<label><input type="radio" name="format" value="jpg"${image ? ' checked' : ''}>${esc(t('format_jpg'))}</label>` : ''}
        </div></div>
      ${image ? `<div class="abschnitt"><div class="titel">${esc(t('image_area'))}</div>
        <label><input type="radio" name="bereich" value="current"${state.area === 'current' ? ' checked' : ''}>${esc(t('image_current'))}</label>
        <label><input type="radio" name="bereich" value="whole"${state.area === 'whole' ? ' checked' : ''}>${esc(t('image_whole'))}</label>
        <p class="hinweis">${esc(t('image_hint'))}</p></div>` : ''}
      <div class="abschnitt${image ? ' aus' : ''}"><div class="titel">${esc(t('download_period'))}</div>
        <button type="button" class="zeitraum">${CALENDAR}${esc(P.rangeText(lang, state.from, state.to))}</button>
      </div>
      ${!image && days > P.LARGE_DAYS ? `<div class="warnung">${esc(t('large_period_warning'))}</div>` : ''}
      <div class="abschnitt${image ? ' aus' : ''}"><div class="titel">${esc(t('download_persons'))}</div>
        ${persons.map((p) => `<label><input type="checkbox" class="person" value="${esc(p.id)}"${state.persons.has(p.id) ? ' checked' : ''}>
          <span class="punkt" style="background:${S.safeColor(p.color, '#888')}"></span>${esc(p.name)}</label>`).join('')}
      </div>
      ${image ? '' : `<div class="abschnitt"><div class="titel">${esc(t('download_per_day'))}</div>
        <label class="${days > 1 ? '' : 'aus'}"><input type="radio" name="tag" value="0"${state.perDay ? '' : ' checked'}${days > 1 ? '' : ' disabled'}>${esc(t('download_one_file'))}</label>
        <label class="${days > 1 ? '' : 'aus'}"><input type="radio" name="tag" value="1"${state.perDay ? ' checked' : ''}${days > 1 ? '' : ' disabled'}>${esc(t('download_each_day'))}</label>
      </div>
      ${several ? `<div class="abschnitt"><div class="titel">${esc(t('download_per_person'))}</div>
        <label><input type="radio" name="person" value="0"${state.perPerson ? '' : ' checked'}>${esc(t('download_together'))}</label>
        <label><input type="radio" name="person" value="1"${state.perPerson ? ' checked' : ''}>${esc(t('download_each_person'))}</label>
      </div>` : ''}
      <p class="hinweis">${esc(files > 1 ? t('download_zip', { n: files }) : t('download_single'))}</p>`}
      <div class="fehler"></div>
      <div class="knoepfe"><button type="button" class="abbrechen">${esc(t('cancel'))}</button>
        <button type="button" class="los"${image || state.persons.size ? '' : ' disabled'}>${esc(t('download'))}</button></div>
    </div>`;
    box.querySelector('.zeitraum').addEventListener('click', async () => {
      const result = await P.openDatePicker({ t, lang, from: state.from, to: state.to, today, days, first });
      if (result) { state.from = result.from; state.to = result.to; render(); }
    });
    box.querySelectorAll('.person').forEach((c) => c.addEventListener('change', () => {
      if (c.checked) state.persons.add(c.value); else state.persons.delete(c.value);
      render();
    }));
    box.querySelectorAll('input[name="format"]').forEach((r) => r.addEventListener('change', () => { state.format = r.value; render(); }));
    box.querySelectorAll('input[name="bereich"]').forEach((r) => r.addEventListener('change', () => { state.area = r.value; }));
    box.querySelectorAll('input[name="tag"]').forEach((r) => r.addEventListener('change', () => { state.perDay = r.value === '1'; render(); }));
    box.querySelectorAll('input[name="person"]').forEach((r) => r.addEventListener('change', () => { state.perPerson = r.value === '1'; render(); }));
    box.querySelector('.abbrechen').addEventListener('click', close);
    box.querySelector('.los').addEventListener('click', () => download());
  };

  const save = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  const download = async () => {
    const error = box.querySelector('.fehler');
    const button = box.querySelector('.los');
    button.disabled = true;
    button.textContent = t('loading');
    if (state.format === 'jpg') {
      try {
        const blob = await (state.area === 'whole' ? mapImage.whole() : mapImage.current());
        save(blob, `whereabouts_${state.from}${state.from === state.to ? '' : `_${state.to}`}.jpg`);
        close();
      } catch (err) {
        console.error('Whereabouts: map picture failed', err);
        error.textContent = t(err && err.message === 'tainted' ? 'image_blocked' : 'image_failed');
        button.disabled = false;
        button.textContent = t('download');
      }
      return;
    }
    const ids = persons.map((p) => p.id).filter((id) => state.persons.has(id));
    const query = new URLSearchParams({
      persons: ids.join(','), from: state.from, to: state.to, format: state.format,
      split_day: state.perDay ? '1' : '0', split_person: state.perPerson ? '1' : '0',
    });
    try {
      const response = await hass.fetchWithAuth(`/api/whereabouts/export?${query}`);
      if (!response.ok) throw new Error(`${response.status}`);
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      save(await response.blob(), match ? match[1] : `whereabouts.${state.format}`);
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

// Exactly these entries (from "Select entries") as CSV or GPX, built in the browser.
export function exportEntries(S, { entries, format, name }) {
  const q = (v) => {
    const text = String(v ?? '');
    const safe = /^[=+@\t\r-]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  let text;
  if (format === 'gpx') {
    const x = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    const iso = (date, time) => new Date(`${date}T${time}`).toISOString();
    text = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Whereabouts" xmlns="http://www.topografix.com/GPX/1/1">\n${
      entries.map((e) => `  <wpt lat="${Number(e.lat).toFixed(6)}" lon="${Number(e.lon).toFixed(6)}"><time>${iso(e.date, e.time)}</time><name>${x(e.person.split('.')[1])}: ${x(e.state === 'not_home' && e.address ? e.address : e.state)}</name></wpt>`).join('\n')
    }\n</gpx>\n`;
  } else {
    text = `person,date,start,end,state,latitude,longitude,address\n${entries.map((e) => [
      e.person.split('.')[1], e.date, e.time, e.end || e.time, e.state, Number(e.lat).toFixed(6), Number(e.lon).toFixed(6),
      e.state === 'not_home' ? e.address || '' : '',
    ].map(q).join(',')).join('\n')}\n`;
  }
  const blob = new Blob([text], { type: format === 'gpx' ? 'application/gpx+xml' : 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.${format}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
