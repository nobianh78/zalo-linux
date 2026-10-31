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

    if (newConfig && newConfig.system) {
      try { require('../desktop_integration').refreshBadge(); } catch (e) {}
    }

    return payload;
  });

  // Linux desktop integration: diagnostics (IME / display backend / badge) and restart
  ipcMain.handle('tadaza:linux-diagnostics', () => {
    try {
      return require('../desktop_integration').getDiagnostics();
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('tadaza:relaunch', () => {
    require('../desktop_integration').relaunchApp();
    return true;
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

  // Handle check-for-updates from UI
  ipcMain.handle('tadaza:check-for-updates', async (event, silent = false) => {
    try {
      const { checkForUpdates } = require('../auto_updater');
      return await checkForUpdates(silent);
    } catch (e) {
      console.error('[TADaZa Main] Check update error:', e.message);
      return { error: e.message };
    }
  });

  // Handle perform-update from in-app UI banner
  ipcMain.handle('tadaza:perform-update', async (event, { assetUrl, version }) => {
    try {
      const { performUpdate } = require('../auto_updater');
      return await performUpdate(assetUrl, version);
    } catch (e) {
      console.error('[TADaZa Main] Perform update error:', e.message);
      return { error: e.message };
    }
  });

  // Handle get-app-version
  ipcMain.handle('tadaza:get-app-version', () => {
    try {
      const { getCurrentVersion } = require('../auto_updater');
      return getCurrentVersion();
    } catch (e) {
      return '26.10.13';
    }
  });

  // Handle open external link in default browser
  ipcMain.handle('tadaza:open-external', async (event, url) => {
    try {
      if (electron.shell && url && typeof url === 'string') {
        await electron.shell.openExternal(url);
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      console.error('[TADaZa Main] Open external error:', err);
      return { success: false, error: err.message };
    }
  });

  /* --------------------------------------------------------------------------
     Multi-Account Profiles Management (IPC Handlers)
     -------------------------------------------------------------------------- */
  const {
    getProfilesData,
    getCurrentProfileId,
    createProfile,
    renameProfile,
    updateProfileInfo,
    deleteProfile,
    switchProfile,
    launchDualProfile
  } = require('./profiles_manager');

  ipcMain.handle('tadaza:get-profiles', () => {
    const data = getProfilesData();
    const currentId = getCurrentProfileId();
    return {
      currentProfileId: currentId,
      activeProfile: data.activeProfile || 'default',
      profiles: data.profiles || []
    };
  });

  ipcMain.handle('tadaza:add-profile', (event, { name }) => {
    return createProfile(name);
  });

  ipcMain.handle('tadaza:rename-profile', (event, { profileId, newName }) => {
    return renameProfile(profileId, newName);
  });

  ipcMain.handle('tadaza:update-profile-info', (event, { profileId, name, avatar }) => {
    const targetId = profileId || getCurrentProfileId();
    return updateProfileInfo(targetId, { name, avatar });
  });

  ipcMain.handle('tadaza:delete-profile', (event, { profileId, deleteFiles }) => {
    return deleteProfile(profileId, deleteFiles);
  });

  ipcMain.handle('tadaza:switch-profile', (event, { profileId }) => {
    return switchProfile(profileId);
  });

  ipcMain.handle('tadaza:launch-dual-profile', (event, { profileId }) => {
    return launchDualProfile(profileId);
  });

  /* --------------------------------------------------------------------------
     Floating Chat Heads (PiP Window Management)
     -------------------------------------------------------------------------- */
  const { screen } = electron;
  let chatHeadWindow = null;
  let bubblePosition = null;
  const chatHeadState = {
    pinnedChats: [],
    activeChatId: null,
    mode: 'bubble'
  };

  function broadcastChatHeadSync() {
    if (chatHeadWindow && !chatHeadWindow.isDestroyed() && chatHeadWindow.webContents) {
      chatHeadWindow.webContents.send('tadaza:chathead-sync-data', {
        pinnedChats: chatHeadState.pinnedChats,
        activeChatId: chatHeadState.activeChatId,
        mode: chatHeadState.mode
      });
    }

    // Broadcast state to main windows (so UI buttons can show pinned state)
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (win !== chatHeadWindow && !win.isDestroyed() && win.webContents) {
          win.webContents.send('tadaza:chathead-state-changed', {
            pinnedChats: chatHeadState.pinnedChats.map(c => ({ id: c.id, name: c.name })),
            activeChatId: chatHeadState.activeChatId,
            isOpen: chatHeadWindow && !chatHeadWindow.isDestroyed() && chatHeadWindow.isVisible()
          });
        }
      }
    } catch (e) {}
  }

  function ensureChatHeadWindow() {
    if (chatHeadWindow && !chatHeadWindow.isDestroyed()) {
      if (!chatHeadWindow.isVisible()) {
        chatHeadWindow.show();
      }
      return chatHeadWindow;
    }

    const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
    const workArea = primaryDisplay ? primaryDisplay.workArea : { x: 0, y: 0, width: 1920, height: 1080 };

    if (!bubblePosition) {
      bubblePosition = {
        x: workArea.x + workArea.width - 92,
        y: workArea.y + workArea.height - 200
      };
    }

    chatHeadWindow = new BrowserWindow({
      width: 68,
      height: 68,
      x: bubblePosition.x,
      y: bubblePosition.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'chat_head_preload.js')
      }
    });

    chatHeadWindow.loadFile(path.join(__dirname, 'chat_head.html'));

    chatHeadWindow.once('ready-to-show', () => {
      if (!chatHeadWindow || chatHeadWindow.isDestroyed()) return;
      chatHeadWindow.show();
      broadcastChatHeadSync();
    });

    chatHeadWindow.on('blur', () => {
      try {
        const cfg = configManager.get().floating_chat || {};
        if (cfg.auto_collapse_blur && chatHeadState.mode === 'expanded') {
          setChatHeadMode('bubble');
        }
      } catch (e) {}
    });

    chatHeadWindow.on('closed', () => {
      chatHeadWindow = null;
      chatHeadState.mode = 'bubble';
      broadcastChatHeadSync();
    });

    return chatHeadWindow;
  }

  function setChatHeadMode(targetMode) {
    if (!chatHeadWindow || chatHeadWindow.isDestroyed()) return;
    if (chatHeadState.mode === targetMode) return;

    const [curX, curY] = chatHeadWindow.getPosition();
    const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
    const workArea = primaryDisplay ? primaryDisplay.workArea : { x: 0, y: 0, width: 1920, height: 1080 };

    if (targetMode === 'expanded') {
      bubblePosition = { x: curX, y: curY };
      const targetW = 370;
      const targetH = 520;
      let targetX = curX - (targetW - 68);
      let targetY = curY - (targetH - 68);

      if (targetX < workArea.x + 10) targetX = workArea.x + 10;
      if (targetY < workArea.y + 10) targetY = workArea.y + 10;
      if (targetX + targetW > workArea.x + workArea.width - 10) {
        targetX = workArea.x + workArea.width - targetW - 10;
      }
      if (targetY + targetH > workArea.y + workArea.height - 10) {
        targetY = workArea.y + workArea.height - targetH - 10;
      }

      chatHeadState.mode = 'expanded';
      chatHeadWindow.setBounds({ x: Math.round(targetX), y: Math.round(targetY), width: targetW, height: targetH });
      chatHeadWindow.webContents.send('tadaza:chathead-mode-changed', 'expanded');
      chatHeadWindow.focus();
    } else {
      chatHeadState.mode = 'bubble';
      const bX = bubblePosition ? bubblePosition.x : Math.max(workArea.x, curX);
      const bY = bubblePosition ? bubblePosition.y : Math.max(workArea.y, curY);
      chatHeadWindow.setBounds({ x: Math.round(bX), y: Math.round(bY), width: 68, height: 68 });
      chatHeadWindow.webContents.send('tadaza:chathead-mode-changed', 'bubble');
    }
    broadcastChatHeadSync();
  }

  // Handle get initial state
  ipcMain.handle('tadaza:chathead-get-state', () => {
    return {
      pinnedChats: chatHeadState.pinnedChats,
      activeChatId: chatHeadState.activeChatId,
      mode: chatHeadState.mode
    };
  });

  // Handle pin conversation
  ipcMain.handle('tadaza:chathead-pin', (event, chatData) => {
    if (!chatData || !chatData.id) return { success: false };

    const existingIdx = chatHeadState.pinnedChats.findIndex(c => c.id === chatData.id);
    if (existingIdx >= 0) {
      chatHeadState.pinnedChats[existingIdx] = {
        ...chatHeadState.pinnedChats[existingIdx],
        ...chatData
      };
    } else {
      // Limit to 3 pinned chats
      if (chatHeadState.pinnedChats.length >= 3) {
        chatHeadState.pinnedChats.shift();
      }
      chatHeadState.pinnedChats.push({
        id: chatData.id,
        name: chatData.name || 'Chat',
        avatar: chatData.avatar || '',
        messages: chatData.messages || [],
        unreadCount: 0
      });
    }

    chatHeadState.activeChatId = chatData.id;
    ensureChatHeadWindow();
    broadcastChatHeadSync();
    return { success: true, count: chatHeadState.pinnedChats.length };
  });

  // Handle unpin conversation
  ipcMain.on('tadaza:chathead-unpin', (event, chatId) => {
    chatHeadState.pinnedChats = chatHeadState.pinnedChats.filter(c => c.id !== chatId);
    if (chatHeadState.pinnedChats.length === 0) {
      chatHeadState.activeChatId = null;
      if (chatHeadWindow && !chatHeadWindow.isDestroyed()) {
        chatHeadWindow.hide();
      }
    } else {
      if (chatHeadState.activeChatId === chatId) {
        chatHeadState.activeChatId = chatHeadState.pinnedChats[0].id;
      }
      broadcastChatHeadSync();
    }
  });

  ipcMain.handle('tadaza:chathead-unpin', (event, chatId) => {
    chatHeadState.pinnedChats = chatHeadState.pinnedChats.filter(c => c.id !== chatId);
    if (chatHeadState.pinnedChats.length === 0) {
      chatHeadState.activeChatId = null;
      if (chatHeadWindow && !chatHeadWindow.isDestroyed()) {
        chatHeadWindow.hide();
      }
    } else {
      if (chatHeadState.activeChatId === chatId) {
        chatHeadState.activeChatId = chatHeadState.pinnedChats[0].id;
      }
      broadcastChatHeadSync();
    }
    return { success: true };
  });

  // Handle switch active chat
  ipcMain.on('tadaza:chathead-switch-chat', (event, chatId) => {
    chatHeadState.activeChatId = chatId;
    broadcastChatHeadSync();
  });

  // Handle mode toggle
  ipcMain.on('tadaza:chathead-set-mode', (event, mode) => {
    setChatHeadMode(mode);
  });

  // Handle window movement from client drag
  ipcMain.on('tadaza:chathead-move', (event, { deltaX, deltaY }) => {
    if (!chatHeadWindow || chatHeadWindow.isDestroyed()) return;
    const [x, y] = chatHeadWindow.getPosition();
    const newX = Math.round(x + deltaX);
    const newY = Math.round(y + deltaY);
    chatHeadWindow.setPosition(newX, newY);
    if (chatHeadState.mode === 'bubble') {
      bubblePosition = { x: newX, y: newY };
    }
  });

  // Handle sending message from Chat Head to Main Window
  ipcMain.on('tadaza:chathead-send-message', (event, payload) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win !== chatHeadWindow && !win.isDestroyed() && win.webContents) {
        win.webContents.send('tadaza:chathead-send-to-main', payload);
      }
    }
  });

  // Handle message synchronization from Main Window to Chat Head
  ipcMain.on('tadaza:chathead-sync-from-main', (event, { chatId, messages, unreadCount }) => {
    const chat = chatHeadState.pinnedChats.find(c => c.id === chatId);
    if (chat) {
      if (messages) chat.messages = messages;
      if (typeof unreadCount === 'number') chat.unreadCount = unreadCount;
      if (chatHeadWindow && !chatHeadWindow.isDestroyed() && chatHeadWindow.webContents) {
        chatHeadWindow.webContents.send('tadaza:chathead-sync-data', {
          pinnedChats: chatHeadState.pinnedChats,
          activeChatId: chatHeadState.activeChatId,
          mode: chatHeadState.mode
        });
      }
    }
  });

  // Handle focus main Zalo window
  ipcMain.on('tadaza:chathead-focus-main', () => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win !== chatHeadWindow && !win.isDestroyed()) {
        win.show();
        win.focus();
        break;
      }
    }
  });

  // Handle close window
  ipcMain.on('tadaza:chathead-close', () => {
    if (chatHeadWindow && !chatHeadWindow.isDestroyed()) {
      chatHeadWindow.hide();
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
            const dummyResponse = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ error_code: 0, data: { ok: true }, message: 'Success' }));
            if (cfg.hide_typing && /\/api\/(message|group)\/typing(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked typing:', url);
              return callback({ redirectURL: dummyResponse });
            }
            if (cfg.hide_seen && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:seen|seenv2|react_seen)(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked seen:', url);
              return callback({ redirectURL: dummyResponse });
            }
            if (cfg.hide_delivered && /\/api\/(?:e2ee\/pc\/t\/)?(message|group)\/(?:delivered|deliveredv2|react_delivered)(?:\?|\/|#|$)/i.test(url)) {
              console.log('[TADaZa Main WebRequest] Blocked delivered:', url);
              return callback({ redirectURL: dummyResponse });
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
