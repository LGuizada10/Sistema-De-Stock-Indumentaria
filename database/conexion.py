import sqlite3
import os

DB_NAME = os.path.join(os.path.dirname(__file__), "inventario.db")

def obtener_conexion():
    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def inicializar_bd():
    conn = obtener_conexion()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            precio_costo REAL DEFAULT 0.0,
            precio_venta REAL DEFAULT 0.0
        )
    ''')

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

def obtener_categorias_unicas():
    """Devuelve la lista de categorías existentes registradas en la base de datos."""
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria ASC")
    filas = cursor.fetchall()
    conn.close()
    return [f[0] for f in filas]

def obtener_variantes_stock(columna_orden="producto", direccion_orden="ASC", filtro_texto=""):
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
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Formateo
    talle = talle.strip().upper()
    color = color.strip().title()

    try:
        cursor.execute("SELECT producto_id FROM variantes WHERE id = ?", (var_id,))
        res = cursor.fetchone()
        if not res:
            raise ValueError("Variante no encontrada.")

        producto_id = res[0]

        cursor.execute('''
            UPDATE variantes
            SET talle = ?, color = ?, stock = ?
            WHERE id = ?
        ''', (talle, color, stock, var_id))

        cursor.execute('''
            UPDATE productos
            SET precio_costo = ?, precio_venta = ?
            WHERE id = ?
        ''', (costo, venta, producto_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def eliminar_variante(var_id):
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM variantes WHERE id = ?", (var_id,))
    conn.commit()
    conn.close()

def agregar_producto_con_variante(nombre, categoria, costo, venta, talle, color, stock):
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Formateo de datos
    categoria = categoria.strip().title()
    talle = talle.strip().upper()
    color = color.strip().title()

    try:
        cursor.execute('''
            INSERT INTO productos (nombre, categoria, precio_costo, precio_venta)
            VALUES (?, ?, ?, ?)
        ''', (nombre, categoria, costo, venta))

        producto_id = cursor.lastrowid

        cursor.execute('''
            INSERT INTO variantes (producto_id, talle, color, stock)
            VALUES (?, ?, ?, ?)
        ''', (producto_id, talle, color, stock))

        conn.commit()
        return producto_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def agregar_producto_con_matriz_variantes(nombre, categoria, costo, venta, lista_talles, lista_colores, dict_stock):
    conn = obtener_conexion()
    cursor = conn.cursor()

    # Formateo de datos
    categoria = categoria.strip().title()

    try:
        cursor.execute('''
            INSERT INTO productos (nombre, categoria, precio_costo, precio_venta)
            VALUES (?, ?, ?, ?)
        ''', (nombre, categoria, costo, venta))

        producto_id = cursor.lastrowid

        datos_variantes = []
        for talle in lista_talles:
            for color in lista_colores:
                t_clean = talle.strip().upper()
                c_clean = color.strip().title()
                if t_clean and c_clean:
                    # Se busca la clave original o limpia
                    stock_variante = dict_stock.get((talle, color), dict_stock.get((t_clean, c_clean), 0))
                    datos_variantes.append((producto_id, t_clean, c_clean, stock_variante))

        if datos_variantes:
            cursor.executemany('''
                INSERT INTO variantes (producto_id, talle, color, stock)
                VALUES (?, ?, ?, ?)
            ''', datos_variantes)

        conn.commit()
        return len(datos_variantes)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def registrar_venta_carrito(items_carrito, metodo_pago="Efectivo"):
    if not items_carrito:
        raise ValueError("El carrito está vacío.")

    conn = obtener_conexion()
    cursor = conn.cursor()

    total_general = 0.0

    try:
        for item in items_carrito:
            v_id = item["variante_id"]
            cant = item["cantidad"]

            cursor.execute('''
                UPDATE variantes
                SET stock = stock - ?
                WHERE id = ? AND stock >= ?
            ''', (cant, v_id, cant))

            if cursor.rowcount == 0:
                raise ValueError("Stock insuficiente para uno de los productos seleccionados.")

            subtotal = cant * item["precio_unitario"]
            total_general += subtotal

            cursor.execute('''
                INSERT INTO ventas (variante_id, cantidad, precio_unitario, total, metodo_pago)
                VALUES (?, ?, ?, ?, ?)
            ''', (v_id, cant, item["precio_unitario"], subtotal, metodo_pago))

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return total_general

def obtener_resumen_ventas_hoy():
    conn = obtener_conexion()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT SUM(total), COUNT(id), SUM(cantidad)
        FROM ventas
        WHERE date(fecha) = date('now')
    ''')

    row = cursor.fetchone()
    conn.close()

    total_hoy = row[0] if row[0] else 0.0
    cantidad_ventas = row[1] if row[1] else 0
    unidades_vendidas = row[2] if row[2] else 0
    return total_hoy, cantidad_ventas, unidades_vendidas

