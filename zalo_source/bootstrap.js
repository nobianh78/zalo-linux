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
