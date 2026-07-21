let sections = []
let draggedInfo = null

const sectionsEl = document.getElementById('sections')
const newSectionInput = document.getElementById('new-section-input')
const addSectionBtn = document.getElementById('add-section-btn')
const settingsBtn = document.getElementById('settings-btn')
const closeBtn = document.getElementById('close-btn')
const buildSelect = document.getElementById('build-select')
const addBuildBtn = document.getElementById('add-build-btn')

let regexes = []

const regexGridEl = document.getElementById('regex-grid')
const addRegexBtn = document.getElementById('add-regex-btn')
const regexAddForm = document.getElementById('regex-add-form')
const regexLabelInput = document.getElementById('regex-label-input')
const regexPatternInput = document.getElementById('regex-pattern-input')
const regexConfirmBtn = document.getElementById('regex-confirm-btn')

function uid() {
  return crypto.randomUUID()
}

function persist() {
  window.api.saveItems(sections)
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
  }
  wrap.appendChild(list)

  const addRow = document.createElement('div')
  addRow.className = 'section-add-row'
  if (section.collapsed) addRow.style.display = 'none'

  const addInput = document.createElement('input')
  addInput.type = 'text'
  addInput.placeholder = 'Novo passo...'
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
    item.done = checkbox.checked
    li.classList.toggle('done', item.done)
    persist()
  })

  const text = document.createElement('span')
  text.className = 'item-text'
  text.contentEditable = 'false'
  text.spellcheck = false
  text.title = 'Clique: buscar no jogo e marcar | Duplo clique: editar'
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
  li.appendChild(delBtn)
  return li
}

function renderRegexes() {
  regexGridEl.innerHTML = ''
  for (const item of regexes) {
    regexGridEl.appendChild(buildRegexEl(item))
  }
}

function buildRegexEl(item) {
  const btn = document.createElement('button')
  btn.className = 'regex-square'
  btn.title = item.pattern
  btn.innerText = item.label

  btn.addEventListener('click', () => {
    window.api.searchRegex(item.pattern)
  })

  const delBtn = document.createElement('span')
  delBtn.className = 'regex-del-btn'
  delBtn.innerText = '✕'
  delBtn.title = 'Remover'
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    regexes = regexes.filter((r) => r.id !== item.id)
    window.api.saveRegexes(regexes)
    renderRegexes()
  })

  const wrap = document.createElement('div')
  wrap.className = 'regex-square-wrap'
  wrap.appendChild(btn)
  wrap.appendChild(delBtn)
  return wrap
}

function addSection() {
  const value = newSectionInput.value.trim()
  if (!value) return
  sections.push({ id: uid(), title: value, collapsed: false, items: [] })
  newSectionInput.value = ''
  persist()
  render()
}

addSectionBtn.addEventListener('click', addSection)
newSectionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSection()
})

settingsBtn.addEventListener('click', () => {
  document.body.classList.toggle('edit-mode')
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

addBuildBtn.addEventListener('click', () => {
  const name = window.prompt('Nome da nova build:')
  if (name && name.trim()) window.api.createBuild(name.trim())
})

window.api.onBuildsUpdated(({ builds, activeBuildId, sections: updated }) => {
  renderBuildSelect({ builds, activeBuildId })
  sections = updated
  render()
})

window.api.loadBuilds().then((state) => {
  renderBuildSelect(state)
})

addRegexBtn.addEventListener('click', () => {
  regexAddForm.classList.toggle('hidden')
  if (!regexAddForm.classList.contains('hidden')) regexLabelInput.focus()
})

function confirmAddRegex() {
  const label = regexLabelInput.value.trim()
  const pattern = regexPatternInput.value.trim()
  if (!label || !pattern) return
  regexes.push({ id: uid(), label, pattern })
  window.api.saveRegexes(regexes)
  renderRegexes()
  regexLabelInput.value = ''
  regexPatternInput.value = ''
  regexAddForm.classList.add('hidden')
}

regexConfirmBtn.addEventListener('click', confirmAddRegex)
regexPatternInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmAddRegex()
})
regexLabelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') regexPatternInput.focus()
})

window.api.loadRegexes().then((loaded) => {
  regexes = loaded
  renderRegexes()
})

window.api.loadItems().then((loaded) => {
  sections = loaded
  render()
})
