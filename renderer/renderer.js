let sections = []

const sectionsEl = document.getElementById('sections')
const newSectionInput = document.getElementById('new-section-input')
const addSectionBtn = document.getElementById('add-section-btn')
const settingsBtn = document.getElementById('settings-btn')
const settingsPanel = document.getElementById('settings-panel')
const characterNameInput = document.getElementById('character-name-input')
const closeBtn = document.getElementById('close-btn')

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

function buildSectionEl(section) {
  const wrap = document.createElement('div')
  wrap.className = 'section'

  const header = document.createElement('div')
  header.className = 'section-header'

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

  li.appendChild(checkbox)
  li.appendChild(text)
  li.appendChild(delBtn)
  return li
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
  settingsPanel.classList.toggle('hidden')
})

closeBtn.addEventListener('click', () => {
  window.api.hideWindow()
})

characterNameInput.addEventListener('blur', () => {
  window.api.saveSettings({ characterName: characterNameInput.value.trim() })
})
characterNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') characterNameInput.blur()
})

window.api.loadSettings().then((settings) => {
  characterNameInput.value = settings.characterName || ''
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

window.api.loadItems().then((loaded) => {
  sections = loaded
  render()
})
