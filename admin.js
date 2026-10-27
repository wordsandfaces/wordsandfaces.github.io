/* ═══════════════════════════════════════════════════════
   АДМИН-ПАНЕЛЬ «СЛОВА И ЛИЦА»
   Правка faces.js с коммитом в GitHub через API.

   Логика:
   1. Вход по GitHub fine-grained token (право Contents: RW).
   2. Правки держатся в памяти + localStorage-настройках.
   3. «Сохранить в GitHub» делает PUT /contents/faces.js →
      GitHub Pages пересобирает сайт (~1 мин).
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────── НАСТРОЙКИ ─────────── */

const SETTINGS_KEY = 'waf-admin-settings';
const TOKEN_KEY    = 'waf-admin-token';

const DEFAULT_SETTINGS = {
  owner:  'wordsandfaces',
  repo:   'wordsandfaces.github.io',
  branch: 'main',
  path:   'faces.js',
};

let settings = loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
  } catch (e) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}
function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ─────────── СОСТОЯНИЕ ─────────── */

const state = {
  data: [],
  original: [],
  selected: 0,
  dirty: false,
  token: '',
  user: null,
};

/* ─────────── DOM ─────────── */

const $ = (id) => document.getElementById(id);

const gate        = $('gate');
const gateToken   = $('gateToken');
const gateRemember= $('gateRemember');
const gateBtn     = $('gateBtn');
const gateErr     = $('gateErr');

const panel       = $('panel');
const statusEl    = $('status');

const searchInput = $('search');
const listItems   = $('listItems');
const listFoot    = $('listFoot');
const editor      = $('editor');

const jsonArea    = $('jsonArea');
const jsonInfo    = $('jsonInfo');

const fileInput   = $('fileInput');
const toastEl     = $('toast');

/* ─────────── УТИЛИТЫ ─────────── */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

/** base64 для UTF-8 (по чанкам, чтобы не переполнить стек) */
function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

let toastTimer = null;
function toast(msg, type) {
  toastEl.innerHTML = msg;
  toastEl.setAttribute('data-type', type || '');
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.setAttribute('data-type', type || '');
}

/* ─────────── ТРАНСЛИТЕРАЦИЯ (как в script.js) ─────────── */

const TRANSLIT_MAP = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e',
  ж:'zh', з:'z', и:'i', й:'y', к:'k', л:'l', м:'m',
  н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u',
  ф:'f', х:'kh', ц:'ts', ч:'ch', ш:'sh', щ:'shch',
  ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya',
};

function actorSlug(name) {
  let slug = String(name || '')
    .toLowerCase()
    .split('')
    .map(ch => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === 'faces' || slug === 'contacts') slug += '-actor';
  return slug;
}

/* ─────────── СЕРИАЛИЗАЦИЯ В ФОРМАТ faces.js ─────────── */

const FIELD_ORDER = [
  'name', 'gender', 'age', 'city', 'photo', 'education',
  'hairColor', 'hairLength', 'eyeColor', 'height', 'bodyType',
  'gallery', 'video', 'filmtoolz', 'noModal', 'telegram',
];

function q(str) {
  return JSON.stringify(String(str == null ? '' : str));
}

function serializeFace(face) {
  const known = FIELD_ORDER.filter(k => k in face);
  const rest  = Object.keys(face).filter(k => FIELD_ORDER.indexOf(k) === -1);
  const keys  = known.concat(rest);

  const lines = keys.map((k) => {
    const v = face[k];
    if (Array.isArray(v)) {
      if (!v.length) return '    ' + k + ': []';
      return '    ' + k + ': [\n' +
        v.map(x => '      ' + q(x)).join(',\n') +
        '\n    ]';
    }
    if (typeof v === 'number' || typeof v === 'boolean') return '    ' + k + ': ' + v;
    return '    ' + k + ': ' + q(v);
  });

  return '  {\n' + lines.join(',\n') + '\n  }';
}

function serialize(data) {
  return '\nwindow.FACES_DATA = [\n\n' +
    data.map(serializeFace).join(',\n\n') +
    '\n];\n';
}

