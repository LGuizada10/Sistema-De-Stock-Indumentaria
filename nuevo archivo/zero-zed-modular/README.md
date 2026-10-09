# Zero Zed · Control de local (versión modular)

> ## ⚠️ IMPORTANTE — leer primero
>
> **1. Faltan funciones de la V3.** Esta versión es la división de tu V2 y todavía no tiene:
> - el login por **usuario** (en vez de email),
> - el envío al contador **solo por WhatsApp**,
> - los ajustes de stock **sin pisarse entre dispositivos**,
> - el **aviso sin conexión**,
> - el botón **"borrar todo"**.
>
> El módulo **Promociones** está disponible para el administrador. Se crean ofertas por categoría completa o por prendas seleccionadas, con varios precios por cantidad y fechas opcionales; las ventas aplican el precio promocional automáticamente.
>
> El SQL (`backend/zero-zed-supabase-completo.sql`) ya soporta varias de ellas. Se pueden aplicar sobre esta estructura modular y es más fácil, porque cada una cae en un solo archivo (login → `data/auth.js` y `modules/login.js`; WhatsApp → `modules/facturas.js`; stock → `modules/stock.js` y `data/supabase.js`; aviso sin conexión → `ui/cabecera.js`; borrar todo → `modules/datos.js` y `modules/ajustes.js`).
>
> **2. Rediseño pendiente.** El rediseño de la interfaz y el "mostrar más" de **Devoluciones** e **Historial** (que hoy se ve al costado y queda feo) quedan para cuando lo indiques.


Es **el mismo programa** que tu `Zero_Zed_Control_de_local_NUBE---V2.html`, pero repartido en archivos.
No cambió ninguna función: solo se movió el código de lugar.

> **Cumplimiento legal:** completá `legal/datos-negocio.js` y leé `LEEME_CUMPLIMIENTO.md` (qué se hizo, qué falta y qué consultar con un profesional).

## Antes de publicar en GitHub

- El SQL generado dentro de `migracion/` puede contener ventas, costos y movimientos reales. No lo publiques ni lo ejecutes en otro proyecto; el `.gitignore` de la raíz excluye ese archivo.
- La app se conecta al proyecto de Supabase configurado en `frontend/js/data/supabase.js`. La clave `sb_publishable_...` es una clave pública de cliente, no una contraseña; nunca agregues claves `service_role`, `sb_secret_...` ni contraseñas al repositorio.
- Los datos deben seguir protegidos por las políticas RLS del SQL y los registros públicos de Supabase Auth deben permanecer desactivados.
- No subas respaldos JSON, exportaciones, paquetes ZIP ni las copias HTML antiguas que están fuera de esta carpeta.
- GitHub Pages sirve el frontend estático; no ejecuta el SQL ni instala Supabase. Para usar la app publicada necesitás configurar el dominio permitido en Supabase y revisar las páginas legales antes de habilitarla.

El repositorio está organizado dentro de `nuevo archivo/zero-zed-modular`. Al preparar los cambios, revisá el estado de Git y confirmá que los archivos ignorados no estén ya versionados antes de crear un commit.

## Cómo abrirlo en Windows

1. Copiá o descargá **la carpeta completa** `zero-zed-modular` en la computadora nueva y extraela si llegó comprimida.
2. Hacé doble clic en `Abrir Zero Zed.bat` (o directamente en `index.html`).

No hace falta ejecutar `descargar-librerias.bat` en cada computadora: las librerías ya están incluidas en `frontend/vendor/`. Ese descargador queda solo como reparación si faltara alguno de esos archivos. La aplicación sí necesita internet para iniciar sesión y sincronizar con Supabase.

Para subirla a internet (Netlify, GitHub Pages, etc.) subí la carpeta completa.

