const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron')
const path = require('path')
const fs = require('fs')

const DATA_FILE = path.join(app.getPath('userData'), 'checklist-data.json')
const HOTKEY = 'Control+Shift+L'

let mainWindow
let interactive = false

function defaultItems() {
  return [
    { id: 1, text: 'Matar Hillock (1ª quest)', done: false },
    { id: 2, text: 'Pegar gema de recompensa da Nessa', done: false },
    { id: 3, text: 'Fazer quest do Brutus (resistência)', done: false },
    { id: 4, text: 'Comprar sockets/links no vendor', done: false },
    { id: 5, text: 'Matar Merveil', done: false },
    { id: 6, text: 'Pegar 2ª gema de recompensa', done: false },
    { id: 7, text: 'Alocar passivas principais', done: false },
    { id: 8, text: 'Trocar de área pro Ato 2', done: false },
    { id: 9, text: 'Comprar poções de vida/mana extras', done: false },
    { id: 10, text: 'Checar preços na trade', done: false }
  ]
}

function loadItems() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return defaultItems()
  }
}

function saveItems(items) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar checklist:', e)
  }
}

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 320,
    height: 440,
    x: screenW - 340,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // Começa em modo "click-through": não atrapalha o jogo
  mainWindow.setIgnoreMouseEvents(true, { forward: true })
}

function toggleInteractive() {
  interactive = !interactive
  mainWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  mainWindow.webContents.send('mode-changed', interactive)
}

app.whenReady().then(() => {
  createWindow()

  const registered = globalShortcut.register(HOTKEY, toggleInteractive)
  if (!registered) {
    console.error('Não consegui registrar o atalho', HOTKEY, '- talvez já esteja em uso.')
  }

  ipcMain.handle('load-items', () => loadItems())
  ipcMain.on('save-items', (_event, items) => saveItems(items))
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
