// Whereabouts – evaluation of a place (0.8.0): a circle on the history card's map, a period and persons;
// the server counts the visits (whereabouts/analysis/*) and writes Excel or PDF files (signed link, also in the apps).
// The circle is chosen on the card's own map (analysis-map.js); the window lies over the page like "Export data".

const mapModule = import(`./analysis-map.js${new URL(import.meta.url).search}`);

const CSS = `
  .wa-dl.wa-an .fenster { width: min(760px, 100%); }
  .wa-an .zwei { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .wa-an input.zahl { width: 84px; font: inherit; font-size: 14px; padding: 7px 9px; border: 1px solid var(--divider-color, #ddd);
                      border-radius: 8px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); }
  .wa-an input.ort { width: 210px; font: inherit; font-size: 14px; padding: 7px 9px; border: 1px solid var(--divider-color, #ddd);
                     border-radius: 8px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); }
  .wa-an input[type="range"] { flex: 1 1 160px; accent-color: var(--primary-color, #03a9f4); }
  .wa-an .knopf { font: inherit; font-size: 14px; padding: 7px 14px; border: 1px solid var(--divider-color, #ddd); border-radius: 18px;
                  background: none; color: var(--primary-color, #03a9f4); cursor: pointer; }
  .wa-an .einheit { font-size: 14px; }
  .wa-an .zwei.aus { opacity: .45; }
  .wa-an .kopf { font-size: 13px; color: var(--secondary-text-color, #666); margin: 0 0 10px; }
  .wa-an .liste { overflow-x: auto; margin: 0 0 14px; }
  .wa-an table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  .wa-an th, .wa-an td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--divider-color, #ddd); white-space: nowrap; }
  .wa-an th { font-weight: 500; color: var(--secondary-text-color, #666); }
  .wa-an td.zahl, .wa-an th.zahl { text-align: right; }
  .wa-an td.ort { white-space: normal; min-width: 160px; }
  .wa-an tr.summe td { font-weight: 600; }
  .wa-an .punkt { display: inline-block; vertical-align: middle; margin-right: 6px; }
  .wa-an .dateien { display: flex; flex-direction: column; gap: 6px; margin: 0 0 12px; }
  .wa-an .datei { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; }
  .wa-an .datei a.link, .wa-an .datei button.knopf { padding: 6px 14px; }
  .wa-an .knoepfe { flex-wrap: wrap; }
  .wa-an .knoepfe .links { margin-right: auto; }
`;

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5M3 21h4v-2H3v2m14 0h4v-2h-4v2Z"/></svg>';
const CALENDAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-1V1m-1 11h-5v5h5v-5Z"/></svg>';
export const RADIUS_MIN = 25;
export const RADIUS_MAX = 5000;
const MAX_DAYS = 3660;
const POLL_MS = 700;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clampRadius = (v) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(Number(v) || 100)));

