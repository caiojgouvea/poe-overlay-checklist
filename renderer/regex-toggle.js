document.body.dataset.theme = localStorage.getItem('theme') || 'pink'

document.getElementById('regex-toggle-btn').addEventListener('click', () => {
  window.api.toggleRegexWindow()
})
