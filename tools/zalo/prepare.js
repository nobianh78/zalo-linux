#!/usr/bin/env node
'use strict';
// Development setup: download the official Zalo installer pinned in zalo-patches/manifest.json,
// verify it, and assemble zalo_source/ (official files + our patches; our own files there are kept).
//   npm run zalo:prepare
const path = require('path');
const os = require('os');
const rt = require('../../runtime/zalo_runtime');

const ROOT = path.join(__dirname, '..', '..');
const cacheDir = path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'zalo-linux');

(async () => {
  let last = 0;
  const officialDir = await rt.ensureOfficial({
    patchesDir: path.join(ROOT, 'zalo-patches'),
    cacheDir,
    sevenZipDir: path.join(ROOT, 'build', 'vendor'),
    onStatus: (s) => {
      if (s.phase === 'download') {
        const pct = s.total ? Math.floor((s.done / s.total) * 100) : 0;
        if (pct !== last && pct % 10 === 0) { last = pct; console.log(`download ${pct}%`); }
      } else console.log(s.phase);
    }
  });
  rt.assemble({
    officialDir,
    patchesDir: path.join(ROOT, 'zalo-patches'),
    overlayDir: path.join(ROOT, 'zalo_source'),
    destDir: path.join(ROOT, 'zalo_source'),
    mode: 'dev'
  });
  console.log('zalo_source/ is ready. Run: npm start');
})().catch((e) => {
  console.error('prepare failed:', e.message);
  process.exit(1);
});
