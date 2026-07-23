let sections = []
let draggedInfo = null

const sectionsEl = document.getElementById('sections')
const addSectionInput = document.getElementById('new-section-input')
const addSectionBtn = document.getElementById('add-section-btn')
const settingsBtn = document.getElementById('settings-btn')
const settingsCollapseBtn = document.getElementById('settings-collapse-btn')
const closeBtn = document.getElementById('close-btn')
const buildSelect = document.getElementById('build-select')
const addBuildBtn = document.getElementById('add-build-btn')
const clearBuildBtn = document.getElementById('clear-build-btn')
const buildAddForm = document.getElementById('build-add-form')
const buildNameInput = document.getElementById('build-name-input')
const buildConfirmBtn = document.getElementById('build-confirm-btn')
const themeSelect = document.getElementById('theme-select')
const importUrlInput = document.getElementById('import-url-input')
const importBuildBtn = document.getElementById('import-build-btn')
const importStatus = document.getElementById('import-status')
const hotkeyInput = document.getElementById('hotkey-input')
const hotkeyRecordBtn = document.getElementById('hotkey-record-btn')
const hotkeyStatus = document.getElementById('hotkey-status')
const hintEl = document.getElementById('hint')

function uid() {
  return crypto.randomUUID()
}

function persist() {
  window.api.saveItems(sections)
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// The same gem/step often repeats across sections (e.g. "Frostblink" in
// every leveling stage). Checking it in one section should check it
// everywhere it appears in the build, so progress reflects reality.
function setDoneEverywhere(text, done) {
  const normText = normalize(text)
  if (!normText) return
  for (const section of sections) {
    for (const item of section.items) {
      if (normalize(item.text) === normText) item.done = done
      if (item.supports) {
        for (const support of item.supports) {
          if (normalize(support.text) === normText) support.done = done
        }
      }
    }
  }
}

function render() {
  sectionsEl.innerHTML = ''
  for (const section of sections) {
    sectionsEl.appendChild(buildSectionEl(section))
  }
}

function moveItem(fromSectionId, itemId, toSectionId, targetItemId) {
  const fromSection = sections.find((s) => s.id === fromSectionId)
  if (!fromSection) return
  const idx = fromSection.items.findIndex((i) => i.id === itemId)
  if (idx === -1) return
  const [moved] = fromSection.items.splice(idx, 1)

  const toSection = sections.find((s) => s.id === toSectionId)
  if (!toSection) return
  const targetIdx = toSection.items.findIndex((i) => i.id === targetItemId)
  if (targetIdx === -1) toSection.items.push(moved)
  else toSection.items.splice(targetIdx, 0, moved)

  persist()
  render()
}

function moveSection(sectionId, targetSectionId) {
  const idx = sections.findIndex((s) => s.id === sectionId)
  if (idx === -1) return
  const [moved] = sections.splice(idx, 1)
  const targetIdx = sections.findIndex((s) => s.id === targetSectionId)
  if (targetIdx === -1) sections.push(moved)
  else sections.splice(targetIdx, 0, moved)
  persist()
  render()
}

function buildSectionEl(section) {
  const wrap = document.createElement('div')
  wrap.className = 'section'
  wrap.addEventListener('dragover', (e) => {
    if (!draggedInfo || draggedInfo.type !== 'section') return
    e.preventDefault()
  })
  wrap.addEventListener('drop', (e) => {
    e.preventDefault()
    if (!draggedInfo || draggedInfo.type !== 'section') return
    moveSection(draggedInfo.sectionId, section.id)
    draggedInfo = null
  })

  const header = document.createElement('div')
  header.className = 'section-header'

  const sectionHandle = document.createElement('span')
  sectionHandle.className = 'drag-handle section-drag-handle'
  sectionHandle.innerText = '⠿'
  sectionHandle.draggable = true
  sectionHandle.addEventListener('dragstart', (e) => {
    e.stopPropagation()
    draggedInfo = { type: 'section', sectionId: section.id }
    e.dataTransfer.effectAllowed = 'move'
  })

  const chevron = document.createElement('span')
  chevron.className = 'chevron'
  chevron.innerText = section.collapsed ? '▶' : '▼'
  chevron.addEventListener('click', () => {
    section.collapsed = !section.collapsed
    persist()
    render()
  })

  const title = document.createElement('span')
  title.className = 'section-title'
  title.contentEditable = 'true'
  title.spellcheck = false
  title.innerText = section.title
  title.addEventListener('blur', () => {
    section.title = title.innerText.trim() || section.title
    persist()
  })
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      title.blur()
    }
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'section-del-btn'
  delBtn.innerText = '✕'
  delBtn.addEventListener('click', () => {
    sections = sections.filter((s) => s.id !== section.id)
    persist()
    render()
  })

  header.appendChild(sectionHandle)
  header.appendChild(chevron)
  header.appendChild(title)
  header.appendChild(delBtn)
  wrap.appendChild(header)

  const list = document.createElement('ul')
  list.className = 'section-items'
  if (section.collapsed) list.style.display = 'none'

  for (const item of section.items) {
    list.appendChild(buildItemEl(section, item))
    if (item.supports) {
      for (const support of item.supports) {
        list.appendChild(buildSupportEl(section, item, support))
      }
    }
  }
  wrap.appendChild(list)

  const addRow = document.createElement('div')
  addRow.className = 'section-add-row'
  if (section.collapsed) addRow.style.display = 'none'

  const addInput = document.createElement('input')
  addInput.type = 'text'
  addInput.placeholder = 'New step...'
  addInput.className = 'section-add-input'

  const addBtn = document.createElement('button')
  addBtn.className = 'section-add-btn'
  addBtn.innerText = '+'

  const addItemToSection = () => {
    const value = addInput.value.trim()
    if (!value) return
    section.items.push({ id: uid(), text: value, done: false })
    addInput.value = ''
    persist()
    render()
  }
  addBtn.addEventListener('click', addItemToSection)
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItemToSection()
  })

  addRow.appendChild(addInput)
  addRow.appendChild(addBtn)
  wrap.appendChild(addRow)

  return wrap
}

