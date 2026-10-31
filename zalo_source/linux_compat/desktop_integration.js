/**
 * Linux desktop integration for Zalo PC.
 *
 *  1. Vietnamese input methods (ibus-bamboo / ibus-unikey / fcitx5-unikey / fcitx5-bamboo)
 *  2. Display backend: X11/XWayland (default) or native Wayland (opt-in), HiDPI scale override,
 *     PipeWire screen capture on Wayland sessions
 *  3. Unread badge on the dock (com.canonical.Unity.LauncherEntry) and on the tray icon
 *
 * applyEarly() MUST run at the very top of bootstrap.js, before the app is ready:
 * GTK reads GTK_IM_MODULE and Chromium reads its switches during startup.
 *
 * Why X11 is the default (verified on Electron 22.3.9 / GNOME 49 Wayland):
 *   - X11/XWayland: GTK loads im-ibus.so / im-fcitx5.so -> Vietnamese typing works.
 *   - Native Wayland: Chromium 108 only speaks zwp_text_input_v1, GNOME/Mutter only offers
 *     zwp_text_input_v3 -> no IME at all. KDE Plasma (KWin) still offers v1, so Wayland mode
 *     with fcitx5 works there.
 *   - app.commandLine.appendSwitch('ozone-platform') is ignored in Electron 22, so Wayland mode
 *     needs a relaunch with the flag on the real command line.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const state = {
  applied: false,
  relaunching: false,
  session: 'unknown',
  desktop: '',
  displayMode: 'x11',
  requestedDisplayMode: 'x11',
  scaleFactor: 0,
  inputMethod: null,
  gtkImModule: null,
  gtkImModuleSource: null,
  gtkImModuleFound: null,
  desktopFileId: null,
  warnings: [],
  badgeCount: 0
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSystemConfig() {
  try {
    const { getConfig } = require('./tadaza/config_manager');
    const cfg = getConfig();
    return (cfg && cfg.system) || {};
  } catch (e) {
    return {};
  }
}

function hasArg(name) {
  return process.argv.some(a => a === name || a.startsWith(name + '='));
}

function isWaylandSession() {
  return (process.env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland' || !!process.env.WAYLAND_DISPLAY;
}

function currentDesktop() {
  // Electron rewrites XDG_CURRENT_DESKTOP to "Unity" and keeps the real value here.
  return (process.env.ORIGINAL_XDG_CURRENT_DESKTOP || process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || '').toLowerCase();
}

/** Names of running processes, read from /proc (no external tools needed). */
function runningProcessNames() {
  const names = new Set();
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        names.add(fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim());
      } catch (e) {}
    }
  } catch (e) {}
  return names;
}

const GTK3_IMMODULE_DIRS = [
  '/usr/lib/x86_64-linux-gnu/gtk-3.0/3.0.0/immodules', // Debian / Ubuntu
  '/usr/lib64/gtk-3.0/3.0.0/immodules',                // Fedora / openSUSE
  '/usr/lib/gtk-3.0/3.0.0/immodules'                   // Arch
];

