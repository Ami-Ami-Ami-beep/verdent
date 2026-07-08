// Dashboard-Frontend: Login, Server-Auswahl, Konfiguration laden/speichern.

const $ = (sel) => document.querySelector(sel);
const api = (path, opts) =>
  fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Fehler');
    return data;
  });

let currentGuild = null;
let currentConfig = null;
let currentMeta = null;
let dirty = false;

// ── Login / Session ──────────────────────────────────────
async function init() {
  const { authed } = await api('/api/session');
  if (authed) showApp();
  else showLogin();
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

async function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await loadGuilds();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) });
    showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

$('#selfrole-add').addEventListener('click', () => {
  addSelfRoleRow();
  markDirty();
});

$('#ticket-type-add').addEventListener('click', () => {
  addTicketTypeBlock();
  markDirty();
});

$('#app-type-add').addEventListener('click', () => {
  addAppTypeBlock();
  markDirty();
});

$('#autoresponder-add').addEventListener('click', () => {
  addAutoresponderRow();
  markDirty();
});

// ── Bot-Verwaltung (oben rechts) ─────────────────────────
$('#bots-btn').addEventListener('click', async () => {
  $('#bots-modal').classList.remove('hidden');
  await loadBots();
});
$('#bots-close').addEventListener('click', () => $('#bots-modal').classList.add('hidden'));
$('#bots-modal').addEventListener('click', (e) => {
  if (e.target.id === 'bots-modal') $('#bots-modal').classList.add('hidden');
});

async function loadBots() {
  const list = $('#bots-list');
  list.innerHTML = '<div class="bots-empty">Lade …</div>';
  try {
    const bots = await api('/api/bots');
    if (!bots.length) {
      list.innerHTML = '<div class="bots-empty">Noch keine Bots. Füge unten einen hinzu. 👇</div>';
      return;
    }
    list.innerHTML = '';
    bots.forEach((b) => {
      const row = document.createElement('div');
      row.className = 'bot-row';
      const name = b.tag ? esc(b.tag) : b.label ? esc(b.label) : 'Bot #' + b.id;
      row.innerHTML = `
        <span class="bot-dot ${b.online ? 'on' : 'off'}"></span>
        <div class="bot-info">
          <div class="bot-name">${name}</div>
          <div class="bot-sub">${b.online ? 'Online' : 'Offline'} · Token ${b.tokenHint}</div>
        </div>
        <button class="btn-ghost bot-remove">Entfernen</button>`;
      row.querySelector('.bot-remove').addEventListener('click', async () => {
        if (!confirm('Diesen Bot wirklich entfernen und stoppen?')) return;
        await api('/api/bots/' + b.id, { method: 'DELETE' }).catch(() => {});
        await loadBots();
        await loadGuilds();
      });
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = '<div class="bots-empty">Fehler: ' + e.message + '</div>';
  }
}

$('#bot-add-btn').addEventListener('click', async () => {
  const token = $('#bot-token').value.trim();
  const label = $('#bot-label').value.trim();
  const status = $('#bot-add-status');
  const btn = $('#bot-add-btn');
  if (!token) { status.textContent = 'Bitte einen Token eingeben.'; return; }
  btn.disabled = true;
  status.textContent = '⏳ Bot wird gestartet …';
  try {
    const res = await api('/api/bots', { method: 'POST', body: JSON.stringify({ token, label }) });
    status.textContent = '✅ Hinzugefügt: ' + (res.bot.tag || 'Bot #' + res.bot.id);
    $('#bot-token').value = '';
    $('#bot-label').value = '';
    await loadBots();
    await loadGuilds();
  } catch (e) {
    status.textContent = '❌ ' + e.message;
  } finally {
    btn.disabled = false;
  }
});

// ── Server-Auswahl ───────────────────────────────────────
async function loadGuilds() {
  const guilds = await api('/api/guilds');
  const select = $('#guild-select');
  select.innerHTML = '<option value="">— Server wählen —</option>';
  for (const g of guilds) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  }
  if (guilds.length === 0) {
    $('#no-guild').textContent = 'Der Bot ist noch auf keinem Server. Lade ihn zuerst ein.';
  }
}

$('#guild-select').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) {
    $('#config').classList.add('hidden');
    $('#no-guild').classList.remove('hidden');
    hideSaveBar();
    return;
  }
  await selectGuild(id);
});

