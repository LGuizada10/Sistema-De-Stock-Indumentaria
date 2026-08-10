import sqlite3
import os

# Ruta para guardar la base de datos en el directorio del proyecto
DB_NAME = os.path.join(os.path.dirname(__file__), "inventario.db")

def obtener_conexion():
    """Establece y retorna la conexión con la base de datos SQLite."""
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def inicializar_bd():
    """Crea las tablas necesarias en la base de datos si no existen."""
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Tabla Productos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            precio_costo REAL DEFAULT 0.0,
            precio_venta REAL DEFAULT 0.0
        )
    ''')

    # Tabla Variantes (Talle, Color, Stock)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS variantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            talle TEXT NOT NULL,
            color TEXT NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
        )
    ''')

    # Tabla Ventas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variante_id INTEGER,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            total REAL NOT NULL,
            metodo_pago TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (variante_id) REFERENCES variantes(id)
        )
    ''')

    conn.commit()
    conn.close()

def obtener_variantes_stock(columna_orden="producto", direccion="ASC"):
    """
    Retorna la lista de todas las variantes registradas unidas con sus productos base.
    Soporta ordenamiento según el parámetro enviado.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Detectar el nombre de la columna de stock en la tabla variantes
    cursor.execute("PRAGMA table_info(variantes)")
    columnas = [col[1] for col in cursor.fetchall()]
    col_stock = "stock" if "stock" in columnas else "cantidad"

    # Mapeo de columnas válidas para evitar inyecciones SQL
    columnas_validas = {
        "producto": "p.nombre",
        "talle": "v.talle",
        "color": "v.color",
        "precio": "p.precio_venta",
        "stock": f"v.{col_stock}"
    }

    campo_sql = columnas_validas.get(columna_orden, "p.nombre")
    dir_sql = "DESC" if direccion.upper() == "DESC" else "ASC"

    query = f'''
        SELECT v.id, p.nombre, p.categoria, v.talle, v.color, p.precio_venta, v.{col_stock}
        FROM variantes v
        JOIN productos p ON v.producto_id = p.id
        ORDER BY {campo_sql} {dir_sql}
    '''

    cursor.execute(query)
    registros = cursor.fetchall()
    conn.close()
    return registros

def actualizar_variante(var_id, talle, color, stock):
    """Actualiza los datos (talle, color, stock) de una variante existente."""
    conn = obtener_conexion()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            UPDATE variantes
            SET talle = ?, color = ?, stock = ?
            WHERE id = ?
        ''', (talle, color, stock, var_id))
    except sqlite3.OperationalError:
        cursor.execute('''
            UPDATE variantes
            SET talle = ?, color = ?, cantidad = ?
            WHERE id = ?
        ''', (talle, color, stock, var_id))

    conn.commit()
    conn.close()

def eliminar_variante(var_id):
    """Elimina una variante según su ID."""
    conn = obtener_conexion()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM variantes WHERE id = ?", (var_id,))

    conn.commit()
    conn.close()