/** Returns the path of a GTK3 IM module (e.g. 'ibus' -> im-ibus.so), or null. */
function findGtkImModule(name) {
  const files = name === 'fcitx' ? ['im-fcitx5.so', 'im-fcitx.so'] : [`im-${name}.so`];
  for (const dir of GTK3_IMMODULE_DIRS) {
    for (const f of files) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Input method (Vietnamese typing)
// ---------------------------------------------------------------------------

function detectInputMethod() {
  const procs = runningProcessNames();
  if (procs.has('fcitx5') || procs.has('fcitx')) return 'fcitx';
  if (procs.has('ibus-daemon')) return 'ibus';
  const m = (process.env.XMODIFIERS || '').match(/@im=(\w+)/);
  if (m) return m[1].startsWith('fcitx') ? 'fcitx' : m[1];
  return null;
}

function setupInputMethod() {
  const im = detectInputMethod();
  state.inputMethod = im;

  const userModule = process.env.GTK_IM_MODULE;
  if (userModule) {
    // Respect an explicit user choice, but warn when it points to a missing module.
    state.gtkImModule = userModule;
    state.gtkImModuleSource = 'env';
    state.gtkImModuleFound = userModule === 'xim' || userModule === 'wayland' || !!findGtkImModule(userModule.replace(/5$/, ''));
    if (!state.gtkImModuleFound) {
      state.warnings.push(`GTK_IM_MODULE=${userModule} nhưng không tìm thấy module GTK3 tương ứng.`);
    }
    return;
  }

  if (!im) {
    state.gtkImModuleSource = 'none';
    return;
  }

  const modulePath = findGtkImModule(im);
  if (modulePath) {
    process.env.GTK_IM_MODULE = im;
    state.gtkImModule = im;
    state.gtkImModuleFound = true;
  } else {
    // GTK3 frontend package missing (e.g. fcitx5-frontend-gtk3). XIM still works through XWayland.
    process.env.GTK_IM_MODULE = 'xim';
    state.gtkImModule = 'xim';
    state.gtkImModuleFound = false;
    state.warnings.push(im === 'fcitx'
      ? 'Thiếu gói fcitx5-frontend-gtk3 — đang dùng XIM dự phòng, nên cài gói này để gõ ổn định hơn.'
      : 'Thiếu module GTK3 của ibus (gói ibus-gtk3) — đang dùng XIM dự phòng.');
  }
  if (!process.env.XMODIFIERS) {
    process.env.XMODIFIERS = `@im=${im}`;
  }
  state.gtkImModuleSource = 'auto';
}

// ---------------------------------------------------------------------------
// 2. Display backend, HiDPI and screen capture
// ---------------------------------------------------------------------------

function appendFeatures(app, features) {
  const current = (app.commandLine.getSwitchValue('enable-features') || '').split(',').filter(Boolean);
  const merged = Array.from(new Set([...current, ...features]));
  app.commandLine.appendSwitch('enable-features', merged.join(','));
}

/** The command used to relaunch Zalo (AppImage must relaunch the .AppImage file, not the mount). */
function relaunchOptions(extraArgs) {
  const args = process.argv.slice(1).concat(extraArgs || []);
  const opts = { args };
  if (process.env.APPIMAGE) opts.execPath = process.env.APPIMAGE;
  return opts;
}

function setupDisplay(app, sys, isCallDaemon) {
  state.session = isWaylandSession() ? 'wayland' : 'x11';
  state.desktop = currentDesktop();

  const requested = String(process.env.ZALO_DISPLAY || sys.display_mode || 'x11').toLowerCase();
  state.requestedDisplayMode = requested === 'wayland' ? 'wayland' : 'x11';

  const alreadyWayland = process.argv.some(a => a === '--ozone-platform=wayland');
  const wantWayland = state.requestedDisplayMode === 'wayland' && state.session === 'wayland';

  if (wantWayland && !hasArg('--ozone-platform') && !isCallDaemon) {
    app.relaunch(relaunchOptions(['--ozone-platform=wayland', '--enable-wayland-ime']));
    app.exit(0);
    state.relaunching = true;
    return;
  }

  state.displayMode = alreadyWayland ? 'wayland' : 'x11';

  if (state.displayMode === 'wayland') {
    appendFeatures(app, ['WaylandWindowDecorations']);
    if (!state.desktop.includes('kde')) {
      state.warnings.push('Chế độ Wayland gốc: GNOME chỉ hỗ trợ text-input-v3 nên Electron 22 không gõ được tiếng Việt. Hãy chuyển về X11 nếu bộ gõ không hoạt động.');
    }
  } else if (state.requestedDisplayMode === 'wayland' && state.session !== 'wayland') {
    state.warnings.push('Đã chọn Wayland nhưng phiên đăng nhập hiện tại là X11 — đang chạy X11.');
  }

  // Screen sharing on Wayland goes through PipeWire + xdg-desktop-portal.
  // Chromium uses it whenever XDG_SESSION_TYPE=wayland, also when the window itself runs on XWayland.
  if (state.session === 'wayland') {
    appendFeatures(app, ['WebRTCPipeWireCapturer']);
  }

  const scale = Number(process.env.ZALO_SCALE || sys.scale_factor || 0);
  if (scale >= 0.5 && scale <= 4 && !hasArg('--force-device-scale-factor')) {
    app.commandLine.appendSwitch('force-device-scale-factor', String(scale));
    state.scaleFactor = scale;
  }
}

// ---------------------------------------------------------------------------
// 3. Unread badge (dock + tray)
// ---------------------------------------------------------------------------

function applicationDirs() {
  const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const dataDirs = (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':');
  return [dataHome, ...dataDirs].filter(Boolean).map(d => path.join(d, 'applications'));
}

/** Finds the .desktop file that launches this Zalo, so the dock can match the badge. */
function detectDesktopFileId() {
  const needles = [process.env.APPIMAGE, process.execPath, path.join(__dirname, '..', '..', 'start_zalo.sh')]
    .filter(Boolean)
    .map(p => path.resolve(p));
  for (const dir of applicationDirs()) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (e) { continue; }
    for (const f of entries) {
      if (!f.endsWith('.desktop') || !/zalo/i.test(f)) continue;
      try {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        const exec = (text.match(/^Exec=(.*)$/m) || [])[1] || '';
        if (needles.some(n => exec.includes(n))) return f;
      } catch (e) {}
    }
  }
  return process.execPath.startsWith('/opt/Zalo') ? 'zalo-linux.desktop' : 'zalo.desktop';
}

let gdbusMissing = false;
function emitLauncherEntry(count) {
  if (gdbusMissing || !state.desktopFileId) return;
  const args = [
    'emit', '--session',
    '--object-path', '/com/canonical/unity/launcherentry/' + process.pid,
    '--signal', 'com.canonical.Unity.LauncherEntry.Update',
    `'application://${state.desktopFileId}'`,
    `{'count': <int64 ${Math.max(0, count | 0)}>, 'count-visible': <${count > 0 ? 'true' : 'false'}>}`
  ];
  cp.execFile('gdbus', args, { timeout: 2000 }, err => {
    if (err && err.code === 'ENOENT') gdbusMissing = true;
  });
}

// 3x5 pixel font for the tray badge
const GLYPHS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000']
};

