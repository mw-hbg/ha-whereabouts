// Whereabouts – settings page: users and rights, fixing categories for users.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { esc, rich } = ctx;

  return class extends Base {
    // --- rights ---------------------------------------------------------------------------------------
    _rights(box) {
      const t = this._t;
      const d = this._data;
      const nameOf = (id) => this._personName(id);
      const list = (ids) => (ids.length ? ids.map(nameOf).join(', ') : t('nobody'));
      if (!this._admin) {
        box.innerHTML = `<div class="tabellenrahmen"><table class="tabelle">
          ${['live', 'history', 'delete'].map((k) => `<tr><th>${esc(t(`right_${k}`))}</th><td>${esc(list(d.rights[k] || []))}</td></tr>`).join('')}
          </table></div><p class="kat-text klein">${esc(t('rights_by_admin'))}</p>`;
        return;
      }
      this._usersTable(box);
    }

    // Users: one table. First row: the rules and settings for all users (the standard),
    // then every user with rights, settings state and "Edit".
    _usersTable(box) {
      const t = this._t;
      const d = this._data;
      const admin = d.admin;
      const kinds = ['live', 'history', 'delete'];
      const levels = ['all', 'own', 'none'];
      const builtIn = { live: 'all', history: 'all', delete: 'none' };
      const technical = admin.users.filter((u) => u.active && u.technical && !u.is_admin).length;
      const users = admin.users.filter((u) => u.active && u.id !== d.user.id && (this._showTechnical || !u.technical || u.is_admin));
      const syncedTo = admin.sync && admin.sync.user_id;
      const stateOf = (u) => {
        if (this._flag(u.id, 'sync') && syncedTo) {
          return `<span class="status sync">${esc(syncedTo === d.user.id ? t('state_synced_me') : t('state_synced', { name: this._userName(syncedTo) }))}</span>`;
        }
        if ((admin.pending_users || []).includes(u.id)) return `<span class="status sync">${esc(t('state_pending'))}</span>`;
        const own = Object.keys((admin.own_keys || {})[u.id] || {});
        const locks = (admin.field_locks || {})[u.id] || {};
        const fixed = Object.values(locks).reduce((n, keys) => n + (keys.includes('*') ? 1 : keys.length), 0);
        return `${own.length ? `<span class="status eigen">${esc(t('state_own', { cats: own.map((c) => t(`cat_${c}`)).join(', ') }))}</span>`
          : `<span class="status standard">${esc(t('state_default'))}</span>`}${fixed ? `<span class="status fest">${esc(t('state_fixed', { n: fixed }))}</span>` : ''}`;
      };
      const switches = (userId, synced) => `
        <label class="schalterzeile"><input type="checkbox" class="schalter-klein" data-flag="hide_settings" data-user="${esc(userId)}"${(userId === 'all' ? admin.all_flags.hide_settings : this._flag(userId, 'hide_settings') || synced) ? '' : ' checked'}${synced && userId !== 'all' ? ' disabled' : ''}>${esc(t('users_tab'))}</label>
        <label class="schalterzeile"><input type="checkbox" class="schalter-klein" data-flag="sync" data-user="${esc(userId)}"${(userId === 'all' ? admin.all_flags.sync : this._flag(userId, 'sync')) ? ' checked' : ''}>${esc(t('users_sync'))}</label>`;
      const wrap = document.createElement('div');
      wrap.className = 'benutzer';
      wrap.innerHTML = `<div class="kopf"><b>${esc(t('users_table'))}</b>
          ${technical ? `<label class="klein"><input type="checkbox" class="technisch"${this._showTechnical ? ' checked' : ''}> ${esc(t('show_technical', { n: technical }))}</label>` : ''}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button>
        </div>
        <div class="infotext" hidden style="margin:8px 12px">${rich(t('si_users_table'))}</div>
        <div class="tabellenrahmen" style="padding:0"><table>
          <thead><tr><th>${esc(t('user'))}</th>${kinds.map((k) => `<th class="spalte-recht">${esc(t(`right_${k}`))}</th>`).join('')}<th>${esc(t('users_settings_col'))}</th></tr></thead>
          <tbody>
            <tr class="alle"><td>${esc(t('users_all'))}<div class="klein">${esc(t('users_all_hint'))}</div>
              <button class="knopf bearbeiten" type="button" data-user="defaults" style="margin-top:6px"${this._syncAll ? ' disabled' : ''}><ha-icon icon="mdi:pencil"></ha-icon>${esc(t('edit'))}</button></td>
              ${kinds.map((k) => `<td><select class="ein regel" data-kind="${k}" aria-label="${esc(t(`right_${k}`))}">${levels.map((v) => `<option value="${v}"${admin.rights_default[k] === v ? ' selected' : ''}>${esc(t(`level_${v}`))}</option>`).join('')}</select><span class="regelmarke" data-kind="${k}"></span></td>`).join('')}
              <td>${switches('all', false)}</td></tr>
          </tbody></table></div>
        <p class="kat-text klein" style="margin-top:8px">${esc(t('admins_see_all'))}</p>`;
      const body = wrap.querySelector('tbody');
      users.forEach((u) => {
        const tr = document.createElement('tr');
        if (u.is_admin) {
          tr.innerHTML = `<td>${esc(u.name)}<div class="klein">${esc(t('role_admin_short'))}</div></td><td colspan="4" class="klein">${esc(t('admin_all'))}</td>`;
          body.appendChild(tr);
          return;
        }
        const own = admin.rights[u.id];
        const synced = this._flag(u.id, 'sync');
        tr.innerHTML = `<td>${esc(u.name)}<span class="rmarke"></span>${u.technical ? `<div class="klein">${esc(t('technical_user'))}</div>` : ''}
            <label class="schalterzeile"><input type="checkbox" class="eigen"${own ? ' checked' : ''}>${esc(t('rights_own'))}</label>
            <button class="knopf bearbeiten" type="button" data-user="${esc(u.id)}" style="margin-top:6px"${synced ? ` disabled title="${esc(t('edit_synced'))}"` : ''}><ha-icon icon="mdi:pencil"></ha-icon>${esc(t('edit'))}</button></td>`;
        kinds.forEach((kind) => {
          const td = document.createElement('td');
          const chips = document.createElement('div');
          chips.className = 'chips';
          const current = own ? new Set(own[kind] || []) : null;
          d.persons.forEach((p) => {
            const on = current ? current.has(p.entity_id) : this._ruleAllows(kind, u, p);
            const chip = document.createElement('label');
            chip.className = `chip${on ? (own ? ' an' : ' regel') : ''}${own ? '' : ' fest'}`;
            chip.innerHTML = `<input type="checkbox"${on ? ' checked' : ''}${own ? '' : ' disabled'}>${esc(p.name)}`;
            chip.querySelector('input').addEventListener('change', async (e) => {
              if (!e.target.checked && !await this._confirm(t('rights_title'),
                t('confirm_rights_remove', { user: u.name, person: p.name, right: t(`right_${kind}`) }), t('remove'), true)) {
                e.target.checked = true;
                return;
              }
              const next = { ...admin.rights[u.id] };
              const set = new Set(next[kind] || []);
              if (e.target.checked) set.add(p.entity_id); else set.delete(p.entity_id);
              next[kind] = [...set];
              if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: next }) !== null) {
                admin.rights[u.id] = next;
                chip.classList.toggle('an', e.target.checked);
              } else e.target.checked = !e.target.checked;
            });
            chips.appendChild(chip);
          });
          td.appendChild(chips);
          if (!own) td.insertAdjacentHTML('beforeend', `<div class="regelhinweis">${esc(t('by_rule'))}</div>`);
          tr.appendChild(td);
        });
        tr.insertAdjacentHTML('beforeend', `<td>${stateOf(u)}${switches(u.id, synced)}</td>`);
        const rulesFor = () => {
          const start = {};
          kinds.forEach((kind) => { start[kind] = d.persons.filter((p) => this._ruleAllows(kind, u, p)).map((p) => p.entity_id); });
          return start;
        };
        tr.querySelector('.eigen').addEventListener('change', async (e) => {
          if (e.target.checked) {
            const start = rulesFor();
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: start }) !== null) admin.rights[u.id] = start;
          } else {
            if (!await this._confirm(t('rights_title'), t('confirm_rights_rules', { user: u.name }), t('save'), true)) {
              e.target.checked = true;
              return;
            }
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: null }) !== null) delete admin.rights[u.id];
          }
          this._redrawRights();
        });
        // own rights: dot + arrow back to the rules for all users
        const before = own ? JSON.parse(JSON.stringify(own)) : null;
        this._fillMarker(tr.querySelector('.rmarke'), {
          undoKey: `rights:${u.id}`,
          own: Boolean(own),
          standardText: t('rights_rules'),
          back: async () => {
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: null }) === null) return false;
            delete admin.rights[u.id];
            return true;
          },
          restore: async () => {
            if (await this._ws({ type: 'whereabouts/settings/rights', user_id: u.id, rights: before }) === null) return false;
            admin.rights[u.id] = before;
            return true;
          },
          redraw: () => this._redrawRights(),
        });
        body.appendChild(tr);
      });
      if (!users.some((u) => !u.is_admin)) body.insertAdjacentHTML('beforeend', `<tr><td colspan="5" class="klein">${esc(t('no_users'))}</td></tr>`);
      // rules for all users
      wrap.querySelectorAll('select.regel').forEach((select) => {
        const kind = select.dataset.kind;
        const current = admin.rights_default[kind];
        select.addEventListener('change', async () => {
          const value = select.value;
          if (levels.indexOf(value) > levels.indexOf(current)
            && !await this._confirm(t('rights_title'), t('confirm_rights_less'), t('save'), true)) { select.value = current; return; }
          if (await this._ws({ type: 'whereabouts/settings/rights_default', levels: { [kind]: value } }) === null) { select.value = current; return; }
          admin.rights_default[kind] = value;
          this._redrawRights();
          this._updateSummary('rights');
        });
        const setLevel = async (value) => {
          if (await this._ws({ type: 'whereabouts/settings/rights_default', levels: { [kind]: value } }) === null) return false;
          admin.rights_default[kind] = value;
          this._updateSummary('rights');
          return true;
        };
        this._fillMarker(wrap.querySelector(`.regelmarke[data-kind="${kind}"]`), {
          undoKey: `rule:${kind}`,
          own: current !== builtIn[kind],
          standardText: t(`level_${builtIn[kind]}`),
          back: () => setLevel(builtIn[kind]),
          restore: () => setLevel(current),
          redraw: () => this._redrawRights(),
        });
      });
      wrap.querySelector('.kopf .info').addEventListener('click', (e) => {
        const text = wrap.querySelector('.infotext');
        text.hidden = !text.hidden;
        e.currentTarget.setAttribute('aria-expanded', text.hidden ? 'false' : 'true');
      });
      const tech = wrap.querySelector('.technisch');
      if (tech) tech.addEventListener('change', () => { this._showTechnical = tech.checked; this._redrawRights(); });
      wrap.querySelectorAll('[data-flag]').forEach((input) => input.addEventListener('change', () => this._setFlag(input)));
      wrap.querySelectorAll('.bearbeiten').forEach((b) => b.addEventListener('click', async () => {
        if (!await this.confirmLeave()) return;
        if (b.dataset.user === 'defaults') { this._scope = 'defaults'; this._user = null; this._render(); } else await this._loadUser(b.dataset.user);
        const scroller = this._scroller();
        if (scroller) scroller.scrollTop = 0;
      }));
      box.appendChild(wrap);
    }

    _ruleAllows(kind, user, person) {
      const level = this._data.admin.rights_default[kind];
      if (level === 'all') return true;
      if (level === 'own') return person.user_id === user.id;
      return false;
    }

    // --- fixing a category for users (administrators) ---------------------------------------------------
    async _lockDialog(category) {
      const t = this._t;
      const lock = { mode: 'none', except: [], users: [], ...(this._data.admin.locks[category] || {}) };
      const users = this._data.admin.users.filter((u) => !u.is_admin && u.active && (!u.technical || this._showTechnical));
      const userList = (cls, chosen) => `<div class="liste ${cls}">${users.length ? users.map((u) => `<label><input type="checkbox" value="${esc(u.id)}"${chosen.includes(u.id) ? ' checked' : ''}>${esc(u.name)}</label>`).join('') : `<span class="klein">${esc(t('no_users'))}</span>`}</div>`;
      const html = `<h3>${esc(t('lock_title', { name: t(`cat_${category}`) }))}</h3>
        <div class="text">${esc(t('lock_text'))}</div>
        <label><input type="radio" name="modus" value="none"${lock.mode === 'none' ? ' checked' : ''}>${esc(t('lock_none'))}</label>
        <label><input type="radio" name="modus" value="all"${lock.mode === 'all' ? ' checked' : ''}>${esc(t('lock_all'))}</label>
        <div class="klein" style="margin-left:28px">${esc(t('lock_except'))}</div>${userList('ausser', lock.except)}
        <label><input type="radio" name="modus" value="selected"${lock.mode === 'selected' ? ' checked' : ''}>${esc(t('lock_selected'))}</label>
        ${userList('nur', lock.users)}`;
      const result = await this._dialog(html, t('save'), false, (win) => ({
        mode: win.querySelector('input[name="modus"]:checked').value,
        except: [...win.querySelectorAll('.ausser input:checked')].map((i) => i.value),
        users: [...win.querySelectorAll('.nur input:checked')].map((i) => i.value),
      }));
      if (!result) return;
      if (await this._ws({ type: 'whereabouts/settings/lock', category, mode: result.mode, except: result.except, users: result.users }) !== null) {
        this._data.admin.locks[category] = result;
        this._rerenderCategory(category);
        const toc = this.querySelector(`.toc a[data-ziel="${category}"]`);
        if (toc) toc.title = this._lockTitle(category);
      }
    }
  };
};