/** Разбор текста файла faces.js (или голого массива) */
function parseFacesText(text) {
  let src = String(text || '').trim();
  if (!src) throw new Error('Пустой текст');

  if (!/FACES_DATA/.test(src)) {
    src = 'window.FACES_DATA = ' + src + ';';
  }

  const fn = new Function('window', src + '\n;return window.FACES_DATA;');
  const data = fn({});

  if (!Array.isArray(data)) throw new Error('FACES_DATA не является массивом');
  return data;
}

/* ─────────── ГЛУБОКИЕ ССЫЛКИ ─────────── */

const DEFAULT_FACE = {
  name: 'Новый актёр',
  gender: 'мужской',
  age: 25,
  city: 'Москва',
  photo: '',
  education: '',
  hairColor: '',
  hairLength: '',
  eyeColor: '',
  height: 175,
  bodyType: 'Стройное',
  gallery: [],
  video: '',
  filmtoolz: '',
};

/* ─────────── РЕНДЕР СПИСКА ─────────── */

function matchFace(face, query) {
  if (!query) return true;
  const q2 = query.toLowerCase();
  return String(face.name || '').toLowerCase().includes(q2)
      || String(face.city || '').toLowerCase().includes(q2)
      || String(face.education || '').toLowerCase().includes(q2);
}

function renderList() {
  const query = searchInput.value.trim();
  const shown = [];

  listItems.innerHTML = '';
  state.data.forEach((face, index) => {
    if (!matchFace(face, query)) return;
    shown.push(index);

    const el = document.createElement('div');
    el.className = 'item' + (index === state.selected ? ' active' : '');
    el.dataset.index = String(index);

    const sub = [face.city, face.age ? face.age + ' лет' : ''].filter(Boolean).join(' · ');

    el.innerHTML =
      '<img class="item__thumb" src="' + escapeHtml(face.photo || '') + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'" />' +
      '<div class="item__body">' +
        '<div class="item__name">' + escapeHtml(face.name || '—') + '</div>' +
        '<div class="item__sub">' + escapeHtml(sub || '&nbsp;') + '</div>' +
      '</div>' +
      (face.noModal ? '<span class="item__badge">скрыт</span>' : '');

    el.addEventListener('click', () => selectFace(index));
    listItems.appendChild(el);
  });

  if (!shown.length) {
    listItems.innerHTML = '<div class="editor__empty" style="padding:40px 10px;font-size:13px">Ничего не найдено</div>';
  }

  listFoot.textContent = 'Всего записей: ' + state.data.length +
    (query ? ' · найдено: ' + shown.length : '') +
    (state.dirty ? ' · есть несохранённые правки' : '');
}

function selectFace(index) {
  state.selected = index;
  renderList();
  renderEditor();
}

/* ─────────── РЕНДЕР РЕДАКТОРА ─────────── */

const FIELD_DEFS = [
  { key: 'name',       label: 'Имя',                         type: 'text' },
  { key: 'gender',     label: 'Пол',                         type: 'select', options: ['мужской', 'женский'] },
  { key: 'age',        label: 'Возраст',                     type: 'number' },
  { key: 'city',       label: 'Город',                       type: 'text' },
  { key: 'height',     label: 'Рост, см',                    type: 'number' },
  { key: 'bodyType',   label: 'Телосложение',                type: 'text' },
  { key: 'hairColor',  label: 'Цвет волос',                  type: 'text' },
  { key: 'hairLength', label: 'Длина волос',                 type: 'text' },
  { key: 'eyeColor',   label: 'Цвет глаз',                   type: 'text' },
  { key: 'education',  label: 'Образование',                 type: 'text' },
  { key: 'photo',      label: 'Главное фото (URL или файл)', type: 'text', wide: true },
  { key: 'gallery',    label: 'Галерея — по одному URL в строке', type: 'lines', wide: true },
  { key: 'video',      label: 'Видеовизитка (URL .mp4 или YouTube)', type: 'text', wide: true },
  { key: 'filmtoolz',  label: 'Filmtoolz / ссылка на материалы',    type: 'text', wide: true },
  { key: 'telegram',   label: 'Telegram',                    type: 'text' },
  { key: 'noModal',    label: 'Скрыть из сетки (показывать только в контактах)', type: 'bool' },
];

