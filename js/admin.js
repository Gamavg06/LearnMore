import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
import { firebaseReady, auth, db, doc, getDoc, onAuthStateChanged, signOut } from "./firebase.js";
import {
  subscribeGuides,
  subscribeCareers,
  subscribeMessages,
  subscribeUsers,
  subscribeActivity,
  saveGuide,
  deleteGuide,
  saveCareer,
  deleteCareer,
  updateMessageStatus,
  saveUser,
  deleteUser,
} from "./guides.js";

initTheme();
initLanguage();

let guides = [];
let careers = [];
let messages = [];
let users = [];
let activity = [];

if (firebaseReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getUserProfile(user);
    if (profile?.role !== "admin") {
      window.location.href = "login.html";
    }
  });
} else {
  const session = getLocalSession();
  if (!session || session.role !== "admin") {
    window.location.href = "login.html";
  } else {
    await saveUser({
      id: session.email,
      name: session.name || "Administrador",
      email: session.email,
      role: "admin",
    });
  }
}

document.querySelectorAll(".admin-tab").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
  if (firebaseReady) await signOut(auth);
  sessionStorage.removeItem("sgnia.session");
  window.location.href = "login.html";
});

subscribeCareers((items) => {
  careers = items;
  renderCareerSelect();
  renderCareers();
  renderDashboard();
});
subscribeGuides((items) => {
  guides = items;
  renderGuides();
  renderDashboard();
});
subscribeMessages((items) => {
  messages = items;
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

document.querySelector("#guideForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.file = form.file.files[0] || null;
  try {
    await saveGuide(data);
    form.reset();
    form.id.value = "";
    document.querySelector("#guideStatus").textContent = "Guia guardada correctamente.";
  } catch (error) {
    document.querySelector("#guideStatus").textContent = error.message;
  }
});

document.querySelector("#clearGuideForm")?.addEventListener("click", () => {
  document.querySelector("#guideForm").reset();
  document.querySelector("#guideForm").id.value = "";
});

document.querySelector("#careerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  await saveCareer(Object.fromEntries(new FormData(form)));
  form.reset();
  form.color.value = "#00d4ff";
});

document.querySelector("#userForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await saveUser(Object.fromEntries(new FormData(form)));
    form.reset();
    form.id.value = "";
    document.querySelector("#userStatus").textContent = "Usuario guardado correctamente.";
  } catch (error) {
    document.querySelector("#userStatus").textContent = error.message;
  }
});

document.querySelector("#clearUserForm")?.addEventListener("click", () => {
  document.querySelector("#userForm").reset();
  document.querySelector("#userForm").id.value = "";
});

document.querySelector("#userSearch")?.addEventListener("input", renderUsers);
document.querySelector("#userRoleFilter")?.addEventListener("change", renderUsers);

function switchView(view) {
  document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".admin-view").forEach((panel) => panel.classList.toggle("active", panel.id === `${view}View`));
  document.querySelector("#viewTitle").textContent = viewLabel(view);
}

function viewLabel(view) {
  return { dashboard: "Dashboard", guides: "Guias", careers: "Carreras", messages: "Mensajes", users: "Usuarios" }[view] || view;
}

function renderDashboard() {
  const semesters = new Set(guides.map((guide) => guide.sem));
  const metrics = [
    ["Guias", guides.length],
    ["Carreras", careers.length],
    ["Semestres", semesters.size],
    ["Mensajes", messages.length],
    ["Usuarios", users.length],
    ["Firebase", firebaseReady ? "Activo" : "Local"],
  ];
  document.querySelector("#metricGrid").innerHTML = metrics.map(([label, value]) => `
    <article class="metric-card"><strong>${value}</strong><span>${label}</span></article>
  `).join("");
}

function renderActivity() {
  const list = activity.slice(0, 8);
  document.querySelector("#activityList").innerHTML = list.length ? list.map((item) => `
    <article class="list-item"><strong>${item.text || item.type}</strong><p>${formatDate(item.createdAt)}</p></article>
  `).join("") : `<p class="form-note">Sin actividad reciente.</p>`;
}

function renderCareerSelect() {
  document.querySelector("#guideCareer").innerHTML = careers.map((career) => `
    <option value="${career.key || career.id}">${career.name}</option>
  `).join("");
}

