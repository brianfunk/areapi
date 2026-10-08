import { find, feature, types, TYPE_NAMES, setDataUrl } from './areapi.js';

setDataUrl('data/');

const $ = (s) => document.querySelector(s);
const form = $('#form');
const latEl = $('#lat');
const lonEl = $('#lon');
const results = $('#results');
const apilink = $('#apilink');
const apitext = $('#apitext');

const osmAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const esriAttr = 'Tiles &copy; Esri, Maxar, Earthstar Geographics';
const BASEMAPS = {
  Streets: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: osmAttr, maxzoom: 19, paint: { 'raster-saturation': -0.85, 'raster-contrast': -0.05 } },
  Topo: { tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'], attribution: osmAttr + ', <a href="https://opentopomap.org">OpenTopoMap</a>', maxzoom: 17 },
  Satellite: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: esriAttr, maxzoom: 18 },
};

let saved = null;
try { saved = localStorage.getItem('areapi.basemap'); } catch { /* private mode */ }
let currentBase = BASEMAPS[saved] ? saved : 'Streets';

const style = {
  version: 8,
  sources: Object.fromEntries(Object.entries(BASEMAPS).map(([k, b]) => [k, { type: 'raster', tiles: b.tiles, tileSize: 256, attribution: b.attribution, maxzoom: b.maxzoom }])),
  layers: Object.entries(BASEMAPS).map(([k, b]) => ({ id: k, type: 'raster', source: k, paint: b.paint || {}, layout: { visibility: k === currentBase ? 'visible' : 'none' } })),
};
style.sources.area = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
style.layers.push(
  { id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#d6008f', 'fill-opacity': 0.16 } },
  { id: 'area-casing', type: 'line', source: 'area', paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 }, layout: { 'line-join': 'round' } },
  { id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#d6008f', 'line-width': 2.5 }, layout: { 'line-join': 'round' } },
);

const map = new maplibregl.Map({ container: 'map', style, center: [-96, 38.5], zoom: 3.3, attributionControl: { compact: false } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-left');

// Basemap switcher.
const switcher = document.createElement('div');
switcher.className = 'maplibregl-ctrl basemaps';
switcher.innerHTML = Object.keys(BASEMAPS).map((k) => `<label><input type="radio" name="base" value="${k}" ${k === currentBase ? 'checked' : ''}> ${k}</label>`).join('');
switcher.addEventListener('change', (e) => {
  for (const k of Object.keys(BASEMAPS)) map.setLayoutProperty(k, 'visibility', k === e.target.value ? 'visible' : 'none');
  currentBase = e.target.value;
  try { localStorage.setItem('areapi.basemap', currentBase); } catch { /* ignore */ }
});
map.addControl({ onAdd: () => switcher, onRemove: () => switcher.remove() }, 'top-right');

const ready = new Promise((resolve) => map.on('load', resolve));

let marker = null;
let manifest = null;

map.on('click', (e) => {
  latEl.value = e.lngLat.lat.toFixed(5);
  lonEl.value = e.lngLat.lng.toFixed(5);
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

  await ready;
  if (!marker) marker = new maplibregl.Marker({ color: '#38bdf8' }).setLngLat([lon, lat]).addTo(map);
  else marker.setLngLat([lon, lat]);
  if (pan) map.panTo([lon, lat]);
  map.getSource('area').setData({ type: 'FeatureCollection', features: [] });

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
  status.textContent = r.status === 'OK' ? `${r.areas.length} area${r.areas.length === 1 ? '' : 's'} · ${r.executionTime} ms` : 'No area here (open ocean or outside the United States).';
  results.append(status);
  if (r.status !== 'OK') return;

  for (const a of r.areas) {
    const row = document.createElement('button');
    row.className = 'row';
    row.type = 'button';
    row.setAttribute('aria-pressed', 'false');
    row.innerHTML = `<span class="type">${a.type.toUpperCase()}</span><span class="id">${escape(a.id)}</span><span class="name">${escape(a.name)}</span><span class="sub">${TYPE_NAMES[a.type]} · as of ${(a.asOf || '').slice(0, 4)}</span>`;
    row.addEventListener('click', () => draw(a, row));
    results.append(row);
  }
  draw(r.areas[0], results.querySelector('.row'));
}

async function draw(area, row) {
  for (const el of results.querySelectorAll('.row')) el.setAttribute('aria-pressed', el === row ? 'true' : 'false');
  const f = await feature(area.type, area.id);
  if (!f) return;
  await ready;
  map.getSource('area').setData(f);
  const [minX, minY, maxX, maxY] = f.bbox;
  map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, maxZoom: 9, duration: 700 });
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
