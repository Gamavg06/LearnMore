# LEARNMORE - Sistema de Guias de Aprendizaje

LEARNMORE es una plataforma web academica para gestionar guias de aprendizaje, carreras, semestres, usuarios y mensajes de contacto.

## Estructura

```text
Sistema de Guia/
  index.html           # Sitio publico principal
  login.html           # Pagina de inicio de sesion
  register.html        # Pagina de registro de usuarios
  admin.html           # Panel administrativo
  profile.html         # Perfil de usuario
  css/
    style.css          # Estilos principales (publico)
    admin.css          # Estilos del panel administrativo
    auth.css           # Estilos de autenticacion
    profile.css        # Estilos del perfil
    responsive.css     # Estilos responsive
  js/
    main.js            # Logica del sitio publico
    firebase.js        # (No usado en el flujo Supabase; se conserva para modo local/legacy)
    auth.js            # Registro, login y recuperacion
    admin.js           # Panel administrativo completo
    guides.js          # Operaciones de datos (CRUD)
    profile.js         # Gestion del perfil de usuario
    theme.js           # Toggle modo claro/oscuro
    language.js        # Internacionalizacion ES/EN
    migrar.js          # Migracion automatica de datos
    resenas.js         # Sistema de reseñas y calificaciones

  assets/
    images/            # Imagenes del proyecto
    icons/             # Iconos
    pdfs/              # Recursos PDF
```

## Funciones implementadas

### Sitio publico (Supabase)
- Guias dinamicas con filtros por carrera y semestre
- Estadisticas visibles (conteo de guias, carreras, semestres)
- Formulario de contacto
- Navegacion responsive con menu movil
- Boton de acceso al admin (solo para administradores)

### Panel administrativo (Supabase)
- **Dashboard**: Metricas en tiempo real y actividad reciente
- **Guias**: CRUD completo (titulo, descripcion, detalle, carrera, semestre, temas, PDF)
- **Carreras**: CRUD con clave, nombre, descripcion y color identitario
- **Mensajes**: Lista de mensajes de contacto desde la tabla `messages` (marcado como revisado con `status`)
- **Usuarios**: Busqueda, filtro por rol, edicion y eliminacion
- **Tema**: Toggle modo claro/oscuro sincronizado
- **Idioma**: Cambio entre Español/Inglés sin recarga

### Autenticacion (Supabase + modo local)
- Registro con nombre, carrera, telefono, matricula y semestre
- Inicio de sesion con validacion de credenciales
- Recuperacion de contrasena
- Cierre de sesion
- Interceptor de administrador local (admin@learnmore.local)

### Email de contacto (Gmail con App Password)
- Se utiliza una Cloud Function para enviar correos al admin con **App Password (SMTP)**
- Los mensajes del formulario se guardan en Supabase (tabla `messages`) para que el admin los vea en el panel

### Perfil de usuario
- Edicion de informacion personal
- Cambio de foto de perfil desde dispositivo
- Cierre de sesion
- Borrado de cuenta/perfil

### Reseñas
- Sistema de calificacion con estrellas (1-5)
- Formulario para enviar opiniones
- Almacenamiento local en `localStorage`
- Vista de reseñas publicadas con avatar


## Archivos JavaScript

| Archivo | Funcion |
|---------|---------|
| `main.js` | Logica del sitio publico, renderizado de guias y carreras |
| `firebase.js` | Configuracion de Firebase, funciones de auth/firestore/storage |
| `auth.js` | Registro, login, recuperacion de contrasena |
| `admin.js` | Panel administrativo: dashboard, CRUD guias/carreras/mensajes/usuarios |
| `guides.js` | Operaciones de datos: subscribe, save, delete, local storage fallback |
| `profile.js` | Edicion de perfil, foto, logout, borrado de cuenta |
| `theme.js` | Persistencia de tema claro/oscuro en localStorage |
| `language.js` | Sistema i18n con diccionario ES/EN |
| `migrar.js` | Migracion automatica de datos de localStorage a Firebase |
| `resenas.js` | Sistema de reseñas: calificacion, envio, renderizado |

## Internacionalizacion (Idioma)

Soporte completo para dual idioma ES/EN:

**Archivos clave:**
- `js/language.js` - Sistema de traduccion con diccionario
- Atributo `data-i18n="clave"` en elementos HTML

**Claves disponibles:**
- `nav.*`: Navegacion (home, guides, careers, contact, login, admin, profile, reviews)
- `reviews.*`: Reseñas (badge, title, copy, formTitle, namePlaceholder, rating, etc.)
- `hero.*`: Hero section (badge, title, copy, primary, secondary)
- `stats.*`: Estadisticas (guides, careers, semesters)
- `careers.*`: Carreras (badge, title, copy)
- `guides.*`: Guias (badge, title, copy, empty)
- `contact.*`: Contacto (badge, title, copy, asideTitle, asideCopy)
- `form.*`: Formularios (name, email, career, subject, message, send)
- `auth.*`: Autenticacion (loginBadge, loginTitle, password, etc.)
- `profile.*`: Perfil (badge, title, phone, semester, studentId, bio, etc.)

**Uso:**
```js
import { initLanguage } from "./language.js";
initLanguage(); // Inicializa el sistema
```

## Tema (Modo claro/oscuro)

Sistema de tema persistente usando CSS custom properties:

**Archivos clave:**
- `js/theme.js` - Persistencia en localStorage
- `css/style.css` - Variables CSS en `:root` y `[data-theme="light"]`

**Variables principales:**
```css
--bg, --bg-2, --surface, --surface-strong, --border, --text, --muted
--accent, --accent-2, --accent-3, --danger
--accent-border, --accent-border-soft, --danger-border, --danger-surface
--shadow
```

**Uso:**
```js
import { initTheme } from "./theme.js";
initTheme(); // Configura toggle automatico
```

## Paleta de colores

```css
:root {
  --bg: #090d18;
  --bg-2: #101827;
  --surface: rgba(255, 255, 255, 0.055);
  --surface-strong: rgba(255, 255, 255, 0.09);
  --border: rgba(255, 255, 255, 0.11);
  --text: #f4f7fb;
  --muted: #9aa7bd;
  --accent: #00d4ff;
  --accent-2: #7c3aed;
  --accent-3: #10b981;
  --danger: #fb7185;
  --accent-border: rgba(0, 212, 255, 0.45);
  --shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
}

[data-theme="light"] {
  --bg: #f6f8fc;
  --bg-2: #eaf0f8;
  --surface: rgba(255, 255, 255, 0.82);
  --surface-strong: #ffffff;
  --border: rgba(16, 24, 40, 0.12);
  --text: #111827;
  --muted: #5f6c80;
  --shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
}
```

## Modo local

El sistema funciona sin configurar Firebase usando `localStorage`. Credenciales de prueba:

```text
Correo: admin@learnmore.local
Contrasena: admin123
```

## Configuración Supabase

- Crea (o migra) la base de datos en Supabase.
- Asegúrate de que existan las tablas que usa el proyecto (no se crean automáticamente).

Tablas requeridas:
- `guides`
- `careers`
- `messages` (mensajes de contacto)
- `users`
- `activity`

## Nota importante
Para que el sistema funcione correctamente con Supabase, **las tablas deben existir en la base de datos** antes de usar la app. Una vez creadas, el sitio y el panel admin leerán/escribirán desde esas tablas.



## Ejecutar

```bash
python -m http.server 5500
```

Navegador: http://localhost:5500/index.html

