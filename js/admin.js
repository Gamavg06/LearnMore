import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
import { supabase, supabaseReady } from './supabase.js';
import {
  subscribeGuides,
  subscribeCareers,
  subscribeMessages,
  subscribeGmailMessages,
  subscribeUsers,
  subscribeActivity,
  subscribeReviews,
  saveGuide,
  deleteGuide,
  saveCareer,
  deleteCareer,
  updateMessageStatus,
  replyToMessage,
  saveUser,
  deleteUser,
  updateReviewStatus,
  replyToReview,
  deleteReview,
  baseCareerOptions,
  getLocalSession,
} from "./guides.js";

initTheme();
initLanguage();

let guides = [];
let careers = baseCareerOptions();
let contactMessages = [];
let gmailMessages = [];
let users = [];
let activity = [];
let reviews = [];

renderCareerSelect();
renderCareers();

subscribeCareers((items) => {
  careers = normalizeCareers(items);
  renderCareerSelect();
  renderCareers();
  renderDashboard();
});
subscribeGuides((items) => {
   console.log('[admin] guides updated:', items);
   guides = items;
   renderGuides();
   renderDashboard();
});
subscribeMessages((items) => {
  contactMessages = items;
  renderMessages();
  renderDashboard();
});
subscribeGmailMessages((items) => {
  gmailMessages = items;
  renderMessages();
  renderDashboard();
});
subscribeUsers((items) => {
  users = items;
  renderUsers();
  renderDashboard();
});
subscribeActivity((items) => {
  activity = items;
  renderActivity();
});
subscribeReviews((items) => {
   reviews = items;
   console.log('[admin] reviews updated:', items);
   renderReviews();
   renderDashboard();
});

const session = getLocalSession();
const isAdminLocal = session && (session.role === "admin" || session.email === "admin@learnmore.local" || session.email?.includes("admin"));

if (isAdminLocal) {
  setTimeout(async () => {
    try {
      await saveUser({
        id: session.email,
        name: session.name || "Administrador",
        email: session.email,
        role: "admin",
      });
    } catch (e) {
      console.error("Error al registrar el perfil local de administrador:", e);
    }
  }, 100);
} else if (supabaseReady) {
supabase.auth.onAuthStateChange((event, nextSession) => {
     if (nextSession?.user) {
       getUserProfile(nextSession.user.id).then((profile) => {
        const isAdmin = profile?.role === "admin" || nextSession.user.email?.includes("admin");
        if (!isAdmin) window.location.href = "login.html";
      }).catch(() => {
        if (!nextSession.user.email?.includes("admin")) window.location.href = "login.html";
      });
    }
    if (event === "SIGNED_OUT") window.location.href = "login.html";
  });
} else {
  if (!session || session.role !== "admin") window.location.href = "login.html";
}

document.querySelectorAll(".admin-tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
  try {
    if (supabaseReady) await supabase.auth.signOut();
  } catch (e) {
    console.warn("Logout error:", e);
  }
  sessionStorage.removeItem("learnmore.session");
  window.location.href = "login.html";
});

document.querySelector("#guideForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const statusElement = document.querySelector("#guideStatus");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  data.file = form.file?.files[0] || null;
  const topicsRaw = formData.get("topics") || data.topics || "";
  data.topics = String(topicsRaw)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  data.sem = Number(data.sem || 1);

  try {
    if (statusElement) statusElement.textContent = "Guardando guía...";
    await saveGuide(data);
    form.reset();
    if (form.id) form.id.value = "";
    if (statusElement) statusElement.textContent = "Guia guardada correctamente.";
  } catch (error) {
    if (statusElement) statusElement.textContent = `Error: ${error.message}`;
  }
});

document.querySelector("#clearGuideForm")?.addEventListener("click", () => {
  const form = document.querySelector("#guideForm");
  if (form) {
    form.reset();
    if (form.id) form.id.value = "";
  }
});

document.querySelector("#careerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await saveCareer(Object.fromEntries(new FormData(form)));
    form.reset();
    if (form.color) form.color.value = "#00d4ff";
  } catch (error) {
    alert("Error al guardar carrera: " + error.message);
  }
});

document.querySelector("#userForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const statusElement = document.querySelector("#userStatus");
  try {
    await saveUser(Object.fromEntries(new FormData(form)));
    form.reset();
    if (form.id) form.id.value = "";
    if (statusElement) statusElement.textContent = "Usuario guardado correctamente.";
  } catch (error) {
    if (statusElement) statusElement.textContent = `Error: ${error.message}`;
  }
});

