'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  start: () => ipcRenderer.send('setup:start'),
  retry: () => ipcRenderer.send('setup:retry'),
  onStatus: (fn) => ipcRenderer.on('setup:status', (_e, msg) => fn(msg))
});
