import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
import {
  supabase,
  supabaseReady,
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "./supabase.js";
import {
  saveUser,
  saveLocalUser,
  localUsers,
  addActivity,
  setLocalSession,
  getMatriculaInfo,
} from "./guides.js";

initTheme();
initLanguage();

const status = document.querySelector("#authStatus");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMatriculaAutofill);
} else {
  initMatriculaAutofill();
}

document.querySelector("#registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formValues = Object.fromEntries(new FormData(form));

  const email = String(formValues.email || "").trim().toLowerCase();
  const password = String(formValues.password || "").trim();
  const studentId = normalizeMatricula(formValues.studentId);
  const matriculaInfo = getMatriculaInfo(studentId);

  if (!email || !password) {
    setStatus("Por favor, completa todos los campos del registro.");
    return;
  }

  if (!matriculaInfo.isValid) {
    setStatus("La matricula debe tener el formato 23-01-010.");
    return;
  }

  const userProfile = {
    name: String(formValues.name || "").trim(),
    career: String(formValues.career || matriculaInfo.careerCode).trim(),
    phone: String(formValues.phone || "").trim(),
    studentId,
    semester: String(matriculaInfo.semester),
    email,
    role: "user",
  };

  try {
    if (supabaseReady) {
      const { data: authData, error } = await createUserWithEmailAndPassword(auth, email, password);
      if (error) throw error;
      await saveUser({ ...userProfile, id: authData.user.id });
    } else {
      saveLocalUser({ ...userProfile, id: email, password });
    }

    setLocalSession({ email, name: userProfile.name || "Usuario", role: "user" });
    addActivity({ type: "user", text: `Usuario registrado: ${email}` });
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error capturado en Registro:", error);
    setStatus(readableAuthError(error));
  }
});

document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "").trim();

  if (!email || !password) {
    setStatus("Ingresa un correo electronico y contrasena validos.");
    return;
  }

  const adminFallback = email === "admin@learnmore.local" && password === "admin123";

  if (adminFallback) {
    saveLocalUser({ id: email, name: "Administrador", email, password, role: "admin" });
    setLocalSession({ email, name: "Administrador", role: "admin" });
    addActivity({ type: "auth", text: `Inicio de sesion local de administrador: ${email}` });
    window.location.href = "Admin/admin.html";
    return;
  }

  try {
    let role = "user";

    if (supabaseReady) {
      const { data: authData, error } = await signInWithEmailAndPassword(auth, email, password);
      if (error) throw error;

      if (authData?.user) {
        const profile = await getUserProfile(authData.user.id);
        role = profile?.role || "user";
        setLocalSession({ email, name: profile?.name || "Usuario", role });
      }
    } else {
      const found = localUsers().find((user) => user.email === email && user.password === password);
      if (!found) throw new Error("Credenciales incorrectas.");
      role = found.role || "user";
      setLocalSession({ email, name: found?.name || "Usuario", role });
    }

    addActivity({ type: "auth", text: `Inicio de sesion: ${email}` });
    window.location.href = role === "admin" || email.includes("admin") ? "Admin/admin.html" : "index.html";
  } catch (error) {
    console.error("Error capturado en Login:", error);
    setStatus(readableAuthError(error));
  }
});

document.querySelector("#resetPassword")?.addEventListener("click", async () => {
  const emailInput = document.querySelector("input[name='email']");
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";

  if (!email) {
    setStatus("Escribe tu correo para recuperar la contrasena.");
    return;
  }

  try {
    if (supabaseReady) {
      const redirectTo = window.location.origin + window.location.pathname;
      await sendPasswordResetEmail(auth, email, redirectTo);
    }
    setStatus(supabaseReady ? "Correo de recuperacion enviado." : "Modo local: cambia la contrasena registrandote de nuevo.");
  } catch (error) {
    setStatus(readableAuthError(error));
  }
});

// Listener para el evento de recuperación de contraseña de Supabase
if (supabaseReady) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      console.log("Evento PASSWORD_RECOVERY detectado");
      const loginForm = document.querySelector("#loginForm");
      const resetBtn = document.querySelector("#resetPassword");
      const updateForm = document.querySelector("#updatePasswordForm");

      if (loginForm) loginForm.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      if (updateForm) updateForm.style.display = "block";

      setStatus("Ingresa tu nueva contraseña.");
    }
  });
}

// Formulario para guardar la nueva contraseña
document.querySelector("#updatePasswordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const newPassword = String(data.newPassword || "").trim();

  if (!newPassword || newPassword.length < 6) {
    setStatus("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  try {
    setStatus("Actualizando contraseña...");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    setStatus("Contraseña actualizada con éxito. Iniciando sesión...");

    // Obtener información del usuario para restaurar sesión y redirigir
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    let role = "user";
    if (user) {
      const profile = await getUserProfile(user.id);
      role = profile?.role || "user";
      setLocalSession({ email: user.email, name: profile?.name || "Usuario", role });
    }

    addActivity({ type: "auth", text: `Contraseña recuperada: ${user.email}` });

    setTimeout(() => {
      window.location.href = role === "admin" || user?.email?.includes("admin") ? "Admin/admin.html" : "index.html";
    }, 1500);
  } catch (error) {
    console.error("Error al actualizar contraseña:", error);
    setStatus(readableAuthError(error));
  }
});

async function getUserProfile(userId) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
  return data;
}

function initMatriculaAutofill() {
  const form = document.querySelector("#registerForm");
  if (!form) return;

  const studentIdField = form.querySelector('input[name="studentId"]');
  const careerField = form.querySelector('[name="career"]');
  const semesterField = form.querySelector('input[name="semester"]');

  const applyMatricula = () => {
    const info = getMatriculaInfo(studentIdField?.value);
    if (!info.isValid) {
      if (semesterField) semesterField.value = "";
      return;
    }

    if (careerField && !careerField.dataset.userChanged) careerField.value = info.careerCode;
    if (semesterField) semesterField.value = info.semester;
  };

  careerField?.addEventListener("change", () => {
    careerField.dataset.userChanged = "true";
  });

  studentIdField?.addEventListener("input", applyMatricula);
  studentIdField?.addEventListener("blur", () => {
    studentIdField.value = normalizeMatricula(studentIdField.value);
    applyMatricula();
  });
  applyMatricula();
}

function normalizeMatricula(value) {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^(\d{2})\s*-?\s*(\d{2})\s*-?\s*(\d{1,3})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2]}-${match[3].padStart(3, "0")}`;
}

function setStatus(message) {
  if (status) status.textContent = message;
}

function readableAuthError(error) {
  const message = error?.message || "Ocurrio un error.";
  if (message.includes("Supabase no esta configurado")) return message;
  if (
    message.includes("invalid-credential") ||
    message.includes("INVALID_LOGIN_CREDENTIALS") ||
    message.includes("Invalid login credentials") ||
    message.includes("invalid-password")
  ) {
    return "Correo o contrasena incorrectos.";
  }
  if (message.includes("User already registered") || message.includes("email-already-in-use")) {
    return "Ese correo ya esta registrado.";
  }
  if (message.includes("invalid-email")) {
    return "El formato del correo electronico no es valido.";
  }
  if (message.includes("missing-password")) {
    return "Falta introducir la contrasena.";
  }
  return message;
}
