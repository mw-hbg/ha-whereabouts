// Whereabouts – settings page: persons and profile pictures.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { same, maybe, esc, rich, S } = ctx;

  return class extends Base {
    // --- persons (personal) -----------------------------------------------------------------------
    _selectablePersons() {
      const rights = this._scope === 'user' && this._user ? this._user.rights : this._data.rights;
      const allowed = new Set([...(rights.live || []), ...(rights.history || [])]);
      return this._data.persons.filter((p) => this._scope === 'defaults' || (this._admin && this._scope === 'own') || allowed.has(p.entity_id));
    }

    _persons(box, category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'persons');
      const values = this._values(category);
      const settings = JSON.parse(JSON.stringify(values.person_settings || {})); // what is saved
      const all = this._selectablePersons();
      const chosen = (values.persons || []).filter((id) => all.some((p) => p.entity_id === id));
      const order = chosen.length ? [...chosen, ...all.map((p) => p.entity_id).filter((id) => !chosen.includes(id))]
        : all.map((p) => p.entity_id);
      const shown = new Set(chosen.length ? chosen : order);
      const colorOf = (id) => (settings[id] && settings[id].color) || S.personColor(this._hass, {}, id);
      const personOf = (id) => this._data.persons.find((p) => p.entity_id === id) || { entity_id: id, name: id, picture: '' };
      const scope = this._scope;
      const cleaned = () => {
        const out = {};
        Object.entries(settings).forEach(([id, entry]) => {
          const e = Object.fromEntries(Object.entries(entry).filter(([k, v]) => v && !(k === 'show_in' && v === 'both')));
          if (Object.keys(e).length) out[id] = e;
        });
        return out;
      };
      const save = async () => {
        const list = order.filter((id) => shown.has(id));
        const allInOrder = list.length === all.length && list.every((id, i) => id === all[i].entity_id);
        const ok = await this._ws(this._saveMessage(category, { persons: allInOrder ? [] : list, person_settings: cleaned() }));
        if (ok === null) return false;
        const target = this._values(category);
        target.persons = allInOrder ? [] : list;
        target.person_settings = cleaned();
        // like the server: only what differs from the standard is an own value
        const mine = {};
        if (!same(target.persons, this._standard(category, 'persons'))) mine.persons = target.persons;
        if (!same(target.person_settings, this._standard(category, 'person_settings'))) mine.person_settings = target.person_settings;
        const store = scope === 'own' ? this._data.own : scope === 'user' && this._user ? this._user.own : null;
        if (store) { if (Object.keys(mine).length) store[category] = mine; else delete store[category]; }
        this._refreshFoot(category);
        this._updateSummary(category);
        warn();
        return true;
      };
      const warnBox = document.createElement('div');
      warnBox.className = 'warnung';
      warnBox.hidden = true;
      const nameOf = (id) => (settings[id] && settings[id].name) || personOf(id).name;
      const warn = () => {
        const entries = order.filter((id) => shown.has(id)).map((id) => ({ name: nameOf(id), color: colorOf(id) }));
        const pairs = S.similarColors(entries);
        warnBox.hidden = !pairs.length;
        warnBox.textContent = pairs.length ? t('ed_similar_colors', { pairs: pairs.map((p) => p.join(' / ')).join(', ') }) : '';
      };
      const draw = () => {
        box.innerHTML = '';
        if (!all.length) {
          box.innerHTML = `<p class="kat-text">${esc(t('no_persons_allowed'))}</p>`;
          return;
        }
        box.appendChild(warnBox);
        order.forEach((id, index) => {
          const p = personOf(id);
          const own = settings[id] || {};
          const row = document.createElement('div');
          row.className = `person${shown.has(id) ? '' : ' aus'}`;
          row.style.setProperty('--farbe', colorOf(id));
          const showIn = own.show_in || 'both';
          row.innerHTML = `
            <div class="reihenfolge">
              <button class="knopf rund hoch" title="${esc(t('move_up'))}" aria-label="${esc(t('move_up'))}" ${index === 0 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-up"></ha-icon></button>
              <button class="knopf rund runter" title="${esc(t('move_down'))}" aria-label="${esc(t('move_down'))}" ${index === order.length - 1 || locked ? 'disabled' : ''}><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            </div>
            <div class="bild"></div>
            <div class="mitte">
              <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;flex-wrap:wrap"><label class="chip${shown.has(id) ? ' an' : ''}"><input type="checkbox" class="zeigen"${shown.has(id) ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(p.name)}</label><span class="pmarke"></span></div>
              <div class="felder">
                <input class="ein name" placeholder="${esc(t('ps_name_placeholder', { name: p.name }))}" aria-label="${esc(t('ed_name'))}" value="${esc(own.name || '')}" maxlength="60" ${locked ? 'disabled' : ''}>
                <input class="ein farbe" type="color" aria-label="${esc(t('ed_color'))}" value="${esc(colorOf(id).toLowerCase())}" ${locked ? 'disabled' : ''}>
                <div class="bildwahl">
                  <input class="bildurl" type="hidden" value="${esc(own.picture || '')}">
                  <span class="vorschau" hidden></span>
                  <button class="knopf aendern-bild" type="button" hidden ${locked ? 'disabled' : ''}>${esc(t('picture_change'))}</button>
                  <button class="knopf gefahr entfernen-bild" type="button" hidden ${locked ? 'disabled' : ''}>${esc(t('picture_remove'))}</button>
                  <div class="ablage-klein" role="button" tabindex="0"${locked ? ' aria-disabled="true"' : ''}><ha-icon icon="mdi:image-plus"></ha-icon><span>${esc(t('picture_upload'))}</span></div>
                  <button class="verweis-knopf aus-netz" type="button" ${locked ? 'disabled' : ''}>${esc(t('picture_from_web'))}</button>
                  <input type="file" accept="image/*" hidden>
                </div>
              </div>
              <div class="kontrast" hidden></div>
              <div class="zweite">
                <label>${esc(t('show_in'))}
                  <select class="ein zeigen-in" ${locked ? 'disabled' : ''}>
                    ${['both', 'live', 'history'].map((v) => `<option value="${v}"${showIn === v ? ' selected' : ''}>${esc(t(`show_in_${v}`))}</option>`).join('')}
                  </select></label>
              </div>
            </div>
            <button class="info" type="button" title="${esc(t('more_info'))}" aria-label="${esc(t('more_info'))}" aria-expanded="false"><ha-icon icon="mdi:information-outline"></ha-icon></button>
            <div class="infotext" hidden style="grid-column:1/-1">${rich(t('si_person'))}</div>`;
          const nameInput = row.querySelector('.name');
          const urlInput = row.querySelector('.bildurl');
          const colorInput = row.querySelector('.farbe');
          const showInput = row.querySelector('.zeigen-in');
          const picture = () => {
            const ownUrl = S.safeUrl(urlInput.value.trim());
            const url = ownUrl || S.safeUrl(p.picture);
            const el = row.querySelector('.bild');
            el.style.backgroundImage = url ? `url("${url}")` : '';
            el.textContent = url ? '' : (nameInput.value.trim() || p.name).charAt(0);
            // own picture: preview with "Change" / "Remove"; otherwise the drop field
            const preview = row.querySelector('.vorschau');
            preview.hidden = !ownUrl;
            preview.style.backgroundImage = ownUrl ? `url("${ownUrl}")` : '';
            row.querySelector('.aendern-bild').hidden = !ownUrl;
            row.querySelector('.entfernen-bild').hidden = !ownUrl;
            row.querySelector('.ablage-klein').hidden = Boolean(ownUrl);
            row.querySelector('.aus-netz').hidden = Boolean(ownUrl);
            const note = row.querySelector('.kontrast');
            const text = shown.has(id) ? this._contrastHint(colorInput.value) : '';
            note.hidden = !text;
            note.textContent = text;
          };
          picture();
          // Name, colour, picture and "Show in": one "Save" for the row (or Enter).
          const holder = document.createElement('div');
          holder.style.gridColumn = '1 / -1';
          row.appendChild(holder);
          const read = () => ({
            name: nameInput.value.trim(), color: colorInput.value.toUpperCase(), picture: urlInput.value.trim(), show_in: showInput.value,
          });
          const label = t('draft_person', { name: p.name });
          const savable = this._savable(holder, {
            id: `person:${scope}:${this._user ? this._user.id : ''}:${category}:${id}`,
            label,
            initial: read(),
            draft: { kind: 'person', scope, user: this._user && this._user.id, category, person: id, label },
            save: async (v) => {
              const old = (settings[id] && settings[id].picture) || '';
              settings[id] = { ...settings[id], ...v };
              row.style.setProperty('--farbe', v.color);
              const ok = await save();
              if (ok && old && old !== v.picture) this._deleteImage(old);
              return ok;
            },
          });
          savable.reset = (v) => {
            nameInput.value = v.name; urlInput.value = v.picture; colorInput.value = (v.color || colorOf(id)).toLowerCase();
            showInput.value = v.show_in || 'both';
            row.style.setProperty('--farbe', colorInput.value);
            picture();
          };
          savable.focus = () => nameInput.focus();
          const changed = () => { savable.set(read()); picture(); };
          nameInput.addEventListener('input', changed);
          urlInput.addEventListener('input', changed);
          colorInput.addEventListener('input', () => { row.style.setProperty('--farbe', colorInput.value); changed(); });
          showInput.addEventListener('change', changed);
          [nameInput, urlInput].forEach((input) => input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); savable.save(); }
          }));
          row.querySelector('.zeigen').addEventListener('change', async (e) => {
            if (e.target.checked) shown.add(id); else shown.delete(id);
            row.classList.toggle('aus', !e.target.checked);
            e.target.closest('.chip').classList.toggle('an', e.target.checked);
            await save();
          });
          const file = row.querySelector('input[type="file"]');
          const drop = row.querySelector('.ablage-klein');
          const take = async (blob) => {
            if (!blob || locked) return;
            const cropped = await this._cropImage(blob);
            if (!cropped) return;
            const url = await this._upload(cropped);
            if (!url) return;
            urlInput.value = url;
            changed();
          };
          drop.addEventListener('click', () => { if (!locked) file.click(); });
          drop.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); file.click(); } });
          drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drueber'); });
          drop.addEventListener('dragleave', () => drop.classList.remove('drueber'));
          drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drueber'); take(e.dataTransfer.files[0]); });
          row.querySelector('.aendern-bild').addEventListener('click', () => file.click());
          row.querySelector('.entfernen-bild').addEventListener('click', () => { urlInput.value = ''; changed(); });
          row.querySelector('.aus-netz').addEventListener('click', async () => take(await this._imageFromWeb()));
          file.addEventListener('change', async () => {
            const chosenFile = file.files[0];
            file.value = '';
            if (chosenFile) take(chosenFile);
          });
          // own settings for this person (name, colour, picture, map) or the standard
          const standardAll = this._standard(category, 'person_settings') || {};
          const standardEntry = standardAll[id] || null;
          const before = settings[id] ? JSON.parse(JSON.stringify(settings[id])) : null;
          const ownRow = Boolean(before) && !same(before, standardEntry) && !(scope !== 'defaults' && this._locked(category));
          this._fillMarker(row.querySelector('.pmarke'), {
            undoKey: `${this._scopeKey()}:persons:${id}`,
            own: ownRow && (scope === 'defaults' || Object.prototype.hasOwnProperty.call(this._ownValues(category), 'person_settings')),
            standardText: standardEntry ? t('value_custom') : t('person_standard'),
            back: async () => {
              if (standardEntry) settings[id] = JSON.parse(JSON.stringify(standardEntry)); else delete settings[id];
              return save();
            },
            restore: async () => { settings[id] = before; return save(); },
            redraw: () => this._redrawCategory(category),
          });
          const move = async (delta) => {
            if ([...this._pending.keys()].some((k) => k.startsWith(`person:${scope}:`))) {
              this._toast(t('save_first'), true);
              return;
            }
            const j = index + delta;
            [order[index], order[j]] = [order[j], order[index]];
            draw();
            await save();
          };
          row.querySelector('.hoch').addEventListener('click', () => move(-1));
          row.querySelector('.runter').addEventListener('click', () => move(1));
          this._infoToggle(row);
          box.appendChild(row);
        });
        warn();
        const fake = document.createElement('div');
        this._fieldLockButton(fake, category, ['persons', 'person_settings']);
        const lock = fake.querySelector('.feldschloss');
        if (lock) {
          const line = document.createElement('div');
          line.className = 'zeile breit';
          line.innerHTML = `<div class="beschriftung"><span class="klein">${esc(t('fix_persons_for', { name: this._user.name }))}</span></div>`;
          line.querySelector('.beschriftung').appendChild(lock);
          box.prepend(line);
        }
      };
      draw();
    }

    // Only the small cropped picture (256 × 256) goes to Home Assistant, never the original.
    async _upload(blob) {
      const form = new FormData();
      form.append('file', blob, 'profile.jpg');
      try {
        const response = await this._hass.fetchWithAuth('/api/image/upload', { method: 'POST', body: form });
        if (!response.ok) throw new Error(`${response.status}`);
        const item = await response.json();
        return `/api/image/serve/${item.id}/256x256`;
      } catch (err) {
        this._toast(this._t('upload_failed'), true);
        return null;
      }
    }

    // A replaced or removed picture that was uploaded here is deleted - unless it is still used somewhere.
    async _deleteImage(url) {
      const m = /^\/api\/image\/serve\/([a-z0-9]+)\//.exec(url || '');
      if (!m) return;
      try {
        const { in_use: inUse } = await this._hass.callWS({ type: 'whereabouts/settings/image_in_use', image_id: m[1] });
        if (!inUse) await this._hass.callWS({ type: 'image/delete', image_id: m[1] });
      } catch (err) {
        // not allowed (non-administrators) or already gone: nothing to do
      }
    }

    // "Picture from the internet": Home Assistant loads it once (max. 10 MB, only pictures).
    async _imageFromWeb() {
      const t = this._t;
      const url = await this._dialog(`<h3>${esc(t('picture_from_web'))}</h3><div class="text">${esc(t('picture_from_web_text'))}</div>
        <input class="ein netzadresse" type="url" placeholder="https://…" style="margin-top:12px" autocomplete="off">`, t('picture_load'), false,
      (win) => win.querySelector('.netzadresse').value.trim());
      if (!url) return null;
      if (!/^https?:\/\//i.test(url)) { this._toast(t('picture_bad_url'), true); return null; }
      try {
        const response = await this._hass.fetchWithAuth(`/api/whereabouts/image?url=${encodeURIComponent(url)}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          this._toast(maybe(t, `picture_error_${body.error}`, t('picture_load_failed')), true);
          return null;
        }
        return await response.blob();
      } catch (err) {
        this._toast(t('picture_load_failed'), true);
        return null;
      }
    }

    // Crop window: move and zoom the picture under a round mask; result 256 × 256 JPEG.
    _cropImage(blob) {
      const t = this._t;
      return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onerror = () => { URL.revokeObjectURL(url); this._toast(t('picture_not_image'), true); resolve(null); };
        img.onload = async () => {
          const SIZE = 560; // drawing size of the crop area (shown at 280 px)
          const view = { scale: 1, x: 0, y: 0 };
          const fit = Math.max(SIZE / img.width, SIZE / img.height);
          view.scale = fit;
          view.x = (SIZE - img.width * fit) / 2;
          view.y = (SIZE - img.height * fit) / 2;
          let canvas = null;
          const draw = () => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, view.x, view.y, img.width * view.scale, img.height * view.scale);
          };
          // keep the circle (the whole crop area) covered
          const clamp = () => {
            const w = img.width * view.scale;
            const h = img.height * view.scale;
            const r = SIZE / 2;
            view.x = Math.min(SIZE / 2 - r, Math.max(SIZE / 2 + r - w, view.x));
            view.y = Math.min(SIZE / 2 - r, Math.max(SIZE / 2 + r - h, view.y));
          };
          const zoomTo = (scale, cx = SIZE / 2, cy = SIZE / 2) => {
            const min = SIZE / Math.min(img.width, img.height);
            const next = Math.max(min, Math.min(min * 8, scale));
            view.x = cx - ((cx - view.x) * next) / view.scale;
            view.y = cy - ((cy - view.y) * next) / view.scale;
            view.scale = next;
            clamp();
            draw();
          };
          const minScale = SIZE / Math.min(img.width, img.height);
          const result = this._dialog(`<h3>${esc(t('picture_crop'))}</h3><div class="text">${esc(t('picture_crop_text'))}</div>
            <div class="zuschnitt" style="margin-top:12px"><canvas width="${SIZE}" height="${SIZE}"></canvas><div class="maske"></div></div>
            <div class="zoomzeile"><ha-icon icon="mdi:magnify-minus-outline"></ha-icon><input type="range" class="zoom" min="0" max="100" value="${Math.round(((fit / minScale - 1) / 7) * 100)}" aria-label="${esc(t('picture_zoom'))}"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></div>`,
          t('picture_use'), false, () => {
            const out = document.createElement('canvas');
            out.width = 256;
            out.height = 256;
            const ctx = out.getContext('2d');
            const r = SIZE / 2;
            const factor = 256 / (2 * r);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 256, 256);
            ctx.drawImage(img, (view.x - (SIZE / 2 - r)) * factor, (view.y - (SIZE / 2 - r)) * factor,
              img.width * view.scale * factor, img.height * view.scale * factor);
            return out;
          });
          await new Promise((r) => requestAnimationFrame(r));
          const win = this.querySelector('.dialog .zuschnitt');
          if (win) {
            canvas = win.querySelector('canvas');
            clamp();
            draw();
            const ratio = () => SIZE / win.clientWidth;
            let drag = null;
            win.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; win.setPointerCapture(e.pointerId); });
            win.addEventListener('pointermove', (e) => {
              if (!drag) return;
              view.x += (e.clientX - drag.x) * ratio();
              view.y += (e.clientY - drag.y) * ratio();
              drag = { x: e.clientX, y: e.clientY };
              clamp();
              draw();
            });
            win.addEventListener('pointerup', () => { drag = null; });
            win.addEventListener('wheel', (e) => {
              e.preventDefault();
              const rect = win.getBoundingClientRect();
              zoomTo(view.scale * (e.deltaY < 0 ? 1.1 : 0.9), (e.clientX - rect.left) * ratio(), (e.clientY - rect.top) * ratio());
              const slider = this.querySelector('.dialog .zoom');
              if (slider) slider.value = Math.round(((view.scale / minScale - 1) / 7) * 100);
            }, { passive: false });
            const slider = this.querySelector('.dialog .zoom');
            slider.addEventListener('input', () => zoomTo(minScale * (1 + (Number(slider.value) / 100) * 7)));
          }
          const out = await result;
          URL.revokeObjectURL(url);
          if (!out) { resolve(null); return; }
          out.toBlob((jpeg) => resolve(jpeg), 'image/jpeg', 0.88);
        };
        img.src = url;
      });
    }
  };
};
