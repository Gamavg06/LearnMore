# SGNIA - Sistema de Guias de Aprendizaje

SGNIA es una plataforma web academica para gestionar guias de aprendizaje, carreras, semestres, usuarios y mensajes de contacto.

## Estructura

```text
Sistema de Guia/
  index.html
  login.html
  register.html
  admin.html
  css/
    style.css
    admin.css
    auth.css
    responsive.css
  js/
    main.js
    firebase.js
    auth.js
    admin.js
    guides.js
    theme.js
    language.js
  assets/
    images/
    icons/
    pdfs/
```

## Funciones implementadas

- Sitio publico con guias dinamicas, filtros por carrera y semestre.
- Panel administrativo con dashboard, CRUD de guias, carreras, mensajes y usuarios locales.
- Registro, inicio de sesion, recuperacion de contrasena y cierre de sesion.
- Perfil de usuario con informacion personal, cierre de sesion y borrado de cuenta.
- Registro con nombre, carrera, numero celular, matricula y semestre.
- Foto de perfil seleccionada desde el dispositivo.
- Modo claro/oscuro persistente.
- Cambio de idioma Espanol/Ingles sin recargar la pagina.
- Modo local con `localStorage` para probar sin Firebase.
- Preparado para Firebase Authentication, Cloud Firestore y Firebase Storage.

## Modo local

El sistema funciona sin configurar Firebase. Para entrar al panel de prueba:

```text
Correo: admin@sgnia.local
Contrasena: admin123
```

Tambien puedes crear usuarios desde `register.html`.

## Configurar Firebase

1. Crea un proyecto en Firebase.
2. Activa Authentication con correo y contrasena.
3. Crea una base de datos Cloud Firestore.
4. Activa Firebase Storage.
5. Copia la configuracion web del proyecto.
6. Reemplaza los valores `TU_*` en `js/firebase.js`.

Colecciones usadas:

- `guides`
- `careers`
- `messages`
- `users`
- `activity`

## Ejecutar

Puedes abrirlo con un servidor local:

```bash
python -m http.server 5500
```

Despues entra a:

```text
http://localhost:5500/index.html
```