document.querySelector("#clearUserForm")?.addEventListener("click", () => {
  const form = document.querySelector("#userForm");
  if (form) {
    form.reset();
    if (form.id) form.id.value = "";
  }
});

document.querySelector("#userSearch")?.addEventListener("input", renderUsers);
document.querySelector("#userRoleFilter")?.addEventListener("change", renderUsers);

function switchView(view) {
  document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".admin-view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
  const viewTitle = document.querySelector("#viewTitle");
  if (viewTitle) viewTitle.textContent = viewLabel(view);
}

function viewLabel(view) {
  return { dashboard: "Dashboard", guides: "Guias", careers: "Carreras", messages: "Mensajes", users: "Usuarios", reviews: "Reseñas" }[view] || view;
}

function renderDashboard() {
  const metricGrid = document.querySelector("#metricGrid");
  if (!metricGrid) return;

  const semesters = new Set(guides.map((guide) => guide.sem));
  const metrics = [
    ["Guias", guides.length],
    ["Carreras", careers.length],
    ["Semestres", semesters.size],
    ["Mensajes", contactMessages.length + gmailMessages.length],
    ["Usuarios", users.length],
    ["Reseñas", reviews.length],
    ["Supabase", supabaseReady ? "Activo" : "Local"],
  ];

  metricGrid.innerHTML = metrics
    .map(([label, value]) => `<article class="metric-card"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");
}

function renderActivity() {
  const activityList = document.querySelector("#activityList");
  if (!activityList) return;

  const list = activity.slice(0, 8);
  activityList.innerHTML = list.length
    ? list.map((item) => `<article class="list-item"><strong>${item.text || item.type}</strong><p>${formatDate(item.createdAt || item.created_at)}</p></article>`).join("")
    : `<p class="form-note">Sin actividad reciente.</p>`;
}

function renderCareerSelect() {
  const guideCareer = document.querySelector("#guideCareer");
  if (!guideCareer) return;

  const opts = [
    { key: "general", name: "General (todas las carreras)", id: "general" },
    ...normalizeCareers(careers)
  ];

  guideCareer.innerHTML = opts
    .map((career) => {
      const value = career.key || career.id;
      const label = career.name;
      return `<option value="${value}">${label}</option>`;
    })
    .join("");
}

function renderGuides() {
  const guideList = document.querySelector("#guideList");
  if (!guideList) return;

  console.log('[admin] renderGuides called, guides count:', guides.length);

  guideList.innerHTML = guides
    .map(
      (guide) => `
      <article class="list-item">
        <header><strong>${guide.title}</strong><span class="pill">Sem. ${guide.sem}</span></header>
        <p>${guide.desc}</p>
        <div class="item-actions">
          <button class="small-btn" data-edit-guide="${guide.id}" type="button">Editar</button>
          <button class="danger-btn" data-delete-guide="${guide.id}" type="button">Eliminar</button>
        </div>
      </article>`
    )
    .join("");

  // Delegación de eventos: no aquí.
  // (Los botones se regeneran en renderGuides(), pero el handler se registra
  // una sola vez con delegación en el contenedor #guideList.)
}

// Delegación de eventos: funciona aunque renderGuides() vuelva a inyectar HTML.
const guideListEl = document.querySelector("#guideList");
if (guideListEl) {
  guideListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-guide]");
    if (editBtn) {
      console.log('[admin] Click edit guide, id:', editBtn.dataset.editGuide);
      fillGuide(editBtn.dataset.editGuide);
      return;
    }

    const delBtn = e.target.closest("[data-delete-guide]");
    if (delBtn) {
      console.log('[admin] Click delete guide, id:', delBtn.dataset.deleteGuide);
      if (confirm("¿Estás seguro de eliminar esta guía?")) {
        try {
          await deleteGuide(delBtn.dataset.deleteGuide);
        } catch (error) {
          alert("Error al eliminar: " + error.message);
        }
      }
    }
  });
}



function fillGuide(id) {
  const guide = guides.find((item) => String(item.id) === String(id));
  if (!guide) return;

  const form = document.querySelector("#guideForm");
  if (!form) return;

  form.id.value = guide.id;
  if (form.title) form.title.value = guide.title || "";
  if (form.desc) form.desc.value = guide.desc || "";
  if (form.detail) form.detail.value = guide.detail || "";
  if (form.career) {
    // Soporta "general" (todas las carreras) si así fue guardado.
    form.career.value = guide.career || guide.careerCode || "";
  }
  if (form.sem) form.sem.value = guide.sem || "";
  if (form.topics) form.topics.value = (guide.topics || []).join(", ");
  if (form.fileUrl) form.fileUrl.value = guide.fileUrl || "";

  switchView("guides");
}

function renderCareers() {
  const careerList = document.querySelector("#careerList");
  if (!careerList) return;

  careerList.innerHTML = careers
    .map(
      (career) => `
      <article class="list-item">
        <header><strong>${career.name}</strong><span class="pill">${career.key || career.id}</span></header>
        <p>${career.desc}</p>
        <div class="item-actions">
          <button class="small-btn" data-edit-career="${career.id}" type="button">Editar</button>
          <button class="danger-btn" data-delete-career="${career.id}" type="button">Eliminar</button>
        </div>
      </article>`
    )
    .join("");
}

const careerListEl = document.querySelector("#careerList");
if (careerListEl) {
  careerListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-career]");
    if (editBtn && careerListEl.contains(editBtn)) {
      fillCareer(editBtn.dataset.editCareer);
      return;
    }

    const delBtn = e.target.closest("[data-delete-career]");
    if (delBtn && careerListEl.contains(delBtn)) {
      if (confirm("¿Estás seguro de eliminar esta carrera?")) {
        try {
          await deleteCareer(delBtn.dataset.deleteCareer);
        } catch (error) {
          alert("Error al eliminar: " + error.message);
        }
      }
    }
  });
}

function fillCareer(id) {
  const career = careers.find((item) => item.name === id || String(item.id) === String(id));
  if (!career) return;

  const form = document.querySelector("#careerForm");
  if (!form) return;

  form.id.value = career.id;
  if (form.name) form.name.value = career.name || "";
  if (form.desc) form.desc.value = career.description || career.desc || "";
  if (form.color) form.color.value = career.color || "#00d4ff";

  switchView("careers");
}

function renderMessages() {
  const messageList = document.querySelector("#messageList");
  if (!messageList) return;

  const combined = [];

  contactMessages.forEach((msg) => {
    const date = msg.created_at ? new Date(msg.created_at) : new Date();
    combined.push({
      id: msg.id,
      type: "contact",
      subject: msg.subject || "Mensaje",
      name: msg.name || "",
      email: msg.email || "",
      message: msg.message || "",
      reply: msg.reply || "",
      replied_by: msg.replied_by || "",
      replied_at: msg.replied_at || "",
      status: msg.status || "nuevo",
      date,
    });
  });

  gmailMessages.forEach((msg) => {
    const date = msg.receivedAt ? new Date(msg.receivedAt) : msg.syncedAt ? new Date(msg.syncedAt) : new Date();
    combined.push({
      id: msg.id,
      type: "gmail",
      subject: msg.subject || "(Sin asunto)",
      name: msg.from || "",
      email: "",
      message: msg.body || "",
      reply: msg.reply || "",
      replied_by: msg.replied_by || "",
      replied_at: msg.replied_at || "",
      status: msg.status || "nuevo",
      date,
    });
  });

  combined.sort((a, b) => b.date - a.date);

  messageList.innerHTML = combined.length
    ? combined
        .map(
          (message) => `
      <article class="list-item">
        <header>
          <strong>${message.subject}</strong>
          <span class="pill">${statusLabel(message.status)}</span>
        </header>
        <p><strong>${message.name}</strong>${message.email ? ` — ${message.email}` : ""}</p>
        <p>${message.message}</p>
        ${message.reply ? `<p class="reply-preview"><strong>Respuesta:</strong> ${message.reply}</p>` : ""}
        <div class="item-actions">
          ${message.status !== "leido" && message.status !== "respondido" ? `<button class="small-btn" data-message-read="${message.id}" type="button">Marcar leído</button>` : ""}
          ${!message.reply ? `<button class="small-btn" data-message-reply="${message.id}" type="button">Responder</button>` : ""}
        </div>
      </article>`
        )
        .join("")
    : `<p class="form-note">No hay mensajes.</p>`;
}

function statusLabel(status) {
  const labels = { nuevo: "Nuevo", leido: "Leído", revisado: "Revisado", respondido: "Respondido" };
  return labels[status] || status;
}

const messageListEl = document.querySelector("#messageList");
if (messageListEl) {
  messageListEl.addEventListener("click", async (e) => {
    const readBtn = e.target.closest("[data-message-read]");
    if (readBtn && messageListEl.contains(readBtn)) {
      try {
        await updateMessageStatus(readBtn.dataset.messageRead, "leido");
      } catch (error) {
        alert("Error al actualizar mensaje: " + error.message);
      }
      return;
    }

    const replyBtn = e.target.closest("[data-message-reply]");
    if (replyBtn && messageListEl.contains(replyBtn)) {
      openReplyDrawer(replyBtn.dataset.messageReply);
    }
  });
}

function openReplyDrawer(id) {
  const allMessages = [...contactMessages, ...gmailMessages];
  const message = allMessages.find((item) => String(item.id) === String(id));
  if (!message) return;

  const subjectEl = document.getElementById("replyDrawerSubject");
  const recipientEl = document.getElementById("replyDrawerRecipient");
  const textEl = document.getElementById("replyDrawerText");
  const messageIdEl = document.getElementById("replyDrawerMessageId");
  const drawer = document.getElementById("replyDrawer");
  const overlay = document.getElementById("replyDrawerOverlay");

  messageIdEl.value = id;
  subjectEl.textContent = message.subject || "Mensaje";
  recipientEl.textContent = message.name || message.email || "";
  textEl.value = message.reply || "";

  drawer.classList.add("open");
  overlay.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  overlay.setAttribute("aria-hidden", "false");
  textEl.focus();
}

function closeReplyDrawer() {
  const drawer = document.getElementById("replyDrawer");
  const overlay = document.getElementById("replyDrawerOverlay");
  const form = document.getElementById("replyDrawerForm");

  drawer.classList.remove("open");
  overlay.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");
  form?.reset();
}

document.getElementById("replyDrawerClose")?.addEventListener("click", closeReplyDrawer);
document.getElementById("replyDrawerCancel")?.addEventListener("click", closeReplyDrawer);
document.getElementById("replyDrawerOverlay")?.addEventListener("click", closeReplyDrawer);

document.getElementById("replyDrawerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("replyDrawerMessageId")?.value;
  const reply = document.getElementById("replyDrawerText")?.value?.trim();
  if (!id || !reply) return;

  const adminName = getLocalSession()?.name || "Admin";
  try {
    await replyToMessage(id, reply, adminName);
    const updated = contactMessages.find((item) => String(item.id) === String(id))
      || gmailMessages.find((item) => String(item.id) === String(id));
    if (updated) {
      updated.reply = reply;
      updated.replied_at = new Date().toISOString();
      updated.replied_by = adminName;
      updated.status = "respondido";
      renderMessages();
    }
    closeReplyDrawer();
  } catch (error) {
    alert("Error al responder: " + error.message);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const drawer = document.getElementById("replyDrawer");
    if (drawer?.classList.contains("open")) {
      closeReplyDrawer();
    }
  }
});

function renderUsers() {
  const userList = document.querySelector("#userList");
  if (!userList) return;

  const search = document.querySelector("#userSearch")?.value.trim().toLowerCase() || "";
  const roleFilter = document.querySelector("#userRoleFilter")?.value || "all";

  const filtered = users.filter((user) => {
    const role = user.role || "user";
    const text = `${user.name || ""} ${user.email || ""}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesRole = roleFilter === "all" || role === roleFilter;
    return matchesSearch && matchesRole;
  });

  userList.innerHTML = filtered.length
    ? filtered
        .map(
          (user) => `
        <article class="list-item">
          <header><strong>${user.name || user.email}</strong><span class="pill">${user.role || "user"}</span></header>
          <p>${user.email}</p>
          <div class="item-actions">
            <button class="small-btn" data-edit-user="${user.id}" type="button">Editar</button>
            <button class="small-btn" data-role-user="${user.id}" data-role="${user.role === "admin" ? "user" : "admin"}" type="button">
              ${user.role === "admin" ? "Quitar admin" : "Hacer admin"}
            </button>
            <button class="danger-btn" data-delete-user="${user.id}" type="button">Eliminar</button>
          </div>
        </article>`
        )
        .join("")
    : `<p class="form-note">No hay usuarios con esos filtros.</p>`;
}

