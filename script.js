/* ═══════════ SCROLL TO TOP ON LOAD ═══════════ */
window.addEventListener("beforeunload", () => {
  window.scrollTo(0, 0);
});

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

window.scrollTo(0, 0);

/* ═══════════ ELEMENTS ═══════════ */
const loader = document.getElementById("loader");
const header = document.getElementById("header");
const hero = document.getElementById("hero");
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");
const logoLink = document.getElementById("logoLink");

const facesGrid = document.getElementById("facesGrid");
const emptyState = document.getElementById("emptyState");

const searchFilter = document.getElementById("searchFilter");
const cityFilter = document.getElementById("cityFilter");
const genderFilter = document.getElementById("genderFilter");
const ageMin = document.getElementById("ageMin");
const ageMax = document.getElementById("ageMax");
const ageMinValue = document.getElementById("ageMinValue");
const ageMaxValue = document.getElementById("ageMaxValue");
const rangeFill = document.getElementById("rangeFill");

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
const LOADER_MIN_TIME = 5000;
const loaderStartTime = Date.now();
let faces = [];
let filteredFaces = [];
let lightboxImages = [];
let lightboxIndex = 0;

/* ═══════════ UTILS ═══════════ */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ═══════════ SCROLL TO SECTION ═══════════ */
function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (target) {
    const headerOffset = 80;
    const elementPosition = target.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - headerOffset;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    return true;
  }
  return false;
}

/* ═══════════ LOADER ═══════════ */
async function hideLoaderWithMinTime() {
  const elapsed = Date.now() - loaderStartTime;
  const remain = Math.max(0, LOADER_MIN_TIME - elapsed);
  await wait(remain);
  loader.classList.add("done");
  await wait(100);
  header.classList.add("visible");
  await wait(300);
  hero.classList.add("animate");
}

/* ═══════════ PARALLAX ═══════════ */
function initParallax() {
  const layers = document.querySelectorAll("[data-parallax]");
  if (!layers.length) return;
  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;
    if (scrollY > hero.offsetHeight) { ticking = false; return; }
    layers.forEach(layer => {
      const speed = parseFloat(layer.dataset.parallax) || 0.1;
      layer.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
    });
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(updateParallax); ticking = true; }
  }, { passive: true });
}

/* ═══════════ BURGER ═══════════ */
burger.addEventListener("click", () => {
  burger.classList.toggle("active");
  nav.classList.toggle("open");
  document.body.classList.toggle("no-scroll");
});

/* ═══════════ LOGO CLICK ═══════════ */
if (logoLink) {
  logoLink.addEventListener("click", (e) => {
    e.preventDefault();
    if (modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
    burger.classList.remove("active");
    nav.classList.remove("open");
    document.body.classList.remove("no-scroll");
  });
}

/* ═══════════ SCROLL ANIMATIONS ═══════════ */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll("[data-animate='fade-up']").forEach(el => observer.observe(el));
}

function initCardAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("in-view"), index * 80);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll(".face-card").forEach(card => observer.observe(card));
}

/* ═══════════ FILTERS ═══════════ */
function showEmptyState() { emptyState.classList.remove("hidden"); facesGrid.innerHTML = ""; }
function hideEmptyState() { emptyState.classList.add("hidden"); }

function fillCityFilter(data) {
  const cities = [...new Set(data.map(item => item.city).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"));
  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });
}

function updateRangeFill(min, max) {
  rangeFill.style.left = `${(min / 100) * 100}%`;
  rangeFill.style.width = `${((max - min) / 100) * 100}%`;
}