// card: the history card (its map, persons, texts and days with data are used)
export function openAnalysis(S, P, D, card) {
  const hass = card._hass;
  const t = card._t;
  const esc = S.escapeHtml;
  const lang = S.language(hass);
  D.ensureDialogCss();
  if (!document.getElementById('wa-an-css')) {
    const style = document.createElement('style');
    style.id = 'wa-an-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const today = iso(new Date());
  if (!card._analysisState) {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    let from = iso(start);
    if (card._first && from < card._first) from = card._first;
    const center = card._map ? card._map.getCenter() : null;
    const home = hass.config || {};
    card._analysisState = {
      lat: center ? center.lat : Number(home.latitude) || 0,
      lon: center ? center.lng : Number(home.longitude) || 0,
      radius: 100,
      from,
      to: today,
      persons: new Set(card._visiblePersons().map((p) => p.id)),
      minMinutes: 10,
      countShort: false,
      group: 'month',
    };
  }
  const state = card._analysisState;
  const known = new Set(card._persons.map((p) => p.id));
  state.persons = new Set([...state.persons].filter((id) => known.has(id)));
  let view = 'form'; // form | running | result
  let result = null;
  let files = []; // [{ format, file, link }]
  let error = '';
  let timer = null;
  let circle = null; // the circle on the map while the window is open

  const box = document.createElement('div');
  box.className = 'wa-dl wa-an';
  const close = () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', key);
    if (circle) circle.remove();
    box.remove();
  };
  const key = (e) => { if (e.key === 'Escape' && box.style.display !== 'none' && !document.querySelector('.wa-dp')) close(); };

  const showCircle = async () => {
    if (!card._map) return;
    const M = await mapModule;
    if (circle) circle.remove();
    circle = M.staticCircle(card._map, state);
  };

  const duration = (seconds) => {
    const n = Math.round(seconds / 60);
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (!h) return t('duration_m', { m });
    return m ? t('duration_hm', { h, m }) : t('duration_h', { h });
  };
  const periodText = (period) => {
    if (result.table.group === 'day') return card._dayText(period);
    if (result.table.group === 'month') {
      const [y, m] = period.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
    }
    return period;
  };
  const person = (id) => card._personById(id) || { name: id, color: '#888' };
  const dot = (id) => `<span class="punkt" style="width:10px;height:10px;border-radius:50%;background:${S.safeColor(person(id).color, '#888')}"></span>`;
  const placeText = () => `${state.lat.toFixed(5)}, ${state.lon.toFixed(5)}`;

  const form = () => {
    const days = P.daysBetween(state.from, state.to);
    const tooLong = days > MAX_DAYS;
    return {
      body: `
      <div class="abschnitt"><div class="titel">${esc(t('an_place'))}</div>
        <div class="zwei"><input class="ort" type="text" inputmode="decimal" value="${esc(placeText())}" aria-label="${esc(t('an_place'))}">
        ${card._map ? `<button type="button" class="knopf waehlen">${esc(t('an_pick'))}</button>` : ''}</div></div>
      <div class="abschnitt"><div class="titel">${esc(t('an_radius'))}</div>
        <div class="zwei"><input class="zahl radius" type="number" min="${RADIUS_MIN}" max="${RADIUS_MAX}" step="5" value="${state.radius}"><span class="einheit">m</span>
        <input class="schieber" type="range" min="${RADIUS_MIN}" max="1000" step="5" value="${Math.min(1000, state.radius)}" aria-label="${esc(t('an_radius'))}"></div></div>
      <div class="abschnitt"><div class="titel">${esc(t('an_period'))}</div>
        <button type="button" class="zeitraum">${CALENDAR}${esc(P.rangeText(lang, state.from, state.to))}</button></div>
      ${tooLong ? `<div class="warnung">${esc(t('an_too_long'))}</div>` : ''}
      <div class="abschnitt"><div class="titel">${esc(t('an_persons'))}</div>
        ${card._persons.map((p) => `<label><input type="checkbox" class="person" value="${esc(p.id)}"${state.persons.has(p.id) ? ' checked' : ''}>
          <span class="punkt" style="background:${S.safeColor(p.color, '#888')}"></span>${esc(p.name)}</label>`).join('')}</div>
      <div class="abschnitt"><div class="titel">${esc(t('an_min'))}</div>
        <div class="zwei${state.countShort ? ' aus' : ''}"><input class="zahl minuten" type="number" min="0" max="600" step="1" value="${state.minMinutes}"${state.countShort ? ' disabled' : ''}><span class="einheit">${esc(t('an_minutes'))}</span></div>
        <label><input type="checkbox" class="kurz"${state.countShort ? ' checked' : ''}>${esc(t('an_count_short'))}</label>
        <p class="hinweis">${esc(t('an_count_short_hint'))}</p></div>
      <div class="fehler">${esc(error)}</div>`,
      footer: `<button type="button" class="abbrechen">${esc(t('close'))}</button>
        <button type="button" class="los"${state.persons.size && !tooLong ? '' : ' disabled'}>${esc(t('an_start'))}</button>`,
    };
  };

  const running = () => {
    const status = result || {};
    const percent = status.total ? Math.floor((100 * (status.done || 0)) / status.total) : 0;
    return {
      body: `<div class="abschnitt"><div class="titel">${esc(t('an_running', { done: status.done || 0, total: status.total || 0 }))}</div>
        <progress max="100" value="${percent}"></progress></div>`,
      footer: `<button type="button" class="stopp">${esc(t('cancel'))}</button>`,
    };
  };

  const resultView = () => {
    const r = result;
    const several = r.params.persons.length > 1;
    const group = r.table.group;
    // the prepared files first: the lists below can be long
    let top = '';
    if (files.length) {
      top += `<div class="dateien">${files.map((f) => `<div class="datei"><span>${esc(t('an_file_ready', { format: f.label }))}</span>
        ${D.fileLinkHtml(t, f.link, f.file, 'link')}
        ${!D.inHaApp() && navigator.canShare ? `<button type="button" class="knopf teilen" data-datei="${esc(f.file)}">${esc(t('an_share'))}</button>` : ''}</div>`).join('')}</div>`;
    }
    let body = `<p class="kopf">${esc(t('an_summary', { radius: r.params.radius, place: `${r.params.latitude.toFixed(5)}, ${r.params.longitude.toFixed(5)}` }))}
      · ${esc(P.rangeText(lang, r.params.from, r.params.to))}
      · ${esc(r.params.count_short ? t('an_count_short') : t('an_min_text', { n: r.params.min_minutes }))}</p>`;
    if (!r.visit_count) {
      body += `<div class="abschnitt"><div class="titel">${esc(t('an_none'))}</div></div>`;
    } else {
      body += `<div class="abschnitt"><div class="reihe"><div class="segmente">
        ${['day', 'month', 'year'].map((g) => `<button type="button" class="gruppe${g === group ? ' an' : ''}" data-gruppe="${g}">${esc(t(`an_group_${g}`))}</button>`).join('')}
        </div></div></div>
      <div class="liste"><table><thead><tr><th>${esc(t(`an_group_${group}`))}</th>${several ? `<th>${esc(t('col_person'))}</th>` : ''}
        <th class="zahl">${esc(t('an_col_visits'))}</th><th class="zahl">${esc(t('an_col_days'))}</th>
        <th class="zahl">${esc(t('an_col_total'))}</th><th class="zahl">${esc(t('an_col_longest'))}</th></tr></thead><tbody>
        ${r.table.rows.map((row) => `<tr><td>${esc(periodText(row.period))}</td>${several ? `<td>${dot(row.person)}${esc(person(row.person).name)}</td>` : ''}
          <td class="zahl">${row.visits}</td><td class="zahl">${row.days}</td><td class="zahl">${esc(duration(row.seconds))}</td>
          <td class="zahl">${row.longest ? esc(duration(row.longest)) : ''}</td></tr>`).join('')}
        ${r.table.totals.map((row) => `<tr class="summe"><td>${esc(t('an_total'))}</td>${several ? `<td>${dot(row.person)}${esc(person(row.person).name)}</td>` : ''}
          <td class="zahl">${row.visits}</td><td class="zahl">${row.days}</td><td class="zahl">${esc(duration(row.seconds))}</td>
          <td class="zahl">${esc(duration(row.longest))}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="abschnitt"><div class="titel">${esc(t('an_visits', { n: r.visit_count }))}</div>
      <div class="liste"><table><thead><tr><th>${esc(t('col_date'))}</th><th>${esc(t('an_col_when'))}</th><th class="zahl">${esc(t('an_col_duration'))}</th>
        ${several ? `<th>${esc(t('col_person'))}</th>` : ''}<th>${esc(t('col_place'))}</th></tr></thead><tbody>
        ${r.visits.map((v) => `<tr><td>${esc(card._dayText(v.date))}</td>
          <td>${esc(v.end_date !== v.date ? `${v.start} – ${card._dayText(v.end_date, false)} ${v.end}` : `${v.start} – ${v.end}`)}</td>
          <td class="zahl">${esc(duration(v.seconds))}</td>${several ? `<td>${dot(v.person)}${esc(person(v.person).name)}</td>` : ''}
          <td class="ort">${esc(card._placeText(v))}</td></tr>`).join('')}
      </tbody></table></div>
      ${r.visit_count > r.visits.length ? `<p class="hinweis">${esc(t('an_more', { shown: r.visits.length, n: r.visit_count }))}</p>` : ''}</div>`;
    }
    body = `<div class="fehler">${esc(error)}</div>${top}${body}`;
    return {
      body,
      footer: `<button type="button" class="aendern links">${esc(t('an_change'))}</button>
        ${r.visit_count ? `<button type="button" class="datei-los" data-format="xlsx">Excel</button><button type="button" class="datei-los" data-format="pdf">PDF</button>` : ''}
        <button type="button" class="abbrechen los">${esc(t('close'))}</button>`,
    };
  };

  const render = () => {
    const before = box.querySelector('.rumpf');
    const scrolled = before ? before.scrollTop : 0;
    const part = view === 'form' ? form() : view === 'running' ? running() : resultView();
    box.innerHTML = `<div class="fenster" role="dialog" aria-modal="true" aria-label="${esc(t('an_title'))}">
      <h3>${ICON}${esc(t('an_title'))}</h3><div class="rumpf">${part.body}</div><div class="knoepfe">${part.footer}</div></div>`;
    box.querySelector('.rumpf').scrollTop = scrolled;
    wire();
  };

  const readPlace = (text) => {
    const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(text);
    if (!m) return false;
    const lat = Number(m[1].replace(',', '.'));
    const lon = Number(m[2].replace(',', '.'));
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return false;
    state.lat = lat;
    state.lon = lon;
    return true;
  };

  const wire = () => {
    const on = (selector, event, fn) => box.querySelectorAll(selector).forEach((el) => el.addEventListener(event, fn));
    on('.abbrechen', 'click', close);
    if (view === 'form') {
      on('.ort', 'change', (e) => {
        error = readPlace(e.target.value) ? '' : t('an_place_invalid');
        render();
        showCircle();
      });
      on('.waehlen', 'click', pick);
      const radius = (value, again) => {
        state.radius = clampRadius(value);
        if (circle) circle.setRadius(state.radius);
        if (again) render();
      };
      on('.radius', 'change', (e) => radius(e.target.value, true));
      on('.schieber', 'input', (e) => { radius(e.target.value, false); box.querySelector('.radius').value = state.radius; });
      on('.zeitraum', 'click', async () => {
        const chosen = await P.openDatePicker({ t, lang, from: state.from, to: state.to, today, days: card._days, first: card._first });
        if (chosen) { state.from = chosen.from; state.to = chosen.to; render(); }
      });
      on('.person', 'change', (e) => {
        if (e.target.checked) state.persons.add(e.target.value); else state.persons.delete(e.target.value);
        render();
      });
      on('.minuten', 'change', (e) => { state.minMinutes = Math.min(600, Math.max(0, Math.round(Number(e.target.value) || 0))); render(); });
      on('.kurz', 'change', (e) => { state.countShort = e.target.checked; render(); });
      on('.los', 'click', start);
    } else if (view === 'running') {
      on('.stopp', 'click', async () => {
        clearTimeout(timer);
        try { await hass.callWS({ type: 'whereabouts/analysis/cancel' }); } catch (err) { /* ended anyway */ }
        view = 'form';
        result = null;
        render();
      });
    } else {
      on('.aendern', 'click', () => { view = 'form'; files = []; error = ''; render(); });
      on('.gruppe', 'click', async (e) => {
        state.group = e.currentTarget.dataset.gruppe;
        files = [];
        await poll(false);
      });
      on('.datei-los', 'click', (e) => makeFile(e.currentTarget.dataset.format));
      on('.teilen', 'click', (e) => share(e.currentTarget.dataset.datei));
    }
  };

  // Choose the circle on the card's map: the window hides meanwhile.
  const pick = async () => {
    const M = await mapModule;
    if (circle) { circle.remove(); circle = null; }
    box.style.display = 'none'; // (the attribute "hidden" loses against display: flex)
    M.pickCircle(card, state, t, esc, () => {
      box.style.display = '';
      render();
      showCircle();
    });
  };

  const start = async () => {
    error = '';
    try {
      result = await hass.callWS({
        type: 'whereabouts/analysis/start',
        persons: [...state.persons],
        from: state.from,
        to: state.to,
        latitude: state.lat,
        longitude: state.lon,
        radius: state.radius,
        min_minutes: state.minMinutes,
        count_short: state.countShort,
      });
      files = [];
      view = 'running';
      render();
      timer = setTimeout(() => poll(true), POLL_MS);
    } catch (err) {
      error = t('an_failed');
      render();
    }
  };

  // Status of the own evaluation (also when the window is opened again)
  const poll = async (repeat) => {
    clearTimeout(timer);
    let answer;
    try {
      answer = await hass.callWS({ type: 'whereabouts/analysis/status', group: state.group });
    } catch (err) {
      error = t('an_failed');
      view = 'form';
      render();
      return;
    }
    if (!box.isConnected && repeat) return;
    if (answer.status === 'running') {
      result = answer;
      view = 'running';
      render();
      if (repeat) timer = setTimeout(() => poll(true), POLL_MS);
      return;
    }
    if (answer.status === 'done') {
      result = answer;
      view = 'result';
    } else {
      if (answer.status === 'failed') error = t('an_failed');
      view = 'form';
    }
    render();
  };

  const makeFile = async (format) => {
    error = '';
    const buttons = box.querySelectorAll('.datei-los');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const answer = await hass.callWS({ type: 'whereabouts/analysis/export', format, group: state.group, language: lang });
      const link = await D.signedFileLink(hass, answer.file);
      files = files.filter((f) => f.format !== format).concat([{ format, file: answer.file, link, label: format === 'pdf' ? 'PDF' : 'Excel' }]);
    } catch (err) {
      error = t('an_failed');
    }
    render();
  };

  // Browser only: the file as a share (the Home Assistant apps cannot share a file from a page).
  const share = async (file) => {
    const entry = files.find((f) => f.file === file);
    if (!entry) return;
    try {
      const response = await fetch(entry.link);
      const blob = await response.blob();
      const name = file.slice(file.indexOf('_') + 1);
      const shared = new File([blob], name, { type: blob.type });
      if (navigator.canShare({ files: [shared] })) await navigator.share({ files: [shared], title: name });
      else { error = t('an_share_failed'); render(); }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      error = t('an_share_failed');
      render();
    }
  };

  document.addEventListener('keydown', key);
  document.body.appendChild(box);
  render();
  showCircle();
  poll(true); // a running or finished evaluation of this user is shown again
}
