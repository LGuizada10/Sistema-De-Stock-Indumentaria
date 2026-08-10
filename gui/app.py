import customtkinter as ctk
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.conexion import (
    inicializar_bd, 
    agregar_producto_con_variante, 
    obtener_variantes_stock,
    eliminar_variante,
    actualizar_variante
)

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class VentanaEditar(ctk.CTkToplevel):
    def __init__(self, parent, var_id, talle_actual, color_actual, stock_actual, callback_actualizar):
        super().__init__(parent)
        self.title("Editar Prenda")
        self.geometry("300x250")
        self.var_id = var_id
        self.callback = callback_actualizar

        self.attributes("-topmost", True)

        ctk.CTkLabel(self, text="Editar Variante", font=("Arial", 14, "bold")).pack(pady=10)

        self.txt_talle = ctk.CTkEntry(self, placeholder_text="Talle")
        self.txt_talle.insert(0, talle_actual)
        self.txt_talle.pack(pady=5, padx=20, fill="x")

        self.txt_color = ctk.CTkEntry(self, placeholder_text="Color")
        self.txt_color.insert(0, color_actual)
        self.txt_color.pack(pady=5, padx=20, fill="x")

        self.txt_stock = ctk.CTkEntry(self, placeholder_text="Stock")
        self.txt_stock.insert(0, str(stock_actual))
        self.txt_stock.pack(pady=5, padx=20, fill="x")

        btn_guardar = ctk.CTkButton(self, text="Guardar Cambios", command=self.guardar)
        btn_guardar.pack(pady=15)

    def guardar(self):
        try:
            nuevo_talle = self.txt_talle.get().strip()
            nuevo_color = self.txt_color.get().strip()
            nuevo_stock = int(self.txt_stock.get().strip() or 0)

            actualizar_variante(self.var_id, nuevo_talle, nuevo_color, nuevo_stock)
            self.callback()
            self.destroy()
        except ValueError:
            pass


