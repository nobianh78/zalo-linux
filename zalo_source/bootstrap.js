// Linux compatibility hook for Windows backslash require paths
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (typeof request === 'string' && request.includes('\\')) {
    request = request.replace(/\\/g, '/');
  }
  return origResolve.call(this, request, parent, isMain, options);
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL UNHANDLED REJECTION in bootstrap]', { reason, promise });
});
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL UNCAUGHT EXCEPTION in bootstrap]', error);
});

// Expose Electron executable for sub-processes (like call daemon runner)
process.env.ZALO_ELECTRON_BIN = process.execPath;
try {
  const fs = require('fs');
  const path = require('path');
  const runner = path.join(__dirname, 'linux_compat', 'zalo_call_runner.sh');
  if (fs.existsSync(runner)) {
    fs.chmodSync(runner, 0o755);
  }
} catch (e) {}

// If invoked as call daemon runner, dispatch immediately without single-instance lock
if (process.argv.some(e => e.startsWith('--launch-call-daemon'))) {
  return require('./linux_compat/call_daemon');
}

// Set Linux Desktop integration (dock grouping, notifications, frameless & menu cleanup)
try {
  const electron = require('electron');
  if (electron) {
    if (electron.app) {
      // Multi-Profile configuration for independent sessions
      try {
        const { getCurrentProfileId, getProfileUserDataDir, getProfilesData } = require('./linux_compat/tadaza/profiles_manager');
        const currentProfile = getCurrentProfileId();
        const profileUserData = getProfileUserDataDir(currentProfile);

        // Ensure user data directory exists
        const fs = require('fs');
        if (!fs.existsSync(profileUserData)) {
          try { fs.mkdirSync(profileUserData, { recursive: true }); } catch (e) {}
        }

        // Hook electron.app.setPath so migration.js or other code cannot overwrite userData back to default ZaloData
        const origSetPath = electron.app.setPath.bind(electron.app);
        electron.app.setPath = function(name, val) {
          if (name === 'userData') {
            const cur = getCurrentProfileId();
            if (cur && cur !== 'default') {
              const expected = getProfileUserDataDir(cur);
              return origSetPath('userData', expected);
            }
          }
          return origSetPath(name, val);
        };

        origSetPath('userData', profileUserData);
        console.log(`[Multi-Profile] Running with profile: "${currentProfile}" (${profileUserData})`);

        if (currentProfile !== 'default') {
          const profilesData = getProfilesData();
          const pObj = (profilesData.profiles || []).find(p => p.id === currentProfile);
          const pName = pObj ? pObj.name : currentProfile;
          electron.app.setName(`Zalo - ${pName}`);
        } else {
          electron.app.setName('Zalo');
        }
      } catch (profErr) {
        console.warn('[Multi-Profile] Error setting profile userData:', profErr.message);
      }

      // Isolate call daemon sockets per profile so multi-instance calls don't conflict
      try {
        const net = require('net');
        const cp = require('child_process');
        const { getCurrentProfileId } = require('./linux_compat/tadaza/profiles_manager');
        const curProfile = getCurrentProfileId();

        if (curProfile && curProfile !== 'default') {
          // Wrap Server.prototype.listen
          const origListen = net.Server.prototype.listen;
          net.Server.prototype.listen = function(...args) {
            if (typeof args[0] === 'string' && (args[0].includes('socketzalorecv') || args[0].includes('socketzalosend'))) {
              args[0] = `${args[0]}_${curProfile}`;
            }
            return origListen.apply(this, args);
          };

          // Wrap Socket.prototype.connect
          const origConnect = net.Socket.prototype.connect;
          net.Socket.prototype.connect = function(...args) {
            if (typeof args[0] === 'string' && (args[0].includes('socketzalorecv') || args[0].includes('socketzalosend'))) {
              args[0] = `${args[0]}_${curProfile}`;
            } else if (args[0] && typeof args[0] === 'object' && typeof args[0].path === 'string' && (args[0].path.includes('socketzalorecv') || args[0].path.includes('socketzalosend'))) {
              args[0].path = `${args[0].path}_${curProfile}`;
            }
            return origConnect.apply(this, args);
          };

          // Wrap cp.spawn so child processes get the profile-specific socket args
          const origSpawn = cp.spawn;
          cp.spawn = function(command, args, options) {
            if (Array.isArray(args)) {
              args = args.map(arg => {
                if (typeof arg === 'string' && (arg.includes('socketzalorecv') || arg.includes('socketzalosend'))) {
                  return `${arg}_${curProfile}`;
                }
                return arg;
              });
            }
            return origSpawn.call(this, command, args, options);
          };
        }
      } catch (sockErr) {
        console.warn('[Multi-Profile] Error setting socket hooks:', sockErr.message);
      }

      if (process.platform === 'linux' && typeof electron.app.setDesktopName === 'function') {
        electron.app.setDesktopName('zalo.desktop');
      }
      let mainAppWindow = null;
      let isMaximizedState = false;
      let normalBounds = { width: 1000, height: 720 };
      let isClosingWindow = false;

      function isMainWindow(w) {
        if (!w || w.isDestroyed()) return false;
        try {
          if (w.isMainWindowCandidate === true) {
            return true;
          }
          const url = (w.webContents ? w.webContents.getURL() : '').toLowerCase();
          if (url.includes('sqlite') || url.includes('worker') || url.includes('notification') || url.includes('call_window')) {
            return false;
          }
          const title = (w.getTitle() || '').toLowerCase();
          if (title.includes('sqlite') || title.includes('worker') || title.includes('notification') || title.includes('call_window')) {
            return false;
          }
          if (url.includes('index.html') || url.includes('login.html') || url.includes('compact-app.html')) {
            return true;
          }
        } catch (e) {}
        return false;
      }

      function getMainWindow() {
        if (mainAppWindow && !mainAppWindow.isDestroyed()) {
          return mainAppWindow;
        }
        const windows = electron.BrowserWindow.getAllWindows();
        for (const w of windows) {
          if (isMainWindow(w)) {
            mainAppWindow = w;
            return w;
          }
        }
        for (const w of windows) {
          if (w.isDestroyed()) continue;
          try {
            const url = (w.webContents ? w.webContents.getURL() : '').toLowerCase();
            const title = (w.getTitle() || '').toLowerCase();
            if (url.includes('sqlite') || url.includes('worker') || url.includes('notification') || url.includes('call_window')) continue;
            if (title.includes('sqlite') || title.includes('worker') || title.includes('notification') || title.includes('call_window')) continue;
            mainAppWindow = w;
            return w;
          } catch (e) {}
        }
        return null;
      }

      function restoreMainWindow() {
        try {
          const win = getMainWindow();
          if (!win || win.isDestroyed()) {
            console.warn('[Bootstrap] No main window found to restore');
            return;
          }
          if (win.isMinimized()) {
            win.restore();
          }
          if (isMaximizedState) {
            win.maximize();
          } else {
            const b = win.getBounds();
            if (b.width < 500 || b.height < 400) {
              win.setBounds(normalBounds || { width: 1000, height: 720 });
            }
          }
          win.setOpacity(1);
          win.show();
          win.setAlwaysOnTop(true);
          win.focus();
          setTimeout(() => {
            if (!win.isDestroyed()) {
              win.setAlwaysOnTop(false);
              win.focus();
            }
          }, 150);
          try {
            win.webContents.send('show-from-tray');
          } catch (e) {}
        } catch (e) {
          console.error('[Bootstrap] Error in restoreMainWindow:', e.message);
        }
      }

      // Handle second instance on Linux: restore ONLY the main window
      electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
        restoreMainWindow();
        try {
          const { checkForUpdates } = require('./linux_compat/auto_updater');
          checkForUpdates(true);
        } catch (e) {}
      });

      electron.app.on('activate', () => {
        restoreMainWindow();
        try {
          const { checkForUpdates } = require('./linux_compat/auto_updater');
          checkForUpdates(true);
        } catch (e) {}
      });

      electron.app.on('browser-window-created', (event, win) => {
        try {
          win.setMenu(null);
          win.setMenuBarVisibility(false);
          win.autoHideMenuBar = true;
        } catch (e) {}

        win.on('page-title-updated', (event, title) => {
          try {
            const { getCurrentProfileId, getProfilesData } = require('./linux_compat/tadaza/profiles_manager');
            const cur = getCurrentProfileId();
            if (cur && cur !== 'default') {
              event.preventDefault();
              const data = getProfilesData();
              const prof = (data.profiles || []).find(p => p.id === cur);
              const label = prof ? prof.name : cur;
              win.setTitle(`${title} [${label}]`);
            }
          } catch (e) {}
        });

        const checkAndMark = () => {
          try {
            if (!win || win.isDestroyed()) return;
            const url = (win.webContents ? win.webContents.getURL() : '').toLowerCase();
            if (url.includes('index.html') || url.includes('login.html') || url.includes('compact-app.html')) {
              win.isMainWindowCandidate = true;
              mainAppWindow = win;
              if (win.isMaximized()) {
                isMaximizedState = true;
              } else {
                const b = win.getBounds();
                if (b.width >= 500 && b.height >= 400) {
                  normalBounds = b;
                }
              }
            }
          } catch (e) {}
        };

        if (win.webContents) {
          win.webContents.on('did-finish-load', checkAndMark);
          win.webContents.on('dom-ready', checkAndMark);
        }
        checkAndMark();

        win.on('maximize', () => {
          if (isMainWindow(win)) {
            isMaximizedState = true;
          }
        });

        win.on('unmaximize', () => {
          if (isMainWindow(win) && !isClosingWindow) {
            isMaximizedState = false;
            const b = win.getBounds();
            if (b.width >= 500 && b.height >= 400) {
              normalBounds = b;
            }
          }
        });

        win.on('resize', () => {
          if (isMainWindow(win) && !win.isMaximized() && !isClosingWindow) {
            const b = win.getBounds();
            if (b.width >= 500 && b.height >= 400) {
              normalBounds = b;
            }
          }
        });

        win.on('close', () => {
          if (isMainWindow(win)) {
            let closeToTray = false;
            try {
              const { getConfig } = require('./linux_compat/tadaza/config_manager');
              const cfg = getConfig();
              if (cfg && cfg.system && cfg.system.close_to_tray === true) {
                closeToTray = true;
              }
            } catch (err) {}

            if (!closeToTray) {
              if (global.zaloAppQuitFlow && typeof global.zaloAppQuitFlow.setAppIsQuitting === 'function') {
                global.zaloAppQuitFlow.setAppIsQuitting();
              }
              setTimeout(() => {
                try {
                  if (electron.app) {
                    electron.app.quit();
                  }
                } catch (e) {}
              }, 50);
            } else {
              isClosingWindow = true;
              if (win.isMaximized()) {
                isMaximizedState = true;
              }
              setTimeout(() => { isClosingWindow = false; }, 500);
            }
          }
        });

        try {
          if (win && win.webContents) {
            win.webContents.on('dom-ready', () => {
              try {
                const fs = require('fs');
                const path = require('path');
                try {
                  const { buildTadaza } = require('./linux_compat/tadaza/build');
                  buildTadaza();
                } catch (bErr) {}
                const themeCssPath = path.join(__dirname, 'linux_compat', 'tadaza', 'tadaza_theme.css');
                const rendererJsPath = path.join(__dirname, 'linux_compat', 'tadaza', 'tadaza_renderer.js');
                win.webContents.on('console-message', (event, level, message, line, sourceId) => {
                  console.log(`[Renderer L${level}] ${message}`);
                });
                if (fs.existsSync(themeCssPath)) {
                  const css = fs.readFileSync(themeCssPath, 'utf8');
                  win.webContents.insertCSS(css);
                }
                if (fs.existsSync(rendererJsPath)) {
                  const js = fs.readFileSync(rendererJsPath, 'utf8');
                  win.webContents.executeJavaScript(js).catch(err => {
                    console.error('[TADaZa Injector] executeJavaScript Error:', err);
                  });
                }
              } catch (err) {
                console.warn('[TADaZa Injector] Injection error:', err.message);
              }
            });
          }
        } catch (e) {}
      });
    }
    if (electron.Menu && typeof electron.Menu.setApplicationMenu === 'function') {
      electron.Menu.setApplicationMenu(null);
    }
  }
} catch (e) {}

