# Migraciones locales

`generar_migracion.py` genera un SQL a partir de un respaldo JSON. El SQL resultante contiene datos del negocio, como ventas, costos y movimientos. Es privado: no lo publiques, no lo agregues manualmente al repositorio y no lo ejecutes en un proyecto distinto del destino previsto.

La regla de `.gitignore` en la raíz excluye los SQL generados con el nombre `migrar-zero-zed-*.sql`. Revisá siempre el respaldo de origen, el destino de Supabase y el contenido del SQL antes de ejecutarlo.
