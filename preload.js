const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadItems: () => ipcRenderer.invoke('load-items'),
  saveItems: (items) => ipcRenderer.send('save-items', items),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  searchItem: (itemId) => ipcRenderer.send('search-item', itemId),
  hideWindow: () => ipcRenderer.send('hide-window'),
  onItemsUpdated: (callback) =>
    ipcRenderer.on('items-updated', (_event, payload) => callback(payload))
})
