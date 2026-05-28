import { initTheme } from "./theme.js";
import { initLanguage, applyLanguage } from "./language.js";
import { firebaseReady, auth, db, doc, getDoc, onAuthStateChanged } from "./firebase.js";
import { subscribeGuides, subscribeCareers, saveMessage, getLocalCurrentUser, getLocalSession } from "./guides.js";
import { ejecutarMigracionAutomatica } from "./migrar.js";

let guides = [];
let careers = [];
let activeCareer = "all";
let activeSemester = "all";

// 🛡️ Selectores corregidos según la estructura real de tu index.html
const guidesGrid = document.querySelector("#guidesContainer") || document.querySelector("#guidesGrid");
const careersGrid = document.querySelector("#careersContainer") || document.querySelector("#careersGrid");
const emptyGuides = document.querySelector("#emptyGuides");
const semesterFilter = document.querySelector("#semesterFilter");
const contactCareer = document.querySelector("#contactCareer");
const modal = document.querySelector("#guideModal");
const modalBody = document.querySelector("#modalBody");

initTheme();
initLanguage();
initSessionUi();

document.querySelector("#menuToggle")?.addEventListener("click", () => {
  document.querySelector("#navLinks")?.classList.toggle("open");
});

document.querySelector("#modalClose")?.addEventListener("click", () => modal.close());

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    activeCareer = button.dataset.filter;
    renderGuides();
  });
});

semesterFilter?.addEventListener("change", () => {
  activeSemester = semesterFilter.value || "all";
  renderGuides();
});

// ESCUCHADOR DE CARRERAS
subscribeCareers((items) => {
  careers = items;
  
  if (firebaseReady && careers.length === 0) {
    console.log("Detectadas 0 carreras en Firestore. Activando migración...");
    ejecutarMigracionAutomatica();
    return;
  }

  renderCareers();
  renderCareerOptions();
  renderGuides();
});

// ESCUCHADOR DE GUÍAS
subscribeGuides((items) => {
  guides = items;
  
  if (firebaseReady && guides.length === 0 && careers.length > 0) {
    console.log("Carreras listas, pero 0 guías en Firestore. Re-verificando migración...");
    ejecutarMigracionAutomatica();
  }

  renderStats();
  renderSemesterOptions();
  renderGuides();
});

document.querySelector("#contactForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#contactStatus");
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await saveMessage(data);
    event.currentTarget.reset();
    if (status) status.textContent = "Mensaje enviado correctamente.";
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

function renderStats() {
  const publicStats = document.querySelectorAll("#publicStats strong");
  if (!publicStats || publicStats.length === 0) return;
  
  const semesters = new Set(guides.map((guide) => guide.sem));
  const values = [guides.length, careers.length, semesters.size];
  publicStats.forEach((node, index) => {
    node.textContent = values[index] || 0;
  });
}

function renderCareers() {
  if (!careersGrid) {
    console.warn("No se encontró el contenedor de carreras (#careersContainer o #careersGrid) en el HTML.");
    return;
  }
  
  careersGrid.innerHTML = careers.map((career) => `
    <article class="career-card" style="--career-color:${career.color || "#00d4ff"}" data-career="${career.key || career.id}">
      <div class="career-icon">${(career.name || "?").slice(0, 2).toUpperCase()}</div>
      <h3>${career.name}</h3>
      <p>${career.desc || ""}</p>
      <span class="pill">${countGuides(career.key || career.id)} guias</span>
    </article>
  `).join("");

  // 🛡️ Validación segura para evitar el error de querySelectorAll sobre elementos nulos
  const cards = careersGrid.querySelectorAll(".career-card");
  if (cards) {
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        activeCareer = card.dataset.career;
        document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active"));
        renderGuides();
        document.querySelector("#guias")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }
}

function renderCareerOptions() {
  if (!contactCareer) return;
  const options = careers.map((career) => `<option value="${career.key || career.id}">${career.name}</option>`).join("");
  contactCareer.innerHTML = `<option value="">General</option>${options}`;
}

