const { app, BrowserWindow, globalShortcut, ipcMain, screen, clipboard, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const zlib = require('zlib')
const { execFile } = require('child_process')

const DATA_FILE = path.join(app.getPath('userData'), 'checklist-data.json')
const BUILDS_FILE = path.join(app.getPath('userData'), 'builds.json')
const WINDOW_FILE = path.join(app.getPath('userData'), 'window-state.json')
const REGEX_WINDOW_FILE = path.join(app.getPath('userData'), 'regex-window-state.json')
const REGEX_FILE = path.join(app.getPath('userData'), 'regex-shortcuts.json')
const HOTKEY = 'Control+Shift+L'
const CLIPBOARD_POLL_MS = 500
const GAME_WINDOW_TITLE = 'Path of Exile'
const APP_NAME = 'PoE Progression Companion'
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png')

let mainWindow
let regexWindow
let toggleWindow
let tray
let isQuitting = false
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

function loadRegexWindowState() {
  try {
    const raw = fs.readFileSync(REGEX_WINDOW_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function saveRegexWindowState() {
  const savedState = loadRegexWindowState() || {}
  const visible = regexWindow ? regexWindow.isVisible() : !!savedState.visible
  let bounds = savedState
  if (regexWindow) {
    const { x, y, width, height } = regexWindow.getBounds()
    bounds = { x, y, width, height }
  }
  try {
    fs.writeFileSync(REGEX_WINDOW_FILE, JSON.stringify({ ...bounds, visible }), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar posição/tamanho da janela de regex:', e)
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

// Antes de existirem builds, a checklist ficava direto em checklist-data.json.
// Se ainda não existe builds.json, usamos esse conteúdo pra criar a primeira
// build (nomeada "Venom Gyre") sem perder nada que já estava salvo.
function loadLegacySections() {
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

function loadBuildsState() {
  try {
    const raw = fs.readFileSync(BUILDS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.builds) && parsed.builds.length > 0) {
      return parsed
    }
    throw new Error('invalid builds file')
  } catch (e) {
    const build = { id: randomUUID(), name: 'Venom Gyre', sections: loadLegacySections() }
    const state = { activeBuildId: build.id, builds: [build] }
    saveBuildsState(state)
    return state
  }
}

function saveBuildsState(state) {
  try {
    fs.writeFileSync(BUILDS_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar builds:', e)
  }
}

function getActiveBuild(state) {
  return state.builds.find((b) => b.id === state.activeBuildId) || state.builds[0]
}

function loadItems() {
  const state = loadBuildsState()
  return getActiveBuild(state).sections
}

function saveItems(sections) {
  const state = loadBuildsState()
  const build = getActiveBuild(state)
  build.sections = sections
  saveBuildsState(state)
}

function listBuilds() {
  const state = loadBuildsState()
  return { builds: state.builds.map((b) => ({ id: b.id, name: b.name })), activeBuildId: state.activeBuildId }
}

function switchBuild(buildId) {
  const state = loadBuildsState()
  if (!state.builds.some((b) => b.id === buildId)) return
  state.activeBuildId = buildId
  saveBuildsState(state)
  broadcastBuildsUpdated()
}

function createBuild(name) {
  const state = loadBuildsState()
  const build = { id: randomUUID(), name: name || 'Nova build', sections: [] }
  state.builds.push(build)
  state.activeBuildId = build.id
  saveBuildsState(state)
  broadcastBuildsUpdated()
}

function broadcastBuildsUpdated() {
  if (!mainWindow) return
  const state = loadBuildsState()
  mainWindow.webContents.send('builds-updated', {
    builds: state.builds.map((b) => ({ id: b.id, name: b.name })),
    activeBuildId: state.activeBuildId,
    sections: getActiveBuild(state).sections
  })
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

// A checklist item may be a linked group (imported from a build) with
// support gems nested under it; visit both levels.
function forEachItem(sections, callback) {
  for (const section of sections) {
    for (const item of section.items) {
      callback(item)
      if (item.supports) {
        for (const support of item.supports) callback(support)
      }
    }
  }
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

  forEachItem(sections, (item) => {
    if (matchedItem || item.done) return
    const normItemText = normalize(item.text)
    if (!normItemText || normItemText.length < 3) return
    if (normItemText === normItemName || normItemText.includes(normItemName) || normItemName.includes(normItemText)) {
      matchedItem = item
    }
  })

  if (!matchedItem) return

  matchedItem.done = true
  saveItems(sections)
  if (mainWindow) {
    mainWindow.webContents.send('items-updated', { sections, matchedItemId: matchedItem.id })
  }
}

function loadRegexes() {
  try {
    const raw = fs.readFileSync(REGEX_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return []
  }
}

function saveRegexes(list) {
  try {
    fs.writeFileSync(REGEX_FILE, JSON.stringify(list, null, 2), 'utf-8')
  } catch (e) {
    console.error('Falha ao salvar regex:', e)
  }
}

function findItemById(sections, itemId) {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.id === itemId) return item
      if (item.supports) {
        const support = item.supports.find((s) => s.id === itemId)
        if (support) return support
      }
    }
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

function fetchText(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'poe-league-checklist' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume()
          fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error('HTTP ' + res.statusCode))
          return
        }
        let data = ''
        res.setEncoding('utf-8')
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

// Sites like pobb.in and pastebin.com host the raw PoB code behind a
// "/raw" (or similar) endpoint; the page itself is HTML, not the code.
function rawCodeUrl(inputUrl) {
  const url = new URL(inputUrl)
  if (url.hostname.includes('pobb.in') && !url.pathname.endsWith('/raw')) {
    return url.origin + url.pathname.replace(/\/$/, '') + '/raw'
  }
  if (url.hostname.includes('pastebin.com') && !url.pathname.startsWith('/raw/')) {
    return url.origin + '/raw' + url.pathname
  }
  return inputUrl
}

function decodePobCode(code) {
  const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/')
  const buf = Buffer.from(b64, 'base64')
  return zlib.inflateSync(buf).toString('utf-8')
}

function xmlUnescape(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '')
    .replace(/&amp;/g, '&')
}

// Some build guides write a leveling plan by hand into PoB's Notes field,
// grouped under headers like "Level 12", "Act 3", "Stage 2". If we find
// that structure we use it as-is; each header becomes a section.
const NOTES_HEADER_RE = /^(?:act\s*\d+|level\s*\d+\+?(?:\s*[-–to]+\s*\d+)?|lvl\s*\d+\+?|stage\s*\d+)\b.*$/i

function parseNotesIntoSections(xml) {
  const match = xml.match(/<Notes>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))\s*<\/Notes>/)
  if (!match) return []
  const raw = xmlUnescape(match[1] != null ? match[1] : match[2] || '')
  const lines = raw.split(/\r?\n/).map((l) => l.trim())

  const sections = []
  let current = null
  for (const line of lines) {
    if (!line) continue
    if (NOTES_HEADER_RE.test(line)) {
      current = { id: randomUUID(), title: line.replace(/:$/, ''), collapsed: false, items: [] }
      sections.push(current)
    } else if (current) {
      current.items.push({ id: randomUUID(), text: line, done: false })
    }
  }
  return sections
}

// Support gems, used to tell them apart from active skills (auras,
// heralds, curses, etc.) that happen to share a socket group. The item id
// PoB exports for each gem (gemId="Metadata/Items/Gems/SupportGemX" vs
// "...SkillGemX") comes straight from the game's own data and is always
// accurate/up to date — far more reliable than any name list we bundle.
// A downloaded name list (data/support-gems.json, from RePoE's game data
// dump) is kept only as a fallback for the rare gem tag with no gemId.
const SUPPORT_GEM_NAME_FALLBACK = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'support-gems.json'), 'utf-8'))
)

function gemsInBlock(xmlBlock) {
  const gems = []
  const seen = new Set()
  const gemTagRe = /<Gem\b[^>]*\/?>/g
  let m
  while ((m = gemTagRe.exec(xmlBlock))) {
    const tag = m[0]
    const nameMatch = tag.match(/\bnameSpec="([^"]+)"/)
    if (!nameMatch) continue
    const name = xmlUnescape(nameMatch[1])
    if (seen.has(name)) continue
    seen.add(name)

    const idMatch = tag.match(/\bgemId="([^"]+)"/)
    const isSupport = idMatch
      ? /(^|\/)SupportGem/i.test(idMatch[1])
      : SUPPORT_GEM_NAME_FALLBACK.has(name)
    gems.push({ name, isSupport })
  }
  return gems
}

