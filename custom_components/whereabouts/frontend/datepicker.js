// Whereabouts – date picker like Home Assistant's energy dashboard: suggestions
// on the left, a calendar on the right. One click picks a day, two clicks a
// period. Days without data are greyed out; nothing lies after today.

const CSS = `
  .wa-dp { position: fixed; inset: 0; z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 16px;
           background: rgba(0,0,0,.45); font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif); }
  .wa-dp .fenster { width: min(660px, 100%); max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); box-sizing: border-box;
                    display: flex; flex-direction: column; overflow: hidden;
                    background: var(--card-background-color, #fff); color: var(--primary-text-color, #222);
                    border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
  .wa-dp .inhalt { display: flex; flex: 1 1 auto; min-height: 0; }
  .wa-dp .vorschlaege { flex: 0 0 200px; display: flex; flex-direction: column; padding: 8px 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
                        border-right: 1px solid var(--divider-color, #ddd); }
  .wa-dp .gruppe { display: flex; flex-direction: column; }
  .wa-dp .gruppe + .gruppe { border-top: 1px solid var(--divider-color, #ddd); margin-top: 6px; padding-top: 6px; }
  .wa-dp .vorschlaege button { flex: 0 0 auto; font: inherit; font-size: 14px; line-height: 20px; text-align: left; padding: 8px 20px; margin: 0 8px;
                               border: none; border-radius: 18px; background: none; cursor: pointer; color: var(--primary-text-color, #222); }
  .wa-dp .vorschlaege button:hover { background: var(--secondary-background-color, #f3f3f3); }
  .wa-dp .vorschlaege button.an { color: var(--primary-color, #03a9f4); font-weight: 600; background: rgba(var(--rgb-primary-color, 3,169,244), .14); }
  .wa-dp .kalender { flex: 1 1 auto; padding: 14px 18px 10px; min-width: 0; overflow-y: auto; }
  .wa-dp .monat { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .wa-dp .monat span { font-size: 16px; font-weight: 500; }
  .wa-dp .pfeil { width: 36px; height: 36px; border-radius: 50%; border: none; background: none; cursor: pointer; font-size: 20px;
                  color: var(--primary-text-color, #222); }
  .wa-dp .pfeil:hover:not(:disabled) { background: var(--secondary-background-color, #f3f3f3); }
  .wa-dp .pfeil:disabled { opacity: .3; cursor: default; }
  .wa-dp .raster { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px 0; text-align: center; }
  .wa-dp .wt { font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #666); padding: 4px 0; }
  .wa-dp .tag { font: inherit; font-size: 14px; height: 38px; padding: 0; border: none; background: none; cursor: pointer; color: var(--primary-text-color, #222);
                position: relative; font-variant-numeric: tabular-nums; }
  .wa-dp .tag span { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 50%; }
  .wa-dp .tag:hover:not(:disabled) span { background: var(--secondary-background-color, #eee); }
  .wa-dp .tag:disabled { color: var(--disabled-text-color, #bbb); cursor: default; }
  .wa-dp .tag.leer { visibility: hidden; }
  .wa-dp .tag.drin { background: rgba(var(--rgb-primary-color, 3,169,244), .14); }
  .wa-dp .tag.von { border-radius: 19px 0 0 19px; }
  .wa-dp .tag.bis { border-radius: 0 19px 19px 0; }
  .wa-dp .tag.von.bis { border-radius: 19px; background: none; }
  .wa-dp .tag.von span, .wa-dp .tag.bis span { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .wa-dp .tag.heute span { box-shadow: inset 0 0 0 1px var(--primary-color, #03a9f4); }
  .wa-dp .warnung { flex: 0 0 auto; margin: 0 18px 8px; padding: 8px 12px; border-radius: 8px; font-size: 13px; line-height: 1.4;
                    background: rgba(255,166,0,.16); border-left: 4px solid var(--warning-color, #ffa600); }
  .wa-dp .warnung[hidden] { display: none; }
  .wa-dp .knoepfe { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--divider-color, #ddd); }
  .wa-dp .knoepfe .zeitraum { flex: 1 1 auto; min-width: 0; font-size: 15px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wa-dp .knoepfe .zeitraum .leise { font-weight: 400; color: var(--secondary-text-color, #666); }
  .wa-dp .knoepfe button { flex: 0 0 auto; font: inherit; font-size: 14px; font-weight: 500; height: 38px; padding: 0 18px; border-radius: 19px; cursor: pointer; border: none;
                           background: none; color: var(--primary-color, #03a9f4); }
  .wa-dp .knoepfe button.los { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
  .wa-dp .knoepfe button:disabled { opacity: .5; cursor: default; }
  /* Phone upright: suggestions as a bar over the calendar, scrolled sideways */
  @media (max-width: 560px) {
    .wa-dp { padding: 8px; }
    .wa-dp .fenster { max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); border-radius: 20px; }
    .wa-dp .inhalt { flex-direction: column; }
    .wa-dp .vorschlaege { flex: 0 0 auto; flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 10px 8px; gap: 0;
                          border-right: none; border-bottom: 1px solid var(--divider-color, #ddd); scrollbar-width: none; }
    .wa-dp .vorschlaege::-webkit-scrollbar { display: none; }
    .wa-dp .gruppe { flex-direction: row; gap: 6px; }
    .wa-dp .gruppe + .gruppe { border-top: none; margin: 0 0 0 6px; padding: 0 0 0 6px; border-left: 1px solid var(--divider-color, #ddd); }
    .wa-dp .vorschlaege button { margin: 0; padding: 0 12px; height: 32px; font-size: 13px; white-space: nowrap; border: 1px solid var(--divider-color, #ddd); border-radius: 16px; }
    .wa-dp .vorschlaege button.an { border-color: var(--primary-color, #03a9f4); }
    .wa-dp .kalender { padding: 10px 12px 6px; }
    .wa-dp .knoepfe { padding: 8px 10px; gap: 4px; }
    .wa-dp .knoepfe .zeitraum { font-size: 14px; }
    .wa-dp .knoepfe button { padding: 0 12px; }
  }
  /* Low (phone in landscape): buttons stay at the bottom, suggestions scroll, compact calendar */
  @media (max-height: 520px) {
    .wa-dp { padding: 6px; }
    .wa-dp .fenster { width: min(720px, 100%); max-height: calc(100vh - 12px); max-height: calc(100dvh - 12px); border-radius: 16px; }
    .wa-dp .inhalt { flex-direction: row; }
    .wa-dp .vorschlaege { flex: 0 0 190px; flex-direction: column; overflow-x: hidden; overflow-y: auto; padding: 6px 0;
                          border-bottom: none; border-right: 1px solid var(--divider-color, #ddd); }
    .wa-dp .gruppe { flex-direction: column; gap: 0; }
    .wa-dp .gruppe + .gruppe { border-left: none; border-top: 1px solid var(--divider-color, #ddd); margin: 4px 0 0; padding: 4px 0 0; }
    .wa-dp .vorschlaege button { height: auto; margin: 0 6px; padding: 5px 12px; border: none; font-size: 13px; white-space: normal; }
    .wa-dp .kalender { padding: 6px 12px 4px; }
    .wa-dp .monat { margin-bottom: 2px; }
    .wa-dp .monat span { font-size: 14px; }
    .wa-dp .pfeil { width: 30px; height: 30px; }
    .wa-dp .wt { padding: 1px 0; font-size: 11px; }
    .wa-dp .tag { height: 28px; font-size: 13px; }
    .wa-dp .tag span { width: 26px; height: 26px; }
    .wa-dp .tag.von { border-radius: 14px 0 0 14px; }
    .wa-dp .tag.bis { border-radius: 0 14px 14px 0; }
    .wa-dp .knoepfe { padding: 6px 12px; }
    .wa-dp .knoepfe button { height: 34px; }
    .wa-dp .warnung { margin: 0 12px 4px; padding: 4px 10px; font-size: 12px; }
  }
`;

