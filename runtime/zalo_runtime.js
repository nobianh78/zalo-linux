'use strict';

// Builds a runnable Zalo app directory on the user's machine from the official
// Windows installer, so this project never ships Zalo's code itself:
//   1. download ZaloSetup-<version>.exe from Zalo's CDN and verify its SHA-256
//   2. unpack app.asar with 7-Zip and read it with the small asar reader below
//   3. delete the Windows-only binaries, apply our find/replace patches
//      (zalo-patches/), and copy our own files (bootstrap.js, linux_compat, ...) on top
// The pristine extract is cached, so later updates of this app only redo step 3.

// Inside Electron, `fs` treats *.asar paths as virtual directories; original-fs reads them as files.
const fs = (() => {
  try {
    return require('original-fs');
  } catch (e) {
    return require('fs');
  }
})();
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { spawn, spawnSync } = require('child_process');

const STAMP = '.zalo-linux-stamp.json';

function readManifest(patchesDir) {
  return JSON.parse(fs.readFileSync(path.join(patchesDir, 'manifest.json'), 'utf8'));
}

function runtimeDir() {
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'zalo-linux', 'runtime');
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

// ---------------------------------------------------------------- download

function download(url, dest, { sha256, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const get = (u, redirects) => {
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) zalo-linux' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 10) {
          res.resume();
          return get(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} khi tải ${u}`));
        }
        const total = Number(res.headers['content-length']) || 0;
        const hash = crypto.createHash('sha256');
        const tmp = dest + '.part';
        const out = fs.createWriteStream(tmp, { mode: 0o600 });
        let got = 0;
        res.on('data', (chunk) => {
          got += chunk.length;
          hash.update(chunk);
          if (onProgress) onProgress(got, total);
        });
        res.on('error', reject);
        out.on('error', reject);
        res.pipe(out);
        out.on('finish', () => {
          const digest = hash.digest('hex');
          if (sha256 && digest !== sha256) {
            fs.rmSync(tmp, { force: true });
            return reject(new Error(`Sai SHA-256 (nhận ${digest}, cần ${sha256})`));
          }
          fs.renameSync(tmp, dest);
          resolve(dest);
        });
      }).on('error', reject);
    };
    get(url, 0);
  });
}

// ---------------------------------------------------------------- 7-Zip

function find7z(bundledDir) {
  const candidates = [];
  if (bundledDir) candidates.push(path.join(bundledDir, '7zz'));
  for (const name of ['7zz', '7z', '7za']) {
    for (const dir of (process.env.PATH || '/usr/bin:/bin').split(':')) candidates.push(path.join(dir, name));
  }
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return path.resolve(c);
    } catch (e) { }
  }
  return null;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} lỗi (${code}): ${err.trim().slice(0, 300)}`))));
  });
}

// The NSIS installer wraps a 7z archive ($PLUGINSDIR/app-32.7z or app-64.7z) that holds the app.
// 7-Zip 2x opens the NSIS layer; old p7zip (16.02) jumps straight into the embedded 7z.
async function extractInstaller(sevenZip, exe, work, zaloVersion) {
  fs.mkdirSync(work, { recursive: true });
  const root = `Zalo-${zaloVersion}/resources`;
  const wanted = [`${root}/app.asar`, `${root}/app.asar.unpacked`];
  try {
    await run(sevenZip, ['e', '-y', exe, '$PLUGINSDIR/app-*.7z'], work);
  } catch (e) { /* p7zip: no NSIS layer, handled below */ }
  const inner = fs.readdirSync(work).find((f) => /^app-(32|64)\.7z$/.test(f));
  if (inner) {
    await run(sevenZip, ['x', '-y', inner, ...wanted, '-r'], work);
    fs.rmSync(path.join(work, inner), { force: true });
  } else {
    await run(sevenZip, ['x', '-y', exe, ...wanted, '-r'], work);
  }
  const asar = path.join(work, root, 'app.asar');
  if (!fs.existsSync(asar)) throw new Error('Không tách được app.asar từ bộ cài Zalo');
  return asar;
}