async function selectGuild(id) {
  currentGuild = id;
  [currentMeta, currentConfig] = await Promise.all([
    api(`/api/guilds/${id}/meta`),
    api(`/api/guilds/${id}/config`)
  ]);
  $('#no-guild').classList.add('hidden');
  $('#config').classList.remove('hidden');
  populateSelects();
  fillForm();
  hideSaveBar();
}

// Befüllt die <select data-source="...">-Felder mit Kanälen/Rollen/Kategorien.
function populateSelects() {
  document.querySelectorAll('[data-source]').forEach((el) => {
    const source = el.dataset.source;
    const items = currentMeta[source] || [];
    const multi = el.multiple;
    el.innerHTML = multi ? '' : '<option value="">— keiner —</option>';
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = (source === 'roles' ? '@' : source === 'categories' ? '' : '#') + it.name;
      el.appendChild(opt);
    }
  });
}

// ── Formular <-> Konfig ──────────────────────────────────
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

function fillForm() {
  document.querySelectorAll('[data-path]').forEach((el) => {
    const value = getPath(currentConfig, el.dataset.path);
    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else if (el.multiple) {
      const set = new Set(value || []);
      [...el.options].forEach((o) => (o.selected = set.has(o.value)));
    } else if (el.dataset.list !== undefined) {
      el.value = Array.isArray(value) ? value.join(', ') : '';
    } else if (el.dataset.lines !== undefined) {
      el.value = Array.isArray(value) ? value.join('\n') : '';
    } else {
      el.value = value ?? '';
    }
  });
  renderSelfRoles();
  renderTicketTypes();
  renderAppTypes();
  renderAutoresponders();
  updateDisabledCards();
}