const pad = (n) => String(n).padStart(2, '0');
export const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000) + 1;
const lastOfMonth = (y, m) => new Date(y, m + 1, 0);

// Long periods are loaded month by month and warned about.
export const LARGE_DAYS = 92;

// Suggestions: [id, (today, first) => [from, to, unit]], in groups (thin lines between them).
const PRESET_GROUPS = [
  [
    ['today', (t) => [t, t, 'day']],
    ['yesterday', (t) => [addDays(t, -1), addDays(t, -1), 'day']],
  ],
  [
    ['last_3_days', (t) => [addDays(t, -2), t, 'days']],
    ['last_7_days', (t) => [addDays(t, -6), t, 'days']],
    ['last_4_weeks', (t) => [addDays(t, -27), t, 'days']],
  ],
  [
    ['this_week', (t) => { const d = parseDate(t); const back = (d.getDay() + 6) % 7; return [addDays(t, -back), t, 'week']; }],
    ['this_month', (t) => [`${t.slice(0, 8)}01`, t, 'month']],
    ['last_month', (t) => {
      const d = parseDate(t);
      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return [dateStr(first), dateStr(lastOfMonth(first.getFullYear(), first.getMonth())), 'month'];
    }],
  ],
  [
    ['this_year', (t) => [`${t.slice(0, 4)}-01-01`, t, 'year']],
    ['last_year', (t) => { const y = Number(t.slice(0, 4)) - 1; return [`${y}-01-01`, `${y}-12-31`, 'year']; }],
  ],
  [
    ['since_start', (t, first) => [first || t, t, 'days']],
  ],
];
export const PRESETS = PRESET_GROUPS.flat();

