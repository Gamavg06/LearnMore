import { initTheme } from "./theme.js";
import { initLanguage, applyLanguage } from "./language.js";
import { firebaseReady, auth, db, doc, getDoc, onAuthStateChanged } from "./firebase.js";
import { subscribeGuides, subscribeCareers, saveMessage, getLocalCurrentUser, getLocalSession } from "./guides.js";

let guides = [];
let careers = [];
let activeCareer = "all";
let activeSemester = "all";

const guidesGrid = document.querySelector("#guidesGrid");
const careersGrid = document.querySelector("#careersGrid");
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
  activeSemester = semesterFilter.value;
  renderGuides();
});

subscribeCareers((items) => {
  careers = items;
  renderCareers();
  renderCareerSelect();
});

subscribeGuides((items) => {
  guides = items;
  renderGuides();
});

document.querySelector("#contactForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#contactStatus");
  try {
    await saveMessage(Object.fromEntries(new FormData(form)));
    form.reset();
    if (status) status.textContent = "Mensaje enviado correctamente.";
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

function renderCareers() {
  if (!careersGrid) return;
  careersGrid.innerHTML = careers.map((career) => `
    <article class="career-card" style="--card-color: ${career.color || "#00d4ff"}">
      <h3>${career.name}</h3>
      <p>${career.desc}</p>
      <footer><strong>${countGuides(career.key || career.id)}</strong> guias disponibles</footer>
    </article>
  `).join("");
}

function renderCareerSelect() {
  if (!contactCareer) return;
  contactCareer.innerHTML = careers.map((career) => `
    <option value="${career.key || career.id}">${career.name}</option>
  `).join("");
}

function renderGuides() {
  if (!guidesGrid) return;
  const filtered = guides.filter((guide) => {
    const matchesCareer = activeCareer === "all" || guide.career === activeCareer;
    const matchesSemester = activeSemester === "all" || String(guide.sem) === activeSemester;
    return matchesCareer && matchesSemester;
  });

  if (emptyGuides) emptyGuides.hidden = filtered.length > 0;
  
  guidesGrid.innerHTML = filtered.map((guide) => `
    <article class="guide-card">
      <header>
        <h3>${guide.title}</h3>
        <span class="pill">${careerName(guide.career)}</span>
      </header>
      <p>${guide.desc}</p>
      <footer>
        <span>Semestre ${guide.sem}</span>
        <button class="btn-primary small" data-view-guide="${guide.id}" type="button">Ver detalles</button>
      </footer>
    </article>
  `).join("");

  document.querySelectorAll("[data-view-guide]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.viewGuide));
  });
}

function openModal(id) {
  const guide = guides.find((item) => item.id === id);
  if (!guide || !modal || !modalBody) return;
  
  modalBody.innerHTML = `
    <h2>${guide.title}</h2>
    <p class="modal-meta"><strong>Carrera:</strong> ${careerName(guide.career)} | <strong>Semestre:</strong> ${guide.sem}</p>
    <p>${guide.detail || guide.desc}</p>
    <h3>Temario principal</h3>
    <div class="topics-grid">${(guide.topics || []).map((t) => `<span>${t}</span>`).join("")}</div>
    ${guide.fileUrl ? `<p><a class=\"btn-primary\" href=\"${guide.fileUrl}\" target=\"_blank\" rel=\"noopener\">Abrir recurso</a></p>` : ""}
  `;
  modal.showModal();
}

function countGuides(careerKey) {
  return guides.filter((guide) => guide.career === careerKey).length;
}

function careerName(key) {
  return careers.find((career) => (career.key || career.id) === key)?.name || key;
}

// ==========================================
// CONTROL DE INTERFAZ DE SESIÓN CORREGIDO
// ==========================================
function initSessionUi() {
  // 1. Validamos si hay una sesión del Administrador Local en sessionStorage primero
  const session = getLocalSession();
  const isAdminLocal = session && (session.role === "admin" || session.email === "admin@sgnia.local");

  if (isAdminLocal) {
    console.log("Manteniendo interfaz para Administrador Local.");
    updateSessionUi(true, true); // (Logueado: true, Admin: true)
    return; // Detiene la validación aquí para que Firebase no lo tumbe
  }

  // 2. Si no es admin local, procedemos con la validación estándar de Firebase
  if (firebaseReady) {
    onAuthStateChanged(auth, async (user) => {
      const profile = user ? await getFirebaseUserProfile(user) : null;
      updateSessionUi(Boolean(user), profile?.role === "admin");
    });
    return;
  }

  // 3. Fallback de usuarios locales tradicionales (sin internet)
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