const handleEntryCompactApp = () => {
  return require('./main-dist/compact-app');
};

function bootstrap() {
  const isCallDaemon = process.argv.some(e => e.startsWith('--launch-call-daemon'));
  if (isCallDaemon) {
    return require('./linux_compat/call_daemon');
  }

  let profileLockData = {};
  try {
    const { getCurrentProfileId } = require('./linux_compat/tadaza/profiles_manager');
    profileLockData = { profile: getCurrentProfileId() };
  } catch (e) {}

  const hasLock = require('electron').app.requestSingleInstanceLock(profileLockData);
  if (!hasLock) {
    return require('./main-dist/second-instance');
  }

  // Initialize Linux Native Auto-Updater
  try {
    const { initAutoUpdater } = require('./linux_compat/auto_updater');
    initAutoUpdater();
  } catch (e) {
    console.warn('[AutoUpdater] Failed to initialize:', e.message);
  }

  // Initialize TADaZa Extension Main Process
  try {
    const { initTadazaMain } = require('./linux_compat/tadaza/tadaza_main');
    initTadazaMain();
  } catch (e) {
    console.warn('[TADaZa] Failed to initialize main:', e.message);
  }

  require('./libs/perf-tracing/runtime');
  perf.record(perf.STARTUP);
  require('./main-dist/migration');
  perf.record(perf.MIGRATION_DONE);
  
  const isCompactApp = process.argv.some(e => e.startsWith('--launch-compact-app'));

  if (isCompactApp) {
    return handleEntryCompactApp();
  }

  perf.record(perf.MAIN_SCRIPT);
  require('./main-dist/main');
}

bootstrap();
