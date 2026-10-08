# Cumplimiento legal y accesibilidad — qué se hizo y qué falta

> No soy abogado: los textos de `legal/` son **borradores**. Que los revise un profesional (o tu contador) antes de publicarlos.
> Cuando estén revisados, poné `borrador: false` en `legal/datos-negocio.js` y desaparece el cartel amarillo.

## Lo primero que tenés que hacer
1. Abrí `legal/datos-negocio.js` y completá los datos del negocio (razón social, CUIT, domicilio, mail, etc.). Es el único archivo: se actualizan solos el pie del programa y las 4 páginas legales.
2. Abrí `legal/privacidad.html` en el navegador y revisá que todo lo que dice sea cierto para tu local.
3. Definí el plazo de cambios (`plazoCambioDias`) según tu política real.

## Tu lista, punto por punto
| Pedido | Estado | Dónde |
|---|---|---|
| Política de privacidad | Hecho (borrador) | `legal/privacidad.html` |
| Política de cookies | Hecho (borrador) | `legal/almacenamiento-cookies.html` |
| Consentimiento de cookies | Hecho como **aviso informativo**: el sistema solo usa almacenamiento esencial, por eso no ofrece "rechazar". Si sumás analítica o píxeles, hace falta un consentimiento real antes de cargarlos | `frontend/js/ui/aviso-almacenamiento.js` |
| Política de reembolsos | Hecho (borrador): cambios, devoluciones y garantía legal | `legal/cambios-y-devoluciones.html` |
| Consentimiento en formularios | Hecho: el pedido de factura exige tildar que el cliente aceptó el uso de sus datos | `frontend/js/modules/facturas.js` |
| Términos y condiciones | Hecho (borrador): términos de uso del sistema para el personal | `legal/terminos.html` |
| Solo datos necesarios | Revisado: se pide nombre, documento, mail **o** WhatsApp y domicilio opcional. No hay datos sensibles | privacidad, sección 3 |
| Seguimiento analítico | No hay ninguno en el código (verificado) | cookies, sección 4 |
| Integración de terceros | Listadas: Supabase, WhatsApp (envío al contador), Google Fonts, cdnjs y jsDelivr. Tiendanube queda preparada (se activa con `tiendanubeActiva: true`) | privacidad sección 4, cookies sección 2 |
| Texto alternativo | El logo tiene `alt`; no hay otras imágenes en el programa | `index.html` |
| Sitio accesible | Mejorado: enlace "saltar al contenido", foco visible, avisos leídos por lectores de pantalla, nombres para botones | `frontend/js/ui/accesibilidad.js`, `frontend/css/12-accesibilidad.css` |
| Contraste de colores | Medido en tema claro y oscuro con las 9 pestañas y el login: sin problemas en el texto. Quedan solo dos íconos decorativos | — |
| Formularios por teclado | Hecho: los títulos desplegables y gráficos clickeables se activan con Enter o Espacio | `ui/accesibilidad.js` |
| Etiquetas claras | Hecho: cada campo quedó asociado a su etiqueta (de 35 campos sin nombre a 0) | `ui/accesibilidad.js` |
| Eliminar reseñas falsas | No aplica: el programa no muestra reseñas ni testimonios (verificado). Si en Tiendanube las usás, que sean de clientes reales | — |
| Eliminar afirmaciones sin respaldo | No aplica: no hay afirmaciones comerciales en el programa. Revisalo en la tienda online cuando la tengas | — |
| Agregar datos del negocio | Hecho: un solo archivo, **falta que lo completes** | `legal/datos-negocio.js` |
| Verificar copyright de imágenes | Solo hay un logo (verificá que sea tuyo o tengas licencia). Tipografías Space Grotesk e IBM Plex: licencia libre (SIL OFL). Librerías: SheetJS (Apache-2.0), jsPDF (MIT), supabase-js (MIT). **Las fotos de productos de Tiendanube necesitan tu permiso o el del proveedor** | — |
| Verificar leyes locales | Basado en la Ley 25.326 (datos personales), la Ley 24.240 (consumidor) y el botón de arrepentimiento. Confirmar con un profesional (ver abajo) | — |

## Para confirmar con un profesional o tu contador
- **Registro de la base de datos** ante la Agencia de Acceso a la Información Pública (AAIP): consultá si te corresponde registrar la base de clientes.
- **Transferencia a proveedores fuera del país** (Supabase, Google): consultá si hace falta algún recaudo adicional.
- **Cuánto tiempo guardar** los comprobantes y registros según tu condición fiscal.
- El texto de **garantía legal** (6 meses nuevos / 3 usados) y el plazo de **10 días de arrepentimiento** para ventas online.
- Que el **WhatsApp al contador** (que lleva datos de clientes) esté cubierto en la política tal como está redactada.

## Cuando conectes Tiendanube
1. Poné `tiendanubeActiva: true` en `legal/datos-negocio.js`: se muestran los apartados de venta online.
2. Tiendanube tiene su propio generador de políticas para la tienda: usalo para la tienda pública y mantené estas páginas para el sistema interno.
3. Si agregás analítica o publicidad en la tienda, necesitás consentimiento con opción de rechazar.
4. Las fotos de productos: derechos de uso.
5. Actualizá la política de privacidad con los datos que se sincronizan.

## Opcional, más adelante
- Guardar **constancia del consentimiento** (fecha y hora) en la base de datos. Requiere agregar una columna en Supabase y cambiar el programa; avisame y lo hago juntos con el SQL.