function gemNamesInBlock(xmlBlock) {
  return gemsInBlock(xmlBlock).map((g) => g.name)
}

// Within a socket group (<Skill>...</Skill>), nest each support gem under
// the active skill gem right before it in the list — that's the order PoB
// stores them in, and it holds even when a group has multiple active
// skills sharing sockets (e.g. a utility skill + its buff support sitting
// next to an unrelated aura). A support with no preceding active skill in
// the group (rare) is listed on its own instead of guessing an owner.
function linkGroupsInBlock(xmlBlock) {
  const groups = []
  const skillRe = /<Skill\b[^>]*>([\s\S]*?)<\/Skill>/g
  let m
  while ((m = skillRe.exec(xmlBlock))) {
    const gems = gemsInBlock(m[1])
    let current = null
    for (const gem of gems) {
      if (gem.isSupport) {
        if (current) current.supports.push(gem.name)
        else groups.push({ main: gem.name, supports: [] })
      } else {
        current = { main: gem.name, supports: [] }
        groups.push(current)
      }
    }
  }
  return groups
}

function linkGroupsToItems(groups) {
  return groups.map((group) => ({
    id: randomUUID(),
    text: group.main,
    done: false,
    supports: group.supports.map((name) => ({ id: randomUUID(), text: name, done: false }))
  }))
}