function renderEditor() {
  const face = state.data[state.selected];

  if (!face) {
    editor.innerHTML = '<div class="editor__empty">Выберите актёра слева</div>';
    return;
  }

  const slug = actorSlug(face.name);
  const idx = state.selected;

  let html = '';

  /* превью */
  html += '<div class="preview">' +
    '<img src="' + escapeHtml(face.photo || '') + '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
    '<div class="preview__meta">' +
      '<div class="preview__name">' + escapeHtml(face.name || '—') + '</div>' +
      '<div class="preview__line">' + escapeHtml([face.city, face.age ? face.age + ' лет' : '', face.height ? face.height + ' см' : ''].filter(Boolean).join(' · ') || '—') + '</div>' +
      '<div class="preview__line">' + escapeHtml(face.education || '') + '</div>' +
      '<a class="preview__link" href="index.html?actor=' + encodeURIComponent(slug) + '" target="_blank" rel="noopener">Открыть на сайте ↗</a>' +
    '</div>' +
  '</div>';

  /* шапка */
  html += '<div class="editor__head">' +
    '<div>' +
      '<div class="editor__title">' + escapeHtml(face.name || '—') + '</div>' +
      '<div class="editor__sub">Позиция ' + (idx + 1) + ' из ' + state.data.length + ' · slug: ' + escapeHtml(slug || '—') + '</div>' +
    '</div>' +
    '<div class="editor__actions">' +
      '<button class="btn btn--sm" data-act="up" title="Выше">↑</button>' +
      '<button class="btn btn--sm" data-act="down" title="Ниже">↓</button>' +
      '<button class="btn btn--sm" data-act="dup" title="Дублировать">⧉</button>' +
      '<button class="btn btn--sm btn--danger" data-act="del" title="Удалить">✕</button>' +
    '</div>' +
  '</div>';

  /* поля */
  html += '<div class="editor__section">Основное</div><div class="editor__grid">';
  FIELD_DEFS.forEach((def) => {
    if (def.key === 'gallery' || def.key === 'video' || def.key === 'filmtoolz') return;
    html += renderField(def, face);
  });
  html += '</div>';

  html += '<div class="editor__section">Медиа и ссылки</div><div class="editor__grid">';
  FIELD_DEFS.forEach((def) => {
    if (def.key !== 'gallery' && def.key !== 'video' && def.key !== 'filmtoolz') return;
    html += renderField(def, face);
  });
  html += '</div>';

  html += '<div class="editor__section">Служебное</div><div class="editor__grid">';
  FIELD_DEFS.forEach((def) => {
    if (def.key !== 'telegram' && def.key !== 'noModal') return;
    html += renderField(def, face);
  });
  html += '</div>';

  editor.innerHTML = html;

  /* обработчики полей */
  editor.querySelectorAll('[data-field]').forEach((input) => {
    const key = input.getAttribute('data-field');

    input.addEventListener('input', () => {
      let value;

      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.getAttribute('data-type') === 'lines') {
        value = input.value.split('\n').map(s => s.trim()).filter(Boolean);
      } else if (input.getAttribute('data-type') === 'number') {
        const n = parseInt(input.value, 10);
        value = isNaN(n) ? '' : n;
      } else {
        value = input.value;
      }

      face[key] = value;
      markDirty();

      if (key === 'name' || key === 'city' || key === 'age' || key === 'photo' || key === 'noModal') {
        renderList();
        refreshPreview(face);
      }
    });
  });

  /* кнопки действий */
  editor.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-act');
      if (act === 'up')   moveFace(-1);
      if (act === 'down') moveFace(1);
      if (act === 'dup')  duplicateFace();
      if (act === 'del')  deleteFace();
    });
  });
}