function buildItemEl(section, item) {
  const li = document.createElement('li')
  li.dataset.itemId = item.id
  if (item.done) li.classList.add('done')

  li.addEventListener('dragover', (e) => {
    if (!draggedInfo || draggedInfo.type !== 'item') return
    e.preventDefault()
  })
  li.addEventListener('drop', (e) => {
    e.preventDefault()
    if (!draggedInfo || draggedInfo.type !== 'item') return
    moveItem(draggedInfo.sectionId, draggedInfo.itemId, section.id, item.id)
    draggedInfo = null
  })

  const handle = document.createElement('span')
  handle.className = 'drag-handle item-drag-handle'
  handle.innerText = '⠿'
  handle.draggable = true
  handle.addEventListener('dragstart', (e) => {
    e.stopPropagation()
    draggedInfo = { type: 'item', sectionId: section.id, itemId: item.id }
    e.dataTransfer.effectAllowed = 'move'
  })

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = item.done
  checkbox.addEventListener('change', () => {
    setDoneEverywhere(item.text, checkbox.checked)
    persist()
    render()
  })

  const text = document.createElement('span')
  text.className = 'item-text'
  text.contentEditable = 'false'
  text.spellcheck = false
  text.title = 'Click: search in game and check | Double-click: edit'
  text.innerText = item.text

  let clickTimer = null
  text.addEventListener('click', () => {
    if (text.isContentEditable) return
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      window.api.searchItem(item.id)
    }, 220)
  })
  text.addEventListener('dblclick', () => {
    clearTimeout(clickTimer)
    text.contentEditable = 'true'
    text.focus()
  })
  text.addEventListener('blur', () => {
    if (!text.isContentEditable) return
    item.text = text.innerText.trim() || item.text
    text.contentEditable = 'false'
    persist()
  })
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      text.blur()
    }
  })

  const nestBtn = document.createElement('button')
  nestBtn.className = 'nest-btn'
  nestBtn.innerText = '⤷'
  nestBtn.title = 'Turn into a sub-item of the item above'
  const itemIndex = section.items.findIndex((i) => i.id === item.id)
  if (itemIndex <= 0) nestBtn.disabled = true
  nestBtn.addEventListener('click', () => {
    const idx = section.items.findIndex((i) => i.id === item.id)
    if (idx <= 0) return
    const parent = section.items[idx - 1]
    section.items.splice(idx, 1)
    parent.supports = parent.supports || []
    parent.supports.push({ id: item.id, text: item.text, done: item.done })
    persist()
    render()
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'del-btn'
  delBtn.innerText = '✕'
  delBtn.addEventListener('click', () => {
    section.items = section.items.filter((i) => i.id !== item.id)
    persist()
    render()
  })

  li.appendChild(handle)
  li.appendChild(checkbox)
  li.appendChild(text)
  li.appendChild(nestBtn)
  li.appendChild(delBtn)
  return li
}

// Support gems linked to a main item (imported from a build). Rendered
// indented, without a drag handle, and deleted from the parent's list.
function buildSupportEl(section, mainItem, support) {
  const li = document.createElement('li')
  li.className = 'support-item'
  li.dataset.itemId = support.id
  if (support.done) li.classList.add('done')

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = support.done
  checkbox.addEventListener('change', () => {
    setDoneEverywhere(support.text, checkbox.checked)
    persist()
    render()
  })

  const text = document.createElement('span')
  text.className = 'item-text'
  text.contentEditable = 'false'
  text.spellcheck = false
  text.title = 'Click: search in game and check | Double-click: edit'
  text.innerText = support.text

  let clickTimer = null
  text.addEventListener('click', () => {
    if (text.isContentEditable) return
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      window.api.searchItem(support.id)
    }, 220)
  })
  text.addEventListener('dblclick', () => {
    clearTimeout(clickTimer)
    text.contentEditable = 'true'
    text.focus()
  })
  text.addEventListener('blur', () => {
    if (!text.isContentEditable) return
    support.text = text.innerText.trim() || support.text
    text.contentEditable = 'false'
    persist()
  })
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      text.blur()
    }
  })

  const promoteBtn = document.createElement('button')
  promoteBtn.className = 'nest-btn'
  promoteBtn.innerText = '⤴'
  promoteBtn.title = 'Turn back into its own item'
  promoteBtn.addEventListener('click', () => {
    mainItem.supports = mainItem.supports.filter((s) => s.id !== support.id)
    const mainIndex = section.items.findIndex((i) => i.id === mainItem.id)
    section.items.splice(mainIndex + 1, 0, { id: support.id, text: support.text, done: support.done })
    persist()
    render()
  })

  const delBtn = document.createElement('button')
  delBtn.className = 'del-btn'
  delBtn.innerText = '✕'
  delBtn.addEventListener('click', () => {
    mainItem.supports = mainItem.supports.filter((s) => s.id !== support.id)
    persist()
    render()
  })

  li.appendChild(checkbox)
  li.appendChild(text)
  li.appendChild(promoteBtn)
  li.appendChild(delBtn)
  return li
}

