import { initTheme } from "../js/theme.js";
import { initLanguage, translate, translateDynamic } from "../js/language.js";
import { supabase, supabaseReady } from '../js/supabase.js';
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
} from "../js/guides.js";

initTheme();
initLanguage();

let guides = [];
let careers = baseCareerOptions();
let contactMessages = [];
let gmailMessages = [];
let users = [];
let activity = [];
let reviews = [];
let activeReviewTab = "platform";

// Event listener for admin reviews tabs
document.querySelectorAll("#reviewsView .review-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#reviewsView .review-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeReviewTab = btn.dataset.tab;
    renderReviews();
  });
});

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
        if (!isAdmin) window.location.href = "../login.html";
      }).catch(() => {
        if (!nextSession.user.email?.includes("admin")) window.location.href = "../login.html";
      });
    }
    if (event === "SIGNED_OUT") window.location.href = "../login.html";
  });
} else {
  if (!session || session.role !== "admin") window.location.href = "../login.html";
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
  window.location.href = "../login.html";
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
    if (statusElement) statusElement.textContent = translate("admin.savingGuide");
    await saveGuide(data);
    form.reset();
    if (form.id) form.id.value = "";
    if (statusElement) statusElement.textContent = translate("admin.guideSaved");
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
    alert(translate("admin.errorSaveCareer") + " " + error.message);
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
    if (statusElement) statusElement.textContent = translate("admin.userSaved");
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
  const keys = { dashboard: "admin.dashboard", guides: "admin.guides", careers: "admin.careers", messages: "admin.messages", users: "admin.users", reviews: "admin.reviews" };
  return keys[view] ? translate(keys[view]) : view;
}

function renderDashboard() {
  const metricGrid = document.querySelector("#metricGrid");
  if (!metricGrid) return;

  const semesters = new Set(guides.map((guide) => guide.sem));
  const metrics = [
    [translate("admin.guides"), guides.length],
    [translate("admin.careers"), careers.length],
    [translate("stats.semesters"), semesters.size],
    [translate("admin.messages"), contactMessages.length + gmailMessages.length],
    [translate("admin.users"), users.length],
    [translate("admin.reviews"), reviews.length],
    ["Supabase", supabaseReady ? translate("admin.active") : translate("admin.local")],
  ];

  metricGrid.innerHTML = metrics
    .map(([label, value]) => `<article class="metric-card"><strong>${value}</strong><span>${label}</span></article>`)
    .join("");

  renderPopularityChart();
}

