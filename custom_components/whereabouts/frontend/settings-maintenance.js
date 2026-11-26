// Whereabouts – settings page: category "Data maintenance" (administrators only).
// "Adapt data to the recording rules", "Recalculate zones in the data", "Add
// time zones", "Complete the edges of days", "Fill in missing coordinates", the question after changed zones
// and "Fetch missing addresses" (background job).
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { esc, rich } = ctx;
  const POLL_MS = 3000;
  const DONE_SHOWN_MS = 30000; // 0.7.3: "Done: … addresses found" disappears after 30 s

  return class extends Base {
    // --- category "Data maintenance" ------------------------------------------------------------------------
    _maintenanceSection(box) {
      const t = this._t;
      const row = (icon, label, info, button, extra = '') => {
        const el = document.createElement('div');
        el.className = 'zeile';
        el.innerHTML = `<div class="beschriftung"><span>${esc(label)}</span>
            <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
          <div class="steuer"><button class="knopf" type="button" style="width:auto"><ha-icon icon="${icon}"></ha-icon>${esc(button)}</button></div>
          <div class="infotext" hidden>${rich(info)}</div>${extra}`;
        this._infoToggle(el);
        box.appendChild(el);
        return el;
      };
      const rules = row('mdi:tune-vertical', t('maint_rules'), t('si_maint_rules'), t('maint_rules_button'));
      rules.querySelector('.steuer .knopf').addEventListener('click', () => this._rulesDialog());
      const zones = row('mdi:map-marker-path', t('maint_zones'), t('si_maint_zones'), t('maint_zones_button'));
      zones.querySelector('.steuer .knopf').addEventListener('click', () => this._zonesDialog());
      const times = row('mdi:clock-time-four-outline', t('maint_tz'), t('si_maint_tz'), t('maint_tz_button'));
      times.querySelector('.steuer .knopf').addEventListener('click', () => this._timeZonesDialog());
      const edges = row('mdi:calendar-expand-horizontal', t('maint_edges'), t('si_maint_edges'), t('maint_edges_button'));
      edges.querySelector('.steuer .knopf').addEventListener('click', () => this._edgesDialog());
      const positions = row('mdi:map-marker-question-outline', t('maint_pos'), t('si_maint_pos'), t('maint_pos_button'));
      positions.querySelector('.steuer .knopf').addEventListener('click', () => this._positionsDialog());
      const addresses = row('mdi:map-search', t('addr_title'), t('si_addr'), t('addr_fetch'),
        '<div class="adressauftrag" style="grid-column:1 / -1"></div>');
      addresses.querySelector('.steuer .knopf').addEventListener('click', () => this._addressDialog());
      this._addressStatus(addresses.querySelector('.adressauftrag'), (this._data.admin || {}).address_job);
    }

    // --- choosing persons and days ----------------------------------------------------------------------
    _scopeHtml(preset = {}) {
      const t = this._t;
      const chosen = new Set(preset.persons || this._data.persons.map((p) => p.entity_id));
      return `<div class="klein" style="margin:10px 0 4px">${esc(t('maint_persons'))}</div>
        <div class="chips umfang-personen">${this._data.persons.map((p) => `<label class="chip"><input type="checkbox" value="${esc(p.entity_id)}"${chosen.has(p.entity_id) ? ' checked' : ''}>${esc(p.name)}</label>`).join('')}</div>
        <div class="klein" style="margin:10px 0 4px">${esc(t('maint_period'))}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="date" class="umfang-von" value="${esc(preset.from || '')}" aria-label="${esc(t('maint_from'))}">
          <span>–</span>
          <input type="date" class="umfang-bis" value="${esc(preset.to || '')}" aria-label="${esc(t('maint_to'))}">
          <span class="klein">${esc(t('maint_period_hint'))}</span>
        </div>`;
    }

    _readScope(win) {
      return {
        persons: [...win.querySelectorAll('.umfang-personen input:checked')].map((i) => i.value),
        from: win.querySelector('.umfang-von').value || '',
        to: win.querySelector('.umfang-bis').value || '',
      };
    }

    // A dialog whose text follows the choices: update(win, scope) fills .vorschau.
    _liveDialog(html, ok, danger, update, wire) {
      const result = this._dialog(html, ok, danger, (win) => ({ ...this._readScope(win), win }));
      const overlays = this.querySelectorAll('.dialog');
      const win = overlays[overlays.length - 1].querySelector('.fenster');
      const okButton = win.querySelector('[data-wahl="ok"]');
      let timer = null;
      let turn = 0;
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const mine = ++turn;
          const scope = this._readScope(win);
          okButton.disabled = true;
          if (!scope.persons.length) { win.querySelector('.vorschau').textContent = this._t('maint_no_persons'); return; }
          win.querySelector('.vorschau').textContent = this._t('loading');
          const enable = await update(win, scope, () => mine === turn);
          if (mine === turn) okButton.disabled = !enable;
        }, 250);
      };
      if (wire) wire(win);
      win.addEventListener('change', refresh);
      refresh();
      return result;
    }

    // --- recording rules on stored data --------------------------------------------------------------------
    async _rulesDialog() {
      const t = this._t;
      const options = (this._data.admin || {}).options || {};
      const html = `<h3>${esc(t('maint_rules'))}</h3>
        <div class="text">${esc(t('maint_rules_text', { m: options.same_place_distance, s: options.min_interval }))}</div>
        ${this._scopeHtml()}
        <div class="text vorschau" style="margin-top:12px"></div>
        <div class="warnung" style="margin:8px 0">${esc(t('maint_irreversible'))}</div>`;
      const answer = await this._liveDialog(html, t('maint_rules_button'), true, async (win, scope, current) => {
        const preview = await this._ws({ type: 'whereabouts/maintenance/rules', preview: true, ...scope });
        if (!current() || !preview) return false;
        win.querySelector('.vorschau').textContent = preview.days_changed
          ? t('maint_rules_preview', { days: preview.days, changed: preview.days_changed, points: preview.points, stays: preview.stays, merged: preview.merged, dropped: preview.dropped })
          : t('maint_rules_nothing', { days: preview.days });
        return preview.days_changed > 0;
      });
      if (!answer) return;
      const { win, ...scope } = answer;
      const done = await this._ws({ type: 'whereabouts/maintenance/rules', preview: false, ...scope });
      if (done) this._toast(t('maint_rules_done', { days: done.days_changed, removed: done.points - done.stays }), false, true);
    }

    // --- UTC offsets and time zones of places --------------------------------------------------------------
    async _timeZonesDialog() {
      const t = this._t;
      const html = `<h3>${esc(t('maint_tz'))}</h3>
        <div class="text">${esc(t('maint_tz_text'))}</div>
        ${this._scopeHtml()}
        <div class="text vorschau" style="margin-top:12px"></div>`;
      const answer = await this._liveDialog(html, t('maint_tz_button'), false, async (win, scope, current) => {
        const preview = await this._ws({ type: 'whereabouts/maintenance/timezones', preview: true, ...scope });
        if (!current() || !preview) return false;
        win.querySelector('.vorschau').textContent = preview.days_changed
          ? [t('maint_tz_preview', { changed: preview.days_changed, days: preview.days, offsets: preview.offsets, zones: preview.zones }),
            preview.assumed ? t('maint_tz_assumed', { n: preview.assumed }) : ''].filter(Boolean).join('\n')
          : t('maint_tz_nothing', { days: preview.days });
        return preview.days_changed > 0;
      });
      if (!answer) return;
      const { win, ...scope } = answer;
      const done = await this._ws({ type: 'whereabouts/maintenance/timezones', preview: false, ...scope });
      if (done) this._toast(t('maint_tz_done', { days: done.days_changed }), false, true);
    }

    // --- edges of days (place of the day before from 00:00, last place until 23:59:59) --------------------
    async _edgesDialog() {
      const t = this._t;
      const html = `<h3>${esc(t('maint_edges'))}</h3>
        <div class="text">${esc(t('maint_edges_text'))}</div>
        ${this._scopeHtml()}
        <div class="text vorschau" style="margin-top:12px"></div>
        <div class="warnung" style="margin:8px 0">${esc(t('maint_irreversible'))}</div>`;
      const answer = await this._liveDialog(html, t('maint_edges_button'), true, async (win, scope, current) => {
        const preview = await this._ws({ type: 'whereabouts/maintenance/day_edges', preview: true, ...scope });
        if (!current() || !preview) return false;
        win.querySelector('.vorschau').textContent = preview.days_changed
          ? t('maint_edges_preview', { changed: preview.days_changed, days: preview.days, starts: preview.starts, ends: preview.ends })
          : t('maint_edges_nothing', { days: preview.days });
        return preview.days_changed > 0;
      });
      if (!answer) return;
      const { win, ...scope } = answer;
      const done = await this._ws({ type: 'whereabouts/maintenance/day_edges', preview: false, ...scope });
      if (done) this._toast(t('maint_edges_done', { days: done.days_changed }), false, true);
    }

    // --- rows without coordinates (0.7.2) --------------------------------------------------------------
    async _positionsDialog() {
      const t = this._t;
      const html = `<h3>${esc(t('maint_pos'))}</h3>
        <div class="text">${esc(t('maint_pos_text'))}</div>
        ${this._scopeHtml()}
        <div class="text vorschau" style="margin-top:12px"></div>
        <div class="warnung" style="margin:8px 0">${esc(t('maint_irreversible'))}</div>`;
      const answer = await this._liveDialog(html, t('maint_pos_button'), true, async (win, scope, current) => {
        const preview = await this._ws({ type: 'whereabouts/maintenance/positions', preview: true, ...scope });
        if (!current() || !preview) return false;
        win.querySelector('.vorschau').textContent = preview.days_changed
          ? t('maint_pos_preview', { missing: preview.missing, changed: preview.days_changed, days: preview.days, from_day: preview.from_day, from_zone: preview.from_zone, removed: preview.removed, left: preview.left })
          : t('maint_pos_nothing', { days: preview.days });
        return preview.days_changed > 0;
      });
      if (!answer) return;
      const { win, ...scope } = answer;
      const done = await this._ws({ type: 'whereabouts/maintenance/positions', preview: false, ...scope });
      if (done) this._toast(t('maint_pos_done', { days: done.days_changed }), false, true);
    }

    // --- zones in the stored data --------------------------------------------------------------------------
    _zoneChoices() {
      const t = this._t;
      const zones = (this._data.zones || []).filter((z) => !z.passive)
        .map((z) => ({ value: z.entity_id === 'zone.home' ? 'home' : z.name, label: z.name }));
      return [...zones, { value: 'not_home', label: t('maint_zone_away') }, { value: '__gone__', label: t('maint_zone_gone') }];
    }

    async _zonesDialog(preset = {}) {
      const t = this._t;
      const choices = this._zoneChoices();
      const chosen = new Set(preset.zones || choices.map((c) => c.value));
      const home = choices.find((c) => c.value === 'home');
      const placeName = (state) => (state === 'not_home' ? t('maint_zone_away') : state === 'home' && home ? home.label : state);
      const html = `<h3>${esc(t('maint_zones'))}</h3>
        <div class="text">${esc(t('maint_zones_text'))}</div>
        <div class="klein" style="margin:10px 0 4px">${esc(t('maint_zones_which'))}</div>
        <label><input type="checkbox" class="alle-zonen"${chosen.size === choices.length ? ' checked' : ''}>${esc(t('maint_zones_all'))}</label>
        <div class="chips umfang-zonen">${choices.map((c) => `<label class="chip"><input type="checkbox" value="${esc(c.value)}"${chosen.has(c.value) ? ' checked' : ''}>${esc(c.label)}</label>`).join('')}</div>
        ${this._scopeHtml(preset)}
        <div class="text vorschau" style="margin-top:12px"></div>
        <label class="adressen-danach" hidden><input type="checkbox" checked>${esc(t('maint_zones_addresses'))}</label>
        <div class="warnung" style="margin:8px 0">${esc(t('maint_irreversible'))}</div>`;
      const readZones = (win) => {
        const all = win.querySelector('.alle-zonen').checked;
        return all ? null : [...win.querySelectorAll('.umfang-zonen input:checked')].map((i) => i.value);
      };
      const answer = await this._liveDialog(html, t('maint_zones_button'), true, async (win, scope, current) => {
        const zones = readZones(win);
        const message = { type: 'whereabouts/maintenance/zones', preview: true, ...scope };
        if (zones) message.zones = zones;
        const preview = await this._ws(message);
        if (!current() || !preview) return false;
        const lines = preview.transitions.map((x) => `${placeName(x.from)} → ${placeName(x.to)}: ${x.n}`);
        win.querySelector('.vorschau').textContent = preview.changed
          ? `${t('maint_zones_preview', { n: preview.changed, of: preview.checked, days: preview.days_changed })}\n${lines.join('\n')}${preview.need_address ? `\n${t('maint_zones_need_address', { n: preview.need_address })}` : ''}`
          : t('maint_zones_nothing', { of: preview.checked });
        win.querySelector('.adressen-danach').hidden = !preview.need_address;
        return preview.changed > 0;
      }, (win) => {
        // keep "all" and the single zones in step
        const all = win.querySelector('.alle-zonen');
        const singles = [...win.querySelectorAll('.umfang-zonen input')];
        all.addEventListener('change', () => singles.forEach((i) => { i.checked = all.checked; }));
        singles.forEach((i) => i.addEventListener('change', () => { all.checked = singles.every((x) => x.checked); }));
      });
      if (!answer) return false;
      const { win, ...scope } = answer;
      const zones = readZones(win);
      const message = { type: 'whereabouts/maintenance/zones', preview: false, ack: Boolean(preset.ack), ...scope };
      if (zones) message.zones = zones;
      const fetchAfter = !win.querySelector('.adressen-danach').hidden && win.querySelector('.adressen-danach input').checked;
      const done = await this._ws(message);
      if (!done) return false;
      this._toast(t('maint_zones_done', { n: done.changed }), false, true);
      if (fetchAfter && done.need_address) await this._startAddresses(scope);
      return true;
    }

    // Zones were created, changed, renamed or removed in Home Assistant: ask once per opening of the page.
    async _askZoneChanges() {
      const t = this._t;
      const changes = ((this._data.admin || {}).zone_changes) || [];
      if (!this._admin || this._scope !== 'own' || this._askedZones || !changes.length || this.querySelector('.dialog')) return;
      this._askedZones = true; // "Later" asks again the next time the page is opened
      const line = (c) => t(`zone_change_${c.kind}`, { name: c.name, old: c.old_name || '' });
      const html = `<div class="text">${esc(t('zone_changes_text'))}</div>
        <ul>${changes.slice(0, 12).map((c) => `<li>${esc(line(c))}</li>`).join('')}${changes.length > 12 ? '<li>…</li>' : ''}</ul>
        <div class="text">${esc(t('zone_changes_question'))}</div>`;
      const answer = await this._choice(t('zone_changes_title'), html, [
        { id: 'cancel', label: t('zone_changes_later') },
        { id: 'never', label: t('zone_changes_never') },
        { id: 'ok', label: t('maint_zones_button'), main: true },
      ]);
      if (answer === 'never') {
        if (await this._ws({ type: 'whereabouts/maintenance/zone_ack' })) this._data.admin.zone_changes = [];
      } else if (answer === 'ok') {
        if (await this._zonesDialog({ ack: true })) this._data.admin.zone_changes = [];
      }
    }

    // --- missing addresses ---------------------------------------------------------------------------------
    async _addressDialog(preset = {}) {
      const t = this._t;
      const html = `<h3>${esc(t('addr_title'))}</h3>
        <div class="text">${esc(t('addr_text'))}</div>
        ${this._scopeHtml(preset)}
        <div class="text vorschau" style="margin-top:12px"></div>`;
      const answer = await this._liveDialog(html, t('addr_start'), false, async (win, scope, current) => {
        const preview = await this._ws({ type: 'whereabouts/addresses/start', preview: true, ...scope });
        if (!current() || !preview) return false;
        const minutes = Math.max(1, Math.ceil(preview.missing / 60));
        win.querySelector('.vorschau').textContent = preview.busy ? t('addr_busy')
          : preview.missing ? t('addr_preview', { n: preview.missing, min: minutes }) : t('addr_nothing');
        return !preview.busy && preview.missing > 0;
      });
      if (!answer) return;
      const { win, ...scope } = answer;
      await this._startAddresses(scope);
    }

    async _startAddresses(scope) {
      const status = await this._ws({ type: 'whereabouts/addresses/start', preview: false, ...scope });
      if (!status) return;
      if (this._data.admin) this._data.admin.address_job = status;
      this._updateSummary('maintenance');
      const el = this.querySelector('.adressauftrag');
      if (el) this._addressStatus(el, status);
      this._toast(this._t('addr_started'), false, true);
    }

    // Progress line with pause / resume / cancel; asks the server again every few seconds while it runs.
    _addressStatus(el, status) {
      const t = this._t;
      clearTimeout(this._addressTimer);
      clearTimeout(this._addressHideTimer);
      if (!el || !status || status.status === 'idle') { if (el) el.innerHTML = ''; return; }
      // Done: shown for 30 s after the end, then hidden (the state stays on the server).
      if (status.status === 'done') {
        const finished = Date.parse(status.finished || '');
        const left = Number.isFinite(finished) ? Math.min(DONE_SHOWN_MS, DONE_SHOWN_MS - (Date.now() - finished)) : 0;
        if (left <= 0) { el.innerHTML = ''; return; }
        this._addressHideTimer = setTimeout(() => { if (el.isConnected) el.innerHTML = ''; }, left);
      }
      const running = status.status === 'running';
      const paused = status.status === 'paused';
      const percent = status.total ? Math.floor((100 * status.done) / status.total) : 100;
      let text;
      if (running || paused) text = t(paused ? 'addr_status_paused' : 'addr_status_running', { done: status.done, total: status.total, p: percent, found: status.found });
      else text = t(`addr_status_${status.status}`, { done: status.done, total: status.total, found: status.found });
      el.innerHTML = `<div class="hinweis" style="margin:6px 0">${esc(text)}${running && status.waiting_for_osm ? ` ${esc(t('addr_status_waiting'))}` : ''}</div>
        ${running || paused ? `<progress max="100" value="${percent}" style="width:100%"></progress>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <button class="knopf pause" type="button"><ha-icon icon="${paused ? 'mdi:play' : 'mdi:pause'}"></ha-icon>${esc(t(paused ? 'addr_resume' : 'addr_pause'))}</button>
          <button class="knopf gefahr abbrechen" type="button"><ha-icon icon="mdi:stop"></ha-icon>${esc(t('addr_cancel'))}</button></div>` : ''}
        ${status.status === 'cancelled' ? `<button class="knopf wegklicken" type="button" style="width:auto"><ha-icon icon="mdi:close"></ha-icon>${esc(t('addr_dismiss'))}</button>` : ''}`;
      const control = async (action) => {
        const next = await this._ws({ type: 'whereabouts/addresses/control', action });
        if (next) this._addressStatus(el, next);
      };
      const pause = el.querySelector('.pause');
      if (pause) pause.addEventListener('click', () => control(paused ? 'resume' : 'pause'));
      const cancel = el.querySelector('.abbrechen');
      if (cancel) cancel.addEventListener('click', () => control('cancel'));
      // Cancelled or broke off: stays until it is clicked away (for everybody)
      const dismiss = el.querySelector('.wegklicken');
      if (dismiss) {
        dismiss.addEventListener('click', async () => {
          const next = await this._ws({ type: 'whereabouts/addresses/control', action: 'dismiss' });
          if (!next) return;
          if (this._data.admin) this._data.admin.address_job = next;
          this._addressStatus(el, next);
        });
      }
      if (running) {
        this._addressTimer = setTimeout(async () => {
          if (!el.isConnected) return;
          let next;
          try { next = await this._hass.callWS({ type: 'whereabouts/addresses/status' }); } catch (err) { return; }
          if (this._data.admin) this._data.admin.address_job = next;
          this._updateSummary('maintenance');
          this._addressStatus(el, next);
        }, POLL_MS);
      }
    }
  };
};