function addSection() {
  const value = addSectionInput.value.trim()
  if (!value) return
  sections.push({ id: uid(), title: value, collapsed: false, items: [] })
  addSectionInput.value = ''
  persist()
  render()
}

addSectionBtn.addEventListener('click', addSection)
addSectionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSection()
})

settingsBtn.addEventListener('click', () => {
  document.body.classList.toggle('edit-mode')
})

const SETTINGS_COLLAPSED_KEY = 'settingsCollapsed'

function applySettingsCollapsed(collapsed) {
  document.body.classList.toggle('settings-collapsed', collapsed)
  settingsCollapseBtn.innerText = collapsed ? '▼' : '▲'
  localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? '1' : '0')
}

applySettingsCollapsed(localStorage.getItem(SETTINGS_COLLAPSED_KEY) === '1')

settingsCollapseBtn.addEventListener('click', () => {
  applySettingsCollapsed(!document.body.classList.contains('settings-collapsed'))
})

closeBtn.addEventListener('click', () => {
  window.api.hideWindow()
})

window.api.onItemsUpdated(({ sections: updated, matchedItemId }) => {
  sections = updated
  render()
  if (matchedItemId) {
    const li = sectionsEl.querySelector(`[data-item-id="${matchedItemId}"]`)
    if (li) {
      li.classList.add('flash')
      setTimeout(() => li.classList.remove('flash'), 1500)
    }
  }
})

function renderBuildSelect({ builds, activeBuildId }) {
  buildSelect.innerHTML = ''
  for (const build of builds) {
    const option = document.createElement('option')
    option.value = build.id
    option.innerText = build.name
    if (build.id === activeBuildId) option.selected = true
    buildSelect.appendChild(option)
  }
}

buildSelect.addEventListener('change', () => {
  window.api.switchBuild(buildSelect.value)
})

function addBuild() {
  const name = buildNameInput.value.trim()
  if (!name) return
  window.api.createBuild(name)
  buildNameInput.value = ''
  buildAddForm.classList.add('hidden')
}

