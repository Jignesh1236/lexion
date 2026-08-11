import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  },
  saveData: (file, data) => ipcRenderer.invoke('app:save-data', file, data),
  loadData: (file) => ipcRenderer.invoke('app:load-data', file)
});

contextBridge.exposeInMainWorld('overlay', {
  setInteractive: (interactive) => ipcRenderer.send('overlay:set-interactive', Boolean(interactive)),
  openMain: () => ipcRenderer.send('app:open-main'),
  sendStatus: (status) => ipcRenderer.send('lexion:status', status),
  onPttToggle: (callback) => {
    ipcRenderer.on('lexion:ptt-toggle', () => callback());
    return () => ipcRenderer.removeAllListeners('lexion:ptt-toggle');
  },
  onApplySettings: (callback) => {
    ipcRenderer.on('lexion:apply-settings', (_event, settings) => callback(settings));
    return () => ipcRenderer.removeAllListeners('lexion:apply-settings');
  }
});

contextBridge.exposeInMainWorld('lexion', {
  toggleOverlay: () => ipcRenderer.send('overlay:toggle-visible'),
  updateHotkeys: (partial) => ipcRenderer.send('app:save-hotkeys', partial),
  onStatus: (callback) => {
    ipcRenderer.on('lexion:status', (_event, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('lexion:status');
  }
});