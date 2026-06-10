import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
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
  delete data.photoData;
  
  const editableFields = ['name', 'career', 'semester', 'studentId'];
  const payload = { ...currentUser };
  
  editableFields.forEach(field => {
    if (data[field] !== undefined) {
      payload[field] = data[field];
    }
  });
  
  payload.id = currentUser.id || currentUser.email;
  payload.role = currentUser.role || "user";
  payload.studentId = normalizeMatricula(payload.studentId);
  const matriculaInfo = getMatriculaInfo(payload.studentId);
  if (matriculaInfo.isValid) payload.semester = String(matriculaInfo.semester);
  
  await saveUser(payload);
  currentUser = payload;
  if (!supabaseReady) setLocalSession({ email: payload.email, name: payload.name, role: payload.role });
  status.textContent = "Perfil guardado correctamente.";
});

photoInput?.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    status.textContent = "Selecciona un archivo de imagen.";
    return;
  }

  if (file.size > 1024 * 1024) {
    status.textContent = "La imagen debe pesar menos de 1 MB.";
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
  setPhotoPreview(user.photoData || "", user.name || user.email);
  document.querySelector("#profileSummary").textContent = `${user.email || ""} - ${user.role || "user"}`;
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
  if (error || !data) {
    return { id: user.id, email: user.email, name: user.email, role: "user" };
  }
  return { id: user.id, email: user.email, ...data };
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
    list.innerHTML = '<p class="form-note">No has enviado mensajes todavía.</p>';
    return;
  }
  
  list.innerHTML = userMessages.map((msg) => `
    <article class="list-item">
      <header><strong>${msg.subject || "Mensaje"}</strong><span class="pill">${msg.status || "nuevo"}</span></header>
      <p>${msg.message || ""}</p>
      ${msg.reply ? `<p class="reply-preview"><strong>Respuesta del admin:</strong> ${msg.reply}</p>` : ""}
      <p class="muted">${formatDate(msg.created_at)}</p>
    </article>
  `).join("");
}

function renderUserReviews() {
  const list = document.querySelector("#myReviewsList");
  if (!list) return;
  
  if (!userReviews.length) {
    list.innerHTML = '<p class="form-note">No has escrito reseñas todavía.</p>';
    return;
  }
  
  list.innerHTML = userReviews.map((r) => `
    <article class="list-item">
      <header>
        <strong>${r.name || "Anónimo"}</strong>
        <span class="pill">${r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : ""}</span>
        <span class="pill">${r.status || "nuevo"}</span>
      </header>
      <p>${r.comment || ""}</p>
      ${r.reply ? `<p class="reply-preview"><strong>Respuesta del admin:</strong> ${r.reply}</p>` : ""}
      <p class="muted">${formatDate(r.created_at || r.date)}</p>
    </article>
  `).join("");
}

function formatDate(value) {
  if (!value) return "Ahora";
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString();
  return new Date(value).toLocaleDateString();
}