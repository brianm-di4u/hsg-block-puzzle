#!/usr/bin/env node
// Fast (<1s) deterministic CI contract gate for Thermal Blocks (WF-6 W6-S6-05 / W6-P-N05).
// Wired into `npm run preflight` and `package.json pretest`.
// Usage: node tools/preflight-check.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules, levelKey } from './rules-node.mjs';

const T0 = performance.now();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const failures = [];
const checks = [];

function check(name, fn) {
  const t0 = performance.now();
  const before = failures.length;
  try {
    const detail = fn() || 'ok';
    const ms = (performance.now() - t0).toFixed(0);
    const ok = failures.length === before;
    checks.push({ name, ok, ms, detail });
  } catch (err) {
    failures.push(`[${name}] threw: ${err && err.message ? err.message : err}`);
    checks.push({ name, ok: false, ms: (performance.now() - t0).toFixed(0), detail: 'threw' });
  }
}

function fail(scope, msg) {
  failures.push(`[${scope}] ${msg}`);
}

const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const R = loadRules(htmlPath);

function parseHex(h) {
  const s = h.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
}
function relLum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function wcagRatio(rgbA, rgbB) {
  const l1 = relLum(rgbA), l2 = relLum(rgbB);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function blendOver(fg, alpha, bg) {
  return fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));
}
function webpDimensions(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
  if (chunk === 'VP8L' && buf[20] === 0x2f) { const bits = buf.readUInt32LE(21); return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
  if (chunk === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

// 1. 24/24 Spring Trail board-start zero-pre-clear invariant & valid PIECE_IDS
check('trail-invariants', () => {
  if (R.LEVELS.length !== 24) fail('trail-invariants', `expected 24 levels, got ${R.LEVELS.length}`);
  const seen = new Set();
  const pieceSet = new Set(R.PIECE_IDS);
  for (const L of R.LEVELS) {
    if (seen.has(L.id)) fail('trail-invariants', `duplicate level id: ${L.id}`);
    seen.add(L.id);
    const board = R.parseLevel(L);
    if (board.length !== 81) fail('trail-invariants', `${L.id}: board length ${board.length} != 81`);
    const pre = R.findClears(board);
    if (pre.length) fail('trail-invariants', `${L.id}: ${pre.length} board-start pre-clear(s) (${pre.map((g) => g.type + g.i).join(', ')})`);
    if (!Array.isArray(L.pieces) || !L.pieces.length) fail('trail-invariants', `${L.id}: empty pieces list`);
    for (const pid of L.pieces || []) {
      if (!pieceSet.has(pid) || !R.PIECES[pid]) fail('trail-invariants', `${L.id}: unknown piece id "${pid}"`);
    }
  }
  return `${R.LEVELS.length}/24 zero-pre-clear & valid pieces`;
});

// 2. tools/solutions.json key parity & full 24/24 move replay
check('solutions-parity', () => {
  const solPath = path.join(ROOT, 'tools', 'solutions.json');
  const sol = JSON.parse(fs.readFileSync(solPath, 'utf8'));
  let replayed = 0;
  for (const L of R.LEVELS) {
    const rec = sol[L.id];
    if (!rec) { fail('solutions-parity', `${L.id}: missing in tools/solutions.json`); continue; }
    if (rec.key !== levelKey(L)) { fail('solutions-parity', `${L.id}: solutions.json key is stale (run npm run solve:trail)`); continue; }
    if (!Array.isArray(rec.solution) || !rec.solution.length) { fail('solutions-parity', `${L.id}: no solution stored`); continue; }
    const g = R.setupGame(Object.assign(R.freshGame('trail'), { rng: 1 }), { level: L.id });
    for (let step = 0; step < rec.solution.length; step++) {
      const [pid, r, c] = rec.solution[step];
      const slot = g.tray.findIndex((t) => t && t.id === pid);
      if (slot < 0) { fail('solutions-parity', `${L.id}: step ${step} piece "${pid}" missing from tray`); break; }
      const res = R.applyMove(g, slot, r, c);
      if (!res.ok) { fail('solutions-parity', `${L.id}: step ${step} illegal move ${pid}@${r},${c}`); break; }
    }
    if (!g.won) fail('solutions-parity', `${L.id}: stored solution did not win`);
    else replayed++;
  }
  return `${replayed}/24 replayed & won`;
});

// 3. art-src/tile-spec.json <-> art-src/blender/tiles.py <-> index.html (TILE_HEX, TILE_IMG) parity (CD-WF3-07)
check('tile-spec-parity', () => {
  const specPath = path.join(ROOT, 'art-src', 'tile-spec.json');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const expBody = spec.tile_size / spec.ortho_scale;
  const expCy = 0.5 + spec.cam_y / spec.ortho_scale;
  if (Math.abs(spec.body - expBody) > 1e-9) fail('tile-spec-parity', `tile-spec.json body=${spec.body} != tile_size/ortho_scale=${expBody}`);
  if (Math.abs(spec.cy - expCy) > 1e-9) fail('tile-spec-parity', `tile-spec.json cy=${spec.cy} != 0.5+cam_y/ortho_scale=${expCy}`);
  const specHex = [1, 2, 3, 4, 5, 6].map((i) => String(spec.colors?.[`tile-${i}`] || '').toUpperCase());
  for (let i = 0; i < 6; i++) {
    if (!parseHex(specHex[i])) fail('tile-spec-parity', `tile-spec.json invalid color tile-${i + 1}: "${specHex[i]}"`);
  }

  const tilesPy = fs.readFileSync(path.join(ROOT, 'art-src', 'blender', 'tiles.py'), 'utf8');
  if (!tilesPy.includes('tile-spec.json')) fail('tile-spec-parity', 'art-src/blender/tiles.py does not read tile-spec.json');
  if (/^\s*COLORS\s*=\s*\{/m.test(tilesPy)) fail('tile-spec-parity', 'art-src/blender/tiles.py still hardcodes COLORS dict');
  if (/Program Files\\Blender Foundation/i.test(tilesPy)) fail('tile-spec-parity', 'art-src/blender/tiles.py still hardcodes Windows Blender path');
  if (/\bimport\s+bmesh\b/.test(tilesPy)) fail('tile-spec-parity', 'art-src/blender/tiles.py still contains unused import bmesh');

  const hexMatch = html.match(/const\s+TILE_HEX\s*=\s*(\[[^\]]+\])/);
  if (!hexMatch) fail('tile-spec-parity', 'TILE_HEX not found in index.html');
  else {
    const htmlHex = [...hexMatch[1].matchAll(/'(#[0-9a-fA-F]{6})'|"(#[0-9a-fA-F]{6})"/g)].map((m) => (m[1] || m[2]).toUpperCase());
    if (JSON.stringify(htmlHex) !== JSON.stringify(specHex)) {
      fail('tile-spec-parity', `index.html TILE_HEX ${JSON.stringify(htmlHex)} != tile-spec.json ${JSON.stringify(specHex)}`);
    }
  }

  const imgMatch = html.match(/const\s+TILE_IMG\s*=\s*(\{[^}]+\})/);
  if (!imgMatch) fail('tile-spec-parity', 'TILE_IMG not found in index.html');
  else {
    // eslint-disable-next-line no-new-func
    const tileImg = new Function(`return (${imgMatch[1]});`)();
    if (Math.abs(tileImg.body - spec.body) > 1e-9) fail('tile-spec-parity', `index.html TILE_IMG.body=${tileImg.body} != tile-spec.json ${spec.body}`);
    if (Math.abs(tileImg.cy - spec.cy) > 1e-9) fail('tile-spec-parity', `index.html TILE_IMG.cy=${tileImg.cy} != tile-spec.json ${spec.cy}`);
  }
  return '6 glazes + ortho_scale/body/cy synced across tile-spec.json, tiles.py & index.html';
});

// 4. assets/manifest.json <-> disk WebP bytes & dims <-> art-src/art.json <-> index.html ART_FILES
check('manifest-bytes', () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.json'), 'utf8'));
  const artSpec = JSON.parse(fs.readFileSync(path.join(ROOT, 'art-src', 'art.json'), 'utf8'));
  const manKeys = Object.keys(man).sort();
  const specKeys = artSpec.items.map((i) => i.name).sort();
  if (JSON.stringify(manKeys) !== JSON.stringify(specKeys)) {
    fail('manifest-bytes', `manifest.json keys (${manKeys.length}) != art.json items (${specKeys.length})`);
  }
  let totalBytes = 0;
  for (const it of artSpec.items) {
    if (it.name.startsWith('tile-') && it.group !== 'tiles') fail('manifest-bytes', `art.json ${it.name} missing group:"tiles"`);
    if ((it.name.startsWith('era-') || it.name === 'title-hero') && (it.group !== 'backdrops' || it.prebuilt !== true)) {
      fail('manifest-bytes', `art.json ${it.name} must set group:"backdrops" and prebuilt:true (CD-WF3-01)`);
    }
    const entry = man[it.name];
    if (!entry) { fail('manifest-bytes', `${it.name}: missing in assets/manifest.json`); continue; }
    const diskPath = path.join(ROOT, 'assets', entry.file);
    if (!fs.existsSync(diskPath)) { fail('manifest-bytes', `${entry.file}: missing on disk`); continue; }
    const buf = fs.readFileSync(diskPath);
    if (buf.length !== entry.bytes) fail('manifest-bytes', `${entry.file}: disk ${buf.length} B != manifest ${entry.bytes} B`);
    const dim = webpDimensions(buf);
    if (!dim || dim.w !== entry.w || dim.h !== entry.h || dim.w !== it.w || dim.h !== it.h) {
      fail('manifest-bytes', `${entry.file}: WebP dims ${dim ? `${dim.w}x${dim.h}` : 'invalid'} != manifest/spec ${it.w}x${it.h}`);
    }
    totalBytes += buf.length;
  }
  if (totalBytes >= 2.6 * 1024 * 1024) fail('manifest-bytes', `total assets ${(totalBytes / 1048576).toFixed(2)} MB >= 2.6 MB budget`);

  const artFilesMatch = html.match(/const\s+ART_FILES\s*=\s*(\[[\s\S]*?\]);/);
  if (!artFilesMatch) fail('manifest-bytes', 'ART_FILES not found in index.html');
  else {
    const htmlFiles = [...artFilesMatch[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]).sort();
    if (JSON.stringify(htmlFiles) !== JSON.stringify(manKeys)) {
      fail('manifest-bytes', `index.html ART_FILES != assets/manifest.json`);
    }
  }
  return `${manKeys.length} WebPs exact bytes & dims (${(totalBytes / 1048576).toFixed(2)} MB)`;
});

// 5. Embedded vendor/fraunces-5.3.0/*.woff2 exact byte parity
check('woff2-parity', () => {
  const embedded = [...html.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g)].map((m) => Buffer.from(m[1], 'base64'));
  const files = ['fraunces-latin-700-normal.woff2', 'fraunces-latin-900-normal.woff2'];
  if (embedded.length !== files.length) {
    fail('woff2-parity', `expected ${files.length} embedded woff2 fonts in index.html, found ${embedded.length}`);
  }
  let matched = 0;
  for (const f of files) {
    const disk = fs.readFileSync(path.join(ROOT, 'vendor', 'fraunces-5.3.0', f));
    if (!embedded.some((buf) => buf.equals(disk))) fail('woff2-parity', `${f} bytes do not match any embedded @font-face in index.html`);
    else matched++;
  }
  return `${matched}/${files.length} Fraunces WOFF2 exact byte match`;
});

