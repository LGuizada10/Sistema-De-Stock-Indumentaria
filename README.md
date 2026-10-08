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
> El SQL (`backend/zero-zed-supabase-completo.sql`) ya soporta varias de ellas. Se pueden aplicar sobre esta estructura modular y es más fácil, porque cada una cae en un solo archivo (login → `data/auth.js` y `modules/login.js`; WhatsApp → `modules/facturas.js`; stock → `modules/stock.js` y `data/supabase.js`; aviso sin conexión → `ui/cabecera.js`; borrar todo → `modules/datos.js` y `modules/ajustes.js`).
>
> **2. Rediseño pendiente.** El rediseño de la interfaz y el "mostrar más" de **Devoluciones** e **Historial** (que hoy se ve al costado y queda feo) quedan para cuando lo indiques.


Es **el mismo programa** que tu `Zero_Zed_Control_de_local_NUBE---V2.html`, pero repartido en archivos.
No cambió ninguna función: solo se movió el código de lugar.

> **Cumplimiento legal:** completá `legal/datos-negocio.js` y leé `LEEME_CUMPLIMIENTO.md` (qué se hizo, qué falta y qué consultar con un profesional).

## Cómo abrirlo
Abrí `index.html` en el navegador (doble clic). Tiene que estar toda la carpeta junta.
Para subirlo a internet (Netlify, GitHub Pages, etc.) subí la carpeta completa.

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
| Ajustes, categorías, registro de movimientos | `modules/ajustes.js` |
| Copia de seguridad, Excel, borrar todo | `modules/datos.js` |
| Recibo / comprobante | `modules/comprobante.js` |
| Accesibilidad (etiquetas, teclado) | `ui/accesibilidad.js`, `css/12-accesibilidad.css` |
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

## Backend (Supabase) — `backend/zero-zed-supabase-completo.sql`
Es **tu SQL completo y actualizado**, en un solo archivo: tablas, permisos (RLS), funciones, ventas, facturas, auditoría y endurecimiento.
Se puede volver a ejecutar sin romper datos existentes.

**Cómo se usa:** cuando haya que cambiar algo de la base, se modifica este archivo (se lo pedís a Claude), se copia **todo** su contenido y se pega en Supabase → SQL Editor → Run. Este archivo es la versión de referencia: guardalo siempre actualizado.
