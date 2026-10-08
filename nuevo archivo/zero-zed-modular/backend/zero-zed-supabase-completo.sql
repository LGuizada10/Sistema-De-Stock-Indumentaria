-- =====================================================================
-- ZERO ZED · Control de local  ->  Esquema COMPLETO para Supabase (PostgreSQL)
-- Incluye las claves automáticas por prenda (REM-COR-001-NEG),
-- las facturas a consumidor final (sección 4b),
-- el borrado automático de facturas terminadas a los 21 días (sección 4c),
-- el login por USUARIO en vez de mail (sección 2c)
-- los ajustes de stock que no se pisan entre dispositivos (sección 2d)
-- las promociones y ofertas (sección 3b)
-- y el endurecimiento: precios solo para el admin y auditoría hecha por la base (sección 7).
-- Se puede ejecutar de nuevo sobre una base que ya existe sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABLAS
-- ---------------------------------------------------------------------

-- Usuarios del sistema (uno por persona). Reemplaza a los PIN.
-- "usuario" es el nombre con el que entra a la pantalla de login.
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  usuario text,
  rol text not null default 'empleado' check (rol in ('admin','empleado')),
  creado_en timestamptz not null default now()
);
-- Si la tabla ya existía sin la columna, se agrega:
alter table public.perfiles add column if not exists usuario text;

-- Configuración del local (una sola fila)
create table if not exists public.config (
  id integer primary key default 1 check (id = 1),
  nombre_local text not null default 'Zero Zed',
  debito_pct numeric(6,2) not null default 10,
  credito_pct numeric(6,2) not null default 20,
  categorias text[] not null default '{}'
);
insert into public.config (id, categorias)
values (1, array['Pantalones','Jeans','Shorts','Medias','Cadenitas','Pulseras','Bolsos/Riñoneras','Gorras','Otros'])
on conflict (id) do nothing;

-- Productos (el estampado/diseño va en "descripcion")
-- "num" = número único y permanente de la prenda (001, 002...), va dentro de la clave.
create table if not exists public.productos (
  id text primary key default gen_random_uuid()::text,
  num integer,
  nombre text not null,
  descripcion text not null default '',
  categoria text not null default '',
  precio numeric(14,2) not null default 0,
  creado_en timestamptz not null default now()
);
-- Si la tabla ya existía sin la columna, se agrega:
alter table public.productos add column if not exists num integer;

-- Costo del producto, en tabla aparte para que SOLO lo vea el admin
create table if not exists public.productos_costos (
  producto_id text primary key references public.productos(id) on delete cascade,
  costo numeric(14,2) not null default 0
);

