import { initTheme } from "./theme.js";
import { initLanguage, translate } from "./language.js";
import {
  supabaseReady,
  supabase,
  onAuthStateChanged,
  signOut,
} from "./supabase.js";
import {
  saveUser,
  deleteUser,
  getLocalCurrentUser,
  setLocalSession,
  clearLocalSession,
  getCareerCodeFromName,
  getMatriculaInfo,
  subscribeMessages,
  subscribeReviews,
  saveMessage,
  deleteMessage,
  saveReview,
  deleteReview,
  subscribeGuides,
} from "./guides.js";

initTheme();
initLanguage();

const form = document.querySelector("#profileForm");
const status = document.querySelector("#profileStatus");
const photoInput = document.querySelector("#profilePhotoInput");
const photoPreview = document.querySelector("#profilePhotoPreview");
const photoInitials = document.querySelector("#profilePhotoInitials");
const photoData = document.querySelector("#profilePhotoData");
let currentUser = null;
let careerChangedManually = false;
let userMessages = [];
let userReviews = [];
let guides = [];
let activeReviewTab = "platform";

subscribeGuides((items) => {
  guides = items;
  renderUserReviews();
});

// Event listener for profile reviews tabs
document.querySelectorAll(".reviews-tabs .review-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".reviews-tabs .review-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeReviewTab = btn.dataset.tab;
    renderUserReviews();
  });
});

if (supabaseReady) {
  onAuthStateChanged((event, session) => {
    if (!session?.user) {
      window.location.href = "login.html";
      return;
    }
    loadSupabaseProfile(session.user).then((user) => {
      currentUser = user;
      fillProfile(currentUser);
      subscribeToUserMessages(currentUser.email);
      subscribeToUserReviews(currentUser.email);
    });
  });
} else {
  currentUser = getLocalCurrentUser();
  if (!currentUser) {
    window.location.href = "login.html";
  } else {
    fillProfile(currentUser);
    loadLocalMessages();
    loadLocalReviews();
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  delete data.photoFile;
  
  const editableFields = ['name', 'career', 'semester', 'studentId', 'phone', 'bio', 'photoData'];
  const payload = { ...currentUser };
  
  editableFields.forEach(field => {
    if (data[field] !== undefined) {
      if (field === 'photoData' && !data[field] && currentUser?.photoData) {
        payload[field] = currentUser.photoData;
      } else {
        payload[field] = data[field];
      }
    }
  });
  
  payload.id = currentUser.id || currentUser.email;
  payload.role = currentUser.role || "user";
  payload.studentId = normalizeMatricula(payload.studentId);
  const matriculaInfo = getMatriculaInfo(payload.studentId);
  if (matriculaInfo.isValid) payload.semester = String(matriculaInfo.semester);
  
  // Guardar de forma persistente local los campos que no van a la BD
  localStorage.setItem(`learnmore.profile.${payload.email}`, JSON.stringify({
    bio: payload.bio || "",
    phone: payload.phone || "",
    photoData: payload.photoData || ""
  }));
  
  await saveUser(payload);
  currentUser = payload;
  if (!supabaseReady) setLocalSession({ email: payload.email, name: payload.name, role: payload.role });
  
  // Actualizar UI lateral
  const sidebarName = document.querySelector("#sidebarProfileName");
  if (sidebarName) sidebarName.textContent = payload.name || payload.email;
  
  status.textContent = translate("nav.home") === "Inicio" ? "Perfil guardado correctamente." : "Profile saved successfully.";
});

photoInput?.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    status.textContent = translate("profile.photoTypeError");
    return;
  }

  if (file.size > 1024 * 1024) {
    status.textContent = translate("profile.photoSizeError");
    return;
  }

  const imageData = await fileToDataUrl(file);
  photoData.value = imageData;
  setPhotoPreview(imageData, form.name.value || currentUser?.name || currentUser?.email);
});

document.querySelector("#logoutProfileBtn")?.addEventListener("click", async () => {
  if (supabaseReady) await signOut();
  clearLocalSession();
  window.location.href = "login.html";
});

document.querySelector("#deleteAccountBtn")?.addEventListener("click", async () => {
  const confirmed = confirm("Esta accion borrara tu perfil y cerrara tu sesion. Deseas continuar?");
  if (!confirmed) return;

  if (currentUser?.id) await deleteUser(currentUser.id);
  if (currentUser?.email && currentUser.id !== currentUser.email) await deleteUser(currentUser.email);

  clearLocalSession();
  window.location.href = "login.html";
});

