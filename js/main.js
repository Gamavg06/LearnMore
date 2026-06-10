import { initTheme } from "./theme.js";
import { initLanguage, applyLanguage } from "./language.js";
import { supabaseReady, supabase, onAuthStateChanged } from "./supabase.js";
import { subscribeGuides, subscribeCareers, saveMessage, getLocalCurrentUser, getLocalSession, baseCareerOptions } from "./guides.js";
import { ejecutarMigracionAutomatica } from "./migrar.js";

let guides = [];
let careers = baseCareerOptions();
let activeCareer = "all";
let activeSemester = "all";

// Selectores dinámicos compatibles con tu HTML
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
renderCareers();
renderCareerOptions();

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

if (semesterFilter) {
  semesterFilter.addEventListener("change", () => {
    activeSemester = semesterFilter.value || "all";
    renderGuides();
  });
}

// ESCUCHADOR DE CARRERAS (SUPABASE / LOCAL)
subscribeCareers((items) => {
  console.log("Carreras recibidas:", items);
  careers = normalizeCareers(items);
  


  renderCareers();
  renderCareerOptions();
  renderGuides();
});

// ESCUCHADOR DE GUÍAS (SUPABASE / LOCAL)
subscribeGuides((items) => {
  console.log("Guías recibidas:", items);
  guides = items;
  
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
  if (!careersGrid) return;
  
  // Imprimimos la estructura exacta que tus estilos CSS esperan para las tarjetas de carrera
  careersGrid.innerHTML = careers.map((career) => {
    const cid = career.key || career.id;
    const cColor = career.color || "#00d4ff";
    const cName = career.name || "";
    const cDesc = career.desc || "";
    const shortName = cName.slice(0, 2).toUpperCase();

    return `
      <article class="career-card" style="border-top: 4px solid ${cColor}; cursor: pointer;" data-career="${cid}">
        <div class="career-icon" style="background: ${cColor}20; color: ${cColor}; display: inline-block; padding: 10px; border-radius: 50%; font-weight: bold; margin-bottom: 10px;">
          ${shortName}
        </div>
        <h3>${cName}</h3>
        <p>${cDesc}</p>
        <span class="pill" style="background: ${cColor}15; color: ${cColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
          ${countGuides(cid)} guías
        </span>
      </article>
    `;
  }).join("");

  // Añadimos el evento Click a las tarjetas para que filtren las guías automáticamente
  careersGrid.querySelectorAll("[data-career]").forEach((card) => {
    card.addEventListener("click", () => {
      activeCareer = card.dataset.career;
      
      // Sincronizar con los botones de filtro superiores si existen
      document.querySelectorAll(".filter-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.filter === activeCareer);
      });
      
      renderGuides();
      document.querySelector("#guias")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function renderCareerOptions() {
  if (!contactCareer) return;
  const options = normalizeCareers(careers).map((career) => `<option value="${career.key || career.id}">${career.name}</option>`).join("");
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
  if (!guidesGrid) return;
  
  const currentCareer = activeCareer || "all";
  const currentSemester = activeSemester || "all";

  const filtered = guides.filter((guide) => {
    const matchesCareer = currentCareer === "all" || guide.career === currentCareer;
    const matchesSemester = currentSemester === "all" || String(guide.sem) === String(currentSemester);
    return matchesCareer && matchesSemester;
  });

  guidesGrid.innerHTML = filtered.map((guide) => `
    <article class="guide-card">
      <div class="guide-meta" style="display: flex; gap: 5px; margin-bottom: 10px;">
        <span class="pill">${careerName(guide.career)}</span>
        <span class="pill">Sem. ${guide.sem}</span>
      </div>
      <h3>${guide.title}</h3>
      <p>${guide.desc}</p>
      <div class="guide-actions" style="margin-top: 15px; display: flex; justify-between; align-items: center; gap: 10px;">
        <span class="pill">${(guide.topics || []).length} temas</span>
        <button class="btn-secondary" data-guide="${guide.id}" type="button">Ver guía</button>
      </div>
    </article>
  `).join("");
  
  if (emptyGuides) {
    emptyGuides.style.display = filtered.length ? "none" : "block";
  }
  
  guidesGrid.querySelectorAll("[data-guide]").forEach((button) => {
    button.addEventListener("click", () => openGuide(button.dataset.guide));
  });
}

function openGuide(id) {
  const guide = guides.find((item) => String(item.id) === String(id));
  if (!guide || !modalBody || !modal) return;

  modalBody.innerHTML = `
    <h2>${guide.title}</h2>
    <p class="pill" style="display: inline-block; margin: 10px 0;">${careerName(guide.career)} - Semestre ${guide.sem}</p>
    <p style="margin: 15px 0; line-height: 1.6;">${guide.detail || guide.desc}</p>
    <h3>Temario</h3>
    <div class="filters" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 15px 0;">
      ${(guide.topics || []).map((topic) => `<span class="pill">${topic}</span>`).join("")}
    </div>
    ${guide.fileUrl ? `<p style="margin-top: 20px;"><a class="btn-primary" href="${guide.fileUrl}" target="_blank" rel="noopener">Abrir recurso</a></p>` : ""}
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
  const isAdminLocal = session && (session.role === "admin" || session.email === "admin@learnmore.local" || session.email?.includes("admin"));

  if (session?.email) {
    updateSessionUi(true, Boolean(isAdminLocal));
    return;
  }

  if (supabaseReady) {
    onAuthStateChanged((event, nextSession) => {
      const isLoggedIn = Boolean(nextSession?.user);
      if (isLoggedIn) {
        getSupabaseUserProfile(nextSession.user.id).then((profile) => {
          const isAdmin = profile?.role === "admin" || nextSession.user.email?.includes("admin");
          updateSessionUi(true, isAdmin);
        });
      } else {
        updateSessionUi(false, false);
      }
    });
    return;
  }

  const user = getLocalCurrentUser();
  updateSessionUi(Boolean(user), user?.role === "admin");
}

function updateSessionUi(isLoggedIn, isAdmin = false) {
  const loginLink = document.querySelector("#loginNavLink");
  const profileLink = document.querySelector("#profileNavLink");
  const adminLink = document.querySelector("#adminNavLink");

  if (loginLink) {
    loginLink.hidden = isLoggedIn;
    loginLink.textContent = "Entrar";
    loginLink.href = "login.html";
  }
  if (profileLink) profileLink.hidden = !isLoggedIn || isAdmin;
  if (adminLink) adminLink.hidden = !isAdmin;

  document.querySelector("#createAccountBtn")?.toggleAttribute("hidden", isLoggedIn);
  document.querySelector("#heroProfileBtn")?.toggleAttribute("hidden", !isLoggedIn);
  document.querySelector("#heroProfileBtn")?.toggleAttribute("hidden", isAdmin);
  if (typeof applyLanguage === "function") applyLanguage();
}

async function getSupabaseUserProfile(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

function normalizeCareers(items) {
  return Array.isArray(items) && items.length ? items : baseCareerOptions();
}