addBuildBtn.addEventListener('click', () => {
  buildAddForm.classList.toggle('hidden')
  if (!buildAddForm.classList.contains('hidden')) buildNameInput.focus()
})
buildConfirmBtn.addEventListener('click', addBuild)
buildNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBuild()
})

clearBuildBtn.addEventListener('click', () => {
  if (!confirm('Uncheck all items in this build?')) return
  for (const section of sections) {
    for (const item of section.items) {
      item.done = false
      if (item.supports) {
        for (const support of item.supports) support.done = false
      }
    }
  }
  persist()
  render()
})

importBuildBtn.addEventListener('click', async () => {
  const url = importUrlInput.value.trim()
  if (!url) return
  importStatus.textContent = 'Importing...'
  importStatus.classList.remove('error')
  importBuildBtn.disabled = true
  const result = await window.api.importBuild(url)
  importBuildBtn.disabled = false
  if (result.ok) {
    importStatus.textContent = `Added ${result.addedSections} section(s)`
    importUrlInput.value = ''
  } else {
    importStatus.textContent = result.error || 'Import failed'
    importStatus.classList.add('error')
  }
})
importUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') importBuildBtn.click()
})

window.api.onBuildsUpdated(({ builds, activeBuildId, sections: updated }) => {
  renderBuildSelect({ builds, activeBuildId })
  sections = updated
  render()
})

window.api.loadBuilds().then((state) => {
  renderBuildSelect(state)
})

window.api.loadItems().then((loaded) => {
  sections = loaded
  render()
})

const THEME_KEY = 'theme'
const savedTheme = localStorage.getItem(THEME_KEY) || 'pink'
document.body.dataset.theme = savedTheme
themeSelect.value = savedTheme

themeSelect.addEventListener('change', () => {
  document.body.dataset.theme = themeSelect.value
  localStorage.setItem(THEME_KEY, themeSelect.value)
})

// "Control+Shift+L" -> "Ctrl+Shift+L", just for display.
function formatHotkeyForDisplay(accelerator) {
  return accelerator.replace(/Control/g, 'Ctrl').replace(/Super/g, 'Win')
}

function applyHotkey(accelerator) {
  hotkeyInput.value = formatHotkeyForDisplay(accelerator)
  hintEl.textContent = `${formatHotkeyForDisplay(accelerator)} to show/hide`
  closeBtn.title = `Hide (${formatHotkeyForDisplay(accelerator)})`
}

function keyEventToAccelerator(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null

  const parts = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')

  const arrowKeys = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }
  const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)

  // Letters/digits/space/arrows need a modifier so we don't hijack normal
  // typing; function keys are safe to use on their own.
  if (parts.length === 0 && !isFunctionKey) return null

  let mainKey = null
  if (/^[a-zA-Z0-9]$/.test(e.key)) mainKey = e.key.toUpperCase()
  else if (isFunctionKey) mainKey = e.key
  else if (e.key === ' ') mainKey = 'Space'
  else if (arrowKeys[e.key]) mainKey = arrowKeys[e.key]
  if (!mainKey) return null

  parts.push(mainKey)
  return parts.join('+')
}

let recordingHotkey = false
hotkeyRecordBtn.addEventListener('click', () => {
  if (recordingHotkey) return
  recordingHotkey = true
  hotkeyRecordBtn.classList.add('recording')
  hotkeyRecordBtn.innerText = 'Press keys...'
  hotkeyStatus.textContent = 'Waiting for a key combo (e.g. Ctrl+Shift+L)...'
  hotkeyStatus.classList.remove('error')

  const stopRecording = () => {
    recordingHotkey = false
    hotkeyRecordBtn.classList.remove('recording')
    hotkeyRecordBtn.innerText = 'Set'
    document.removeEventListener('keydown', onKeydown, true)
  }

  const onKeydown = async (e) => {
    e.preventDefault()
    if (e.key === 'Escape') {
      stopRecording()
      hotkeyStatus.textContent = ''
      return
    }
    const accelerator = keyEventToAccelerator(e)
    if (!accelerator) return
    stopRecording()
    const result = await window.api.setHotkey(accelerator)
    if (result.ok) {
      applyHotkey(result.hotkey)
      hotkeyStatus.textContent = 'Saved'
    } else {
      applyHotkey(result.hotkey)
      hotkeyStatus.textContent = 'That combo is already in use elsewhere'
      hotkeyStatus.classList.add('error')
    }
  }
  document.addEventListener('keydown', onKeydown, true)
})

window.api.loadHotkey().then((hotkey) => {
  applyHotkey(hotkey)
})
