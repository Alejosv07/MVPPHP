# Seguridad, emails y páginas legales — Luxuria Pure

## 1. URGENTE: rota las credenciales que se filtraron

El repositorio de GitHub (`Alejosv07/MVPPHP`) es **público** y tenía en el historial:

| Secreto | Dónde estaba | Qué hacer |
|---|---|---|
| Contraseña MySQL de producción (`uleq3tipddiim`) | `api/config/database.php` | SiteGround → MySQL → cambiar la contraseña |
| Contraseña de aplicación de Gmail (`balrking072@gmail.com`) | `api/src/Utils/EmailService.php` | Google Account → Seguridad → Contraseñas de aplicaciones → **revocar** y crear una nueva |
| Volcado de la BD con usuarios, hashes y datos de clientes | `dbfd54m5pulgei.sql` | Cambiar las contraseñas de todos los usuarios admin/staff |
| Secreto de los enlaces de email (`purenest_secret`) | código | Ya reemplazado por `APP_SECRET` |

Quitar los archivos del código **no** los borra del historial de git. Rota las credenciales
igualmente y, si quieres limpiar el historial, usa `git filter-repo` o convierte el repo en privado.

Revisa también `public_html/public/uploads/` en el servidor: antes cualquiera podía subir
archivos `.php` ahí. Borra todo lo que no sea una imagen.

## 2. Pasos de despliegue (en este orden)

1. Copia `api/config/secrets.example.php` → `api/config/secrets.php` y pon las credenciales **nuevas**.
   Genera `APP_SECRET` con: `php -r "echo bin2hex(random_bytes(32));"`
2. Sube `secrets.php` por FTP/File Manager a `public_html/api/config/secrets.php`
   (está en `.gitignore` y excluido del deploy, así que nunca llega solo).
3. Ejecuta `database/migrations/2026-11-08_consent_columns.sql` en phpMyAdmin.
4. Rellena los `[[MARCADORES]]` de las páginas legales (ver sección 5).
5. Haz commit y push a `main` → GitHub Actions despliega (ahora por FTPS).
6. Los usuarios del panel deben iniciar sesión de nuevo (las sesiones antiguas no tenían token).
7. Los enlaces de los emails enviados antes del cambio dejan de funcionar (usaban el secreto filtrado).

## 3. Qué se corrigió

| Problema | Gravedad | Corrección |
|---|---|---|
| La API no tenía autenticación: cualquiera podía listar, crear o borrar admins, ver clientes y reservas o leer códigos de reset | Crítica | Tokens firmados (HMAC) en login y matriz de permisos en `api/public/index.php` |
| Subida de imágenes sin validar → subir `.php` = ejecución remota de código | Crítica | Validación MIME y de imagen, nombre aleatorio y `.htaccess` que bloquea scripts en `uploads/` |
| Credenciales en el código (BD y Gmail) | Crítica | `api/config/secrets.php` (fuera de git) + `Config::get()` |
| Reset de contraseña solo con un código de 6 dígitos (sin email) → fuerza bruta | Alta | Requiere email + código, rate limit, respuesta genérica |
| OTP de clientes: 4 dígitos, sin expiración, sin límite de intentos | Alta | 6 dígitos, expiración de 10 min, un solo uso, rate limit |
| Calificaciones de clientes: cualquiera podía calificar cualquier reserva | Alta | Token de cliente tras el OTP; solo reservas propias y completadas |
| Enlaces de email falsificables (secreto público) | Alta | HMAC con `APP_SECRET` |
| Confirmar/Cancelar por GET (los escáneres de correo pueden cancelar reservas solos) | Media | GET muestra un botón; el cambio solo ocurre por POST |
| XSS reflejado al reprogramar y XSS almacenado en el panel de empleados y zonas | Alta | Validación de fecha y escape de HTML |
| La página pública descargaba **todas** las reservas para mostrar reseñas | Alta | Nuevo endpoint `/reviews` (nombre + inicial, sin dirección) |
| La reserva pública podía fijar estado, precio y staff | Media | Forzados a PENDING / sin precio / sin staff |
| El staff podía ver o editar las reservas de otros | Media | Restringido a sus asignaciones y a los estados En camino / Iniciado / Completado |
| Contraseñas en texto plano en el log de auditoría | Media | Se eliminan antes de registrar |
| El `user_id` de auditoría lo enviaba el cliente (falsificable) | Media | Se toma del token |
| Mensajes de error internos (SQL) devueltos al navegador | Baja | Mensajes genéricos + `error_log` |
| CORS `*`, sin cabeceras de seguridad | Baja | Lista de orígenes permitidos y cabeceras |
| Enumeración de usuarios en login/forgot | Baja | Respuestas idénticas |
| Deploy por FTP sin cifrar; subía el `.sql` y los logs | Media | FTPS + lista de exclusión |
| Redirects a `/login.html` e `/index.html` daban 404 | Bug | Rutas relativas |

