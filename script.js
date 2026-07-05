/* ═══════════ SCROLL TO TOP ON LOAD ═══════════ */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

/* ═══════════ THEME ═══════════ */
const THEME_KEY = "waf-theme";
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));
})();
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

/* ═══════════ ELEMENTS ═══════════ */
const loader = document.getElementById("loader");
const header = document.getElementById("header");
const logoLink = document.getElementById("logoLink");

const facesGrid = document.getElementById("facesGrid");
const emptyState = document.getElementById("emptyState");
const facesMeta = document.getElementById("facesMeta");

const searchFilter = document.getElementById("searchFilter");
const cityFilter = document.getElementById("cityFilter");
const genderFilter = document.getElementById("genderFilter");
const ageMin = document.getElementById("ageMin");
const ageMax = document.getElementById("ageMax");
const ageMinValue = document.getElementById("ageMinValue");
const ageMaxValue = document.getElementById("ageMaxValue");
const rangeFill = document.getElementById("rangeFill");
const filtersReset = document.getElementById("filtersReset");

const modal = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalMainPhoto = document.getElementById("modalMainPhoto");
const modalGallery = document.getElementById("modalGallery");
const modalName = document.getElementById("modalName");
const modalStats = document.getElementById("modalStats");
const modalVideo = document.getElementById("modalVideo");
const modalFilmtoolz = document.getElementById("modalFilmtoolz");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");

/* ═══════════ STATE ═══════════ */
const LOADER_MIN_TIME = 3200;
const loaderStartTime = Date.now();
let faces = [];
let filteredFaces = [];
let lightboxImages = [];
let lightboxIndex = 0;

/* ═══════════ UTILS ═══════════ */
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ═══════════ AUTO-FIT CARD META (имя / город + возраст) ═══════════ */
/* Логика: сначала пробуем уместить в 1 строку своим размером,
   уменьшая шрифт; если даже на минимуме не влезает — остаётся 2 строки
   (сработает -webkit-line-clamp: 2 в CSS). */
function fitLine(meta, el, varName, max, min) {
  if (!el) return;
  let size = max;
  meta.style.setProperty(varName, size + "px");
  const lh = () => parseFloat(getComputedStyle(el).lineHeight) || size * 1.3;
  while (size > min) {
    const oneLine = el.scrollWidth <= el.clientWidth
      && Math.round(el.scrollHeight / lh()) <= 1;
    if (oneLine) break;
    size -= 0.5;
    meta.style.setProperty(varName, size + "px");
  }
}
function fitCardMeta(meta) {
  const name = meta.querySelector(".face-card__name");
  const sub  = meta.querySelector(".face-card__sub");
  // стартовые максимумы (совпадают с CSS-переменными)
  const isSmall = window.matchMedia("(max-width: 560px)").matches;
  fitLine(meta, name, "--name-fs", isSmall ? 13 : 15, 10);
  fitLine(meta, sub,  "--sub-fs",  isSmall ? 11 : 12, 8);
}
function fitAllCards() {
  document.querySelectorAll(".face-card__meta").forEach(fitCardMeta);
}
// пересчёт при изменении размера окна
let _fitTimer;
window.addEventListener("resize", () => {
  clearTimeout(_fitTimer);
  _fitTimer = setTimeout(fitAllCards, 150);
});

/* ═══════════ SCROLL TO SECTION ═══════════ */
function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return false;
  const offsetPosition = target.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: offsetPosition, behavior: "smooth" });
  return true;
}

/* ═══════════ LOADER ═══════════ */
async function hideLoaderWithMinTime() {
  const remain = Math.max(0, LOADER_MIN_TIME - (Date.now() - loaderStartTime));
  await wait(remain);
  loader.classList.add("done");
  await wait(100);
  header.classList.add("visible");
}

/* ═══════════ LOGO CLICK ═══════════ */
logoLink.addEventListener("click", (e) => {
  e.preventDefault();
  if (!modal.classList.contains("hidden")) closeModal();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (window.location.search) {
    history.replaceState(null, "", window.location.pathname);
  }
});

/* ═══════════ SCROLL ANIMATIONS ═══════════ */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll("[data-animate='fade-up']").forEach(el => observer.observe(el));
}
function initCardAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("in-view"), index * 60);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll(".face-card").forEach(card => observer.observe(card));
}

