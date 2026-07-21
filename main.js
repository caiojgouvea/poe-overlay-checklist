const { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

const DATA_FILE = path.join(app.getPath('userData'), 'checklist-data.json')
const WINDOW_FILE = path.join(app.getPath('userData'), 'window-state.json')
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
const HOTKEY = 'Control+Shift+L'
const CLIPBOARD_POLL_MS = 500
const GAME_WINDOW_TITLE = 'Path of Exile'

let mainWindow
let lastClipboardText = ''

function loadWindowState() {
  try {
    const raw = fs.readFileSync(WINDOW_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function saveWindowState() {
  if (!mainWindow) return
  const { x, y, width, height } = mainWindow.getBounds()
  try {
    fs.writeFileSync(WINDOW_FILE, JSON.stringify({ x, y, width, height }), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar posição/tamanho da janela:', e)
  }
}

const { randomUUID } = require('crypto')

function defaultSections() {
  return [
    {
      id: randomUUID(),
      title: 'Ato 1',
      collapsed: false,
      items: [
        { id: randomUUID(), text: 'Matar Hillock (1ª quest)', done: false },
        { id: randomUUID(), text: 'Pegar gema de recompensa da Nessa', done: false },
        { id: randomUUID(), text: 'Fazer quest do Brutus (resistência)', done: false },
        { id: randomUUID(), text: 'Comprar sockets/links no vendor', done: false },
        { id: randomUUID(), text: 'Matar Merveil', done: false },
        { id: randomUUID(), text: 'Pegar 2ª gema de recompensa', done: false },
        { id: randomUUID(), text: 'Alocar passivas principais', done: false },
        { id: randomUUID(), text: 'Trocar de área pro Ato 2', done: false }
      ]
    },
    {
      id: randomUUID(),
      title: 'Geral',
      collapsed: false,
      items: [
        { id: randomUUID(), text: 'Comprar poções de vida/mana extras', done: false },
        { id: randomUUID(), text: 'Checar preços na trade', done: false }
      ]
    }
  ]
}

// Dados antigos eram uma lista plana de itens (sem sessões); migra pra uma
// única sessão "Checklist" pra não perder o progresso salvo.
function migrateLegacyItems(items) {
  return [{ id: randomUUID(), title: 'Checklist', collapsed: false, items }]
}

function loadItems() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && !('items' in parsed[0])) {
      return migrateLegacyItems(parsed)
    }
    return parsed
  } catch (e) {
    return defaultSections()
  }
}

function saveItems(sections) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sections, null, 2), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar checklist:', e)
  }
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return { characterName: '' }
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar configurações:', e)
  }
}

// Texto copiado de um item no PoE (Ctrl+C em cima dele) sempre tem uma
// linha "Rarity: X" seguida do nome do item na linha seguinte.
function parseItemName(clipboardText) {
  const lines = clipboardText.split(/\r?\n/)
  const rarityIdx = lines.findIndex((l) => l.trim().startsWith('Rarity:'))
  if (rarityIdx === -1) return null
  for (let i = rarityIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line) return line
  }
  return null
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tryAutoCheckFromClipboard() {
  const text = clipboard.readText()
  if (!text || text === lastClipboardText) return
  lastClipboardText = text

  const itemName = parseItemName(text)
  if (!itemName) return

  const normItemName = normalize(itemName)
  if (normItemName.length < 3) return

  const sections = loadItems()
  let matchedItem = null

  for (const section of sections) {
    for (const item of section.items) {
      if (item.done) continue
      const normItemText = normalize(item.text)
      if (!normItemText || normItemText.length < 3) continue
      if (normItemText === normItemName || normItemText.includes(normItemName) || normItemName.includes(normItemText)) {
        matchedItem = item
        break
      }
    }
    if (matchedItem) break
  }

  if (!matchedItem) return

  matchedItem.done = true
  saveItems(sections)
  if (mainWindow) {
    mainWindow.webContents.send('items-updated', { sections, matchedItemId: matchedItem.id })
  }
}

function findItemById(sections, itemId) {
  for (const section of sections) {
    const item = section.items.find((i) => i.id === itemId)
    if (item) return item
  }
  return null
}

// Cola (Ctrl+V) o texto que está no clipboard na janela do PoE. Primeiro
// dá Ctrl+F (atalho do próprio jogo pra focar a busca do vendor/trade),
// depois Ctrl+A pra substituir o que já estava digitado (em vez de
// concatenar), depois cola.
function pasteIntoGame() {
  const psScript = `
    Add-Type -AssemblyName Microsoft.VisualBasic
    Add-Type -AssemblyName System.Windows.Forms
    try { [Microsoft.VisualBasic.Interaction]::AppActivate('${GAME_WINDOW_TITLE}') } catch {}
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('^f')
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    Start-Sleep -Milliseconds 50
    [System.Windows.Forms.SendKeys]::SendWait('^v')
  `
  execFile('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psScript], (err) => {
    if (err) console.error('Falha ao colar no jogo:', err)
  })
}

function searchAndCheckItem(itemId) {
  const sections = loadItems()
  const item = findItemById(sections, itemId)
  if (!item) return

  clipboard.writeText(item.text)
  lastClipboardText = item.text
  pasteIntoGame()

  item.done = true
  saveItems(sections)
  if (mainWindow) {
    mainWindow.webContents.send('items-updated', { sections, matchedItemId: item.id })
  }
}

function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize
  const savedState = loadWindowState()

  mainWindow = new BrowserWindow({
    width: savedState && savedState.width ? savedState.width : 320,
    height: savedState && savedState.height ? savedState.height : 440,
    x: savedState && savedState.x != null ? savedState.x : screenW - 340,
    y: savedState && savedState.y != null ? savedState.y : 40,
    minWidth: 220,
    minHeight: 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
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

  mainWindow.on('moved', saveWindowState)
  mainWindow.on('resized', saveWindowState)
}

function toggleVisibility() {
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
  }
}

app.whenReady().then(() => {
  createWindow()

  const registered = globalShortcut.register(HOTKEY, toggleVisibility)
  if (!registered) {
    console.error('Não consegui registrar o atalho', HOTKEY, '- talvez já esteja em uso.')
  }

  ipcMain.handle('load-items', () => loadItems())
  ipcMain.on('save-items', (_event, items) => saveItems(items))
  ipcMain.handle('load-settings', () => loadSettings())
  ipcMain.on('save-settings', (_event, settings) => saveSettings(settings))
  ipcMain.on('search-item', (_event, itemId) => searchAndCheckItem(itemId))
  ipcMain.on('hide-window', () => mainWindow && mainWindow.hide())

  setInterval(tryAutoCheckFromClipboard, CLIPBOARD_POLL_MS)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