def registrar_venta_carrito(items_carrito, metodo_pago="Efectivo"):
    """
    Procesa un carrito completo de compras.
    items_carrito es una lista de diccionarios:
    [{ "variante_id": int, "cantidad": int, "precio_unitario": float }, ...]
    """
    if not items_carrito:
        raise ValueError("El carrito está vacío.")

    conn = obtener_conexion()
    cursor = conn.cursor()

    # Asegurar que exista la tabla ventas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variante_id INTEGER,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            total REAL NOT NULL,
            metodo_pago TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (variante_id) REFERENCES variantes(id)
        )
    ''')

    total_general = 0.0

    try:
        # Verificar stock de todos los ítems antes de proceder
        for item in items_carrito:
            v_id = item["variante_id"]
            cant = item["cantidad"]

            # Intentar descontar stock
            try:
                cursor.execute('''
                    UPDATE variantes
                    SET stock = stock - ?
                    WHERE id = ? AND stock >= ?
                ''', (cant, v_id, cant))
            except sqlite3.OperationalError:
                cursor.execute('''
                    UPDATE variantes
                    SET cantidad = cantidad - ?
                    WHERE id = ? AND cantidad >= ?
                ''', (cant, v_id, cant))

            if cursor.rowcount == 0:
                raise ValueError(f"Stock insuficiente para uno de los productos seleccionados.")

            subtotal = cant * item["precio_unitario"]
            total_general += subtotal

            # Registrar cada línea de venta
            cursor.execute('''
                INSERT INTO ventas (variante_id, cantidad, precio_unitario, total, metodo_pago)
                VALUES (?, ?, ?, ?, ?)
            ''', (v_id, cant, item["precio_unitario"], subtotal, metodo_pago))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

    conn.close()
    return total_general

def obtener_resumen_ventas_hoy():
    """
    Retorna el monto total vendido hoy y la cantidad de ventas del día.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            variante_id INTEGER,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            total REAL NOT NULL,
            metodo_pago TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (variante_id) REFERENCES variantes(id)
        )
    ''')

    cursor.execute('''
        SELECT SUM(total), COUNT(id)
        FROM ventas
        WHERE date(fecha) = date('now')
    ''')

    row = cursor.fetchone()
    conn.close()

    total_hoy = row[0] if row[0] else 0.0
    cantidad_ventas = row[1] if row[1] else 0
    return total_hoy, cantidad_ventas
# --- AGREGAR AL FINAL DE database/conexion.py ---