-- Variantes (talle / color). "codigo" es el que lee el lector de barras.
-- Todos los talles de una misma prenda y color comparten la misma clave.
create table if not exists public.variantes (
  id text primary key default gen_random_uuid()::text,
  producto_id text not null references public.productos(id) on delete cascade,
  talle text not null default '',
  color text not null default '',
  codigo text not null default '',
  stock integer not null default 0 check (stock >= 0),
  etiquetas_pendientes integer not null default 0 check (etiquetas_pendientes >= 0),
  creado_en timestamptz not null default now()
);
-- La clave YA NO es única por variante (los talles la comparten).
-- Se elimina el índice único viejo y se usa uno normal para buscar rápido.
drop index if exists public.variantes_codigo_unico;
create index if not exists variantes_codigo_idx on public.variantes (lower(codigo)) where codigo <> '';
create index if not exists variantes_producto_idx on public.variantes (producto_id);
create index if not exists productos_creado_id_idx on public.productos (creado_en, id);
create index if not exists productos_categoria_creado_idx on public.productos (categoria, creado_en, id);
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
do $$
declare esquema_trgm text;
begin
  select n.nspname into esquema_trgm
    from pg_opclass c join pg_namespace n on n.oid=c.opcnamespace
   where c.opcname='gin_trgm_ops' and c.opcmethod=(select oid from pg_am where amname='gin')
   limit 1;
  if esquema_trgm is null then raise exception 'No se encontró el operador gin_trgm_ops de pg_trgm'; end if;
  execute format('create index if not exists productos_nombre_trgm_idx on public.productos using gin (nombre %I.gin_trgm_ops)', esquema_trgm);
  execute format('create index if not exists productos_descripcion_trgm_idx on public.productos using gin (descripcion %I.gin_trgm_ops)', esquema_trgm);
  execute format('create index if not exists productos_categoria_trgm_idx on public.productos using gin (categoria %I.gin_trgm_ops)', esquema_trgm);
  execute format('create index if not exists variantes_codigo_trgm_idx on public.variantes using gin (codigo %I.gin_trgm_ops) where codigo <> ''''', esquema_trgm);
end $$;

-- Búsqueda y paginación del catálogo en el servidor. RLS sigue aplicando al usuario.
create or replace function public.buscar_catalogo(p_termino text default '', p_categoria text default '', p_limite integer default 30, p_offset integer default 0)
returns jsonb
language sql
stable
set search_path = public
as $$
  with pagina as (
    select p.* from public.productos p
    where (coalesce(p_categoria, '') = '' or p.categoria = p_categoria)
      and (
        coalesce(trim(p_termino), '') = ''
        or p.nombre ilike '%' || trim(p_termino) || '%'
        or p.descripcion ilike '%' || trim(p_termino) || '%'
        or p.categoria ilike '%' || trim(p_termino) || '%'
        or p.id = trim(p_termino)
        or exists (
          select 1 from public.variantes v
          where v.producto_id = p.id and (
            v.codigo ilike '%' || trim(p_termino) || '%'
            or (v.codigo || '-' || coalesce(nullif(regexp_replace(translate(upper(v.talle),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g'),''),'U')) ilike '%' || trim(p_termino) || '%'
          )
        )
      )
    order by p.creado_en, p.id
    limit greatest(1, least(coalesce(p_limite, 30), 100))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (select count(*) from public.productos p
      where (coalesce(p_categoria, '') = '' or p.categoria = p_categoria)
        and (
          coalesce(trim(p_termino), '') = ''
          or p.nombre ilike '%' || trim(p_termino) || '%'
          or p.descripcion ilike '%' || trim(p_termino) || '%'
          or p.categoria ilike '%' || trim(p_termino) || '%'
          or p.id = trim(p_termino)
          or exists (
            select 1 from public.variantes v
            where v.producto_id = p.id and (
              v.codigo ilike '%' || trim(p_termino) || '%'
              or (v.codigo || '-' || coalesce(nullif(regexp_replace(translate(upper(v.talle),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g'),''),'U')) ilike '%' || trim(p_termino) || '%'
            )
          )
        )),
    'items', coalesce((
      select jsonb_agg(
        to_jsonb(p) || jsonb_build_object(
          'costo', coalesce(pc.costo, 0),
          'variantes', coalesce(vs.items, '[]'::jsonb)
        ) order by p.creado_en, p.id
      )
      from pagina p
      left join public.productos_costos pc on pc.producto_id = p.id
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'id', v.id, 'producto_id', v.producto_id, 'talle', v.talle,
          'color', v.color, 'codigo', v.codigo, 'stock', v.stock,
          'etiquetas_pendientes', v.etiquetas_pendientes
        ) order by v.creado_en, v.id) as items
        from public.variantes v where v.producto_id = p.id
      ) vs on true
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.buscar_catalogo(text, text, integer, integer) from public, anon;
grant execute on function public.buscar_catalogo(text, text, integer, integer) to authenticated;

create or replace function public.resumen_catalogo()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'prendas', (select count(*) from public.productos),
    'unidades', coalesce(sum(v.stock), 0),
    'sinStock', count(*) filter (where v.stock <= 0),
    'bajo', count(*) filter (where v.stock > 0 and v.stock <= 2),
    'costo', coalesce(sum(v.stock * coalesce(pc.costo, 0)), 0),
    'venta', coalesce(sum(v.stock * p.precio), 0),
    'etiquetasPendientes', coalesce(sum(v.etiquetas_pendientes), 0),
    'agotadas', count(*) filter (where v.id is not null and v.stock <= 0),
    'agotadasMuestra', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productoId', q.producto_id, 'nombre', q.nombre, 'varianteId', q.variante_id,
        'talle', q.talle, 'color', q.color
      )) from (
        select p2.id as producto_id, p2.nombre, v2.id as variante_id, v2.talle, v2.color
        from public.productos p2 join public.variantes v2 on v2.producto_id=p2.id
        where v2.stock<=0 order by p2.nombre, v2.id limit 6
      ) q
    ), '[]'::jsonb)
  )
  from public.productos p
  left join public.variantes v on v.producto_id = p.id
  left join public.productos_costos pc on pc.producto_id = p.id;
$$;
revoke all on function public.resumen_catalogo() from public, anon;
grant execute on function public.resumen_catalogo() to authenticated;

-- Turnos y sus gastos / ingresos por cambio
create table if not exists public.turnos (
  id text primary key default gen_random_uuid()::text,
  fecha date not null,
  turno text not null default '',
  cambio_inicial numeric(14,2) not null default 0,
  cambio_final numeric(14,2),
  efectivo_esperado numeric(14,2),
  abierto boolean not null default true,
  hora_apertura time,
  hora_cierre time,
  creado_en timestamptz not null default now()
);
create index if not exists turnos_fecha_idx on public.turnos (fecha);

create table if not exists public.turno_gastos (
  id text primary key default gen_random_uuid()::text,
  turno_id text not null references public.turnos(id) on delete cascade,
  tipo text not null default 'gasto' check (tipo in ('gasto','ingreso_cambio')),
  descripcion text not null default '',
  monto numeric(14,2) not null default 0,
  hora time,
  creado_en timestamptz not null default now()
);
create index if not exists turno_gastos_turno_idx on public.turno_gastos (turno_id);

-- Ventas, sus ítems y sus pagos (pago dividido = 2 filas en venta_pagos)
create table if not exists public.ventas (
  id text primary key default gen_random_uuid()::text,
  fecha date not null,
  hora time,
  turno_id text references public.turnos(id) on delete set null,
  metodo_pago text not null default '',
  subtotal numeric(14,2) not null default 0,
  recargo_pct numeric(6,2) not null default 0,
  total numeric(14,2) not null default 0,
  usuario_id uuid,
  creado_en timestamptz not null default now()
);
create index if not exists ventas_fecha_idx on public.ventas (fecha);

create table if not exists public.venta_items (
  id text primary key default gen_random_uuid()::text,
  venta_id text not null references public.ventas(id) on delete cascade,
  idx integer not null default 0,
  producto_id text references public.productos(id) on delete set null,
  variante_id text references public.variantes(id) on delete set null,
  nombre text not null default '',
  categoria text not null default '',
  variante_label text not null default '',
  codigo text not null default '',
  talle text not null default '',
  color text not null default '',
  cantidad integer not null check (cantidad >= 1),
  precio_unit numeric(14,2) not null default 0
);
create index if not exists venta_items_venta_idx on public.venta_items (venta_id);

-- Costo de cada ítem vendido (solo admin, para calcular ganancias)
create table if not exists public.venta_items_costos (
  item_id text primary key references public.venta_items(id) on delete cascade,
  costo_unit numeric(14,2) not null default 0
);

create table if not exists public.venta_pagos (
  id text primary key default gen_random_uuid()::text,
  venta_id text not null references public.ventas(id) on delete cascade,
  metodo text not null check (metodo in ('Efectivo','Mercado Pago','Débito','Crédito')),
  monto numeric(14,2) not null default 0
);
create index if not exists venta_pagos_venta_idx on public.venta_pagos (venta_id);

-- Devoluciones y cambios (las prendas nuevas de un cambio van en devolucion_lineas)
create table if not exists public.devoluciones (
  id text primary key default gen_random_uuid()::text,
  fecha date not null,
  hora time,
  venta_id text references public.ventas(id) on delete set null,
  venta_fecha date,
  item_idx integer,
  producto_id text references public.productos(id) on delete set null,
  variante_id text references public.variantes(id) on delete set null,
  nombre text not null default '',
  variante_label text not null default '',
  codigo text not null default '',
  cantidad integer not null default 1,
  monto_devuelto numeric(14,2) not null default 0,
  tipo text not null default 'devolucion' check (tipo in ('devolucion','cambio')),
  monto_nuevo numeric(14,2) not null default 0,
  monto_diferencia numeric(14,2) not null default 0,
  motivo text not null default '',
  reintegro text not null default '',
  metodo_diferencia text not null default '',
  turno_id text references public.turnos(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists devoluciones_fecha_idx on public.devoluciones (fecha);

create table if not exists public.devolucion_lineas (
  id text primary key default gen_random_uuid()::text,
  devolucion_id text not null references public.devoluciones(id) on delete cascade,
  orden integer not null default 0,
  producto_id text references public.productos(id) on delete set null,
  variante_id text references public.variantes(id) on delete set null,
  nombre text not null default '',
  variante_label text not null default '',
  codigo text not null default '',
  cantidad integer not null default 1,
  precio_unit numeric(14,2) not null default 0
);
create index if not exists devolucion_lineas_dev_idx on public.devolucion_lineas (devolucion_id);

-- Compras de mercadería (solo admin)
create table if not exists public.compras (
  id text primary key default gen_random_uuid()::text,
  fecha date not null,
  descripcion text not null default '',
  lugar text not null default '',
  proveedor text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  costo numeric(14,2) not null default 0,
  notas text not null default '',
  creado_en timestamptz not null default now()
);
create table if not exists public.compra_lineas (
  id text primary key default gen_random_uuid()::text,
  compra_id text not null references public.compras(id) on delete cascade,
  producto_id text references public.productos(id) on delete set null,
  variante_id text references public.variantes(id) on delete set null,
  nombre text not null default '',
  variante_label text not null default '',
  cantidad integer not null default 1
);
create index if not exists compra_lineas_compra_idx on public.compra_lineas (compra_id);

-- Registro de movimientos (auditoría)
create table if not exists public.movimientos (
  id text primary key default gen_random_uuid()::text,
  fecha date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  hora time not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::time(0)),
  rol text not null default '',
  accion text not null default '',
  detalle text not null default '',
  usuario_id uuid default auth.uid()
);
create index if not exists movimientos_fecha_idx on public.movimientos (fecha);


-- ---------------------------------------------------------------------
-- 2) FUNCIONES AUXILIARES DE PERMISOS
-- ---------------------------------------------------------------------
create or replace function public.es_usuario()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid())
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin')
$$;

create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select rol from public.perfiles where id = auth.uid()), '')
$$;

-- Cada usuario nuevo de Supabase Auth recibe un perfil "empleado" y un usuario
-- (lo que va antes de la @ de su mail). Después vos promovés a admin con el
-- UPDATE del final de este archivo.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, usuario, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(coalesce(new.email,''), '@', 1)),
    lower(split_part(coalesce(new.email,''), '@', 1)),
    'empleado'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();


-- ---------------------------------------------------------------------
-- 2b) CLAVES AUTOMÁTICAS POR PRENDA
--     - Número de prenda entregado por la base (nunca se repite).
--     - El número y la clave no se pueden modificar una vez creados.
--     - Dos prendas distintas no pueden compartir clave; los talles de
--       una misma prenda SÍ la comparten (REM-COR-001-NEG).
-- ---------------------------------------------------------------------
create sequence if not exists public.productos_num_seq;

-- No puede haber dos prendas con el mismo número (las viejas quedan en NULL)
create unique index if not exists productos_num_unico
  on public.productos (num) where num is not null;

-- Devuelve el próximo número de prenda (operación atómica)
create or replace function public.siguiente_num_producto()
returns integer
language sql
security definer
set search_path = public
as $$ select nextval('public.productos_num_seq')::integer $$;

revoke all on function public.siguiente_num_producto() from public, anon;
grant execute on function public.siguiente_num_producto() to authenticated;

-- Reserva números en lote para importar muchas prendas sin una llamada por fila.
create or replace function public.siguientes_num_productos(p_cantidad integer)
returns setof integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 5000 then
    raise exception 'La cantidad debe estar entre 1 y 5000';
  end if;
  return query
    select nextval('public.productos_num_seq')::integer
      from generate_series(1, p_cantidad);
end $$;

revoke all on function public.siguientes_num_productos(integer) from public, anon;
grant execute on function public.siguientes_num_productos(integer) to authenticated;

-- El número de una prenda queda fijo. Si entra una prenda con número mayor
-- al de la secuencia (por ejemplo al importar una copia), la secuencia se adelanta.
create or replace function public.trg_productos_num()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ult bigint;
begin
  if tg_op = 'UPDATE' and old.num is not null then
    new.num := old.num;
  end if;
  if new.num is not null then
    select case when is_called then last_value else 0 end
      into ult from public.productos_num_seq;
    if new.num > ult then
      perform setval('public.productos_num_seq', new.num);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists productos_num_fijo on public.productos;
create trigger productos_num_fijo
  before insert or update on public.productos
  for each row execute function public.trg_productos_num();

-- La clave de una variante no se puede modificar una vez creada
-- (si estaba vacía, se permite completarla una sola vez) y no puede
-- pertenecer a otra prenda.
create or replace function public.trg_variantes_codigo()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and coalesce(old.codigo, '') <> '' then
    new.codigo := old.codigo;
  end if;
  if coalesce(new.codigo, '') <> '' and exists (
       select 1 from public.variantes v
        where lower(v.codigo) = lower(new.codigo)
          and v.producto_id <> new.producto_id
     ) then
    raise exception 'La clave % ya pertenece a otra prenda', new.codigo;
  end if;
  return new;
end $$;

drop trigger if exists variantes_codigo_fijo on public.variantes;
create trigger variantes_codigo_fijo
  before insert or update on public.variantes
  for each row execute function public.trg_variantes_codigo();

-- (Opcional) Una misma prenda no puede tener dos veces el mismo talle + color.
-- Si ya hay duplicados en tus datos, avisa y se omite sin romper nada.
do $$
begin
  create unique index if not exists variantes_prenda_talle_color
    on public.variantes (producto_id, lower(talle), lower(color));
exception when others then
  raise notice 'Se omitió el índice talle+color (ya existen duplicados): %', sqlerrm;
end $$;


-- ---------------------------------------------------------------------
-- 2c) LOGIN POR USUARIO (en vez de mail)
--     La pantalla de login pide "usuario" y contraseña. Esta función traduce
--     el usuario al mail con el que está dado de alta en Supabase Auth.
--     El usuario por defecto es lo que va antes de la @ del mail
--     (usuario@ejemplo.com -> usuario).
-- ---------------------------------------------------------------------

-- Completa el usuario de las cuentas que ya existían sin él
update public.perfiles p
   set usuario = lower(split_part(u.email, '@', 1))
  from auth.users u
 where u.id = p.id
   and (p.usuario is null or trim(p.usuario) = '');

-- No puede haber dos usuarios iguales. Si ya hay repetidos, avisa y se omite:
-- en ese caso cambiá uno a mano, por ejemplo:
--   update public.perfiles set usuario = 'otro' where id = '...';
-- y volvé a ejecutar este archivo.
do $$
begin
  create unique index if not exists perfiles_usuario_unico
    on public.perfiles (lower(usuario)) where usuario is not null;
exception when others then
  raise notice 'Se omitió el índice de usuario único (hay usuarios repetidos): %', sqlerrm;
end $$;

-- Devuelve el mail de un usuario (la usa la pantalla de login, antes de iniciar sesión)
create or replace function public.email_de_usuario(p_usuario text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text
    from public.perfiles p
    join auth.users u on u.id = p.id
   where lower(p.usuario) = lower(trim(p_usuario))
   order by p.creado_en
   limit 1
$$;

-- IMPORTANTE (seguridad): esta función NO debe poder llamarse desde el navegador, porque
-- cualquiera con la clave pública podría averiguar el mail real de un usuario.
-- El programa inicia sesión con USUARIO usando mails internos: la pantalla arma
-- usuario@DOMINIO_INTERNO (ver frontend/js/core/config.js) y no necesita esta función.
revoke all on function public.email_de_usuario(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2d) AJUSTES DE STOCK SIN PISARSE ENTRE DISPOSITIVOS
--     El programa ya no guarda "el stock final" de una prenda: manda la
--     DIFERENCIA (+3, -1...) y la base la suma. Así, si dos personas tocan
--     la misma prenda a la vez (por ejemplo en el cambio de turno), no se
--     pierde ningún cambio. El stock nunca queda por debajo de 0.
--     p_deltas: [{"id":"...", "stock":3, "etiquetas":0}, ...]
-- ---------------------------------------------------------------------
create or replace function public.aplicar_deltas_stock(p_deltas jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare d jsonb;
begin
  if not public.es_usuario() then
    raise exception 'No autorizado';
  end if;
  if p_deltas is null or jsonb_typeof(p_deltas) <> 'array' then
    return;
  end if;
  for d in select jsonb_array_elements(p_deltas) loop
    update public.variantes
       set stock = greatest(0, stock + coalesce((d->>'stock')::integer, 0)),
           etiquetas_pendientes = greatest(0, etiquetas_pendientes + coalesce((d->>'etiquetas')::integer, 0))
     where id = d->>'id';
  end loop;
end;
$$;

revoke execute on function public.aplicar_deltas_stock(jsonb) from public, anon;
grant execute on function public.aplicar_deltas_stock(jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 3) SEGURIDAD (RLS): quién puede ver y hacer qué
--    Admin: todo.  Empleado: vender, stock, turnos, devoluciones.
--    Solo admin: costos, ganancias, compras, borrar datos, registro de movimientos.
-- ---------------------------------------------------------------------

-- perfiles
alter table public.perfiles enable row level security;
drop policy if exists ver_perfiles on public.perfiles;
drop policy if exists admin_perfiles on public.perfiles;
create policy ver_perfiles on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());
create policy admin_perfiles on public.perfiles for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- config
alter table public.config enable row level security;
drop policy if exists ver_config on public.config;
drop policy if exists admin_config on public.config;
create policy ver_config on public.config for select to authenticated using (public.es_usuario());
create policy admin_config on public.config for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Tablas donde cualquier usuario ve, crea y edita; solo admin borra
do $$
declare t text;
begin
  foreach t in array array['productos','variantes','turnos','turno_gastos','devoluciones','devolucion_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'ver_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'crear_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'editar_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'borrar_'||t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_usuario())', 'ver_'||t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.es_usuario())', 'crear_'||t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.es_usuario()) with check (public.es_usuario())', 'editar_'||t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.es_admin())', 'borrar_'||t, t);
  end loop;
end $$;

-- Ventas: todos las ven; se crean SOLO con registrar_venta(); admin puede corregir/borrar
do $$
declare t text;
begin
  foreach t in array array['ventas','venta_items','venta_pagos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'ver_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'admin_'||t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.es_usuario())', 'ver_'||t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', 'admin_'||t, t);
  end loop;
end $$;

-- Solo admin: costos, costo de ítems vendidos, compras
do $$
declare t text;
begin
  foreach t in array array['productos_costos','venta_items_costos','compras','compra_lineas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'admin_'||t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())', 'admin_'||t, t);
  end loop;
end $$;

-- movimientos: cualquier usuario registra; solo admin lee y borra
alter table public.movimientos enable row level security;
drop policy if exists crear_movimientos on public.movimientos;
drop policy if exists ver_movimientos on public.movimientos;
drop policy if exists borrar_movimientos on public.movimientos;
create policy crear_movimientos on public.movimientos for insert to authenticated with check (public.es_usuario());
create policy ver_movimientos on public.movimientos for select to authenticated using (public.es_admin());
create policy borrar_movimientos on public.movimientos for delete to authenticated using (public.es_admin());

-- Sin sesión iniciada no se accede a nada
revoke all on all tables in schema public from anon;


-- ---------------------------------------------------------------------
-- 3b) PROMOCIONES (ofertas y liquidaciones)
--     Una promoción aplica a categorías y/o prendas puntuales. Todas las prendas de una
--     misma promoción se cuentan juntas. "niveles" = [{"cant":1,"precio":3000},{"cant":2,"precio":5000}]
--     significa: 1 prenda cuesta $3000 y llevando 2 pagás $5000 en total.
--     El precio final lo calcula la BASE al registrar la venta (registrar_venta).
-- ---------------------------------------------------------------------
create table if not exists public.promociones (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  activa boolean not null default true,
  productos_ids text[] not null default '{}',
  categorias text[] not null default '{}',
  niveles jsonb not null default '[]'::jsonb,
  fecha_desde date,
  fecha_hasta date,
  creado_en timestamptz not null default now()
);
alter table public.venta_items add column if not exists precio_lista numeric(14,2);
alter table public.venta_items add column if not exists promo text not null default '';

alter table public.promociones enable row level security;
drop policy if exists ver_promociones on public.promociones;
drop policy if exists admin_promociones on public.promociones;
create policy ver_promociones on public.promociones for select to authenticated using (public.es_usuario());
create policy admin_promociones on public.promociones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.promociones from anon;

-- Promoción vigente de una prenda (si está en varias, gana la más antigua)
create or replace function public.promo_aplicable(p_producto text, p_categoria text, p_fecha date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.promociones
   where activa
     and (fecha_desde is null or fecha_desde <= p_fecha)
     and (fecha_hasta is null or fecha_hasta >= p_fecha)
     and (p_producto = any(productos_ids) or p_categoria = any(categorias))
   order by creado_en, id
   limit 1
$$;
revoke all on function public.promo_aplicable(text, text, date) from public, anon;

-- Precio final de cada unidad. p_reg = precios normales ordenados de MAYOR a MENOR.
-- Elige la combinación de packs más barata (los packs se repiten); lo que sobra paga el precio
-- de "1 prenda" (o su precio normal si no hay nivel de 1). Nunca cobra más que el precio normal.
-- Es el mismo cálculo que hace el programa en frontend/js/core/promociones.js.
create or replace function public.promo_precios(p_reg numeric[], p_niveles jsonb)
returns numeric[]
language plpgsql
immutable
as $$
declare
  n integer := coalesce(array_length(p_reg, 1), 0);
  tp numeric[] := array_fill(null::numeric, array[50]);
  c numeric[];
  pre numeric[];
  best numeric[];
  blk integer[];
  res numeric[];
  nv jsonb;
  k integer;
  pr numeric;
  i integer;
  j integer;
  sumc numeric;
  cand numeric;
  tot numeric;
  v numeric;
  acum numeric;
begin
  if n = 0 then return '{}'::numeric[]; end if;

  for nv in select jsonb_array_elements(coalesce(p_niveles, '[]'::jsonb)) loop
    begin
      k := floor((nv->>'cant')::numeric)::integer;
      pr := round((nv->>'precio')::numeric);
    exception when others then
      k := null; pr := null;
    end;
    if k is not null and pr is not null and k >= 1 and k <= 50 and pr >= 0 then
      tp[k] := least(coalesce(tp[k], pr), pr);
    end if;
  end loop;

  c := array_fill(0::numeric, array[n]);
  pre := array_fill(0::numeric, array[n + 1]);   -- pre[m+1] = suma de los primeros m
  best := array_fill(0::numeric, array[n + 1]);  -- best[m+1] = costo mínimo de las primeras m unidades
  blk := array_fill(1, array[n + 1]);            -- tamaño del último bloque elegido
  res := array_fill(0::numeric, array[n]);

  for i in 1..n loop
    c[i] := case when tp[1] is not null then least(p_reg[i], tp[1]) else p_reg[i] end;
    pre[i + 1] := pre[i] + c[i];
  end loop;

  for i in 1..n loop
    best[i + 1] := best[i] + c[i];
    blk[i + 1] := 1;
    for k in 2..least(i, 50) loop
      if tp[k] is not null then
        sumc := pre[i + 1] - pre[i - k + 1];
        cand := best[i - k + 1] + least(tp[k], sumc);
        if cand < best[i + 1] then
          best[i + 1] := cand;
          blk[i + 1] := k;
        end if;
      end if;
    end loop;
  end loop;

  i := n;
  while i > 0 loop
    k := blk[i + 1];
    sumc := pre[i + 1] - pre[i - k + 1];
    if k = 1 then
      res[i] := c[i];
    else
      tot := least(tp[k], sumc);
      acum := 0;
      for j in (i - k + 1)..(i - 1) loop
        v := case when sumc > 0 then floor((2 * tot * c[j] + sumc) / (2 * sumc)) else 0 end;
        v := least(v, tot - acum);
        res[j] := v;
        acum := acum + v;
      end loop;
      res[i] := tot - acum;
    end if;
    i := i - k;
  end loop;

  return res;
end $$;
revoke all on function public.promo_precios(numeric[], jsonb) from public, anon;


-- ---------------------------------------------------------------------
-- 4) REGISTRAR UNA VENTA (todo en una sola operación)
--    Descuenta stock, guarda ítems, costos y pagos. Si algo falla, no se guarda nada.
--    Los precios y costos se toman de la base (no del navegador).
--
--    p_items: [{"variante_id":"...", "cantidad":2}, ...]
--    p_pagos: un método:      [{"metodo":"Débito"}]
--             dividido:       [{"metodo":"Efectivo","base":10000},{"metodo":"Mercado Pago","base":15000}]
--    (el pago dividido solo se permite Efectivo + Mercado Pago)
-- ---------------------------------------------------------------------
create or replace function public.registrar_venta(p_turno_id text, p_items jsonb, p_pagos jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_venta_id text := gen_random_uuid()::text;
  v_item_id text;
  v_item jsonb;
  v_pago jsonb;
  v_var record;
  v_row record;
  v_promo record;
  v_cant integer;
  v_idx integer := 0;
  v_i integer;
  v_subtotal numeric := 0;
  v_recargo numeric := 0;
  v_suma_base numeric := 0;
  v_base numeric;
  v_monto numeric;
  v_pct numeric;
  v_pct_venta numeric := 0;
  v_debito numeric;
  v_credito numeric;
  v_metodos text := '';
  v_n_pagos integer;
  v_unidades integer := 0;
  v_regs numeric[];
  v_ns integer[];
  v_res numeric[];
  v_ahorro numeric := 0;
  v_ahora timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- Marca esta transacción como "venta": la auditoría de la sección 7 ignora los cambios internos de stock y totales
  perform set_config('zerozed.en_venta', '1', true);
  if not public.es_usuario() then
    raise exception 'No autorizado';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' then
    raise exception 'Falta el método de pago';
  end if;
  v_n_pagos := jsonb_array_length(p_pagos);
  if v_n_pagos not in (1, 2) then
    raise exception 'El pago admite uno o dos métodos';
  end if;
  if not exists (select 1 from public.turnos where id = p_turno_id and abierto) then
    raise exception 'No hay un turno abierto';
  end if;

  if v_n_pagos = 2 then
    if (select count(*) from jsonb_array_elements(p_pagos) x where x->>'metodo' = 'Efectivo') <> 1
       or (select count(*) from jsonb_array_elements(p_pagos) x where x->>'metodo' = 'Mercado Pago') <> 1 then
      raise exception 'El pago dividido es solo Efectivo + Mercado Pago';
    end if;
  end if;

  select debito_pct, credito_pct into v_debito, v_credito from public.config where id = 1;

  insert into public.ventas (id, fecha, hora, turno_id, metodo_pago, subtotal, recargo_pct, total, usuario_id)
  values (v_venta_id, v_ahora::date, date_trunc('minute', v_ahora)::time, p_turno_id, '', 0, 0, 0, auth.uid());

  -- Una fila por UNIDAD vendida (así las promociones pueden repartir el precio unidad por unidad)
  drop table if exists _zz_unidades;
  create temp table _zz_unidades (
    n serial,
    variante_id text,
    producto_id text,
    nombre text,
    categoria text,
    label text,
    codigo text,
    talle text,
    color text,
    costo numeric,
    reg numeric,
    precio numeric,
    promo_id text,
    promo_nombre text
  ) on commit drop;

  -- Ítems: valida stock, descuenta y arma las unidades
  for v_item in select jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::integer;
    if v_cant is null or v_cant < 1 then
      raise exception 'Cantidad inválida';
    end if;

    select v.id as variante_id, v.producto_id, v.talle, v.color, v.codigo, v.stock,
           p.nombre, p.descripcion, p.categoria, p.precio, c.costo
      into v_var
      from public.variantes v
      join public.productos p on p.id = v.producto_id
      left join public.productos_costos c on c.producto_id = p.id
      where v.id = (v_item->>'variante_id')
      for update of v;

    if not found then
      raise exception 'No se encontró una de las prendas';
    end if;
    if v_var.stock < v_cant then
      raise exception 'No hay stock suficiente de % (quedan %)', v_var.nombre, v_var.stock;
    end if;

    update public.variantes
       set stock = stock - v_cant,
           etiquetas_pendientes = greatest(0, etiquetas_pendientes - v_cant)
     where id = v_var.variante_id;

    insert into _zz_unidades (variante_id, producto_id, nombre, categoria, label, codigo, talle, color, costo, reg, precio, promo_id)
    select v_var.variante_id, v_var.producto_id,
           v_var.nombre || case when coalesce(v_var.descripcion,'') <> '' then ' (' || v_var.descripcion || ')' else '' end,
           coalesce(v_var.categoria,''),
           coalesce(nullif(concat_ws(' / ', nullif(nullif(v_var.talle,''),'-'), nullif(nullif(v_var.color,''),'-')), ''), 'Único'),
           coalesce(v_var.codigo,''), coalesce(v_var.talle,''), coalesce(v_var.color,''),
           coalesce(v_var.costo, 0), v_var.precio, v_var.precio,
           public.promo_aplicable(v_var.producto_id, v_var.categoria, v_hoy)
      from generate_series(1, v_cant);

    v_unidades := v_unidades + v_cant;
  end loop;

  -- Promociones: cada promoción reparte su precio entre sus unidades (las más caras primero)
  for v_promo in
    select pr.id, pr.nombre, pr.niveles
      from public.promociones pr
     where pr.id in (select distinct u.promo_id from _zz_unidades u where u.promo_id is not null)
  loop
    select array_agg(round(u.reg) order by round(u.reg) desc, u.n),
           array_agg(u.n order by round(u.reg) desc, u.n)
      into v_regs, v_ns
      from _zz_unidades u
     where u.promo_id = v_promo.id;

    v_res := public.promo_precios(v_regs, v_promo.niveles);
    for v_i in 1..array_length(v_ns, 1) loop
      update _zz_unidades set precio = v_res[v_i] where n = v_ns[v_i];
    end loop;
    update _zz_unidades set promo_nombre = v_promo.nombre where promo_id = v_promo.id;
  end loop;

  -- Ítems de la venta: unidades iguales (misma prenda y mismo precio) se agrupan en una fila
  for v_row in
    select u.variante_id, u.producto_id, u.nombre, u.categoria, u.label, u.codigo, u.talle, u.color,
           u.costo, u.reg, u.precio, coalesce(u.promo_nombre, '') as promo_nombre,
           count(*)::integer as cant, min(u.n) as primero
      from _zz_unidades u
     group by u.variante_id, u.producto_id, u.nombre, u.categoria, u.label, u.codigo, u.talle, u.color,
              u.costo, u.reg, u.precio, u.promo_nombre
     order by min(u.n), u.precio desc
  loop
    v_item_id := gen_random_uuid()::text;
    insert into public.venta_items
      (id, venta_id, idx, producto_id, variante_id, nombre, categoria, variante_label, codigo, talle, color, cantidad, precio_unit, precio_lista, promo)
    values
      (v_item_id, v_venta_id, v_idx, v_row.producto_id, v_row.variante_id, v_row.nombre, v_row.categoria, v_row.label,
       v_row.codigo, v_row.talle, v_row.color, v_row.cant, v_row.precio, v_row.reg,
       case when v_row.precio < v_row.reg then v_row.promo_nombre else '' end);
    insert into public.venta_items_costos (item_id, costo_unit) values (v_item_id, v_row.costo);

    v_subtotal := v_subtotal + v_row.precio * v_row.cant;
    v_ahorro := v_ahorro + (v_row.reg - v_row.precio) * v_row.cant;
    v_idx := v_idx + 1;
  end loop;

  -- Pagos: aplica recargo de tarjeta solo a la parte que se paga con tarjeta
  for v_pago in select jsonb_array_elements(p_pagos) loop
    if (v_pago->>'metodo') is null or (v_pago->>'metodo') not in ('Efectivo','Mercado Pago','Débito','Crédito') then
      raise exception 'Método de pago inválido';
    end if;
    v_base := round(coalesce((v_pago->>'base')::numeric, case when v_n_pagos = 1 then v_subtotal end));
    if v_base is null or v_base <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_pct := case v_pago->>'metodo' when 'Débito' then v_debito when 'Crédito' then v_credito else 0 end;
    v_monto := v_base + round(v_base * v_pct / 100);
    v_recargo := v_recargo + (v_monto - v_base);
    v_suma_base := v_suma_base + v_base;
    if v_n_pagos = 1 then v_pct_venta := v_pct; end if;

    insert into public.venta_pagos (venta_id, metodo, monto) values (v_venta_id, v_pago->>'metodo', v_monto);
    v_metodos := case when v_metodos = '' then v_pago->>'metodo' else v_metodos || ' + ' || (v_pago->>'metodo') end;
  end loop;

  if v_suma_base <> round(v_subtotal) then
    raise exception 'Los pagos no suman el subtotal (pagos %, subtotal %). Si hay promociones, actualizá la página e intentá de nuevo', v_suma_base, round(v_subtotal);
  end if;

  update public.ventas
     set metodo_pago = v_metodos, subtotal = v_subtotal, recargo_pct = v_pct_venta, total = v_subtotal + v_recargo
   where id = v_venta_id;

  insert into public.movimientos (rol, accion, detalle)
  values (public.rol_actual(), 'Venta', '$' || round(v_subtotal + v_recargo)::text || ' · ' || v_unidades || ' prenda(s) · ' || v_metodos
          || case when v_ahorro > 0 then ' · promo -$' || round(v_ahorro)::text else '' end);

  return v_venta_id;
end;
$$;

revoke execute on function public.registrar_venta(text, jsonb, jsonb) from public, anon;
grant execute on function public.registrar_venta(text, jsonb, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4b) FACTURAS A CONSUMIDOR FINAL (pedidos que se mandan al contador)
--     El empleado solo crea el pedido al vender; solo el ADMIN los ve,
--     los pasa al contador y los marca como enviados al cliente.
-- ---------------------------------------------------------------------
create table if not exists public.solicitudes_factura (
  id text primary key default gen_random_uuid()::text,
  venta_id text references public.ventas(id) on delete set null,
  fecha date not null,
  total numeric(14,2) not null default 0,
  nombre text not null,
  documento_tipo text not null default 'DNI',
  documento text not null,
  email text not null default '',
  telefono text not null default '',
  domicilio text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente','enviada_contador','facturada','enviada_cliente')),
  nro_comprobante text not null default '',
  fecha_envio_contador date,
  fecha_factura date,
  fecha_envio_cliente date,
  usuario_id uuid default auth.uid(),
  creado_en timestamptz not null default now()
);
create index if not exists solicitudes_factura_estado_idx on public.solicitudes_factura (estado);

alter table public.solicitudes_factura enable row level security;
drop policy if exists crear_solicitud_factura on public.solicitudes_factura;
drop policy if exists admin_solicitudes_factura on public.solicitudes_factura;
create policy crear_solicitud_factura on public.solicitudes_factura
  for insert to authenticated with check (public.es_usuario());
create policy admin_solicitudes_factura on public.solicitudes_factura
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
revoke all on public.solicitudes_factura from anon;


-- ---------------------------------------------------------------------
-- 4c) BORRADO AUTOMÁTICO DE FACTURAS TERMINADAS (a los 21 días)
--     Por privacidad: borra SOLO la solicitud con los datos del cliente
--     (DNI, teléfono, mail, domicilio) cuando ya pasaron 21 días desde que
--     se envió la factura al cliente. No toca la venta ni el stock.
--     Corre todos los días a las 06:00 UTC (03:00 de Argentina).
--     Requiere la extensión pg_cron. Si no se puede activar sola, avisa
--     (no rompe el resto): activala en Database > Extensions > pg_cron
--     y volvé a ejecutar este archivo.
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;

  perform cron.unschedule(jobid) from cron.job where jobname = 'borrar-facturas-terminadas';

  perform cron.schedule(
    'borrar-facturas-terminadas',
    '0 6 * * *',
    $job$ delete from public.solicitudes_factura
          where estado = 'enviada_cliente'
            and coalesce(fecha_envio_cliente, creado_en::date) < current_date - 21 $job$
  );
exception when others then
  raise notice 'No se pudo programar el borrado automático de facturas (activá pg_cron en Database > Extensions y volvé a ejecutar): %', sqlerrm;
end $$;


-- ---------------------------------------------------------------------
-- 5) VER LAS VENTAS EN VIVO DESDE EL CELULAR (opcional)
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.ventas;
exception when others then
  null;
end $$;


-- ---------------------------------------------------------------------
-- 6) TU USUARIO ADMIN
--    (Va al final porque necesita que la tabla "perfiles" ya exista.
--     Si tu usuario todavía no está creado en Authentication > Users,
--     esta línea no hace nada: créalo y volvé a ejecutarla.)
-- ---------------------------------------------------------------------
-- Poné acá el mail de cada administrador (los demás quedan como empleados).
update public.perfiles set rol = 'admin'
where id in (select id from auth.users where email in ('admin@zerozed.app'));


-- ---------------------------------------------------------------------
-- 7) ENDURECIMIENTO
--     A) Los precios SOLO los cambia el administrador.
--        Si un empleado intenta cambiar un precio, la base lo ignora (queda el precio
--        anterior) y deja una línea en el registro de movimientos.
--     B) Auditoría hecha por la BASE (no por el navegador): precios, stock,
--        prendas eliminadas y ventas corregidas o borradas quedan registradas
--        en "movimientos" con el prefijo [Base]. Un empleado no puede evitarlo.
--        Las ventas normales NO generan líneas extra (ya tienen su propia línea "Venta").
-- ---------------------------------------------------------------------
-- A) Precios solo para el admin ---------------------------------------
create or replace function public.trg_productos_precio_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_intento numeric := new.precio;
begin
  -- auth.uid() es NULL cuando se ejecuta desde el SQL Editor: ahí se permite todo.
  if tg_op = 'UPDATE'
     and new.precio is distinct from old.precio
     and auth.uid() is not null
     and not public.es_admin() then
    new.precio := old.precio;
    insert into public.movimientos (rol, accion, detalle)
    values (public.rol_actual(), '[Base] Cambio de precio bloqueado',
            old.nombre || ': intentó cambiar $' || old.precio::text || ' por $' || v_intento::text || ' (solo el administrador puede)');
  end if;
  return new;
end $$;

drop trigger if exists productos_precio_admin on public.productos;
create trigger productos_precio_admin
  before update on public.productos
  for each row execute function public.trg_productos_precio_solo_admin();


-- B) Auditoría desde la base ------------------------------------------
-- (registrar_venta marca su transacción, así sus cambios internos no se duplican en el registro)
create or replace function public.trg_aud_productos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_rol text := coalesce(nullif(public.rol_actual(), ''), 'sistema');
begin
  if tg_op = 'UPDATE' then
    if new.precio is distinct from old.precio then
      insert into public.movimientos (rol, accion, detalle)
      values (v_rol, '[Base] Precio cambiado', new.nombre || ': $' || old.precio::text || ' → $' || new.precio::text);
    end if;
    return new;
  end if;
  insert into public.movimientos (rol, accion, detalle)
  values (v_rol, '[Base] Prenda eliminada', old.nombre || ' (precio $' || old.precio::text || ')');
  return old;
end $$;

drop trigger if exists productos_auditoria on public.productos;
create trigger productos_auditoria
  after update of precio or delete on public.productos
  for each row execute function public.trg_aud_productos();

create or replace function public.trg_aud_variantes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := coalesce(nullif(public.rol_actual(), ''), 'sistema');
  v_nombre text;
  v_label text;
begin
  if current_setting('zerozed.en_venta', true) = '1' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if new.stock is distinct from old.stock then
      select nombre into v_nombre from public.productos where id = new.producto_id;
      v_label := coalesce(nullif(concat_ws(' / ', nullif(nullif(new.talle,''),'-'), nullif(nullif(new.color,''),'-')), ''), 'Único');
      insert into public.movimientos (rol, accion, detalle)
      values (v_rol, '[Base] Stock modificado', coalesce(v_nombre, '?') || ' · ' || v_label || ': ' || old.stock::text || ' → ' || new.stock::text);
    end if;
    return new;
  end if;

  -- DELETE: si se borró la prenda entera, ya queda la línea "Prenda eliminada"
  select nombre into v_nombre from public.productos where id = old.producto_id;
  if v_nombre is not null then
    v_label := coalesce(nullif(concat_ws(' / ', nullif(nullif(old.talle,''),'-'), nullif(nullif(old.color,''),'-')), ''), 'Único');
    insert into public.movimientos (rol, accion, detalle)
    values (v_rol, '[Base] Talle/color eliminado', v_nombre || ' · ' || v_label || ' (stock ' || old.stock::text || ')');
  end if;
  return old;
end $$;

drop trigger if exists variantes_auditoria on public.variantes;
create trigger variantes_auditoria
  after update of stock or delete on public.variantes
  for each row execute function public.trg_aud_variantes();

create or replace function public.trg_aud_ventas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_rol text := coalesce(nullif(public.rol_actual(), ''), 'sistema');
begin
  if current_setting('zerozed.en_venta', true) = '1' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    insert into public.movimientos (rol, accion, detalle)
    values (v_rol, '[Base] Venta modificada', 'Venta ' || left(old.id, 8) || ' del ' || old.fecha::text || ': $' || old.total::text || ' → $' || new.total::text);
    return new;
  end if;
  insert into public.movimientos (rol, accion, detalle)
  values (v_rol, '[Base] Venta eliminada', 'Venta ' || left(old.id, 8) || ' del ' || old.fecha::text || ' por $' || old.total::text);
  return old;
end $$;

drop trigger if exists ventas_auditoria on public.ventas;
create trigger ventas_auditoria
  after update of total, subtotal, metodo_pago or delete on public.ventas
  for each row execute function public.trg_aud_ventas();


-- ---------------------------------------------------------------------
-- 8) BORRAR TODO (botón de Ajustes > Zona de riesgo)
--    Solo el administrador. Borra en una sola operación productos, stock,
--    ventas, devoluciones, turnos, compras y solicitudes de factura.
--    Se conservan: configuración (nombre, recargos, categorías), usuarios
--    y el registro de movimientos (donde queda anotado el borrado).
-- ---------------------------------------------------------------------
create or replace function public.borrar_todo()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede borrar todo';
  end if;
  -- Evita que la auditoría anote un movimiento por cada fila borrada
  perform set_config('zerozed.en_venta', '1', true);
  delete from public.solicitudes_factura where true;
  delete from public.devoluciones where true;   -- se van también sus líneas
  delete from public.ventas where true;         -- se van también ítems, costos y pagos
  delete from public.compras where true;        -- se van también sus líneas
  delete from public.turnos where true;         -- se van también sus gastos
  delete from public.productos where true;      -- se van también costos y variantes
  delete from public.promociones where true;
  insert into public.movimientos (rol, accion, detalle)
  values ('admin', 'Datos borrados', 'Se borraron todos los datos del sistema');
end $$;
revoke all on function public.borrar_todo() from public, anon;
grant execute on function public.borrar_todo() to authenticated;


-- =====================================================================
-- PASOS MANUALES (solo si es una instalación nueva)
--
-- 1) Authentication > Users > "Add user": creá una cuenta por persona con un MAIL INTERNO:
--    usuario@zerozed.app (el dominio es DOMINIO_INTERNO de frontend/js/core/config.js).
--    Ej.: lucia@zerozed.app + contraseña. Marcá "Auto Confirm User".
--    Cada persona entra al programa escribiendo solo su USUARIO ("lucia") y su contraseña.
--    Para el administrador: creá admin@zerozed.app y cambiá el mail del UPDATE de la sección 6
--    (o dejá tu mail actual: el programa también acepta un mail completo en el campo Usuario).
-- 2) DESACTIVÁ los registros públicos en Authentication (opción para permitir
--    nuevos usuarios / sign ups). Si queda activa, cualquiera podría crearse
--    una cuenta.
--
-- 3) SEGURIDAD EN AUTHENTICATION (panel de Supabase): contraseñas de 12 o más
--    caracteres, y no dejar direcciones de redirección con comodines (*).
-- 3c) CAPTCHA: Authentication > Attack Protection > "Enable CAPTCHA protection" >
--    proveedor Cloudflare Turnstile, y pegá la "Secret key". La "Site key" va en
--    TURNSTILE_SITE_KEY de frontend/js/core/config.js (ver LEEME_SEGURIDAD.md).
-- 4) Si volvés a correr este archivo, no hace falta hacer nada más: es seguro repetirlo.
-- =====================================================================

-- Para ver quién es quién (resultado de control):
select usuario, rol from public.perfiles order by usuario;
