# LEARNMORE - Sistema de Guías de Aprendizaje

LEARNMORE es una plataforma web académica (frontend estático + Supabase + funciones serverless) para gestionar:
- **Guías** (recursos por carrera y semestre)
- **Carreras**
- **Mensajes de contacto**
- **Usuarios** y roles (admin/user)
- **Reseñas** (opiniones 1–5 estrellas)

Este README funciona como **manual técnico y base para documentación** (manuales técnicos/de usuario y guía de estilos) usando como fuente el código del repositorio.

---

## 1) Estructura del proyecto

```text
Sistema de Guia/
  index.html           # Sitio público principal
  login.html           # Pantalla de inicio de sesión
  register.html        # Registro
  profile.html         # Perfil de usuario
  Admin/               # Subcarpeta de administración
    admin.html         # Panel administrativo
    admin.css          # Estilos admin
    admin.js           # Lógica admin
  css/
    style.css          # Estilos público
    auth.css           # Estilos autenticación
    profile.css        # Estilos perfil
    responsive.css
    resenas.css        # Estilos reseñas (según archivo existente)
  js/
    main.js            # UI pública: filtros, render de guías, modal de detalle, contacto
    auth.js            # Registro/login/reset + autofill de matrícula
    admin.js           # UI admin: dashboard, CRUD guías/carreras/mensajes/usuarios, reseñas
    guides.js          # Capa de datos: fallback localStorage + Supabase CRUD + realtime
    supabase.js        # Cliente Supabase + “shims” tipo Firestore para compatibilidad
    profile.js         # UI perfil: edición, foto, mensajes/reseñas del usuario
    resenas.js         # UI reseñas: estrellas + envío + render
    language.js        # i18n ES/EN con diccionario
    theme.js           # tema claro/oscuro persistente
    migrar.js          # Migración a Supabase inicial (careers/guides)
  functions/
    index.js           # Deno serverless: envío de correos (Resend)
```

---

## 2) Metodología/arquitectura utilizada (detectada en el código)

- **Arquitectura modular por capas** sin framework MVC:
  - UI por páginas y módulos JS: cada vista importa utilidades y **renderiza con HTML strings**.
  - Capa de datos/negocio: `js/guides.js` centraliza:
    - CRUD/acciones (`saveGuide`, `saveCareer`, `saveMessage`, `saveUser`, `saveReview`, etc.)
    - suscripción realtime (`subscribe*`)
    - fallback local (`localStorage` + evento `learnmore:local-change`).
  - Infra/SDK: `js/supabase.js` encapsula el cliente y ofrece shims con firma “Firestore-like”.
  - Backend serverless: `functions/index.js` para enviar emails con Resend.

- **Estrategia “Real-time con fallback local” (sync-ready):**
  - Si `supabaseReady === true` el sistema lee/suscribe desde Supabase.
  - Si una tabla no existe o hay error: se usa `localStorage` silenciosamente o se evita spam de errores (ver manejo de tablas opcionales/realtime en `guides.js`).

- **Patrón funcional (ES Modules):** exportación de funciones y constantes (sin clases).

---

## 3) Modelo de datos (Supabase) y estados esperados

> Nota: el código asume que las tablas **existen**; aun así `guides.js` tiene lógica defensiva para tablas opcionales.

### 3.1 Tablas base (consultadas/escritas)

1) **`guides`**
- Clave: `id` (usada en UI como `guide.id`)
- Campos esperados en código:
  - `title`, `desc`, `detail`
  - `career` (key/id de carrera)
  - `sem` (número)
  - `topics` (array de strings)
  - `fileUrl` (URL pública del recurso)
  - `created_at`, `updated_at`

2) **`careers`**
- Clave: `id` (en admin se fuerza a `data.key || data.id` normalizado)
- Campos:
  - `id`, `name`, `description`, `desc` (ambas variantes se mapean en `saveCareer`)
  - `color`
  - `created_at`, `updated_at`