// Most PoB leveling guides split gems by stage using PoB's own "skill
// sets" feature (one SkillSet per level/act, each with its own title).
// When there's more than one, that's a much stronger signal than Notes.
function parseSkillSetSections(xml) {
  const sections = []
  const setRe = /<SkillSet\b([^>]*)>([\s\S]*?)<\/SkillSet>/g
  let m
  let index = 0
  while ((m = setRe.exec(xml))) {
    index++
    const attrs = m[1]
    const body = m[2]
    const titleMatch = attrs.match(/\btitle="([^"]*)"/)
    const title = titleMatch && titleMatch[1].trim() ? xmlUnescape(titleMatch[1]) : `Skill set ${index}`
    const groups = linkGroupsInBlock(body)
    if (groups.length > 0) {
      sections.push({
        id: randomUUID(),
        title,
        collapsed: false,
        items: linkGroupsToItems(groups)
      })
    }
  }
  return sections.length > 1 ? sections : []
}

// Last resort when the build has no per-stage skill sets or leveling
// notes: list every gem in the build as a single section.
function parseGemsFallback(xml) {
  const gemNames = gemNamesInBlock(xml)
  if (gemNames.length === 0) return []
  return [
    {
      id: randomUUID(),
      title: 'Imported gems',
      collapsed: false,
      items: gemNames.map((name) => ({ id: randomUUID(), text: name, done: false }))
    }
  ]
}

async function importBuildFromUrl(url) {
  const raw = await fetchText(rawCodeUrl(url))
  const xml = decodePobCode(raw)

  const skillSetSections = parseSkillSetSections(xml)
  const notesSections = skillSetSections.length === 0 ? parseNotesIntoSections(xml) : []
  const sections =
    skillSetSections.length > 0
      ? skillSetSections
      : notesSections.length > 0
        ? notesSections
        : parseGemsFallback(xml)

  if (sections.length === 0) {
    throw new Error('No leveling plan or gems found in this build')
  }
  sections.forEach((section, i) => {
    section.collapsed = i !== 0
  })

  const state = loadBuildsState()
  const build = getActiveBuild(state)
  build.sections = build.sections.concat(sections)
  saveBuildsState(state)
  broadcastBuildsUpdated()
  return { addedSections: sections.length }
}

function searchRegexInGame(pattern) {
  clipboard.writeText(pattern)
  lastClipboardText = pattern
  pasteIntoGame()
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
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('moved', () => {
    saveWindowState()
    positionToggleWindow()
  })
  mainWindow.on('resized', () => {
    saveWindowState()
    positionToggleWindow()
  })
}

function hideAllWindows() {
  mainWindow.hide()
  if (toggleWindow) toggleWindow.hide()
  if (regexWindow) regexWindow.hide()
}

function showAllWindows() {
  mainWindow.show()
  if (toggleWindow) toggleWindow.show()
  const savedRegexState = loadRegexWindowState()
  if (regexWindow && savedRegexState && savedRegexState.visible) regexWindow.show()
}