def obtener_reporte_ventas(periodo="hoy"):
    conn = obtener_conexion()
    cursor = conn.cursor()

    filtro_fecha = ""
    if periodo == "hoy":
        filtro_fecha = "WHERE date(v.fecha) = date('now')"
    elif periodo == "7dias":
        filtro_fecha = "WHERE date(v.fecha) >= date('now', '-7 days')"
    elif periodo == "mes":
        filtro_fecha = "WHERE strftime('%Y-%m', v.fecha) = strftime('%Y-%m', 'now')"
    elif periodo == "todo":
        filtro_fecha = ""

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

    total_facturado = sum(item[7] for item in ventas) if ventas else 0.0
    total_unidades = sum(item[5] for item in ventas) if ventas else 0
    cantidad_ops = len(ventas)
    
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
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cajas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_cierre DATETIME,
            turno TEXT,
            monto_inicial REAL NOT NULL,
            monto_final_teorico REAL,
            monto_final_real REAL,
            diferencia REAL,
            estado TEXT NOT NULL DEFAULT 'ABIERTA',
            observaciones TEXT
        )
    ''')

    try:
        cursor.execute("ALTER TABLE cajas ADD COLUMN turno TEXT;")
    except sqlite3.OperationalError:
        pass

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caja_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            monto REAL NOT NULL,
            concepto TEXT NOT NULL,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (caja_id) REFERENCES cajas(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def obtener_caja_abierta():
    crear_tablas_caja()
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT id, fecha_apertura, monto_inicial FROM cajas WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1")
    caja = cursor.fetchone()
    conn.close()
    return caja

def abrir_caja(monto_inicial):
    caja_actual = obtener_caja_abierta()
    if caja_actual:
        raise ValueError("Ya existe una caja abierta.")

    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO cajas (monto_inicial, estado) VALUES (?, 'ABIERTA')", (monto_inicial,))
    caja_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return caja_id

def abrir_caja_turno(turno, cambio_inicial):
    if turno not in ["Mañana", "Tarde"]:
        raise ValueError("El turno debe ser Mañana o Tarde.")
        
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cajas (fecha_apertura, turno, monto_inicial, estado)
        VALUES (DATETIME('now', 'localtime'), ?, ?, 'ABIERTA')
    ''', (turno, cambio_inicial))
    conn.commit()
    conn.close()

def modificar_fondo_inicial(caja_id, nuevo_monto):
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE cajas
        SET monto_inicial = ?
        WHERE id = ? AND estado = 'ABIERTA'
    ''', (nuevo_monto, caja_id))
    conn.commit()
    conn.close()

def registrar_movimiento_caja(caja_id, tipo, monto, concepto):
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO movimientos_caja (caja_id, fecha, tipo, monto, concepto)
        VALUES (?, DATETIME('now', 'localtime'), ?, ?, ?)
    ''', (caja_id, tipo, monto, concepto))
    conn.commit()
    conn.close()

def obtener_resumen_caja_actual():
    crear_tablas_caja()
    conn = obtener_conexion()
    cursor = conn.cursor()
    cursor.execute("SELECT id, fecha_apertura, monto_inicial, turno FROM cajas WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1")
    caja = cursor.fetchone()
    
    if not caja:
        conn.close()
        return None

    caja_id, fecha_apertura, monto_inicial, turno = caja

    cursor.execute('''
        SELECT metodo_pago, SUM(total) 
        FROM ventas 
        WHERE datetime(fecha) >= datetime(?) 
        GROUP BY metodo_pago
    ''', (fecha_apertura,))
    ventas_pago = dict(cursor.fetchall())

    ventas_efectivo = ventas_pago.get('Efectivo', 0.0)

    cursor.execute('''
        SELECT tipo, SUM(monto) 
        FROM movimientos_caja 
        WHERE caja_id = ? 
        GROUP BY tipo
    ''', (caja_id,))
    movs = dict(cursor.fetchall())

    ingresos_extra = movs.get('INGRESO', 0.0)
    egresos_extra = movs.get('EGRESO', 0.0)

    efectivo_esperado = monto_inicial + ventas_efectivo + ingresos_extra - egresos_extra
    total_recaudado_general = ventas_efectivo 

    conn.close()

    return {
        "caja_id": caja_id,
        "fecha_apertura": fecha_apertura,
        "turno": turno,
        "monto_inicial": monto_inicial,
        "ventas_efectivo": ventas_efectivo,
        "ingresos_extra": ingresos_extra,
        "egresos_extra": egresos_extra,
        "efectivo_esperado": efectivo_esperado,
        "total_recaudado": total_recaudado_general
    }

def cerrar_caja(caja_id, monto_final_real, observaciones=""):
    conn = obtener_conexion()
    cursor = conn.cursor()
    
    resumen = obtener_resumen_caja_actual()
    diferencia = monto_final_real - resumen['efectivo_esperado']
    
    cursor.execute('''
        UPDATE cajas 
        SET fecha_cierre = DATETIME('now', 'localtime'),
            monto_final_real = ?,
            monto_final_teorico = ?,
            diferencia = ?,
            estado = 'CERRADA',
            observaciones = ?
        WHERE id = ?
    ''', (monto_final_real, resumen['efectivo_esperado'], diferencia, observaciones, caja_id))
    
    conn.commit()
    conn.close()
    return diferencia

def eliminar_o_renombrar_categoria(cat_origen, cat_destino=None):
    conn = obtener_conexion()
    conn.execute("PRAGMA busy_timeout = 5000")
    
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        
        with conn:
            cursor = conn.cursor()
            
            if cat_destino:
                cat_destino_clean = cat_destino.strip().title()
                cursor.execute(
                    "UPDATE productos SET categoria = ? WHERE categoria = ?", 
                    (cat_destino_clean, cat_origen)
                )
            else:
                cursor.execute("SELECT id FROM productos WHERE categoria = ?", (cat_origen,))
                ids_productos = [row[0] for row in cursor.fetchall()]
                
                if ids_productos:
                    placeholders = ','.join('?' for _ in ids_productos)
                    
                    tablas_posibles = ["ventas_detalle", "detalle_ventas", "movimientos_stock", "historial_stock"]
                    for tabla in tablas_posibles:
                        try:
                            cursor.execute(f"DELETE FROM {tabla} WHERE producto_id IN ({placeholders})", ids_productos)
                        except sqlite3.OperationalError:
                            pass
                    
                    cursor.execute("DELETE FROM productos WHERE categoria = ?", (cat_origen,))

    finally:
        try:
            conn.execute("PRAGMA foreign_keys = ON")
        except Exception:
            pass
        conn.close()