3) **`messages`** (contacto)
- Campos usados:
  - `id`, `name`, `email`, `subject`, `message`
  - `reply`, `replied_by`, `replied_at`
  - `status`
  - `created_at`, `updated_at`

- **Estados (`messages.status`)** (ver `admin.js`):
  - `nuevo`
  - `leido`
  - `revisado`
  - `respondido`

4) **`gmailMessages`**
- Tabla tratada como opcional en realtime (lista de mensajes sincronizados desde Gmail/función no incluida en este repositorio).
- UI admin (`admin.js`) la mezcla con `messages`.

5) **`users`**
- Campos usados:
  - `id` (en modo admin real es UUID desde Supabase auth)
  - `email`, `name`, `role`
  - `career`, `sem`/`semester`, `phone`, `studentId`, `bio`
  - `password` existe solo en modo local (en supabaseReady: se elimina antes de guardar)

6) **`activity`**
- Registro de eventos del sistema (dashboard admin).
- Campos usados:
  - `type`, `text`, `created_at`, `updated_at`

7) **`reviews`**
- Campos usados:
  - `id`, `name`, `comment` (en `resenas.js`) o `message` (en `admin.js`), `stars`
  - `reply`, `replied_by`, `replied_at`
  - `status` (en admin)
  - `email` en perfil (filtrado por email)
  - `created_at`, `updated_at`

---

## 4) Modelo de datos (Modo Local / localStorage)

En `js/guides.js` se definen las keys:

### 4.1 Keys
- `learnmore.guides`
- `learnmore.careers`
- `learnmore.messages`
- `learnmore.users`
- `learnmore.activity`
- `learnmore.reviews`

### 4.2 Inicialización de seed
- `ensureLocalSeed()` inserta defaults si no existen:
  - `careers`: usa `defaultCareers` (IDs `01`, `02`, `03`)
  - `guides`: default vacío
  - `messages`: default `[]`
  - `users`: default `[]`
  - `activity`: default `[]`

### 4.3 Credenciales de prueba (local)
- Admin local: `admin@learnmore.local` / `admin123`

---

## 5) Supabase: contratos, realtime y shims

### 5.1 Cliente Supabase
En `js/supabase.js`:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `export const supabase = createClient(...)`
- `export const supabaseReady = true`

### 5.2 “Shims” Firestore-like
`supabase.js` expone funciones compatibles para no romper `guides.js`/resto del código (ej: `collection`, `doc`, `addDoc`, `setDoc`, `deleteDoc`, `getDoc`, `onSnapshot`).

### 5.3 Storage shims
- `ref`, `uploadBytes`, `getDownloadURL`
- Nota: el bucket en el shim aparece como **`files`**.
- En `js/guides.js` el bucket usado para guías es **`guides`**.

### 5.4 Realtime en `js/guides.js`
- `subscribeSupabaseTable(tableName, fallback, callback)`:
  - carga inicial con `.select('*')` y orden por:
    - `created_at` si la tabla está en lista `tablesWithCreatedAt`
    - si no, por `id`
  - suscripción `postgres_changes` para `event: '*'`.

- **Tablas opcionales** (sin existencia garantizada):
  - `gmailMessages`, `reviews`
  - comportamiento: intenta fetch inicial; si falla, usa `fallback` silenciosamente.

---

## 6) Backend serverless (functions)

### 6.1 Endpoint de correo
En `functions/index.js`:
- Usa `deno.land/std/http/server.ts`.
- Implementa CORS con headers:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

- Método:
  - `POST` (y `OPTIONS` para preflight)

- Payload esperado (JSON):
  - `name`, `email`, `subject`, `message`

- Envío con Resend (en código):
  - `Authorization: Bearer ${Deno.env.get("RESEND_API_KEY")}`
  - `to: ["brayanscompany@gmail.com"]`

---

## 7) Flujos por módulo (UI)

