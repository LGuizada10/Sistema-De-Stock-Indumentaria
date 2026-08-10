import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "stock.db")

def obtener_conexion():
    conexion = sqlite3.connect(DB_PATH)
    conexion.execute("PRAGMA foreign_keys = ON;")
    return conexion

def inicializar_bd():
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            precio_costo REAL DEFAULT 0,
            precio_venta REAL DEFAULT 0
        );
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS variantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            talle TEXT NOT NULL,
            color TEXT NOT NULL,
            stock_actual INTEGER DEFAULT 0,
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
        );
        """)
        conn.commit()

def agregar_producto_con_variante(nombre, categoria, costo, venta, talle, color, stock):
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        sku = f"{nombre[:3].upper()}-{color[:3].upper()}-{talle.upper()}"
        
        # 1. Buscamos si ya existe el SKU en la base de datos
        cursor.execute("SELECT id, stock_actual FROM variantes WHERE sku = ?", (sku,))
        variante_existente = cursor.fetchone()
        
        if variante_existente:
            # 2. Si existe, sumamos el stock nuevo al existente
            var_id, stock_actual = variante_existente
            nuevo_stock = stock_actual + stock
            cursor.execute("UPDATE variantes SET stock_actual = ? WHERE id = ?", (nuevo_stock, var_id))
            conn.commit()
            return f"{sku} (Stock actualizado: {nuevo_stock})"
        else:
            # 3. Si no existe, creamos el producto y la variante nueva
            cursor.execute(
                "INSERT INTO productos (nombre, categoria, precio_costo, precio_venta) VALUES (?, ?, ?, ?)",
                (nombre, categoria, costo, venta)
            )
            prod_id = cursor.lastrowid
            
            cursor.execute(
                "INSERT INTO variantes (producto_id, sku, talle, color, stock_actual) VALUES (?, ?, ?, ?, ?)",
                (prod_id, sku, talle.upper(), color.capitalize(), stock)
            )
            conn.commit()
            return sku

def obtener_variantes_stock():
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            v.id,
            p.nombre,
            p.categoria,
            v.talle,
            v.color,
            p.precio_venta,
            v.stock_actual
        FROM variantes v
        JOIN productos p ON v.producto_id = p.id
        ORDER BY p.nombre ASC;
        """)
        return cursor.fetchall()

def eliminar_variante(variante_id):
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM variantes WHERE id = ?", (variante_id,))
        conn.commit()

def actualizar_variante(variante_id, talle, color, stock_actual):
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE variantes 
            SET talle = ?, color = ?, stock_actual = ? 
            WHERE id = ?
        """, (talle.upper(), color.capitalize(), stock_actual, variante_id))
        conn.commit()