function fillProfile(user) {
  form.name.value = user.name || "";
  form.email.value = user.email || "";
  form.phone.value = user.phone || "";
  form.career.value = getCareerCodeFromName(user.career) || user.career || "";
  form.semester.value = user.semester || "";
  form.studentId.value = user.studentId || "";
  form.bio.value = user.bio || "";
  photoData.value = user.photoData || "";
  setPhotoPreview(user.photoData || "", user.name || user.email);
  
  const sidebarName = document.querySelector("#sidebarProfileName");
  if (sidebarName) sidebarName.textContent = user.name || user.email;

  const profileSummary = document.querySelector("#profileSummary");
  if (profileSummary) profileSummary.textContent = `${user.email || ""} - ${user.role || "user"}`;
}

form?.career?.addEventListener("change", () => {
  careerChangedManually = true;
});

form?.studentId?.addEventListener("input", () => {
  const info = getMatriculaInfo(normalizeMatricula(form.studentId.value));
  if (!info.isValid) {
    form.semester.value = "";
    return;
  }
  form.semester.value = info.semester;
  if (!careerChangedManually) form.career.value = info.careerCode;
});

form?.studentId?.addEventListener("blur", () => {
  form.studentId.value = normalizeMatricula(form.studentId.value);
});

function normalizeMatricula(value) {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^(\d{2})\s*-?\s*(\d{2})\s*-?\s*(\d{1,3})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2]}-${match[3].padStart(3, "0")}`;
}

function setPhotoPreview(imageData, name) {
  const initials = getInitials(name);
  photoInitials.textContent = initials;

  if (imageData) {
    photoPreview.src = imageData;
    photoPreview.parentElement.classList.add("has-photo");
  } else {
    photoPreview.removeAttribute("src");
    photoPreview.parentElement.classList.remove("has-photo");
  }
}

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SG";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadSupabaseProfile(user) {
  const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single();
  let localFields = {};
  try {
    localFields = JSON.parse(localStorage.getItem(`learnmore.profile.${user.email}`)) || {};
  } catch (e) {
    console.warn("Error loading local fields:", e);
  }
  if (error || !data) {
    return { id: user.id, email: user.email, name: user.email, role: "user", ...localFields };
  }
  const merged = { id: user.id, email: user.email, ...data };
  for (const key in localFields) {
    if (localFields[key] && !merged[key]) {
      merged[key] = localFields[key];
    }
  }
  return merged;
}

function subscribeToUserMessages(email) {
  if (!supabaseReady) {
    loadLocalMessages();
    return;
  }
  
  supabase
    .from("messages")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .then(({ data }) => {
      userMessages = data || [];
      renderUserMessages();
    });
}

function subscribeToUserReviews(email) {
  if (!supabaseReady) {
    loadLocalReviews();
    return;
  }
  
  supabase
    .from("reviews")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .then(({ data }) => {
      userReviews = data || [];
      renderUserReviews();
    });
}

function loadLocalMessages() {
  const all = JSON.parse(localStorage.getItem("learnmore.messages") || "[]");
  userMessages = all.filter((msg) => msg.email === currentUser?.email);
  renderUserMessages();
}

function loadLocalReviews() {
  const all = JSON.parse(localStorage.getItem("learnmore.reviews") || "[]");
  userReviews = all.filter((r) => r.email === currentUser?.email);
  renderUserReviews();
}

function renderUserMessages() {
  const list = document.querySelector("#myCommentsList");
  if (!list) return;
  
  if (!userMessages.length) {
    list.innerHTML = `<p class="form-note">${translate("profile.noMessages")}</p>`;
    return;
  }
  
  list.innerHTML = userMessages.map((msg) => `
    <article class="list-item" data-id="${msg.id}">
      <header>
        <strong>${msg.subject || translate("profile.myMessages")}</strong>
        <span class="pill">${statusLabel(msg.status)}</span>
      </header>
      <p>${msg.message || ""}</p>
      ${msg.reply ? `<p class="reply-preview"><strong>${translate("profile.adminReply")}</strong> ${msg.reply}</p>` : ""}
      <div class="item-actions" style="margin-top: 0.6rem; display: flex; gap: 0.5rem;">
        <button class="small-btn" data-edit-message="${msg.id}" type="button">${translate("profile.edit")}</button>
        <button class="danger-btn" data-delete-message="${msg.id}" type="button">${translate("profile.delete")}</button>
      </div>
      <p class="muted" style="margin-top: 0.4rem; font-size: 0.8rem;">${formatDate(msg.created_at)}</p>
    </article>
  `).join("");
}

function renderUserReviews() {
  const list = document.querySelector("#myReviewsList");
  if (!list) return;
  
  const filteredReviews = userReviews.filter((r) => {
    const isGuide = r.comment && r.comment.startsWith("[guide:");
    return activeReviewTab === "guides" ? isGuide : !isGuide;
  });

  if (!filteredReviews.length) {
    list.innerHTML = `<p class="form-note">${translate("profile.noReviews")}</p>`;
    return;
  }
  
  list.innerHTML = filteredReviews.map((r) => {
    let cleanComment = r.comment || "";
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
      <article class="list-item" data-id="${r.id}">
        <header>
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
            <strong>${r.name || translate("profile.anonymous")}</strong>
            ${guideBadgeHtml}
          </div>
          <span class="pill">${r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : ""}</span>
          <span class="pill">${statusLabel(r.status)}</span>
        </header>
        <p>${cleanComment}</p>
        ${r.reply ? `<p class="reply-preview"><strong>${translate("profile.adminReply")}</strong> ${r.reply}</p>` : ""}
        <div class="item-actions" style="margin-top: 0.6rem; display: flex; gap: 0.5rem;">
          <button class="small-btn" data-edit-review="${r.id}" type="button">${translate("profile.edit")}</button>
          <button class="danger-btn" data-delete-review="${r.id}" type="button">${translate("profile.delete")}</button>
        </div>
        <p class="muted" style="margin-top: 0.4rem; font-size: 0.8rem;">${formatDate(r.created_at || r.date)}</p>
      </article>
    `;
  }).join("");
}