const userListEl = document.querySelector("#userList");
if (userListEl) {
  userListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-user]");
    if (editBtn && userListEl.contains(editBtn)) {
      fillUser(editBtn.dataset.editUser);
      return;
    }

    const roleBtn = e.target.closest("[data-role-user]");
    if (roleBtn && userListEl.contains(roleBtn)) {
      await changeUserRole(roleBtn.dataset.roleUser, roleBtn.dataset.role);
      return;
    }

    const delBtn = e.target.closest("[data-delete-user]");
    if (delBtn && userListEl.contains(delBtn)) {
      if (confirm("¿Estás seguro de eliminar este usuario?")) {
        try {
          await deleteUser(delBtn.dataset.deleteUser);
        } catch (error) {
          alert("Error al eliminar: " + error.message);
        }
      }
    }
  });
}

function fillUser(id) {
  const user = users.find((item) => item.id === id);
  if (!user) return;

  const form = document.querySelector("#userForm");
  if (!form) return;

  form.id.value = user.id;
  if (form.name) form.name.value = user.name || "";
  if (form.email) form.email.value = user.email || "";
  if (form.role) form.role.value = user.role || "user";
  if (form.password) form.password.value = user.password || "";

  switchView("users");
}

async function changeUserRole(id, role) {
  const user = users.find((item) => item.id === id);
  if (!user) return;
  await saveUser({ ...user, role });
}

