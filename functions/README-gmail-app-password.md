# Gmail con App Password (SMTP) - LearnMore

Este archivo documenta las variables de entorno necesarias para enviar correos a través de Gmail usando App Password.

## Variables de entorno (requeridas)
- `GMAIL_SMTP_USER`: tu correo Gmail (ej: `miusuario@gmail.com`)
- `GMAIL_SMTP_APP_PASSWORD`: tu App Password de Google
- `ADMIN_EMAIL`: destinatario final (ej: `admin@learnmore.com`)

## Variable opcional
- `GMAIL_FROM_NAME`: nombre desde el que se muestra el remitente (por defecto: `LEARNMORE`)

## Endpoint HTTP (si se usa frontend)
- `POST /sendContactEmail`

Body JSON esperado:
```json
{
  "name": "...",
  "email": "...",
  "subject": "...",
  "message": "..."
}
```