function readForm() {
  const cfg = structuredClone(currentConfig);
  document.querySelectorAll('[data-path]').forEach((el) => {
    let value;
    if (el.type === 'checkbox') {
      value = el.checked;
    } else if (el.multiple) {
      value = [...el.selectedOptions].map((o) => o.value);
    } else if (el.dataset.list !== undefined) {
      value = el.value.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (el.dataset.lines !== undefined) {
      value = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
    } else if (el.type === 'number') {
      value = Number.parseInt(el.value, 10) || 0;
    } else {
      value = el.value;
    }
    setPath(cfg, el.dataset.path, value);
  });
  cfg.selfRoles = readSelfRoles();
  cfg.tickets.types = readTicketTypes();
  cfg.applications.types = readAppTypes();
  cfg.autoresponders = readAutoresponders();
  return cfg;
}

// Feature-Karten ausgrauen, wenn ihr Haupt-Schalter aus ist.
function updateDisabledCards() {
  document.querySelectorAll('.card[data-feature]').forEach((card) => {
    const toggle = card.querySelector(`[data-path="${card.dataset.feature}.enabled"]`);
    if (!toggle) return; // Karten ohne eigenen Schalter (z. B. Selbstrollen) überspringen
    card.classList.toggle('disabled', !toggle.checked);
  });
}

// ── Optionen-Helfer für dynamische Editoren ──────────────
const esc = (s) => String(s || '').replace(/"/g, '&quot;');

function roleOptionsHtml(selectedId) {
  const roles = currentMeta?.roles || [];
  return ['<option value="">— Rolle wählen —</option>']
    .concat(roles.map((r) => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>@${r.name}</option>`))
    .join('');
}
function channelOptionsHtml(selectedId) {
  const chans = currentMeta?.textChannels || [];
  return ['<option value="">— Kanal wählen —</option>']
    .concat(chans.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>#${c.name}</option>`))
    .join('');
}
function categoryOptionsHtml(selectedId) {
  const cats = currentMeta?.categories || [];
  return ['<option value="">— keine Kategorie —</option>']
    .concat(cats.map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`))
    .join('');
}
function roleMultiOptionsHtml(selectedIds = []) {
  const set = new Set(selectedIds);
  return (currentMeta?.roles || [])
    .map((r) => `<option value="${r.id}" ${set.has(r.id) ? 'selected' : ''}>@${r.name}</option>`)
    .join('');
}

// ── Ticket-Arten-Editor ──────────────────────────────────
function addTicketTypeBlock(entry = {}) {
  const editor = $('#ticket-types-editor');
  const block = document.createElement('div');
  block.className = 'type-block';
  block.dataset.id = entry.id || '';
  block.innerHTML = `
    <div class="type-head">
      <input class="tt-emoji" placeholder="🎫" maxlength="40" value="${esc(entry.emoji)}" />
      <input class="tt-name" placeholder="Name der Art (z. B. Support)" maxlength="60" value="${esc(entry.name)}" />
      <button type="button" class="btn-ghost tt-remove">✕</button>
    </div>
    <label>Kategorie<select class="tt-category">${categoryOptionsHtml(entry.categoryId)}</select></label>
    <label>Team-Rollen (Mehrfachauswahl)<select class="tt-roles" multiple size="3">${roleMultiOptionsHtml(entry.staffRoleIds)}</select></label>
    <label>Begrüßung im Ticket<textarea class="tt-welcome" rows="2">${esc(entry.welcomeMessage)}</textarea></label>`;
  block.querySelector('.tt-remove').addEventListener('click', () => { block.remove(); markDirty(); });
  editor.appendChild(block);
}
function renderTicketTypes() {
  const editor = $('#ticket-types-editor');
  if (!editor) return;
  editor.innerHTML = '';
  (currentConfig.tickets?.types || []).forEach((t) => addTicketTypeBlock(t));
}
function readTicketTypes() {
  return [...document.querySelectorAll('#ticket-types-editor .type-block')]
    .map((b) => ({
      id: b.dataset.id,
      name: b.querySelector('.tt-name').value.trim(),
      emoji: b.querySelector('.tt-emoji').value.trim(),
      categoryId: b.querySelector('.tt-category').value,
      staffRoleIds: [...b.querySelector('.tt-roles').selectedOptions].map((o) => o.value),
      welcomeMessage: b.querySelector('.tt-welcome').value
    }))
    .filter((t) => t.name);
}

// ── Bewerbungs-Arten-Editor ──────────────────────────────
function addAppTypeBlock(entry = {}) {
  const editor = $('#app-types-editor');
  const block = document.createElement('div');
  block.className = 'type-block';
  block.dataset.id = entry.id || '';
  block.innerHTML = `
    <div class="type-head">
      <input class="at-emoji" placeholder="📝" maxlength="40" value="${esc(entry.emoji)}" />
      <input class="at-name" placeholder="Name der Art (z. B. Moderator)" maxlength="60" value="${esc(entry.name)}" />
      <button type="button" class="btn-ghost at-remove">✕</button>
    </div>
    <label>Review-Kanal<select class="at-review">${channelOptionsHtml(entry.reviewChannelId)}</select></label>
    <label>Rolle bei Annahme (optional)<select class="at-role">${roleOptionsHtml(entry.acceptedRoleId)}</select></label>
    <label>Fragen (eine pro Zeile, max. 5)<textarea class="at-questions" rows="3" placeholder="Wie alt bist du?&#10;Warum du?">${esc((entry.questions || []).join('\n'))}</textarea></label>`;
  block.querySelector('.at-remove').addEventListener('click', () => { block.remove(); markDirty(); });
  editor.appendChild(block);
}
function renderAppTypes() {
  const editor = $('#app-types-editor');
  if (!editor) return;
  editor.innerHTML = '';
  (currentConfig.applications?.types || []).forEach((t) => addAppTypeBlock(t));
}
function readAppTypes() {
  return [...document.querySelectorAll('#app-types-editor .type-block')]
    .map((b) => ({
      id: b.dataset.id,
      name: b.querySelector('.at-name').value.trim(),
      emoji: b.querySelector('.at-emoji').value.trim(),
      reviewChannelId: b.querySelector('.at-review').value,
      acceptedRoleId: b.querySelector('.at-role').value,
      questions: b.querySelector('.at-questions').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5)
    }))
    .filter((t) => t.name);
}

function addSelfRoleRow(entry = { roleId: '', label: '', emoji: '' }) {
  const editor = $('#selfroles-editor');
  const row = document.createElement('div');
  row.className = 'selfrole-row';
  row.innerHTML = `
    <select class="sr-role">${roleOptionsHtml(entry.roleId)}</select>
    <input class="sr-label" placeholder="Label (Button-Text)" maxlength="80" value="${(entry.label || '').replace(/"/g, '&quot;')}" />
    <input class="sr-emoji" placeholder="Emoji" maxlength="40" value="${(entry.emoji || '').replace(/"/g, '&quot;')}" />
    <button type="button" class="btn-ghost sr-remove">✕</button>`;
  row.querySelector('.sr-remove').addEventListener('click', () => {
    row.remove();
    markDirty();
  });
  editor.appendChild(row);
}

function renderSelfRoles() {
  const editor = $('#selfroles-editor');
  if (!editor) return;
  editor.innerHTML = '';
  (currentConfig.selfRoles || []).forEach((r) => addSelfRoleRow(r));
}

function readSelfRoles() {
  return [...document.querySelectorAll('.selfrole-row')]
    .map((row) => ({
      roleId: row.querySelector('.sr-role').value,
      label: row.querySelector('.sr-label').value.trim(),
      emoji: row.querySelector('.sr-emoji').value.trim()
    }))
    .filter((r) => r.roleId);
}

// ── Autoresponder-Editor ─────────────────────────────────
function addAutoresponderRow(entry = { trigger: '', response: '' }) {
  const editor = $('#autoresponder-editor');
  const row = document.createElement('div');
  row.className = 'ar-row';
  row.innerHTML = `
    <input class="ar-trigger" placeholder="Auslöser-Wort" maxlength="100" value="${esc(entry.trigger)}" />
    <input class="ar-response" placeholder="Antwort des Bots" maxlength="1000" value="${esc(entry.response)}" />
    <button type="button" class="btn-ghost ar-remove">✕</button>`;
  row.querySelector('.ar-remove').addEventListener('click', () => { row.remove(); markDirty(); });
  editor.appendChild(row);
}
function renderAutoresponders() {
  const editor = $('#autoresponder-editor');
  if (!editor) return;
  editor.innerHTML = '';
  (currentConfig.autoresponders || []).forEach((a) => addAutoresponderRow(a));
}
function readAutoresponders() {
  return [...document.querySelectorAll('.ar-row')]
    .map((row) => ({
      trigger: row.querySelector('.ar-trigger').value.trim(),
      response: row.querySelector('.ar-response').value.trim()
    }))
    .filter((a) => a.trigger && a.response);
}

// ── Änderungen erkennen / speichern ──────────────────────
document.addEventListener('change', (e) => {
  if (!e.target.closest('#config')) return;
  updateDisabledCards();
  markDirty();
});
document.addEventListener('input', (e) => {
  if (!e.target.closest('#config')) return;
  markDirty();
});

function markDirty() {
  dirty = true;
  $('#save-bar').classList.remove('hidden');
  $('#save-status').textContent = 'Es gibt ungespeicherte Änderungen.';
  $('#save-btn').disabled = false;
}
function hideSaveBar() {
  dirty = false;
  $('#save-bar').classList.add('hidden');
}

$('#save-btn').addEventListener('click', async () => {
  const btn = $('#save-btn');
  btn.disabled = true;
  $('#save-status').textContent = 'Speichere …';
  try {
    const cfg = readForm();
    const res = await api(`/api/guilds/${currentGuild}/config`, {
      method: 'POST',
      body: JSON.stringify(cfg)
    });
    currentConfig = res.config;
    fillForm();
    hideSaveBar();
  } catch (err) {
    $('#save-status').textContent = 'Fehler: ' + err.message;
    btn.disabled = false;
  }
});

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

init();