// "18. Nov." / "12.–18. Nov." / "28. Okt. – 3. Nov." (year only when not this year)
export function rangeText(lang, from, to, short = false) {
  const year = String(new Date().getFullYear());
  if (short) {
    // Narrow screens: "18.11." / "11.11.–18.11." (with the year only if it is not this year)
    const numeric = (s) => parseDate(s).toLocaleDateString(lang, { day: 'numeric', month: 'numeric', ...(s.slice(0, 4) !== year ? { year: '2-digit' } : {}) });
    return from === to ? numeric(from) : `${numeric(from)}–${numeric(to)}`;
  }
  const opts = (s, withYear) => ({ day: 'numeric', month: 'short', ...(withYear || s.slice(0, 4) !== year ? { year: 'numeric' } : {}) });
  const fmt = (s, o) => parseDate(s).toLocaleDateString(lang, o);
  if (from === to) return fmt(from, opts(from));
  const otherYear = from.slice(0, 4) !== to.slice(0, 4);
  if (!otherYear && from.slice(0, 7) === to.slice(0, 7)) {
    const day = parseDate(from).toLocaleDateString(lang, { day: 'numeric' });
    return `${day}–${fmt(to, opts(to))}`;
  }
  return `${fmt(from, opts(from, otherYear))} – ${fmt(to, opts(to, otherYear))}`;
}

// Moves a period by its own length (whole months/years for month/year periods).
export function shiftRange(from, to, unit, direction, today) {
  if (unit === 'month' || unit === 'year') {
    const months = unit === 'year' ? 12 : 1;
    const f = parseDate(from);
    const start = new Date(f.getFullYear(), f.getMonth() + direction * months, 1);
    let end = unit === 'year' ? new Date(start.getFullYear(), 11, 31) : lastOfMonth(start.getFullYear(), start.getMonth());
    if (dateStr(end) > today) end = parseDate(today);
    return [dateStr(start), dateStr(end)];
  }
  const n = daysBetween(from, to);
  let a = addDays(from, direction * n);
  let b = addDays(to, direction * n);
  if (b > today) { b = today; a = addDays(today, -(n - 1)); }
  return [a, b];
}

