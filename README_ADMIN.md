# Archivos esenciales para implantar el Admin de LEARNMORE

Este documento resume los archivos necesarios para llevar el panel administrativo de LEARNMORE a otro proyecto.

## Archivos obligatorios

Estos archivos son necesarios para que el panel administrativo funcione:

```text
admin.html 
css/admin.css 
js/admin.js 
js/guides.js 
js/firebase.js 
profile.html 
css/profile.css
js/profile.js
```

### admin.html

Contiene la estructura principal del panel administrativo:

- Sidebar.
- Dashboard.
- Seccion de guias.
- Seccion de carreras.
- Seccion de mensajes.
- Seccion de usuarios.

### css/admin.css

Contiene los estilos especificos del panel:

- Menu lateral.
- Tarjetas administrativas.
- Listas.
- Formularios.
- Botones de editar y eliminar.
- Distribucion del dashboard.

### js/admin.js

Contiene la logica principal del panel:

- Cambio de vistas del admin.
- Dashboard con estadisticas.
- Crear, editar y eliminar guias.
- Crear, editar y eliminar carreras.
- Ver mensajes de contacto.
- Ver usuarios.
- Buscar y filtrar usuarios.
- Crear o actualizar perfiles de usuario.
- Cambiar rol entre `user` y `admin`.
- Eliminar perfiles de usuario.
- Cierre de sesion.

### js/guides.js

Contiene las funciones de datos que usa el admin:

- `subscribeGuides`
- `subscribeCareers`
- `subscribeMessages`
- `subscribeUsers`
- `subscribeActivity`
- `saveGuide`
- `deleteGuide`
- `saveCareer`
- `deleteCareer`
- `updateMessageStatus`

Tambien incluye datos de prueba para que el admin funcione en modo local con `localStorage`.

### js/firebase.js

Contiene la configuracion de Firebase:

- Firebase Authentication.
- Cloud Firestore.
- Firebase Storage.

Si no configuras Firebase, el sistema funciona en modo local usando `localStorage`.

### profile.html y js/profile.js

Permiten que el usuario autenticado vea y edite su informacion personal, cierre sesion o borre su cuenta/perfil.

El perfil incluye:

- Nombre.
- Correo.
- Carrera.
- Numero celular.
- Matricula.
- Semestre.
- Informacion personal.
- Foto seleccionada desde el dispositivo.

## Archivos necesarios para el sitio publico

Si desde `admin.html` entras a `Sitio publico` y quieres que aparezca el boton `Admin` para volver al panel, el sitio publico tambien necesita estos archivos y fragmentos:

```text
index.html
css/style.css
css/responsive.css
js/main.js
js/theme.js
js/language.js
```

En `index.html` debe existir el enlace del admin con este `id`:

```html
<a class="nav-cta" href="admin.html" id="adminNavLink" data-i18n="nav.admin" hidden>Admin</a>
```

El boton esta oculto por defecto con `hidden`. `js/main.js` lo muestra solo si la sesion activa tiene rol `admin`:

```js
document.querySelector("#adminNavLink")?.toggleAttribute("hidden", !isAdmin);
```

Si no copias `js/main.js`, si el usuario no tiene `role: "admin"`, o si el sitio publico no tiene ese enlace con `id="adminNavLink"`, el boton `Admin` no aparecera.

En `css/style.css` deben existir la clase y la variable del borde:

```css
:root {
  --accent-border: rgba(0, 212, 255, 0.45);
}

.nav-cta {
  color: var(--accent) !important;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
}
```

### Idioma y tema

Para que el cambio de idioma funcione en cualquier pagina implantada, esa pagina debe cargar un script que importe y ejecute `initLanguage()`:

```js
import { initLanguage } from "./language.js";

initLanguage();
```

Tambien debe tener el boton:

```html
<button class="chip-btn" id="languageToggle" type="button">ES</button>
```

Y los textos deben tener `data-i18n`:

```html
<a data-i18n="nav.home">Inicio</a>
```

`js/theme.js` permite cambiar entre modo claro y modo oscuro.

`js/language.js` permite cambiar idioma entre Espanol e Ingles.

## Recomendacion

Para implantar el admin sin errores, copia estos archivos completos:

```text
admin.html
index.html
css/admin.css
css/style.css
css/responsive.css
css/profile.css
js/admin.js
js/main.js
js/guides.js
js/firebase.js
js/theme.js
js/language.js
profile.html
js/profile.js
```

## Enlaces necesarios en admin.html

El archivo `admin.html` debe incluir estos estilos:

```html
<link rel="stylesheet" href="css/admin.css">
```

Y este script:

```html
<script type="module" src="js/admin.js"></script>
```

## Si no quieres usar tema e idioma

Si no vas a copiar `theme.js` y `language.js`, elimina estas lineas de `js/admin.js`:

```js
import { initTheme } from "./theme.js";
import { initLanguage } from "./language.js";
```

Tambien elimina estas llamadas:

```js
initTheme();
initLanguage();
```

## Credenciales locales de prueba

Cuando Firebase no esta configurado, puedes entrar al admin con:

```text
Correo: admin@sgnia.local
Contrasena: admin123
```

Un usuario normal registrado desde `register.html` queda con rol `user` y no puede entrar a `admin.html`.

Si alguien abre `admin.html` directamente sin una sesion de administrador, sera enviado a `login.html`.

En Firebase, el usuario autenticado tambien debe tener un documento en la coleccion `users` con:

```js
{
  role: "admin"
}
```

El documento puede usar como ID el `uid` del usuario o su correo.

## Configuracion de Firebase

Para conectar el admin con Firebase, edita `js/firebase.js` y reemplaza los valores `TU_*`:

```js
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};
```

Colecciones usadas por el admin:

```text
guides
careers
messages
users
activity
```