function applyFilters() {
  let min = parseInt(ageMin.value, 10);
  let max = parseInt(ageMax.value, 10);
  if (min > max) [min, max] = [max, min];

  ageMin.value = min;
  ageMax.value = max;
  ageMinValue.textContent = min;
  ageMaxValue.textContent = max;
  updateRangeFill(min, max);

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

/* ═══════════ RENDER ═══════════ */
function generateActorSlug(name) {
  let slug = name
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
  if (slug === 'faces' || slug === 'contacts' || slug === 'hero') {
    slug = slug + '-actor';
  }
  return slug;
}

function createFaceCard(face) {
  const card = document.createElement("article");
  card.className = "face-card";
  card.setAttribute("data-slug", generateActorSlug(face.name));
  card.innerHTML = `
    <div class="face-card__img-wrap">
      <img src="${face.photo || ""}" alt="${escapeHtml(face.name || "")}" loading="lazy" />
    </div>
    <div class="face-card__name">${escapeHtml(face.name || "")}</div>
  `;
  card.addEventListener("click", () => openModal(face));
  return card;
}

function renderFaces(data) {
  facesGrid.innerHTML = "";
  if (!data.length) { showEmptyState(); return; }
  hideEmptyState();
  data.forEach(face => facesGrid.appendChild(createFaceCard(face)));
  initCardAnimations();
}

/* ═══════════ VIDEO HELPERS ═══════════ */
function isDirectVideo(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(url);
}

function isYouTube(url) {
  if (!url) return false;
  return /youtube\.com|youtu\.be/i.test(url);
}

function getYouTubeEmbed(url) {
  const regExp = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
  const match = url.match(regExp);
  const videoId = match ? match[1] : null;
  if (!videoId) return "";
  return `
    <div class="video-wrap">
      <iframe
        src="https://www.youtube.com/embed/${escapeHtml(videoId)}"
        allowfullscreen
        title="Видеовизитка"
        loading="lazy"
      ></iframe>
    </div>
  `;
}

/* ═══════════ CUSTOM VIDEO PLAYER ═══════════ */
function createCustomPlayer(url) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-player";

  wrapper.innerHTML = `
    <video preload="metadata" src="${escapeHtml(url)}"></video>
    <div class="custom-player__big-play">
      <div class="custom-player__big-play-icon"></div>
    </div>
    <div class="custom-player__controls">
      <button class="custom-player__btn cp-play" aria-label="Play">▶</button>
      <div class="custom-player__progress">
        <div class="custom-player__progress-fill"></div>
      </div>
      <span class="custom-player__time">0:00 / 0:00</span>
      <button class="custom-player__btn cp-mute" aria-label="Mute">🔊</button>
      <div class="custom-player__volume">
        <div class="custom-player__volume-fill"></div>
      </div>
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

  function togglePlay() {
    if (video.paused) { video.play(); } else { video.pause(); }
  }

  function updatePlayState() {
    playBtn.textContent = video.paused ? "▶" : "⏸";
    if (!video.paused) bigPlay.classList.add("hidden-play");
  }

  function updateProgress() {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    progressFill.style.width = `${pct}%`;
    timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }

  function seekVideo(e) {
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  }

  function setVolume(e) {
    const rect = volumeBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = pct;
    volumeFill.style.width = `${pct * 100}%`;
    video.muted = false;
    muteBtn.textContent = pct === 0 ? "🔇" : "🔊";
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
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      wrapper.classList.add("is-fullscreen");
      document.body.classList.add("no-scroll");
      fsBtn.textContent = "✕";
      if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen().catch(() => {});
      } else if (wrapper.webkitRequestFullscreen) {
        wrapper.webkitRequestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    }
  }

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && wrapper.classList.contains("is-fullscreen")) {
      wrapper.classList.remove("is-fullscreen");
      document.body.classList.remove("no-scroll");
      fsBtn.textContent = "⛶";
    }
  });

  document.addEventListener("webkitfullscreenchange", () => {
    if (!document.webkitFullscreenElement && wrapper.classList.contains("is-fullscreen")) {
      wrapper.classList.remove("is-fullscreen");
      document.body.classList.remove("no-scroll");
      fsBtn.textContent = "⛶";
    }
  });

  bigPlay.addEventListener("click", togglePlay);
  playBtn.addEventListener("click", togglePlay);
  muteBtn.addEventListener("click", toggleMute);
  fsBtn.addEventListener("click", toggleFullscreen);
  video.addEventListener("click", togglePlay);

  video.addEventListener("play", updatePlayState);
  video.addEventListener("pause", updatePlayState);
  video.addEventListener("ended", () => {
    playBtn.textContent = "▶";
    bigPlay.classList.remove("hidden-play");
  });
  video.addEventListener("timeupdate", updateProgress);
  video.addEventListener("loadedmetadata", updateProgress);

  let isSeeking = false;
  progressBar.addEventListener("mousedown", (e) => { isSeeking = true; seekVideo(e); });
  document.addEventListener("mousemove", (e) => { if (isSeeking) seekVideo(e); });
  document.addEventListener("mouseup", () => { isSeeking = false; });

  let isVolumeDragging = false;
  volumeBar.addEventListener("mousedown", (e) => { isVolumeDragging = true; setVolume(e); });
  document.addEventListener("mousemove", (e) => { if (isVolumeDragging) setVolume(e); });
  document.addEventListener("mouseup", () => { isVolumeDragging = false; });

  progressBar.addEventListener("touchstart", (e) => { seekVideo(e.touches[0]); }, { passive: true });
  progressBar.addEventListener("touchmove", (e) => { seekVideo(e.touches[0]); }, { passive: true });

  volumeBar.addEventListener("touchstart", (e) => { setVolume(e.touches[0]); }, { passive: true });
  volumeBar.addEventListener("touchmove", (e) => { setVolume(e.touches[0]); }, { passive: true });

  video.volume = 0.8;
  volumeFill.style.width = "80%";

  return wrapper;
}

/* ═══════════ LIGHTBOX ═══════════ */
function openLightbox(images, startIndex) {
  lightboxImages = images;
  lightboxIndex = startIndex;
  lightboxImg.src = lightboxImages[lightboxIndex];
  lightbox.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  lightbox.classList.remove("active");
  if (modal.classList.contains("hidden")) {
    document.body.classList.remove("no-scroll");
  }
}

function lightboxGoTo(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  lightboxImg.src = lightboxImages[lightboxIndex];
}

lightboxClose.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
lightboxPrev.addEventListener("click", (e) => { e.stopPropagation(); lightboxGoTo(-1); });
lightboxNext.addEventListener("click", (e) => { e.stopPropagation(); lightboxGoTo(1); });
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

/* ═══════════ MODAL HELPERS ═══════════ */
function statItem(label, value) {
  return `
    <div class="stat-item">
      <span class="stat-item__label">${escapeHtml(label)}</span>
      <span class="stat-item__value">${escapeHtml(value || "—")}</span>
    </div>
  `;
}

/* ═══════════ MODAL ═══════════ */
function openModal(face) {
  if (!face) return;
  
  modalName.textContent = face.name || "";
  modalMainPhoto.src = face.photo || "";
  modalMainPhoto.alt = face.name || "";

  modalStats.innerHTML = `
    ${statItem("Город", face.city)}
    ${statItem("Образование", face.education)}
    ${statItem("Возраст", face.age)}
    ${statItem("Рост", face.height ? `${face.height} см` : "—")}
    ${statItem("Цвет волос", face.hairColor)}
    ${statItem("Длина волос", face.hairLength)}
    ${statItem("Цвет глаз", face.eyeColor)}
    ${statItem("Телосложение", face.bodyType)}
  `;

  const allImages = [];
  if (face.photo) allImages.push(face.photo);
  if (Array.isArray(face.gallery)) {
    face.gallery.forEach(src => {
      if (src && !allImages.includes(src)) allImages.push(src);
    });
  }

  modalMainPhoto.onclick = () => {
    const idx = allImages.indexOf(modalMainPhoto.src);
    openLightbox(allImages, idx !== -1 ? idx : 0);
  };

  modalGallery.innerHTML = "";
  if (Array.isArray(face.gallery) && face.gallery.length) {
    face.gallery.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = face.name || "";
      img.loading = "lazy";
      img.addEventListener("click", () => {
        const idx = allImages.indexOf(src);
        openLightbox(allImages, idx !== -1 ? idx : 0);
      });
      modalGallery.appendChild(img);
    });
  }

  modalVideo.innerHTML = "";
  if (face.video) {
    if (isDirectVideo(face.video)) {
      modalVideo.appendChild(createCustomPlayer(face.video));
    } else if (isYouTube(face.video)) {
      modalVideo.innerHTML = getYouTubeEmbed(face.video);
    } else {
      modalVideo.appendChild(createCustomPlayer(face.video));
    }
  } else {
    modalVideo.innerHTML = "<p class='sims__text'>—</p>";
  }

  if (face.filmtoolz) {
    modalFilmtoolz.href = face.filmtoolz;
    modalFilmtoolz.classList.remove("disabled");
  } else {
    modalFilmtoolz.href = "#";
    modalFilmtoolz.classList.add("disabled");
  }

  modal.classList.remove("hidden");
  document.body.classList.add("no-scroll");
  
  const slug = generateActorSlug(face.name);
  if (window.location.hash !== `#${slug}`) {
    history.pushState(null, '', `#${slug}`);
  }
}

