# SQL de Zero Zed: qué ejecutar

## 1. Instalación o actualización de la estructura

`zero-zed-supabase-completo.sql`

Define y actualiza tablas, permisos, funciones, políticas y auditoría. Es el archivo base del sistema. Ejecutarlo actualiza la estructura; no lo uses para importar una copia JSON ni para vaciar la base.

Para actualizar únicamente el historial de compras en un proyecto que ya tiene la estructura instalada, ejecutá `ACTUALIZAR_COMPRAS.sql`. Agrega una búsqueda del lado de Supabase, paginación e índices; no borra ni modifica las compras existentes.

## 2. Migración de una copia local (privada)

El generador `../migracion/generar_migracion.py` produce SQL con los datos del respaldo que se le indique. El resultado puede incluir ventas, costos, movimientos y otros datos privados; se excluye del repositorio mediante `.gitignore`. No lo publiques ni lo ejecutes en otro proyecto. Revisá el destino y el contenido antes de ejecutar cualquier migración.

## 3. Consultas de solo lectura

`CONSULTAS_SOLO_LECTURA.sql`

Contiene `SELECT` para conteos, stock, ventas, pagos, facturas, movimientos y usuarios. Copiá y ejecutá una consulta por vez. No modifica datos ni estructura.

## Seguridad y archivo previo

La migración crea `public.zerozed_migration_archive`, activa RLS y no concede acceso a `anon` ni `authenticated`. Conservá los respaldos y SQL generados en un lugar privado.
