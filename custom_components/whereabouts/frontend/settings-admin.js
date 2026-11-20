// Whereabouts – settings page: administration: persons in Whereabouts, options, address sensors.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { B, sel, esc, rich } = ctx;

  return class extends Base {
    // --- persons in Whereabouts (administrators) -----------------------------------------------------
    _base(box) {
      const t = this._t;
      const d = this._data;
      const all = d.admin.all_persons;
      const configured = d.admin.options.persons || [];
      const chosen = configured.length ? configured : all.map((p) => p.entity_id);
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_persons'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_persons'))}</div>`;
      this._infoToggle(row);
      row.appendChild(this._checkList(all, chosen, false, async (list) => {
        if (!list.length) { this._toast(t('base_needs_one'), true); return false; }
        const value = list.length === all.length ? [] : list;
        const ok = await this._saveOption({ key: 'persons' }, value);
        if (ok) this._reloadSoon();
        return ok;
      }));
      box.appendChild(row);
    }

    // Recording: ticks, only persons in Whereabouts.
    _personsOption(field) {
      const t = this._t;
      const d = this._data;
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t(`st_${field.key}`))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t(`si_${field.key}`))}</div>`;
      this._infoToggle(row);
      const chosen = (d.admin.options[field.key] || []).filter((id) => d.persons.some((p) => p.entity_id === id));
      row.appendChild(this._checkList(d.persons, chosen, false, (list) => this._saveOption(field, list)));
      return row;
    }

    async _setFlag(input) {
      const t = this._t;
      const flag = input.dataset.flag;
      const userId = input.dataset.user;
      const name = userId === 'all' ? t('users_all') : this._userName(userId);
      // The tab switch shows "visible"; stored is "hidden".
      const value = flag === 'hide_settings' ? !input.checked : input.checked;
      if (flag === 'sync') {
        const text = userId === 'all' ? t(value ? 'confirm_sync_all_on' : 'confirm_sync_all_off') : t(value ? 'confirm_sync_user_on' : 'confirm_sync_user_off', { name });
        if (!await this._confirm(t('users_sync'), text, t(value ? 'sync_on' : 'sync_off'), !value && userId === 'all')) {
          input.checked = !input.checked;
          return;
        }
      }
      const ok = await this._ws({ type: 'whereabouts/settings/flags', user_id: userId, [flag]: value }, true);
      if (ok === null) { input.checked = !input.checked; return; }
      if (flag === 'sync') {
        this._setSuccess(userId === 'all'
          ? t(value ? 'success_sync_all_on' : 'success_sync_all_off')
          : t(value ? 'success_sync_user_on' : 'success_sync_user_off', { name }), 'rights');
      }
      await this._load();
    }

    _redrawRights() {
      const box = this.querySelector('.felder[data-kat="rights"]');
      if (!box) return;
      box.innerHTML = '';
      this._rights(box);
    }

    // --- address sensors (administrators): sub-area "Address sensor per person" ---------------------------
    _sensors(box) {
      const t = this._t;
      const options = this._data.admin.options;
      if (options.address_source !== 'phone_osm' && options.address_source !== 'phone') return;
      const address = this._data.admin.address || { auto: {}, sensors: [] };
      const sensors = { ...(options.address_sensors || {}) };
      const persons = this._data.persons.filter((p) => (options.record_persons || []).includes(p.entity_id));
      const missing = persons.filter((p) => {
        const chosen = sensors[p.entity_id];
        const auto = address.auto[p.entity_id] || {};
        return !(chosen || auto.sensor);
      });
      const manual = persons.filter((p) => sensors[p.entity_id]).length;
      const summary = !persons.length ? t('sum_sensors_none')
        : missing.length ? t('sum_sensors_missing', { n: missing.length })
          : manual ? t('sum_sensors_manual', { n: persons.length, m: manual }) : t('sum_sensors_auto', { n: persons.length });
      const sub = this._subsection('sub_sensors', t('sub_sensors'), summary, missing.length > 0);
      box.appendChild(sub.el);
      const intro = document.createElement('div');
      intro.className = 'zeile breit';
      intro.style.borderTop = 'none';
      intro.innerHTML = `<div class="beschriftung"><span class="klein">${esc(t('sensors_intro'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_sensors'))}</div>`;
      this._infoToggle(intro);
      sub.inner.appendChild(intro);
      if (!persons.length) return;
      const all = address.sensors.map((x) => ({ value: x.entity_id, label: `${x.name} (${x.entity_id})` }));
      const nameOf = (id) => (address.sensors.find((x) => x.entity_id === id) || {}).name || id;
      const saveSensors = async () => this._saveOption({ key: 'address_sensors' }, sensors);
      persons.forEach((p) => {
        const auto = address.auto[p.entity_id] || {};
        const current = sensors[p.entity_id] || '';
        const own = Boolean(current);
        // which sensor is used now, or: none -> OpenStreetMap
        const used = own ? t('sensor_used_own', { name: nameOf(current) })
          : auto.sensor ? t('sensor_used_auto', { name: auto.name || auto.sensor }) : '';
        const row = document.createElement('div');
        row.className = 'zeile schalter-zeile innen-zeile';
        row.innerHTML = `<div class="beschriftung" style="flex-wrap:wrap"><span>${esc(p.name)}</span><span class="smarke"></span>
            <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button>
            <span class="klein" style="flex:1 1 100%">${esc(used)}</span></div>
          <div class="steuer schalter"><span class="klein" style="margin-right:8px">${esc(t('sensor_own_switch'))}</span></div>
          <div class="infotext" hidden>${rich(t('si_sensors'))}</div>`;
        this._infoToggle(row);
        const toggle = this._control(B, { key: 'own_sensor' }, own, false, async (on) => {
          sensors[p.entity_id] = on ? (auto.sensor || (all[0] && all[0].value) || null) : null;
          if (on && !sensors[p.entity_id]) { this._toast(t('sensor_none_available'), true); this._redrawAdmin('addresses'); return false; }
          const ok = await saveSensors();
          if (!ok) sensors[p.entity_id] = current || null;
          return ok;
        });
        row.querySelector('.steuer').appendChild(toggle);
        if (!own && !auto.sensor) {
          const note = document.createElement('div');
          note.className = 'kontrast';
          note.textContent = t('address_auto_missing');
          row.appendChild(note);
        } else if (!own && !auto.ok) {
          const note = document.createElement('div');
          note.className = 'klein schlecht';
          note.style.gridColumn = '1 / -1';
          note.textContent = t('address_auto_off');
          row.appendChild(note);
        }
        this._fillMarker(row.querySelector('.smarke'), {
          undoKey: `sensor:${p.entity_id}`,
          own,
          standardText: auto.sensor ? t('sensor_used_auto', { name: auto.name || auto.sensor }) : t('address_auto'),
          back: async () => { sensors[p.entity_id] = null; return saveSensors(); },
          restore: async () => { sensors[p.entity_id] = current; return saveSensors(); },
          redraw: () => this._redrawAdmin('addresses'),
        });
        sub.inner.appendChild(row);
        if (own) {
          const choices = [...all];
          if (!choices.some((o) => o.value === current)) choices.unshift({ value: current, label: current });
          const pick = this._row({ key: 'address_sensor', sel: sel(choices), label: t('sensor_choose'), info: t('si_address_sensor_for', { name: p.name }) },
            current, false, async (value) => {
              const before = sensors[p.entity_id];
              sensors[p.entity_id] = value || null;
              const ok = await saveSensors();
              if (!ok) sensors[p.entity_id] = before;
              return ok;
            });
          pick.classList.add('innen-zeile');
          pick.style.borderTop = 'none';
          sub.inner.appendChild(pick);
        }
      });
    }
  };
};