function renderPopularityChart() {
  const chartContainer = document.querySelector("#popularityChart");
  if (!chartContainer) return;

  if (!guides || !guides.length) {
    chartContainer.innerHTML = `<p class="form-note">${translate("guides.empty") || "No hay guías para mostrar."}</p>`;
    return;
  }

  // Sort guides by views descending
  const sortedGuides = [...guides].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  const maxViews = Math.max(...sortedGuides.map(g => Number(g.views) || 0), 1);

  chartContainer.innerHTML = `
    <div class="popularity-chart-list" style="display: flex; flex-direction: column; gap: 1.25rem; background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 12px; padding: 1.5rem; max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
      ${sortedGuides.map(guide => {
        const viewsCount = Number(guide.views) || 0;
        const percentage = Math.max((viewsCount / maxViews) * 100, 3);
        
        let labelTitle = guide.title;
        if (labelTitle.length > 20) {
          labelTitle = labelTitle.substring(0, 18) + "...";
        }

        return `
          <div class="popularity-row" style="display: flex; align-items: center; gap: 1.5rem; width: 100%;">
            <div class="popularity-label" style="width: 180px; font-weight: 700; font-size: 0.95rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${guide.title}">
              ${labelTitle}
            </div>
            <div class="popularity-bar-wrapper" style="flex: 1; height: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 9999px; overflow: hidden; position: relative;">
              <div class="popularity-bar-fill" style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #00d4ff, #7c3aed); border-radius: 9999px; box-shadow: 0 0 8px rgba(0, 212, 255, 0.3); transition: width 0.5s ease-in-out;"></div>
            </div>
            <div class="popularity-value" style="width: 60px; text-align: right; font-weight: 700; color: #00d4ff; font-size: 0.95rem;">
              ${viewsCount}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderActivity() {
  const activityList = document.querySelector("#activityList");
  if (!activityList) return;

  const list = activity.slice(0, 8);
  
  if (!list.length) {
    activityList.innerHTML = `<p class="form-note">${translate("admin.activityNone")}</p>`;
    return;
  }

  activityList.innerHTML = list.map((item) => {
    let icon = "⚡";
    let badgeColor = "var(--accent-2)";
    let glowColor = "rgba(124, 58, 237, 0.12)";
    const type = String(item.type || "").toLowerCase();

    if (type.includes("guia") || type.includes("guide")) {
      icon = "📖";
      badgeColor = "var(--accent-3)";
      glowColor = "rgba(16, 185, 129, 0.12)";
    } else if (type.includes("review") || type.includes("reseña") || type.includes("stars")) {
      icon = "⭐";
      badgeColor = "#fbbf24";
      glowColor = "rgba(251, 191, 36, 0.12)";
    } else if (type.includes("message") || type.includes("mensaje") || type.includes("correo")) {
      icon = "✉️";
      badgeColor = "var(--accent)";
      glowColor = "rgba(0, 212, 255, 0.12)";
    } else if (type.includes("user") || type.includes("usuario") || type.includes("profile")) {
      icon = "👤";
      badgeColor = "#fb7185";
      glowColor = "rgba(251, 113, 133, 0.12)";
    } else if (type.includes("carrera") || type.includes("career")) {
      icon = "🎓";
      badgeColor = "#f472b6";
      glowColor = "rgba(244, 114, 182, 0.12)";
    }

    const timeStr = formatRelativeTime(item.createdAt || item.created_at || item.date);

    return `
      <article class="activity-item-premium" style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.2rem; background: rgba(255, 255, 255, 0.01); border: 1px solid var(--border); border-radius: 12px; transition: all 0.2s ease; position: relative; overflow: hidden; gap: 1rem; margin-bottom: 0.5rem;">
        <div style="position: absolute; left: 0; top: 0; width: 4px; height: 100%; background: ${badgeColor}; box-shadow: 0 0 8px ${badgeColor};"></div>
        
        <div style="display: flex; align-items: center; gap: 0.9rem; flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${glowColor}; border: 1px solid color-mix(in srgb, ${badgeColor} 20%, transparent); border-radius: 50%; font-size: 1.1rem; flex-shrink: 0;">
            ${icon}
          </div>
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; font-size: 0.92rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${item.text || item.type}
            </span>
          </div>
        </div>
        
        <div style="font-size: 0.8rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; font-weight: 500;">
          ${timeStr}
        </div>
      </article>
    `;
  }).join("");
}

function renderCareerSelect() {
  const guideCareer = document.querySelector("#guideCareer");
  if (!guideCareer) return;

  const opts = [
    { key: "general", name: translate("admin.careerGeneral"), id: "general" },
    ...normalizeCareers(careers)
  ];

  guideCareer.innerHTML = opts
    .map((career) => {
      const value = career.key || career.id;
      const transKey = `career.${career.id || career.key}`;
      const label = translate(transKey) !== transKey ? translate(transKey) : career.name;
      return `<option value="${value}">${label}</option>`;
    })
    .join("");
}

async function renderGuides() {
  const guideList = document.querySelector("#guideList");
  if (!guideList) return;

  console.log('[admin] renderGuides called, guides count:', guides.length);

  const cardsHtml = await Promise.all(guides.map(async (guide) => {
    const titleTrans = await translateDynamic(guide.title);
    const descTrans = await translateDynamic(guide.desc);
    return `
      <article class="list-item">
        <header><strong>${titleTrans}</strong><span class="pill">${translate("profile.semester")} ${guide.sem}</span></header>
        <p>${descTrans}</p>
        <div class="item-actions">
          <button class="small-btn" data-edit-guide="${guide.id}" type="button">${translate("admin.edit")}</button>
          <button class="danger-btn" data-delete-guide="${guide.id}" type="button">${translate("admin.delete")}</button>
        </div>
      </article>`;
  }));

  guideList.innerHTML = cardsHtml.join("");
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
      const confirmed = await showConfirmModal(translate("admin.confirmTitle"), translate("profile.confirmDelete"));
      if (confirmed) {
        try {
          await deleteGuide(delBtn.dataset.deleteGuide);
        } catch (error) {
          alert(translate("profile.errorDelete") + " " + error.message);
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

async function renderCareers() {
  const careerList = document.querySelector("#careerList");
  if (!careerList) return;

  const cardsHtml = await Promise.all(careers.map(async (career) => {
    const transKey = `career.${career.id || career.key}`;
    const name = translate(transKey) !== transKey ? translate(transKey) : career.name;
    const descTrans = await translateDynamic(career.desc || career.description || "");
    return `
      <article class="list-item">
        <header><strong>${name}</strong><span class="pill">${career.key || career.id}</span></header>
        <p>${descTrans}</p>
        <div class="item-actions">
          <button class="small-btn" data-edit-career="${career.id}" type="button">${translate("admin.edit")}</button>
          <button class="danger-btn" data-delete-career="${career.id}" type="button">${translate("admin.delete")}</button>
        </div>
      </article>`;
  }));

  careerList.innerHTML = cardsHtml.join("");
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
      const confirmed = await showConfirmModal(translate("admin.confirmTitle"), translate("profile.confirmDelete"));
      if (confirmed) {
        try {
          await deleteCareer(delBtn.dataset.deleteCareer);
        } catch (error) {
          alert(translate("profile.errorDelete") + " " + error.message);
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
      subject: msg.subject || translate("form.message"),
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
      subject: msg.subject || translate("(Sin asunto)"),
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
        ${message.reply ? `<p class="reply-preview"><strong>${translate("admin.replyLabel")}</strong> ${message.reply}</p>` : ""}
        <div class="item-actions">
          ${message.status !== "leido" && message.status !== "respondido" ? `<button class="small-btn" data-message-read="${message.id}" type="button">${translate("admin.markRead")}</button>` : ""}
          ${!message.reply ? `<button class="small-btn" data-message-reply="${message.id}" type="button">${translate("admin.reply")}</button>` : ""}
        </div>
      </article>`
        )
        .join("")
    : `<p class="form-note">${translate("admin.noMessages")}</p>`;
}

function statusLabel(status) {
  const labels = {
    nuevo: translate("profile.new"),
    leido: translate("profile.read"),
    revisado: translate("profile.read"),
    respondido: translate("profile.replied")
  };
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
        alert(translate("profile.errorUpdate") + " " + error.message);
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
  subjectEl.textContent = message.subject || translate("form.message");
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
    alert(translate("admin.errorReply") + " " + error.message);
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
          (user) => {
            const roleBadge = user.role === "admin" ? translate("admin.userRoleAdmin") : translate("admin.userRoleUser");
            const roleActionText = user.role === "admin" ? translate("admin.removeAdmin") : translate("admin.makeAdmin");
            return `
            <article class="list-item">
              <header><strong>${user.name || user.email}</strong><span class="pill">${roleBadge}</span></header>
              <p>${user.email}</p>
              <div class="item-actions">
                <button class="small-btn" data-edit-user="${user.id}" type="button">${translate("admin.edit")}</button>
                <button class="small-btn" data-role-user="${user.id}" data-role="${user.role === "admin" ? "user" : "admin"}" type="button">
                  ${roleActionText}
                </button>
                <button class="danger-btn" data-delete-user="${user.id}" type="button">${translate("admin.delete")}</button>
              </div>
            </article>`;
          }
        )
        .join("")
    : `<p class="form-note">${translate("admin.noUsersFiltered")}</p>`;
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
      const confirmed = await showConfirmModal(translate("admin.confirmTitle"), translate("profile.confirmDelete"));
      if (confirmed) {
        try {
          await deleteUser(delBtn.dataset.deleteUser);
        } catch (error) {
          alert(translate("profile.errorDelete") + " " + error.message);
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
  if (!value) return translate("admin.now");
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return new Date(value).toLocaleString();
}

function formatRelativeTime(dateVal) {
  if (!dateVal) return "";
  const date = new Date(dateVal);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return translate("nav.home") === "Inicio" ? "Hace un momento" : "Just now";
  if (diffMins < 60) return translate("nav.home") === "Inicio" ? `Hace ${diffMins} min` : `${diffMins}m ago`;
  if (diffHours < 24) return translate("nav.home") === "Inicio" ? `Hace ${diffHours} hr` : `${diffHours}h ago`;
  if (diffDays === 1) return translate("nav.home") === "Inicio" ? "Ayer" : "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

  const filteredReviews = reviews.filter((r) => {
    const isGuide = r.comment && r.comment.startsWith("[guide:");
    return activeReviewTab === "guides" ? isGuide : !isGuide;
  });

  reviewList.innerHTML = filteredReviews.length
    ? filteredReviews
        .sort((a, b) => new Date(b.created_at || b.date || b.created_at) - new Date(a.created_at || a.date || a.created_at))
        .map(
          (review) => {
            let cleanComment = review.comment || review.message || "";
            let guideBadgeHtml = "";

            if (activeReviewTab === "guides") {
              const match = cleanComment.match(/^\[guide:(.+?)\]\s*/);
              if (match) {
                const guideId = match[1];
                cleanComment = cleanComment.replace(match[0], "");
                const guide = guides.find((g) => String(g.id) === String(guideId));
                if (guide) {
                  guideBadgeHtml = `<span class="pill" style="margin-left: 8px; font-size: 0.75rem; border: 1px solid var(--accent-border-soft); color: var(--accent); font-weight: bold; padding: 2px 8px; border-radius: 12px; display: inline-block;">📖 ${guide.title}</span>`;
                } else {
                  guideBadgeHtml = `<span class="pill" style="margin-left: 8px; font-size: 0.75rem; border: 1px solid var(--border); color: var(--muted); padding: 2px 8px; border-radius: 12px; display: inline-block;">📖 Guía #${guideId}</span>`;
                }
              }
            }

            return `
              <article class="list-item">
                <header>
                  <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <strong>${review.name || translate("profile.anonymous")}</strong>
                    ${guideBadgeHtml}
                  </div>
                  <span class="pill">${review.stars ? "★".repeat(review.stars) + "☆".repeat(5 - review.stars) : ""}</span>
                  <span class="pill">${statusLabel(review.status)}</span>
                </header>
                <p>${cleanComment}</p>
                ${review.reply ? `<p class="reply-preview"><strong>${translate("profile.adminReply")}</strong> ${review.reply}</p>` : ""}
                <div class="item-actions">
                  ${review.status !== "leido" ? `<button class="small-btn" data-review-read="${review.id}" type="button">${translate("admin.markRead")}</button>` : ""}
                  ${!review.reply ? `<button class="small-btn" data-review-reply="${review.id}" type="button">${translate("admin.reply")}</button>` : ""}
                  <button class="danger-btn" data-delete-review="${review.id}" type="button">${translate("admin.delete")}</button>
                </div>
              </article>
            `;
          }
        )
        .join("")
    : `<p class="form-note">${translate("profile.noReviews")}</p>`;
}

const reviewListEl = document.querySelector("#reviewList");
if (reviewListEl) {
  reviewListEl.addEventListener("click", async (e) => {
    const readBtn = e.target.closest("[data-review-read]");
    if (readBtn && reviewListEl.contains(readBtn)) {
      try {
        await updateReviewStatus(readBtn.dataset.reviewRead, "leido");
      } catch (error) {
        alert(translate("profile.errorUpdate") + " " + error.message);
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
      const confirmed = await showConfirmModal(translate("admin.confirmTitle"), translate("profile.confirmDelete"));
      if (confirmed) {
        try {
          await deleteReview(delBtn.dataset.deleteReview);
        } catch (error) {
          alert(translate("admin.errorDeleteReview") + " " + error.message);
        }
      }
    }
  });
}

// Selectores para el modal de respuesta a reseñas
const replyReviewModal = document.querySelector("#replyReviewModal");
const replyReviewForm = document.querySelector("#replyReviewForm");
const replyReviewIdInput = document.querySelector("#replyReviewId");
const replyReviewTextPreview = document.querySelector("#replyReviewTextPreview");
const replyReviewTextInput = document.querySelector("#replyReviewText");
const closeReplyReviewModalBtn = document.querySelector("#closeReplyReviewModal");
const cancelReplyReviewBtn = document.querySelector("#cancelReplyReview");

function replyToReviewPrompt(id) {
  const review = reviews.find((item) => String(item.id) === String(id));
  if (!review) return;

  let cleanComment = review.comment || review.message || "";
  const match = cleanComment.match(/^\[guide:(.+?)\]\s*/);
  if (match) {
    cleanComment = cleanComment.replace(match[0], "");
  }

  if (replyReviewIdInput) replyReviewIdInput.value = id;
  if (replyReviewTextPreview) replyReviewTextPreview.textContent = `"${cleanComment}"`;
  if (replyReviewTextInput) replyReviewTextInput.value = review.reply || "";

  replyReviewModal?.showModal();
}

function closeReplyModal() {
  replyReviewModal?.close();
  replyReviewForm?.reset();
}

function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.querySelector("#confirmModal");
    const titleEl = document.querySelector("#confirmModalTitle");
    const messageEl = document.querySelector("#confirmModalMessage");
    const confirmBtn = document.querySelector("#confirmModalConfirmBtn");
    const cancelBtn = document.querySelector("#confirmModalCancelBtn");
    const closeBtn = document.querySelector("#closeConfirmModal");

    if (!modal || !titleEl || !messageEl || !confirmBtn) {
      resolve(confirm(message));
      return;
    }

    titleEl.textContent = "⚠️ " + (title || translate("admin.confirmTitle") || "Confirmar Acción");
    messageEl.textContent = message;
    confirmBtn.textContent = translate("admin.deleteBtn") || "Eliminar";
    if (cancelBtn) cancelBtn.textContent = translate("admin.cancelButton") || "Cancelar";

    const cleanup = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn?.removeEventListener("click", onCancel);
      closeBtn?.removeEventListener("click", onCancel);
      modal.removeEventListener("close", onCancel);
    };

    const onConfirm = () => {
      cleanup();
      modal.close();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      modal.close();
      resolve(false);
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn?.addEventListener("click", onCancel);
    closeBtn?.addEventListener("click", onCancel);
    modal.addEventListener("close", onCancel);

    modal.showModal();
  });
}

