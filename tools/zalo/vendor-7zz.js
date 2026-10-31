#!/usr/bin/env node
'use strict';
// Copy a 7-Zip binary into build/vendor/ so packages can unpack the official Zalo installer
// on machines without 7-Zip. Uses the 7zz that electron-builder itself downloads
// (~/.cache/electron-builder/7zip@*/.../bin/7zz), or $ZALO_7ZZ if set.
// 7-Zip is LGPL-2.1 (+ unRAR restriction); its license text is shipped next to it.
const fs = require('fs');
const os = require('os');
const path = require('path');

const out = path.join(__dirname, '..', '..', 'build', 'vendor');

function findCached() {
  const base = path.join(process.env.ELECTRON_BUILDER_CACHE || path.join(os.homedir(), '.cache', 'electron-builder'));
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base).filter((n) => n.startsWith('7zip@')).sort().reverse()) {
    for (const sub of fs.readdirSync(path.join(base, d))) {
      const bin = path.join(base, d, sub, 'bin', '7zz');
      if (fs.existsSync(bin)) return { bin, dir: path.join(base, d, sub) };
    }
  }
  return null;
}

const src = process.env.ZALO_7ZZ ? { bin: process.env.ZALO_7ZZ, dir: path.dirname(path.dirname(process.env.ZALO_7ZZ)) } : findCached();
if (!src) {
  console.error('7zz not found. Run an electron-builder build once (it downloads 7-Zip) or set ZALO_7ZZ=/path/to/7zz');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(src.bin, path.join(out, '7zz'));
fs.chmodSync(path.join(out, '7zz'), 0o755);
for (const lic of ['LICENSE.txt', 'COPYING', 'License.txt']) {
  const p = path.join(src.dir, lic);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(out, '7zz-' + lic));
}
console.log('vendored', src.bin, '->', out);
