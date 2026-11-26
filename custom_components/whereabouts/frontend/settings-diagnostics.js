// Whereabouts – settings page: diagnostics.
// Part of settings-page.js, which loads all parts and puts them together.

export default (ctx, Base) => {
  const { maybe, esc, S } = ctx;

  return class extends Base {
    // --- diagnostics (administrators) ---------------------------------------------------------------------------
    async _loadDiagnostics() {
      const box = this.querySelector('.felder[data-kat="diagnostics"]');
      if (!box || !this._admin) return;
      const t = this._t;
      if (!this._diag) box.innerHTML = `<p class="kat-text">${esc(t('loading'))}</p>`;
      const button = box.querySelector('.diag-neu');
      if (button) button.disabled = true;
      try { this._diag = await this._hass.callWS({ type: 'whereabouts/settings/diagnostics' }); } catch (err) {
        box.innerHTML = `<p class="kat-text schlecht">${esc(t('load_failed'))}</p>`;
        return;
      }
      this._diag.at = new Date();
      this._showDiagnostics();
    }

    _showDiagnostics() {
      const box = this.querySelector('.felder[data-kat="diagnostics"]');
      const diag = this._diag;
      if (!box || !diag) return;
      const t = this._t;
      const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
      box.innerHTML = `<div class="zeile breit" style="border-top:none"><div class="beschriftung" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span class="klein">${esc(t('diag_as_of', { time: S.clock(this._hass, diag.at, true) }))}</span>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            ${diag.entry_id ? `<button class="knopf diag-laden" type="button"><ha-icon icon="mdi:download"></ha-icon>${esc(t('diag_download'))}</button>` : ''}
            <button class="knopf diag-neu" type="button"><ha-icon icon="mdi:refresh"></ha-icon>${esc(t('refresh'))}</button></span></div></div>
        <p class="kat-text klein">${esc(t('diag_download_hint'))}</p>
        ${diag.osm_paused ? `<div class="warnung">${esc(t('osm_paused'))}</div>` : ''}
        <div class="tabellenrahmen"><table class="tabelle"><thead><tr>
          <th>${esc(t('col_person'))}</th><th>${esc(t('diag_trackers'))}</th><th>${esc(t('diag_address'))}</th><th>${esc(t('diag_history'))}</th>
        </tr></thead><tbody>
        ${diag.persons.map((p) => `<tr>
          <td><b>${esc(p.name)}</b><div class="klein">${esc(S.placeText(t, p.state))}${p.source ? ` · ${esc(t('diag_source', { id: p.source }))}` : ''}</div></td>
          <td>${p.trackers.length ? p.trackers.map((tr) => `<div>${esc(tr.name)} <span class="klein">(${esc(maybe(t, `source_${tr.source_type}`, tr.source_type || '?'))}, ${esc(S.placeText(t, tr.state))}${tr.last_updated ? `, ${esc(S.agoText(t, tr.last_updated))}` : ''})</span></div>`).join('') : `<span class="klein">${esc(t('diag_no_trackers'))}</span>`}</td>
          <td>${p.address_sensor_ok ? `<span class="ok">✓</span> <span class="klein">${esc(p.address_sensor)}</span>`
            : `<span class="schlecht">✗</span> <span class="klein">${esc(p.address_sensor ? t('diag_sensor_off', { id: p.address_sensor }) : t('diag_no_sensor'))}</span>`}</td>
          <td>${p.history ? `${esc(t('diag_days', { n: p.history.days, from: p.history.first, to: p.history.last }))}<div class="klein">${esc(kb(p.history.bytes))}${p.recorded ? '' : ` · ${esc(t('diag_not_recorded'))}`}</div>`
            : `<span class="klein">${esc(p.recorded ? t('diag_no_history_yet') : t('diag_not_recorded'))}</span>`}</td>
        </tr>`).join('')}</tbody></table></div>
        <p class="kat-text klein">${esc(t('diag_folder', { folder: diag.folder }))}</p>`;
      box.querySelector('.diag-neu').addEventListener('click', () => this._loadDiagnostics());
      const dl = box.querySelector('.diag-laden');
      if (dl) dl.addEventListener('click', () => this._downloadDiagnostics(dl));
    }

    // The same file as "Download diagnostics" in Devices & services (Home Assistant's own endpoint, admins only)
    async _downloadDiagnostics(button) {
      const t = this._t;
      button.disabled = true;
      try {
        const response = await this._hass.fetchWithAuth(`/api/diagnostics/config_entry/${encodeURIComponent(this._diag.entry_id)}`);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `whereabouts-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      } catch (err) {
        this._toast(t('diag_download_failed'), true);
      } finally {
        button.disabled = false;
      }
    }
  };
};