function renderField(def, face) {
  const value = face[def.key];
  const wide = def.wide ? ' field--wide' : '';

  if (def.type === 'bool') {
    const checked = value === true ? ' checked' : '';
    return '<label class="field' + wide + '">' +
      '<span class="field__label">' + escapeHtml(def.label) + '</span>' +
      '<span class="check" style="padding:8px 0">' +
        '<input type="checkbox" data-field="' + def.key + '"' + checked + ' />' +
        '<span>Да, скрыть</span>' +
      '</span>' +
    '</label>';
  }

  if (def.type === 'select') {
    const opts = def.options.map(o =>
      '<option value="' + escapeHtml(o) + '"' + (value === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>'
    ).join('');
    return '<label class="field' + wide + '">' +
      '<span class="field__label">' + escapeHtml(def.label) + '</span>' +
      '<select data-field="' + def.key + '" data-type="text">' +
        '<option value="">—</option>' + opts +
      '</select>' +
    '</label>';
  }

  if (def.type === 'lines') {
    const lines = Array.isArray(value) ? value.join('\n') : String(value || '');
    return '<label class="field' + wide + '">' +
      '<span class="field__label">' + escapeHtml(def.label) + '</span>' +
      '<textarea data-field="' + def.key + '" data-type="lines" rows="4" spellcheck="false">' +
        escapeHtml(lines) +
      '</textarea>' +
    '</label>';
  }

  const type = def.type === 'number' ? 'number' : 'text';
  const v = value == null ? '' : value;
  return '<label class="field' + wide + '">' +
    '<span class="field__label">' + escapeHtml(def.label) + '</span>' +
    '<input type="' + type + '" data-field="' + def.key + '" data-type="' + def.type + '" value="' + escapeHtml(v) + '" spellcheck="false" />' +
  '</label>';
}

function refreshPreview(face) {
  const wrap = editor.querySelector('.preview');
  if (!wrap) return;
  const img = wrap.querySelector('img');
  const nameEl = wrap.querySelector('.preview__name');
  const lines = wrap.querySelectorAll('.preview__line');
  const link = wrap.querySelector('.preview__link');

  if (img) img.src = face.photo || '';
  if (nameEl) nameEl.textContent = face.name || '—';
  if (lines[0]) lines[0].textContent = [face.city, face.age ? face.age + ' лет' : '', face.height ? face.height + ' см' : ''].filter(Boolean).join(' · ') || '—';
  if (lines[1]) lines[1].textContent = face.education || '';
  if (link) link.href = 'index.html?actor=' + encodeURIComponent(actorSlug(face.name));

  const title = editor.querySelector('.editor__title');
  if (title) title.textContent = face.name || '—';
  const sub = editor.querySelector('.editor__sub');
  if (sub) sub.textContent = 'Позиция ' + (state.selected + 1) + ' из ' + state.data.length + ' · slug: ' + (actorSlug(face.name) || '—');
}

/* ─────────── ОПЕРАЦИИ С КАРТОЧКАМИ ─────────── */

function moveFace(dir) {
  const from = state.selected;
  const to = from + dir;
  if (to < 0 || to >= state.data.length) return;
  const arr = state.data;
  const tmp = arr[from];
  arr[from] = arr[to];
  arr[to] = tmp;
  state.selected = to;
  markDirty();
  renderList();
  renderEditor();
}

function duplicateFace() {
  const src = state.data[state.selected];
  if (!src) return;
  const copy = deepClone(src);
  copy.name = (copy.name || 'Без имени') + ' (копия)';
  state.data.splice(state.selected + 1, 0, copy);
  state.selected += 1;
  markDirty();
  renderList();
  renderEditor();
  toast('Карточка продублирована', 'ok');
}

function deleteFace() {
  const face = state.data[state.selected];
  if (!face) return;
  if (!confirm('Удалить «' + (face.name || 'без имени') + '»?\n\nДействие применится после сохранения в GitHub.')) return;
  state.data.splice(state.selected, 1);
  if (state.selected >= state.data.length) state.selected = Math.max(0, state.data.length - 1);
  markDirty();
  renderList();
  renderEditor();
}

function addFace() {
  const face = deepClone(DEFAULT_FACE);
  state.data.unshift(face);
  state.selected = 0;
  markDirty();
  searchInput.value = '';
  renderList();
  renderEditor();
  toast('Новая карточка добавлена — заполните поля', 'ok');
}

function markDirty() {
  state.dirty = true;
  setStatus('Есть несохранённые правки', 'busy');
  const saveBtn = $('btnSave');
  if (saveBtn) saveBtn.textContent = '💾 Сохранить в GitHub •';
}

function markClean() {
  state.dirty = false;
  setStatus('Всё сохранено', 'ok');
  const saveBtn = $('btnSave');
  if (saveBtn) saveBtn.textContent = '💾 Сохранить в GitHub';
}

/* ─────────── GITHUB API ─────────── */

function ghHeaders() {
  return {
    'Authorization': 'Bearer ' + state.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghValidateToken(token) {
  const res = await fetch('https://api.github.com/user', { headers: {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
  }});
  if (!res.ok) throw new Error('GitHub отклонил токен (' + res.status + ')');
  return res.json();
}

async function ghCheckRepo() {
  const url = 'https://api.github.com/repos/' + settings.owner + '/' + settings.repo;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return { ok: false, reason: 'Репозиторий не найден или нет доступа' };
  if (!res.ok) return { ok: false, reason: 'GitHub: ' + res.status };
  const data = await res.json();
  const canPush = data.permissions ? data.permissions.push === true : null;
  return { ok: true, canPush: canPush, fullName: data.full_name, isPrivate: data.private };
}

async function ghSave() {
  const api = 'https://api.github.com/repos/' + settings.owner + '/' + settings.repo +
    '/contents/' + settings.path.split('/').map(encodeURIComponent).join('/');

  setStatus('Читаю текущую версию из GitHub…', 'busy');

  /* 1. узнаём sha текущего файла */
  const getRes = await fetch(api + '?ref=' + encodeURIComponent(settings.branch) + '&_=' + Date.now(), {
    headers: ghHeaders(),
    cache: 'no-store',
  });

  let sha = null;
  if (getRes.ok) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    const err = await getRes.json().catch(() => ({}));
    throw new Error(err.message || ('GitHub GET: ' + getRes.status));
  }

  /* 2. коммитим новое содержимое */
  const content = serialize(state.data);
  const body = {
    message: 'admin: faces.js — ' + state.data.length + ' записей (' +
             new Date().toLocaleString('ru-RU') + ')',
    content: b64EncodeUtf8(content),
    branch: settings.branch,
  };
  if (sha) body.sha = sha;

  setStatus('Коммичу изменения…', 'busy');

  const putRes = await fetch(api, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    if (putRes.status === 409) {
      throw new Error('Конфликт: файл на GitHub изменился. Обновите страницу и повторите.');
    }
    throw new Error(err.message || ('GitHub PUT: ' + putRes.status));
  }

  const result = await putRes.json();
  return result.commit && result.commit.html_url ? result.commit.html_url : null;
}

/* ─────────── СОХРАНЕНИЕ ─────────── */

async function handleSave() {
  const btn = $('btnSave');
  btn.disabled = true;

  try {
    const commitUrl = await ghSave();
    state.original = deepClone(state.data);
    markClean();
    setStatus('Закоммичено. GitHub Pages пересоберёт сайт за ~1 мин.', 'ok');
    toast(
      'Готово. Коммит отправлен' +
      (commitUrl ? ' — <a href="' + commitUrl + '" target="_blank" rel="noopener">открыть</a>' : '') +
      '.<br>Сайт обновится в течение минуты.',
      'ok'
    );
  } catch (err) {
    console.error(err);
    setStatus('Ошибка: ' + err.message, 'err');
    toast('Не сохранено: ' + escapeHtml(err.message), 'err');
  } finally {
    btn.disabled = false;
  }
}

/* ─────────── JSON-ВКЛАДКА ─────────── */

function refreshJsonTab() {
  jsonArea.value = serialize(state.data);
  jsonInfo.textContent = state.data.length + ' записей · ' + jsonArea.value.length + ' символов';
}

/* ─────────── ВХОД / ВЫХОД ─────────── */

function showPanel() {
  gate.classList.add('hidden');
  panel.classList.remove('hidden');

  state.data = deepClone(window.FACES_DATA || []);
  state.original = deepClone(state.data);
  state.selected = 0;
  state.dirty = false;

  renderList();
  renderEditor();
  refreshJsonTab();
  fillSettingsForm();
  setStatus('Всё сохранено', 'ok');

  checkAccount();
}

function showGate(message) {
  panel.classList.add('hidden');
  gate.classList.remove('hidden');
  if (message) gateErr.textContent = message;
}

async function doLogin() {
  const token = gateToken.value.trim();
  gateErr.textContent = '';

  if (!token) {
    gateErr.textContent = 'Введите токен';
    return;
  }

  gateBtn.disabled = true;
  gateBtn.textContent = 'Проверяю…';

  try {
    const user = await ghValidateToken(token);
    state.token = token;
    state.user = user;

    if (gateRemember.checked) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    gateToken.value = '';
    showPanel();
  } catch (err) {
    gateErr.textContent = err.message;
  } finally {
    gateBtn.disabled = false;
    gateBtn.textContent = 'Войти';
  }
}

function doLogout() {
  if (state.dirty && !confirm('Есть несохранённые правки. Выйти без сохранения?')) return;
  localStorage.removeItem(TOKEN_KEY);
  state.token = '';
  state.user = null;
  state.data = [];
  state.original = [];
  state.dirty = false;
  showGate('');
}

async function checkAccount() {
  const info = $('accountInfo');
  if (!info) return;

  if (!state.user) {
    info.textContent = '—';
    return;
  }

  info.innerHTML = 'Вошли как <b>@' + escapeHtml(state.user.login) + '</b> · проверяю доступ к репозиторию…';

  const repo = await ghCheckRepo().catch(() => ({ ok: false, reason: 'Нет сети' }));

  if (repo.ok) {
    const perm = repo.canPush === true
      ? '<span style="color:#4ea86b">запись разрешена ✓</span>'
      : repo.canPush === false
        ? '<span style="color:#d9534f">только чтение — коммит не пройдёт ✗</span>'
        : '<span style="color:#d9a44f">права не определены</span>';

    info.innerHTML = 'Вошли как <b>@' + escapeHtml(state.user.login) + '</b><br>' +
      'Репозиторий: <b>' + escapeHtml(repo.fullName) + '</b> (' + (repo.isPrivate ? 'private' : 'public') + ')<br>' +
      'Доступ на запись: ' + perm;
  } else {
    info.innerHTML = 'Вошли как <b>@' + escapeHtml(state.user.login) + '</b><br>' +
      '<span style="color:#d9534f">' + escapeHtml(repo.reason) + '</span>';
  }
}

/* ─────────── НАСТРОЙКИ ─────────── */

function fillSettingsForm() {
  $('setOwner').value  = settings.owner;
  $('setRepo').value   = settings.repo;
  $('setBranch').value = settings.branch;
  $('setPath').value   = settings.path;
  $('settingsInfo').textContent = '';
}

function readSettingsForm() {
  settings.owner  = $('setOwner').value.trim()  || DEFAULT_SETTINGS.owner;
  settings.repo   = $('setRepo').value.trim()   || DEFAULT_SETTINGS.repo;
  settings.branch = $('setBranch').value.trim() || DEFAULT_SETTINGS.branch;
  settings.path   = $('setPath').value.trim()   || DEFAULT_SETTINGS.path;
  persistSettings();
}

/* ─────────── ЭКСПОРТ / ИМПОРТ ─────────── */

function downloadFile() {
  const content = serialize(state.data);
  const blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'faces.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast('faces.js скачан', 'ok');
}

function importFile(file) {
  if (!confirm('Заменить текущие данные содержимым файла «' + file.name + '»?\n\nТекущие правки в браузере будут потеряны.')) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = parseFacesText(reader.result);
      state.data = data;
      state.selected = 0;
      markDirty();
      renderList();
      renderEditor();
      refreshJsonTab();
      toast('Загружено ' + data.length + ' записей. Не забудьте сохранить в GitHub.', 'ok');
    } catch (err) {
      toast('Не удалось разобрать файл: ' + escapeHtml(err.message), 'err');
    }
  };

  reader.onerror = () => toast('Ошибка чтения файла', 'err');
  reader.readAsText(file, 'utf-8');
}

