const { contextBridge } = require('electron');

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('desktopAPI', {
  version: '1.0.0',
  platform: process.platform,
  isDesktop: true,
});
