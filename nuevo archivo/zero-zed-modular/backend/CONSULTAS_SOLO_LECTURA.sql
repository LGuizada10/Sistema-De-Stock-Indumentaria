-- ZERO ZED · CONSULTAS DE SOLO LECTURA
-- Este archivo contiene únicamente SELECT. No cambia datos ni estructura.
-- En Supabase: copiá y ejecutá UNA consulta por vez en SQL Editor.

-- 1) Conteo general de tablas del negocio
SELECT 'productos' AS tabla, count(*) AS filas FROM public.productos
UNION ALL SELECT 'variantes', count(*) FROM public.variantes
UNION ALL SELECT 'turnos', count(*) FROM public.turnos
UNION ALL SELECT 'ventas', count(*) FROM public.ventas
UNION ALL SELECT 'articulos vendidos', count(*) FROM public.venta_items
UNION ALL SELECT 'pagos', count(*) FROM public.venta_pagos
UNION ALL SELECT 'devoluciones', count(*) FROM public.devoluciones
UNION ALL SELECT 'compras', count(*) FROM public.compras
UNION ALL SELECT 'movimientos', count(*) FROM public.movimientos
UNION ALL SELECT 'promociones', count(*) FROM public.promociones
UNION ALL SELECT 'solicitudes de factura', count(*) FROM public.solicitudes_factura
ORDER BY tabla;

-- 2) Stock actual por producto
SELECT p.num, p.nombre, p.categoria, p.precio,
       coalesce(sum(v.stock), 0) AS unidades_en_stock,
       count(v.id) AS variantes
FROM public.productos p
LEFT JOIN public.variantes v ON v.producto_id = p.id
GROUP BY p.id
ORDER BY p.num NULLS LAST, p.nombre;

-- 3) Ventas por día (últimos 30 días)
SELECT fecha, count(*) AS cantidad_ventas,
       sum(subtotal) AS subtotal, sum(total) AS total
FROM public.ventas
WHERE fecha >= current_date - 29
GROUP BY fecha
ORDER BY fecha DESC;

-- 4) Total cobrado por medio de pago (últimos 30 días)
SELECT vp.metodo, sum(vp.monto) AS total_cobrado, count(*) AS pagos
FROM public.venta_pagos vp
JOIN public.ventas v ON v.id = vp.venta_id
WHERE v.fecha >= current_date - 29
GROUP BY vp.metodo
ORDER BY total_cobrado DESC;

-- 5) Estado de solicitudes de factura
SELECT estado, count(*) AS solicitudes,
       min(creado_en) AS mas_antigua, max(creado_en) AS mas_reciente
FROM public.solicitudes_factura
GROUP BY estado
ORDER BY estado;

-- 6) Movimientos más recientes
SELECT fecha, hora, rol, accion, detalle
FROM public.movimientos
ORDER BY fecha DESC, hora DESC
LIMIT 50;

-- 7) Ventas con artículos cuyo producto original ya no está en el catálogo
-- (los datos históricos del artículo permanecen en venta_items)
SELECT v.fecha, v.hora, v.id AS venta_id, i.nombre, i.codigo,
       i.talle, i.color, i.cantidad, i.precio_unit
FROM public.ventas v
JOIN public.venta_items i ON i.venta_id = v.id
WHERE i.producto_id IS NULL
ORDER BY v.fecha DESC, v.hora DESC;

-- 8) Usuarios y roles
SELECT usuario, rol
FROM public.perfiles
ORDER BY usuario;
