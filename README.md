# Zero Zed · Control de local

Aplicación web de **un solo archivo HTML** para gestionar un local de ropa: ventas, stock, turnos, devoluciones, compras para reventa y reportes. Funciona 100 % en el navegador, sin servidor ni instalación.
# Zero Zed · Control de local

Aplicación web de **un solo archivo HTML** para gestionar un local de ropa: ventas, stock, turnos, devoluciones, compras para reventa y reportes. Funciona 100 % en el navegador, sin servidor ni instalación.

> Esta es la versión **LOCAL**: los datos se guardan en el `localStorage` del navegador. Una versión conectada a base de datos (nube) está planeada para más adelante.

## Funciones

- **Turno**: apertura y cierre de caja, efectivo en caja, gastos del turno.
- **Vender**: búsqueda por clave o nombre, carrito, varios métodos de pago con recargos configurables (débito / crédito).
- **Stock**: productos con talles y colores, categorías, alertas de stock bajo, planilla de stock e importación/exportación por Excel.
- **Etiquetas**: generación de etiquetas en PDF para prendas nuevas.
- **Devoluciones y cambios**: por venta o manual.
- **Compras**: compras para reventa e historial.
- **Historial**: ventas por día, más vendido, ganancia diaria y mensual, exportación a Excel.
- **Ajustes**: datos del local, categorías, recargos, PIN de acceso y copia de seguridad.
- **Roles**: Administrador y Empleado, cada uno con su PIN.
- Tema claro/oscuro.

## Cómo usarla

1. Descargá `Zero_Zed_Control_de_local-V2.html`.
2. Abrilo con doble clic en Chrome, Edge o Firefox.
3. Ingresá con el PIN de administrador o de empleado.

> **Cambiá los PINs por defecto** en *Ajustes* apenas la abras por primera vez.

## Copias de seguridad (importante)

Los datos viven en el navegador, atados al archivo y a su ubicación. Si borrás los datos del navegador o cambiás el archivo de carpeta, podés perderlos.

- Descargá una copia desde *Ajustes → Copia de seguridad* con frecuencia.
- Para actualizar la aplicación: descargá la copia, abrí el HTML nuevo **desde la misma carpeta y con el mismo nombre**, y si aparece vacío, cargá la copia desde *Ajustes*.

## Tecnologías

- HTML, CSS y JavaScript puro (sin frameworks, sin paso de compilación).
- [SheetJS (xlsx)](https://sheetjs.com/) para Excel y [jsPDF](https://github.com/parallax/jsPDF) para PDF, cargadas desde CDN.
- Fuentes de Google Fonts.

Como usa librerías por CDN, **necesita internet** para exportar a Excel/PDF y para cargar las fuentes.

## Estructura del repositorio

```
.
├── Zero_Zed_Control_de_local-V2.html   # toda la aplicación
├── README.md
├── requirements.txt                     # dependencias (informativo)
└── .gitignore
```

## Licencia

Proyecto personal. Definí acá la licencia que prefieras (por ejemplo MIT) o dejalo como "todos los derechos reservados".
> Esta es la versión **LOCAL**: los datos se guardan en el `localStorage` del navegador. Una versión conectada a base de datos (nube) está planeada para más adelante.

## Funciones

- **Turno**: apertura y cierre de caja, efectivo en caja, gastos del turno.
- **Vender**: búsqueda por clave o nombre, carrito, varios métodos de pago con recargos configurables (débito / crédito).
- **Stock**: productos con talles y colores, categorías, alertas de stock bajo, planilla de stock e importación/exportación por Excel.
- **Etiquetas**: generación de etiquetas en PDF para prendas nuevas.
- **Devoluciones y cambios**: por venta o manual.
- **Compras**: compras para reventa e historial.
- **Historial**: ventas por día, más vendido, ganancia diaria y mensual, exportación a Excel.
- **Ajustes**: datos del local, categorías, recargos, PIN de acceso y copia de seguridad.
- **Roles**: Administrador y Empleado, cada uno con su PIN.
- Tema claro/oscuro.

## Cómo usarla

1. Descargá `Zero_Zed_Control_de_local-V2.html`.
2. Abrilo con doble clic en Chrome, Edge o Firefox.
3. Ingresá con el PIN de administrador o de empleado.

> **Cambiá los PINs por defecto** en *Ajustes* apenas la abras por primera vez.

## Copias de seguridad (importante)

Los datos viven en el navegador, atados al archivo y a su ubicación. Si borrás los datos del navegador o cambiás el archivo de carpeta, podés perderlos.

- Descargá una copia desde *Ajustes → Copia de seguridad* con frecuencia.
- Para actualizar la aplicación: descargá la copia, abrí el HTML nuevo **desde la misma carpeta y con el mismo nombre**, y si aparece vacío, cargá la copia desde *Ajustes*.

## Tecnologías

- HTML, CSS y JavaScript puro (sin frameworks, sin paso de compilación).
- [SheetJS (xlsx)](https://sheetjs.com/) para Excel y [jsPDF](https://github.com/parallax/jsPDF) para PDF, cargadas desde CDN.
- Fuentes de Google Fonts.

Como usa librerías por CDN, **necesita internet** para exportar a Excel/PDF y para cargar las fuentes.

## Estructura del repositorio

```
.
├── Zero_Zed_Control_de_local-V2.html   # toda la aplicación
├── README.md
├── requirements.txt                     # dependencias (informativo)
└── .gitignore
```

## Licencia

Proyecto personal. Definí acá la licencia que prefieras (por ejemplo MIT) o dejalo como "todos los derechos reservados".