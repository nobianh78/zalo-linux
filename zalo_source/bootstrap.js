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
      let lastWindowBounds = null;
      let wasMaximized = false;

      function isMainWindow(w) {
        if (!w || w.isDestroyed()) return false;
        try {
          const url = w.webContents ? w.webContents.getURL() : '';
          if (url.includes('sqlite') || url.includes('worker') || url.includes('notification') || url.includes('call_window')) {
            return false;
          }
          const title = (w.getTitle() || '').toLowerCase();
          if (title.includes('sqlite') || title.includes('worker') || title.includes('notification')) {
            return false;
          }
          if (url.includes('index.html') || url.includes('login.html') || url.includes('compact-app.html')) {
            return true;
          }
          if (title === 'zalo' || title.includes('zalo')) {
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
        return null;
      }

      // Handle second instance on Linux: restore ONLY the main window
      electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
        try {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            if (win.isMinimized()) {
              win.restore();
            }
            if (wasMaximized) {
              win.maximize();
            } else if (lastWindowBounds && lastWindowBounds.width > 200 && lastWindowBounds.height > 200) {
              win.setBounds(lastWindowBounds);
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
          }
        } catch (e) {
          console.error('[Bootstrap] Error restoring main window on second-instance:', e.message);
        }
      });

      electron.app.on('browser-window-created', (event, win) => {
        try {
          win.setMenu(null);
          win.setMenuBarVisibility(false);
          win.autoHideMenuBar = true;
        } catch (e) {}

        const updateBounds = () => {
          try {
            if (isMainWindow(win) && win.isVisible()) {
              mainAppWindow = win;
              wasMaximized = win.isMaximized();
              if (!wasMaximized) {
                const b = win.getBounds();
                if (b.width > 200 && b.height > 200) {
                  lastWindowBounds = b;
                }
              }
            }
          } catch (e) {}
        };

        win.on('resize', updateBounds);
        win.on('move', updateBounds);
        win.on('close', updateBounds);
        if (win.webContents) {
          win.webContents.on('did-finish-load', () => {
            if (isMainWindow(win)) {
              mainAppWindow = win;
              updateBounds();
            }
          });
        }

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
		if (require('electron').app.requestSingleInstanceLock()) {
			return handleEntryCompactApp();
		} else {
			require('./main-dist/second-instance');
		}
  }

  if (require('electron').app.requestSingleInstanceLock()) {
    perf.record(perf.MAIN_SCRIPT);
    require('./main-dist/main');
  } else {
    require('./main-dist/second-instance');
  }
}

bootstrap();