def obtener_reporte_ventas(periodo="hoy"):
    """
    Retorna métricas consolidadas (Total Vendido, Ganancia, Unidades, Cantidad Operaciones)
    y la lista detallada de ventas según el filtro de tiempo.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Filtro de fecha en SQL
    filtro_fecha = ""
    if periodo == "hoy":
        filtro_fecha = "WHERE date(v.fecha) = date('now')"
    elif periodo == "7dias":
        filtro_fecha = "WHERE date(v.fecha) >= date('now', '-7 days')"
    elif periodo == "mes":
        filtro_fecha = "WHERE strftime('%Y-%m', v.fecha) = strftime('%Y-%m', 'now')"
    elif periodo == "todo":
        filtro_fecha = ""

    # Consulta de detalle de ventas con costo de producto para calcular ganancias
    query_detalle = f'''
        SELECT 
            v.id,
            v.fecha,
            p.nombre,
            var.talle,
            var.color,
            v.cantidad,
            v.precio_unitario,
            v.total,
            v.metodo_pago,
            p.precio_costo
        FROM ventas v
        JOIN variantes var ON v.variante_id = var.id
        JOIN productos p ON var.producto_id = p.id
        {filtro_fecha}
        ORDER BY v.fecha DESC
    '''

    cursor.execute(query_detalle)
    ventas = cursor.fetchall()
    conn.close()

    # Cálculo de métricas
    total_facturado = sum(item[7] for item in ventas) if ventas else 0.0
    total_unidades = sum(item[5] for item in ventas) if ventas else 0
    cantidad_ops = len(ventas)
    
    # Ganancia = Total Vendido - (Cantidad * Precio de Costo)
    total_costos = sum(item[5] * item[9] for item in ventas) if ventas else 0.0
    ganancia_estimada = total_facturado - total_costos

    metricas = {
        "total_facturado": total_facturado,
        "ganancia_estimada": ganancia_estimada,
        "unidades_vendidas": total_unidades,
        "operaciones": cantidad_ops
    }

    return metricas, ventas



def crear_tablas_caja():
    conn = obtener_conexion()
    cursor = conn.cursor()
    
    # Tabla para las sesiones de caja (Apertura y Cierre)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cajas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_cierre DATETIME,
            monto_inicial REAL NOT NULL,
            monto_final_teorico REAL,
            monto_final_real REAL,
            diferencia REAL,
            estado TEXT NOT NULL DEFAULT 'ABIERTA',
            observaciones TEXT
        )
    ''')

    # Tabla para movimientos manuales de caja (ingresos/egresos varios)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caja_id INTEGER NOT NULL,
            tipo TEXT NOT NULL, -- 'INGRESO' o 'EGRESO'
            monto REAL NOT NULL,
            concepto TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (caja_id) REFERENCES cajas(id)
        )
    ''')
    
    conn.commit()
    conn.close()


def obtener_caja_abierta():
    """Devuelve la caja que actualmente está abierta, o None si no hay ninguna."""
    crear_tablas_caja()
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT id, fecha_apertura, monto_inicial FROM cajas WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1")
    caja = cursor.fetchone()
    conn.close()
    return caja  # (id, fecha_apertura, monto_inicial)


def abrir_caja(monto_inicial):
    caja_actual = obtener_caja_abierta()
    if caja_actual:
        raise ValueError("Ya existe una caja abierta. Debe cerrarla antes de abrir una nueva.")

    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO cajas (monto_inicial, estado) VALUES (?, 'ABIERTA')", (monto_inicial,))
    caja_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return caja_id


def registrar_movimiento_caja(caja_id, tipo, monto, concepto):
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto)
        VALUES (?, ?, ?, ?)
    ''', (caja_id, tipo, monto, concepto))
    conn.commit()
    conn.close()


def obtener_resumen_caja_actual():
    caja = obtener_caja_abierta()
    if not caja:
        return None

    caja_id, fecha_apertura, monto_inicial = caja

    conn = obtener_conexion()
    cursor = conn.cursor()

    # Ventas por método de pago desde la apertura
    cursor.execute('''
        SELECT metodo_pago, SUM(total) 
        FROM ventas 
        WHERE fecha >= ? 
        GROUP BY metodo_pago
    ''', (fecha_apertura,))
    ventas_pago = dict(cursor.fetchall())

    ventas_efectivo = ventas_pago.get('Efectivo', 0.0)
    ventas_digitales = sum(monto for mp, monto in ventas_pago.items() if mp != 'Efectivo')

    # Movimientos de caja (Ingresos / Egresos)
    cursor.execute('''
        SELECT tipo, SUM(monto) 
        FROM movimientos_caja 
        WHERE caja_id = ? 
        GROUP BY tipo
    ''', (caja_id,))
    movs = dict(cursor.fetchall())

    ingresos_extra = movs.get('INGRESO', 0.0)
    egresos_extra = movs.get('EGRESO', 0.0)

    # Cálculo del total esperado en EFECTIVO en la caja física
    efectivo_esperado = monto_inicial + ventas_efectivo + ingresos_extra - egresos_extra
    total_recaudado_general = ventas_efectivo + ventas_digitales

    conn.close()

    return {
        "caja_id": caja_id,
        "fecha_apertura": fecha_apertura,
        "monto_inicial": monto_inicial,
        "ventas_efectivo": ventas_efectivo,
        "ventas_digitales": ventas_digitales,
        "ingresos_extra": ingresos_extra,
        "egresos_extra": egresos_extra,
        "efectivo_esperado": efectivo_esperado,
        "total_recaudado": total_recaudado_general
    }


def cerrar_caja(caja_id, monto_real_efectivo, observaciones=""):
    resumen = obtener_resumen_caja_actual()
    if not resumen or resumen["caja_id"] != caja_id:
        raise ValueError("Error al identificar la caja activa.")

    efectivo_esperado = resumen["efectivo_esperado"]
    diferencia = monto_real_efectivo - efectivo_esperado

    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cajas
        SET fecha_cierre = CURRENT_TIMESTAMP,
            monto_final_teorico = ?,
            monto_final_real = ?,
            diferencia = ?,
            estado = 'CERRADA',
            observaciones = ?
        WHERE id = ?
    ''', (efectivo_esperado, monto_real_efectivo, diferencia, observaciones, caja_id))

    conn.commit()
    conn.close()
    return diferencia
def obtener_variantes_stock(columna_orden="producto", direccion_orden="ASC", filtro_texto=""):
    """
    Obtiene las variantes registradas con opción de filtrado por texto y ordenamiento.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    mapeo_columnas = {
        "producto": "p.nombre",
        "talle": "v.talle",
        "color": "v.color",
        "precio": "p.precio_venta",
        "stock": "v.stock"
    }
    col_sql = mapeo_columnas.get(columna_orden, "p.nombre")
    dir_sql = "DESC" if direccion_orden.upper() == "DESC" else "ASC"

    query = f'''
        SELECT 
            v.id, 
            p.nombre, 
            p.categoria, 
            v.talle, 
            v.color, 
            p.precio_costo,
            p.precio_venta, 
            v.stock,
            p.id as producto_id
        FROM variantes v
        JOIN productos p ON v.producto_id = p.id
        WHERE p.nombre LIKE ? OR p.categoria LIKE ? OR v.talle LIKE ? OR v.color LIKE ?
        ORDER BY {col_sql} {dir_sql}
    '''
    
    patron = f"%{filtro_texto}%"
    cursor.execute(query, (patron, patron, patron, patron))
    registros = cursor.fetchall()
    conn.close()
    return registros


