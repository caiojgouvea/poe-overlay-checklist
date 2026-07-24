const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  loadItems: () => ipcRenderer.invoke('load-items'),
  saveItems: (items) => ipcRenderer.send('save-items', items),
  searchItem: (itemId) => ipcRenderer.send('search-item', itemId),
  hideWindow: () => ipcRenderer.send('hide-window'),
  toggleRegexWindow: () => ipcRenderer.send('toggle-regex-window'),
  hideRegexWindow: () => ipcRenderer.send('hide-regex-window'),
  loadRegexes: () => ipcRenderer.invoke('load-regexes'),
  saveRegexes: (list) => ipcRenderer.send('save-regexes', list),
  searchRegex: (pattern) => ipcRenderer.send('search-regex', pattern),
  loadBuilds: () => ipcRenderer.invoke('load-builds'),
  switchBuild: (buildId) => ipcRenderer.send('switch-build', buildId),
  createBuild: (name) => ipcRenderer.send('create-build', name),
  importBuild: (url) => ipcRenderer.invoke('import-build', url),
  loadHotkey: () => ipcRenderer.invoke('load-hotkey'),
  setHotkey: (accelerator) => ipcRenderer.invoke('set-hotkey', accelerator),
  onItemsUpdated: (callback) =>
    ipcRenderer.on('items-updated', (_event, payload) => callback(payload)),
  onBuildsUpdated: (callback) =>
    ipcRenderer.on('builds-updated', (_event, payload) => callback(payload)),
  onCollapsedChanged: (callback) =>
    ipcRenderer.on('collapsed-changed', (_event, collapsed) => callback(collapsed))
})
