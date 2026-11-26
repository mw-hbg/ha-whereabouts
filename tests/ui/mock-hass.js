// Fake Home Assistant for the screenshot check (tests/ui).
//
// Builds a `hass` object like the real frontend passes to a custom panel, with an
// in-memory "backend" that answers the websocket messages of Whereabouts. All data
// is invented (persons Alex and Sam around Stuttgart's Schlossplatz).
// Unknown messages are logged with console.error('MOCK: unknown message', type).

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clockStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const clone = (v) => JSON.parse(JSON.stringify(v));

// --- users and persons --------------------------------------------------------
export const USERS = {
  admin: { id: 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', name: 'Alex', is_admin: true, is_owner: true, active: true },
  normal: { id: 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2', name: 'Sam', is_admin: false, is_owner: false, active: true },
  // not linked to a person: counted as "technical"
  service: { id: 'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3', name: 'Service', is_admin: false, is_owner: false, active: true },
};

const TASKS = new URLSearchParams(window.location.search).get('tasks') || '';

const PLACES = {
  home: { state: 'home', lat: 48.7784, lon: 9.1800, address: 'Schlossplatz, Stuttgart' },
  office: { state: 'Office', lat: 48.7838, lon: 9.1817, address: 'Arnulf-Klett-Platz, Stuttgart' },
  park: { state: 'Park', lat: 48.7905, lon: 9.1905, address: 'Rosensteinpark, Stuttgart' },
  market: { state: 'not_home', lat: 48.7752, lon: 9.1770, address: 'Marktplatz, Stuttgart' },
  cafe: { state: 'not_home', lat: 48.7770, lon: 9.1740, address: 'Königstraße, Stuttgart' },
  museum: { state: 'not_home', lat: 48.7800, lon: 9.1870, address: 'Konrad-Adenauer-Straße, Stuttgart' },
  walk: { state: 'not_home', lat: 48.7812, lon: 9.1835, address: 'Schlossgarten, Stuttgart' },
};

// Day plans: [start, end, place]. The current day is cut at "now".
const PLANS = {
  'person.alex': [
    ['00:00:00', '07:40:00', 'home'], ['07:52:00', '07:58:00', 'walk'], ['08:05:00', '11:50:00', 'office'],
    ['12:05:00', '12:55:00', 'cafe'], ['13:10:00', '17:20:00', 'office'], ['17:40:00', '18:30:00', 'park'],
    ['18:50:00', '23:59:59', 'home'],
  ],
  'person.sam': [
    ['00:00:00', '08:30:00', 'home'], ['08:45:00', '10:10:00', 'market'], ['10:25:00', '11:40:00', 'museum'],
    ['11:50:00', '14:00:00', 'cafe'], ['14:20:00', '16:45:00', 'park'], ['17:00:00', '23:59:59', 'home'],
  ],
};

function stays(person, date, now) {
  const today = isoDate(now);
  if (date > today) return [];
  const limit = date === today ? clockStr(now) : '23:59:59';
  // small per-day offset so the days do not look identical
  const dayNo = Math.round(new Date(`${date}T12:00:00`).getTime() / DAY_MS);
  const jitter = ((dayNo % 5) - 2) * 0.0006;
  return (PLANS[person] || []).filter(([start]) => start <= limit).map(([start, end, key], i) => {
    const p = PLACES[key];
    const moving = p.state === 'not_home';
    return {
      start,
      end: end > limit ? limit : end,
      state: p.state,
      latitude: Number((p.lat + (moving ? jitter : 0) + i * 0.00003).toFixed(6)),
      longitude: Number((p.lon + (moving ? jitter : 0)).toFixed(6)),
      address: p.address,
      times: [start],
      date,
    };
  });
}

// --- settings model (mirrors settings.py) --------------------------------------
const FACTORY = {
  views: { view_live: true, view_history: true, view_settings: true, start_view: 'live' },
  persons: { persons: [], person_settings: {} },
  map: {
    tiles: 'esri', map_link: 'google', map_link_choice: true, map_link_apps: ['apple', 'google'],
    carto_live_light: 'voyager', carto_live_dark: 'dark_matter', carto_history_light: 'voyager', carto_history_dark: 'dark_matter',
    time_display: 'both',
  },
  zones: { zones_in: 'both', zone_color_home: '#2E7D32', zone_color: '#EF6C00', zone_names_zoom: 14, hidden_zones: [], zone_colors: {} },
  live: { show_info_bar: true, show_status_bar: true, show_accuracy: true, follow: true, live_auto_refresh: true, live_refresh_interval: 30 },
  history: {
    default_view: 'map', start_period: 'today', simplify_points: 400, show_legend: true, show_export: true, show_analysis: true,
    history_auto_refresh: true, history_refresh_interval: 30,
  },
};
const CATEGORIES = Object.keys(FACTORY);

const OPTION_DEFAULTS = {
  persons: [], record_persons: [], min_interval: 60, same_place_distance: 50, max_gps_accuracy: 100, retention_days: 0, trash_days: 30,
  address_source: 'phone_osm', address_max_distance: 150, address_sensors: {}, panel: true, panel_title: '',
  panel_icon: 'mdi:map-marker-radius', carto_api_key: '',
};

function createBackend(userKey) {
  const me = USERS[userKey] || USERS.admin;
  const db = {
    // admin defaults differ from the built-in values in a few places ("own value" markers)
    defaults: { zones: { zone_color: '#1565C0' } },
    users: {
      [USERS.admin.id]: {
        // auto refresh off: no countdown ticking in the screenshots
        live: { live_auto_refresh: false, show_accuracy: false },
        history: { history_auto_refresh: false, start_period: '3d' },
        map: { map_link: 'osm' },
        persons: { person_settings: { 'person.alex': { color: '#2E9E5B', name: 'Alex' } } },
      },
      [USERS.normal.id]: {
        live: { live_auto_refresh: false },
        history: { history_auto_refresh: false, start_period: '3d' },
      },
    },
    locks: { zones: { mode: 'all', except: [], users: [] } },
    rights: {},
    rights_default: { live: 'all', history: 'all', delete: 'own' },
    sync: { user_id: '' },
    all_flags: { sync: false, hide_settings: false },
    user_flags: {},
    field_locks: { [USERS.normal.id]: { map: ['tiles'] } },
    pending_users: {},
    // 0.7.10: the one background job and what is open. ?tasks=job: a job runs; ?tasks=offer: the offer to import from the recorder
    job: TASKS === 'job'
      ? { status: 'running', id: 'abc123abc123', kind: 'maintenance', action: 'rules', persons: ['alex'], from: '2026-06-01', to: '2026-06-30', total: 30, done: 12, result: {}, params: { action: 'rules' }, started: '2026-11-15T11:50:00+01:00', finished: '' }
      : { status: 'idle' },
    open_tasks: { hint: TASKS === 'offer' ? 'open' : 'done', addresses: 12, recorder: TASKS === 'offer', persons: ['person.alex', 'person.sam'] },
    // a paused lookup of missing addresses (shows the progress line)
    address_job: { status: 'paused', total: 42, done: 17, found: 15, persons: ['alex'], from: '', to: '', waiting_for_osm: false },
    // 0.7.3: log and trash of the data maintenance
    journal: [
      { id: '20261120-101500-a1b2c3', time: '2026-11-20T10:15:00+01:00', action: 'rules', persons: ['alex', 'sam'], from: '', to: '', user: 'Admin', rows: 40, days: 3, trash: true, size: 18432 },
      { id: '20261118-083000-d4e5f6', time: '2026-11-18T08:30:00+01:00', action: 'import', persons: ['alex'], from: '2026-06-01', to: '2026-06-30', user: 'Admin', rows: 212, days: 30, trash: true, size: 61440, mode: 'merge' },
      { id: '20261010-190000-0a0b0c', time: '2026-10-10T19:00:00+02:00', action: 'addresses', persons: ['alex'], from: '', to: '', user: 'Admin', rows: 9, total: 12, status: 'done', days: 0, trash: false, size: 0 },
      { id: '20261001-120000-0d0e0f', time: '2026-10-01T12:00:00+02:00', action: 'zones', persons: ['sam'], from: '2026-09-01', to: '2026-09-30', user: 'Admin', rows: 5, days: 2, trash: false, size: 0, expired: true },
    ],
    options: {
      ...clone(OPTION_DEFAULTS),
      record_persons: ['person.alex', 'person.sam'],
      retention_days: 365,
      carto_api_key: 'cb1_testkey',
    },
  };

  const userById = (id) => Object.values(USERS).find((u) => u.id === id);
  const defaults = () => Object.fromEntries(CATEGORIES.map((c) => [c, { ...clone(FACTORY[c]), ...clone(db.defaults[c] || {}) }]));
  const globallyLocked = (cat, user) => {
    const lock = db.locks[cat] || {};
    if (lock.mode === 'all') return !(lock.except || []).includes(user.id);
    if (lock.mode === 'selected') return (lock.users || []).includes(user.id);
    return false;
  };
  const fieldLocks = (uid) => clone(db.field_locks[uid] || {});
  const isLocked = (cat, user) => !user.is_admin && ((fieldLocks(user.id)[cat] || []).includes('*') || globallyLocked(cat, user));
  const lockedCategories = (user) => CATEGORIES.filter((c) => isLocked(c, user));
  const lockedKeys = (user, cat) => {
    if (user.is_admin) return [];
    if (isLocked(cat, user)) return ['*'];
    return (fieldLocks(user.id)[cat] || []).filter((k) => k !== '*');
  };
  const effective = (user) => {
    const result = defaults();
    const own = db.users[user.id] || {};
    CATEGORIES.forEach((cat) => {
      if (user.is_admin || !globallyLocked(cat, user)) Object.assign(result[cat], clone(own[cat] || {}));
    });
    return result;
  };
  const allPersons = () => Object.keys(STATES).filter((id) => id.startsWith('person.')).sort();
  const base = () => (db.options.persons.length ? db.options.persons : allPersons());
  const allowed = (user, kind) => {
    if (user.is_admin) return allPersons();
    const explicit = db.rights[user.id];
    if (explicit && kind in explicit) return explicit[kind].filter((p) => allPersons().includes(p));
    const level = db.rights_default[kind] || 'own';
    if (level === 'all') return allPersons();
    if (level === 'own') return allPersons().filter((p) => STATES[p].attributes.user_id === user.id);
    return [];
  };
  const flat = (eff) => Object.assign({}, ...Object.values(eff));
  const personInfo = (id) => ({ entity_id: id, name: STATES[id].attributes.friendly_name, picture: '', user_id: STATES[id].attributes.user_id || '' });

  const info = () => {
    const b = base();
    const hist = allowed(me, 'history');
    const del = allowed(me, 'delete');
    const locked = new Set();
    CATEGORIES.forEach((cat) => {
      const keys = lockedCategories(me).includes(cat) ? Object.keys(FACTORY[cat]) : lockedKeys(me, cat);
      (keys.includes('*') ? Object.keys(FACTORY[cat]) : keys).forEach((k) => locked.add(k));
    });
    return {
      available: true,
      version: VERSION.value,
      live_card: true,
      history_card: true,
      base: b,
      shown: b.filter((p) => allowed(me, 'live').includes(p)),
      persons: db.options.record_persons.filter((p) => b.includes(p) && hist.includes(p)).sort()
        .map((p) => ({ entity_id: p, recording: true, can_view: true, can_delete: del.includes(p) })),
      settings: { ...flat(effective(me)), carto_api_key: db.options.carto_api_key },
      locked_keys: [...locked].sort(),
      is_admin: me.is_admin,
      synced: false,
      settings_hidden: false,
      panel_shown: db.options.panel,
      panel_url: '/whereabouts',
      today: isoDate(new Date()),
    };
  };

  const addressInfo = () => ({
    auto: Object.fromEntries(base().map((p) => {
      const sensor = p === 'person.alex' ? 'sensor.alex_phone_geocoded_location' : '';
      return [p, { sensor, name: sensor ? STATES[sensor].attributes.friendly_name : '', ok: Boolean(sensor) }];
    })),
    sensors: [{ entity_id: 'sensor.alex_phone_geocoded_location', name: STATES['sensor.alex_phone_geocoded_location'].attributes.friendly_name }],
  });

  const settingsResult = () => {
    const result = {
      version: VERSION.value,
      is_admin: me.is_admin,
      user: { id: me.id, name: me.name },
      categories: CATEGORIES,
      own: clone(db.users[me.id] || {}),
      effective: effective(me),
      defaults: defaults(),
      factory: clone(FACTORY),
      locked: lockedCategories(me),
      rights: Object.fromEntries(['live', 'history', 'delete'].map((k) => [k, allowed(me, k)])),
      own_rights: me.id in db.rights,
      persons: base().map(personInfo),
      synced: false,
      settings_hidden: false,
      field_locks: Object.fromEntries(CATEGORIES.map((c) => [c, lockedKeys(me, c)]).filter(([, k]) => k.length)),
      carto_key_set: Boolean(db.options.carto_api_key),
      zones: Object.keys(STATES).filter((id) => id.startsWith('zone.'))
        .sort((a, b) => (a !== 'zone.home') - (b !== 'zone.home') || a.localeCompare(b))
        .map((id) => ({ entity_id: id, name: STATES[id].attributes.friendly_name, passive: false })),
    };
    if (me.is_admin) {
      const users = Object.values(USERS).map((u) => ({
        id: u.id, name: u.name, is_admin: u.is_admin, active: u.active,
        technical: !Object.values(STATES).some((s) => s.attributes.user_id === u.id),
      })).sort((x, y) => (x.is_admin === y.is_admin ? x.name.localeCompare(y.name) : x.is_admin ? -1 : 1));
      result.admin = {
        defaults: defaults(),
        locks: clone(db.locks),
        rights: clone(db.rights),
        rights_default: { ...db.rights_default },
        sync: { ...db.sync },
        all_flags: { ...db.all_flags },
        user_flags: clone(db.user_flags),
        field_locks: clone(db.field_locks),
        // settings_api replaces admin_view's dict with the list of waiting user IDs
        pending_users: Object.keys(db.pending_users),
        own_keys: Object.fromEntries(Object.entries(db.users).map(([uid, own]) => [uid,
          Object.fromEntries(Object.entries(own).map(([cat, vals]) => [cat, Object.keys(vals).sort()]))])),
        has_other_users: users.some((u) => u.id !== me.id && !u.is_admin && !u.technical && u.active),
        users,
        options: clone(db.options),
        option_defaults: clone(OPTION_DEFAULTS),
        all_persons: allPersons().map(personInfo),
        // ?zones=changed: the question about changed zones appears
        zone_changes: new URLSearchParams(window.location.search).get('zones') === 'changed'
          ? [{ kind: 'renamed', entity_id: 'zone.office', name: 'Office', old_name: 'Work' }, { kind: 'removed', entity_id: 'zone.gym', name: 'Gym' }] : [],
        address_job: clone(db.address_job),
        job: clone(db.job),
        open_tasks: clone(db.open_tasks),
        stored: { persons: 2, days: 309 },
        history_size: { bytes: 4980736, days: 309, persons: { alex: { bytes: 3040870, days: 190 }, sam: { bytes: 1939866, days: 119 } } },
        journal: journalSummary(),
        address: addressInfo(),
      };
    }
    return result;
  };

  const journalSummary = () => ({
    entries: db.journal.length, hint: db.journal.length >= 300,
    trash_bytes: db.journal.filter((e) => e.trash).reduce((n, e) => n + e.size, 0),
    trash_entries: db.journal.filter((e) => e.trash).length,
  });

  const diagnostics = () => ({
    persons: base().map((p) => {
      const a = STATES[p].attributes;
      return {
        entity_id: p,
        name: a.friendly_name,
        state: STATES[p].state,
        source: a.source || '',
        trackers: (a.device_trackers || []).map((id) => ({
          entity_id: id, name: STATES[id].attributes.friendly_name, source_type: STATES[id].attributes.source_type,
          state: STATES[id].state, last_updated: STATES[id].last_updated,
        })),
        address_sensor: p === 'person.alex' ? 'sensor.alex_phone_geocoded_location' : '',
        address_sensor_ok: p === 'person.alex',
        recorded: db.options.record_persons.includes(p),
        history: { days: 4, first: isoDate(new Date(Date.now() - 3 * DAY_MS)), last: isoDate(new Date()), bytes: 18432 },
      };
    }),
    osm_paused: false,
    folder: '/config/whereabouts/history',
    entry_id: 'mock-entry',
  });

  const subscribers = new Set();
  const changed = () => { const i = info(); subscribers.forEach((cb) => cb(i)); };
  const save = (msg) => {
    const uid = msg.user_id || me.id;
    if (msg.scope === 'defaults') db.defaults[msg.category] = { ...(db.defaults[msg.category] || {}), ...msg.values };
    else {
      db.users[uid] = db.users[uid] || {};
      db.users[uid][msg.category] = { ...(db.users[uid][msg.category] || {}), ...msg.values };
    }
    changed();
    return null;
  };
  const historyDays = () => [3, 2, 1, 0].map((n) => isoDate(new Date(Date.now() - n * DAY_MS)));

  const jobAnswer = () => ({ job: clone(db.job), open: { hint: db.open_tasks.hint, addresses: db.open_tasks.addresses } });
  const startJob = (kind, action, msg, params = {}) => {
    if (db.job.status === 'running') throw { code: 'busy', message: 'Another task is running' };
    const total = kind === 'export' ? 6 : 30;
    db.job = { status: 'running', id: 'job000job000', kind, action, persons: (msg.persons || []).map((p) => p.split('.')[1]), from: msg.from || '', to: msg.to || '',
      total, done: 0, result: {}, params: { action, ...params }, started: new Date().toISOString(), finished: '' };
    return { job: clone(db.job), preview: false };
  };

  // type -> handler(msg) returning the result (or throwing {code, message})
  const handlers = {
    'whereabouts/info': () => info(),
    'whereabouts/history': (msg) => {
      const from = msg.date;
      const to = msg.date_to || msg.date;
      const out = [];
      for (let d = new Date(`${from}T12:00:00`); isoDate(d) <= to; d = new Date(d.getTime() + DAY_MS)) {
        if (historyDays().includes(isoDate(d))) out.push(...stays(msg.person, isoDate(d), new Date()));
      }
      return { stays: out };
    },
    'whereabouts/days': (msg) => ({ days: historyDays().filter((d) => d.startsWith(msg.month || '')) }),
    'whereabouts/delete': (msg) => ({ deleted: (msg.times || []).length }),
    'whereabouts/settings': () => settingsResult(),
    'whereabouts/settings/save': save,
    'whereabouts/settings/reset': (msg) => {
      if (msg.scope === 'defaults') delete db.defaults[msg.category];
      else if (db.users[msg.user_id || me.id]) {
        if (msg.category) delete db.users[msg.user_id || me.id][msg.category];
        else delete db.users[msg.user_id || me.id];
      }
      changed();
      return msg.factory ? { undo: 'mock-undo-token' } : null;
    },
    'whereabouts/settings/restore': () => { changed(); return null; },
    'whereabouts/settings/new_users': () => null,
    'whereabouts/settings/lock': (msg) => { db.locks[msg.category] = { mode: msg.mode, except: msg.except || [], users: msg.users || [] }; changed(); return null; },
    'whereabouts/settings/rights': (msg) => { if (msg.rights) db.rights[msg.user_id] = msg.rights; else delete db.rights[msg.user_id]; changed(); return null; },
    'whereabouts/settings/rights_default': (msg) => { Object.assign(db.rights_default, msg.levels); changed(); return null; },
    'whereabouts/settings/options': (msg) => { Object.assign(db.options, msg.values); changed(); return null; },
    'whereabouts/settings/options_reset': (msg) => { msg.keys.forEach((k) => { db.options[k] = clone(OPTION_DEFAULTS[k]); }); changed(); return null; },
    'whereabouts/settings/promote': () => { changed(); return null; },
    'whereabouts/settings/flags': (msg) => {
      const target = msg.user_id === 'all' ? db.all_flags : (db.user_flags[msg.user_id] = db.user_flags[msg.user_id] || {});
      ['sync', 'hide_settings'].forEach((k) => { if (k in msg) target[k] = msg[k]; });
      changed();
      return null;
    },
    'whereabouts/settings/field_lock': (msg) => {
      db.field_locks[msg.user_id] = { ...(db.field_locks[msg.user_id] || {}), [msg.category]: msg.keys };
      changed();
      return null;
    },
    'whereabouts/settings/user': (msg) => {
      const other = userById(msg.user_id);
      if (!other) throw { code: 'invalid', message: 'Unknown user' };
      return {
        id: other.id, name: other.name, is_admin: other.is_admin, own: clone(db.users[other.id] || {}),
        effective: effective(other), field_locks: fieldLocks(other.id), synced: false,
        rights: Object.fromEntries(['live', 'history', 'delete'].map((k) => [k, allowed(other, k)])),
      };
    },
    'whereabouts/settings/check_key': () => ({ ok: true, reason: '' }),
    'whereabouts/settings/diagnostics': () => diagnostics(),
    'whereabouts/settings/retention_preview': (msg) => ({ files: 0, before: isoDate(new Date(Date.now() - msg.days * DAY_MS)) }),
    'whereabouts/settings/image_in_use': () => ({ in_use: false }),
    'whereabouts/maintenance/rules': (msg) => (!msg.preview ? startJob('maintenance', 'rules', msg) : { points: 120, stays: 80, merged: 30, dropped: 10, days: 4, days_changed: 3, same_place_distance: 50, min_interval: 60, preview: msg.preview }),
    'whereabouts/maintenance/zones': (msg) => (!msg.preview ? startJob('maintenance', 'zones', msg) : { checked: 80, changed: 5, need_address: 2, days: 4, days_changed: 2, transitions: [{ from: 'Office', to: 'not_home', n: 2 }, { from: 'not_home', to: 'Park', n: 3 }], renames: {}, preview: msg.preview }),
    'whereabouts/maintenance/zone_ack': () => null,
    'whereabouts/maintenance/timezones': (msg) => (!msg.preview ? startJob('maintenance', 'timezones', msg) : { rows: 120, offsets: 110, zones: 6, assumed: 1, days: 4, days_changed: 3, preview: msg.preview }),
    'whereabouts/maintenance/positions': (msg) => (!msg.preview ? startJob('maintenance', 'positions', msg) : { days: 4, days_changed: 2, missing: 5, from_day: 2, from_zone: 1, removed: 1, left: 1, preview: msg.preview }),
    'whereabouts/maintenance/day_edges': (msg) => (!msg.preview ? startJob('maintenance', 'day_edges', msg) : { days: 4, days_changed: 2, starts: 2, ends: 1, preview: msg.preview }),
    'whereabouts/since': () => ({ since: {} }),
    'whereabouts/time_zones': (msg) => ({ zones: (msg.points || []).map(([, lon]) => (lon < -30 ? 'America/New_York' : '')), home: 'Europe/Berlin' }),
    'whereabouts/jobs/status': () => jobAnswer(),
    'whereabouts/jobs/control': (msg) => {
      if (msg.action === 'cancel' && db.job.status === 'running') { db.job.status = 'cancelled'; db.job.finished = new Date().toISOString(); }
      if (msg.action === 'dismiss') db.job = { status: 'idle' };
      return jobAnswer();
    },
    'whereabouts/jobs/export': (msg) => startJob('export', 'export', msg, { format: msg.format }),
    'whereabouts/jobs/addresses_clear': () => { db.open_tasks.addresses = 0; return jobAnswer(); },
    'whereabouts/recorder/preview': () => ({ days: 3, added: 14, days_new: 1, days_add: 2, busy: false }),
    'whereabouts/recorder/start': (msg) => startJob('recorder', 'recorder', msg),
    'whereabouts/recorder/hint': (msg) => { db.open_tasks.hint = msg.hint; return jobAnswer(); },
    'auth/sign_path': (msg) => ({ path: `${msg.path}?authSig=mock` }),
    // 0.8.0: evaluation of a place (done at once; the table follows the chosen grouping)
    'whereabouts/analysis/start': (msg) => {
      db.analysis = { id: 'a1b2c3d4e5f6', status: 'done', total: 12, done: 12, params: { ...msg, type: undefined } };
      return { id: db.analysis.id, status: 'running', total: 12, done: 0, params: db.analysis.params };
    },
    'whereabouts/analysis/status': (msg) => {
      if (!db.analysis) return { status: 'idle' };
      const persons = db.analysis.params.persons;
      const group = msg.group || 'month';
      const periods = { day: ['2026-11-12', '2026-11-13', '2026-11-14'], month: ['2026-09', '2026-10', '2026-11'], year: ['2026'] }[group];
      const rows = [];
      periods.forEach((period, i) => persons.forEach((person, k) => rows.push({
        period, person, visits: 3 + i + k, days: 2 + i, seconds: (5 + i * 3 + k) * 3600 + 1200, longest: (2 + k) * 3600 + 900,
      })));
      const totals = persons.map((person, k) => ({ person, visits: 12 + k, days: 9, seconds: (29 + k) * 3600, longest: (2 + k) * 3600 + 900 }));
      const visits = [];
      for (let i = 0; i < 8; i++) {
        persons.forEach((person) => visits.push({
          person, date: `2026-11-${String(14 - i).padStart(2, '0')}`, start: '08:05', end_date: `2026-11-${String(14 - i).padStart(2, '0')}`,
          end: '11:50', seconds: 13500, state: i % 3 ? 'not_home' : 'Office', address: 'Königstraße 1, Stuttgart',
        }));
      }
      return { ...db.analysis, table: { group, rows, totals }, visits, visit_count: 620, truncated: false, stamp: '2026-11-15T12:00' };
    },
    'whereabouts/analysis/cancel': () => { db.analysis = null; return { status: 'idle' }; },
    'whereabouts/analysis/export': (msg) => ({ file: `a1b2c3d4e5f6_whereabouts_auswertung_2025-11-16_2026-11-15.${msg.format}` }),
    'whereabouts/addresses/status': () => clone(db.address_job),
    'whereabouts/addresses/start': (msg) => (msg.preview ? { missing: 42, busy: false } : clone(db.address_job)),
    'whereabouts/addresses/control': (msg) => {
      if (msg.action === 'dismiss') { db.address_job = { status: 'idle' }; return clone(db.address_job); }
      db.address_job.status = { pause: 'paused', resume: 'running', cancel: 'cancelled' }[msg.action];
      return clone(db.address_job);
    },
    'whereabouts/journal/list': () => ({ ...journalSummary(), items: clone(db.journal), trash_days: db.options.trash_days }),
    'whereabouts/journal/restore': (msg) => {
      const entry = db.journal.find((e) => e.id === msg.entry);
      if (!entry || !entry.trash) throw { code: 'not_found', message: 'Nothing to restore' };
      if (msg.preview !== false) return { changed: entry.action === 'import' ? ['alex_2026-06-12'] : [], preview: true };
      entry.restored = '20261124-120000-ffffff';
      db.journal.unshift({ id: '20261124-120000-ffffff', time: new Date().toISOString(), action: 'restore', ref: entry.id, ref_action: entry.action, persons: entry.persons, from: entry.from, to: entry.to, user: 'Admin', rows: entry.days, days: entry.days, trash: true, size: entry.size });
      return { days: entry.days, changed: [], preview: false };
    },
    'whereabouts/journal/delete': (msg) => {
      const before = db.journal.length;
      const limit = (msg.before || '').replace(/-/g, '');
      db.journal = db.journal.filter((e) => !(msg.ids || []).includes(e.id) && !(limit && e.id.slice(0, 8) < limit));
      return { deleted: before - db.journal.length };
    },
    'image/delete': () => null,
  };

  const call = (msg) => {
    const handler = handlers[msg.type];
    if (!handler) {
      console.error('MOCK: unknown message', msg.type);
      return Promise.reject({ code: 'unknown_command', message: `Unknown command: ${msg.type}` });
    }
    try {
      return Promise.resolve(clone(handler(msg) ?? null));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const connection = {
    sendMessagePromise: call,
    subscribeMessage: (callback, msg) => {
      if (msg.type !== 'whereabouts/subscribe') {
        console.error('MOCK: unknown message', msg.type);
        return Promise.reject({ code: 'unknown_command', message: `Unknown command: ${msg.type}` });
      }
      subscribers.add(callback);
      setTimeout(() => callback(info()), 0);
      return Promise.resolve(() => subscribers.delete(callback));
    },
    subscribeEvents: (callback, eventType) => {
      console.error('MOCK: unknown message', `subscribe_events:${eventType}`);
      return Promise.resolve(() => {});
    },
  };

  const fetchWithAuth = async (url, init = {}) => {
    const path = String(url).split('?')[0];
    if (path === '/api/whereabouts/export') return new Response('date;start;end\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    if (path === '/api/whereabouts/import') {
      const preview = init.body && init.body.get && init.body.get('preview') === 'true';
      const days = historyDays();
      const body = preview ? {
        persons: ['alex'], total: 40, days: 3, first: '2020-01-01', last: days[1], mode: 'merge', stays: 12, merged: 24, dropped: 4,
        not_recorded: ['alex'], retention_days: 365, same_place_distance: 50, min_interval: 60,
        plan: [
          { person: 'alex', date: '2020-01-01', existing: 0, new: 3, status: 'new', points: 10, stays: 3, merged: 6, dropped: 1, expired: true, entries: [] },
          { person: 'alex', date: days[0], existing: 4, new: 2, status: 'add', points: 15, stays: 5, merged: 8, dropped: 2, expired: false,
            entries: [{ start: '08:00:00', end: '09:00:00', state: 'not_home', address: '' }, { start: '10:00:00', end: '11:00:00', state: 'Office', address: '' }] },
          { person: 'alex', date: days[1], existing: 0, new: 4, status: 'new', points: 15, stays: 4, merged: 10, dropped: 1, expired: false, entries: [] },
        ],
      } : { persons: ['alex'], added: 6, skipped: 0, days: 2, total: 40, missing_addresses: 3, first: days[0], last: days[1] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    console.error('MOCK: unknown message', `fetch:${path}`);
    return new Response('{"message":"not mocked"}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  };

  return { me, call, connection, fetchWithAuth };
}

// --- states -----------------------------------------------------------------------
const VERSION = { value: '0.0.0' };
const STATES = {};

function buildStates(now) {
  const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();
  const st = (entity_id, state, attributes, changedMin = 30) => {
    STATES[entity_id] = {
      entity_id, state, attributes, last_changed: ago(changedMin), last_updated: ago(Math.min(changedMin, 2)),
      context: { id: '01JTEST', parent_id: null, user_id: null },
    };
  };
  const home = PLACES.home;
  st('zone.home', '1', { latitude: home.lat, longitude: home.lon, radius: 120, passive: false, editable: true, friendly_name: 'Home', icon: 'mdi:home' }, 600);
  st('zone.office', '1', { latitude: PLACES.office.lat, longitude: PLACES.office.lon, radius: 150, passive: false, editable: true, friendly_name: 'Office', icon: 'mdi:briefcase' }, 600);
  st('zone.park', '0', { latitude: PLACES.park.lat, longitude: PLACES.park.lon, radius: 250, passive: false, editable: true, friendly_name: 'Park', icon: 'mdi:tree' }, 600);
  st('device_tracker.alex_phone', 'Office', {
    source_type: 'gps', latitude: PLACES.office.lat + 0.0002, longitude: PLACES.office.lon - 0.0003, gps_accuracy: 12,
    battery_level: 76, friendly_name: 'Alex Phone',
  }, 95);
  st('device_tracker.sam_phone', 'not_home', {
    source_type: 'gps', latitude: PLACES.cafe.lat, longitude: PLACES.cafe.lon, gps_accuracy: 25, battery_level: 41, friendly_name: 'Sam Phone',
  }, 14);
  st('person.alex', 'Office', {
    editable: true, id: 'alex', device_trackers: ['device_tracker.alex_phone'], latitude: PLACES.office.lat + 0.0002,
    longitude: PLACES.office.lon - 0.0003, gps_accuracy: 12, source: 'device_tracker.alex_phone', user_id: USERS.admin.id,
    friendly_name: 'Alex',
  }, 95);
  st('person.sam', 'not_home', {
    editable: true, id: 'sam', device_trackers: ['device_tracker.sam_phone'], latitude: PLACES.cafe.lat, longitude: PLACES.cafe.lon,
    gps_accuracy: 25, source: 'device_tracker.sam_phone', user_id: USERS.normal.id, friendly_name: 'Sam',
  }, 14);
  st('sensor.alex_phone_geocoded_location', 'Arnulf-Klett-Platz 2\n70173 Stuttgart\nDeutschland', {
    Location: [PLACES.office.lat, PLACES.office.lon], Name: 'Arnulf-Klett-Platz 2', Country: 'Deutschland', 'ISO Country Code': 'DE',
    Locality: 'Stuttgart', Thoroughfare: 'Arnulf-Klett-Platz', 'Sub Thoroughfare': '2', 'Postal Code': '70173',
    friendly_name: 'Alex Phone Geocoded Location', icon: 'mdi:map',
  }, 95);
}

const ENTITIES = {
  'device_tracker.alex_phone': { entity_id: 'device_tracker.alex_phone', device_id: 'dev_alex_phone', platform: 'mobile_app' },
  'sensor.alex_phone_geocoded_location': { entity_id: 'sensor.alex_phone_geocoded_location', device_id: 'dev_alex_phone', platform: 'mobile_app' },
  'device_tracker.sam_phone': { entity_id: 'device_tracker.sam_phone', device_id: 'dev_sam_phone', platform: 'mobile_app' },
  'person.alex': { entity_id: 'person.alex', device_id: null, platform: 'person' },
  'person.sam': { entity_id: 'person.sam', device_id: null, platform: 'person' },
};

// --- themes -----------------------------------------------------------------------
const THEME_VARS = {
  light: {
    '--primary-background-color': '#fafafa', '--secondary-background-color': '#e5e5e5', '--card-background-color': '#ffffff',
    '--ha-card-background': '#ffffff', '--primary-text-color': '#212121', '--secondary-text-color': '#727272',
    '--disabled-text-color': '#bdbdbd', '--primary-color': '#03a9f4', '--accent-color': '#ff9800', '--divider-color': 'rgba(0, 0, 0, 0.12)',
    '--error-color': '#db4437', '--warning-color': '#ffa600', '--success-color': '#43a047', '--info-color': '#039be5',
    '--app-header-background-color': '#03a9f4', '--app-header-text-color': '#ffffff', '--sidebar-background-color': '#ffffff',
    '--sidebar-text-color': '#212121', '--mdc-theme-primary': '#03a9f4', '--input-fill-color': '#f5f5f5', '--outline-color': 'rgba(0, 0, 0, 0.12)',
    '--ha-card-border-radius': '12px', '--ha-card-border-color': '#e0e0e0', '--state-icon-color': '#44739e',
  },
  dark: {
    '--primary-background-color': '#111111', '--secondary-background-color': '#282828', '--card-background-color': '#1c1c1c',
    '--ha-card-background': '#1c1c1c', '--primary-text-color': '#e1e1e1', '--secondary-text-color': '#9b9b9b',
    '--disabled-text-color': '#6f6f6f', '--primary-color': '#03a9f4', '--accent-color': '#ff9800', '--divider-color': 'rgba(225, 225, 225, 0.12)',
    '--error-color': '#ef5350', '--warning-color': '#ffa600', '--success-color': '#43a047', '--info-color': '#039be5',
    '--app-header-background-color': '#101e24', '--app-header-text-color': '#e1e1e1', '--sidebar-background-color': '#1c1c1c',
    '--sidebar-text-color': '#e1e1e1', '--mdc-theme-primary': '#03a9f4', '--input-fill-color': '#2c2c2c', '--outline-color': 'rgba(225, 225, 225, 0.12)',
    '--ha-card-border-radius': '12px', '--ha-card-border-color': 'rgba(225, 225, 225, 0.12)', '--state-icon-color': '#8eb3d1',
  },
};

export function applyTheme(dark) {
  const root = document.documentElement;
  Object.entries(THEME_VARS[dark ? 'dark' : 'light']).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.colorScheme = dark ? 'dark' : 'light';
}

// --- hass ---------------------------------------------------------------------------
export function createHass({ dark = false, lang = 'de', user = 'admin', version = '0.0.0', narrow = false } = {}) {
  VERSION.value = version;
  buildStates(new Date());
  const backend = createBackend(user);
  const me = backend.me;
  return {
    auth: { data: { hassUrl: window.location.origin, access_token: 'mock-token' } },
    connection: backend.connection,
    connected: true,
    states: STATES,
    entities: ENTITIES,
    devices: {
      dev_alex_phone: { id: 'dev_alex_phone', name: 'Alex Phone' },
      dev_sam_phone: { id: 'dev_sam_phone', name: 'Sam Phone' },
    },
    areas: {},
    services: {},
    config: {
      latitude: PLACES.home.lat, longitude: PLACES.home.lon, elevation: 245, unit_system: { length: 'km', mass: 'kg', temperature: '°C', volume: 'L' },
      location_name: 'Home', time_zone: 'Europe/Berlin', components: ['person', 'zone', 'recorder', 'whereabouts'], version: '2026.11.0',
      country: 'DE', language: lang, currency: 'EUR', state: 'RUNNING',
    },
    themes: { default_theme: 'default', default_dark_theme: null, themes: {}, darkMode: dark, theme: 'default' },
    selectedTheme: null,
    panels: {},
    panelUrl: 'whereabouts',
    language: lang,
    selectedLanguage: lang,
    locale: { language: lang, number_format: 'language', time_format: 'language', date_format: 'language', first_weekday: 'language', time_zone: 'local' },
    resources: {},
    localize: (key) => key,
    translationMetadata: { fragments: [], translations: {} },
    dockedSidebar: narrow ? 'auto' : 'docked',
    vibrate: true,
    suspendWhenHidden: true,
    enableShortcuts: true,
    moreInfoEntityId: null,
    user: { id: me.id, name: me.name, is_admin: me.is_admin, is_owner: me.is_owner, credentials: [], mfa_modules: [] },
    userData: {},
    callWS: (msg) => backend.call(msg),
    callService: (domain, service) => {
      console.error('MOCK: unknown message', `call_service:${domain}.${service}`);
      return Promise.resolve();
    },
    callApi: (method, path) => {
      console.error('MOCK: unknown message', `api:${method} ${path}`);
      return Promise.reject(new Error('not mocked'));
    },
    fetchWithAuth: backend.fetchWithAuth,
    hassUrl: (path = '') => `${window.location.origin}${path}`,
    sendWS: (msg) => { backend.call(msg).catch(() => {}); },
    formatEntityState: (st) => st.state,
    formatEntityAttributeValue: (st, attr) => String(st.attributes[attr] ?? ''),
    formatEntityAttributeName: (st, attr) => attr,
  };
}
