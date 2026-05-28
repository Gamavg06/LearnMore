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

// Inicializar configuraciones de interfaz
initTheme();
initLanguage();

const status = document.querySelector("#authStatus");

// ==========================================
// REGISTRO DE USUARIOS
// ==========================================
document.querySelector("#registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  // Limpieza y validación estricta de cadenas de texto para evitar valores corruptos (Error 400)
  const email = String(data.email || "").trim();
  const password = String(data.password || "").trim();

  if (!email || !password) {
    if (status) status.textContent = "Por favor, completa todos los campos del registro.";
    return;
  }

  try {
    if (firebaseReady) {
      // Pequeña pausa de seguridad si el entorno local (Herd) responde antes que la CDN de Firebase
      if (typeof createUserWithEmailAndPassword !== "function" || createUserWithEmailAndPassword.name === "unavailable") {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Estructuramos el objeto evitando pasar campos intermedios como undefined
      await saveUser({
        id: result.user.uid,
        name: String(data.name || "").trim(),
        career: String(data.career || "").trim(),
        phone: String(data.phone || "").trim(),
        studentId: String(data.studentId || "").trim(),
        semester: String(data.semester || "").trim(),
        email: email,
        role: "user"
      });
    } else {
      saveLocalUser({ ...data, email, password, id: email, role: "user" });
    }
    
    addActivity({ type: "user", text: `Usuario registrado: ${email}` });
    if (status) status.textContent = "Cuenta creada. Ya puedes iniciar sesion.";
    form.reset();
  } catch (error) {
    console.error("Error capturado en Registro:", error);
    if (status) status.textContent = readableAuthError(error);
  }
});

// ==========================================
// INICIO DE SESIÓN (LOGIN) WITH ADMIN INTERCEPTOR
// ==========================================
document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  
  const email = String(data.email || "").trim();
  const password = String(data.password || "").trim();

  if (!email || !password) {
    if (status) status.textContent = "Ingresa un correo electronico y contrasena validos.";
    return;
  }

  // 🔥 INTERCEPTOR: Validación del Administrador por defecto antes de consultar a Firebase.
  // Esto evita el Error 400 si la cuenta de administración aún no se crea en la nube.
  const adminFallback = email === "admin@sgnia.local" && password === "admin123";

  if (adminFallback) {
    saveLocalUser({ id: email, name: "Administrador", email, password, role: "admin" });
    setLocalSession({ email, name: "Administrador", role: "admin" });
    addActivity({ type: "auth", text: `Inicio de sesion local de administrador: ${email}` });
    
    // Redirección inmediata a la vista del panel administrativo
    window.location.href = "admin.html";
    return; // Detiene la ejecución aquí para prevenir peticiones POST fallidas
  }

  // Flujo estándar para el resto de usuarios del sistema
  try {
    let role = "user";
    if (firebaseReady) {
      if (typeof signInWithEmailAndPassword !== "function" || signInWithEmailAndPassword.name === "unavailable") {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const users = localUsers();
      const found = users.find((user) => user.email === email && user.password === password);
      if (!found) throw new Error("Credenciales incorrectas.");
      role = found.role || "user";
      setLocalSession({ email, name: found?.name || "Usuario", role });
    }
    
    addActivity({ type: "auth", text: `Inicio de sesion: ${email}` });
    window.location.href = role === "admin" || email.includes("admin") ? "admin.html" : "index.html";
  } catch (error) {
    console.error("Error capturado en Login:", error);
    if (status) status.textContent = readableAuthError(error);
  }
});

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================
document.querySelector("#resetPassword")?.addEventListener("click", async () => {
  const emailInput = document.querySelector("input[name='email']");
  const email = emailInput ? emailInput.value.trim() : "";
  
  if (!email) {
    if (status) status.textContent = "Escribe tu correo para recuperar la contrasena.";
    return;
  }
  try {
    if (firebaseReady) await sendPasswordResetEmail(auth, email);
    if (status) status.textContent = firebaseReady ? "Correo de recuperacion enviado." : "Modo local: cambia la contrasena registrandote de nuevo.";
  } catch (error) {
    if (status) status.textContent = readableAuthError(error);
  }
});

// ==========================================
// MANEJO Y TRADUCCIÓN DE ERRORES DE FIREBASE
// ==========================================
function readableAuthError(error) {
  const message = error?.message || "Ocurrio un error.";
  if (message.includes("Firebase no esta configurado")) return message;
  
  // Atrapa variaciones de códigos devueltos por la API de Google Identity Toolkit
  if (
    message.includes("invalid-credential") || 
    message.includes("INVALID_LOGIN_CREDENTIALS") || 
    message.includes("INVALID_PASSWORD")
  ) {
    return "Correo o contrasena incorrectos.";
  }
  if (message.includes("email-already-in-use") || message.includes("EMAIL_EXISTS")) {
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