### 7.1 Sitio público (`js/main.js`)
**Responsabilidad:** filtros, render de guías/carreras, modal, estadísticas y contacto.

- **Inicialización:**
  - `initTheme()`, `initLanguage()`, `initSessionUi()`, `renderCareers()` y `renderCareerOptions()`.

- **Suscripción de datos (realtime):**
  - `subscribeCareers` → actualiza `careers` y re-render de filtros/guias/dashboard
  - `subscribeGuides` → actualiza `guides`, render de stats/semestres/guias

- **Filtros:**
  - `activeCareer` por botones con `.filter-tab[data-filter]`
  - `activeSemester` por `#semesterFilter`

- **Render principal de guías (`renderGuides`)**
  - filtra por:
    - carrera: `guide.career === activeCareer` o `all`
    - semestre: `String(guide.sem) === String(activeSemester)` o `all`

- **Modal de guía (`openGuide`)**
  - inyecta:
    - `title`, `career/sem`, `detail || desc`
    - `topics` como chips
    - link `guide.fileUrl` si existe

- **Contacto**
  - `#contactForm` → `saveMessage(data)` (en `guides.js`)

- **UI sesión/admin (`initSessionUi`)**
  - Si Supabase está activo: `onAuthStateChanged` + carga perfil `users` para decidir admin.
  - Si Supabase no está listo: usa `getLocalCurrentUser()`.

### 7.2 Autenticación (`js/auth.js`)
**Registro (`#registerForm`)**
- Valida:
  - `email`, `password`
  - matrícula con formato regex `^(\d{2})-(\d{2})-(\d{3})$` (a través de `getMatriculaInfo` en `guides.js`)
- Construye `userProfile`:
  - `name`, `career`, `phone`, `studentId`, `semester`, `email`, `role: "user"`
- Si `supabaseReady`:
  - `createUserWithEmailAndPassword(auth, email, password)`
  - guarda en `users` con `saveUser` y `id: authData.user.id`.
- Si modo local:
  - guarda con `saveLocalUser` usando `id=email` y `password`.
- En ambos casos: `setLocalSession({ email, name, role })` y redirección a `index.html`.

**Login (`#loginForm`)**
- Valida `email` y `password`.
- Caso admin local (fallback):
  - `admin@learnmore.local` / `admin123` → guarda usuario local admin y manda a `Admin/admin.html`.
- Si Supabase:
  - `signInWithEmailAndPassword`
  - carga rol desde `users` (perfil) y redirecciona a `Admin/admin.html` si es admin.
- Si local:
  - busca en `localUsers()` por `email` y `password`.

**Reset contraseña (`#resetPassword`)**
- Si Supabase: `sendPasswordResetEmail(auth, email)`.
- Si local: mensaje indicativo; no hay reset real.

**Autofill matrícula**
- `initMatriculaAutofill()` rellena `career` y `semester` cuando `studentId` cambia/blur.

### 7.3 Admin (`js/admin.js`)
**Inicialización**
- `initTheme()`, `initLanguage()`, `renderCareerSelect()`, `renderCareers()`.

**Suscripciones**
- `subscribeCareers`, `subscribeGuides`, `subscribeMessages`, `subscribeGmailMessages`, `subscribeUsers`, `subscribeActivity`, `subscribeReviews`.

**Dashboard (`renderDashboard`)**
- Métricas:
  - `guides.length`, `careers.length`, semestres únicos en guías
  - mensajes totales `contactMessages.length + gmailMessages.length`
  - `users.length`, `reviews.length`
  - `Supabase` status: activo/local

**CRUD Guías**
- `#guideForm` → `saveGuide(data)` (incluye `file` para storage de `guides` bucket)
- Botones en lista:
  - `data-edit-guide` → `fillGuide(id)`
  - `data-delete-guide` → `deleteGuide(id)`

**CRUD Carreras**
- `#careerForm` → `saveCareer()`
- `fillCareer()` + botones `edit/delete`.

