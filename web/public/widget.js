/* operobot2 website chat widget. Usage: <script src="https://<host>/widget.js" data-key="WIDGET_KEY"></script> */
(function () {
  'use strict'
  var script = document.currentScript
  if (!script) return
  var key = script.getAttribute('data-key')
  if (!key || window.__o2widget) return
  window.__o2widget = true
  var origin = new URL(script.src, location.href).origin
  var base = origin + '/api/widget/' + encodeURIComponent(key) + '/messages'
  var color = script.getAttribute('data-color') || '#0891b2'
  var title = script.getAttribute('data-title') || 'Savolingiz bormi?'

  var visitor
  try { visitor = localStorage.getItem('o2-visitor') } catch (e) { visitor = null }
  if (!visitor) {
    visitor = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    try { localStorage.setItem('o2-visitor', visitor) } catch (e) { /* storage blocked */ }
  }

  var css = '' +
    '.o2w-btn{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;background:' + color + ';color:#fff;box-shadow:0 10px 30px rgba(8,30,60,.3);z-index:2147483000;display:grid;place-items:center;transition:transform .2s}' +
    '.o2w-btn:hover{transform:scale(1.06)}' +
    '.o2w-btn i{position:absolute;top:2px;right:2px;min-width:18px;height:18px;border-radius:9px;background:#db2777;font:700 11px/18px system-ui,sans-serif;font-style:normal;padding:0 5px;display:none}' +
    '.o2w-box{position:fixed;right:20px;bottom:90px;width:340px;max-width:calc(100vw - 24px);height:480px;max-height:calc(100vh - 120px);background:#fff;color:#0e142e;border-radius:16px;box-shadow:0 24px 70px rgba(8,30,60,.28);z-index:2147483000;display:none;flex-direction:column;overflow:hidden;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}' +
    '.o2w-box.open{display:flex}' +
    '.o2w-h{padding:14px 16px;background:' + color + ';color:#fff;display:flex;align-items:center;gap:10px}' +
    '.o2w-h b{flex:1;font-size:15px}.o2w-h small{display:block;font-weight:400;opacity:.85;font-size:12px}' +
    '.o2w-x{background:rgba(255,255,255,.18);border:0;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px}' +
    '.o2w-m{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f4f6fb}' +
    '.o2w-msg{max-width:82%;padding:8px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;background:#fff;border:1px solid rgba(14,20,46,.08);align-self:flex-start}' +
    '.o2w-msg.me{align-self:flex-end;background:' + color + ';color:#fff;border-color:transparent}' +
    '.o2w-msg.sys{align-self:center;background:transparent;border:0;color:#687091;font-size:12px}' +
    '.o2w-f{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(14,20,46,.08)}' +
    '.o2w-f input{flex:1;min-width:0;height:38px;border:1px solid rgba(14,20,46,.16);border-radius:10px;padding:0 12px;font:inherit;outline:0}' +
    '.o2w-f input:focus{border-color:' + color + '}' +
    '.o2w-f button{height:38px;padding:0 14px;border:0;border-radius:10px;background:' + color + ';color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer}' +
    '.o2w-p{font-size:10.5px;color:#9aa1bd;text-align:center;padding:0 0 8px}'
  var style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)

  var btn = document.createElement('button')
  btn.className = 'o2w-btn'
  btn.setAttribute('aria-label', 'Chatni ochish')
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><i></i>'
  var badge = btn.querySelector('i')

  var box = document.createElement('div')
  box.className = 'o2w-box'
  box.setAttribute('role', 'dialog')
  box.innerHTML = '<div class="o2w-h"><b>' + esc(title) + '<small>Odatda bir necha soniyada javob beramiz</small></b><button class="o2w-x" aria-label="Yopish">\u00d7</button></div>' +
    '<div class="o2w-m"></div><form class="o2w-f"><input placeholder="Xabar yozing\u2026" maxlength="2000" aria-label="Xabar"><button>Yuborish</button></form><div class="o2w-p">operobot2</div>'
  document.body.appendChild(btn)
  document.body.appendChild(box)
  var list = box.querySelector('.o2w-m')
  var form = box.querySelector('form')
  var input = form.querySelector('input')

  var seen = {}
  var count = 0
  var open = false
  var timer = null

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  function add(m) {
    if (m.id && seen[m.id]) return false
    if (m.id) seen[m.id] = true
    var d = document.createElement('div')
    d.className = 'o2w-msg' + (m.direction === 'in' ? ' me' : m.author === 'system' ? ' sys' : '')
    d.textContent = m.text
    list.appendChild(d)
    list.scrollTop = list.scrollHeight
    return true
  }
  function poll() {
    fetch(base + '?visitor=' + encodeURIComponent(visitor)).then(function (r) { return r.ok ? r.json() : [] }).then(function (msgs) {
      if (!Array.isArray(msgs)) return
      var fresh = 0
      msgs.forEach(function (m) { if (add(m) && m.direction === 'out') fresh++ })
      if (count === 0 && msgs.length === 0 && !list.childNodes.length) add({ text: 'Assalomu alaykum! Savolingizni yozing.', author: 'ai', direction: 'out' })
      count += msgs.length
      if (!open && fresh) { badge.textContent = String(fresh); badge.style.display = 'block' }
    }).catch(function () { /* offline */ })
  }
  function toggle(v) {
    open = v
    box.classList.toggle('open', v)
    if (v) { badge.style.display = 'none'; input.focus(); poll() }
  }
  btn.addEventListener('click', function () { toggle(!open) })
  box.querySelector('.o2w-x').addEventListener('click', function () { toggle(false) })
  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var text = input.value.trim()
    if (!text) return
    input.value = ''
    var tmp = { text: text, direction: 'in', author: 'contact' }
    add(tmp)
    fetch(base + '?visitor=' + encodeURIComponent(visitor), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, page: location.href }) })
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (m) { if (m && m.id) seen[m.id] = true; setTimeout(poll, 800) })
      .catch(function () { add({ text: 'Xabar yuborilmadi, qayta urinib ko\u2018ring.', author: 'system', direction: 'out' }) })
  })
  poll()
  timer = setInterval(poll, 4000)
  window.addEventListener('pagehide', function () { clearInterval(timer) })
})()
