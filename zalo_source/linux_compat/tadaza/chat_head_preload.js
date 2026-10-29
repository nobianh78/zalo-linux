const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatHeadBridge', {
  getInitialState: () => ipcRenderer.invoke('tadaza:chathead-get-state'),
  setMode: (mode) => ipcRenderer.send('tadaza:chathead-set-mode', mode),
  sendMessage: (payload) => ipcRenderer.send('tadaza:chathead-send-message', payload),
  unpinChat: (chatId) => ipcRenderer.send('tadaza:chathead-unpin', chatId),
  switchChat: (chatId) => ipcRenderer.send('tadaza:chathead-switch-chat', chatId),
  focusMain: () => ipcRenderer.send('tadaza:chathead-focus-main'),
  closeWindow: () => ipcRenderer.send('tadaza:chathead-close'),
  moveWindow: (delta) => ipcRenderer.send('tadaza:chathead-move', delta),
  onSync: (callback) => {
    ipcRenderer.on('tadaza:chathead-sync-data', (event, data) => {
      if (typeof callback === 'function') callback(data);
    });
  },
  onModeChanged: (callback) => {
    ipcRenderer.on('tadaza:chathead-mode-changed', (event, mode) => {
      if (typeof callback === 'function') callback(mode);
    });
  }
});
