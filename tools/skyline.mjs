#!/usr/bin/env node
// Builds the Hot Springs Mountain skyline from real terrain (USGS 3DEP, public domain).
//   node tools/skyline.mjs            (fetches the DEM once into art-src/dem/, which is git-ignored)
// Ray-casts a panorama from a viewpoint on Central Avenue's west side, looking east over Bathhouse Row,
// and writes research/skyline.json: per-column elevation angles for three depth bands, plus the
// Mountain Tower (34.51723, -93.04611; 216 ft) bearing and top angle. The game draws its backdrop from it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), GAME = path.resolve(HERE, '..');
const BBOX = [-93.090, 34.470, -92.970, 34.560], SIZE = [480, 360];
const demDir = path.join(GAME, 'art-src', 'dem'), demFile = path.join(demDir, 'hs-3dep.bip');
const url = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?bbox=' + BBOX.join(',') +
  '&bboxSR=4326&imageSR=4326&size=' + SIZE.join(',') + '&format=bip&pixelType=F32&noData=0&interpolation=RSP_BilinearInterpolation&f=image';
if (!fs.existsSync(demFile)) {
  fs.mkdirSync(demDir, { recursive: true });
  const r = await fetch(url); if (!r.ok) throw new Error('DEM fetch ' + r.status);
  fs.writeFileSync(demFile, Buffer.from(await r.arrayBuffer()));
}
const buf = fs.readFileSync(demFile), W = SIZE[0], H = SIZE[1]; // the service appends a trailer after W*H floats
const dem = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + W * H * 4));
const M_LAT = 110950, M_LON = 111320 * Math.cos(34.515 * Math.PI / 180);
function elev(lon, lat) { // bilinear, metres
  const fx = (lon - BBOX[0]) / (BBOX[2] - BBOX[0]) * (W - 1), fy = (BBOX[3] - lat) / (BBOX[3] - BBOX[1]) * (H - 1);
  if (fx < 0 || fy < 0 || fx >= W - 1 || fy >= H - 1) return null;
  const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y, i = y * W + x;
  return dem[i] * (1 - u) * (1 - v) + dem[i + 1] * u * (1 - v) + dem[i + W] * (1 - u) * v + dem[i + W + 1] * u * v;
}
// Viewpoint: west side of Central Ave opposite the Fordyce/Quapaw, eye 60 m above street (an elevated, postcard view).
const VIEW = { lat: 34.5138, lon: -93.0552, eye: 60 };
const TOWER = { lat: 34.51723, lon: -93.04611, h: 65.8 };
const g0 = elev(VIEW.lon, VIEW.lat), eyeZ = g0 + VIEW.eye;
const AZ0 = 40, AZ1 = 140, COLS = 400, BANDS = [[0, 1400], [1400, 3200], [3200, 9000]];
const bands = BANDS.map(() => []);
for (let k = 0; k < COLS; k++) {
  const az = (AZ0 + (AZ1 - AZ0) * k / (COLS - 1)) * Math.PI / 180, dx = Math.sin(az), dy = Math.cos(az);
  const best = BANDS.map(() => -90);
  for (let d = 30; d < 9000; d += 12) {
    const z = elev(VIEW.lon + dx * d / M_LON, VIEW.lat + dy * d / M_LAT); if (z == null) break;
    const ang = Math.atan2(z - eyeZ - d * d / (2 * 6371000) * 0.87, d) * 180 / Math.PI;
    const b = BANDS.findIndex(([a, c]) => d >= a && d < c);
    if (ang > best[b]) best[b] = ang;
  }
  best.forEach((v, b) => bands[b].push(+v.toFixed(3)));
}
const tdx = (TOWER.lon - VIEW.lon) * M_LON, tdy = (TOWER.lat - VIEW.lat) * M_LAT, td = Math.hypot(tdx, tdy);
const tz = elev(TOWER.lon, TOWER.lat);
const tower = { azimuth: +(Math.atan2(tdx, tdy) * 180 / Math.PI).toFixed(2), distM: Math.round(td), groundM: +tz.toFixed(1),
  baseAngle: +(Math.atan2(tz - eyeZ, td) * 180 / Math.PI).toFixed(3), topAngle: +(Math.atan2(tz + TOWER.h - eyeZ, td) * 180 / Math.PI).toFixed(3) };
const out = { source: 'USGS 3D Elevation Program (3DEP) via elevation.nationalmap.gov ImageServer, public domain; bbox ' + BBOX.join(','),
  view: { ...VIEW, groundM: +g0.toFixed(1) }, azimuth: [AZ0, AZ1], columns: COLS, bandsM: BANDS, angles: bands, tower };
fs.writeFileSync(path.join(GAME, 'research', 'skyline.json'), JSON.stringify(out));
const mx = bands.map(b => Math.max(...b).toFixed(2)), mn = bands.map(b => Math.min(...b).toFixed(2));
console.log('DEM', W + 'x' + H, 'view ground', g0.toFixed(1), 'm; band max', mx.join('/'), 'min', mn.join('/'));
console.log('tower', JSON.stringify(tower));