// ---------------------------------------------------------------- asar

function extractAsar(asarPath, dest) {
  const fd = fs.openSync(asarPath, 'r');
  try {
    const sizeBuf = Buffer.alloc(8);
    fs.readSync(fd, sizeBuf, 0, 8, 0);
    const headerSize = sizeBuf.readUInt32LE(4);
    const headerBuf = Buffer.alloc(headerSize);
    fs.readSync(fd, headerBuf, 0, headerSize, 8);
    const jsonLen = headerBuf.readUInt32LE(4);
    const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + jsonLen));
    const base = 8 + headerSize;
    const unpackedRoot = asarPath + '.unpacked';
    const chunk = Buffer.alloc(1 << 20);

    const walk = (node, rel) => {
      const target = path.join(dest, rel);
      if (!target.startsWith(dest)) throw new Error('Đường dẫn không hợp lệ trong asar: ' + rel);
      if (node.files) {
        fs.mkdirSync(target, { recursive: true });
        for (const name of Object.keys(node.files)) {
          if (name.includes('/') || name === '..' || name === '.') throw new Error('Tên không hợp lệ trong asar: ' + name);
          walk(node.files[name], rel ? rel + '/' + name : name);
        }
        return;
      }
      if (node.link) return; // Zalo's asar has no symlinks; ignore rather than follow
      if (node.unpacked) {
        fs.copyFileSync(path.join(unpackedRoot, rel), target);
      } else {
        const out = fs.openSync(target, 'w');
        try {
          let left = node.size;
          let pos = base + Number(node.offset);
          while (left > 0) {
            const n = fs.readSync(fd, chunk, 0, Math.min(chunk.length, left), pos);
            if (n <= 0) throw new Error('asar bị cắt cụt');
            fs.writeSync(out, chunk, 0, n);
            left -= n;
            pos += n;
          }
        } finally {
          fs.closeSync(out);
        }
      }
      if (node.executable) fs.chmodSync(target, 0o755);
    };
    fs.mkdirSync(dest, { recursive: true });
    walk(header, '');
  } finally {
    fs.closeSync(fd);
  }
}

// ---------------------------------------------------------------- assemble

function copyTree(src, dest, { link = false, skip = () => false } = {}, rel = '') {
  const s = path.join(src, rel);
  const st = fs.lstatSync(s);
  if (skip(rel)) return;
  const d = path.join(dest, rel);
  if (st.isDirectory()) {
    fs.mkdirSync(d, { recursive: true });
    for (const name of fs.readdirSync(s)) copyTree(src, dest, { link, skip }, rel ? path.join(rel, name) : name);
    return;
  }
  fs.rmSync(d, { force: true });
  if (link) {
    try {
      fs.linkSync(s, d);
      return;
    } catch (e) { /* different filesystem: copy */ }
  }
  fs.copyFileSync(s, d);
  fs.chmodSync(d, st.mode & 0o777);
}

function applyPatches(appDir, patchesDir, manifest) {
  for (const rel of manifest.patched) {
    const spec = JSON.parse(fs.readFileSync(path.join(patchesDir, 'files', rel + '.json'), 'utf8'));
    const file = path.join(appDir, rel);
    const before = fs.readFileSync(file);
    const baseSha = crypto.createHash('sha256').update(before).digest('hex');
    if (baseSha !== spec.base_sha256) throw new Error(`File gốc khác bản đã biết: ${rel}`);
    let text = before.toString('utf8');
    for (const edit of spec.edits) {
      const at = text.indexOf(edit.find);
      if (at < 0 || text.indexOf(edit.find, at + 1) >= 0) throw new Error(`Không áp được patch vào ${rel}`);
      text = text.slice(0, at) + edit.replace + text.slice(at + edit.find.length);
    }
    const after = Buffer.from(text, 'utf8');
    if (crypto.createHash('sha256').update(after).digest('hex') !== spec.result_sha256) {
      throw new Error(`Patch cho ra kết quả sai: ${rel}`);
    }
    // Unlink first: the file may be a hard link into the pristine cache.
    const mode = fs.statSync(file).mode & 0o777;
    fs.rmSync(file);
    fs.writeFileSync(file, after, { mode });
  }
}

