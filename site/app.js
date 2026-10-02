import { find, feature, types, TYPE_NAMES, setDataUrl } from './areapi.js';

setDataUrl('data/');

const $ = (s) => document.querySelector(s);
const form = $('#form');
const latEl = $('#lat');
const lonEl = $('#lon');
const results = $('#results');
const apilink = $('#apilink');
const apitext = $('#apitext');

const map = L.map('map', { worldCopyJump: true }).setView([38.5, -96], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
}).addTo(map);

let marker = null;
let outline = null;
let manifest = null;

map.on('click', (e) => {
  latEl.value = e.latlng.lat.toFixed(5);
  lonEl.value = e.latlng.lng.toFixed(5);
  lookup(false);
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  lookup(true);
});

$('#locate').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition((p) => {
    latEl.value = p.coords.latitude.toFixed(5);
    lonEl.value = p.coords.longitude.toFixed(5);
    lookup(true);
  });
});

async function lookup(pan) {
  const lat = Number(latEl.value);
  const lon = Number(lonEl.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const q = `/api/find?lat=${lat}&lon=${lon}`;
  apilink.href = q;
  apitext.textContent = q;
  history.replaceState(null, '', `?lat=${lat}&lon=${lon}`);

  if (!marker) marker = L.marker([lat, lon]).addTo(map);
  else marker.setLatLng([lat, lon]);
  if (pan) map.panTo([lat, lon]);
  if (outline) { outline.remove(); outline = null; }

  results.innerHTML = '<div class="status">Looking up…</div>';
  try {
    const r = await find({ lat, lon });
    render(r);
  } catch (err) {
    results.innerHTML = `<div class="none">${escape(err.message)}</div>`;
  }
}

function render(r) {
  results.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'status';
  status.textContent = r.status === 'OK' ? `${r.areas.length} area${r.areas.length === 1 ? '' : 's'} · ${r.executionTime} ms` : 'No FCC market area here (ocean, foreign, or Gulf of Mexico).';
  results.append(status);
  if (r.status !== 'OK') return;

  for (const a of r.areas) {
    const row = document.createElement('button');
    row.className = 'row';
    row.type = 'button';
    row.setAttribute('aria-pressed', 'false');
    row.innerHTML = `<span class="type">${a.type.toUpperCase()}</span><span class="id">${escape(a.id)}</span><span class="name">${escape(a.name)}</span><span class="sub">${TYPE_NAMES[a.type]} · ${a.vintage}</span>`;
    row.addEventListener('click', () => draw(a, row));
    results.append(row);
  }
  draw(r.areas[0], results.querySelector('.row'));
}

async function draw(area, row) {
  for (const el of results.querySelectorAll('.row')) el.setAttribute('aria-pressed', el === row ? 'true' : 'false');
  const f = await feature(area.type, area.id);
  if (!f) return;
  if (outline) outline.remove();
  outline = L.geoJSON(f, { style: { color: '#22c55e', weight: 2, fillOpacity: 0.12 } }).addTo(map);
  map.fitBounds(outline.getBounds(), { padding: [24, 24], maxZoom: 9 });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Initial state: ?lat=&lon= in the URL, else the default DC point.
const params = new URLSearchParams(location.search);
if (params.has('lat') && params.has('lon')) {
  latEl.value = params.get('lat');
  lonEl.value = params.get('lon');
}
types().then((m) => (manifest = m));
lookup(true);
