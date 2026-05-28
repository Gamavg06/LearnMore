import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
import {
  firebaseReady,
  auth,
  db,
  doc,
  getDoc,
  deleteAuthUser,
  onAuthStateChanged,
  signOut,
} from "./firebase.js";
import {
  saveUser,
  deleteUser,
  getLocalCurrentUser,
  setLocalSession,
  clearLocalSession,
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

if (firebaseReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = await loadFirebaseProfile(user);
    fillProfile(currentUser);
  });
} else {
  currentUser = getLocalCurrentUser();
  if (!currentUser) {
    window.location.href = "login.html";
  } else {
    fillProfile(currentUser);
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  delete data.photoFile;
  const payload = {
    ...currentUser,
    ...data,
    id: currentUser.id || currentUser.email,
    role: currentUser.role || "user",
  };

  await saveUser(payload);
  currentUser = payload;
  if (!firebaseReady) setLocalSession({ email: payload.email, name: payload.name, role: payload.role });
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
  if (firebaseReady) await signOut(auth);
  clearLocalSession();
  window.location.href = "login.html";
});

document.querySelector("#deleteAccountBtn")?.addEventListener("click", async () => {
  const confirmed = confirm("Esta accion borrara tu perfil y cerrara tu sesion. Deseas continuar?");
  if (!confirmed) return;

  if (currentUser?.id) await deleteUser(currentUser.id);
  if (currentUser?.email && currentUser.id !== currentUser.email) await deleteUser(currentUser.email);
  if (firebaseReady && auth.currentUser) await deleteAuthUser(auth.currentUser);

  clearLocalSession();
  window.location.href = "login.html";
});

function fillProfile(user) {
  form.name.value = user.name || "";
  form.email.value = user.email || "";
  form.phone.value = user.phone || "";
  form.career.value = user.career || "";
  form.semester.value = user.semester || "";
  form.studentId.value = user.studentId || "";
  form.bio.value = user.bio || "";
  photoData.value = user.photoData || "";
  setPhotoPreview(user.photoData || "", user.name || user.email);
  document.querySelector("#profileSummary").textContent = `${user.email || ""} - ${user.role || "user"}`;
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

async function loadFirebaseProfile(user) {
  const byUid = await getDoc(doc(db, "users", user.uid));
  if (byUid.exists()) return { id: user.uid, email: user.email, ...byUid.data() };

  const byEmail = await getDoc(doc(db, "users", user.email));
  if (byEmail.exists()) return { id: user.email, email: user.email, ...byEmail.data() };

  return { id: user.uid, email: user.email, name: user.email, role: "user" };
}
