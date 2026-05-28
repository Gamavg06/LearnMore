const LANG_KEY = "sgnia.lang";

const dictionary = {
  es: {
    "nav.home": "Inicio",
    "nav.guides": "Guias",
    "nav.careers": "Carreras",
    "nav.contact": "Contacto",
    "nav.login": "Entrar",
    "nav.admin": "Admin",
    "nav.profile": "Perfil",
    "hero.badge": "Sistema de Guias de Aprendizaje",
    "hero.title": "Aprende mas rapido. Estudia con proposito.",
    "hero.copy": "LEARNMORE centraliza guias, temarios y recursos academicos para que estudiantes y docentes encuentren material actualizado por carrera y semestre.",
    "hero.primary": "Explorar guias",
    "hero.secondary": "Crear cuenta",
    "stats.guides": "Guias",
    "stats.careers": "Carreras",
    "stats.semesters": "Semestres",
    "careers.badge": "Programas academicos",
    "careers.title": "Carreras disponibles",
    "careers.copy": "Filtra el contenido por area academica y encuentra guias organizadas por semestre.",
    "guides.badge": "Material de estudio",
    "guides.title": "Guias academicas",
    "guides.copy": "Contenido dinamico listo para conectarse con Cloud Firestore y Firebase Storage.",
    "guides.empty": "No hay guias con esos filtros.",
    "filters.all": "Todas",
    "filters.semester": "Todos los semestres",
    "contact.badge": "Soporte academico",
    "contact.title": "Contactanos",
    "contact.copy": "Envia dudas, reportes o propuestas de material. El panel administrativo mostrara estos mensajes.",
    "contact.asideTitle": "Estamos para ayudarte",
    "contact.asideCopy": "Incluye tu carrera y semestre para que el equipo pueda responder con mas precision.",
    "form.name": "Nombre",
    "form.email": "Correo",
    "form.career": "Carrera",
    "form.subject": "Asunto",
    "form.message": "Mensaje",
    "form.send": "Enviar mensaje",
    "footer.copy": "Sistema de Guias de Aprendizaje. Plataforma academica administrable.",
    "auth.loginBadge": "Acceso seguro",
    "auth.loginTitle": "Iniciar sesion",
    "auth.password": "Contrasena",
    "auth.loginButton": "Entrar",
    "auth.reset": "Recuperar contrasena",
    "auth.noAccount": "No tienes cuenta?",
    "auth.registerLink": "Registrate",
    "auth.registerBadge": "Nueva cuenta",
    "auth.registerTitle": "Crear cuenta",
    "auth.registerButton": "Registrarme",
    "auth.hasAccount": "Ya tienes cuenta?",
    "auth.loginLink": "Inicia sesion",
    "auth.backHome": "Volver al inicio",
    "profile.badge": "Cuenta",
    "profile.title": "Mi perfil",
    "profile.phone": "Telefono",
    "profile.semester": "Semestre",
    "profile.studentId": "Matricula",
    "profile.bio": "Informacion personal",
    "profile.photo": "Cambiar foto",
    "profile.save": "Guardar perfil",
    "profile.logout": "Cerrar sesion",
    "profile.delete": "Borrar cuenta",
  },
  en: {
    "nav.home": "Home",
    "nav.guides": "Guides",
    "nav.careers": "Careers",
    "nav.contact": "Contact",
    "nav.login": "Sign in",
    "nav.admin": "Admin",
    "nav.profile": "Profile",
    "hero.badge": "Learning Guides System",
    "hero.title": "Learn faster. Study with purpose.",
    "hero.copy": "LEARNMORE centralizes guides, syllabi and academic resources so students and teachers can find updated material by career and semester.",
    "hero.primary": "Explore guides",
    "hero.secondary": "Create account",
    "stats.guides": "Guides",
    "stats.careers": "Careers",
    "stats.semesters": "Semesters",
    "careers.badge": "Academic programs",
    "careers.title": "Available careers",
    "careers.copy": "Filter content by academic area and find guides organized by semester.",
    "guides.badge": "Study material",
    "guides.title": "Academic guides",
    "guides.copy": "Dynamic content ready to connect with Cloud Firestore and Firebase Storage.",
    "guides.empty": "No guides match those filters.",
    "filters.all": "All",
    "filters.semester": "All semesters",
    "contact.badge": "Academic support",
    "contact.title": "Contact us",
    "contact.copy": "Send questions, reports or material proposals. The admin panel will show these messages.",
    "contact.asideTitle": "We are here to help",
    "contact.asideCopy": "Include your career and semester so the team can answer more precisely.",
    "form.name": "Name",
    "form.email": "Email",
    "form.career": "Career",
    "form.subject": "Subject",
    "form.message": "Message",
    "form.send": "Send message",
    "footer.copy": "Learning Guides System. Manageable academic platform.",
    "auth.loginBadge": "Secure access",
    "auth.loginTitle": "Sign in",
    "auth.password": "Password",
    "auth.loginButton": "Sign in",
    "auth.reset": "Reset password",
    "auth.noAccount": "No account?",
    "auth.registerLink": "Register",
    "auth.registerBadge": "New account",
    "auth.registerTitle": "Create account",
    "auth.registerButton": "Register",
    "auth.hasAccount": "Already have an account?",
    "auth.loginLink": "Sign in",
    "auth.backHome": "Back home",
    "profile.badge": "Account",
    "profile.title": "My profile",
    "profile.phone": "Phone",
    "profile.semester": "Semester",
    "profile.studentId": "Student ID",
    "profile.bio": "Personal information",
    "profile.photo": "Change photo",
    "profile.save": "Save profile",
    "profile.logout": "Sign out",
    "profile.delete": "Delete account",
  },
};

export function getLanguage() {
  return localStorage.getItem(LANG_KEY) || "es";
}

export function applyLanguage(lang = getLanguage()) {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (dictionary[lang][key]) node.textContent = dictionary[lang][key];
  });
  document.querySelectorAll("#languageToggle").forEach((button) => {
    button.textContent = lang.toUpperCase();
  });
}

export function initLanguage() {
  applyLanguage();
  document.querySelectorAll("#languageToggle").forEach((button) => {
    button.addEventListener("click", () => {
      const next = getLanguage() === "es" ? "en" : "es";
      localStorage.setItem(LANG_KEY, next);
      applyLanguage(next);
    });
  });
}