class AppStock(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Sistema de Stock - Ropa Masculina")
        self.geometry("850x650")

        # Guardará la referencia a la ventana para evitar duplicados
        self.ventana_editar = None

        inicializar_bd()

        self.tabview = ctk.CTkTabview(self)
        self.tabview.pack(padx=10, pady=10, fill="both", expand=True)

        self.tab_carga = self.tabview.add("Cargar Prenda")
        self.tab_inventario = self.tabview.add("Ver Inventario")

        self.setup_tab_carga()
        self.setup_tab_inventario()

    def setup_tab_carga(self):
        # Frame contenedor del formulario
        frame = ctk.CTkFrame(self.tab_carga)
        frame.pack(pady=15, padx=20, fill="both", expand=True)

        # Configurar 2 columnas centradas
        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)

        # 1. Nombre de Prenda (Ocupa las 2 columnas)
        lbl_nombre = ctk.CTkLabel(frame, text="Nombre de Prenda *", font=("Arial", 12, "bold"), anchor="w")
        lbl_nombre.grid(row=0, column=0, columnspan=2, padx=15, pady=(10, 2), sticky="ew")
        self.txt_nombre = ctk.CTkEntry(frame, placeholder_text="Ej: Remera Oversize Básica")
        self.txt_nombre.grid(row=1, column=0, columnspan=2, padx=15, pady=(0, 10), sticky="ew")

        # 2. Categoría y Talle
        lbl_cat = ctk.CTkLabel(frame, text="Categoría *", font=("Arial", 12, "bold"), anchor="w")
        lbl_cat.grid(row=2, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_categoria = ctk.CTkEntry(frame, placeholder_text="Ej: Remeras, Pantalones")
        self.txt_categoria.grid(row=3, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_talle = ctk.CTkLabel(frame, text="Talle *", font=("Arial", 12, "bold"), anchor="w")
        lbl_talle.grid(row=2, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_talle = ctk.CTkEntry(frame, placeholder_text="Ej: M, L, 42")
        self.txt_talle.grid(row=3, column=1, padx=15, pady=(0, 10), sticky="ew")

        # 3. Color y Stock Inicial
        lbl_color = ctk.CTkLabel(frame, text="Color *", font=("Arial", 12, "bold"), anchor="w")
        lbl_color.grid(row=4, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_color = ctk.CTkEntry(frame, placeholder_text="Ej: Negro, Azul")
        self.txt_color.grid(row=5, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_stock = ctk.CTkLabel(frame, text="Stock Inicial", font=("Arial", 12, "bold"), anchor="w")
        lbl_stock.grid(row=4, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_stock = ctk.CTkEntry(frame, placeholder_text="Ej: 10")
        self.txt_stock.grid(row=5, column=1, padx=15, pady=(0, 10), sticky="ew")

        # 4. Precio Costo y Precio Venta
        lbl_costo = ctk.CTkLabel(frame, text="Precio Costo ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_costo.grid(row=6, column=0, padx=15, pady=(5, 2), sticky="ew")
        self.txt_costo = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_costo.grid(row=7, column=0, padx=15, pady=(0, 10), sticky="ew")

        lbl_venta = ctk.CTkLabel(frame, text="Precio Venta ($)", font=("Arial", 12, "bold"), anchor="w")
        lbl_venta.grid(row=6, column=1, padx=15, pady=(5, 2), sticky="ew")
        self.txt_venta = ctk.CTkEntry(frame, placeholder_text="0.00")
        self.txt_venta.grid(row=7, column=1, padx=15, pady=(0, 10), sticky="ew")

        # Botón de guardado
        btn_guardar = ctk.CTkButton(self.tab_carga, text="Guardar Prenda", font=("Arial", 13, "bold"), height=35, command=self.guardar_registro)
        btn_guardar.pack(pady=10)

        self.lbl_estado = ctk.CTkLabel(self.tab_carga, text="", font=("Arial", 12))
        self.lbl_estado.pack(pady=5)
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
            self.lbl_estado.configure(text=f"Guardado exitoso! Código: {sku}", text_color="green")
            self.limpiar_formulario()
            self.actualizar_inventario()

        except ValueError:
            self.lbl_estado.configure(text="Costo, Venta y Stock deben ser numéricos.", text_color="red")

    def limpiar_formulario(self):
        self.txt_nombre.delete(0, 'end')
        self.txt_categoria.delete(0, 'end')
        self.txt_costo.delete(0, 'end')
        self.txt_venta.delete(0, 'end')
        self.txt_talle.delete(0, 'end')
        self.txt_color.delete(0, 'end')
        self.txt_stock.delete(0, 'end')

    def setup_tab_inventario(self):
        btn_refrescar = ctk.CTkButton(self.tab_inventario, text="Actualizar Lista", command=self.actualizar_inventario)
        btn_refrescar.pack(pady=10)

        self.scroll_frame = ctk.CTkScrollableFrame(self.tab_inventario, label_text="Inventario Disponible")
        self.scroll_frame.pack(padx=10, pady=5, fill="both", expand=True)

        self.actualizar_inventario()

    def actualizar_inventario(self):
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        registros = obtener_variantes_stock()

        if not registros:
            lbl_vacio = ctk.CTkLabel(self.scroll_frame, text="No hay prendas registradas.")
            lbl_vacio.pack(pady=20)
            return

        self.scroll_frame.grid_columnconfigure(0, weight=2)
        self.scroll_frame.grid_columnconfigure(1, weight=1)
        self.scroll_frame.grid_columnconfigure(2, weight=1)
        self.scroll_frame.grid_columnconfigure(3, weight=1)
        self.scroll_frame.grid_columnconfigure(4, weight=1)
        self.scroll_frame.grid_columnconfigure(5, weight=1)

        encabezados = ["Producto", "Talle", "Color", "Precio", "Stock", "Acciones"]
        for col_idx, texto in enumerate(encabezados):
            lbl = ctk.CTkLabel(self.scroll_frame, text=texto, font=("Arial", 12, "bold"))
            lbl.grid(row=0, column=col_idx, padx=5, pady=5, sticky="ew")

        for row_idx, item in enumerate(registros, start=1):
            var_id, nombre, cat, talle, color, precio, stock = item

            color_texto = "#ff5555" if stock <= 2 else "#ffffff"

            ctk.CTkLabel(self.scroll_frame, text=f"{nombre} ({cat})", text_color=color_texto, anchor="w").grid(row=row_idx, column=0, padx=5, pady=2, sticky="ew")
            ctk.CTkLabel(self.scroll_frame, text=talle, text_color=color_texto).grid(row=row_idx, column=1, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=color, text_color=color_texto).grid(row=row_idx, column=2, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=f"${precio:.2f}", text_color=color_texto).grid(row=row_idx, column=3, padx=5, pady=2)
            ctk.CTkLabel(self.scroll_frame, text=str(stock), text_color=color_texto).grid(row=row_idx, column=4, padx=5, pady=2)

            frame_acciones = ctk.CTkFrame(self.scroll_frame, fg_color="transparent")
            frame_acciones.grid(row=row_idx, column=5, padx=5, pady=2)

            btn_edit = ctk.CTkButton(
                frame_acciones, 
                text="✏️", 
                width=30, 
                fg_color="#3b82f6", 
                command=lambda v_id=var_id, t=talle, c=color, s=stock: self.abrir_editar(v_id, t, c, s)
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

    def abrir_editar(self, var_id, talle, color, stock):
        if self.ventana_editar is None or not self.ventana_editar.winfo_exists():
            self.ventana_editar = VentanaEditar(self, var_id, talle, color, stock, self.actualizar_inventario)
        else:
            self.ventana_editar.focus()

    def borrar_registro(self, var_id):
        eliminar_variante(var_id)
        self.actualizar_inventario()


if __name__ == "__main__":
    app = AppStock()
    app.mainloop()