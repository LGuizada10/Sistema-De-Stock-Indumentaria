#!/usr/bin/env python3
"""Build a reviewable, transactional SQL migration from a Zero Zed JSON backup."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path


def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Número no válido")
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def j(value):
    return q(json.dumps(value, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"


def insert(table, columns, rows):
    if not rows:
        return f"-- {table}: sin filas en la copia."
    return "INSERT INTO public." + table + " (" + ", ".join(columns) + ") VALUES\n  " + ",\n  ".join("(" + ", ".join(q(v) for v in row) + ")" for row in rows) + ";"


def main(src: Path, dst: Path):
    data = json.loads(src.read_text(encoding="utf-8-sig"))
    for key in ("config", "productos", "ventas", "turnos", "compras", "devoluciones", "movimientos"):
        if key not in data:
            raise ValueError(f"Falta la sección obligatoria: {key}")
    if not isinstance(data["config"], dict):
        raise ValueError("config no tiene el formato esperado")

    products = data["productos"]
    sales = data["ventas"]
    turns = data["turnos"]
    refunds = data["devoluciones"] or []
    purchases = data["compras"] or []
    movements = data["movimientos"] or []
    product_ids = {p["id"] for p in products}
    variant_ids = {v["id"] for p in products for v in p.get("variantes", [])}
    sale_ids = {v["id"] for v in sales}
    turn_ids = {v["id"] for v in turns}
    counts = {
        "productos": len(products),
        "productos_costos": len(products),
        "variantes": sum(len(p.get("variantes", [])) for p in products),
        "turnos": len(turns),
        "turno_gastos": sum(len(t.get("gastos", [])) for t in turns),
        "ventas": len(sales),
        "venta_items": sum(len(v.get("items", [])) for v in sales),
        "venta_pagos": sum(len(v.get("pagos") or [{"metodo": v.get("metodoPago", ""), "monto": v.get("total", 0)}]) for v in sales),
        "devoluciones": len(refunds),
        "devolucion_lineas": sum(len(d.get("productosNuevos", [])) for d in refunds),
        "compras": len(purchases),
        "compra_lineas": sum(len(c.get("lineas", [])) for c in purchases),
        "movimientos": len(movements),
        "promociones": len(data.get("promociones", [])),
    }

    config = data["config"]
    cats = ", ".join(q(x) for x in config.get("categorias", []))
    statements = [
        "-- DESTRUCTIVO: reemplaza los datos de negocio de Supabase con la copia JSON.",
        "-- Antes archiva una instantánea privada del estado actual y la copia local sin PIN antiguos.",
        "-- Migración de Zero Zed desde una copia JSON. Ejecutar una sola vez en el proyecto destino.",
        "-- Todo corre en una transacción: cualquier error revierte tanto el vaciado como la carga.",
        "-- Las tablas de usuarios/perfiles se conservan; las facturas cloud existentes quedan archivadas.",
        "BEGIN;",
        "CREATE TABLE IF NOT EXISTS public.zerozed_migration_archive (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), captured_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL, payload jsonb NOT NULL);",
        "ALTER TABLE public.zerozed_migration_archive ENABLE ROW LEVEL SECURITY;",
        "REVOKE ALL ON TABLE public.zerozed_migration_archive FROM PUBLIC, anon, authenticated;",
        "INSERT INTO public.zerozed_migration_archive (source, payload) VALUES (",
        "  'Estado previo de Supabase antes de la migración local',",
        "  jsonb_build_object(" + ", ".join(
            q(name) + ", coalesce((select jsonb_agg(to_jsonb(x)) from public." + name + " x), '[]'::jsonb)"
            for name in ["config", "productos", "productos_costos", "variantes", "turnos", "turno_gastos", "ventas", "venta_items", "venta_items_costos", "venta_pagos", "devoluciones", "devolucion_lineas", "compras", "compra_lineas", "movimientos", "promociones", "solicitudes_factura"]
        ) + ")",
        ");",
    ]
    backup = json.loads(json.dumps(data, ensure_ascii=False))
    backup.get("config", {}).pop("pins", None)
    statements += [
        "INSERT INTO public.zerozed_migration_archive (source, payload) VALUES (",
        "  " + q(src.name) + ",",
        "  " + j(backup),
        ");",
        "-- Reemplazo ordenado; la copia previa ya quedó guardada en la tabla privada de archivo.",
        "DELETE FROM public.solicitudes_factura;",
        "DELETE FROM public.devoluciones;",
        "DELETE FROM public.ventas;",
        "DELETE FROM public.compras;",
        "DELETE FROM public.turnos;",
        "DELETE FROM public.productos;",
        "DELETE FROM public.promociones;",
        "DELETE FROM public.movimientos;",
        "INSERT INTO public.config (id, nombre_local, debito_pct, credito_pct, categorias) VALUES (1, " + q(config.get("nombreLocal", "Zero Zed")) + ", " + q(config.get("debitoPct", 10)) + ", " + q(config.get("creditoPct", 20)) + ", ARRAY[" + cats + "]::text[]) ON CONFLICT (id) DO UPDATE SET nombre_local=EXCLUDED.nombre_local, debito_pct=EXCLUDED.debito_pct, credito_pct=EXCLUDED.credito_pct, categorias=EXCLUDED.categorias;",
    ]

    rows = []
    for p in products:
        rows.append([p["id"], p.get("num"), p.get("nombre", ""), p.get("descripcion", ""), p.get("categoria", ""), p.get("precio", 0)])
    statements.append(insert("productos", ["id", "num", "nombre", "descripcion", "categoria", "precio"], rows))
    statements.append(insert("productos_costos", ["producto_id", "costo"], [[p["id"], p.get("costo", 0)] for p in products]))

    rows = []
    pending = data.get("etiquetasPendientes") or {}
    for p in products:
        for v in p.get("variantes", []):
            rows.append([v["id"], p["id"], v.get("talle", ""), v.get("color", ""), v.get("codigo", ""), v.get("stock", 0), pending.get(v["id"], 0)])
    statements.append(insert("variantes", ["id", "producto_id", "talle", "color", "codigo", "stock", "etiquetas_pendientes"], rows))

    rows = [[t["id"], t.get("fecha"), t.get("turno", ""), t.get("cambioInicial", 0), t.get("cambioFinal"), t.get("efectivoEsperado"), t.get("abierto", True), t.get("horaApertura"), t.get("horaCierre")] for t in turns]
    statements.append(insert("turnos", ["id", "fecha", "turno", "cambio_inicial", "cambio_final", "efectivo_esperado", "abierto", "hora_apertura", "hora_cierre"], rows))
    rows = []
    for t in turns:
        for i, g in enumerate(t.get("gastos", [])):
            desc = g.get("desc", "")
            typ = "ingreso_cambio" if desc.startswith("Diferencia de cambio:") else "gasto"
            rows.append([f'{t["id"]}-g{i}', t["id"], typ, desc, g.get("monto", 0), g.get("hora")])
    statements.append(insert("turno_gastos", ["id", "turno_id", "tipo", "descripcion", "monto", "hora"], rows))

    rows = [[s["id"], s.get("fecha"), s.get("hora"), s.get("turnoId") if s.get("turnoId") in turn_ids else None, s.get("metodoPago", ""), s.get("subtotal", 0), s.get("recargoPct", 0), s.get("total", 0)] for s in sales]
    statements.append(insert("ventas", ["id", "fecha", "hora", "turno_id", "metodo_pago", "subtotal", "recargo_pct", "total"], rows))
    rows, cost_rows, pay_rows = [], [], []
    for s in sales:
        for i, it in enumerate(s.get("items", [])):
            item_id = f'{s["id"]}-i{i}'
            promo_obj = it.get("promoAplicada") or {}
            promo_name = promo_obj if isinstance(promo_obj, str) else ""
            if isinstance(promo_obj, dict):
                for promotion in data.get("promociones", []):
                    levels = promotion.get("niveles") or [{"cant": promotion.get("cantidad"), "precio": promotion.get("precio")}]
                    if any(level.get("cant") == promo_obj.get("cantidad") and level.get("precio") == promo_obj.get("precio") for level in levels):
                        promo_name = promotion.get("nombre", "")
                        break
            rows.append([item_id, s["id"], i, it.get("productoId") if it.get("productoId") in product_ids else None, it.get("varianteId") if it.get("varianteId") in variant_ids else None, it.get("nombre", ""), it.get("categoria", ""), it.get("varianteLabel", ""), it.get("codigo", ""), it.get("talle", ""), it.get("color", ""), it.get("cantidad", 1), it.get("precioUnit", 0), it.get("precioBaseUnit", it.get("precioUnit", 0)), promo_name])
            cost_rows.append([item_id, it.get("costoUnit", 0)])
        payments = s.get("pagos") or [{"metodo": s.get("metodoPago", ""), "monto": s.get("total", 0)}]
        for i, payment in enumerate(payments):
            method = payment.get("metodo", "")
            if method not in {"Efectivo", "Mercado Pago", "Débito", "Crédito"}:
                raise ValueError(f"Método de pago no reconocido en venta {s['id']}: {method}")
            pay_rows.append([f'{s["id"]}-p{i}', s["id"], method, payment.get("monto", 0)])
    statements.append(insert("venta_items", ["id", "venta_id", "idx", "producto_id", "variante_id", "nombre", "categoria", "variante_label", "codigo", "talle", "color", "cantidad", "precio_unit", "precio_lista", "promo"], rows))
    statements.append(insert("venta_items_costos", ["item_id", "costo_unit"], cost_rows))
    statements.append(insert("venta_pagos", ["id", "venta_id", "metodo", "monto"], pay_rows))

    rows = []
    for d in refunds:
        rows.append([d["id"], d.get("fecha"), d.get("hora"), d.get("ventaId") if d.get("ventaId") in sale_ids else None, d.get("ventaFecha") or None, d.get("itemIdx"), d.get("productoId") if d.get("productoId") in product_ids else None, d.get("varianteId") if d.get("varianteId") in variant_ids else None, d.get("nombre", ""), d.get("varianteLabel", ""), d.get("codigo", ""), d.get("cantidad", 1), d.get("montoDevuelto", 0), d.get("tipo", "devolucion"), d.get("montoNuevo", 0), d.get("montoDiferencia", 0), d.get("motivo", ""), d.get("reintegro", ""), d.get("metodoDiferencia", ""), d.get("turnoId") if d.get("turnoId") in turn_ids else None])
    statements.append(insert("devoluciones", ["id", "fecha", "hora", "venta_id", "venta_fecha", "item_idx", "producto_id", "variante_id", "nombre", "variante_label", "codigo", "cantidad", "monto_devuelto", "tipo", "monto_nuevo", "monto_diferencia", "motivo", "reintegro", "metodo_diferencia", "turno_id"], rows))
    rows = []
    for d in refunds:
        for i, line in enumerate(d.get("productosNuevos", [])):
            rows.append([f'{d["id"]}-l{i}', d["id"], i, line.get("productoId") if line.get("productoId") in product_ids else None, line.get("varianteId") if line.get("varianteId") in variant_ids else None, line.get("nombre", ""), line.get("varianteLabel", ""), line.get("codigo", ""), line.get("cantidad", 1), line.get("precioUnit", 0)])
    statements.append(insert("devolucion_lineas", ["id", "devolucion_id", "orden", "producto_id", "variante_id", "nombre", "variante_label", "codigo", "cantidad", "precio_unit"], rows))

    rows = [[c["id"], c.get("fecha"), c.get("descripcion", ""), c.get("lugar", ""), c.get("proveedor", ""), c.get("direccion", ""), c.get("telefono", ""), c.get("costo", 0), c.get("notas", "")] for c in purchases]
    statements.append(insert("compras", ["id", "fecha", "descripcion", "lugar", "proveedor", "direccion", "telefono", "costo", "notas"], rows))
    rows = []
    for c in purchases:
        for i, line in enumerate(c.get("lineas", [])):
            rows.append([f'{c["id"]}-l{i}', c["id"], line.get("productoId") if line.get("productoId") in product_ids else None, line.get("varianteId") if line.get("varianteId") in variant_ids else None, line.get("nombre", ""), line.get("varianteLabel", ""), line.get("cantidad", 1)])
    statements.append(insert("compra_lineas", ["id", "compra_id", "producto_id", "variante_id", "nombre", "variante_label", "cantidad"], rows))
    rows = [[m["id"], m.get("fecha"), m.get("hora"), m.get("rol", ""), m.get("accion", ""), m.get("detalle", "")] for m in movements]
    statements.append(insert("movimientos", ["id", "fecha", "hora", "rol", "accion", "detalle"], rows))

    promo_rows = []
    for promotion in data.get("promociones", []):
        # Preserve modern targeting and status. For legacy backups, infer targeted products from producto.promocionId.
        product_ids = promotion.get("productos_ids")
        if product_ids is None:
            product_ids = [p["id"] for p in products if p.get("promocionId") == promotion["id"]]
        categories = promotion.get("categorias") or []
        levels = promotion.get("niveles") or [{"cant": promotion.get("cantidad", 1), "precio": promotion.get("precio", 0)}]
        promo_rows.append([promotion["id"], promotion.get("nombre", ""), promotion.get("activa", True) is not False,
                           product_ids, categories, json.dumps(levels, ensure_ascii=False),
                           promotion.get("fecha_desde"), promotion.get("fecha_hasta")])
    if promo_rows:
        promo_sql = "INSERT INTO public.promociones (id,nombre,activa,productos_ids,categorias,niveles,fecha_desde,fecha_hasta) VALUES\n"
        promo_sql += ",\n".join("(" + ", ".join([q(r[0]), q(r[1]), q(r[2]), "ARRAY[" + ", ".join(q(x) for x in r[3]) + "]::text[]", "ARRAY[" + ", ".join(q(x) for x in r[4]) + "]::text[]", q(r[5]) + "::jsonb", q(r[6]) if r[6] else "NULL", q(r[7]) if r[7] else "NULL"]) + ")" for r in promo_rows) + ";"
        statements.append(promo_sql)
    else:
        statements.append("-- promociones: sin filas en la copia.")

    expected = " ".join(q(k) + "=" + str(v) for k, v in counts.items())
    checks = []
    table_map = {"productos": "productos", "productos_costos": "productos_costos", "variantes": "variantes", "turnos": "turnos", "turno_gastos": "turno_gastos", "ventas": "ventas", "venta_items": "venta_items", "venta_pagos": "venta_pagos", "devoluciones": "devoluciones", "devolucion_lineas": "devolucion_lineas", "compras": "compras", "compra_lineas": "compra_lineas", "movimientos": "movimientos", "promociones": "promociones"}
    checks.append("IF (SELECT coalesce(sum(total),0) FROM public.ventas) <> " + str(sum(float(s.get("total", 0)) for s in sales)) + " THEN RAISE EXCEPTION 'El total de ventas no coincide con la copia'; END IF;")
    checks.append("IF EXISTS (SELECT 1 FROM public.ventas v WHERE coalesce((SELECT sum(p.monto) FROM public.venta_pagos p WHERE p.venta_id=v.id),0) <> v.total) THEN RAISE EXCEPTION 'Los pagos no suman el total de alguna venta'; END IF;")
    checks.append("IF (SELECT count(*) FROM public.config WHERE id=1) <> 1 THEN RAISE EXCEPTION 'No quedó guardada la configuración del local'; END IF;")
    for key, table in table_map.items():
        checks.append(f"IF (SELECT count(*) FROM public.{table}) <> {counts[key]} THEN RAISE EXCEPTION 'Cantidad distinta en {table}'; END IF;")
    statements += [
        "DO $$ BEGIN " + " ".join(checks) + " END $$;",
        "-- Conteos esperados para cotejar después de la ejecución: " + expected,
        "COMMIT;",
        "-- Las sesiones de Supabase Auth/perfiles se conservan. Los PIN antiguos no se importan; el nuevo login usa Auth.",
        "-- Las solicitudes de factura actuales se archivaron; no existen en la copia JSON local.",
        "-- Las promociones preservan su alcance, vigencia y niveles tal como figuran en la copia.",
        "-- Las referencias históricas a productos/variantes ya ausentes se dejan NULL en FK; snapshots con nombre/código/precio quedan intactos y el JSON completo está archivado.",
    ]
    dst.write_text("\n\n".join(statements) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(dst), "counts": counts, "payments_sum": round(sum(float(s.get("total", 0)) for s in sales), 2)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: generar_migracion.py copia.json migracion.sql")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
