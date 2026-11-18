// Whereabouts cards – entry point, added to every Home Assistant page by the integration.
//
// All parts are loaded with the same "?v=<version>" as this file, so browsers
// and proxies (e.g. Cloudflare) fetch the new code right after an update.

const query = new URL(import.meta.url).search;
const load = (name) => import(`./${name}${query}`);

(async () => {
  const [S, live, history, editor, download] = await Promise.all([
    load('shared.js'), load('live-card.js'), load('history-card.js'), load('editor.js'), load('download.js'),
  ]);
  editor.defineEditor(S, { live: live.LIVE_DEFAULTS, history: history.HISTORY_DEFAULTS });
  live.defineLiveCard(S);
  history.defineHistoryCard(S, download);

  // Card picker: names in the browser's language (no hass object yet)
  await S.loadTranslations((navigator.language || 'en').split('-')[0]);
  const t = S.translator({ language: (navigator.language || 'en').split('-')[0] });
  window.customCards = window.customCards || [];
  const add = (type, name, description) => {
    if (!window.customCards.some((c) => c.type === type)) {
      window.customCards.push({ type, name, description, preview: false, documentationURL: 'https://github.com/mw-hbg/ha-whereabouts' });
    }
  };
  add('whereabouts-live-card', t('live_title'), 'Whereabouts');
  add('whereabouts-history-card', t('history_title'), 'Whereabouts');
})().catch((err) => console.error('Whereabouts: cards could not be loaded', err));