function formatDate(value) {
  if (!value) return "Ahora";
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return new Date(value).toLocaleString();
}


async function getUserProfile(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
  return data;
}

function normalizeCareers(items) {
  return Array.isArray(items) && items.length ? items : baseCareerOptions();
}

function renderReviews() {
  const reviewList = document.querySelector("#reviewList");
  if (!reviewList) return;

  reviewList.innerHTML = reviews.length
    ? reviews
        .sort((a, b) => new Date(b.created_at || b.date || b.created_at) - new Date(a.created_at || a.date || a.created_at))
        .map(
          (review) => `
        <article class="list-item">
          <header>
            <strong>${review.name || "Anónimo"}</strong>
            <span class="pill">${review.stars ? "★".repeat(review.stars) + "☆".repeat(5 - review.stars) : ""}</span>
            <span class="pill">${review.status || "nuevo"}</span>
          </header>
          <p>${review.comment || review.message || ""}</p>
          ${review.reply ? `<p class="reply-preview"><strong>Respuesta:</strong> ${review.reply}</p>` : ""}
          <div class="item-actions">
            ${review.status !== "leido" ? `<button class="small-btn" data-review-read="${review.id}" type="button">Marcar leído</button>` : ""}
            ${!review.reply ? `<button class="small-btn" data-review-reply="${review.id}" type="button">Responder</button>` : ""}
            <button class="danger-btn" data-delete-review="${review.id}" type="button">Eliminar</button>
          </div>
        </article>`
        )
        .join("")
    : `<p class="form-note">No hay reseñas.</p>`;
}