function closeModal() {
  modal.querySelectorAll("video").forEach(v => { v.pause(); v.currentTime = 0; });
  modal.querySelectorAll("iframe").forEach(iframe => { iframe.src = ""; });
  document.querySelectorAll(".custom-player.is-fullscreen").forEach(p => {
    p.classList.remove("is-fullscreen");
  });
  closeLightbox();
  modal.classList.add("hidden");
  document.body.classList.remove("no-scroll");
  
  // Очищаем хэш при закрытии модалки
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
}

/* ═══════════ ANCHOR LINKS FOR ACTORS + SECTION NAVIGATION ═══════════ */
function getDecodedHash() {
  const hash = window.location.hash.slice(1);
  try {
    return decodeURIComponent(hash);
  } catch (e) {
    return hash;
  }
}

function handleHashChange() {
  const hash = getDecodedHash();
  
  if (!hash) return;
  
  const reservedHashes = ['faces', 'contacts', 'hero'];
  
  if (reservedHashes.includes(hash)) {
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
    setTimeout(() => scrollToSection(hash), 100);
  } else {
    if (faces.length === 0) {
      window.pendingHash = hash;
      return;
    }
    const actor = faces.find(face => generateActorSlug(face.name) === hash);
    if (actor) {
      openModal(actor);
    }
  }
}