function renderSemesterOptions() {
  if (!semesterFilter) return;
  const current = semesterFilter.value || "all";
  const semesters = [...new Set(guides.map((guide) => Number(guide.sem)).filter(Boolean))].sort((a, b) => a - b);
  semesterFilter.innerHTML = `<option value="all" data-i18n="filters.semester">Todos los semestres</option>${semesters.map((sem) => `<option value="${sem}">Semestre ${sem}</option>`).join("")}`;
  semesterFilter.value = semesters.includes(Number(current)) ? current : "all";
  activeSemester = semesterFilter.value || "all";
  if (typeof applyLanguage === "function") applyLanguage();
}

function renderGuides() {
  if (!guidesGrid) {
    console.warn("No se encontró el contenedor de guías (#guidesContainer o #guidesGrid) en el HTML.");
    return;
  }
  
  const currentCareer = activeCareer || "all";
  const currentSemester = activeSemester || "all";

  const filtered = guides.filter((guide) => {
    const matchesCareer = currentCareer === "all" || guide.career === currentCareer;
    const matchesSemester = currentSemester === "all" || String(guide.sem) === String(currentSemester);
    return matchesCareer && matchesSemester;
  });

  guidesGrid.innerHTML = filtered.map((guide) => `
    <article class="guide-card">
      <div class="guide-meta">
        <span class="pill">${careerName(guide.career)}</span>
        <span class="pill">Sem. ${guide.sem}</span>
      </div>
      <h3>${guide.title}</h3>
      <p>${guide.desc}</p>
      <div class="guide-actions">
        <span class="pill">${(guide.topics || []).length} temas</span>
        <button class="btn-secondary" data-guide="${guide.id}" type="button">Ver guia</button>
      </div>
    </article>
  `).join("");
  
  if (emptyGuides) {
    emptyGuides.style.display = filtered.length ? "none" : "block";
  }
  
  const buttons = guidesGrid.querySelectorAll("[data-guide]");
  if (buttons) {
    buttons.forEach((button) => {
      button.addEventListener("click", () => openGuide(button.dataset.guide));
    });
  }
}

function openGuide(id) {
  const guide = guides.find((item) => item.id === id);
  if (!guide || !modalBody || !modal) return;
  modalBody.innerHTML = `
    <h2>${guide.title}</h2>
    <p class="pill">${careerName(guide.career)} - Semestre ${guide.sem}</p>
    <p>${guide.detail || guide.desc}</p>
    <h3>Temario</h3>
    <div class="filters">${(guide.topics || []).map((topic) => `<span class="pill">${topic}</span>`).join("")}</div>
    ${guide.fileUrl ? `<p><a class="btn-primary" href="${guide.fileUrl}" target="_blank" rel="noopener">Abrir recurso</a></p>` : ""}
  `;
  modal.showModal();
}

function countGuides(careerKey) {
  return guides.filter((guide) => guide.career === careerKey).length;
}

function careerName(key) {
  return careers.find((career) => (career.key || career.id) === key)?.name || key;
}

function initSessionUi() {
  const session = getLocalSession();
  const isAdminLocal = session && (session.role === "admin" || session.email === "admin@sgnia.local");

  if (isAdminLocal) {
    console.log("Sesión activa: Administrador Local detectado.");
    updateSessionUi(true, true);
    return;
  }

  if (firebaseReady) {
    onAuthStateChanged(auth, async (user) => {
      const profile = user ? await getFirebaseUserProfile(user) : null;
      updateSessionUi(Boolean(user), profile?.role === "admin");
    });
    return;
  }

  const user = getLocalCurrentUser();
  updateSessionUi(Boolean(user), user?.role === "admin");
}

function updateSessionUi(isLoggedIn, isAdmin = false) {
  document.querySelector("#loginNavLink")?.toggleAttribute("hidden", isLoggedIn);
  document.querySelector("#profileNavLink")?.toggleAttribute("hidden", !isLoggedIn);
  document.querySelector("#createAccountBtn")?.toggleAttribute("hidden", isLoggedIn);
  document.querySelector("#heroProfileBtn")?.toggleAttribute("hidden", !isLoggedIn);
  document.querySelector("#adminNavLink")?.toggleAttribute("hidden", !isAdmin);
}

async function getFirebaseUserProfile(user) {
  const byUid = await getDoc(doc(db, "users", user.uid));
  if (byUid.exists()) return byUid.data();

  const byEmail = await getDoc(doc(db, "users", user.email));
  if (byEmail.exists()) return byEmail.data();

  return null;
}