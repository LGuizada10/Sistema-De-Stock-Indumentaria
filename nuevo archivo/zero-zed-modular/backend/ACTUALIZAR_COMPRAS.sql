-- Actualización segura del módulo de compras:
-- agrega índices y búsqueda paginada directa en Supabase. No modifica ni borra compras.
create index if not exists compras_fecha_reciente_idx
  on public.compras (fecha desc, creado_en desc, id desc);

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

do $$
declare v_opclass_schema text;
begin
  select n.nspname into v_opclass_schema
    from pg_opclass oc
    join pg_am am on am.oid=oc.opcmethod
    join pg_namespace n on n.oid=oc.opcnamespace
   where oc.opcname='gin_trgm_ops' and am.amname='gin'
   limit 1;
  if v_opclass_schema is not null then
    execute format(
      'create index if not exists compras_busqueda_trgm_idx on public.compras using gin (lower(coalesce(descripcion, '''') || '' '' || coalesce(lugar, '''') || '' '' || coalesce(proveedor, '''') || '' '' || coalesce(direccion, '''') || '' '' || coalesce(telefono, '''') || '' '' || coalesce(notas, '''')) %I.gin_trgm_ops)',
      v_opclass_schema
    );
  end if;
end $$;

create or replace function public.buscar_compras(
  p_termino text default '',
  p_limite integer default 20,
  p_offset integer default 0,
  p_fecha date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_termino text := lower(btrim(coalesce(p_termino,'')));
  v_total bigint;
  v_items jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede consultar compras';
  end if;

  select count(*) into v_total
    from public.compras c
   where (p_fecha is null or c.fecha=p_fecha)
     and (v_termino = '' or lower(coalesce(c.descripcion,'')||' '||coalesce(c.lugar,'')||' '||coalesce(c.proveedor,'')||' '||coalesce(c.direccion,'')||' '||coalesce(c.telefono,'')||' '||coalesce(c.notas,'')) like '%'||v_termino||'%');

  select coalesce(jsonb_agg(q.compra order by q.fecha desc,q.creado_en desc,q.id desc),'[]'::jsonb)
    into v_items
    from (
      select c.id,c.fecha,c.creado_en,
             to_jsonb(c)||jsonb_build_object('lineas',coalesce((
               select jsonb_agg(to_jsonb(l) order by l.id)
                 from public.compra_lineas l where l.compra_id=c.id
             ),'[]'::jsonb)) as compra
        from public.compras c
       where (p_fecha is null or c.fecha=p_fecha)
       and (v_termino = '' or lower(coalesce(c.descripcion,'')||' '||coalesce(c.lugar,'')||' '||coalesce(c.proveedor,'')||' '||coalesce(c.direccion,'')||' '||coalesce(c.telefono,'')||' '||coalesce(c.notas,'')) like '%'||v_termino||'%')
       order by c.fecha desc,c.creado_en desc,c.id desc
       limit greatest(1,least(coalesce(p_limite,20),50))
      offset greatest(0,coalesce(p_offset,0))
    ) q;

  return jsonb_build_object('total',v_total,'items',v_items);
end;
$$;

revoke all on function public.buscar_compras(text,integer,integer,date) from public, anon;
grant execute on function public.buscar_compras(text,integer,integer,date) to authenticated;