// options: { t, lang, from, to, today, days: Set of dates with data or null, first: first date with data }
// Resolves with { from, to, unit } or null.
export function openDatePicker({ t, lang, from, to, today, days, first }) {
  if (!document.getElementById('wa-dp-css')) {
    const style = document.createElement('style');
    style.id = 'wa-dp-css';
    document.head.appendChild(style);
  }
  document.getElementById('wa-dp-css').textContent = CSS;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const has = (d) => !(days instanceof Set) || days.has(d);
  const allowed = (d) => d <= today && (!first || d >= first) && has(d);
  // A suggestion's period, cut to what can be shown (not before the first day, not after today)
  const presetRange = (fn) => {
    const [a, b, unit] = fn(today, first);
    return [first && a < first ? first : a, b > today ? today : b, unit];
  };
  // Shown only if there are data in the period
  const withData = (a, b) => {
    if (b < a) return false;
    if (!(days instanceof Set)) return true;
    for (const d of days) if (d >= a && d <= b && d <= today) return true;
    return false;
  };
  const matching = PRESETS.find(([, fn]) => { const [a, b] = presetRange(fn); return a === from && b === to; });
  const state = { from, to, unit: 'days', picking: false, preset: matching ? matching[0] : '' };
  const shown = parseDate(to);
  let month = new Date(shown.getFullYear(), shown.getMonth(), 1);

  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'wa-dp';
    const close = (value) => { document.removeEventListener('keydown', key); box.remove(); resolve(value); };
    const key = (e) => { if (e.key === 'Escape') close(null); };

    const weekdays = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'narrow' }));

    const render = () => {
      const scroller = box.querySelector('.vorschlaege');
      const scroll = scroller ? [scroller.scrollLeft, scroller.scrollTop] : null;
      const y = month.getFullYear();
      const m = month.getMonth();
      const lead = (new Date(y, m, 1).getDay() + 6) % 7;
      const count = lastOfMonth(y, m).getDate();
      const cells = [];
      for (let i = 0; i < lead; i += 1) cells.push('<button class="tag leer" disabled tabindex="-1"></button>');
      for (let d = 1; d <= count; d += 1) {
        const value = `${y}-${pad(m + 1)}-${pad(d)}`;
        const cls = ['tag'];
        if (value >= state.from && value <= state.to) cls.push('drin');
        if (value === state.from) cls.push('von');
        if (value === state.to) cls.push('bis');
        if (value === today) cls.push('heute');
        cells.push(`<button class="${cls.join(' ')}" data-tag="${value}"${allowed(value) ? '' : ' disabled'}><span>${d}</span></button>`);
      }
      // always six rows: the window does not change its height between months
      for (let i = lead + count; i < 42; i += 1) cells.push('<button class="tag leer" disabled tabindex="-1"></button>');
      const prevMonth = dateStr(new Date(y, m, 0));
      const nextMonth = dateStr(new Date(y, m + 1, 1));
      const n = daysBetween(state.from, state.to);
      const large = n > LARGE_DAYS;
      const groups = PRESET_GROUPS.map((group) => group.filter(([, fn]) => { const [a, b] = presetRange(fn); return withData(a, b); }))
        .filter((group) => group.length);
      const period = state.picking ? esc(t('pick_end'))
        : `${esc(rangeText(lang, state.from, state.to))}${n > 1 ? ` <span class="leise">· ${esc(t('n_days', { n }))}</span>` : ''}`;
      box.innerHTML = `<div class="fenster" role="dialog" aria-modal="true" aria-label="${esc(t('pick_period'))}">
        <div class="inhalt">
          <div class="vorschlaege">${groups.map((group) => `<div class="gruppe">${group.map(([id]) => `<button type="button" data-preset="${id}" class="${state.preset === id ? 'an' : ''}"${state.preset === id ? ' aria-current="true"' : ''}>${esc(t(`preset_${id}`))}</button>`).join('')}</div>`).join('')}</div>
          <div class="kalender">
            <div class="monat">
              <button class="pfeil zurueck" type="button" aria-label="${esc(t('prev_month'))}"${first && prevMonth < first ? ' disabled' : ''}>‹</button>
              <span>${esc(month.toLocaleDateString(lang, { month: 'long', year: 'numeric' }))}</span>
              <button class="pfeil vor" type="button" aria-label="${esc(t('next_month'))}"${nextMonth > today ? ' disabled' : ''}>›</button>
            </div>
            <div class="raster">${weekdays.map((w) => `<div class="wt">${esc(w)}</div>`).join('')}${cells.join('')}</div>
          </div>
        </div>
        <div class="warnung"${large ? '' : ' hidden'}>${esc(t('large_period_warning'))}</div>
        <div class="knoepfe"><span class="zeitraum" aria-live="polite">${period}</span>
          <button type="button" class="abbrechen">${esc(t('cancel'))}</button>
          <button type="button" class="los"${state.picking ? ' disabled' : ''}>${esc(t('choose'))}</button></div>
      </div>`;
      const list = box.querySelector('.vorschlaege');
      if (scroll) { list.scrollLeft = scroll[0]; list.scrollTop = scroll[1]; }
      box.querySelector('.zurueck').addEventListener('click', () => { month = new Date(y, m - 1, 1); render(); });
      box.querySelector('.vor').addEventListener('click', () => { month = new Date(y, m + 1, 1); render(); });
      box.querySelectorAll('[data-tag]').forEach((b) => b.addEventListener('click', () => {
        const value = b.dataset.tag;
        state.preset = '';
        state.unit = 'days';
        if (!state.picking) {
          state.from = value;
          state.to = value;
          state.picking = true;
        } else {
          if (value < state.from) { state.to = state.from; state.from = value; } else state.to = value;
          state.picking = false;
        }
        render();
      }));
      box.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
        const [a, c, unit] = presetRange(PRESETS.find(([id]) => id === b.dataset.preset)[1]);
        state.from = a;
        state.to = c;
        state.unit = unit;
        state.preset = b.dataset.preset;
        state.picking = false;
        const end = parseDate(state.to);
        month = new Date(end.getFullYear(), end.getMonth(), 1);
        render();
      }));
      box.querySelector('.abbrechen').addEventListener('click', () => close(null));
      box.querySelector('.los').addEventListener('click', () => close({ from: state.from, to: state.to, unit: state.unit }));
      // the chosen suggestion stays in view in the sideways bar
      const chosen = list.querySelector('.an');
      if (chosen && !scroll && getComputedStyle(list).flexDirection === 'row' && list.scrollWidth > list.clientWidth) {
        list.scrollLeft = Math.max(0, chosen.offsetLeft - 12);
      }
    };

    box.addEventListener('click', (e) => { if (e.target === box) close(null); });
    document.addEventListener('keydown', key);
    document.body.appendChild(box);
    render();
  });
}
