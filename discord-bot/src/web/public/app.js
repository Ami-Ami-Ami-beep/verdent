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
    } else {
      el.value = value ?? '';
    }
  });
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
    } else if (el.type === 'number') {
      value = Number.parseInt(el.value, 10) || 0;
    } else {
      value = el.value;
    }
    setPath(cfg, el.dataset.path, value);
  });
  return cfg;
}

// Feature-Karten ausgrauen, wenn ihr Haupt-Schalter aus ist.
function updateDisabledCards() {
  document.querySelectorAll('.card[data-feature]').forEach((card) => {
    const toggle = card.querySelector(`[data-path="${card.dataset.feature}.enabled"]`);
    card.classList.toggle('disabled', !toggle.checked);
  });
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