function removeWindowsFiles(appDir, manifest) {
  for (const rel of manifest.remove) fs.rmSync(path.join(appDir, rel), { recursive: true, force: true });
}

/**
 * Assemble destDir from the pristine official tree, our patches and our overlay files.
 * mode 'runtime': destDir is rebuilt from scratch, official files are hard-linked.
 * mode 'dev': destDir is the repo's zalo_source; overlay files there are kept as they are.
 */
function assemble({ officialDir, patchesDir, overlayDir, destDir, mode = 'runtime', stamp }) {
  const manifest = readManifest(patchesDir);
  const isOverlay = (rel) => manifest.overlay.some((o) => rel === o || rel.startsWith(o + path.sep));
  const isMarker = (rel) => rel === '.complete';

  if (mode === 'runtime') {
    const tmp = destDir + '.tmp';
    fs.rmSync(tmp, { recursive: true, force: true });
    copyTree(officialDir, tmp, { link: true, skip: isMarker });
    removeWindowsFiles(tmp, manifest);
    applyPatches(tmp, patchesDir, manifest);
    for (const o of manifest.overlay) {
      const src = path.join(overlayDir, o);
      if (fs.existsSync(src)) copyTree(overlayDir, tmp, {}, o);
    }
    fs.writeFileSync(path.join(tmp, STAMP), JSON.stringify(stamp || {}, null, 2));
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.renameSync(tmp, destDir);
  } else {
    copyTree(officialDir, destDir, { skip: (rel) => isOverlay(rel) || isMarker(rel) });
    removeWindowsFiles(destDir, manifest);
    applyPatches(destDir, patchesDir, manifest);
  }
  return destDir;
}

function readStamp(appDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(appDir, STAMP), 'utf8'));
  } catch (e) {
    return null;
  }
}

function sameStamp(a, b) {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Download (if needed) and unpack the official installer into cacheDir/official-<version>.
 * Returns the pristine app directory.
 */
async function ensureOfficial({ patchesDir, cacheDir, sevenZipDir, onStatus = () => { } }) {
  const manifest = readManifest(patchesDir);
  const officialDir = path.join(cacheDir, 'official-' + manifest.zalo_version);
  if (fs.existsSync(path.join(officialDir, '.complete'))) return officialDir;

  const sevenZip = find7z(sevenZipDir);
  if (!sevenZip) throw new Error('Không tìm thấy 7-Zip (7zz/7z) để giải nén bộ cài Zalo');

  fs.mkdirSync(cacheDir, { recursive: true });
  const exe = path.join(cacheDir, path.basename(new URL(manifest.installer.url).pathname));
  if (!fs.existsSync(exe) || sha256File(exe) !== manifest.installer.sha256) {
    onStatus({ phase: 'download', done: 0, total: manifest.installer.size });
    await download(manifest.installer.url, exe, {
      sha256: manifest.installer.sha256,
      onProgress: (done, total) => onStatus({ phase: 'download', done, total: total || manifest.installer.size })
    });
  }

  onStatus({ phase: 'extract' });
  const work = path.join(cacheDir, 'extract-' + manifest.zalo_version);
  fs.rmSync(work, { recursive: true, force: true });
  const asar = await extractInstaller(sevenZip, exe, work, manifest.zalo_version);
  fs.rmSync(officialDir, { recursive: true, force: true });
  extractAsar(asar, officialDir);
  removeWindowsFiles(officialDir, manifest); // ~150 MB of Windows-only binaries we never use
  fs.writeFileSync(path.join(officialDir, '.complete'), manifest.installer.sha256);
  fs.rmSync(work, { recursive: true, force: true });
  fs.rmSync(exe, { force: true });
  return officialDir;
}

module.exports = {
  readManifest,
  runtimeDir,
  sha256File,
  download,
  find7z,
  extractInstaller,
  extractAsar,
  assemble,
  applyPatches,
  readStamp,
  sameStamp,
  ensureOfficial
};
