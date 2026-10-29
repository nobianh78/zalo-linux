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

// Set Linux Desktop integration (dock grouping, notifications, frameless & menu cleanup)
try {
  const electron = require('electron');
  if (electron) {
    if (electron.app) {
      electron.app.setName('Zalo');
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
          const url = (w.webContents ? w.webContents.getURL() : '').toLowerCase();
          if (url.includes('sqlite') || url.includes('worker') || url.includes('notification') || url.includes('call_window')) {
            return false;
          }
          const title = (w.getTitle() || '').toLowerCase();
          if (title.includes('sqlite') || title.includes('worker') || title.includes('notification') || title.includes('call_window')) {
            return false;
          }
          const bounds = w.getBounds();
          if (bounds.width < 500 || bounds.height < 400) {
            return false;
          }
          if (w.isMainWindowCandidate === true) {
            return true;
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
            const b = w.getBounds();
            if (url.includes('sqlite') || url.includes('worker') || url.includes('notification') || url.includes('call_window')) continue;
            if (title.includes('sqlite') || title.includes('worker') || title.includes('notification') || title.includes('call_window')) continue;
            if (b.width >= 500 && b.height >= 400) {
              mainAppWindow = w;
              return w;
            }
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
          } else if (normalBounds && normalBounds.width >= 500 && normalBounds.height >= 400) {
            win.setBounds(normalBounds);
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
          try {
            electron.app.emit('activate');
          } catch (e) {}
        } catch (e) {
          console.error('[Bootstrap] Error in restoreMainWindow:', e.message);
        }
      }

      // Handle second instance on Linux: restore ONLY the main window
      electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
        restoreMainWindow();
      });

      electron.app.on('browser-window-created', (event, win) => {
        try {
          win.setMenu(null);
          win.setMenuBarVisibility(false);
          win.autoHideMenuBar = true;
        } catch (e) {}

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
            isClosingWindow = true;
            if (win.isMaximized()) {
              isMaximizedState = true;
            }
            setTimeout(() => { isClosingWindow = false; }, 500);
          }
        });

        try {
          if (win && win.webContents) {
            win.webContents.on('dom-ready', () => {
              try {
                const fs = require('fs');
                const path = require('path');
                const themeCssPath = path.join(__dirname, 'linux_compat', 'tadaza', 'tadaza_theme.css');
                const rendererJsPath = path.join(__dirname, 'linux_compat', 'tadaza', 'tadaza_renderer.js');
                if (fs.existsSync(themeCssPath)) {
                  const css = fs.readFileSync(themeCssPath, 'utf8');
                  win.webContents.insertCSS(css);
                }
                if (fs.existsSync(rendererJsPath)) {
                  const js = fs.readFileSync(rendererJsPath, 'utf8');
                  win.webContents.executeJavaScript(js);
                }
                win.webContents.on('console-message', (event, level, message, line, sourceId) => {
                  console.log(`[Renderer L${level}] ${message}`);
                });
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
  const hasLock = require('electron').app.requestSingleInstanceLock();
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