function drawBadge(nativeImage, base, count) {
  const { width: w, height: h } = base.getSize();
  if (!w || !h) return base;
  const buf = Buffer.from(base.toBitmap()); // premultiplied BGRA
  // Blend an opaque colour over the pixel with coverage `a` (0..1), premultiplied alpha.
  const put = (x, y, b, g, r, a = 1) => {
    if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
    const i = (y * w + x) * 4;
    const k = Math.min(1, a);
    buf[i] = Math.round(b * k + buf[i] * (1 - k));
    buf[i + 1] = Math.round(g * k + buf[i + 1] * (1 - k));
    buf[i + 2] = Math.round(r * k + buf[i + 2] * (1 - k));
    buf[i + 3] = Math.round(255 * k + buf[i + 3] * (1 - k));
  };
  const radius = w * 0.28;
  const cx = w - radius - 1.5;
  const cy = radius + 1.5;
  for (let y = Math.floor(cy - radius - 2); y <= Math.ceil(cy + radius + 2); y++) {
    for (let x = Math.floor(cx - radius - 2); x <= Math.ceil(cx + radius + 2); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const ring = Math.max(0, Math.min(1, radius + 1.5 - d)); // white outline, anti-aliased
      const fill = Math.max(0, Math.min(1, radius + 0.5 - d));  // red fill, anti-aliased
      if (ring > 0) put(x, y, 0xff, 0xff, 0xff, ring);
      if (fill > 0) put(x, y, 0x30, 0x3b, 0xe5, fill);
    }
  }
  const text = count > 9 ? '9+' : String(count);
  const s = Math.max(1, Math.floor(radius / 4));
  const tw = text.length * 3 * s + (text.length - 1) * s;
  const th = 5 * s;
  let ox = Math.round(cx - tw / 2);
  const oy = Math.round(cy - th / 2);
  for (const ch of text) {
    const g = GLYPHS[ch];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy][gx] !== '1') continue;
        for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) put(ox + gx * s + dx, oy + gy * s + dy, 0xff, 0xff, 0xff);
      }
    }
    ox += 4 * s;
  }
  return nativeImage.createFromBitmap(buf, { width: w, height: h });
}

let trayRef = null;
let trayBaseImage = null;

function updateTray(electron, count) {
  if (!trayRef || trayRef.isDestroyed() || !trayBaseImage) return;
  try {
    trayRef.setImage(count > 0 ? drawBadge(electron.nativeImage, trayBaseImage, count) : trayBaseImage);
    trayRef.setToolTip(count > 0 ? `Zalo — ${count} tin chưa đọc` : 'Zalo');
  } catch (e) {}
}

/**
 * Zalo's bundle loads the tray icon from favicon.ico, which Electron cannot decode on Linux
 * (empty 0x0 image -> invisible tray icon). Serve the PNG next to it instead.
 */
function patchIcoLoading(electron) {
  const ni = electron.nativeImage;
  const orig = ni.createFromPath;
  ni.createFromPath = function (p) {
    if (typeof p === 'string' && /\.ico$/i.test(p)) {
      const png = path.join(path.dirname(p), 'favicon-32x32.png');
      if (fs.existsSync(png)) return orig.call(this, png);
    }
    return orig.call(this, p);
  };
}

/**
 * Electron's Tray methods live on each instance and `electron.Tray` is a non-configurable getter,
 * so we hand Zalo's bundle (main-dist/*) a proxied electron module whose Tray records the instance.
 */