**Mensajes**
- Se combinan `messages` + `gmailMessages` y se ordena por fecha.
- Estados visuales con `statusLabel`:
  - `nuevo`, `leido`, `revisado`, `respondido`
- Acciones:
  - marcar leído → `updateMessageStatus(id, "leido")`
  - responder → abre drawer y llama `replyToMessage(id, reply, adminName)`.

**Usuarios**
- Render filtrado por búsqueda/rol.
- Acciones:
  - editar → `fillUser(id)`
  - cambiar rol → `changeUserRole(id, role)` usando `saveUser`
  - eliminar → `deleteUser(id)`

**Reseñas**
- Render con botones:
  - marcar leído → `updateReviewStatus(id,"leido")`
  - responder → `replyToReviewPrompt` (usa `prompt()`)
  - eliminar → `deleteReview(id)`

### 7.4 Perfil (`js/profile.js`)
**Carga del usuario**
- Si Supabase:
  - `onAuthStateChanged` y `loadSupabaseProfile(user)`
- Si local:
  - `getLocalCurrentUser()`

**Edición perfil** (`#profileForm`)
- Campos editables: `name`, `career`, `semester`, `studentId`
- Normalización:
  - `studentId` → `normalizeMatricula`
  - sem derivado con `getMatriculaInfo()` si válido
- Foto perfil:
  - `#profilePhotoInput` lee archivo y lo convierte a DataURL (`fileToDataUrl`)

**Mensajes del usuario**
- Supabase: filtra `messages` por `email` y ordena por `created_at desc`.
- Local: lee `learnmore.messages` y filtra `msg.email === currentUser.email`.

**Reseñas del usuario**
- Supabase: filtra `reviews` por `email`.
- Local: lee `learnmore.reviews` y filtra `r.email === currentUser.email`.

**Acciones**
- logout: `signOut()` (si Supabase) + `clearLocalSession()`
- borrar cuenta: `deleteUser(currentUser.id)` y/o por email si aplica.

### 7.5 Reseñas públicas (`js/resenas.js`)
- UI de estrellas:
  - `.star[data-val]` actualiza `selectedStars` y estados visuales
- Envío (`submitReview`)
  - valida `name`, `comment`, `selectedStars`
  - crea objeto:
    - `name`, `comment`, `stars`, `created_at`
  - llama `saveReview(review)`

- Suscripción de reseñas
  - `subscribeReviews` llama `renderReviews()`.

---

## 8) Capa de datos y negocio (`js/guides.js`)

Esta es la pieza central.

### 8.1 Subscripciones exportadas
- `subscribeGuides`, `subscribeCareers`
- `subscribeMessages` (tabla `messages`)
- `subscribeGmailMessages` (tabla `gmailMessages`)
- `subscribeUsers` (tabla `users`)
- `subscribeActivity` (tabla `activity`)
- `subscribeReviews` (tabla `reviews`)

### 8.2 Normalización
- `normalizeTopics(value)`:
  - si viene array, retorna array
  - si string: separa por comas y hace `trim`

### 8.3 CRUD y acciones (exportaciones)
- `saveGuide(data)`
  - payload: `sem: Number(...)`, `topics: normalizeTopics(...)`
  - si Supabase no listo → `localUpsert(KEYS.guides, payload)`
  - si trae `file`:
    - sube a storage bucket **`guides`**
    - obtiene `fileUrl`
  - guarda/actualiza en tabla `guides`
  - registra actividad con `saveActivity({type:"guide"...})`

- `saveCareer(data)`
  - fuerza `careerId` a normalización:
    - `String(data.key || data.id || "").trim().toLowerCase()`
  - upsert lógico: consulta si existe `id` y decide update vs insert

