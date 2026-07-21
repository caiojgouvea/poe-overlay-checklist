let regexes = []
let editingRegexId = null

const closeBtn = document.getElementById('regex-close-btn')
const regexGridEl = document.getElementById('regex-grid')
const addRegexBtn = document.getElementById('add-regex-btn')
const regexAddForm = document.getElementById('regex-add-form')
const regexLabelInput = document.getElementById('regex-label-input')
const regexPatternInput = document.getElementById('regex-pattern-input')
const regexConfirmBtn = document.getElementById('regex-confirm-btn')

function uid() {
  return crypto.randomUUID()
}

document.body.dataset.theme = localStorage.getItem('theme') || 'pink'

closeBtn.addEventListener('click', () => {
  window.api.hideRegexWindow()
})

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
    startEditRegex(item)
  })

  const delBtn = document.createElement('span')
  delBtn.className = 'regex-del-btn'
  delBtn.innerText = '✕'
  delBtn.title = 'Remove'
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

addRegexBtn.addEventListener('click', () => {
  editingRegexId = null
  regexLabelInput.value = ''
  regexPatternInput.value = ''
  regexAddForm.classList.toggle('hidden')
  if (!regexAddForm.classList.contains('hidden')) regexLabelInput.focus()
})

function startEditRegex(item) {
  editingRegexId = item.id
  regexLabelInput.value = item.label
  regexPatternInput.value = item.pattern
  regexAddForm.classList.remove('hidden')
  regexLabelInput.focus()
}

function confirmAddRegex() {
  const label = regexLabelInput.value.trim()
  const pattern = regexPatternInput.value.trim()
  if (!label || !pattern) return
  if (editingRegexId) {
    const existing = regexes.find((r) => r.id === editingRegexId)
    if (existing) {
      existing.label = label
      existing.pattern = pattern
    }
    editingRegexId = null
  } else {
    regexes.push({ id: uid(), label, pattern })
  }
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
