import { initTheme } from "./theme.js";
import { initLanguage, applyLanguage, translate, translateDynamic } from "./language.js";
import { supabaseReady, supabase, onAuthStateChanged } from "./supabase.js";
import { subscribeGuides, subscribeCareers, saveMessage, getLocalCurrentUser, getLocalSession, baseCareerOptions, incrementGuideViews, subscribeReviews, saveReview } from "./guides.js";
import { ejecutarMigracionAutomatica } from "./migrar.js";

let guides = [];
let careers = baseCareerOptions();
let reviews = [];
let activeCareer = "all";
let activeSemester = "all";
let isUserLoggedIn = false;

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
  renderCarousel();
  renderPopularGuides();
});

// ESCUCHADOR DE GUÍAS (SUPABASE / LOCAL)
subscribeGuides((items) => {
  console.log("Guías recibidas:", items);
  guides = items;
  
  renderStats();
  renderSemesterOptions();
  renderGuides();
  renderCarousel();
  renderPopularGuides();
});

subscribeReviews((items) => {
  console.log("Reseñas recibidas:", items);
  reviews = items;
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

async function renderCareers() {
  if (!careersGrid) return;
  
  // Imprimimos la estructura exacta que tus estilos CSS esperan para las tarjetas de carrera
  const cardsHtml = await Promise.all(careers.map(async (career) => {
    const cid = career.key || career.id;
    const cColor = career.color || "#00d4ff";
    const transKey = `career.${career.id || career.key}`;
    const cName = translate(transKey) !== transKey ? translate(transKey) : career.name;
    const cDesc = await translateDynamic(career.desc || career.description || "");
    const shortName = cName.slice(0, 2).toUpperCase();
    const guidesLabel = translate("nav.home") === "Inicio" ? "guías" : "guides";

    return `
      <article class="career-card" style="border-top: 4px solid ${cColor}; cursor: pointer;" data-career="${cid}">
        <div class="career-icon" style="background: ${cColor}20; color: ${cColor}; display: inline-block; padding: 10px; border-radius: 50%; font-weight: bold; margin-bottom: 10px;">
          ${shortName}
        </div>
        <h3>${cName}</h3>
        <p>${cDesc}</p>
        <span class="pill" style="background: ${cColor}15; color: ${cColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
          ${countGuides(cid)} ${guidesLabel}
        </span>
      </article>
    `;
  }));

  careersGrid.innerHTML = cardsHtml.join("");

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
  const options = normalizeCareers(careers).map((career) => {
    const cid = career.key || career.id;
    const transKey = `career.${career.id || career.key}`;
    const name = translate(transKey) !== transKey ? translate(transKey) : career.name;
    return `<option value="${cid}">${name}</option>`;
  }).join("");
  contactCareer.innerHTML = `<option value="">${translate("career.general")}</option>${options}`;
}

function renderSemesterOptions() {
  if (!semesterFilter) return;
  const current = semesterFilter.value || "all";
  const semesters = [...new Set(guides.map((guide) => Number(guide.sem)).filter(Boolean))].sort((a, b) => a - b);
  const semLabel = translate("nav.home") === "Inicio" ? "Semestre" : "Semester";
  semesterFilter.innerHTML = `<option value="all" data-i18n="filters.semester">${translate("filters.semester")}</option>${semesters.map((sem) => `<option value="${sem}">${semLabel} ${sem}</option>`).join("")}`;
  semesterFilter.value = semesters.includes(Number(current)) ? current : "all";
  activeSemester = semesterFilter.value || "all";
}

async function renderGuides() {
  if (!guidesGrid) return;
  
  const currentCareer = activeCareer || "all";
  const currentSemester = activeSemester || "all";

  const filtered = guides.filter((guide) => {
    const matchesCareer = currentCareer === "all" || guide.career === currentCareer;
    const matchesSemester = currentSemester === "all" || String(guide.sem) === String(currentSemester);
    return matchesCareer && matchesSemester;
  });

  const cardsHtml = await Promise.all(filtered.map(async (guide) => {
    const titleTrans = await translateDynamic(guide.title);
    const descTrans = await translateDynamic(guide.desc);
    return `
      <article class="guide-card">
        <div class="guide-meta" style="display: flex; gap: 5px; margin-bottom: 10px;">
          <span class="pill">${careerName(guide.career)}</span>
          <span class="pill">Sem. ${guide.sem}</span>
        </div>
        <h3>${titleTrans}</h3>
        <p>${descTrans}</p>
        <div class="guide-actions" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <span class="pill">${(guide.topics || []).length} ${translate("nav.home") === "Inicio" ? "temas" : "topics"}</span>
          <button class="btn-secondary" data-guide="${guide.id}" type="button">${translate("guides.view")}</button>
        </div>
      </article>
    `;
  }));

  guidesGrid.innerHTML = cardsHtml.join("");
  
  if (emptyGuides) {
    emptyGuides.style.display = filtered.length ? "none" : "block";
  }
  
  guidesGrid.querySelectorAll("[data-guide]").forEach((button) => {
    button.addEventListener("click", () => openGuide(button.dataset.guide));
  });
}

async function openGuide(id) {
  if (!isUserLoggedIn) {
    alert(translate("profile.loginPrompt"));
    window.location.href = "login.html";
    return;
  }

  const guide = guides.find((item) => String(item.id) === String(id));
  if (!guide || !modalBody || !modal) return;

  // Incrementar vistas
  incrementGuideViews(id);

  const titleTrans = await translateDynamic(guide.title);
  const detailTrans = await translateDynamic(guide.detail || guide.desc);
  const topicsTrans = await Promise.all((guide.topics || []).map(topic => translateDynamic(topic)));

  // Get reviews and calculate average rating
  const guideReviews = reviews.filter(r => r.comment && r.comment.startsWith(`[guide:${id}]`));
  const totalReviews = guideReviews.length;
  const avgStars = totalReviews > 0 ? (guideReviews.reduce((sum, r) => sum + (r.stars || r.rating || 0), 0) / totalReviews).toFixed(1) : 0;
  const currentUser = getLocalCurrentUser();

  modalBody.innerHTML = `
    <h2>${titleTrans}</h2>
    <p class="pill" style="display: inline-block; margin: 10px 0;">${careerName(guide.career)} - ${translate("profile.semester")} ${guide.sem}</p>
    <p style="margin: 15px 0; line-height: 1.6;">${detailTrans}</p>
    <h3>${translate("nav.home") === "Inicio" ? "Temario" : "Syllabus"}</h3>
    <div class="filters" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 15px 0;">
      ${topicsTrans.map((topic) => `<span class="pill">${topic}</span>`).join("")}
    </div>
    ${guide.fileUrl ? `<p style="margin-top: 20px;"><a class="btn-primary" href="${guide.fileUrl}" target="_blank" rel="noopener">${translate("nav.home") === "Inicio" ? "Abrir recurso" : "Open resource"}</a></p>` : ""}
    
    <div class="guide-rating-summary" style="margin-top: 25px; padding-top: 20px; border-top: 1px solid var(--border);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 1.15rem;">${translate("nav.home") === "Inicio" ? "Calificaciones y Reseñas" : "Ratings & Reviews"}</h3>
        <span style="font-weight: bold; color: #fbbf24; font-size: 1rem; display: flex; align-items: center; gap: 4px;">
          ${totalReviews > 0 ? `★ ${avgStars} (${totalReviews})` : `★ -- (0)`}
        </span>
      </div>
      
      <!-- List of reviews -->
      <div class="guide-reviews-list" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; padding-right: 5px;">
        ${guideReviews.length === 0 ? `
          <p style="color: var(--muted); text-align: center; margin: 10px 0; font-size: 0.9rem;">${translate("nav.home") === "Inicio" ? "Aún no hay reseñas para esta guía. ¡Sé el primero en calificarla!" : "No reviews yet for this guide. Be the first to rate it!"}</p>
        ` : guideReviews.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(r => {
          const cleanComment = r.comment ? r.comment.replace(/^\[guide:[^\]]+\]\s*/, '') : '';
          const starsStr = '★'.repeat(r.stars || r.rating || 0) + '☆'.repeat(5 - (r.stars || r.rating || 0));
          return `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.85rem; color: var(--text);">${r.name || translate("profile.anonymous")}</strong>
                <span style="color: #fbbf24; font-size: 0.85rem;">${starsStr}</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 0.85rem; color: var(--text); opacity: 0.9; line-height: 1.3;">${cleanComment}</p>
              ${r.reply ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); padding-left: 8px; border-left: 2px solid var(--accent); background: rgba(255,255,255,0.01);">
                  <strong style="font-size: 0.8rem; color: var(--accent);">${translate("profile.adminReply")}</strong>
                  <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text); opacity: 0.8; line-height: 1.3;">${r.reply}</p>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Add review form -->
      <form id="guideReviewForm" style="display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.01); border: 1px solid var(--border); border-radius: 10px; padding: 12px;">
        <h4 style="margin: 0; font-size: 0.95rem;">${translate("nav.home") === "Inicio" ? "Califica este recurso" : "Rate this resource"}</h4>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.85rem; color: var(--muted);">${translate("nav.home") === "Inicio" ? "Calificación:" : "Rating:"}</span>
          <div class="star-rating-input" style="display: flex; gap: 4px; font-size: 1.4rem;">
            <span class="guide-star-interactive" data-star="1" style="cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.1s;">★</span>
            <span class="guide-star-interactive" data-star="2" style="cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.1s;">★</span>
            <span class="guide-star-interactive" data-star="3" style="cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.1s;">★</span>
            <span class="guide-star-interactive" data-star="4" style="cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.1s;">★</span>
            <span class="guide-star-interactive" data-star="5" style="cursor: pointer; color: rgba(255,255,255,0.2); transition: color 0.1s;">★</span>
          </div>
        </div>
        <textarea id="guideReviewComment" placeholder="${translate("nav.home") === "Inicio" ? "Escribe tu comentario sobre esta guía..." : "Write your review for this guide..."}" required style="width: 100%; min-height: 60px; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--text); font-family: inherit; font-size: 0.85rem; resize: vertical;"></textarea>
        <button type="submit" class="btn-primary" style="align-self: flex-start; padding: 6px 12px; font-size: 0.85rem; min-height: auto;">${translate("nav.home") === "Inicio" ? "Enviar Calificación" : "Submit Rating"}</button>
      </form>
    </div>
  `;

  modal.showModal();

  // Interactive star rating
  let selectedStars = 0;
  const stars = modalBody.querySelectorAll(".guide-star-interactive");
  
  function highlightStars(count) {
    stars.forEach(star => {
      const val = parseInt(star.dataset.star);
      if (val <= count) {
        star.style.color = "#fbbf24";
        star.style.textShadow = "0 0 5px rgba(251, 191, 36, 0.4)";
      } else {
        star.style.color = "rgba(255,255,255,0.2)";
        star.style.textShadow = "none";
      }
    });
  }

  stars.forEach(star => {
    star.addEventListener("mouseover", () => {
      const val = parseInt(star.dataset.star);
      highlightStars(val);
    });
    star.addEventListener("mouseout", () => {
      highlightStars(selectedStars);
    });
    star.addEventListener("click", () => {
      selectedStars = parseInt(star.dataset.star);
      highlightStars(selectedStars);
    });
  });

  // Submit review form
  const reviewForm = modalBody.querySelector("#guideReviewForm");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const commentInput = modalBody.querySelector("#guideReviewComment");
      const commentText = commentInput.value.trim();
      
      if (selectedStars === 0) {
        alert(translate("nav.home") === "Inicio" ? "Por favor selecciona una calificación de estrellas." : "Please select a star rating.");
        return;
      }
      
      const payload = {
        name: currentUser?.name || translate("profile.anonymous"),
        email: currentUser?.email || "",
        stars: selectedStars,
        comment: `[guide:${id}] ${commentText}`,
        created_at: new Date().toISOString()
      };
      
      try {
        await saveReview(payload);
        openGuide(id);
      } catch (err) {
        alert("Error al enviar reseña: " + err.message);
      }
    });
  }
}

function countGuides(careerKey) {
  return guides.filter((guide) => guide.career === careerKey).length;
}

function careerName(key) {
  const career = careers.find((career) => (career.key || career.id) === key);
  if (!career) return key;
  const transKey = `career.${career.id || career.key}`;
  return translate(transKey) !== transKey ? translate(transKey) : career.name;
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
  isUserLoggedIn = isLoggedIn;
  const loginLink = document.querySelector("#loginNavLink");
  const profileLink = document.querySelector("#profileNavLink");
  const adminLink = document.querySelector("#adminNavLink");

  if (loginLink) {
    loginLink.hidden = isLoggedIn;
    loginLink.textContent = translate("nav.login");
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

async function renderCarousel() {
  const track = document.querySelector("#carouselTrack");
  if (!track) return;

  if (!guides.length) {
    track.innerHTML = `<p class="empty-state" style="display:block;">${translate("guides.empty")}</p>`;
    return;
  }

  const cardsHtml = await Promise.all(guides.map(async (guide) => {
    const titleTrans = await translateDynamic(guide.title);
    const descTrans = await translateDynamic(guide.desc);
    return `
      <article class="guide-card">
        <div class="guide-meta" style="display: flex; gap: 5px; margin-bottom: 10px;">
          <span class="pill">${careerName(guide.career)}</span>
          <span class="pill">Sem. ${guide.sem}</span>
        </div>
        <h3>${titleTrans}</h3>
        <p>${descTrans}</p>
        <div class="guide-actions" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <span class="pill">${(guide.topics || []).length} ${translate("nav.home") === "Inicio" ? "temas" : "topics"}</span>
          <button class="btn-secondary" data-guide="${guide.id}" type="button">${translate("guides.view")}</button>
        </div>
      </article>
    `;
  }));

  track.innerHTML = cardsHtml.join("");

  track.querySelectorAll("[data-guide]").forEach((button) => {
    button.addEventListener("click", () => openGuide(button.dataset.guide));
  });
}

async function renderPopularGuides() {
  const grid = document.querySelector("#popularGuidesGrid");
  if (!grid) return;

  if (!guides.length) {
    grid.innerHTML = `<p class="empty-state" style="display:block;">${translate("guides.empty")}</p>`;
    return;
  }

  const sorted = [...guides].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  const popular = sorted.slice(0, 4);

  const cardsHtml = await Promise.all(popular.map(async (guide) => {
    const titleTrans = await translateDynamic(guide.title);
    const descTrans = await translateDynamic(guide.desc);
    return `
      <article class="guide-card" style="border-left: 4px solid var(--accent-3);">
        <div class="guide-meta" style="display: flex; gap: 5px; margin-bottom: 10px;">
          <span class="pill">${careerName(guide.career)}</span>
          <span class="pill">Sem. ${guide.sem}</span>
          <span class="pill" style="color: var(--accent); border-color: var(--accent-border-soft); font-weight: bold;">🔥 ${Number(guide.views) || 0}</span>
        </div>
        <h3>${titleTrans}</h3>
        <p>${descTrans}</p>
        <div class="guide-actions" style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <span class="pill">${(guide.topics || []).length} ${translate("nav.home") === "Inicio" ? "temas" : "topics"}</span>
          <button class="btn-secondary" data-guide="${guide.id}" type="button">${translate("guides.view")}</button>
        </div>
      </article>
    `;
  }));

  grid.innerHTML = cardsHtml.join("");

  grid.querySelectorAll("[data-guide]").forEach((button) => {
    button.addEventListener("click", () => openGuide(button.dataset.guide));
  });
}

// Escuchador de evento de idioma para actualizar las guías dinámicas
window.addEventListener("learnmore:language-change", () => {
  renderCareers();
  renderCareerOptions();
  renderGuides();
  renderCarousel();
  renderPopularGuides();
  renderStats();
  renderSemesterOptions();
});

// Inicialización de desplazamiento del carrusel
const prevBtn = document.querySelector("#carouselPrev");
const nextBtn = document.querySelector("#carouselNext");
const track = document.querySelector("#carouselTrack");
if (prevBtn && nextBtn && track) {
  prevBtn.addEventListener("click", () => {
    track.scrollLeft -= 320;
  });
  nextBtn.addEventListener("click", () => {
    track.scrollLeft += 320;
  });
}
