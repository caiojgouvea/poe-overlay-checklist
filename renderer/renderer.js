let items = []

const listEl = document.getElementById('list')
const newItemInput = document.getElementById('new-item-input')
const addBtn = document.getElementById('add-btn')
const lockIndicator = document.getElementById('lock-indicator')

function nextId() {
  return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1
}

function persist() {
  window.api.saveItems(items)
}

function render() {
  listEl.innerHTML = ''
  for (const item of items) {
    const li = document.createElement('li')
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
    text.contentEditable = 'true'
    text.spellcheck = false
    text.innerText = item.text
    text.addEventListener('blur', () => {
      item.text = text.innerText.trim() || item.text
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
      items = items.filter(i => i.id !== item.id)
      persist()
      render()
    })

    li.appendChild(checkbox)
    li.appendChild(text)
    li.appendChild(delBtn)
    listEl.appendChild(li)
  }
}

function addItem() {
  const value = newItemInput.value.trim()
  if (!value) return
  items.push({ id: nextId(), text: value, done: false })
  newItemInput.value = ''
  persist()
  render()
}

addBtn.addEventListener('click', addItem)
newItemInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addItem()
})

window.api.onModeChanged((interactive) => {
  document.body.classList.toggle('unlocked', interactive)
  lockIndicator.innerText = interactive ? '🔓' : '🔒'
})

window.api.loadItems().then((loaded) => {
  items = loaded
  render()
})