## Estructura
```
zero-zed/
├─ index.html                 ← estructura de la pantalla + lista de archivos que se cargan
├─ legal/                     ← políticas (privacidad, cookies, términos, cambios) y datos del negocio
├─ LEEME_CUMPLIMIENTO.md      ← checklist de cumplimiento y accesibilidad
├─ frontend/                  ← LO QUE VE EL USUARIO
│  ├─ css/                    ← estilos (01 a 11, el orden importa)
│  └─ js/
│     ├─ core/                ← base: constantes, utilidades, estado, reglas comunes
│     ├─ data/                ← CONEXIÓN CON EL BACKEND (Supabase): datos y sesión
│     ├─ ui/                  ← cabecera, navegación, avisos, render principal
│     ├─ modules/             ← una pestaña = un archivo
│     └─ app/inicio.js        ← arranque de la app (se carga al final)
└─ backend/
   └─ zero-zed-supabase-completo.sql  ← base de datos de Supabase (SQL completo, se pega en el SQL Editor)
```

## ¿Dónde busco si algo falla?
| Si falla... | Mirá este archivo |
|---|---|
| No guarda / no carga datos, "Sin conexión" | `frontend/js/data/supabase.js` |
| Login, cierre de sesión | `frontend/js/data/auth.js` y `modules/login.js` |
| Pestaña Resumen (gráficos, ganancia) | `modules/resumen.js` |
| Vender, carrito, pago dividido | `modules/vender.js` |
| Stock, talles, colores, carga rápida | `modules/stock.js` |
| Etiquetas / código de barras | `modules/etiquetas.js` |
| Lector de códigos al vender, buscadores | `modules/busqueda.js` |
| Devoluciones y cambios | `modules/devoluciones.js` |
| Turno y caja | `modules/turno.js` |
| Historial y exportar ventas del día | `modules/historial.js` |
| Facturas / WhatsApp al contador | `modules/facturas.js` |
| Compras | `modules/compras.js` |
| Promociones y liquidaciones | `modules/promociones.js`, cálculo de precios al vender y tabla `promociones` en Supabase |
| Ajustes, categorías, registro de movimientos | `modules/ajustes.js` |
| Copia de seguridad, Excel, borrar todo | `modules/datos.js` |
| Recibo / comprobante | `modules/comprobante.js` |
| Accesibilidad (etiquetas, teclado) | `ui/accesibilidad.js`, `css/12-accesibilidad.css` |
| Stock (indicadores, tarjetas, tabla de variantes) | `modules/stock.js`, `css/13-stock.css` |
| Aviso de almacenamiento / pie legal | `ui/aviso-almacenamiento.js`, `index.html` |
| Textos legales, datos del negocio | `legal/` |
| Pestañas, menú "Más", cabecera, modo claro/oscuro | `ui/navegacion.js`, `ui/cabecera.js` |
| La pantalla no se redibuja bien | `ui/render.js` |
| Algo no se ve bien (colores, tamaños) | `frontend/css/` (07 tema, 10 celular, 11 etiquetas) |
| Error en la base de datos / permisos | `backend/zero-zed-supabase-completo.sql` (ver abajo) |

Tip: abrí la consola del navegador (F12). El error indica el archivo y la línea.

## Orden de carga (importa)
`index.html` carga los archivos JS en este orden: core → data → ui → modules → app/inicio.js.
Si agregás un archivo nuevo, ponelo en `index.html` **antes** de `app/inicio.js`.
Los archivos comparten variables y funciones entre sí (no son "módulos aislados"), por eso el orden es importante.

## SQL de Supabase

La guía [backend/LEEME_SQL.md](backend/LEEME_SQL.md) clasifica los SQL por uso:

- `backend/zero-zed-supabase-completo.sql`: estructura, permisos, funciones y auditoría. Es el SQL base para instalar o actualizar el esquema; no es la importación del respaldo.
- `backend/CONSULTAS_SOLO_LECTURA.sql`: consultas `SELECT`; ejecutar una por vez para ver datos, sin modificarlos.
- `migracion/migrar-zero-zed-2026-10-08.sql`: migración de la copia local; reemplaza los datos de negocio después de archivarlos. Ejecutar solo en el proyecto confirmado y solo para esta migración.

El archivo completo del esquema es la versión de referencia. Si se cambia el backend, actualizar ese archivo y guardarlo junto con el proyecto.