window.addEventListener('hashchange', handleHashChange);

/* ═══════════ NAVIGATION LINKS HANDLER ═══════════ */
nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href");
    
    if (href && href.startsWith("#")) {
      e.preventDefault();
      const targetId = href.slice(1);
      
      if (modal && !modal.classList.contains("hidden")) {
        closeModal();
      }
      
      burger.classList.remove("active");
      nav.classList.remove("open");
      document.body.classList.remove("no-scroll");
      
      setTimeout(() => scrollToSection(targetId), 50);
    }
  });
});

/* ═══════════ LOAD FACES ═══════════ */
async function loadFaces() {
  try {
    const data = window.FACES_DATA;
    if (!Array.isArray(data) || data.length === 0) {
      faces = [];
      showEmptyState();
    } else {
      faces = data;
      fillCityFilter(faces);
      applyFilters();
    }
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
    showEmptyState();
  } finally {
    await hideLoaderWithMinTime();
    
    if (window.pendingHash) {
      const slug = window.pendingHash;
      delete window.pendingHash;
      const actor = faces.find(face => generateActorSlug(face.name) === slug);
      if (actor) {
        openModal(actor);
      }
    }
    
    const currentHash = getDecodedHash();
    if (currentHash) {
      const reservedHashes = ['faces', 'contacts', 'hero'];
      if (!reservedHashes.includes(currentHash)) {
        const actor = faces.find(face => generateActorSlug(face.name) === currentHash);
        if (actor) {
          openModal(actor);
        }
      }
    }
  }
}

/* ═══════════ EVENTS ═══════════ */
ageMin.addEventListener("input", applyFilters);
ageMax.addEventListener("input", applyFilters);
cityFilter.addEventListener("change", applyFilters);
genderFilter.addEventListener("change", applyFilters);
searchFilter.addEventListener("input", applyFilters);

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const fsPlayer = document.querySelector(".custom-player.is-fullscreen");
    if (fsPlayer) {
      fsPlayer.classList.remove("is-fullscreen");
      document.body.classList.remove("no-scroll");
      const btn = fsPlayer.querySelector(".cp-fs");
      if (btn) btn.textContent = "⛶";
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    if (lightbox.classList.contains("active")) { closeLightbox(); return; }
    if (!modal.classList.contains("hidden")) { closeModal(); }
  }
  if (lightbox.classList.contains("active")) {
    if (e.key === "ArrowLeft") lightboxGoTo(-1);
    if (e.key === "ArrowRight") lightboxGoTo(1);
  }
});

/* ═══════════ INIT ═══════════ */
updateRangeFill(Number(ageMin.value), Number(ageMax.value));
initScrollAnimations();
initParallax();
loadFaces();