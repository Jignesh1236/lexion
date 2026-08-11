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
  setAreas: (areas) => ipcRenderer.send('overlay:set-areas', areas),
  setDrag: (on) => ipcRenderer.send('overlay:set-drag', Boolean(on)),
  forceIgnore: () => ipcRenderer.send('overlay:force-ignore'),
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
  getStatus: () => ipcRenderer.invoke('lexion:get-status'),
  onStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('lexion:status', handler);
    return () => ipcRenderer.off('lexion:status', handler);
  }
});