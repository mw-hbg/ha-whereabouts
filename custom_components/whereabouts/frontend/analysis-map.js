// Whereabouts – the circle of the evaluation of a place (0.8.0) on the history card's map.
// pickCircle: tap the map to set the centre, drag the centre to move the circle, drag the handle on its edge
// to change the radius; "Done" ends it. staticCircle: the chosen circle while the window is open.

const RADIUS_MIN = 25;
const RADIUS_MAX = 5000;

const CSS = `
  .wa-an-griff { width: 22px !important; height: 22px !important; margin: -11px 0 0 -11px !important; border-radius: 50%;
                 background: var(--wa-an-farbe); border: 3px solid #fff; box-sizing: border-box; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: move; }
  .wa-an-rand { width: 18px !important; height: 18px !important; margin: -9px 0 0 -9px !important; border-radius: 50%;
                background: #fff; border: 3px solid var(--wa-an-farbe); box-sizing: border-box; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: ew-resize; }
  .wa-an-leiste { position: absolute; z-index: 1000; left: 50%; top: 10px; transform: translateX(-50%); width: max-content; max-width: calc(100% - 20px);
                  box-sizing: border-box; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
                  padding: 8px 10px 8px 14px; border-radius: 18px; font-size: 13px; line-height: 1.3;
                  background: var(--card-background-color, #fff); color: var(--primary-text-color, #222); box-shadow: 0 2px 10px rgba(0,0,0,.3); }
  .wa-an-leiste .text { flex: 1 1 200px; }
  .wa-an-leiste .radius { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .wa-an-leiste button { font: inherit; font-size: 14px; font-weight: 500; padding: 6px 16px; border-radius: 16px; cursor: pointer; border: none;
                         background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }
`;

const colorOf = (el) => getComputedStyle(el).getPropertyValue('--primary-color').trim() || '#03a9f4';

// a point east of the centre at the distance of the radius
const edgeOf = (L, lat, lon, radius) => L.latLng(lat, lon + radius / (111320 * Math.cos((lat * Math.PI) / 180)));

export function staticCircle(map, state) {
  const L = window.L;
  return L.circle([state.lat, state.lon], {
    radius: state.radius,
    color: colorOf(map.getContainer()),
    weight: 2,
    dashArray: '6 6',
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(map);
}

export function pickCircle(card, state, t, esc, done) {
  const L = window.L;
  const map = card._map;
  if (card._tableView) {
    card._tableView = false;
    card._updateView();
  }
  if (!card.querySelector('style.wa-an-css')) {
    const style = document.createElement('style');
    style.className = 'wa-an-css';
    style.textContent = CSS;
    card.appendChild(style);
  }
  const container = map.getContainer();
  const color = colorOf(container);
  container.style.setProperty('--wa-an-farbe', color);
  map.invalidateSize();

  const circle = L.circle([state.lat, state.lon], { radius: state.radius, color, weight: 2, fillOpacity: 0.12, interactive: false }).addTo(map);
  const centre = L.marker([state.lat, state.lon], {
    draggable: true,
    keyboard: false,
    title: t('an_pick_centre'),
    icon: L.divIcon({ className: 'wa-an-griff', iconSize: [22, 22] }),
  }).addTo(map);
  const edge = L.marker(edgeOf(L, state.lat, state.lon, state.radius), {
    draggable: true,
    keyboard: false,
    title: t('an_pick_edge'),
    icon: L.divIcon({ className: 'wa-an-rand', iconSize: [18, 18] }),
  }).addTo(map);

  const bar = document.createElement('div');
  bar.className = 'wa-an-leiste';
  bar.innerHTML = `<span class="text">${esc(t('an_pick_hint'))}</span><span class="radius"></span><button type="button">${esc(t('an_done'))}</button>`;
  container.appendChild(bar);
  L.DomEvent.disableClickPropagation(bar);
  L.DomEvent.disableScrollPropagation(bar);
  const showRadius = () => { bar.querySelector('.radius').textContent = `${state.radius} m`; };
  showRadius();

  const moveTo = (latlng) => {
    state.lat = latlng.lat;
    state.lon = latlng.lng;
    circle.setLatLng(latlng);
    centre.setLatLng(latlng);
    edge.setLatLng(edgeOf(L, state.lat, state.lon, state.radius));
  };
  const click = (e) => moveTo(e.latlng);
  map.on('click', click);
  centre.on('drag', () => moveTo(centre.getLatLng()));
  edge.on('drag', () => {
    state.radius = Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(map.distance([state.lat, state.lon], edge.getLatLng()))));
    circle.setRadius(state.radius);
    showRadius();
  });
  edge.on('dragend', () => edge.setLatLng(edgeOf(L, state.lat, state.lon, state.radius)));

  map.fitBounds(circle.getBounds(), { padding: [60, 60], maxZoom: 17 });

  const finish = () => {
    map.off('click', click);
    document.removeEventListener('keydown', key);
    [circle, centre, edge].forEach((layer) => layer.remove());
    bar.remove();
    done();
  };
  const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter') finish(); };
  document.addEventListener('keydown', key);
  bar.querySelector('button').addEventListener('click', finish);
}