- `saveMessage(data)`
  - setea `status: "nuevo"` y `created_at`
  - si Supabase no listo → `localUpsert(KEYS.messages, payload)`
  - si Supabase activo:
    - inserta en `messages`
    - intenta enviar email al admin si está configurado:
      - `window.__LEARNMORE_SEND_CONTACT_EMAIL_URL__`
    - retorna `result.id`

- `updateMessageStatus(id, status)` → update en `messages`

- `replyToMessage(id, reply, adminName)`
  - actualiza `reply`, `replied_by`, `replied_at`, `status: "respondido"`
  - luego intenta enviar correo de respuesta si existe:
    - `window.__LEARNMORE_SEND_REPLY_EMAIL_URL__`

- `saveUser(data)`
  - normaliza:
    - `email` a lowercase
    - `role` default "user"
  - validación UUID:
    - si `id` no es UUID (ej. modo local admin/email local) → guarda solo localStorage
  - si Supabase activo y UUID:
    - limpia campos locales (bio/phone/photoData/password/etc.)
    - upsert en `users` usando conflicto `onConflict: "id"`

- `deleteGuide / deleteCareer / deleteUser` (con fallback local)

- `saveReview(data)`
  - si Supabase no listo:
    - upsert en `localStorage` y registra actividad
  - si Supabase activo:
    - inserta en `reviews` con campos `payload`

- `updateReviewStatus / replyToReview / deleteReview`

### 8.4 Actividad (`saveActivity`)
- Si Supabase no listo → `localUpsert(KEYS.activity, {...})`
- Si Supabase listo:
  - inserta en `activity`
  - silencia errores si tabla no existe (códigos `PGRST116`, `42P01`)

### 8.5 Utilidades académicas (matrícula)
- `getCuatrimestreFromDate(date)`
- `getCareerCodeFromName(careerName)` → mapea nombres/strings a `"01"|"02"|"03"`
- `getCareerNameFromCode(code)`
- `getCurrentAcademicPeriodIndex(date)`
- `getMatriculaInfo(value, referenceDate)`
  - valida regex `^(\d{2})-(\d{2})-(\d{3})$`
  - calcula `semester` a partir de periodo académico

- `generateMatricula(careerName)`
  - si Supabase: cuenta usuarios con mismo carrera y cuatrimestre
  - si local: cuenta en localUsers
  - retorna `generation-careerCode-consecutive`

---

## 9) Migración automática (`js/migrar.js`)

- `ejecutarMigracionAutomatica()`
  - corre solo si `supabaseReady`
  - upsert a Supabase:
    1) carreras (`careers`) usando `defaultCareers`
    2) guías (`guides`) usando `defaultGuides`

---

## 10) Guía de estilo (convenciones observadas)

Estas convenciones deben mantenerse en documentación futura:

- **Estados**
  - `messages.status`: `nuevo`, `leido`, `revisado`, `respondido`
  - `reviews.status`: `nuevo`, `leido` (y valores que admin renderiza)

- **Formato de matrícula**
  - `YY-CC-NNN`
  - Código carrera: `01`, `02`, `03`

- **IDs de carreras**
  - `defaultCareers` usa `id: "01"|"02"|"03"`
  - `saveCareer` normaliza a `toLowerCase()` (ojo al documentarlo)

- **Temas e idiomas**
  - `theme.js` persiste key: `learnmore.theme`
  - `language.js` persiste key: `learnmore.lang` y usa `data-i18n` + `data-i18n-placeholder`.

- **Fallback local**
  - usar keys `learnmore.*` definidas en `guides.js`
  - notificar cambios con evento `learnmore:local-change`.

- **UI**
  - render con `innerHTML` y handlers con `addEventListener`.
  - delegación de eventos en contenedores cuando el HTML se reinyecta (ej. admin.js).

---

## 11) Ejecutar localmente

```bash
python -m http.server 5500
```

Navegador: http://localhost:5500/index.html

---

## 12) Historial / Control de Cambios