/* ═══════════ FILTERS ═══════════ */
function showEmptyState() { emptyState.classList.remove("hidden"); facesGrid.innerHTML = ""; }
function hideEmptyState() { emptyState.classList.add("hidden"); }

function fillCityFilter(data) {
  const cities = [...new Set(data.map(i => i.city).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function updateRangeFill(min, max) {
  rangeFill.style.left = `${min}%`;
  rangeFill.style.width = `${max - min}%`;
}

function applyFilters() {
  let min = parseInt(ageMin.value, 10);
  let max = parseInt(ageMax.value, 10);
  if (min > max) [min, max] = [max, min];
  ageMin.value = min; ageMax.value = max;
  ageMinValue.textContent = min; ageMaxValue.textContent = max;
  updateAgeRangePercent();

  const city = cityFilter.value;
  const gender = genderFilter.value;
  const search = searchFilter.value.trim().toLowerCase();

  filteredFaces = faces.filter(face => {
    const faceAge = Number(face.age) || 0;
    return (faceAge >= min && faceAge <= max)
      && (!city || face.city === city)
      && (!gender || face.gender === gender)
      && (!search || (face.name && face.name.toLowerCase().includes(search)));
  });
  renderFaces(filteredFaces);
}

filtersReset.addEventListener("click", () => {
  searchFilter.value = "";
  cityFilter.value = "";
  genderFilter.value = "";
  ageMin.value = ageMin.min;
  ageMax.value = ageMax.max;
  applyFilters();
});

/* ═══════════ TRANSLITERATION (RU → EN) ═══════════ */
const TRANSLIT_MAP = {
  а: "a",  б: "b",  в: "v",  г: "g",  д: "d",  е: "e",  ё: "e",
  ж: "zh", з: "z",  и: "i",  й: "y",  к: "k",  л: "l",  м: "m",
  н: "n",  о: "o",  п: "p",  р: "r",  с: "s",  т: "t",  у: "u",
  ф: "f",  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "",   ы: "y",  ь: "",   э: "e",  ю: "yu", я: "ya"
};

function transliterate(str) {
  return str
    .toLowerCase()
    .split("")
    .map(ch => (ch in TRANSLIT_MAP ? TRANSLIT_MAP[ch] : ch))
    .join("");
}

/* ═══════════ RENDER ═══════════ */
function generateActorSlug(name) {
  let slug = transliterate(String(name || ""))
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
  if (["faces", "contacts"].includes(slug)) slug += "-actor";
  return slug;
}

function findFaceBySlug(slug) {
  return faces.find(f => generateActorSlug(f.name) === slug);
}

function createFaceCard(face) {
  const card = document.createElement("article");
  card.className = "face-card";
  card.setAttribute("data-slug", generateActorSlug(face.name));
  const sub = [face.city, face.age ? `${face.age}` : ""].filter(Boolean).join(" · ");
  card.innerHTML = `
    <div class="face-card__img-wrap">
      <img src="${face.photo || ""}" alt="${escapeHtml(face.name || "")}" loading="lazy" />
      <div class="face-card__meta">
        <span class="face-card__name">${escapeHtml(face.name || "")}</span>
        ${sub ? `<span class="face-card__sub">${escapeHtml(sub)}</span>` : ""}
      </div>
    </div>
  `;
  card.addEventListener("click", () => openModal(face));
  return card;
}

function renderFaces(data) {
  facesGrid.innerHTML = "";
  if (!data.length) {
    showEmptyState();
    facesMeta.innerHTML = `Найдено: <strong>0</strong>`;
    return;
  }
  hideEmptyState();
  facesMeta.innerHTML = `Найдено: <strong>${data.length}</strong> из ${faces.length}`;
  data.forEach(face => facesGrid.appendChild(createFaceCard(face)));
  initCardAnimations();
  // авто-подгонка размера имени/города после отрисовки
  requestAnimationFrame(fitAllCards);
}

/* ═══════════ VIDEO HELPERS ═══════════ */
const isDirectVideo = (url) => url && /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
const isYouTube = (url) => url && /youtube\.com|youtu\.be/i.test(url);

function getYouTubeEmbed(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  const videoId = match ? match[1] : null;
  if (!videoId) return "";
  return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${escapeHtml(videoId)}" allowfullscreen title="Видеовизитка" loading="lazy"></iframe></div>`;
}

/* ═══════════ CUSTOM VIDEO PLAYER ═══════════ */
function createCustomPlayer(url) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-player";
  wrapper.innerHTML = `
    <video preload="metadata" src="${escapeHtml(url)}"></video>
    <div class="custom-player__big-play"><div class="custom-player__big-play-icon"></div></div>
    <div class="custom-player__controls">
      <button class="custom-player__btn cp-play" aria-label="Play">▶</button>
      <div class="custom-player__progress"><div class="custom-player__progress-fill"></div></div>
      <span class="custom-player__time">0:00 / 0:00</span>
      <button class="custom-player__btn cp-mute" aria-label="Mute">🔊</button>
      <div class="custom-player__volume"><div class="custom-player__volume-fill"></div></div>
      <button class="custom-player__btn cp-fs" aria-label="Fullscreen">⛶</button>
    </div>
  `;
  const video = wrapper.querySelector("video");
  const bigPlay = wrapper.querySelector(".custom-player__big-play");
  const playBtn = wrapper.querySelector(".cp-play");
  const muteBtn = wrapper.querySelector(".cp-mute");
  const fsBtn = wrapper.querySelector(".cp-fs");
  const progressBar = wrapper.querySelector(".custom-player__progress");
  const progressFill = wrapper.querySelector(".custom-player__progress-fill");
  const timeDisplay = wrapper.querySelector(".custom-player__time");
  const volumeBar = wrapper.querySelector(".custom-player__volume");
  const volumeFill = wrapper.querySelector(".custom-player__volume-fill");

  const togglePlay = () => video.paused ? video.play() : video.pause();
  function updatePlayState() {
    playBtn.textContent = video.paused ? "▶" : "⏸";
    if (!video.paused) bigPlay.classList.add("hidden-play");
  }
  function updateProgress() {
    if (!video.duration) return;
    progressFill.style.width = `${(video.currentTime / video.duration) * 100}%`;
    timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }
  function seekVideo(e) {
    const rect = progressBar.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * video.duration;
  }
  function setVolume(e) {
    const rect = volumeBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = pct; volumeFill.style.width = `${pct * 100}%`;
    video.muted = false; muteBtn.textContent = pct === 0 ? "🔇" : "🔊";
  }
  function toggleMute() {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
    volumeFill.style.width = video.muted ? "0%" : `${video.volume * 100}%`;
  }
  function toggleFullscreen() {
    if (wrapper.classList.contains("is-fullscreen")) {
      wrapper.classList.remove("is-fullscreen");
      document.body.classList.remove("no-scroll");
      fsBtn.textContent = "⛶";
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      wrapper.classList.add("is-fullscreen");
      document.body.classList.add("no-scroll");
      fsBtn.textContent = "✕";
      if (wrapper.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
      else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    }
  }
  ["fullscreenchange", "webkitfullscreenchange"].forEach(ev => {
    document.addEventListener(ev, () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsEl && wrapper.classList.contains("is-fullscreen")) {
        wrapper.classList.remove("is-fullscreen");
        document.body.classList.remove("no-scroll");
        fsBtn.textContent = "⛶";
      }
    });
  });

  bigPlay.addEventListener("click", togglePlay);
  playBtn.addEventListener("click", togglePlay);
  muteBtn.addEventListener("click", toggleMute);
  fsBtn.addEventListener("click", toggleFullscreen);
  video.addEventListener("click", togglePlay);
  video.addEventListener("play", updatePlayState);
  video.addEventListener("pause", updatePlayState);
  video.addEventListener("ended", () => { playBtn.textContent = "▶"; bigPlay.classList.remove("hidden-play"); });
  video.addEventListener("timeupdate", updateProgress);
  video.addEventListener("loadedmetadata", updateProgress);

  let isSeeking = false;
  progressBar.addEventListener("mousedown", (e) => { isSeeking = true; seekVideo(e); });
  document.addEventListener("mousemove", (e) => { if (isSeeking) seekVideo(e); });
  document.addEventListener("mouseup", () => { isSeeking = false; });
  let isVolDrag = false;
  volumeBar.addEventListener("mousedown", (e) => { isVolDrag = true; setVolume(e); });
  document.addEventListener("mousemove", (e) => { if (isVolDrag) setVolume(e); });
  document.addEventListener("mouseup", () => { isVolDrag = false; });
  progressBar.addEventListener("touchstart", (e) => seekVideo(e.touches[0]), { passive: true });
  progressBar.addEventListener("touchmove", (e) => seekVideo(e.touches[0]), { passive: true });
  volumeBar.addEventListener("touchstart", (e) => setVolume(e.touches[0]), { passive: true });
  volumeBar.addEventListener("touchmove", (e) => setVolume(e.touches[0]), { passive: true });

  video.volume = 0.8; volumeFill.style.width = "80%";
  return wrapper;
}

/* ═══════════ LIGHTBOX ═══════════ */
function openLightbox(images, startIndex) {
  lightboxImages = images;
  lightboxIndex = startIndex;
  lightboxImg.src = images[startIndex];
  lightbox.classList.add("active");
  updateLightboxNav();
}
function closeLightbox() {
  lightbox.classList.remove("active");
}
function updateLightboxNav() {
  const hasMultiple = lightboxImages.length > 1;
  lightboxPrev.style.display = hasMultiple ? "flex" : "none";
  lightboxNext.style.display = hasMultiple ? "flex" : "none";
}
function showLightboxImage(index) {
  if (index < 0) index = lightboxImages.length - 1;
  if (index >= lightboxImages.length) index = 0;
  lightboxIndex = index;
  lightboxImg.style.opacity = "0";
  setTimeout(() => {
    lightboxImg.src = lightboxImages[index];
    lightboxImg.style.opacity = "1";
  }, 150);
}
lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => showLightboxImage(lightboxIndex - 1));
lightboxNext.addEventListener("click", () => showLightboxImage(lightboxIndex + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

/* ═══════════ MODAL ═══════════ */
function buildStats(face) {
  const stats = [
    { label: "Возраст", value: face.age ? `${face.age} лет` : "" },
    { label: "Город", value: face.city },
    { label: "Рост", value: face.height ? `${face.height} см` : "" },
    { label: "Телосложение", value: face.bodyType },
    { label: "Образование", value: face.education },
    { label: "Цвет волос", value: face.hairColor },
    { label: "Длина волос", value: face.hairLength },
    { label: "Цвет глаз", value: face.eyeColor },
  ];
  return stats
    .filter(s => s.value && String(s.value).trim() !== "")
    .map(s => `
      <div class="stat-item">
        <span class="stat-item__label">${escapeHtml(s.label)}</span>
        <span class="stat-item__value">${escapeHtml(s.value)}</span>
      </div>
    `).join("");
}

function openModal(face) {
  const slug = generateActorSlug(face.name);
  history.replaceState(null, "", `?actor=${slug}`);
  document.title = `${face.name || ""} — Слова И Лица`;

  modalName.textContent = face.name || "";
  modalMainPhoto.src = face.photo || "";
  modalMainPhoto.alt = face.name || "";

  modalStats.innerHTML = buildStats(face);

  modalGallery.innerHTML = "";
  const gallery = (face.gallery && face.gallery.length) ? face.gallery : (face.photo ? [face.photo] : []);
  gallery.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${face.name || ""} — фото ${i + 1}`;
    img.loading = "lazy";
    img.addEventListener("click", () => openLightbox(gallery, i));
    modalGallery.appendChild(img);
  });
  modalMainPhoto.style.cursor = "zoom-in";
  modalMainPhoto.onclick = () => {
    const idx = gallery.indexOf(face.photo);
    openLightbox(gallery, idx >= 0 ? idx : 0);
  };

  modalVideo.innerHTML = "";
  if (isDirectVideo(face.video)) {
    modalVideo.appendChild(createCustomPlayer(face.video));
  } else if (isYouTube(face.video)) {
    modalVideo.innerHTML = getYouTubeEmbed(face.video);
  } else {
    modalVideo.innerHTML = `<p class="sims__text">Видеовизитка появится позже</p>`;
  }

  if (face.filmtoolz) {
    modalFilmtoolz.href = face.filmtoolz;
    modalFilmtoolz.classList.remove("disabled");
    modalFilmtoolz.textContent = face.filmtoolz.includes("disk.yandex")
      ? "Открыть материалы" : "Открыть профиль";
  } else {
    modalFilmtoolz.href = "#";
    modalFilmtoolz.classList.add("disabled");
    modalFilmtoolz.textContent = "Ссылка отсутствует";
  }

  modal.classList.remove("hidden");
  document.body.classList.add("no-scroll");

  const simsCard = modal.querySelector(".sims");
  simsCard.style.animation = "none";
  void simsCard.offsetWidth;
  simsCard.style.animation = "";

  modal.querySelector(".modal__content").scrollTop = 0;
}

function closeModal() {
  // Stop any playing video
  const video = modalVideo.querySelector("video");
  if (video) { video.pause(); }
  modal.classList.add("hidden");
  document.body.classList.remove("no-scroll");

  // Убираем ?actor из URL
  if (window.location.search) {
    history.replaceState(null, "", window.location.pathname);
  }
  document.title = "Слова И Лица";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

/* ═══════════ KEYBOARD ═══════════ */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (lightbox.classList.contains("active")) { closeLightbox(); return; }
    if (!modal.classList.contains("hidden")) { closeModal(); return; }
  }
  if (lightbox.classList.contains("active")) {
    if (e.key === "ArrowLeft") showLightboxImage(lightboxIndex - 1);
    if (e.key === "ArrowRight") showLightboxImage(lightboxIndex + 1);
  }
});

/* ═══════════ HEADER SCROLL SHADOW ═══════════ */
let lastScroll = 0;
window.addEventListener("scroll", () => {
  const current = window.scrollY;
  if (current > 20) header.style.boxShadow = "0 8px 30px rgba(0,0,0,0.2)";
  else header.style.boxShadow = "none";
  lastScroll = current;
}, { passive: true });

/* ═══════════ FILTER LISTENERS ═══════════ */
searchFilter.addEventListener("input", applyFilters);
cityFilter.addEventListener("change", applyFilters);
genderFilter.addEventListener("change", applyFilters);
ageMin.addEventListener("input", applyFilters);
ageMax.addEventListener("input", applyFilters);

/* ═══════════ INIT ═══════════ */
function initAgeRange() {
  const ages = faces.map(f => Number(f.age)).filter(a => !isNaN(a) && a > 0);
  const minAge = ages.length ? Math.min(...ages) : 0;
  const maxAge = ages.length ? Math.max(...ages) : 100;
  ageMin.min = minAge; ageMin.max = maxAge; ageMin.value = minAge;
  ageMax.min = minAge; ageMax.max = maxAge; ageMax.value = maxAge;
  ageMinValue.textContent = minAge;
  ageMaxValue.textContent = maxAge;
  updateAgeRangePercent();
}
function updateAgeRangePercent() {
  const min = parseInt(ageMin.min, 10);
  const max = parseInt(ageMin.max, 10);
  const range = max - min || 1;
  const lo = ((parseInt(ageMin.value, 10) - min) / range) * 100;
  const hi = ((parseInt(ageMax.value, 10) - min) / range) * 100;
  rangeFill.style.left = `${lo}%`;
  rangeFill.style.width = `${hi - lo}%`;
}
[ageMin, ageMax].forEach(el => el.addEventListener("input", updateAgeRangePercent));

async function init() {
  // Фильтруем noModal-карточки (Даня/Юлия) — они статичны в блоке контактов
  faces = (window.FACES_DATA || []).filter(f => !f.noModal);

  fillCityFilter(faces);
  initAgeRange();
  filteredFaces = [...faces];
  renderFaces(filteredFaces);
  initScrollAnimations();

  await hideLoaderWithMinTime();

  // повторная подгонка после появления шрифтов/лоадера
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitAllCards);
  } else {
    fitAllCards();
  }

  // Открытие модалки по параметру ?actor= (глубокая ссылка)
  handleActorParamOnLoad();
}

/* ═══════════ DEEP LINK BY ?actor= ═══════════ */
function handleActorParamOnLoad() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("actor");

  // Поддержка старых ссылок через #hash
  if (!slug) {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash === "faces" || hash === "contacts") {
      setTimeout(() => scrollToSection(hash), 300);
      return;
    }
    if (hash) {
      const faceByHash = findFaceBySlug(hash);
      if (faceByHash) setTimeout(() => openModal(faceByHash), 400);
    }
    return;
  }

  const face = findFaceBySlug(slug);
  if (face) {
    setTimeout(() => openModal(face), 400);
  } else {
    history.replaceState(null, "", window.location.pathname);
  }
}

document.addEventListener("DOMContentLoaded", init);