'use strict';

// Package entry point.
// - Development (`npm start`): run zalo_source/ directly (prepare it once with `npm run zalo:prepare`).
// - Installed packages: the package carries only this project's own files. Zalo itself is
//   downloaded from Zalo's official CDN on first launch and assembled under
//   ~/.local/share/zalo-linux/runtime/app (see zalo_runtime.js).

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { app } = require('electron');
const rt = require('./zalo_runtime');

const PKG_ROOT = path.join(__dirname, '..');
const PATCHES_DIR = path.join(PKG_ROOT, 'zalo-patches');
const OVERLAY_DIR = path.join(PKG_ROOT, 'zalo_source');
const SEVEN_ZIP_DIR = process.resourcesPath ? path.join(process.resourcesPath, 'vendor') : null;

function startZalo(appDir) {
  // Zalo's tree lives outside the package, so let it (and its child processes, which
  // inherit the environment) resolve our npm dependencies such as sharp.
  const nm = path.join(PKG_ROOT, 'node_modules');
  process.env.NODE_PATH = [nm, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  Module._initPaths();
  require(path.join(appDir, 'bootstrap.js'));
}

function stampFor(manifest) {
  return { zalo: manifest.zalo_version, installer: manifest.installer.sha256, app: app.getVersion() };
}

// Fast path, synchronous so bootstrap.js still runs before the app is ready.
function preparedAppDir() {
  const manifest = rt.readManifest(PATCHES_DIR);
  const base = rt.runtimeDir();
  const appDir = path.join(base, 'app');
  const stamp = stampFor(manifest);
  if (rt.sameStamp(rt.readStamp(appDir), stamp)) return appDir;

  // This app was updated but Zalo's base version did not change: re-assemble from the cache.
  const officialDir = path.join(base, 'official-' + manifest.zalo_version);
  if (fs.existsSync(path.join(officialDir, '.complete'))) {
    rt.assemble({ officialDir, patchesDir: PATCHES_DIR, overlayDir: OVERLAY_DIR, destDir: appDir, stamp });
    return appDir;
  }
  return null;
}

function relaunch() {
  const opts = { args: process.argv.slice(1) };
  if (process.env.APPIMAGE) opts.execPath = process.env.APPIMAGE;
  app.relaunch(opts);
  app.exit(0);
}

function firstRun() {
  const { BrowserWindow, ipcMain } = require('electron');
  // Keep the setup window's Chromium profile away from Zalo's own data directories.
  app.setPath('userData', path.join(rt.runtimeDir(), '..', 'setup-data'));
  if (!app.requestSingleInstanceLock()) return app.exit(0);

  app.whenReady().then(() => {
    const win = new BrowserWindow({
      width: 460,
      height: 300,
      resizable: false,
      title: 'Zalo Linux',
      autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'setup_preload.js'), contextIsolation: true, sandbox: true }
    });
    win.loadFile(path.join(__dirname, 'setup.html'));
    const send = (msg) => { if (!win.isDestroyed()) win.webContents.send('setup:status', msg); };

    const work = async () => {
      const manifest = rt.readManifest(PATCHES_DIR);
      send({ phase: 'start', version: manifest.zalo_version });
      const base = rt.runtimeDir();
      const officialDir = await rt.ensureOfficial({
        patchesDir: PATCHES_DIR,
        cacheDir: base,
        sevenZipDir: SEVEN_ZIP_DIR,
        onStatus: send
      });
      send({ phase: 'assemble' });
      rt.assemble({
        officialDir,
        patchesDir: PATCHES_DIR,
        overlayDir: OVERLAY_DIR,
        destDir: path.join(base, 'app'),
        stamp: stampFor(manifest)
      });
      send({ phase: 'done' });
      setTimeout(relaunch, 800);
    };

    let running = false;
    const start = () => {
      if (running) return;
      running = true;
      work().catch((e) => {
        running = false;
        console.error('[Setup]', e);
        send({ phase: 'error', message: e.message });
      });
    };
    ipcMain.on('setup:start', start);
    ipcMain.on('setup:retry', start);
    win.on('closed', () => { if (!running) app.quit(); });
  });
}

if (!app.isPackaged && fs.existsSync(path.join(OVERLAY_DIR, 'main-dist', 'main.js'))) {
  startZalo(OVERLAY_DIR);
} else if (!app.isPackaged) {
  console.error('[Zalo Linux] zalo_source/ chưa có mã Zalo. Chạy: npm run zalo:prepare');
  app.exit(1);
} else {
  let appDir = null;
  try {
    appDir = preparedAppDir();
  } catch (e) {
    console.error('[Zalo Linux] Không ghép được ứng dụng, tải lại:', e.message);
  }
  if (appDir) startZalo(appDir);
  else firstRun();
}