function statusLabel(status) {
  const labels = {
    nuevo: translate("profile.new") || "Nuevo",
    leido: translate("profile.read") || "Leído",
    revisado: translate("profile.read") || "Leído",
    respondido: translate("profile.replied") || "Respondido"
  };
  return labels[status] || status;
}

const commentsListEl = document.querySelector("#myCommentsList");
if (commentsListEl) {
  commentsListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-message]");
    if (editBtn && commentsListEl.contains(editBtn)) {
      const msgId = editBtn.dataset.editMessage;
      const msg = userMessages.find((m) => String(m.id) === String(msgId));
      if (!msg) return;

      if (editCommentIdInput) editCommentIdInput.value = msgId;
      if (editCommentSubjectInput) editCommentSubjectInput.value = msg.subject || "";
      if (editCommentTextInput) editCommentTextInput.value = msg.message || "";

      editCommentModal?.showModal();
      return;
    }

    const delBtn = e.target.closest("[data-delete-message]");
    if (delBtn && commentsListEl.contains(delBtn)) {
      const msgId = delBtn.dataset.deleteMessage;
      if (confirm(translate("profile.confirmDelete"))) {
        try {
          await deleteMessage(msgId);
          if (supabaseReady) {
            subscribeToUserMessages(currentUser.email);
          } else {
            loadLocalMessages();
          }
        } catch (err) {
          alert(translate("profile.errorDelete") + " " + err.message);
        }
      }
    }
  });
}

const reviewsListEl = document.querySelector("#myReviewsList");
if (reviewsListEl) {
  reviewsListEl.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit-review]");
    if (editBtn && reviewsListEl.contains(editBtn)) {
      const rId = editBtn.dataset.editReview;
      const review = userReviews.find((r) => String(r.id) === String(rId));
      if (!review) return;

      if (editReviewIdInput) editReviewIdInput.value = rId;
      let cleanComment = review.comment || "";
      const match = cleanComment.match(/^\[guide:(.+?)\]\s*/);
      if (match) {
        cleanComment = cleanComment.replace(match[0], '');
      }
      if (editReviewCommentInput) editReviewCommentInput.value = cleanComment;
      updateEditReviewStars(review.stars || 5);

      editReviewModal?.showModal();
      return;
    }

    const delBtn = e.target.closest("[data-delete-review]");
    if (delBtn && reviewsListEl.contains(delBtn)) {
      const rId = delBtn.dataset.deleteReview;
      if (confirm(translate("profile.confirmDelete"))) {
        try {
          await deleteReview(rId);
          if (supabaseReady) {
            subscribeToUserReviews(currentUser.email);
          } else {
            loadLocalReviews();
          }
        } catch (err) {
          alert(translate("profile.errorDelete") + " " + err.message);
        }
      }
    }
  });
}