## 4. Emails: organización por función

| Dirección | Uso |
|---|---|
| `no-reply@luxuriapure.com` | Remitente (`From`) de todos los emails automáticos |
| `bookings@luxuriapure.com` | `Reply-To` de los emails a clientes + alertas internas (nueva reserva; cliente confirmó, canceló o reprogramó) |
| `info@luxuriapure.com` | Contacto general (footer, páginas legales) |
| `privacy@luxuriapure.com` | Solicitudes de privacidad (exigido por la Privacy Policy) |

Crea esos buzones o alias en el hosting del dominio. **Gmail solo permite enviar como la propia cuenta
o como un alias verificado**: hasta que configures `no-reply@` (o uses el SMTP del dominio),
`secrets.php` mantiene `MAIL_FROM` = la cuenta de Gmail.

Cada estado tiene ahora su propio asunto, mensaje y botones:
- PENDING sin precio: "Recibimos tu solicitud" (sin botón Confirmar).
- CONFIRMED, RESCHEDULED, ON_THE_WAY, INITIATED, COMPLETED (con botón de valoración), CANCELLED, REJECTED y REMINDER.

Todos incluyen versión en texto plano, footer con enlaces legales y datos escapados. Se quitó el envío
de respaldo a `balrking07@gmail.com`.

Recordatorios: programa en el cron del hosting `php /home/.../public_html/api/cron/reminders.php`
una vez al día (se envían 3 días antes y 1 día antes).

## 5. Páginas legales (en `public/`)

- `terms-of-service.html`
- `privacy-policy.html` (derechos según la MODPA de Maryland, la VCDPA de Virginia y DC; leyes de notificación de brechas)
- `cancellation-policy.html` (48 h / 50 % / 100 %, lock-out, garantía de re-limpieza en 24 h, reembolsos)
- `sms-terms.html` (TCPA / CTIA: STOP/HELP, frecuencia, consentimiento no obligatorio)
- `accessibility.html` (ADA / WCAG 2.1 AA)
- `licenses-insurance.html` (licencias de DC, MD y VA; seguro y COI)

El formulario de reserva exige aceptar los Términos y la Privacy Policy, ofrece un opt-in de SMS
opcional y guarda la fecha y la IP del consentimiento.

Marcadores que debes rellenar (búscalos con `[[`):
`LEGAL ENTITY NAME`, `BUSINESS MAILING ADDRESS`, `DC BASIC BUSINESS LICENSE #`, `MARYLAND SDAT ENTITY ID`,
`BALTIMORE CITY / COUNTY REGISTRATION`, `ARLINGTON COUNTY BPOL LICENSE #`, `CITY OF ALEXANDRIA BPOL LICENSE #`,
`VIRGINIA SCC ENTITY ID`, `INSURANCE CARRIER & POLICY #`, `BOND PROVIDER & AMOUNT`.

> Estos textos son una plantilla sólida, no asesoría legal. Pide que los revise un abogado
> con licencia en DC, Maryland y Virginia antes de publicarlos.