function renderGuides() {
  document.querySelector("#guideList").innerHTML = guides.map((guide) => `
    <article class="list-item">
      <header><strong>${guide.title}</strong><span class="pill">Sem. ${guide.sem}</span></header>
      <p>${guide.desc}</p>
      <div class="item-actions">
        <button class="small-btn" data-edit-guide="${guide.id}" type="button">Editar</button>
        <button class="danger-btn" data-delete-guide="${guide.id}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-edit-guide]").forEach((button) => button.addEventListener("click", () => fillGuide(button.dataset.editGuide)));
  document.querySelectorAll("[data-delete-guide]").forEach((button) => button.addEventListener("click", () => deleteGuide(button.dataset.deleteGuide)));
}

function fillGuide(id) {
  const guide = guides.find((item) => item.id === id);
  const form = document.querySelector("#guideForm");
  form.id.value = guide.id;
  form.title.value = guide.title || "";
  form.desc.value = guide.desc || "";
  form.detail.value = guide.detail || "";
  form.career.value = guide.career || "";
  form.sem.value = guide.sem || "";
  form.topics.value = (guide.topics || []).join(", ");
  form.fileUrl.value = guide.fileUrl || "";
  switchView("guides");
}

function renderCareers() {
  document.querySelector("#careerList").innerHTML = careers.map((career) => `
    <article class="list-item">
      <header><strong>${career.name}</strong><span class="pill">${career.key || career.id}</span></header>
      <p>${career.desc}</p>
      <div class="item-actions">
        <button class="small-btn" data-edit-career="${career.id}" type="button">Editar</button>
        <button class="danger-btn" data-delete-career="${career.id}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-edit-career]").forEach((button) => button.addEventListener("click", () => fillCareer(button.dataset.editCareer)));
  document.querySelectorAll("[data-delete-career]").forEach((button) => button.addEventListener("click", () => deleteCareer(button.dataset.deleteCareer)));
}

function fillCareer(id) {
  const career = careers.find((item) => item.id === id);
  const form = document.querySelector("#careerForm");
  form.id.value = career.id;
  form.key.value = career.key || career.id;
  form.name.value = career.name || "";
  form.desc.value = career.desc || "";
  form.color.value = career.color || "#00d4ff";
}

function renderMessages() {
  document.querySelector("#messageList").innerHTML = messages.map((message) => `
    <article class="list-item">
      <header><strong>${message.subject || "Mensaje"}</strong><span class="pill">${message.status || "nuevo"}</span></header>
      <p>${message.name} - ${message.email}</p>
      <p>${message.message}</p>
      <div class="item-actions">
        <button class="small-btn" data-message-read="${message.id}" type="button">Marcar revisado</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-message-read]").forEach((button) => {
    button.addEventListener("click", () => updateMessageStatus(button.dataset.messageRead, "revisado"));
  });
}

function renderUsers() {
  const search = document.querySelector("#userSearch")?.value.trim().toLowerCase() || "";
  const roleFilter = document.querySelector("#userRoleFilter")?.value || "all";
  const filtered = users.filter((user) => {
    const role = user.role || "user";
    const text = `${user.name || ""} ${user.email || ""}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesRole = roleFilter === "all" || role === roleFilter;
    return matchesSearch && matchesRole;
  });

  document.querySelector("#userList").innerHTML = filtered.length ? filtered.map((user) => `
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
    </article>
  `).join("") : `<p class="form-note">No hay usuarios con esos filtros.</p>`;

  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => fillUser(button.dataset.editUser));
  });
  document.querySelectorAll("[data-role-user]").forEach((button) => {
    button.addEventListener("click", () => changeUserRole(button.dataset.roleUser, button.dataset.role));
  });
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(button.dataset.deleteUser));
  });
}

function fillUser(id) {
  const user = users.find((item) => item.id === id);
  if (!user) return;
  const form = document.querySelector("#userForm");
  form.id.value = user.id;
  form.name.value = user.name || "";
  form.email.value = user.email || "";
  form.role.value = user.role || "user";
  form.password.value = user.password || "";
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

function getLocalSession() {
  try {
    return JSON.parse(sessionStorage.getItem("sgnia.session"));
  } catch {
    return null;
  }
}

async function getUserProfile(user) {
  const byUid = await getDoc(doc(db, "users", user.uid));
  if (byUid.exists()) return byUid.data();

  const byEmail = await getDoc(doc(db, "users", user.email));
  if (byEmail.exists()) return byEmail.data();

  return null;
}
