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
      electron.app.on('browser-window-created', (event, win) => {
        try {
          win.setMenu(null);
          win.setMenuBarVisibility(false);
          win.autoHideMenuBar = true;
        } catch (e) {}

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