const reviewListEl = document.querySelector("#reviewList");
if (reviewListEl) {
  reviewListEl.addEventListener("click", async (e) => {
    const readBtn = e.target.closest("[data-review-read]");
    if (readBtn && reviewListEl.contains(readBtn)) {
      try {
        await updateReviewStatus(readBtn.dataset.reviewRead, "leido");
      } catch (error) {
        alert("Error al actualizar: " + error.message);
      }
      return;
    }

    const replyBtn = e.target.closest("[data-review-reply]");
    if (replyBtn && reviewListEl.contains(replyBtn)) {
      replyToReviewPrompt(replyBtn.dataset.reviewReply);
      return;
    }

    const delBtn = e.target.closest("[data-delete-review]");
    if (delBtn && reviewListEl.contains(delBtn)) {
      if (confirm("¿Estás seguro de eliminar esta reseña?")) {
        try {
          await deleteReview(delBtn.dataset.deleteReview);
        } catch (error) {
          alert("Error al eliminar reseña: " + error.message);
        }
      }
    }
  });
}

function replyToReviewPrompt(id) {
  const review = reviews.find((item) => String(item.id) === String(id));
  if (!review) return;

  const reply = prompt("Escribe tu respuesta:", review.reply || "");
  if (reply === null) return;

  const adminName = getLocalSession()?.name || "Admin";
  replyToReview(id, reply, adminName).then(() => {
    const updated = reviews.find((item) => String(item.id) === String(id));
    if (updated) {
      updated.reply = reply;
      updated.replied_at = new Date().toISOString();
      updated.replied_by = adminName;
      renderReviews();
    }
  }).catch((error) => {
    alert("Error al responder: " + error.message);
  });
}