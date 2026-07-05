/* ═══════════════════════════════════════════════════════
   ГЕНЕРАТОР ШАХМАТКИ — "Слова И Лица"  (версия для GitHub Pages)
   ═══════════════════════════════════════════════════════ */

const AGENCY = {
  name: "Слова И Лица",
  subtitle: "Актёрское агентство важных слов и талантливых лиц",
  phone: "+7 (995) 890-79-42",
  email: "wordsandfaces@yandex.ru",
  site: "wordsandfaces.ru",
};

/* ─────────── Утилиты ─────────── */

function esc(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ─────────── Обложка ─────────── */

function renderCover() {
  return `
    <div class="cover">
      <div class="cover__logo">
        <div class="cover__top">СЛОВА</div>
        <div class="cover__and">И</div>
        <div class="cover__bottom">ЛИЦА</div>
      </div>
      <div class="cover__line"></div>
      <div class="cover__sub">${esc(AGENCY.subtitle)}</div>
      <div class="cover__contacts">
        Телефон: ${esc(AGENCY.phone)}<br>
        <a href="mailto:${esc(AGENCY.email)}">${esc(AGENCY.email)}</a><br>
        <a href="https://${esc(AGENCY.site)}">${esc(AGENCY.site)}</a>
      </div>
      <div class="cover__date">Обновлено: ${todayStr()}</div>
    </div>
  `;
}

/* ─────────── Строка характеристики ─────────── */

function statRow(label, value) {
  if (value == null || String(value).trim() === "") return "";
  return `<div class="profile__stat"><b>${esc(label)}</b><span>${esc(value)}</span></div>`;
}

/* ─────────── Фильмография ─────────── */

function renderFilms(face) {
  const films = face.filmography || face.films;
  if (!films) return "";

  let items = [];

  if (Array.isArray(films)) {
    items = films.map(f => {
      if (typeof f === "string") return `<li>${esc(f)}</li>`;
      const year = f.year ? `<span class="year">${esc(f.year)}</span>` : "";
      const title = esc(f.title || "");
      const role = f.role ? ` — ${esc(f.role)}` : "";
      return `<li>${year}${title}${role}</li>`;
    });
  } else if (typeof films === "string") {
    items = films
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => `<li>${esc(l)}</li>`);
  }

  if (!items.length) return "";
  return `
    <div class="profile__films-title">Фильмография</div>
    <ul class="profile__films">${items.join("")}</ul>
  `;
}

/* ─────────── Карточка актёра ─────────── */

function renderProfile(face) {
  const genderLabel = face.gender
    ? (face.gender.toLowerCase().startsWith("м") ? "Актёр" : "Актриса")
    : "";

  const eduBlock = face.education
    ? `<div class="profile__edu"><b>Образование:</b> ${esc(face.education)}</div>`
    : "";

  return `
    <div class="profile">
      <img class="profile__photo" src="${esc(face.photo || "")}" alt="${esc(face.name || "")}"
           onerror="this.classList.add('profile__photo--empty');" />
      <div class="profile__body">
        <div class="profile__name">${esc(face.name || "")}</div>
        ${genderLabel ? `<span class="profile__gender">${genderLabel}</span>` : ""}
        <div class="profile__stats">
          ${statRow("Город", face.city)}
          ${statRow("Возраст", face.age)}
          ${statRow("Рост", face.height ? face.height + " см" : "")}
          ${statRow("Телосложение", face.bodyType)}
          ${statRow("Цвет глаз", face.eyeColor)}
          ${statRow("Цвет волос", face.hairColor)}
          ${statRow("Длина волос", face.hairLength)}
        </div>
        ${eduBlock}
        ${renderFilms(face)}
      </div>
    </div>
  `;
}

/* ─────────── Инициализация ─────────── */

function initSheet() {
  const sheet = document.getElementById("sheet");
  const countEl = document.getElementById("sheetCount");
  if (!sheet) return;

  const faces = (window.FACES_DATA || []).filter(f => f && !f.noModal && f.name);
  faces.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ru"));

  if (countEl) countEl.textContent = `Актёров: ${faces.length}`;

  if (!faces.length) {
    sheet.innerHTML = renderCover() +
      `<div style="text-align:center;padding:40px;color:#999;font-size:14px;">
        Список актёров пуст. Проверьте, что файл faces.js подключён ДО sheet.js и содержит массив FACES_DATA.
      </div>`;
    return;
  }

  sheet.innerHTML = renderCover() + faces.map(renderProfile).join("");

  // ── Разбивка по 2 карточки на страницу ──
  // Считаем ТОЛЬКО карточки (обложка не участвует в нумерации),
  // поэтому пары больше не сбиваются.
  const profiles = sheet.querySelectorAll(".profile");
  profiles.forEach((p, i) => {
    if (i % 2 === 0) p.classList.add("profile--page-start");
  });
}

/* ─────────── Печать / сохранение в PDF ─────────── */

async function printSheet() {
  const btn = document.getElementById("pdfBtn");
  const original = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "Подготовка..."; }

  try {
    // ждём, пока все фото догрузятся, чтобы они попали в печать
    const imgs = [...document.querySelectorAll("#sheet img")];
    await Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => { img.onload = res; img.onerror = res; });
    }));

    await new Promise(r => setTimeout(r, 200));

    // открываем диалог печати браузера
    window.print();
  } catch (err) {
    console.error("Ошибка печати:", err);
    alert("Ошибка при подготовке к печати: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}

/* ─────────── События ─────────── */

document.addEventListener("DOMContentLoaded", () => {
  initSheet();

  const pdfBtn = document.getElementById("pdfBtn");
  if (pdfBtn) pdfBtn.addEventListener("click", printSheet);
});