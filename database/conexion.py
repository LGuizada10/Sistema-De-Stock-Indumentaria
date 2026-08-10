import sqlite3
import os

# Ruta donde se generará la base de datos local
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "stock.db")

def obtener_conexion():
    # Conectar (abre o crea el archivo)
    conexion = sqlite3.connect(DB_PATH)
    conexion.execute("PRAGMA foreign_keys = ON;")
    return conexion

def inicializar_bd():
    """Crea las tablas iniciales de productos y variantes si no existen."""
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        
        # Tabla principal o tabla generica de la indumentaria
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            precio_costo REAL DEFAULT 0,
            precio_venta REAL DEFAULT 0
        );
        """)
        
        # Tabla de variantes (Talle, Color y Stock físico)
        # El SKU es el "DNI" de esa combinación específica de modelo + talle + color.
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
    """Inserte un producto y crea su variante única de stock."""
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO productos (nombre, categoria, precio_costo, precio_venta) VALUES (?, ?, ?, ?)",
            (nombre, categoria, costo, venta)
        )
        prod_id = cursor.lastrowid
        
        # Generar un SKU básico tipo REM-NEGRO-M
        sku = f"{nombre[:3].upper()}-{color[:3].upper()}-{talle.upper()}"
        
        cursor.execute(
            "INSERT INTO variantes (producto_id, sku, talle, color, stock_actual) VALUES (?, ?, ?, ?, ?)",
            (prod_id, sku, talle.upper(), color.capitalize(), stock)
        )
        conn.commit()
        return sku
def obtener_variantes_stock():
    """Devuelve todas las variantes guardadas junto a los datos de su producto."""
    with obtener_conexion() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            v.sku,
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
if __name__ == "__main__":
    inicializar_bd()
    print("Base de datos creada e inicializada correctamente.")