### [2026-06-25] Carrusel de Reseñas VIP (SGNIA#24)
- **css/style.css**: Añadido `position: relative;` a `.reviews-carousel-track` para posibilitar el cálculo correcto de la propiedad `offsetLeft` de las tarjetas de reseñas.
- **js/resenas.js**: Implementada la navegación interactiva y adaptabilidad del carrusel de opiniones:
  - Botones de navegación Anterior (`⟨`) y Siguiente (`⟩`) que calculan dinámicamente el ancho de la tarjeta + gap para realizar el desplazamiento horizontal del viewport.
  - Generación dinámica de puntos indicadores (dots) interactivos según la cantidad de tarjetas visibles por categoría.
  - Sincronización del punto indicador activo durante el deslizamiento manual/scroll mediante un event listener en el viewport con retardo (debounce) de 100ms.
  - Reinicio automático del scroll a la posición inicial al alternar entre pestañas de plataforma/guías o al insertar una nueva reseña.

### [2026-06-25] Modales VIP y Visualización Completa de Guías (SGNIA#25)
- **Admin/admin.html**: Integrado modal de confirmación VIP (`#confirmModal`) utilizando la etiqueta `<dialog>` con diseño glassmorphic de cristal, textos traducidos y botones estilizados.
- **Admin/admin.css**: Añadidos estilos para el botón de confirmación rojo neón (`.confirm-btn-danger`) y reglas CSS de scroll personalizado (`::-webkit-scrollbar`) para la lista de popularidad.
- **Admin/admin.js**:
  - Implementada la función asincrónica `showConfirmModal` para reemplazar los diálogos nativos `confirm()` al eliminar guías, carreras, usuarios y reseñas.
  - Modificada la renderización del gráfico de popularidad (`renderPopularityChart`) eliminando el límite de 5 elementos para listar todas las guías del sistema (incluyendo nuevas guías sin visitas) y agregando scroll vertical acotado a 380px.
- **js/language.js**: Registradas traducciones para `"admin.confirmTitle"` y `"admin.deleteBtn"`.

### [2026-06-25] Carrusel de Guías en el Panel Admin (SGNIA#26)
- **Admin/admin.html**: Reestructurado el panel de "Guias publicadas" agregando el viewport del carrusel, botones de navegación e indicadores de puntos (dots).
- **Admin/admin.css**: Añadidos los estilos del carrusel adaptados para la consola de administración (ocultación de scrollbars, navegación hover, dots y comportamiento responsivo con 2 tarjetas en resoluciones grandes).
- **Admin/admin.js**:
  - Implementada la lógica de control del carrusel (`setupGuidesCarouselEvents`, `setupGuidesCarouselIndicators`, `syncGuidesCarouselDots`).
  - Sincronizado el scroll y la generación de indicadores cada vez que las guías se actualizan, cargan o editan.

### [2026-07-15] Persistencia Completa de Perfil en la Nube (SGNIA#27)
- **js/guides.js**: Modificada la función `saveUser` para que no elimine las propiedades `phone`, `bio` y `photoData` del payload antes de upsertar el registro en Supabase. Ahora que la base de datos cuenta con estas columnas (incluyendo la versión camelCase `"photoData"`), la información se sincroniza permanentemente en la nube además del fallback local en `localStorage`.

### [2026-07-15] Fotos de Perfil de Usuarios en Reseñas (SGNIA#28)
- **js/resenas.js**:
  - Se importó y configuró la suscripción en tiempo real a los usuarios (`subscribeUsers`).
  - Se modificó la renderización de las reseñas (`renderReviews`) para buscar el usuario autor (coincidiendo el correo electrónico) y cargar dinámicamente su avatar `"photoData"` (imagen) en lugar de las iniciales.
- **Admin/admin.js**:
  - Se actualizó la vista de reseñas en el panel administrativo (`renderReviews`) para integrar un pequeño contenedor circular de avatar que carga la imagen del usuario (o inicial de respaldo) al lado del nombre del remitente.







