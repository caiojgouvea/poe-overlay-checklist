const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadItems: () => ipcRenderer.invoke('load-items'),
  saveItems: (items) => ipcRenderer.send('save-items', items),
  onModeChanged: (callback) =>
    ipcRenderer.on('mode-changed', (_event, interactive) => callback(interactive))
})
