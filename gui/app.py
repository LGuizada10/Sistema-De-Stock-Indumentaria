import customtkinter as ctk
import sys
import os

# Permitir la importación del módulo database desde la carpeta raíz
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.conexion import inicializar_bd, agregar_producto_con_variante, obtener_variantes_stock

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class AppStock(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Sistema de Stock - Ropa Masculina")
        self.geometry("700x650")

        # Asegurar que las tablas de la BD existan
        inicializar_bd()

        # Configuración de Pestañas
        self.tabview = ctk.CTkTabview(self)
        self.tabview.pack(padx=10, pady=10, fill="both", expand=True)

        self.tab_carga = self.tabview.add("Cargar Prenda")
        self.tab_inventario = self.tabview.add("Ver Inventario")

        self.setup_tab_carga()
        self.setup_tab_inventario()

    # --- PESTAÑA 1: FORMULARIO DE CARGA ---
    def setup_tab_carga(self):
        frame = ctk.CTkFrame(self.tab_carga)
        frame.pack(pady=10, padx=20, fill="both", expand=True)

        self.txt_nombre = ctk.CTkEntry(frame, placeholder_text="Nombre de prenda (Ej: Remera Oversize)")
        self.txt_nombre.pack(pady=8, padx=15, fill="x")

        self.txt_categoria = ctk.CTkEntry(frame, placeholder_text="Categoría (Ej: Remeras, Pantalones)")
        self.txt_categoria.pack(pady=8, padx=15, fill="x")

        self.txt_costo = ctk.CTkEntry(frame, placeholder_text="Precio Costo ($)")
        self.txt_costo.pack(pady=8, padx=15, fill="x")

        self.txt_venta = ctk.CTkEntry(frame, placeholder_text="Precio Venta ($)")
        self.txt_venta.pack(pady=8, padx=15, fill="x")

        self.txt_talle = ctk.CTkEntry(frame, placeholder_text="Talle (Ej: M, L, 42)")
        self.txt_talle.pack(pady=8, padx=15, fill="x")

        self.txt_color = ctk.CTkEntry(frame, placeholder_text="Color (Ej: Negro, Azul)")
        self.txt_color.pack(pady=8, padx=15, fill="x")

        self.txt_stock = ctk.CTkEntry(frame, placeholder_text="Stock Inicial")
        self.txt_stock.pack(pady=8, padx=15, fill="x")

        btn_guardar = ctk.CTkButton(self.tab_carga, text="Guardar Prenda", command=self.guardar_registro)
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
            self.lbl_estado.configure(text=f"Guardado exitoso! SKU: {sku}", text_color="green")
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

    # --- PESTAÑA 2: LISTA DE INVENTARIO ---
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

        for item in registros:
            sku, nombre, cat, talle, color, precio, stock = item
            texto_item = f"SKU: {sku} | {nombre} ({cat}) - Talle: {talle} | Color: {color} | ${precio:.2f} | Stock: {stock}"
            color_texto = "#ff5555" if stock <= 2 else "#ffffff"

            lbl_row = ctk.CTkLabel(
                self.scroll_frame, 
                text=texto_item, 
                anchor="w", 
                text_color=color_texto,
                font=("Consolas", 12)
            )
            lbl_row.pack(fill="x", padx=10, pady=4)

if __name__ == "__main__":
    app = AppStock()
    app.mainloop()