function captureTray(electron) {
  const Module = require('module');
  const mainDist = path.join(__dirname, '..', 'main-dist') + path.sep;
  const RealTray = electron.Tray;
  function TrayCapture(image, guid) {
    const t = guid === undefined ? new RealTray(image) : new RealTray(image, guid);
    trayRef = t;
    trayBaseImage = image && typeof image.isEmpty === 'function' ? image : electron.nativeImage.createFromPath(String(image));
    if (state.badgeCount > 0) setImmediate(() => updateTray(electron, state.badgeCount));
    return t;
  }
  TrayCapture.prototype = RealTray.prototype;
  const proxy = new Proxy(electron, {
    get(target, prop, receiver) {
      if (prop === 'Tray') return TrayCapture;
      return Reflect.get(target, prop, receiver);
    }
  });
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    const result = origLoad.apply(this, arguments);
    if (request === 'electron' && parent && parent.filename && parent.filename.startsWith(mainDist)) {
      return proxy;
    }
    return result;
  };
}

let lastRequestedBadge = 0;

/** Shows `count` on dock + tray, honouring the live `system.unread_badge` setting. */
function showBadge(electron, count) {
  const enabled = readSystemConfig().unread_badge !== false;
  const shown = enabled ? count : 0;
  if (shown === state.badgeCount) return;
  state.badgeCount = shown;
  emitLauncherEntry(shown);
  updateTray(electron, shown);
}

/** Re-apply the badge after the setting is toggled. */
function refreshBadge() {
  try { showBadge(require('electron'), lastRequestedBadge); } catch (e) {}
}

function setupBadge(electron) {
  const { app } = electron;
  state.desktopFileId = detectDesktopFileId();
  if (typeof app.setDesktopName === 'function') app.setDesktopName(state.desktopFileId);

  patchIcoLoading(electron);
  captureTray(electron);

  const origSetBadgeCount = app.setBadgeCount.bind(app);
  app.setBadgeCount = function (count) {
    const n = Math.max(0, Number(count) || 0);
    lastRequestedBadge = n;
    try { origSetBadgeCount(n); } catch (e) {}
    showBadge(electron, n);
    return true;
  };

  app.on('will-quit', () => {
    if (state.badgeCount > 0 && !gdbusMissing && state.desktopFileId) {
      try {
        cp.execFileSync('gdbus', [
          'emit', '--session', '--object-path', '/com/canonical/unity/launcherentry/' + process.pid,
          '--signal', 'com.canonical.Unity.LauncherEntry.Update',
          `'application://${state.desktopFileId}'`, "{'count-visible': <false>}"
        ], { timeout: 1000 });
      } catch (e) {}
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply everything that must happen before app 'ready'.
 * Returns { relaunching: true } when the process is about to restart into Wayland mode.
 */
function applyEarly({ isCallDaemon = false } = {}) {
  if (state.applied || process.platform !== 'linux') return state;
  state.applied = true;

  let electron;
  try { electron = require('electron'); } catch (e) { return state; }
  if (!electron || !electron.app) return state;

  const sys = readSystemConfig();
  try { setupInputMethod(); } catch (e) { console.warn('[Desktop] IME setup failed:', e.message); }
  try { setupDisplay(electron.app, sys, isCallDaemon); } catch (e) { console.warn('[Desktop] Display setup failed:', e.message); }
  if (state.relaunching || isCallDaemon) return state;
  try { setupBadge(electron); } catch (e) { console.warn('[Desktop] Badge setup failed:', e.message); }

  console.log(`[Desktop] session=${state.session} display=${state.displayMode} im=${state.inputMethod || 'none'} ` +
    `GTK_IM_MODULE=${process.env.GTK_IM_MODULE || '(unset)'} desktopFile=${state.desktopFileId}`);
  return state;
}

function getDiagnostics() {
  return {
    session: state.session,
    desktop: state.desktop,
    displayMode: state.displayMode,
    requestedDisplayMode: state.requestedDisplayMode,
    scaleFactor: state.scaleFactor,
    inputMethod: state.inputMethod,
    gtkImModule: state.gtkImModule,
    gtkImModuleSource: state.gtkImModuleSource,
    gtkImModuleFound: state.gtkImModuleFound,
    desktopFileId: state.desktopFileId,
    badgeCount: state.badgeCount,
    pipewireCapture: state.session === 'wayland',
    warnings: state.warnings.slice()
  };
}

/** Restart Zalo (used after changing display mode / scale). */
function relaunchApp() {
  const { app } = require('electron');
  try {
    if (global.zaloAppQuitFlow && typeof global.zaloAppQuitFlow.setAppIsQuitting === 'function') {
      global.zaloAppQuitFlow.setAppIsQuitting();
    }
  } catch (e) {}
  // Drop backend flags so the next start re-reads the config.
  const opts = relaunchOptions();
  opts.args = opts.args.filter(a => !a.startsWith('--ozone-platform') && a !== '--enable-wayland-ime');
  app.relaunch(opts);
  app.quit();
}

module.exports = { applyEarly, getDiagnostics, relaunchApp, refreshBadge, isWaylandSession };