if (closeReplyReviewModalBtn) {
  closeReplyReviewModalBtn.addEventListener("click", closeReplyModal);
}
if (cancelReplyReviewBtn) {
  cancelReplyReviewBtn.addEventListener("click", closeReplyModal);
}

if (replyReviewForm) {
  replyReviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = replyReviewIdInput.value;
    const reply = replyReviewTextInput.value.trim();
    const adminName = getLocalSession()?.name || "Admin";

    try {
      await replyToReview(id, reply, adminName);
      const updated = reviews.find((item) => String(item.id) === String(id));
      if (updated) {
        updated.reply = reply;
        updated.replied_at = new Date().toISOString();
        updated.replied_by = adminName;
        renderReviews();
      }
      closeReplyModal();
    } catch (error) {
      alert(translate("admin.errorReply") + " " + error.message);
    }
  });
}

// Escuchador de idioma en el panel administrativo
window.addEventListener("learnmore:language-change", () => {
  const activeTab = document.querySelector(".admin-tab.active");
  if (activeTab) {
    const viewTitle = document.querySelector("#viewTitle");
    if (viewTitle) viewTitle.textContent = viewLabel(activeTab.dataset.view);
  }
  renderDashboard();
  renderCareers();
  renderGuides();
  renderMessages();
  renderUsers();
  renderReviews();
  renderCareerSelect();
});
