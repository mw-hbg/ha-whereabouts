// Whereabouts – settings page: group "Open tasks" (administrators only, 0.7.10).
// The one background job with progress bar and "Cancel" (data maintenance, export, import from the
// Home Assistant history), the progress of "Fetch missing addresses" and what is still open:
// changed zones, missing addresses, the offer to import from the Home Assistant history.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { esc, D } = ctx;
  const POLL_MS = 2500;
  const LATER = 'later';

  // The text under a finished job (the same wording as the old "done" messages)
  const RESULTS = {
    rules: (t, r) => t('maint_rules_done', { days: r.days_changed || 0, removed: (r.points || 0) - (r.stays || 0) }),
    timezones: (t, r) => t('maint_tz_done', { days: r.days_changed || 0 }),
    day_edges: (t, r) => t('maint_edges_done', { days: r.days_changed || 0 }),
    positions: (t, r) => t('maint_pos_done', { days: r.days_changed || 0 }),
    zones: (t, r) => t('maint_zones_done', { n: r.changed || 0 }),
    export: (t, r) => (r.files ? t('job_export_done', { files: r.files }) : t('job_export_empty')),
    recorder: (t, r) => t('job_recorder_done', { added: r.added || 0, days: r.days || 0 }),
  };

  return class extends Base {
    // --- state ------------------------------------------------------------------------------------------
    get _job() { return (this._data && this._data.admin && this._data.admin.job) || { status: 'idle' }; }

    _jobKey(job) { return job.kind === 'maintenance' ? job.action : job.kind; }

    _jobTitle(job) { return this._t(`job_${this._jobKey(job)}`); }

    _jobPercent(job) { return job.total ? Math.min(100, Math.floor((100 * (job.done || 0)) / job.total)) : 100; }

    _jobResult(job) {
      const fn = RESULTS[this._jobKey(job)];
      return fn ? fn(this._t, job.result || {}) : '';
    }

    // Number of open points (for the summary and the badge)
    _openTaskCount() {
      const a = (this._data && this._data.admin) || {};
      const o = a.open_tasks || {};
      let n = 0;
      if ((a.zone_changes || []).length) n += 1;
      if (o.addresses > 0) n += 1;
      if (o.recorder && o.hint !== 'never' && o.hint !== 'done') n += 1;
      if (['done', 'cancelled', 'failed'].includes(this._job.status)) n += 1;
      return n;
    }

    _tasksSummary() {
      const t = this._t;
      const job = this._job;
      if (job.status === 'running') return t('sum_task_running', { title: this._jobTitle(job), p: this._jobPercent(job) });
      const address = (this._data.admin && this._data.admin.address_job) || {};
      if (['running', 'paused'].includes(address.status)) return t('sum_address_job', { done: address.done || 0, total: address.total || 0 });
      const n = this._openTaskCount();
      return n ? t('sum_tasks_open', { n }) : t('sum_tasks_none');
    }

    // --- the category -----------------------------------------------------------------------------------
    _tasksSection(box) {
      const t = this._t;
      box.innerHTML = `<div class="aufgaben-rahmen"><p class="hinweis" style="margin:0 0 10px">${esc(t('tasks_intro'))}</p>
        <div class="aufgaben"><div class="job"></div><div class="adressauftrag"></div><div class="offene"></div></div></div>`;
      this._tasksDraw();
    }

    _tasksDraw() {
      const root = this.querySelector('.aufgaben');
      if (!root || !this._data || !this._data.admin) return;
      clearTimeout(this._jobTimer);
      this._jobDraw(root.querySelector('.job'));
      this._addressStatus(root.querySelector('.adressauftrag'), this._data.admin.address_job);
      this._openDraw(root.querySelector('.offene'));
      this._updateSummary('tasks');
      if (this._job.status === 'running') this._jobPoll(root);
    }

    _jobDraw(el) {
      const t = this._t;
      const job = this._job;
      if (!job.status || job.status === 'idle') { el.innerHTML = ''; return; }
      const title = this._jobTitle(job);
      const percent = this._jobPercent(job);
      if (job.status === 'running') {
        el.innerHTML = `<div class="aufgabe job-lauf"><div class="aufgabe-text">${esc(t('job_running', { title, done: job.done || 0, total: job.total || 0, p: percent }))}</div>
          <progress max="100" value="${percent}" style="width:100%"></progress>
          <div class="aufgabe-aktionen"><button class="knopf gefahr abbrechen" type="button"><ha-icon icon="mdi:stop"></ha-icon>${esc(t('job_cancel'))}</button></div></div>`;
        el.querySelector('.abbrechen').addEventListener('click', async (e) => {
          e.currentTarget.disabled = true;
          const result = await this._ws({ type: 'whereabouts/jobs/control', action: 'cancel' });
          if (result && result.job) this._jobUpdate(result);
        });
        return;
      }
      let text;
      if (job.status === 'done') text = `${t('job_done', { title })} ${this._jobResult(job)}`;
      else if (job.status === 'cancelled') text = t(job.kind === 'export' ? 'job_cancelled_export' : 'job_cancelled', { title, done: job.done || 0, total: job.total || 0 });
      else text = t('job_failed', { title, error: job.error || '' });
      el.innerHTML = `<div class="aufgabe job-fertig"><div class="aufgabe-text">${esc(text)}</div>
        <div class="aufgabe-aktionen"><span class="datei"></span>
          <button class="knopf ausblenden" type="button"><ha-icon icon="mdi:close"></ha-icon>${esc(t('job_dismiss'))}</button></div></div>`;
      el.querySelector('.ausblenden').addEventListener('click', async () => {
        const result = await this._ws({ type: 'whereabouts/jobs/control', action: 'dismiss' });
        if (result && result.job) this._jobUpdate(result);
      });
      if (job.status === 'done' && job.file) {
        // the server deletes the file after 24 hours (downloads.MAX_AGE_SECONDS)
        const age = Date.now() - Date.parse(job.finished || '');
        if (age > 24 * 3600 * 1000) el.querySelector('.datei').innerHTML = `<span class="klein">${esc(t('job_file_gone'))}</span>`;
        else this._fileLink(el.querySelector('.datei'), job.file);
      }
    }

    // The download of a finished file: a signed link (the apps cannot download a blob).
    async _fileLink(holder, file) {
      const t = this._t;
      try {
        const link = await D.signedFileLink(this._hass, file);
        if (!holder.isConnected) return;
        holder.innerHTML = D.fileLinkHtml(t, link, file, 'knopf voll') + `<span class="klein" style="margin-left:8px">${esc(t('job_file_hint'))}</span>`;
      } catch (err) {
        holder.textContent = '';
      }
    }

    // A new state from the server (poll, cancel, dismiss)
    _jobUpdate(result) {
      const before = this._job;
      if (this._data.admin) {
        this._data.admin.job = result.job;
        if (result.open) this._data.admin.open_tasks = { ...(this._data.admin.open_tasks || {}), ...result.open };
      }
      if (before.status === 'running' && result.job.status !== 'running') this._jobEnded(result.job);
      this._tasksDraw();
    }

    _jobEnded(job) {
      const t = this._t;
      if (job.status === 'done') this._toast(`${this._jobTitle(job)}: ${this._jobResult(job)}`, false, true);
      else if (job.status === 'failed') this._toast(t('job_failed', { title: this._jobTitle(job), error: job.error || '' }), true);
      if (this._journalRefresh) this._journalRefresh();
      this._updateSummary('maintenance');
    }

    _jobPoll(root) {
      this._jobTimer = setTimeout(async () => {
        if (!root.isConnected) return;
        let result;
        try { result = await this._hass.callWS({ type: 'whereabouts/jobs/status' }); } catch (err) { this._jobPoll(root); return; }
        this._jobUpdate(result);
      }, POLL_MS);
    }

    // Start a job (message: a "…/start" or "…/export" command); shows the progress under "Open tasks".
    async _startJob(message) {
      const t = this._t;
      try {
        const result = await this._hass.callWS(message);
        this._data.admin.job = result.job;
        this._setOpen('tasks', true);
        this._tasksDraw();
        this._toast(t('job_started'), false, true);
        if (this._journalRefresh) this._journalRefresh();
        return result;
      } catch (err) {
        this._toast(err && err.code === 'busy' ? t('job_busy') : t('save_failed', { error: (err && (err.message || err.code)) || err }), true);
        return null;
      }
    }

    // --- what is still open ------------------------------------------------------------------------------
    // The open points changed on the server (an address job ended): ask again and draw the list
    async _openRefresh() {
      try {
        const result = await this._hass.callWS({ type: 'whereabouts/jobs/status' });
        if (this._data.admin && result.open) this._data.admin.open_tasks = { ...(this._data.admin.open_tasks || {}), ...result.open };
      } catch (err) { return; }
      const el = this.querySelector('.aufgaben .offene');
      if (el) this._openDraw(el);
      this._updateSummary('tasks');
    }

    _openDraw(el) {
      const t = this._t;
      const a = this._data.admin;
      const o = a.open_tasks || {};
      const rows = [];
      const zones = a.zone_changes || [];
      if (zones.length) rows.push({ id: 'zones', text: t('task_zones', { n: zones.length }), buttons: [{ id: 'zones', label: t('task_zones_button'), main: true }] });
      if (o.addresses > 0) {
        rows.push({ id: 'addresses', text: t('task_addresses', { n: o.addresses }),
          buttons: [{ id: 'addresses', label: t('task_addresses_button'), main: true }, { id: 'addresses-hide', label: t('task_addresses_hide') }] });
      }
      if (o.recorder && o.hint !== 'never' && o.hint !== 'done') {
        rows.push({ id: 'recorder', text: t('task_recorder'),
          buttons: [{ id: 'recorder', label: t('task_recorder_button'), main: true }, { id: 'recorder-never', label: t('task_recorder_never') }] });
      }
      const job = this._job;
      const address = a.address_job || {};
      const busy = job.status === 'running' || ['running', 'paused'].includes(address.status);
      const idle = !rows.length && !busy && (!job.status || job.status === 'idle') && !['done', 'cancelled'].includes(address.status);
      el.innerHTML = rows.map((r) => `<div class="aufgabe aufgabe-offen" data-aufgabe="${r.id}"><div class="aufgabe-text">${esc(r.text)}</div>
          <div class="aufgabe-aktionen">${r.buttons.map((b) => `<button class="knopf${b.main ? ' voll' : ''}" type="button" data-tat="${b.id}">${esc(b.label)}</button>`).join('')}</div></div>`).join('')
        + (idle ? `<div class="klein">${esc(t('tasks_none'))}</div>` : '');
      el.querySelectorAll('[data-tat]').forEach((b) => b.addEventListener('click', () => this._openAction(b.dataset.tat)));
    }

    async _openAction(id) {
      const a = this._data.admin;
      if (id === 'zones') {
        if (await this._zonesDialog({ ack: true })) a.zone_changes = [];
      } else if (id === 'addresses') {
        await this._addressDialog();
      } else if (id === 'addresses-hide') {
        const result = await this._ws({ type: 'whereabouts/jobs/addresses_clear' });
        if (result && result.open) a.open_tasks = { ...(a.open_tasks || {}), ...result.open };
      } else if (id === 'recorder') {
        await this._recorderDialog();
      } else if (id === 'recorder-never') {
        const result = await this._ws({ type: 'whereabouts/recorder/hint', hint: 'never' });
        if (result && result.open) a.open_tasks = { ...(a.open_tasks || {}), ...result.open };
      }
      this._tasksDraw();
    }

    // --- import from the Home Assistant history ----------------------------------------------------------
    async _recorderDialog() {
      const t = this._t;
      const a = this._data.admin;
      const recorded = ((a.open_tasks || {}).persons) || [];
      const persons = this._data.persons.map((p) => p.entity_id).filter((id) => !recorded.length || recorded.includes(id));
      const day = (offset) => {
        const d = new Date(Date.now() - offset * 86400000);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const preset = { persons, from: day(10), to: day(0) };
      const html = `<h3>${esc(t('rec_title'))}</h3>
        <div class="text">${esc(t('rec_text'))}</div>
        ${this._scopeHtml(preset)}
        <div class="text vorschau" style="margin-top:12px"></div>`;
      const answer = await this._liveDialog(html, t('rec_start'), false, async (win, scope, current) => {
        const text = win.querySelector('.vorschau');
        if (!scope.from || !scope.to) { text.textContent = t('maint_period_hint'); return false; }
        let preview;
        try { preview = await this._hass.callWS({ type: 'whereabouts/recorder/preview', ...scope }); } catch (err) {
          if (current()) text.textContent = err && err.code === 'no_recorder' ? t('rec_no_recorder') : t('save_failed', { error: (err && (err.message || err.code)) || err });
          return false;
        }
        if (!current()) return false;
        if (preview.busy) { text.textContent = t('rec_busy'); return false; }
        if (preview.too_large) { text.textContent = t('rec_large'); return true; }
        if (!preview.added) { text.textContent = t('rec_nothing'); return false; }
        text.textContent = t('rec_preview', { added: preview.added, days: preview.days, new: preview.days_new || 0, gaps: preview.days_add || 0 });
        return true;
      });
      if (!answer) return false;
      const { win, ...scope } = answer;
      return Boolean(await this._startJob({ type: 'whereabouts/recorder/start', ...scope }));
    }

    // The offer once per opening of the page: Import / Cancel (never again) / Later
    async _askRecorderOffer() {
      const t = this._t;
      const a = this._data && this._data.admin;
      const o = (a && a.open_tasks) || {};
      if (!this._admin || this._scope !== 'own' || this._askedRecorder || !o.recorder || !['open', LATER].includes(o.hint) || this.querySelector('.dialog')) return;
      this._askedRecorder = true;
      const answer = await this._choice(t('rec_offer_title'), `<div class="text">${esc(t('rec_offer_text'))}</div>`, [
        { id: 'cancel', label: t('task_recorder_later') },
        { id: 'never', label: t('task_recorder_never') },
        { id: 'ok', label: t('task_recorder_button'), main: true },
      ]);
      if (answer === 'ok') { await this._recorderDialog(); return; }
      const result = await this._ws({ type: 'whereabouts/recorder/hint', hint: answer === 'never' ? 'never' : LATER });
      if (result && result.open) a.open_tasks = { ...(a.open_tasks || {}), ...result.open };
      this._tasksDraw();
    }
  };
};