document.querySelector("#menuToggle")?.addEventListener("click", () => {
  document.querySelector("#navLinks")?.classList.toggle("open");
});

window.addEventListener("learnmore:language-change", () => {
  if (currentUser) {
    fillProfile(currentUser);
    renderUserMessages();
    renderUserReviews();
  }
});

function formatDate(value) {
  if (!value) return "Ahora";
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString();
  return new Date(value).toLocaleDateString();
}

// Premium Modal Lógica para Edición de Reseñas
let currentEditStars = 5;
const editReviewModal = document.querySelector("#editReviewModal");
const editReviewForm = document.querySelector("#editReviewForm");
const editReviewIdInput = document.querySelector("#editReviewId");
const editReviewCommentInput = document.querySelector("#editReviewComment");
const editReviewStarsContainer = document.querySelector("#editReviewStars");
const closeEditReviewModalBtn = document.querySelector("#closeEditReviewModal");
const cancelEditReviewBtn = document.querySelector("#cancelEditReview");

window.updateEditReviewStars = function(stars) {
  currentEditStars = stars;
  const editStarBtns = Array.from(document.querySelectorAll(".edit-star"));
  editStarBtns.forEach((btn) => {
    const val = parseInt(btn.dataset.val);
    const active = val <= stars;
    btn.textContent = active ? "★" : "☆";
    btn.classList.toggle("active", active);
  });
}

if (editReviewStarsContainer) {
  const editStarBtns = Array.from(editReviewStarsContainer.querySelectorAll(".edit-star"));
  editStarBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const stars = parseInt(btn.dataset.val);
      window.updateEditReviewStars(stars);
    });
  });
}

function closeEditModal() {
  editReviewModal?.close();
  editReviewForm?.reset();
}

closeEditReviewModalBtn?.addEventListener("click", closeEditModal);
cancelEditReviewBtn?.addEventListener("click", closeEditModal);

editReviewForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rId = editReviewIdInput.value;
  const review = userReviews.find((r) => String(r.id) === String(rId));
  if (!review) return;

  const commentText = editReviewCommentInput.value.trim();
  let finalComment = commentText;
  const match = review.comment ? review.comment.match(/^\[guide:(.+?)\]\s*/) : null;
  if (match) {
    finalComment = `${match[0]}${commentText}`;
  }

  try {
    await saveReview({ ...review, stars: currentEditStars, comment: finalComment });
    closeEditModal();
    if (supabaseReady) {
      subscribeToUserReviews(currentUser.email);
    } else {
      loadLocalReviews();
    }
  } catch (err) {
    alert(translate("profile.errorUpdate") + " " + err.message);
  }
});

// Premium Modal Lógica para Edición de Comentarios
const editCommentModal = document.querySelector("#editCommentModal");
const editCommentForm = document.querySelector("#editCommentForm");
const editCommentIdInput = document.querySelector("#editCommentId");
const editCommentSubjectInput = document.querySelector("#editCommentSubject");
const editCommentTextInput = document.querySelector("#editCommentText");
const closeEditCommentModalBtn = document.querySelector("#closeEditCommentModal");
const cancelEditCommentBtn = document.querySelector("#cancelEditComment");

function closeEditCommentModal() {
  editCommentModal?.close();
  editCommentForm?.reset();
}

closeEditCommentModalBtn?.addEventListener("click", closeEditCommentModal);
cancelEditCommentBtn?.addEventListener("click", closeEditCommentModal);

editCommentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgId = editCommentIdInput.value;
  const msg = userMessages.find((m) => String(m.id) === String(msgId));
  if (!msg) return;

  const subject = editCommentSubjectInput.value.trim();
  const message = editCommentTextInput.value.trim();

  try {
    await saveMessage({ ...msg, subject, message });
    closeEditCommentModal();
    if (supabaseReady) {
      subscribeToUserMessages(currentUser.email);
    } else {
      loadLocalMessages();
    }
  } catch (err) {
    alert(translate("profile.errorUpdate") + " " + err.message);
  }
});