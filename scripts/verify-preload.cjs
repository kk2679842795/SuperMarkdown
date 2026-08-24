window.__errs = []
window.addEventListener('error', (e) => {
  window.__errs.push('ERR: ' + (e.error && e.error.stack ? e.error.stack : e.message))
})
window.addEventListener('unhandledrejection', (e) => {
  window.__errs.push('REJ: ' + (e.reason && e.reason.stack ? e.reason.stack : String(e.reason)))
})
