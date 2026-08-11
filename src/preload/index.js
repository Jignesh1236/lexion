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
  applyAudioDevices: (inputId, outputId) => ipcRenderer.send('overlay:apply-audio-devices', inputId, outputId),
  onApplyAudioDevices: (callback) => {
    const handler = (_event, inputId, outputId) => callback(inputId, outputId);
    ipcRenderer.on('overlay:apply-audio-devices', handler);
    return () => ipcRenderer.off('overlay:apply-audio-devices', handler);
  },
  forceIgnore: () => ipcRenderer.send('overlay:force-ignore'),
  openMain: () => ipcRenderer.send('app:open-main'),
  sendStatus: (status) => ipcRenderer.send('lexion:status', status),
  onPttToggle: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('lexion:ptt-toggle', handler);
    return () => ipcRenderer.off('lexion:ptt-toggle', handler);
  },
  onApplySettings: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('lexion:apply-settings', handler);
    return () => ipcRenderer.off('lexion:apply-settings', handler);
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