function toggleVisibility() {
  if (mainWindow.isVisible()) {
    hideAllWindows()
  } else {
    showAllWindows()
  }
}

// The overlay hides its windows (no taskbar entry) instead of closing them,
// so a tray icon is the only way to bring it back or quit for real.
function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip(APP_NAME)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show/Hide (Ctrl+Shift+L)', click: () => toggleVisibility() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
  tray.on('click', () => toggleVisibility())
}

// Small standalone window holding just the REGEX toggle button, kept
// glued to the right edge of the main window but living entirely outside
// it, so it never participates in the main window's own layout.
function positionToggleWindow() {
  if (!toggleWindow || !mainWindow) return
  const mainBounds = mainWindow.getBounds()
  const { width, height } = toggleWindow.getBounds()
  toggleWindow.setBounds({
    x: mainBounds.x + mainBounds.width + 2,
    y: mainBounds.y + Math.round((mainBounds.height - height) / 2),
    width,
    height
  })
}

function createToggleWindow() {
  toggleWindow = new BrowserWindow({
    width: 20,
    height: 64,
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

  toggleWindow.setAlwaysOnTop(true, 'screen-saver')
  toggleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  toggleWindow.loadFile(path.join(__dirname, 'renderer', 'regex-toggle.html'))
  positionToggleWindow()
}

// The regex shortcut panel lives in its own OS window so it can never
// affect the size/layout of the main checklist window.
function createRegexWindow() {
  const savedState = loadRegexWindowState()
  const mainBounds = mainWindow.getBounds()

  regexWindow = new BrowserWindow({
    width: savedState && savedState.width ? savedState.width : 130,
    height: savedState && savedState.height ? savedState.height : mainBounds.height,
    x: savedState && savedState.x != null ? savedState.x : mainBounds.x + mainBounds.width + 8,
    y: savedState && savedState.y != null ? savedState.y : mainBounds.y,
    minWidth: 90,
    minHeight: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  regexWindow.setAlwaysOnTop(true, 'screen-saver')
  regexWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  regexWindow.loadFile(path.join(__dirname, 'renderer', 'regex.html'))

  regexWindow.on('moved', saveRegexWindowState)
  regexWindow.on('resized', saveRegexWindowState)
  regexWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    regexWindow.hide()
    saveRegexWindowState()
  })
}

function toggleRegexWindow() {
  if (!regexWindow) createRegexWindow()
  if (regexWindow.isVisible()) {
    regexWindow.hide()
  } else {
    regexWindow.show()
  }
  saveRegexWindowState()
}

app.whenReady().then(() => {
  createWindow()
  createToggleWindow()
  createTray()

  const savedRegexState = loadRegexWindowState()
  if (savedRegexState && savedRegexState.visible) {
    createRegexWindow()
    regexWindow.show()
  }

  const registered = globalShortcut.register(HOTKEY, toggleVisibility)
  if (!registered) {
    console.error('Não consegui registrar o atalho', HOTKEY, '- talvez já esteja em uso.')
  }

  ipcMain.handle('load-items', () => loadItems())
  ipcMain.on('save-items', (_event, items) => saveItems(items))
  ipcMain.on('search-item', (_event, itemId) => searchAndCheckItem(itemId))
  ipcMain.on('hide-window', () => mainWindow && hideAllWindows())
  ipcMain.on('toggle-regex-window', () => toggleRegexWindow())
  ipcMain.on('hide-regex-window', () => {
    if (!regexWindow) return
    regexWindow.hide()
    saveRegexWindowState()
  })
  ipcMain.handle('load-regexes', () => loadRegexes())
  ipcMain.on('save-regexes', (_event, list) => saveRegexes(list))
  ipcMain.on('search-regex', (_event, pattern) => searchRegexInGame(pattern))
  ipcMain.handle('load-builds', () => listBuilds())
  ipcMain.on('switch-build', (_event, buildId) => switchBuild(buildId))
  ipcMain.on('create-build', (_event, name) => createBuild(name))
  ipcMain.handle('import-build', async (_event, url) => {
    try {
      const result = await importBuildFromUrl(url)
      return { ok: true, ...result }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  setInterval(tryAutoCheckFromClipboard, CLIPBOARD_POLL_MS)
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
