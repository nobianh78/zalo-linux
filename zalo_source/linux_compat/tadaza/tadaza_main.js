const { getConfigManager } = require('./config_manager');
const { translateText } = require('./translate_service');
const fs = require('fs');
const path = require('path');

let electron = null;
try {
  electron = require('electron');
} catch (e) {
  // Standalone node environment
}

let isInitialized = false;

function initTadazaMain() {
  if (isInitialized) return;
  isInitialized = true;

  const configManager = getConfigManager();

  if (!electron || !electron.ipcMain) {
    console.warn('[TADaZa Main] Electron ipcMain not available');
    return;
  }

  const { ipcMain, nativeTheme, dialog, BrowserWindow } = electron;

  // Handle get-config
  ipcMain.handle('tadaza:get-config', () => {
    const config = configManager.get();
    const systemIsDark = nativeTheme ? nativeTheme.shouldUseDarkColors : false;
    return {
      ...config,
      _systemIsDark: systemIsDark
    };
  });

  // Handle save-config
  ipcMain.handle('tadaza:save-config', (event, newConfig) => {
    const saved = configManager.save(newConfig);
    const systemIsDark = nativeTheme ? nativeTheme.shouldUseDarkColors : false;
    const payload = {
      ...saved,
      _systemIsDark: systemIsDark
    };

    // Broadcast to all browser windows
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send('tadaza:config-changed', payload);
        }
      }
    } catch (e) {
      console.error('[TADaZa Main] Error broadcasting config:', e.message);
    }

    return payload;
  });

  // Handle translate
  ipcMain.handle('tadaza:translate', async (event, { text, targetLang, sourceLang }) => {
    return await translateText(text, targetLang || 'vi', sourceLang || 'auto');
  });

  // Handle choose-wallpaper
  ipcMain.handle('tadaza:choose-wallpaper', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Chọn hình nền trò chuyện',
        properties: ['openFile'],
        filters: [
          { name: 'Hình ảnh', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
        ]
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
      const fileData = fs.readFileSync(filePath);
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const dataUri = `data:${mime};base64,${fileData.toString('base64')}`;

      return {
        canceled: false,
        dataUri,
        fileName: path.basename(filePath)
      };
    } catch (e) {
      console.error('[TADaZa Main] Wallpaper select error:', e.message);
      return { canceled: true, error: e.message };
    }
  });

  // Handle copy-image directly to system clipboard
  ipcMain.handle('tadaza:copy-image', async (event, dataUri) => {
    try {
      if (!electron.clipboard || !electron.nativeImage) {
        return { success: false, error: 'Clipboard not supported' };
      }
      const img = electron.nativeImage.createFromDataURL(dataUri);
      electron.clipboard.writeImage(img);
      return { success: true };
    } catch (err) {
      console.error('[TADaZa Main] Copy image error:', err);
      return { success: false, error: err.message };
    }
  });

  // Listen to OS Dark Mode changes (GNOME / KDE)
  if (nativeTheme) {
    nativeTheme.on('updated', () => {
      const systemIsDark = nativeTheme.shouldUseDarkColors;
      const config = configManager.get();
      if (config.theme.mode === 'system') {
        const payload = {
          ...config,
          _systemIsDark: systemIsDark
        };
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('tadaza:config-changed', payload);
          }
        }
      }
    });
  }

  // Intercept and block network requests at Electron session level for typing, seen, delivered
  const setupWebRequest = () => {
    try {
      if (electron.session && electron.session.defaultSession && electron.session.defaultSession.webRequest) {
        const filter = {
          urls: [
            '*://*/*typing*',
            '*://*/*seen*',
            '*://*/*delivered*'
          ]
        };
        electron.session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
          try {
            const cfg = configManager.get().privacy || {};
            const url = details.url || '';
            if (cfg.hide_typing && /\/api\/(message|group)\/typing(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked typing:', url);
              return callback({ cancel: true });
            }
            if (cfg.hide_seen && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:seen|seenv2|react_seen)(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked seen:', url);
              return callback({ cancel: true });
            }
            if (cfg.hide_delivered && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:delivered|deliveredv2|react_delivered)(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked delivered:', url);
              return callback({ cancel: true });
            }
          } catch (e) {}
          callback({ cancel: false });
        });
        console.log('[TADaZa Main] WebRequest filter registered for privacy features');
      }
    } catch (e) {
      console.warn('[TADaZa Main] WebRequest filter registration failed:', e.message);
    }
  };

  if (electron.app) {
    if (electron.app.isReady()) {
      setupWebRequest();
    } else {
      electron.app.whenReady().then(setupWebRequest);
    }
  }

  console.log('[TADaZa Main] Initialized successfully');
}

module.exports = {
  initTadazaMain
};
