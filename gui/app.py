import customtkinter as ctk
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.conexion import (
    inicializar_bd, 
    agregar_producto_con_variante, 
    obtener_variantes_stock,
    eliminar_variante,
    actualizar_variante_y_precios,
    agregar_producto_con_matriz_variantes,
    registrar_venta_carrito,
    obtener_resumen_ventas_hoy,
    obtener_reporte_ventas,
    obtener_caja_abierta,
    abrir_caja,
    registrar_movimiento_caja,
    obtener_resumen_caja_actual,
    cerrar_caja
)

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")


class VentanaEditar(ctk.CTkToplevel):
    """Ventana para editar Talle, Color, Stock y Precios de Costo/Venta."""
    def __init__(self, parent, var_id, talle_actual, color_actual, stock_actual, costo_actual, venta_actual, callback_actualizar):
        super().__init__(parent)
        self.title("Editar Prenda y Precios")
        self.geometry("360x380")
        self.var_id = var_id
        self.callback = callback_actualizar
        self.attributes("-topmost", True)

        ctk.CTkLabel(self, text="Editar Variante y Precios", font=("Arial", 14, "bold")).pack(pady=10)

        self.txt_talle = ctk.CTkEntry(self, placeholder_text="Talle")
        self.txt_talle.insert(0, str(talle_actual))
        self.txt_talle.pack(pady=5, padx=20, fill="x")

        self.txt_color = ctk.CTkEntry(self, placeholder_text="Color")
        self.txt_color.insert(0, str(color_actual))
        self.txt_color.pack(pady=5, padx=20, fill="x")

        self.txt_stock = ctk.CTkEntry(self, placeholder_text="Stock")
        self.txt_stock.insert(0, str(stock_actual))
        self.txt_stock.pack(pady=5, padx=20, fill="x")

        self.txt_costo = ctk.CTkEntry(self, placeholder_text="Precio Costo ($)")
        self.txt_costo.insert(0, str(costo_actual))
        self.txt_costo.pack(pady=5, padx=20, fill="x")

        self.txt_venta = ctk.CTkEntry(self, placeholder_text="Precio Venta ($)")
        self.txt_venta.insert(0, str(venta_actual))
        self.txt_venta.pack(pady=5, padx=20, fill="x")

        btn_guardar = ctk.CTkButton(self, text="Guardar Cambios", command=self.guardar, fg_color="#10B981", hover_color="#059669")
        btn_guardar.pack(pady=15)

    def guardar(self):
        try:
            nuevo_talle = self.txt_talle.get().strip()
            nuevo_color = self.txt_color.get().strip()
            nuevo_stock = int(self.txt_stock.get().strip() or 0)
            nuevo_costo = float(self.txt_costo.get().strip() or 0)
            nuevo_venta = float(self.txt_venta.get().strip() or 0)

            actualizar_variante_y_precios(self.var_id, nuevo_talle, nuevo_color, nuevo_stock, nuevo_costo, nuevo_venta)
            self.callback()
            self.destroy()
        except ValueError:
            pass


