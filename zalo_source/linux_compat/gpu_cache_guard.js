'use strict';
// Chromium keeps compiled GPU shaders in the profile (GPUCache, ShaderCache, ...). After a
// graphics driver or Electron update those blobs can be stale, and Electron 22 then draws the
// whole window as garbled tiles while the app keeps running. Every Chromium app hits this;
// the cure is deleting the caches, which Chromium rebuilds in a second.
//
// We remember a fingerprint of the GPU stack in the profile and clear the caches whenever it
// changes. ZALO_RESET_GPU_CACHE=1 forces a clear; ZALO_DISABLE_GPU=1 turns off hardware
// acceleration entirely (last resort for broken drivers).
const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_DIRS = ['GPUCache', 'ShaderCache', 'GrShaderCache', 'DawnCache'];
const STAMP = '.zalo-linux-gpu-stamp';

const LIB_DIRS = ['/usr/lib/x86_64-linux-gnu', '/usr/lib64', '/usr/lib'];
// Mesa (libgallium-<version>.so since 24.x, DRI drivers before), the GL vendor libraries,
// and NVIDIA's proprietary core library.
const LIB_PATTERN = /^(libgallium|libGLX_mesa|libEGL_mesa|libGLX_nvidia|libnvidia-glcore|libnvidia-eglcore)/;

function statSig(file) {
  try {
    const st = fs.statSync(file);
    return `${file}:${st.size}:${Math.floor(st.mtimeMs)}`;
  } catch (e) {
    return null;
  }
}

function fingerprint(app) {
  const parts = [
    `app=${app.getVersion()}`,
    `electron=${process.versions.electron}`,
    `kernel=${os.release()}`
  ];
  for (const dir of LIB_DIRS) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of names.filter((n) => LIB_PATTERN.test(n)).sort()) {
      const s = statSig(path.join(dir, n));
      if (s) parts.push(s);
    }
    for (const sub of ['dri', 'gbm']) {
      let dri = [];
      try { dri = fs.readdirSync(path.join(dir, sub)); } catch (e) { continue; }
      for (const n of dri.sort()) {
        const s = statSig(path.join(dir, sub, n));
        if (s) parts.push(s);
      }
    }
  }
  try { parts.push('nvidia=' + fs.readFileSync('/proc/driver/nvidia/version', 'utf8').split('\n')[0]); } catch (e) {}
  return parts.join('\n');
}

function clearCaches(userData) {
  const cleared = [];
  for (const d of CACHE_DIRS) {
    const p = path.join(userData, d);
    if (!fs.existsSync(p)) continue;
    try {
      fs.rmSync(p, { recursive: true, force: true });
      cleared.push(d);
    } catch (e) {
      console.warn(`[GPU] Could not remove ${p}: ${e.message}`);
    }
  }
  return cleared;
}

// Call before app 'ready' (the GPU process starts at ready) and after userData is final.
function guard(app) {
  if (process.env.ZALO_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration();
    console.log('[GPU] Hardware acceleration disabled (ZALO_DISABLE_GPU=1)');
  }
  const userData = app.getPath('userData');
  const stampFile = path.join(userData, STAMP);
  const now = fingerprint(app);
  let before = null;
  try { before = fs.readFileSync(stampFile, 'utf8'); } catch (e) {}

  const forced = process.env.ZALO_RESET_GPU_CACHE === '1';
  if (!forced && before === now) return { cleared: [] };

  const cleared = clearCaches(userData);
  try {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(stampFile, now);
  } catch (e) {}
  const why = forced ? 'requested' : before === null ? 'first run with this guard' : 'GPU driver or app changed';
  if (cleared.length) console.log(`[GPU] Cleared ${cleared.join(', ')} (${why})`);
  return { cleared, why };
}

module.exports = { guard, fingerprint };
