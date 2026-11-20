// Whereabouts – settings page: zones.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { esc, rich, S } = ctx;

  return class extends Base {
    // --- zones: hide single zones, own colours ------------------------------------------------------
    _zoneList() {
      return (this._data.zones || []).filter((z) => !z.passive);
    }

    // Too little contrast against the light and/or dark map background? Text of the hint, or ''.
    _contrastHint(color) {
      const t = this._t;
      // The maps follow Home Assistant, so both backgrounds count.
      const bad = ['light', 'dark'].filter((m) => S.contrastRatio(color, S.MAP_BACKGROUNDS[m]) < S.MIN_MAP_CONTRAST);
      if (!bad.length) return '';
      return t(bad.length === 2 ? 'contrast_both' : `contrast_${bad[0]}`);
    }

    _zones(category) {
      const t = this._t;
      const locked = this._locked(category) || this._fixedKey(category, 'hidden_zones');
      const values = this._values(category);
      const zones = this._zoneList();
      const hidden = new Set(values.hidden_zones || []);
      const colors = { ...(values.zone_colors || {}) };
      const standardHidden = new Set(this._standard(category, 'hidden_zones') || []);
      const standardColors = this._standard(category, 'zone_colors') || {};
      const base = (id) => (id === 'zone.home' ? values.zone_color_home : values.zone_color);
      const colorOf = (id) => colors[id] || base(id) || '#888888';
      const visible = zones.filter((z) => !hidden.has(z.entity_id));
      const warnings = visible.filter((z) => this._contrastHint(colorOf(z.entity_id))).length;
      const summary = `${t('sum_zone_list', { n: visible.length, of: zones.length, c: zones.filter((z) => colors[z.entity_id]).length })}${warnings ? ` · ${t('sum_contrast', { n: warnings })}` : ''}`;
      const row = document.createElement('div');
      row.className = 'zeile breit';
      row.style.padding = '0';
      const sub = this._subsection('sub_zones', t('sub_zones'), summary, warnings > 0);
      row.appendChild(sub.el);
      sub.inner.innerHTML = `<div class="zeile breit" style="border-top:none"><div class="beschriftung"><span class="klein">${esc(t('zone_list_intro'))}</span>${this._originHtml(category, 'hidden_zones')}
          <button class="info" type="button" aria-expanded="false" aria-label="${esc(t('more_info'))}"><ha-icon icon="mdi:information-outline"></ha-icon></button></div>
        <div class="infotext" hidden>${rich(t('si_zone_list'))}</div>
        <div class="zonen${values.zones_in === 'none' ? ' aus' : ''}">
          ${zones.length ? zones.map((z) => `<div class="zonenzeile" data-zone="${esc(z.entity_id)}">
            <label class="zname"><input type="checkbox" class="zeigen"${hidden.has(z.entity_id) ? '' : ' checked'}${locked ? ' disabled' : ''}>
              <span class="tupfer" style="background:${S.safeColor(colorOf(z.entity_id), '#888')}"></span>${esc(z.name)}</label>
            <span class="zmarke"></span>
            <label class="farbwahl"><input type="checkbox" class="eigen"${colors[z.entity_id] ? ' checked' : ''}${locked ? ' disabled' : ''}>${esc(t('zone_own_color'))}</label>
            <input type="color" class="farbe" value="${esc(colorOf(z.entity_id).toLowerCase())}"${colors[z.entity_id] ? '' : ' hidden'}${locked ? ' disabled' : ''} aria-label="${esc(t('zone_own_color'))}: ${esc(z.name)}">
            <div class="kontrast" hidden style="flex:1 1 100%"></div>
          </div>`).join('') : `<span class="klein">${esc(t('no_zones'))}</span>`}
        </div></div>`;
      this._infoToggle(sub.inner);
      // remove the general marker of the list (single zones have their own)
      const general = sub.inner.querySelector('.marker[data-mk]');
      if (general) general.remove();
      const save = () => this._savePersonal(category, 'hidden_zones', [...hidden])
        .then((ok) => ok && this._savePersonal(category, 'zone_colors', { ...colors }));
      const redraw = () => this._redrawCategory(category);
      row.querySelectorAll('.zonenzeile').forEach((line) => {
        const id = line.dataset.zone;
        const dot = line.querySelector('.tupfer');
        const picker = line.querySelector('.farbe');
        const note = line.querySelector('.kontrast');
        const check = () => {
          const text = hidden.has(id) ? '' : this._contrastHint(colorOf(id));
          note.hidden = !text;
          note.textContent = text;
        };
        check();
        const own = hidden.has(id) !== standardHidden.has(id) || (colors[id] || '') !== (standardColors[id] || '');
        const before = { hidden: hidden.has(id), color: colors[id] };
        const apply = (state) => {
          if (state.hidden) hidden.add(id); else hidden.delete(id);
          if (state.color) colors[id] = state.color; else delete colors[id];
          return save();
        };
        this._fillMarker(line.querySelector('.zmarke'), {
          undoKey: `${this._scopeKey()}:zones:zone:${id}`,
          own,
          standardText: `${standardHidden.has(id) ? t('zone_hidden') : t('zone_shown')}${standardColors[id] ? `, ${standardColors[id]}` : ''}`,
          back: () => apply({ hidden: standardHidden.has(id), color: standardColors[id] }),
          restore: () => apply(before),
          redraw,
        });
        line.querySelector('.zeigen').addEventListener('change', async (e) => {
          if (e.target.checked) hidden.delete(id); else hidden.add(id);
          if (!await this._savePersonal(category, 'hidden_zones', [...hidden])) { e.target.checked = !e.target.checked; return; }
          redraw();
        });
        line.querySelector('.eigen').addEventListener('change', async (e) => {
          if (e.target.checked) colors[id] = picker.value.toUpperCase(); else delete colors[id];
          picker.hidden = !e.target.checked;
          dot.style.background = colorOf(id);
          check();
          await this._savePersonal(category, 'zone_colors', { ...colors });
          redraw();
        });
        picker.addEventListener('input', () => { dot.style.background = picker.value; colors[id] = picker.value.toUpperCase(); check(); });
        picker.addEventListener('change', async () => {
          colors[id] = picker.value.toUpperCase();
          dot.style.background = colors[id];
          await this._savePersonal(category, 'zone_colors', { ...colors });
          redraw();
        });
      });
      return row;
    }
  };
};
