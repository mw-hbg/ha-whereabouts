// Whereabouts – settings page: map service, CARTO styles and key, map apps.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { sel, PERSONAL, TILE_LINKS, CARTO_STYLES, extractCartoKey, esc, rich } = ctx;

  return class extends Base {
    // --- map service; under each one: light/dark (CARTO: styles and key) as sub-areas ------------------
    _tiles(category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'tiles');
      const values = this._values(category);
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_tiles'))}</span>${this._originHtml(category, 'tiles')}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_tiles'))}</div>
        <div class="stile" role="radiogroup" aria-label="${esc(t('st_tiles'))}">
          ${['esri', 'osm', 'carto'].map((v) => `<label class="stil${values.tiles === v ? ' gewaehlt' : ''}">
              <input type="radio" name="kartenstil-${this._scope}" value="${v}"${values.tiles === v ? ' checked' : ''}${locked ? ' disabled' : ''}>
              <span class="name">${esc(t(`ed_tiles_${v}`))}${v === 'carto' ? '<span class="api-status"></span>' : ''}</span>
              <span class="klein">${esc(t(`tiles_note_${v}`))}</span>
              <a href="${TILE_LINKS[v]}" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('tiles_examples'))}</a>
            </label><div class="unterpunkte" data-src="${v}"></div>`).join('')}
        </div>`;
      this._infoToggle(row);
      row.querySelectorAll('.stil a').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
      row.querySelectorAll('.stil input').forEach((input) => input.addEventListener('change', async () => {
        if (!input.checked) return;
        const ok = await this._savePersonal(category, 'tiles', input.value);
        if (!ok) { this._fillPersonal(PERSONAL.find((c) => c.id === category)); return; }
        row.querySelectorAll('.stil').forEach((l) => l.classList.toggle('gewaehlt', l.querySelector('input').checked));
      }));
      // CARTO: the key, then the styles per map and light/dark
      const label = (v) => t(`ed_carto_${v}`);
      const holder = row.querySelector('.unterpunkte[data-src="carto"]');
      const sub = this._subsection('sub_carto', t('sub_carto'),
        t('sum_carto', { live: label(values.carto_live_light), history: label(values.carto_history_light) }));
      const about = document.createElement('div');
      about.className = 'zeile breit innen-zeile';
      about.style.borderTop = 'none';
      about.innerHTML = `<div class="beschriftung"><span>${esc(t('st_carto_styles'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_carto_styles'))}</div>`;
      this._infoToggle(about);
      sub.inner.appendChild(about);
      const grid = document.createElement('div');
      grid.className = 'stilraster';
      grid.innerHTML = `<span class="kopf leer"></span><span class="kopf spalte">${esc(t('carto_light'))}</span><span class="kopf spalte">${esc(t('carto_dark'))}</span>`;
      [['live', 'live_title'], ['history', 'history_title']].forEach(([map, title]) => {
        const head = document.createElement('span');
        head.className = 'kopf zeilenkopf';
        head.textContent = t(title);
        grid.appendChild(head);
        ['light', 'dark'].forEach((mode) => {
          const key = `carto_${map}_${mode}`;
          const field = { key, sel: (tt) => sel(CARTO_STYLES.map((v) => ({ value: v, label: tt(`ed_carto_${v}`) }))) };
          const cell = document.createElement('div');
          cell.className = 'zelle';
          const fixed = locked || this._fixedKey(category, key);
          const control = this._control(typeof field.sel === 'function' ? field.sel(t) : field.sel, field, values[key], fixed,
            (value) => this._savePersonal(category, key, value).then((ok) => { this._updateOrigin(category, key); return ok; }));
          control.setAttribute('aria-label', `${t(title)} – ${t(`carto_${mode}`)}`);
          cell.appendChild(control);
          cell.insertAdjacentHTML('beforeend', this._originHtml(category, key));
          cell.dataset.key = key;
          grid.appendChild(cell);
        });
      });
      sub.inner.appendChild(grid);
      this._cartoKey(holder, row.querySelector('.api-status'));
      holder.appendChild(sub.el);
      return row;
    }

    // The CARTO key as a sub-area under CARTO, above the styles. Closed while the key works;
    // open without a key or when CARTO refuses it. "API ✓/✗" next to the name CARTO.
    // Not an "own value": no dot or arrow, not part of "Reset to standard"; only "Remove" takes it away.
    _cartoKey(holder, badge) {
      const t = this._t;
      const d = this._data;
      const setBadge = () => {
        if (!badge) return;
        const state = this._keyState;
        badge.innerHTML = state === 'ok' ? `<span class="api ok" title="${esc(t('carto_key_ok'))}">API ✓</span>`
          : state === 'bad' ? `<span class="api schlecht" title="${esc(t('carto_key_rejected'))}">API ✗</span>` : '';
      };
      const stateText = () => ({
        ok: t('carto_key_ok'), bad: t('carto_key_rejected'), checking: t('carto_key_checking'),
        none: this._admin ? t('carto_key_none') : t('carto_key_missing'), unchecked: t('carto_key_unchecked'),
      }[this._keyState] || (d.carto_key_set ? t('carto_key_set') : t('carto_key_missing')));
      if (!this._admin) {
        const sub = this._subsection('sub_key', t('st_carto_api_key'), d.carto_key_set ? t('carto_key_set') : t('carto_key_missing'));
        sub.inner.innerHTML = `<div class="zeile breit innen-zeile" style="border-top:none"><span class="klein">${esc(d.carto_key_set ? t('carto_key_set') : t('carto_key_missing'))}</span></div>`;
        holder.appendChild(sub.el);
        return;
      }
      const current = d.admin.options.carto_api_key || '';
      if (!current) this._keyState = 'none';
      else if (!this._keyState || this._keyState === 'none') {
        this._keyState = 'checking';
        this._checkKey(null).then(() => { setBadge(); this._redrawCategory('map'); });
      }
      setBadge();
      const sub = this._subsection('sub_key', t('st_carto_api_key'), stateText(), this._keyState === 'bad');
      if (!current || this._keyState === 'bad') sub.el.open = true;
      holder.appendChild(sub.el);
      const box = document.createElement('div');
      box.className = 'zeile breit innen-zeile';
      box.style.borderTop = 'none';
      box.innerHTML = `<div class="beschriftung"><span>${esc(t('st_carto_api_key'))}</span>
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_carto_api_key'))}</div>
        <div class="schluesselreihe">
          <span class="augen"><input class="ein schluesselfeld" type="password" autocomplete="off" spellcheck="false" placeholder="cb1_…" value="${esc(current)}" aria-label="${esc(t('st_carto_api_key'))}">
            <button class="knopf rund auge" type="button" data-immer="1" title="${esc(t('show_key'))}" aria-label="${esc(t('show_key'))}"><ha-icon icon="mdi:eye"></ha-icon></button></span>
          <button class="knopf gefahr entfernen" type="button"${current ? '' : ' hidden'}><ha-icon icon="mdi:delete-outline"></ha-icon>${esc(t('carto_remove'))}</button>
        </div>
        <div class="schluesselreihe"><span class="klein status ${this._keyState === 'bad' ? 'schlecht' : this._keyState === 'ok' ? 'ok' : ''}">${esc(current ? stateText() : '')}</span>
          <a class="verweis" style="margin-left:auto" href="https://carto.com/basemaps/apikey/" target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${esc(t('carto_get_key'))}</a></div>`;
      sub.inner.appendChild(box);
      this._infoToggle(box);
      const input = box.querySelector('.schluesselfeld');
      const eye = box.querySelector('.auge');
      const status = box.querySelector('.status');
      const remove = box.querySelector('.entfernen');
      // Hidden with dots; the eye (or typing) shows it for 10 seconds.
      const show = (on) => {
        input.type = on ? 'text' : 'password';
        eye.innerHTML = `<ha-icon icon="${on ? 'mdi:eye-off' : 'mdi:eye'}"></ha-icon>`;
        clearTimeout(this._eyeTimer);
        if (on) this._eyeTimer = setTimeout(() => show(false), 10000);
      };
      eye.addEventListener('click', () => show(input.type === 'password'));
      const saver = document.createElement('div');
      saver.style.gridColumn = '1 / -1';
      box.appendChild(saver);
      const store = async (key) => {
        const ok = await this._saveOption({ key: 'carto_api_key', text: true }, key);
        if (!ok) return false;
        d.carto_key_set = Boolean(key);
        this._keyState = key ? 'checking' : 'none';
        input.value = key;
        remove.hidden = !key;
        status.className = 'klein status';
        status.textContent = key ? t('carto_key_checking') : '';
        setBadge();
        if (key) this._checkKey(status).then(() => { setBadge(); setTimeout(() => this._redrawCategory('map'), 1500); });
        return true;
      };
      const savable = this._savable(saver, {
        id: 'option::::carto_api_key',
        label: t('st_carto_api_key'),
        initial: current,
        draft: { kind: 'option', key: 'carto_api_key', label: t('st_carto_api_key') },
        save: async (value) => {
          const key = extractCartoKey(value);
          if (key === null) { status.className = 'klein status schlecht'; status.textContent = t('carto_key_invalid'); return false; }
          return store(key);
        },
      });
      savable.reset = (v) => { input.value = v; };
      savable.focus = () => { sub.el.open = true; input.focus(); };
      input.addEventListener('input', () => { show(true); savable.set(input.value.trim()); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savable.save(); } });
      remove.addEventListener('click', async () => {
        if (!await this._confirm(t('carto_remove_title'), t('confirm_carto_remove'), t('carto_remove'), true)) return;
        savable.set('');
        await savable.save();
      });
    }

    // One small request to CARTO (after saving: the integration reloads meanwhile).
    async _checkKey(status) {
      const t = this._t;
      let result = null;
      for (const wait of status ? [1500, 2500, 4000] : [0, 2000]) {
        await new Promise((r) => setTimeout(r, wait));
        try { result = await this._hass.callWS({ type: 'whereabouts/settings/check_key' }); break; } catch (err) { result = null; }
      }
      if (result && result.ok) this._keyState = 'ok';
      else if (result && /^http_4/.test(result.reason || '')) this._keyState = 'bad';
      else this._keyState = 'unchecked';
      if (!status || !status.isConnected) return;
      if (this._keyState === 'ok') { status.className = 'klein status ok'; status.textContent = t('carto_key_ok'); return; }
      status.className = 'klein status schlecht';
      status.textContent = this._keyState === 'bad' ? t('carto_key_rejected') : t('carto_key_unchecked');
    }

    // Map apps offered on phones and tablets: a field with ticks (at least one).
    _apps(category) {
      const t = this._t;
      const values = this._values(category);
      const locked = this._locked(category) || this._fixedKey(category, 'map_link_apps');
      const chosen = new Set(Array.isArray(values.map_link_apps) ? values.map_link_apps : ['apple', 'google']);
      const apps = ['google', 'apple', 'osm', 'waze', 'here'];
      const row = document.createElement('div');
      row.className = 'zeile';
      row.innerHTML = `<div class="beschriftung"><span>${esc(t('st_map_link_apps'))}</span>${this._originHtml(category, 'map_link_apps')}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="steuer"><div class="mehrfach"><button type="button" aria-haspopup="true" aria-expanded="false"${locked ? ' disabled' : ''}><span></span><ha-icon icon="mdi:menu-down"></ha-icon></button>
          <div class="liste" hidden>${apps.map((a) => `<label><input type="checkbox" value="${a}"${chosen.has(a) ? ' checked' : ''}>${esc(t(`ed_link_${a}`))}</label>`).join('')}</div></div></div>
        <div class="infotext" hidden>${rich(t('si_map_link_apps'))}</div>`;
      this._infoToggle(row);
      const button = row.querySelector('.mehrfach > button');
      const list = row.querySelector('.mehrfach .liste');
      const text = () => { button.querySelector('span').textContent = apps.filter((a) => chosen.has(a)).map((a) => t(`ed_link_${a}`)).join(', '); };
      text();
      const close = (e) => {
        if (e && row.contains(e.target)) return;
        list.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', close, true);
      };
      button.addEventListener('click', () => {
        list.hidden = !list.hidden;
        button.setAttribute('aria-expanded', list.hidden ? 'false' : 'true');
        if (!list.hidden) document.addEventListener('click', close, true);
      });
      list.querySelectorAll('input').forEach((box) => box.addEventListener('change', async () => {
        if (box.checked) chosen.add(box.value); else chosen.delete(box.value);
        if (!chosen.size) { box.checked = true; chosen.add(box.value); this._toast(t('apps_need_one'), true); return; }
        text();
        await this._savePersonal(category, 'map_link_apps', apps.filter((a) => chosen.has(a)));
        this._updateOrigin(category, 'map_link_apps');
      }));
      return row;
    }
  };
};