// 6. Canvas font-size floor (>= 12px, PREC-01 / CD-WF5-03) & Canvas WCAG >= 4.5:1 hex-pair math
check('canvas-wcag-floor', () => {
  const capBg = parseHex('#08161A');
  const daylight = parseHex('#D8D4C8');
  const capOverLight = blendOver(capBg, 0.70, daylight);
  const lines = html.split('\n');
  let sizeCount = 0, minSize = Infinity;
  let hexCount = 0, minRatio = Infinity;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    // Static text(..., size, col, ...) calls
    for (const m of line.matchAll(/\btext\([^;\n]*?,\s*[^,\n]+,\s*[^,\n]+,\s*(\d+(?:\.\d+)?)\s*,\s*([^,\n)]+)/g)) {
      const sz = parseFloat(m[1]);
      sizeCount++;
      if (sz < minSize) minSize = sz;
      if (sz < 12) fail('canvas-wcag-floor', `line ${idx + 1}: canvas text() size ${sz}px < 12px floor (PREC-01 / CD-WF5-03)`);
      for (const hm of m[2].matchAll(/['"](#[0-9a-fA-F]{6})['"]/g)) {
        const rgb = parseHex(hm[1]);
        if (!rgb) continue;
        const r = wcagRatio(rgb, capOverLight);
        hexCount++;
        if (r < minRatio) minRatio = r;
        if (r < 4.5) fail('canvas-wcag-floor', `line ${idx + 1}: canvas text hex ${hm[1]} ratio ${r.toFixed(2)}:1 < 4.5:1 on 0.70 dark glass`);
      }
    }
    // Dynamic shrink loops: for (; cfs > N; cfs--) / for (; lfs > N; lfs--)
    for (const fm of line.matchAll(/for\s*\(\s*;\s*[a-zA-Z_]\w*\s*>\s*(\d+(?:\.\d+)?)\s*;\s*[a-zA-Z_]\w*--\s*\)/g)) {
      const floor = parseFloat(fm[1]);
      if (floor < 12) fail('canvas-wcag-floor', `line ${idx + 1}: dynamic canvas text floor ${floor}px < 12px (PREC-01 / CD-WF5-03)`);
    }
  }
  // Check W8 default canvas text/muted tokens too
  const w8Match = html.match(/const\s+W8\s*=\s*\{[\s\S]*?\};/);
  if (w8Match) {
    for (const key of ['text', 'muted']) {
      const km = w8Match[0].match(new RegExp(`\\b${key}\\s*:\\s*['"](#[0-9a-fA-F]{6})['"]`));
      if (km) {
        const r = wcagRatio(parseHex(km[1]), capOverLight);
        hexCount++;
        if (r < minRatio) minRatio = r;
        if (r < 4.5) fail('canvas-wcag-floor', `W8.${key} (${km[1]}) ratio ${r.toFixed(2)}:1 < 4.5:1 on 0.70 dark glass`);
      }
    }
  }
  if (sizeCount < 6) fail('canvas-wcag-floor', `expected >= 6 static canvas text() calls, found ${sizeCount}`);
  return `${sizeCount} text() sizes >= ${minSize}px; ${hexCount} canvas hexes min ${minRatio.toFixed(2)}:1`;
});

// 7. Zero external http(s):// URLs outside SVG XML namespaces (hsar-web #1)
check('zero-external-urls', () => {
  const allowed = new Set(['http://www.w3.org/2000/svg', 'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg', 'http%253A%252F%252Fwww.w3.org%252F2000%252Fsvg']);
  const found = [];
  for (const m of html.matchAll(/(?:https?:\/\/|https?%(?:25)?3A%(?:25)?2F%(?:25)?2F)[^\s'"<>),\\]+/gi)) {
    const url = m[0].replace(/["'\\;.,]+$/, '');
    const decoded = (() => { try { return decodeURIComponent(decodeURIComponent(url)); } catch { return url; } })();
    if (allowed.has(url) || decoded.startsWith('http://www.w3.org/2000/svg')) continue;
    found.push(url);
  }
  if (found.length) fail('zero-external-urls', `disallowed external URL(s) in index.html: ${found.slice(0, 5).join(', ')}`);
  return '0 external URLs (SVG xmlns only)';
});

// 8. Cross-contract CI guardrails (W6-P-N05 PREC-03..05, CD-WF3-07, CD-WF6-02, CD-WF6-05)
check('contract-hygiene', () => {
  // PREC-03 / CD-WF5-05: #cards-era present and not statically hidden
  const cardsEraTag = html.match(/<div[^>]*\bid=["']cards-era["'][^>]*>/);
  if (!cardsEraTag) fail('contract-hygiene', '#cards-era container missing from index.html (PREC-03 / C4-03)');
  else if (/\bhidden\b|display\s*:\s*none/i.test(cardsEraTag[0])) fail('contract-hygiene', '#cards-era must not be statically hidden by default (PREC-03 / CD-WF5-05)');

  // PREC-04 / CD-WF5-02: #toast.above z-index >= 40 and hideToast(force = false)
  const aboveMatches = [...html.matchAll(/#toast\.above\{[^}]*z-index\s*:\s*(\d+)/g)].map((m) => +m[1]);
  if (!aboveMatches.length || Math.max(...aboveMatches) < 40) fail('contract-hygiene', '#toast.above must declare z-index >= 40 (PREC-04 / CD-WF5-02)');
  if (!/function\s+hideToast\(\s*force\s*=\s*false\s*\)/.test(html)) fail('contract-hygiene', 'hideToast(force = false) guard missing (PREC-04 / CD-WF5-02)');

  // PREC-05 / CD-WF6-02: SAVE MERGE CORE + unified savesLocked() + versioned RUN_KEY
  if (!html.includes('// SAVE MERGE CORE') || !html.includes('// END SAVE MERGE CORE')) fail('contract-hygiene', 'SAVE MERGE CORE markers missing (PREC-05 / CD-WF6-02)');
  if (!/function\s+savesLocked\s*\(/.test(html)) fail('contract-hygiene', 'unified savesLocked() missing (CD-WF6-02)');

  // Dead code & VCS hygiene (W6-S6-05 / CD-WF3-07)
  const erasBlock = html.match(/const\s+ERAS\s*=\s*\[[\s\S]*?\];/);
  if (erasBlock && /\bpal\s*:/.test(erasBlock[0])) fail('contract-hygiene', 'dead ERAS[].pal keys still present in index.html');
  if (/for\s*\(\s*let\s+k\s*=\s*1\s*;\s*k\s*<\s*0\s*;/.test(html)) fail('contract-hygiene', 'dead k < 0 loop still present in index.html');
  if (fs.existsSync(path.join(ROOT, '.gitkeep'))) fail('contract-hygiene', 'root .gitkeep should be deleted (W6-S6-05)');

  // CD-WF3-07: zero tracked .blend binaries in git
  if (fs.existsSync(path.join(ROOT, '.git'))) {
    const trackedBlends = execFileSync('git', ['ls-files', '--', '*.blend'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (trackedBlends) fail('contract-hygiene', `generated .blend file(s) tracked in git: ${trackedBlends.split(/\r?\n/).join(', ')}`);
  }

  // CD-WF6-05: active shared/test-harness/smoke/ preserved
  const harnessPkgPath = path.join(ROOT, 'shared', 'test-harness', 'package.json');
  const smokeIndex = path.join(ROOT, 'shared', 'test-harness', 'smoke', 'index.html');
  if (!fs.existsSync(smokeIndex)) fail('contract-hygiene', 'shared/test-harness/smoke/index.html missing (CD-WF6-05)');
  const harnessPkg = fs.existsSync(harnessPkgPath) ? JSON.parse(fs.readFileSync(harnessPkgPath, 'utf8')) : null;
  if (!harnessPkg?.scripts?.smoke) fail('contract-hygiene', 'shared/test-harness/package.json missing scripts.smoke (CD-WF6-05)');

  return 'PREC-03..05, SAVE MERGE CORE, 0 tracked .blend, smoke/ intact';
});

const totalMs = (performance.now() - T0).toFixed(0);
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(20)} ${c.detail} (${c.ms} ms)`);
}
if (failures.length) {
  console.error(`\nPREFLIGHT FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'}, ${totalMs} ms):`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`PREFLIGHT OK (${checks.length}/${checks.length} checks, ${totalMs} ms)`);
