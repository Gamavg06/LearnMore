import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
import {
  firebaseReady,
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "./firebase.js";
import { saveUser, saveLocalUser, localUsers, addActivity, setLocalSession } from "./guides.js";

initTheme();
initLanguage();

const status = document.querySelector("#authStatus");

document.querySelector("#registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    if (firebaseReady) {
      const result = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await saveUser({ ...data, id: result.user.uid, role: "user" });
    } else {
      saveLocalUser({ ...data, id: data.email, role: "user" });
    }
    addActivity({ type: "user", text: `Usuario registrado: ${data.email}` });
    status.textContent = "Cuenta creada. Ya puedes iniciar sesion.";
    form.reset();
  } catch (error) {
    status.textContent = readableAuthError(error);
  }
});

document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    let role = "user";
    if (firebaseReady) {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } else {
      const users = localUsers();
      const found = users.find((user) => user.email === data.email && user.password === data.password);
      const adminFallback = data.email === "admin@sgnia.local" && data.password === "admin123";
      if (!found && !adminFallback) throw new Error("Credenciales incorrectas.");
      role = adminFallback ? "admin" : found.role || "user";
      if (adminFallback) {
        saveLocalUser({ id: data.email, name: "Administrador", email: data.email, password: data.password, role: "admin" });
      }
      setLocalSession({ email: data.email, name: found?.name || "Administrador", role });
    }
    addActivity({ type: "auth", text: `Inicio de sesion: ${data.email}` });
    window.location.href = role === "admin" || data.email.includes("admin") ? "admin.html" : "index.html";
  } catch (error) {
    status.textContent = readableAuthError(error);
  }
});

document.querySelector("#resetPassword")?.addEventListener("click", async () => {
  const email = document.querySelector("input[name='email']")?.value.trim();
  if (!email) {
    status.textContent = "Escribe tu correo para recuperar la contrasena.";
    return;
  }
  try {
    if (firebaseReady) await sendPasswordResetEmail(auth, email);
    status.textContent = firebaseReady ? "Correo de recuperacion enviado." : "Modo local: cambia la contrasena registrandote de nuevo.";
  } catch (error) {
    status.textContent = readableAuthError(error);
  }
});

function readableAuthError(error) {
  const message = error?.message || "Ocurrio un error.";
  if (message.includes("Firebase no esta configurado")) return message;
  if (message.includes("invalid-credential")) return "Correo o contrasena incorrectos.";
  if (message.includes("email-already-in-use")) return "Ese correo ya esta registrado.";
  return message;
}
