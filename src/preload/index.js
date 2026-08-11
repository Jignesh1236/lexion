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