def actualizar_variante_y_precios(var_id, talle, color, stock, costo, venta):
    """
    Actualiza el talle, color y stock de la variante, así como los precios en el producto padre.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Obtener el producto_id asociado a la variante
    cursor.execute("SELECT producto_id FROM variantes WHERE id = ?", (var_id,))
    res = cursor.fetchone()
    if not res:
        conn.close()
        raise ValueError("Variante no encontrada.")

    producto_id = res[0]

    # Actualizar la variante
    cursor.execute('''
        UPDATE variantes
        SET talle = ?, color = ?, stock = ?
        WHERE id = ?
    ''', (talle, color, stock, var_id))

    # Actualizar los precios del producto
    cursor.execute('''
        UPDATE productos
        SET precio_costo = ?, precio_venta = ?
        WHERE id = ?
    ''', (costo, venta, producto_id))

    conn.commit()
    conn.close()


def agregar_producto_con_matriz_variantes(nombre, categoria, costo, venta, lista_talles, lista_colores, stock_inicial):
    """
    Crea un producto e inserta automáticamente todas las combinaciones posibles de talles y colores.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    sku_base = f"{nombre[:3].upper()}-{categoria[:3].upper()}"

    cursor.execute('''
        INSERT INTO productos (nombre, categoria, precio_costo, precio_venta)
        VALUES (?, ?, ?, ?)
    ''', (nombre, categoria, costo, venta))

    producto_id = cursor.lastrowid

    # Insertar la combinación cartesiana de Talles x Colores
    combinaciones = 0
    for talle in lista_talles:
        for color in lista_colores:
            if talle.strip() and color.strip():
                cursor.execute('''
                    INSERT INTO variantes (producto_id, talle, color, stock)
                    VALUES (?, ?, ?, ?)
                ''', (producto_id, talle.strip(), color.strip(), stock_inicial))
                combinaciones += 1

    conn.commit()
    conn.close()
    return combinaciones

def agregar_producto_con_variante(nombre, categoria, costo, venta, talle, color, stock):
    """
    Crea un producto indivdual y su correspondiente variante de talle/color.
    """
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Insertar el producto base
    cursor.execute('''
        INSERT INTO productos (nombre, categoria, precio_costo, precio_venta)
        VALUES (?, ?, ?, ?)
    ''', (nombre, categoria, costo, venta))

    producto_id = cursor.lastrowid

    # Insertar la variante
    cursor.execute('''
        INSERT INTO variantes (producto_id, talle, color, stock)
        VALUES (?, ?, ?, ?)
    ''', (producto_id, talle, color, stock))

    conn.commit()
    conn.close()
    return producto_id