/* ─────────── ВКЛАДКИ ─────────── */

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-tab') === name);
  });
  document.querySelectorAll('.pane').forEach(p => {
    p.classList.toggle('active', p.id === 'pane-' + name);
  });

  if (name === 'json') refreshJsonTab();
}

/* ─────────── ИНИЦИАЛИЗАЦИЯ ─────────── */

function init() {
  /* вход */
  gateBtn.addEventListener('click', doLogin);
  gateToken.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  /* вкладки */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
  });

  /* список */
  $('btnAdd').addEventListener('click', addFace);
  searchInput.addEventListener('input', renderList);

  /* сохранение / откат */
  $('btnSave').addEventListener('click', handleSave);
  $('btnRevert').addEventListener('click', () => {
    if (state.dirty && !confirm('Отменить все несохранённые правки?')) return;
    state.data = deepClone(state.original);
    state.selected = Math.min(state.selected, Math.max(0, state.data.length - 1));
    state.dirty = false;
    markClean();
    renderList();
    renderEditor();
    refreshJsonTab();
    toast('Правки отменены', 'ok');
  });

  /* выход */
  $('btnLogout').addEventListener('click', doLogout);
  $('btnLogout2').addEventListener('click', doLogout);

  /* JSON */
  $('btnJsonFormat').addEventListener('click', () => {
    try {
      const data = parseFacesText(jsonArea.value);
      state.data = data;
      refreshJsonTab();
      toast('Синтаксис в порядке, ' + data.length + ' записей', 'ok');
    } catch (err) {
      toast('Ошибка синтаксиса: ' + escapeHtml(err.message), 'err');
    }
  });

  $('btnJsonApply').addEventListener('click', () => {
    try {
      const data = parseFacesText(jsonArea.value);
      if (!Array.isArray(data) || !data.length) throw new Error('Пустой массив');

      state.data = data;
      state.selected = Math.min(state.selected, data.length - 1);
      markDirty();
      renderList();
      renderEditor();
      refreshJsonTab();
      switchTab('form');
      toast('Данные обновлены: ' + data.length + ' записей', 'ok');
    } catch (err) {
      toast('Не применено: ' + escapeHtml(err.message), 'err');
    }
  });

  jsonArea.addEventListener('input', () => {
    jsonInfo.textContent = jsonArea.value.length + ' символов (не применено)';
  });

  /* настройки */
  $('btnSaveSettings').addEventListener('click', () => {
    readSettingsForm();
    $('settingsInfo').textContent = 'Сохранено локально';
    toast('Настройки сохранены', 'ok');
    checkAccount();
  });

  /* файлы */
  $('btnDownload').addEventListener('click', downloadFile);
  $('btnUpload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) importFile(fileInput.files[0]);
    fileInput.value = '';
  });

  /* горячие клавиши */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!panel.classList.contains('hidden')) handleSave();
    }
  });

  /* защита от случайного закрытия */
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* автовход, если токен сохранён */
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    state.token = savedToken;
    ghValidateToken(savedToken)
      .then((user) => {
        state.user = user;
        showPanel();
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        state.token = '';
        showGate('Сохранённый токен больше не действует. Введите новый.');
      });
  } else {
    showGate('');
  }
}

document.addEventListener('DOMContentLoaded', init);
