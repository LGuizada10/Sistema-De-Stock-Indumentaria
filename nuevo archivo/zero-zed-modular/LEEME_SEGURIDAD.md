# Seguridad y puesta en marcha (leer primero)

## 1) Bajar las librerías a tu carpeta (una sola vez)
Con internet, hacé doble clic en **`descargar-librerias.bat`** (Windows) o ejecutá `./descargar-librerias.sh` (Mac/Linux).
Se crean 3 archivos en `frontend/vendor/` y un `HUELLAS.txt` con sus huellas SHA-256. Guardá ese archivo: si más adelante cambian sin que vos actualices algo, sería señal de que fueron alteradas.
Si falta alguna librería, el programa muestra un cartel que lo explica.
- Siguen viniendo de internet las **tipografías de Google Fonts** (si querés, se pueden bajar también) y, solo si activás el CAPTCHA, el script de **Cloudflare Turnstile** (por diseño no se puede guardar localmente).
- Versión de SheetJS: es la 0.18.5 (la que ya usabas). Tiene avisos de seguridad conocidos al leer planillas de origen no confiable; importá solo Excel propios. Se puede actualizar más adelante.

## 2) Volver a correr el SQL
Copiá todo `backend/zero-zed-supabase-completo.sql` y ejecutalo en Supabase → SQL Editor. Es seguro repetirlo. Incluye las funciones de seguridad, reserva de números por lote para Excel, búsqueda/paginación del catálogo y la función `borrar_todo()` que usa el botón de Ajustes. La búsqueda en Supabase requiere ejecutar esta versión actualizada antes de usarla.

## 3) Usuarios (login por usuario)
En Supabase → Authentication → Users → *Add user*, creá un mail interno por persona, con *Auto Confirm User*:
- `lucia@zerozed.app` → entra escribiendo solo **lucia**.
- El dominio sale de `DOMINIO_INTERNO` en `frontend/js/core/config.js`. No recibe mails: es solo un nombre.
- Para tu cuenta existente, escribí el mail completo en el campo Usuario. Si preferís un usuario corto, creá `admin@zerozed.app` y usá ese mail en el `UPDATE` de la sección 6 del SQL para darle rol admin.
- Mantené desactivados los registros públicos (sign ups).

## 4) Activar el CAPTCHA (opcional, recomendado)
1. Entrá a https://dash.cloudflare.com → *Turnstile* → *Add widget* (gratis). Agregá el dominio donde publiques el programa. Te da una **Site key** y una **Secret key**.
2. Supabase → Authentication → *Attack Protection* → activá **CAPTCHA protection**, proveedor *Cloudflare Turnstile*, y pegá la **Secret key**.
3. Pegá la **Site key** en `TURNSTILE_SITE_KEY` de `frontend/js/core/config.js`.
Importante: hacé 2 y 3 juntos. Si activás el CAPTCHA en Supabase sin la Site key en el programa, nadie podrá entrar; y al revés, el cuadro aparece pero Supabase no lo exige.
Abierto desde un archivo local (doble clic) Turnstile puede no funcionar: probalo ya publicado en tu sitio.

## 5) Aviso sin conexión
Sin internet aparece una franja amarilla. Se pueden seguir viendo y cargando datos (se guardan solos al volver la red), pero **las ventas no se registran** hasta que vuelva la conexión.
