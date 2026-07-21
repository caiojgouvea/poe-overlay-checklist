const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadItems: () => ipcRenderer.invoke('load-items'),
  saveItems: (items) => ipcRenderer.send('save-items', items),
  searchItem: (itemId) => ipcRenderer.send('search-item', itemId),
  hideWindow: () => ipcRenderer.send('hide-window'),
  loadRegexes: () => ipcRenderer.invoke('load-regexes'),
  saveRegexes: (list) => ipcRenderer.send('save-regexes', list),
  searchRegex: (pattern) => ipcRenderer.send('search-regex', pattern),
  loadBuilds: () => ipcRenderer.invoke('load-builds'),
  switchBuild: (buildId) => ipcRenderer.send('switch-build', buildId),
  createBuild: (name) => ipcRenderer.send('create-build', name),
  onItemsUpdated: (callback) =>
    ipcRenderer.on('items-updated', (_event, payload) => callback(payload)),
  onBuildsUpdated: (callback) =>
    ipcRenderer.on('builds-updated', (_event, payload) => callback(payload))
})