class AppStock(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Sistema de Gestión - La Pyme Style")
        self.geometry("1100x700")

        self.ventana_editar = None

        self.columna_orden = "producto"
        self.direccion_orden = "ASC"

        self.carrito = []
        self.dict_variantes = {}

        inicializar_bd()

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # -------------------------------------------------------------
        # MENÚ LATERAL (SIDEBAR)
        # -------------------------------------------------------------
        self.sidebar_frame = ctk.CTkFrame(self, width=180, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(7, weight=1)

        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="⚡ La Pyme", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 20))

        self.btn_inicio = ctk.CTkButton(self.sidebar_frame, text="🏠  Inicio", anchor="w", command=self.mostrar_inicio)
        self.btn_inicio.grid(row=1, column=0, padx=15, pady=5, sticky="ew")

        self.btn_caja = ctk.CTkButton(self.sidebar_frame, text="💰  Caja", anchor="w", command=self.mostrar_caja)
        self.btn_caja.grid(row=2, column=0, padx=15, pady=5, sticky="ew")

        self.btn_ventas = ctk.CTkButton(self.sidebar_frame, text="🛒  Ventas", anchor="w", command=self.mostrar_ventas)
        self.btn_ventas.grid(row=3, column=0, padx=15, pady=5, sticky="ew")

        self.btn_compras = ctk.CTkButton(self.sidebar_frame, text="🛍️  Compras", anchor="w", command=self.mostrar_compras)
        self.btn_compras.grid(row=4, column=0, padx=15, pady=5, sticky="ew")

        self.btn_stock = ctk.CTkButton(self.sidebar_frame, text="📦  Stock", anchor="w", command=self.mostrar_stock)
        self.btn_stock.grid(row=5, column=0, padx=15, pady=5, sticky="ew")

        self.btn_reportes = ctk.CTkButton(self.sidebar_frame, text="📊  Reportes", anchor="w", command=self.mostrar_reportes)
        self.btn_reportes.grid(row=6, column=0, padx=15, pady=5, sticky="ew")

        self.botones_menu = [self.btn_inicio, self.btn_caja, self.btn_ventas, self.btn_compras, self.btn_stock, self.btn_reportes]

        # -------------------------------------------------------------
        # PANELS / VISTAS
        # -------------------------------------------------------------
        self.view_inicio = ctk.CTkFrame(self, fg_color="transparent")
        self.view_caja = ctk.CTkFrame(self, fg_color="transparent")
        self.view_ventas = ctk.CTkFrame(self, fg_color="transparent")
        self.view_compras = ctk.CTkFrame(self, fg_color="transparent")
        self.view_stock = ctk.CTkFrame(self, fg_color="transparent")
        self.view_reportes = ctk.CTkFrame(self, fg_color="transparent")

        self.setup_vista_inicio()
        self.setup_vista_caja()
        self.setup_vista_ventas()
        self.setup_vista_compras()
        self.setup_vista_stock()
        self.setup_vista_reportes()

        self.mostrar_inicio()

    def resaltar_boton(self, boton_activo):
        for btn in self.botones_menu:
            if btn == boton_activo:
                btn.configure(fg_color=["#3B82F6", "#1D4ED8"], text_color="white")
            else:
                btn.configure(fg_color="transparent", text_color=["gray10", "gray90"])

    def ocultar_vistas(self):
        self.view_inicio.grid_forget()
        self.view_caja.grid_forget()
        self.view_ventas.grid_forget()
        self.view_compras.grid_forget()
        self.view_stock.grid_forget()
        self.view_reportes.grid_forget()

    # -------------------------------------------------------------
    # NAVEGACIÓN
    # -------------------------------------------------------------
    def mostrar_inicio(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_inicio)
        self.view_inicio.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.actualizar_resumen_inicio()

    def mostrar_caja(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_caja)
        self.view_caja.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.actualizar_estado_caja_ui()

    def mostrar_ventas(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_ventas)
        self.view_ventas.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.cargar_opciones_ventas()

    def mostrar_compras(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_compras)
        self.view_compras.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)

    def mostrar_stock(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_stock)
        self.view_stock.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.actualizar_inventario()

    def mostrar_reportes(self):
        self.ocultar_vistas()
        self.resaltar_boton(self.btn_reportes)
        self.view_reportes.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.actualizar_reportes()

    # -------------------------------------------------------------
    # VISTA 1: INICIO
    # -------------------------------------------------------------
    def setup_vista_inicio(self):
        lbl_titulo = ctk.CTkLabel(self.view_inicio, text="Panel de Inicio", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 15))

        self.card_ventas = ctk.CTkFrame(self.view_inicio, corner_radius=10)
        self.card_ventas.pack(fill="x", pady=10)

        lbl_resumen = ctk.CTkLabel(self.card_ventas, text="🟢 Hoy", font=("Arial", 14, "bold"))
        lbl_resumen.pack(side="left", padx=15, pady=15)

        self.lbl_monto_hoy = ctk.CTkLabel(self.card_ventas, text="Ventas de hoy: $0.00 (0 operaciones)", font=("Arial", 16, "bold"), text_color="#10B981")
        self.lbl_monto_hoy.pack(side="right", padx=15, pady=15)

    def actualizar_resumen_inicio(self):
        total, ops = obtener_resumen_ventas_hoy()
        self.lbl_monto_hoy.configure(text=f"Ventas de hoy: ${total:,.2f} ({ops} operaciones)")

    # -------------------------------------------------------------
    # VISTA 2: CONTROL DE CAJA
    # -------------------------------------------------------------
    def setup_vista_caja(self):
        lbl_titulo = ctk.CTkLabel(self.view_caja, text="Control y Arqueo de Caja", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 15))

        self.frame_caja_cerrada = ctk.CTkFrame(self.view_caja)
        self.frame_caja_abierta = ctk.CTkFrame(self.view_caja, fg_color="transparent")

        # UI CAJA CERRADA
        lbl_ap = ctk.CTkLabel(self.frame_caja_cerrada, text="🔓 Abrir Nueva Caja", font=("Arial", 16, "bold"))
        lbl_ap.pack(pady=(20, 10))

        lbl_monto_i = ctk.CTkLabel(self.frame_caja_cerrada, text="Monto/Fondo Inicial en Efectivo ($):", font=("Arial", 12))
        lbl_monto_i.pack(pady=5)

        self.txt_monto_inicial = ctk.CTkEntry(self.frame_caja_cerrada, placeholder_text="Ej: 5000", width=200)
        self.txt_monto_inicial.insert(0, "0.00")
        self.txt_monto_inicial.pack(pady=5)

        btn_abrir = ctk.CTkButton(self.frame_caja_cerrada, text="Abrir Caja", font=("Arial", 13, "bold"), fg_color="#10B981", hover_color="#059669", command=self.ejecutar_apertura_caja)
        btn_abrir.pack(pady=15)

        self.lbl_estado_apertura = ctk.CTkLabel(self.frame_caja_cerrada, text="", font=("Arial", 12))
        self.lbl_estado_apertura.pack(pady=5)

        # UI CAJA ABIERTA
        self.frame_caja_abierta.columnconfigure((0, 1), weight=1)

        frame_resumen = ctk.CTkFrame(self.frame_caja_abierta)
        frame_resumen.grid(row=0, column=0, sticky="nsew", padx=(0, 5), pady=5)

        ctk.CTkLabel(frame_resumen, text="📊 Estado de Caja Activa", font=("Arial", 14, "bold")).pack(anchor="w", padx=15, pady=15)

        self.lbl_info_caja = ctk.CTkLabel(frame_resumen, text="", font=("Arial", 12), justify="left", anchor="w")
        self.lbl_info_caja.pack(fill="x", padx=15, pady=5)

        lbl_mov = ctk.CTkLabel(frame_resumen, text="➕/➖ Registrar Movimiento Manual", font=("Arial", 13, "bold"))
        lbl_mov.pack(anchor="w", padx=15, pady=(15, 5))

        self.combo_tipo_mov = ctk.CTkOptionMenu(frame_resumen, values=["EGRESO", "INGRESO"])
        self.combo_tipo_mov.pack(fill="x", padx=15, pady=5)

        self.txt_monto_mov = ctk.CTkEntry(frame_resumen, placeholder_text="Monto ($)")
        self.txt_monto_mov.pack(fill="x", padx=15, pady=5)

        self.txt_concepto_mov = ctk.CTkEntry(frame_resumen, placeholder_text="Concepto (Ej: Pago flete, Retiro)")
        self.txt_concepto_mov.pack(fill="x", padx=15, pady=5)

        btn_reg_mov = ctk.CTkButton(frame_resumen, text="Guardar Movimiento", command=self.ejecutar_registro_movimiento)
        btn_reg_mov.pack(fill="x", padx=15, pady=10)

        frame_cierre = ctk.CTkFrame(self.frame_caja_abierta)
        frame_cierre.grid(row=0, column=1, sticky="nsew", padx=(5, 0), pady=5)

        ctk.CTkLabel(frame_cierre, text="🔒 Cerrar Caja / Arqueo", font=("Arial", 14, "bold")).pack(anchor="w", padx=15, pady=15)

        lbl_real = ctk.CTkLabel(frame_cierre, text="Efectivo Real en Caja ($):", font=("Arial", 12, "bold"))
        lbl_real.pack(anchor="w", padx=15, pady=(5, 2))

        self.txt_efectivo_real = ctk.CTkEntry(frame_cierre, placeholder_text="Contá el dinero de la caja")
        self.txt_efectivo_real.pack(fill="x", padx=15, pady=5)

        lbl_obs = ctk.CTkLabel(frame_cierre, text="Observaciones / Notas:", font=("Arial", 12))
        lbl_obs.pack(anchor="w", padx=15, pady=(5, 2))

        self.txt_obs_cierre = ctk.CTkEntry(frame_cierre, placeholder_text="Ej: Faltante de $50 por cambio")
        self.txt_obs_cierre.pack(fill="x", padx=15, pady=5)

        btn_cerrar = ctk.CTkButton(
            frame_cierre, 
            text="🔒 Realizar Cierre de Caja", 
            font=("Arial", 13, "bold"), 
            fg_color="#EF4444", 
            hover_color="#DC2626",
            height=40,
            command=self.ejecutar_cierre_caja
        )
        btn_cerrar.pack(fill="x", padx=15, pady=20)

        self.lbl_estado_cierre = ctk.CTkLabel(frame_cierre, text="", font=("Arial", 12))
        self.lbl_estado_cierre.pack(pady=5)

    def actualizar_estado_caja_ui(self):
        caja = obtener_caja_abierta()
        if not caja:
            self.frame_caja_abierta.pack_forget()
            self.frame_caja_cerrada.pack(fill="both", expand=True, padx=20, pady=20)
        else:
            self.frame_caja_cerrada.pack_forget()
            self.frame_caja_abierta.pack(fill="both", expand=True)

            resumen = obtener_resumen_caja_actual()
            if resumen:
                info_text = (
                    f"Apertura: {str(resumen['fecha_apertura'])[:16]}\n\n"
                    f"• Fondo Inicial: ${resumen['monto_inicial']:,.2f}\n"
                    f"• Ventas en Efectivo: ${resumen['ventas_efectivo']:,.2f}\n"
                    f"• Ventas Digitales: ${resumen['ventas_digitales']:,.2f}\n"
                    f"• Ingresos Manuales: +${resumen['ingresos_extra']:,.2f}\n"
                    f"• Egresos/Gastos: -${resumen['egresos_extra']:,.2f}\n\n"
                    f"💵 EFECTIVO ESPERADO EN CAJA: ${resumen['efectivo_esperado']:,.2f}"
                )
                self.lbl_info_caja.configure(text=info_text)

    def ejecutar_apertura_caja(self):
        try:
            monto_i = float(self.txt_monto_inicial.get().strip() or 0)
            abrir_caja(monto_i)
            self.lbl_estado_apertura.configure(text="¡Caja abierta exitosamente!", text_color="#10B981")
            self.actualizar_estado_caja_ui()
        except ValueError:
            self.lbl_estado_apertura.configure(text="Ingresá un monto válido.", text_color="red")

    def ejecutar_registro_movimiento(self):
        resumen = obtener_resumen_caja_actual()
        if not resumen:
            return

        try:
            tipo = self.combo_tipo_mov.get()
            monto = float(self.txt_monto_mov.get().strip())
            concepto = self.txt_concepto_mov.get().strip()

            if monto <= 0 or not concepto:
                raise ValueError()

            registrar_movimiento_caja(resumen["caja_id"], tipo, monto, concepto)
            self.txt_monto_mov.delete(0, 'end')
            self.txt_concepto_mov.delete(0, 'end')
            self.actualizar_estado_caja_ui()
        except ValueError:
            pass

    def ejecutar_cierre_caja(self):
        resumen = obtener_resumen_caja_actual()
        if not resumen:
            return

        try:
            real = float(self.txt_efectivo_real.get().strip())
            obs = self.txt_obs_cierre.get().strip()

            dif = cerrar_caja(resumen["caja_id"], real, obs)

            if dif == 0:
                msg = "¡Cierre perfecto! La caja no tiene sobrantes ni faltantes."
                color = "#10B981"
            elif dif > 0:
                msg = f"Cierre con Sobrante de ${abs(dif):,.2f}"
                color = "#F59E0B"
            else:
                msg = f"Cierre con FALTANTE de ${abs(dif):,.2f}"
                color = "#EF4444"

            self.lbl_estado_cierre.configure(text=msg, text_color=color)
            self.txt_efectivo_real.delete(0, 'end')
            self.txt_obs_cierre.delete(0, 'end')
            self.after(2000, self.actualizar_estado_caja_ui)

        except ValueError:
            self.lbl_estado_cierre.configure(text="Ingresá un monto de efectivo real válido.", text_color="red")

    # -------------------------------------------------------------
    # VISTA 3: VENTAS (POS CON CARRITO)
    # -------------------------------------------------------------
    def setup_vista_ventas(self):
        lbl_titulo = ctk.CTkLabel(self.view_ventas, text="Punto de Venta (POS)", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 10))

        container_pos = ctk.CTkFrame(self.view_ventas, fg_color="transparent")
        container_pos.pack(fill="both", expand=True)
        container_pos.columnconfigure(0, weight=1)
        container_pos.columnconfigure(1, weight=1)

        # Panel Izquierdo
        frame_izq = ctk.CTkFrame(container_pos)
        frame_izq.grid(row=0, column=0, sticky="nsew", padx=(0, 5), pady=5)

        lbl_sec1 = ctk.CTkLabel(frame_izq, text="Añadir Prendas", font=("Arial", 14, "bold"))
        lbl_sec1.pack(anchor="w", padx=15, pady=(15, 5))

        lbl_prod = ctk.CTkLabel(frame_izq, text="Seleccionar Prenda:", font=("Arial", 12, "bold"))
        lbl_prod.pack(anchor="w", padx=15, pady=(10, 2))

        self.combo_prendas = ctk.CTkOptionMenu(frame_izq, values=["Cargando prendas..."], command=self.al_seleccionar_prenda)
        self.combo_prendas.pack(fill="x", padx=15, pady=5)

        self.lbl_info_variante = ctk.CTkLabel(frame_izq, text="Precio: $0.00 | Stock disponible: 0", font=("Arial", 12))
        self.lbl_info_variante.pack(anchor="w", padx=15, pady=5)

        lbl_cant = ctk.CTkLabel(frame_izq, text="Cantidad:", font=("Arial", 12, "bold"))
        lbl_cant.pack(anchor="w", padx=15, pady=(10, 2))

        self.txt_cant_venta = ctk.CTkEntry(frame_izq, placeholder_text="1")
        self.txt_cant_venta.insert(0, "1")
        self.txt_cant_venta.pack(fill="x", padx=15, pady=5)

        btn_add_carrito = ctk.CTkButton(
            frame_izq, 
            text="➕ Agregar al Carrito", 
            font=("Arial", 13, "bold"), 
            fg_color="#3B82F6", 
            hover_color="#2563EB",
            height=35,
            command=self.agregar_al_carrito
        )
        btn_add_carrito.pack(padx=15, pady=15, fill="x")

        self.lbl_estado_pos = ctk.CTkLabel(frame_izq, text="", font=("Arial", 12))
        self.lbl_estado_pos.pack(pady=5)

        # Panel Derecho
        frame_der = ctk.CTkFrame(container_pos)
        frame_der.grid(row=0, column=1, sticky="nsew", padx=(5, 0), pady=5)

        lbl_sec2 = ctk.CTkLabel(frame_der, text="🧾 Detalle / Factura", font=("Arial", 14, "bold"))
        lbl_sec2.pack(anchor="w", padx=15, pady=(15, 5))

        self.scroll_carrito = ctk.CTkScrollableFrame(frame_der, label_text="Productos en Ticket")
        self.scroll_carrito.pack(fill="both", expand=True, padx=15, pady=5)

        frame_cobro = ctk.CTkFrame(frame_der, fg_color="transparent")
        frame_cobro.pack(fill="x", padx=15, pady=10)

        self.lbl_total_carrito = ctk.CTkLabel(frame_cobro, text="TOTAL: $0.00", font=("Arial", 18, "bold"), text_color="#10B981")
        self.lbl_total_carrito.pack(anchor="e", pady=(0, 10))

        lbl_pago = ctk.CTkLabel(frame_cobro, text="Método de Pago:", font=("Arial", 12, "bold"))
        lbl_pago.pack(anchor="w", pady=(0, 2))

        self.combo_pago = ctk.CTkOptionMenu(frame_cobro, values=["Efectivo", "Mercado Pago", "Transferencia", "Débito", "Crédito"])
        self.combo_pago.pack(fill="x", pady=5)

        btn_finalizar = ctk.CTkButton(
            frame_cobro, 
            text="💳 Finalizar Venta", 
            font=("Arial", 14, "bold"), 
            fg_color="#10B981", 
            hover_color="#059669",
            height=40,
            command=self.finalizar_venta
        )
        btn_finalizar.pack(fill="x", pady=(10, 0))

    def cargar_opciones_ventas(self):
        registros = obtener_variantes_stock()
        self.dict_variantes = {}
        opciones = []

        for item in registros:
            var_id, nombre, cat, talle, color, costo, precio, stock, prod_id = item
            texto_opcion = f"{nombre} ({talle}/{color})"
            self.dict_variantes[texto_opcion] = {
                "id": var_id,
                "nombre": nombre,
                "talle": talle,
                "color": color,
                "precio": precio,
                "stock": stock
            }
            opciones.append(texto_opcion)

        if opciones:
            self.combo_prendas.configure(values=opciones)
            self.combo_prendas.set(opciones[0])
            self.al_seleccionar_prenda(opciones[0])
        else:
            self.combo_prendas.configure(values=["No hay prendas cargadas"])
            self.combo_prendas.set("No hay prendas cargadas")
            self.lbl_info_variante.configure(text="Cargá prendas en el módulo de Stock.")

    def al_seleccionar_prenda(self, seleccion):
        if seleccion in self.dict_variantes:
            info = self.dict_variantes[seleccion]
            self.lbl_info_variante.configure(text=f"Precio: ${info['precio']:.2f} | Stock disponible: {info['stock']}")

    def agregar_al_carrito(self):
        seleccion = self.combo_prendas.get()
        if seleccion not in self.dict_variantes:
            self.lbl_estado_pos.configure(text="Seleccioná una prenda válida.", text_color="red")
            return

        try:
            cant = int(self.txt_cant_venta.get().strip())
            if cant <= 0:
                raise ValueError()
        except ValueError:
            self.lbl_estado_pos.configure(text="Ingresá una cantidad válida.", text_color="red")
            return

        info = self.dict_variantes[seleccion]
        stock_disp = info["stock"]
        cant_ya_en_carrito = sum(item["cantidad"] for item in self.carrito if item["variante_id"] == info["id"])

        if cant_ya_en_carrito + cant > stock_disp:
            self.lbl_estado_pos.configure(text=f"Supera el stock disponible ({stock_disp}).", text_color="red")
            return

        for item in self.carrito:
            if item["variante_id"] == info["id"]:
                item["cantidad"] += cant
                self.actualizar_vista_carrito()
                self.lbl_estado_pos.configure(text="Producto sumado al carrito.", text_color="#10B981")
                return

        self.carrito.append({
            "variante_id": info["id"],
            "nombre": info["nombre"],
            "talle": info["talle"],
            "color": info["color"],
            "precio_unitario": info["precio"],
            "cantidad": cant
        })

        self.lbl_estado_pos.configure(text="Agregado al ticket.", text_color="#10B981")
        self.actualizar_vista_carrito()

    def actualizar_vista_carrito(self):
        for widget in self.scroll_carrito.winfo_children():
            widget.destroy()

        total = 0.0

        if not self.carrito:
            ctk.CTkLabel(self.scroll_carrito, text="El carrito está vacío.").pack(pady=20)
            self.lbl_total_carrito.configure(text="TOTAL: $0.00")
            return

        for idx, item in enumerate(self.carrito):
            subtotal = item["cantidad"] * item["precio_unitario"]
            total += subtotal

            frame_item = ctk.CTkFrame(self.scroll_carrito)
            frame_item.pack(fill="x", pady=3, padx=2)

            text_desc = f"{item['nombre']} ({item['talle']}/{item['color']})\n${item['precio_unitario']:.2f} x {item['cantidad']} = ${subtotal:,.2f}"
            ctk.CTkLabel(frame_item, text=text_desc, font=("Arial", 11), justify="left", anchor="w").pack(side="left", padx=8, pady=5, fill="x", expand=True)

            btn_minus = ctk.CTkButton(
                frame_item, 
                text="-", 
                width=24, 
                height=24, 
                fg_color="#F59E0B",
                command=lambda i=idx: self.restar_item_carrito(i)
            )
            btn_minus.pack(side="left", padx=2)

            btn_del = ctk.CTkButton(
                frame_item, 
                text="🗑️", 
                width=24, 
                height=24, 
                fg_color="#EF4444",
                command=lambda i=idx: self.eliminar_item_carrito(i)
            )
            btn_del.pack(side="left", padx=2)

        self.lbl_total_carrito.configure(text=f"TOTAL: ${total:,.2f}")

    def restar_item_carrito(self, index):
        if self.carrito[index]["cantidad"] > 1:
            self.carrito[index]["cantidad"] -= 1
        else:
            self.carrito.pop(index)
        self.actualizar_vista_carrito()

    def eliminar_item_carrito(self, index):
        self.carrito.pop(index)
        self.actualizar_vista_carrito()

    def finalizar_venta(self):
        if not self.carrito:
            self.lbl_estado_pos.configure(text="El carrito está vacío.", text_color="red")
            return

        try:
            monto_total = registrar_venta_carrito(self.carrito, self.combo_pago.get())
            self.lbl_estado_pos.configure(
                text=f"¡Venta concretada! Total: ${monto_total:,.2f}", 
                text_color="#10B981"
            )
            self.carrito = []
            self.actualizar_vista_carrito()
            self.cargar_opciones_ventas()
        except ValueError as err:
            self.lbl_estado_pos.configure(text=str(err), text_color="red")

    # -------------------------------------------------------------
    # VISTA 4: COMPRAS
    # -------------------------------------------------------------
    def setup_vista_compras(self):
        lbl_titulo = ctk.CTkLabel(self.view_compras, text="Módulo de Compras", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 15))

        frame_placeholder = ctk.CTkFrame(self.view_compras)
        frame_placeholder.pack(fill="both", expand=True)

        lbl_proximamente = ctk.CTkLabel(frame_placeholder, text="🛍️ Módulo de Proveedores y Compras\nAcá ingresarás facturas de proveedores para reponer stock.", font=("Arial", 14))
        lbl_proximamente.pack(expand=True)

    # -------------------------------------------------------------
    # VISTA 5: STOCK (CON BÚSQUEDA Y CARGA MASIVA)
    # -------------------------------------------------------------
    def setup_vista_stock(self):
        lbl_titulo = ctk.CTkLabel(self.view_stock, text="Gestión de Stock e Inventario", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 10))

        self.tabview_stock = ctk.CTkTabview(self.view_stock)
        self.tabview_stock.pack(fill="both", expand=True)

        self.tab_inventario = self.tabview_stock.add(" Ver Inventario ")
        self.tab_carga = self.tabview_stock.add(" Carga Individual ")
        self.tab_carga_masiva = self.tabview_stock.add(" ⚡ Carga Masiva / Variantes ")

        self.setup_tab_inventario()
        self.setup_tab_carga()
        self.setup_tab_carga_masiva()

    def setup_tab_inventario(self):
        # Barra de búsqueda y actualización
        frame_top = ctk.CTkFrame(self.tab_inventario, fg_color="transparent")
        frame_top.pack(fill="x", pady=5)

        self.txt_buscar = ctk.CTkEntry(frame_top, placeholder_text="🔍 Buscar por nombre, categoría, talle o color...", width=320)
        self.txt_buscar.pack(side="left", padx=(0, 10))
        self.txt_buscar.bind("<KeyRelease>", lambda event: self.actualizar_inventario())

        btn_refrescar = ctk.CTkButton(frame_top, text="Actualizar Lista", command=self.actualizar_inventario)
        btn_refrescar.pack(side="left")

        self.scroll_frame = ctk.CTkScrollableFrame(self.tab_inventario, label_text="Inventario Disponible")
        self.scroll_frame.pack(padx=0, pady=5, fill="both", expand=True)

    def setup_tab_carga(self):
        frame = ctk.CTkFrame(self.tab_carga)
        frame.pack(pady=15, padx=20, fill="both", expand=True)

        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)

        lbl_nombre = ctk.CTkLabel(frame, text="Nombre de Prenda *", font=("Arial", 12, "bold"), anchor="w")
        lbl_nombre.grid(row=0, column=0, columnspan=2, padx=15, pady=(10, 2), sticky="ew")
        self.txt_nombre = ctk.CTkEntry(frame, placeholder_text="Ej: Remera Oversize Básica")
        self.txt_nombre.grid(row=1, column=0, columnspan=2, padx=15, pady=(0, 10), sticky="ew")

        lbl_cat = ctk.CTkLabel(frame, text="Categoría *", font=("Arial", 12, "bold"), anchor="w")
        lbl_cat.grid(row=2, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_categoria = ctk.CTkEntry(frame, placeholder_text="Ej: Remeras, Pantalones")
        self.txt_categoria.grid(row=3, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_talle = ctk.CTkLabel(frame, text="Talle *", font=("Arial", 12, "bold"), anchor="w")
        lbl_talle.grid(row=2, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_talle = ctk.CTkEntry(frame, placeholder_text="Ej: M, L, 42")
        self.txt_talle.grid(row=3, column=1, padx=15, pady=(0, 10), sticky="ew")

        lbl_color = ctk.CTkLabel(frame, text="Color *", font=("Arial", 12, "bold"), anchor="w")
        lbl_color.grid(row=4, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_color = ctk.CTkEntry(frame, placeholder_text="Ej: Negro, Azul")
        self.txt_color.grid(row=5, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_stock = ctk.CTkLabel(frame, text="Stock Inicial", font=("Arial", 12, "bold"), anchor="w")
        lbl_stock.grid(row=4, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_stock = ctk.CTkEntry(frame, placeholder_text="Ej: 10")
        self.txt_stock.grid(row=5, column=1, padx=15, pady=(0, 10), sticky="ew")

        lbl_costo = ctk.CTkLabel(frame, text="Precio Costo ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_costo.grid(row=6, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_costo = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_costo.grid(row=7, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_venta = ctk.CTkLabel(frame, text="Precio Venta ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_venta.grid(row=6, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_venta = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_venta.grid(row=7, column=1, padx=15, pady=(0, 10), sticky="ew")

        btn_guardar = ctk.CTkButton(self.tab_carga, text="Guardar Prenda", font=("Arial", 13, "bold"), height=35, command=self.guardar_registro)
        btn_guardar.pack(pady=10)

        self.lbl_estado = ctk.CTkLabel(self.tab_carga, text="", font=("Arial", 12))
        self.lbl_estado.pack(pady=5)

    def setup_tab_carga_masiva(self):
        """Pestaña para cargar combinaciones de Talles x Colores rápidamente."""
        frame = ctk.CTkFrame(self.tab_carga_masiva)
        frame.pack(pady=10, padx=15, fill="both", expand=True)

        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)

        lbl_nombre = ctk.CTkLabel(frame, text="Nombre del Producto *", font=("Arial", 12, "bold"), anchor="w")
        lbl_nombre.grid(row=0, column=0, padx=15, pady=(10, 2), sticky="ew")
        self.txt_m_nombre = ctk.CTkEntry(frame, placeholder_text="Ej: Jean Wide Leg")
        self.txt_m_nombre.grid(row=1, column=0, padx=15, pady=(0, 8), sticky="ew")

        lbl_cat = ctk.CTkLabel(frame, text="Categoría *", font=("Arial", 12, "bold"), anchor="w")
        lbl_cat.grid(row=0, column=1, padx=15, pady=(10, 2), sticky="ew")
        self.txt_m_categoria = ctk.CTkEntry(frame, placeholder_text="Ej: Pantalones")
        self.txt_m_categoria.grid(row=1, column=1, padx=15, pady=(0, 8), sticky="ew")

        lbl_talles = ctk.CTkLabel(frame, text="Talles (separados por coma) *", font=("Arial", 12, "bold"), anchor="w")
        lbl_talles.grid(row=2, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_m_talles = ctk.CTkEntry(frame, placeholder_text="Ej: S, M, L, XL, XXL")
        self.txt_m_talles.grid(row=3, column=0, padx=15, pady=(0, 8), sticky="ew")

        lbl_colores = ctk.CTkLabel(frame, text="Colores (separados por coma) *", font=("Arial", 12, "bold"), anchor="w")
        lbl_colores.grid(row=2, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_m_colores = ctk.CTkEntry(frame, placeholder_text="Ej: Negro, Blanco, Azul, Beige")
        self.txt_m_colores.grid(row=3, column=1, padx=15, pady=(0, 8), sticky="ew")

        lbl_stock = ctk.CTkLabel(frame, text="Stock Inicial por Variante", font=("Arial", 12, "bold"), anchor="w")
        lbl_stock.grid(row=4, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_m_stock = ctk.CTkEntry(frame, placeholder_text="Ej: 5")
        self.txt_m_stock.insert(0, "0")
        self.txt_m_stock.grid(row=5, column=0, padx=15, pady=(0, 8), sticky="ew")

        lbl_costo = ctk.CTkLabel(frame, text="Precio Costo ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_costo.grid(row=4, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_m_costo = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_m_costo.grid(row=5, column=1, padx=15, pady=(0, 8), sticky="ew")

        lbl_venta = ctk.CTkLabel(frame, text="Precio Venta ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_venta.grid(row=6, column=0, columnspan=2, padx=15, pady=(5, 2), sticky="ew")
        self.txt_m_venta = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_m_venta.grid(row=7, column=0, columnspan=2, padx=15, pady=(0, 8), sticky="ew")

        btn_guardar_m = ctk.CTkButton(
            self.tab_carga_masiva, 
            text="⚡ Crear Combinaciones de Variantes", 
            font=("Arial", 13, "bold"), 
            height=35, 
            fg_color="#3B82F6",
            hover_color="#2563EB",
            command=self.guardar_registro_masivo
        )
        btn_guardar_m.pack(pady=10)

        self.lbl_estado_masivo = ctk.CTkLabel(self.tab_carga_masiva, text="", font=("Arial", 12))
        self.lbl_estado_masivo.pack(pady=5)

    def guardar_registro(self):
        try:
            nombre = self.txt_nombre.get().strip()
            cat = self.txt_categoria.get().strip()
            costo = float(self.txt_costo.get().strip() or 0)
            venta = float(self.txt_venta.get().strip() or 0)
            talle = self.txt_talle.get().strip()
            color = self.txt_color.get().strip()
            stock = int(self.txt_stock.get().strip() or 0)

            if not (nombre and cat and talle and color):
                self.lbl_estado.configure(text="Completá los campos obligatorios.", text_color="red")
                return

            sku = agregar_producto_con_variante(nombre, cat, costo, venta, talle, color, stock)
            self.lbl_estado.configure(text=f"Guardado exitoso! Código: {sku}", text_color="#10B981")
            self.limpiar_formulario()
            self.actualizar_inventario()

        except ValueError:
            self.lbl_estado.configure(text="Costo, Venta y Stock deben ser numéricos.", text_color="red")

    def guardar_registro_masivo(self):
        try:
            nombre = self.txt_m_nombre.get().strip()
            cat = self.txt_m_categoria.get().strip()
            str_talles = self.txt_m_talles.get().strip()
            str_colores = self.txt_m_colores.get().strip()

            costo = float(self.txt_m_costo.get().strip() or 0)
            venta = float(self.txt_m_venta.get().strip() or 0)
            stock = int(self.txt_m_stock.get().strip() or 0)

            if not (nombre and cat and str_talles and str_colores):
                self.lbl_estado_masivo.configure(text="Completá todos los campos.", text_color="red")
                return

            list_talles = [t.strip() for t in str_talles.split(",") if t.strip()]
            list_colores = [c.strip() for c in str_colores.split(",") if c.strip()]

            total_creadas = agregar_producto_con_matriz_variantes(
                nombre, cat, costo, venta, list_talles, list_colores, stock
            )

            self.lbl_estado_masivo.configure(
                text=f"¡Éxito! Se crearon {total_creadas} variantes automáticamente.", 
                text_color="#10B981"
            )
            self.actualizar_inventario()

        except ValueError:
            self.lbl_estado_masivo.configure(text="Costo, Venta y Stock deben ser números.", text_color="red")

    def limpiar_formulario(self):
        self.txt_nombre.delete(0, 'end')
        self.txt_categoria.delete(0, 'end')
        self.txt_costo.delete(0, 'end')
        self.txt_venta.delete(0, 'end')
        self.txt_talle.delete(0, 'end')
        self.txt_color.delete(0, 'end')
        self.txt_stock.delete(0, 'end')

    def cambiar_orden(self, columna):
        if self.columna_orden == columna:
            self.direccion_orden = "DESC" if self.direccion_orden == "ASC" else "ASC"
        else:
            self.columna_orden = columna
            self.direccion_orden = "ASC"

        self.actualizar_inventario()

    def actualizar_inventario(self):
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        filtro = self.txt_buscar.get().strip() if hasattr(self, 'txt_buscar') else ""
        registros = obtener_variantes_stock(self.columna_orden, self.direccion_orden, filtro)

        if not registros:
            lbl_vacio = ctk.CTkLabel(self.scroll_frame, text="No se encontraron prendas que coincidan.")
            lbl_vacio.pack(pady=20)
            return

        self.scroll_frame.grid_columnconfigure(0, weight=2)
        self.scroll_frame.grid_columnconfigure(1, weight=1)
        self.scroll_frame.grid_columnconfigure(2, weight=1)
        self.scroll_frame.grid_columnconfigure(3, weight=1)
        self.scroll_frame.grid_columnconfigure(4, weight=1)
        self.scroll_frame.grid_columnconfigure(5, weight=1)

        encabezados = [
            ("Producto", "producto"),
            ("Talle", "talle"),
            ("Color", "color"),
            ("Precio Venta", "precio"),
            ("Stock", "stock")
        ]

        for col_idx, (texto, clave_col) in enumerate(encabezados):
            flecha = ""
            if self.columna_orden == clave_col:
                flecha = " ▲" if self.direccion_orden == "ASC" else " ▼"

            btn_encabezado = ctk.CTkButton(
                self.scroll_frame,
                text=f"{texto}{flecha}",
                font=("Arial", 12, "bold"),
                fg_color="transparent",
                hover_color="#2a2d2e",
                text_color="#3b82f6",
                anchor="w" if col_idx == 0 else "center",
                command=lambda c=clave_col: self.cambiar_orden(c)
            )
            btn_encabezado.grid(row=0, column=col_idx, padx=2, pady=5, sticky="ew")

        lbl_acciones = ctk.CTkLabel(self.scroll_frame, text="Acciones", font=("Arial", 12, "bold"))
        lbl_acciones.grid(row=0, column=5, padx=5, pady=5)

        for row_idx, item in enumerate(registros, start=1):
            var_id, nombre, cat, talle, color, costo, venta, stock, prod_id = item

            color_texto = "#ff5555" if stock <= 2 else "#ffffff"

            ctk.CTkLabel(self.scroll_frame, text=f"{nombre} ({cat})", text_color=color_texto, anchor="w").grid(row=row_idx, column=0, padx=5, pady=2, sticky="ew")
            ctk.CTkLabel(self.scroll_frame, text=talle, text_color=color_texto).grid(row=row_idx, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=color, text_color=color_texto).grid(row=row_idx, column=2, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=f"${venta:.2f}", text_color=color_texto).grid(row=row_idx, column=3, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=str(stock), text_color=color_texto).grid(row=row_idx, column=4, padx=5, pady=2)

            frame_acciones = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
            frame_acciones.grid(row=row_idx, column=5, padx=5, pady=2)

            btn_edit = ctk.CTkButton(
                frame_acciones, 
                text="✏️", 
                width=30, 
                fg_color="#3b82f6", 
                command=lambda v_id=var_id, t=talle, c=color, s=stock, co=costo, ve=venta: self.abrir_editar(v_id, t, c, s, co, ve)
            )
            btn_edit.pack(side="left", padx=2)

            btn_del = ctk.CTkButton(
                frame_acciones, 
                text="🗑️", 
                width=30, 
                fg_color="#ef4444", 
                command=lambda v_id=var_id: self.borrar_registro(v_id)
            )
            btn_del.pack(side="left", padx=2)

    def abrir_editar(self, var_id, talle, color, stock, costo, venta):
        if self.ventana_editar is None or not self.ventana_editar.winfo_exists():
            self.ventana_editar = VentanaEditar(self, var_id, talle, color, stock, costo, venta, self.actualizar_inventario)
        else:
            self.ventana_editar.focus()

    def borrar_registro(self, var_id):
        eliminar_variante(var_id)
        self.actualizar_inventario()

    # -------------------------------------------------------------
    # VISTA 6: REPORTES Y ESTADÍSTICAS
    # -------------------------------------------------------------
    def setup_vista_reportes(self):
        lbl_titulo = ctk.CTkLabel(self.view_reportes, text="Módulo de Reportes", font=("Arial", 20, "bold"))
        lbl_titulo.pack(anchor="w", pady=(0, 10))

        frame_filtros = ctk.CTkFrame(self.view_reportes)
        frame_filtros.pack(fill="x", pady=(0, 10))

        lbl_filtro = ctk.CTkLabel(frame_filtros, text="Período:", font=("Arial", 12, "bold"))
        lbl_filtro.pack(side="left", padx=(15, 5), pady=10)

        self.seg_periodo = ctk.CTkSegmentedButton(
            frame_filtros, 
            values=["Hoy", "7 Días", "Este Mes", "Histórico"],
            command=self.al_cambiar_periodo
        )
        self.seg_periodo.set("Hoy")
        self.seg_periodo.pack(side="left", padx=10, pady=10)

        frame_cards = ctk.CTkFrame(self.view_reportes, fg_color="transparent")
        frame_cards.pack(fill="x", pady=5)
        frame_cards.columnconfigure((0, 1, 2, 3), weight=1)

        card1 = ctk.CTkFrame(frame_cards)
        card1.grid(row=0, column=0, padx=5, sticky="ew")
        ctk.CTkLabel(card1, text="Total Facturado", font=("Arial", 11)).pack(pady=(10, 2))
        self.lbl_card_total = ctk.CTkLabel(card1, text="$0.00", font=("Arial", 16, "bold"), text_color="#3B82F6")
        self.lbl_card_total.pack(pady=(0, 10))

        card2 = ctk.CTkFrame(frame_cards)
        card2.grid(row=0, column=1, padx=5, sticky="ew")
        ctk.CTkLabel(card2, text="Ganancia Estimada", font=("Arial", 11)).pack(pady=(10, 2))
        self.lbl_card_ganancia = ctk.CTkLabel(card2, text="$0.00", font=("Arial", 16, "bold"), text_color="#10B981")
        self.lbl_card_ganancia.pack(pady=(0, 10))

        card3 = ctk.CTkFrame(frame_cards)
        card3.grid(row=0, column=2, padx=5, sticky="ew")
        ctk.CTkLabel(card3, text="Unidades Vendidas", font=("Arial", 11)).pack(pady=(10, 2))
        self.lbl_card_unidades = ctk.CTkLabel(card3, text="0", font=("Arial", 16, "bold"), text_color="#F59E0B")
        self.lbl_card_unidades.pack(pady=(0, 10))

        card4 = ctk.CTkFrame(frame_cards)
        card4.grid(row=0, column=3, padx=5, sticky="ew")
        ctk.CTkLabel(card4, text="Operaciones", font=("Arial", 11)).pack(pady=(10, 2))
        self.lbl_card_ops = ctk.CTkLabel(card4, text="0", font=("Arial", 16, "bold"), text_color="#EC4899")
        self.lbl_card_ops.pack(pady=(0, 10))

        self.scroll_ventas = ctk.CTkScrollableFrame(self.view_reportes, label_text="Historial Detallado de Ventas")
        self.scroll_ventas.pack(fill="both", expand=True, pady=10)

    def al_cambiar_periodo(self, valor):
        self.actualizar_reportes()

    def actualizar_reportes(self):
        opcion = self.seg_periodo.get()
        mapeo = {
            "Hoy": "hoy",
            "7 Días": "7dias",
            "Este Mes": "mes",
            "Histórico": "todo"
        }
        periodo_sql = mapeo.get(opcion, "hoy")

        metricas, ventas = obtener_reporte_ventas(periodo_sql)

        self.lbl_card_total.configure(text=f"${metricas['total_facturado']:,.2f}")
        self.lbl_card_ganancia.configure(text=f"${metricas['ganancia_estimada']:,.2f}")
        self.lbl_card_unidades.configure(text=str(metricas['unidades_vendidas']))
        self.lbl_card_ops.configure(text=str(metricas['operaciones']))

        for widget in self.scroll_ventas.winfo_children():
            widget.destroy()

        if not ventas:
            lbl_vacio = ctk.CTkLabel(self.scroll_ventas, text="No se registraron ventas en este período.")
            lbl_vacio.pack(pady=20)
            return

        self.scroll_ventas.grid_columnconfigure((0, 1, 2, 3, 4, 5), weight=1)

        encabezados = ["Fecha / Hora", "Producto", "Variante", "Cant.", "Método Pago", "Total"]
        for col_idx, texto in enumerate(encabezados):
            lbl_enc = ctk.CTkLabel(self.scroll_ventas, text=texto, font=("Arial", 11, "bold"), text_color="#3B82F6")
            lbl_enc.grid(row=0, column=col_idx, padx=5, pady=5)

        for row_idx, item in enumerate(ventas, start=1):
            v_id, fecha, nombre, talle, color, cant, p_unit, total, pago, costo = item
            fecha_str = str(fecha)[:16] if fecha else "-"

            ctk.CTkLabel(self.scroll_ventas, text=fecha_str, font=("Arial", 11)).grid(row=row_idx, column=0, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_ventas, text=nombre, font=("Arial", 11)).grid(row=row_idx, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_ventas, text=f"{talle} / {color}", font=("Arial", 11)).grid(row=row_idx, column=2, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_ventas, text=str(cant), font=("Arial", 11)).grid(row=row_idx, column=3, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_ventas, text=pago, font=("Arial", 11)).grid(row=row_idx, column=4, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_ventas, text=f"${total:,.2f}", font=("Arial", 11, "bold"), text_color="#10B981").grid(row=row_idx, column=5, padx=5, pady=2)


if __name__ == "__main__":
    app = AppStock()
    app.mainloop()