// [ZZ] data/supabase.js — CAPA DE DATOS: conexión a Supabase, carga (traer/cargarTodo), guardado de cambios (empujar/sincronizar) e indicador de sincronización.
/* ===== SUPABASE: conexión, carga y guardado ===== */
const SB_URL = 'https://ndexfoslbshazovtziza.supabase.co';
const SB_KEY = 'sb_publishable_LEABL-p-_wzOBkw2EHMJRA_bWeoikPf';
const sb = supabase.createClient(SB_URL, SB_KEY);
const N = x => Number(x)||0;
const T = x => (x===''||x==null) ? null : x;
const H = x => x ? String(x).slice(0,5) : '';
const suf = id => parseInt(String(id).split(/-[gl]/).pop())||0;
const ordFH = (a,b) => (a.fecha+(a.hora||'')).localeCompare(b.fecha+(b.hora||''));
const ordCreado = (a,b) => String(a.creado_en).localeCompare(String(b.creado_en));
const ORDEN = ['productos','productos_costos','variantes','turnos','turno_gastos','devoluciones','devolucion_lineas','compras','compra_lineas'];
const PK = {productos_costos:'producto_id'};
const pk = t => PK[t]||'id';
let snap = {mov:new Set(), cfg:null}, cola = Promise.resolve();
const TABLAS_CATALOGO = new Set(['productos','productos_costos','variantes']);
const SUCIO_CATALOGO = {productos:new Set(), productos_costos:new Set(), variantes:new Set()};
const BORRADO_CATALOGO = {productos:new Set(), productos_costos:new Set(), variantes:new Set()};
let catalogoCompletoSucio = false;
let catalogoCompletoEnMemoria = false;
let resumenCatalogoCache=null, resumenCatalogoCacheAt=0;
let indiceProductos = new Map(), indiceVariantes = new Map(), indiceProductosPorNombre = new Map(), nombreIndexadoPorId = new Map(), indiceCatalogoOrigen = null;
let timerGuardado = null;
const TAMANO_PAGINA = 1000, PAGINAS_PARALELAS = 4;
let lecturasActivas=0, colaLecturas=[];
async function conLimiteLecturas(trabajo){
  if(lecturasActivas>=6) await new Promise(resolve=>colaLecturas.push(resolve));
  lecturasActivas++;
  try{ return await trabajo(); }
  finally{ lecturasActivas--; const siguiente=colaLecturas.shift(); if(siguiente) siguiente(); }
}

function reconstruirIndiceCatalogo(){
  indiceProductos = new Map(); indiceVariantes = new Map(); indiceProductosPorNombre = new Map(); nombreIndexadoPorId = new Map();
  for(const p of state.productos||[]){
    indiceProductos.set(p.id,p);
    indexarNombreProducto(p);
    for(const v of p.variantes||[]) indiceVariantes.set(v.id,{producto:p,variante:v});
  }
  indiceCatalogoOrigen = state.productos;
}
function asegurarIndiceCatalogo(){ if(indiceCatalogoOrigen!==state.productos) reconstruirIndiceCatalogo(); }
function productoPorId(id){ asegurarIndiceCatalogo(); return indiceProductos.get(id)||null; }
function indexarNombreProducto(producto){
  if(!producto) return;
  if(nombreIndexadoPorId.has(producto.id)){
    const anterior=nombreIndexadoPorId.get(producto.id), lista=indiceProductosPorNombre.get(anterior)||[];
    const restante=lista.filter(p=>p.id!==producto.id); if(restante.length) indiceProductosPorNombre.set(anterior,restante); else indiceProductosPorNombre.delete(anterior);
  }
  const nombre=(producto.nombre||'').trim().toLowerCase();
  nombreIndexadoPorId.set(producto.id,nombre);
  const lista=indiceProductosPorNombre.get(nombre)||[]; if(!lista.some(p=>p.id===producto.id)) lista.push(producto); indiceProductosPorNombre.set(nombre,lista);
}
function desindexarNombreProducto(producto){
  if(!producto||!nombreIndexadoPorId.has(producto.id)) return;
  const nombre=nombreIndexadoPorId.get(producto.id), lista=(indiceProductosPorNombre.get(nombre)||[]).filter(p=>p.id!==producto.id);
  if(lista.length) indiceProductosPorNombre.set(nombre,lista); else indiceProductosPorNombre.delete(nombre);
  nombreIndexadoPorId.delete(producto.id);
}
function productosPorNombre(nombre){ asegurarIndiceCatalogo(); return indiceProductosPorNombre.get((nombre||'').trim().toLowerCase())||[]; }
function marcarProductoSucio(producto){
  if(!producto) return;
  invalidarResumenCatalogo();
  asegurarIndiceCatalogo(); indiceProductos.set(producto.id,producto);
  indexarNombreProducto(producto);
  if(typeof invalidarTextoProducto==='function') invalidarTextoProducto(producto);
  SUCIO_CATALOGO.productos.add(producto.id); BORRADO_CATALOGO.productos.delete(producto.id);
  if(session==='admin'){ SUCIO_CATALOGO.productos_costos.add(producto.id); BORRADO_CATALOGO.productos_costos.delete(producto.id); }
}
function marcarVarianteSucia(producto,variante){
  if(!producto||!variante) return;
  invalidarResumenCatalogo();
  asegurarIndiceCatalogo(); indiceProductos.set(producto.id,producto); indiceVariantes.set(variante.id,{producto,variante});
  if(typeof registrarVarianteEnIndiceBusqueda==='function') registrarVarianteEnIndiceBusqueda(producto,variante);
  SUCIO_CATALOGO.variantes.add(variante.id); BORRADO_CATALOGO.variantes.delete(variante.id);
}
function marcarVariantePorIdSucia(id){
  asegurarIndiceCatalogo(); const ref=indiceVariantes.get(id); if(ref) marcarVarianteSucia(ref.producto,ref.variante);
}
function marcarVarianteEliminada(producto,variante){
  if(!producto||!variante) return;
  invalidarResumenCatalogo();
  asegurarIndiceCatalogo(); indiceVariantes.delete(variante.id);
  if(typeof quitarVarianteDelIndiceBusqueda==='function') quitarVarianteDelIndiceBusqueda(producto,variante);
  SUCIO_CATALOGO.variantes.delete(variante.id); BORRADO_CATALOGO.variantes.add(variante.id);
}
function marcarProductoEliminado(producto){
  if(!producto) return;
  invalidarResumenCatalogo();
  asegurarIndiceCatalogo(); indiceProductos.delete(producto.id);
  desindexarNombreProducto(producto);
  SUCIO_CATALOGO.productos.delete(producto.id); BORRADO_CATALOGO.productos.add(producto.id);
  if(session==='admin'){ SUCIO_CATALOGO.productos_costos.delete(producto.id); BORRADO_CATALOGO.productos_costos.add(producto.id); }
  for(const v of producto.variantes||[]) marcarVarianteEliminada(producto,v);
}
function marcarCatalogoCompletoSucio(){
  catalogoCompletoSucio=true;
  catalogoCompletoEnMemoria=true;
  invalidarResumenCatalogo();
  for(const tabla of Object.keys(SUCIO_CATALOGO)){ SUCIO_CATALOGO[tabla].clear(); BORRADO_CATALOGO[tabla].clear(); }
  reconstruirIndiceCatalogo();
  if(typeof invalidarIndicesBusqueda==='function') invalidarIndicesBusqueda();
}
function limpiarCatalogoSucio(){
  catalogoCompletoSucio=false;
  for(const tabla of Object.keys(SUCIO_CATALOGO)){ SUCIO_CATALOGO[tabla].clear(); BORRADO_CATALOGO[tabla].clear(); }
}

async function traerPaginas(consulta){
  const salida=[];
  for(let base=0;;base+=TAMANO_PAGINA*PAGINAS_PARALELAS){
    const paginas=await Promise.all(Array.from({length:PAGINAS_PARALELAS},(_,i)=>{
      const inicio=base+i*TAMANO_PAGINA;
      return conLimiteLecturas(()=>consulta().range(inicio,inicio+TAMANO_PAGINA-1)).then(({data,error})=>{
        if(error) throw error;
        return data||[];
      });
    }));
    for(const pagina of paginas){ salida.push(...pagina); if(pagina.length<TAMANO_PAGINA) return salida; }
  }
}

/* Historial: por defecto se cargan solo los últimos 60 días de ventas, devoluciones y movimientos.
   Si se elige una fecha más vieja, asegurarHistorialDesde() amplía la ventana y vuelve a cargar. */
let historialDesde = null;
/* Por defecto: últimos 60 días, redondeado al primer día de ese mes (así el mes más viejo siempre está completo). */
function desdeHistorial(){ return historialDesde || fechaSumandoDias(todayStr(), -60).slice(0,7)+'-01'; }
/* El admin necesita 12 meses para el gráfico de ganancia por mes */
function mesesParaGrafico(){ return mesSumando(gananciaMes, -11)+'-01'; }
/* Igual que traer(), pero solo filas con fecha >= desde. Si el filtro anidado falla, cae a cargar todo (como antes). */
async function traerDesde(t, desde, orden, sel, col){
  try{
    return await traerPaginas(()=>sb.from(t).select(sel||'*').gte(col||'fecha', desde).order(orden||'id'));
  }catch(e){
    console.warn('Filtro por fecha falló en '+t+', se carga todo:', e);
    return traer(t, orden);
  }
}
async function asegurarHistorialDesde(fecha){
  if(!fecha || fecha >= desdeHistorial()) return;
  historialDesde = fecha.slice(0,7)+'-01';       /* desde el primer día de ese mes */
  showToast('Cargando historial desde '+historialDesde+'…');
  try{ await sincronizar(); await cargarTodo(); renderAll(); }catch(e){ showToast('No se pudo cargar el historial: '+(e.message||e)); }
}
async function traer(t, orden){
  return traerPaginas(()=>sb.from(t).select('*').order(orden||'id'));
}
function productoDesdeFila(p){
  return {id:p.id, num:p.num||null, nombre:p.nombre, descripcion:p.descripcion||'', categoria:p.categoria||'', precio:N(p.precio), costo:N(p.costo), variantes:(p.variantes||[]).map(v=>({id:v.id,talle:v.talle||'',color:v.color||'',codigo:v.codigo||'',stock:N(v.stock),etiquetas_pendientes:N(v.etiquetas_pendientes)}))};
}
function mezclarCatalogoEnEstado(productos){
  asegurarIndiceCatalogo();
  for(const nuevo of productos){
    if(BORRADO_CATALOGO.productos.has(nuevo.id)) continue;
    const actual=indiceProductos.get(nuevo.id);
    if(actual && (SUCIO_CATALOGO.productos.has(nuevo.id)||nuevo.variantes.some(v=>SUCIO_CATALOGO.variantes.has(v.id)))) continue;
    if(actual){
      const idx=state.productos.indexOf(actual);
      if(idx>=0) state.productos[idx]=nuevo;
    }else state.productos.push(nuevo);
  }
  reconstruirIndiceCatalogo();
  if(typeof invalidarIndicesBusqueda==='function') invalidarIndicesBusqueda();
}
async function consultarCatalogo(termino='', categoria='', offset=0, limite=30){
  const {data,error}=await sb.rpc('buscar_catalogo',{p_termino:termino||'',p_categoria:categoria||'',p_limite:limite,p_offset:offset});
  if(error) throw new Error('No se pudo consultar el catálogo en Supabase. Ejecutá el SQL actualizado: '+error.message);
  const productos=(data?.items||[]).map(productoDesdeFila);
  mezclarCatalogoEnEstado(productos);
  return {productos:productos.filter(p=>!BORRADO_CATALOGO.productos.has(p.id)).map(p=>productoPorId(p.id)||p),total:Number(data?.total)||0};
}
async function consultarResumenCatalogo(){
  if(resumenCatalogoCache && Date.now()-resumenCatalogoCacheAt<45000) return resumenCatalogoCache;
  const {data,error}=await sb.rpc('resumen_catalogo');
  if(error) throw new Error('No se pudo cargar el resumen del catálogo: '+error.message);
  resumenCatalogoCache=data||{}; resumenCatalogoCacheAt=Date.now(); return resumenCatalogoCache;
}
function invalidarResumenCatalogo(){resumenCatalogoCache=null;resumenCatalogoCacheAt=0;if(typeof stockResumenNube!=='undefined')stockResumenNube=null;}
async function asegurarCatalogoCompleto(){
  if(catalogoCompletoEnMemoria) return state.productos;
  await sincronizar();
  if(estadoSync==='error') throw new Error('Hay cambios pendientes de guardar; revisá la conexión antes de cargar todo el catálogo');
  const adm=session==='admin', vacio=Promise.resolve([]);
  const [pr,va,co]=await Promise.all([traer('productos','creado_en'),traer('variantes','creado_en'),adm?traer('productos_costos','producto_id'):vacio]);
  const cm=Object.fromEntries(co.map(x=>[x.producto_id,N(x.costo)])), pm={};
  const productos=pr.sort(ordCreado).map(p=>pm[p.id]={id:p.id,num:p.num||null,nombre:p.nombre,descripcion:p.descripcion||'',categoria:p.categoria||'',precio:N(p.precio),costo:cm[p.id]||0,variantes:[]} );
  va.sort(ordCreado).forEach(v=>{ if(pm[v.producto_id]) pm[v.producto_id].variantes.push({id:v.id,talle:v.talle,color:v.color,codigo:v.codigo,stock:v.stock,etiquetas_pendientes:v.etiquetas_pendientes}); });
  state.productos=productos;
  reconstruirIndiceCatalogo();
  if(typeof invalidarIndicesBusqueda==='function') invalidarIndicesBusqueda();
  state.etiquetasPendientes={};
  for(const p of productos) for(const v of p.variantes) if(v.etiquetas_pendientes>0) state.etiquetasPendientes[v.id]=v.etiquetas_pendientes;
  catalogoCompletoEnMemoria=true;
  invalidarResumenCatalogo();
  return state.productos;
}
function configFila(){ const c=state.config; return {nombre_local:c.nombreLocal, debito_pct:N(c.debitoPct), credito_pct:N(c.creditoPct), categorias:c.categorias||[]}; }
function filaProducto(p){ return {id:p.id, num:p.num||null, nombre:p.nombre, descripcion:p.descripcion||'', categoria:p.categoria||'', precio:N(p.precio)}; }
function filaCosto(p){ return {producto_id:p.id, costo:N(p.costo)}; }
function filaVariante(p,v){ return {id:v.id, producto_id:p.id, talle:v.talle||'', color:v.color||'', codigo:v.codigo||'', stock:Math.max(0,Math.floor(N(v.stock))), etiquetas_pendientes:Math.max(0,Math.floor(N(state.etiquetasPendientes[v.id])))}; }
function filasNube(opciones){
  const r={}, P=state.productos, adm=session==='admin';
  if(!opciones || opciones.catalogo!==false){
    r.productos = P.map(filaProducto);
    if(adm) r.productos_costos = P.map(filaCosto);
    r.variantes = P.flatMap(p=>p.variantes.map(v=>filaVariante(p,v)));
  }
  r.turnos = state.turnos.map(t=>({id:t.id, fecha:t.fecha, turno:t.turno||'', cambio_inicial:N(t.cambioInicial), cambio_final:t.cambioFinal==null?null:N(t.cambioFinal), efectivo_esperado:t.efectivoEsperado==null?null:N(t.efectivoEsperado), abierto:!!t.abierto, hora_apertura:T(t.horaApertura), hora_cierre:T(t.horaCierre)}));
  r.turno_gastos = state.turnos.flatMap(t=>(t.gastos||[]).map((g,i)=>({id:t.id+'-g'+i, turno_id:t.id, tipo:'gasto', descripcion:g.desc||'', monto:N(g.monto), hora:T(g.hora)})));
  r.devoluciones = state.devoluciones.map(x=>({id:x.id, fecha:x.fecha, hora:T(x.hora), venta_id:T(x.ventaId), venta_fecha:T(x.ventaFecha), item_idx:x.itemIdx==null?null:N(x.itemIdx), producto_id:T(x.productoId), variante_id:T(x.varianteId), nombre:x.nombre||'', variante_label:x.varianteLabel||'', codigo:x.codigo||'', cantidad:N(x.cantidad)||1, monto_devuelto:N(x.montoDevuelto), tipo:x.tipo||'devolucion', monto_nuevo:N(x.montoNuevo), monto_diferencia:N(x.montoDiferencia), motivo:x.motivo||'', reintegro:x.reintegro||'', metodo_diferencia:x.metodoDiferencia||'', turno_id:T(x.turnoId)}));
  r.devolucion_lineas = state.devoluciones.flatMap(x=>(x.productosNuevos||[]).map((l,i)=>({id:x.id+'-l'+i, devolucion_id:x.id, orden:i, producto_id:T(l.productoId), variante_id:T(l.varianteId), nombre:l.nombre||'', variante_label:l.varianteLabel||'', codigo:l.codigo||'', cantidad:N(l.cantidad)||1, precio_unit:N(l.precioUnit)})));
  if(adm){
    r.compras = state.compras.map(c=>({id:c.id, fecha:c.fecha, descripcion:c.descripcion||'', lugar:c.lugar||'', proveedor:c.proveedor||'', direccion:c.direccion||'', telefono:c.telefono||'', costo:N(c.costo), notas:c.notas||''}));
    r.compra_lineas = state.compras.flatMap(c=>(c.lineas||[]).map((l,i)=>({id:c.id+'-l'+i, compra_id:c.id, producto_id:T(l.productoId), variante_id:T(l.varianteId), nombre:l.nombre||'', variante_label:l.varianteLabel||'', cantidad:N(l.cantidad)||1})));
  }
  return r;
}
function snapDe(now, mov, cfg){
  const s={mov, cfg};
  for(const t of ORDEN) if(now[t]) s[t]=new Map(now[t].map(r=>[r[pk(t)],JSON.stringify(r)]));
  return s;
}
function filasCatalogoSucias(tabla){
  asegurarIndiceCatalogo();
  const filas=[];
  if(tabla==='productos') for(const id of SUCIO_CATALOGO.productos){ const p=indiceProductos.get(id); if(p) filas.push(filaProducto(p)); }
  if(tabla==='productos_costos' && session==='admin') for(const id of SUCIO_CATALOGO.productos_costos){ const p=indiceProductos.get(id); if(p) filas.push(filaCosto(p)); }
  if(tabla==='variantes') for(const id of SUCIO_CATALOGO.variantes){ const ref=indiceVariantes.get(id); if(ref) filas.push(filaVariante(ref.producto,ref.variante)); }
  return filas;
}
/* Guarda en Supabase solo lo que cambió desde la última vez. Las ventas NO pasan por acá: se crean con registrar_venta. */
async function empujar(){
  if(!session) return;
  if(catalogoCompletoSucio){
    try{
      const tablas=session==='admin'?['productos','productos_costos','variantes']:['productos','variantes'];
      const claves=await Promise.all(tablas.map(async tabla=>{
        const columna=pk(tabla), filas=await traerPaginas(()=>sb.from(tabla).select(columna).order(columna));
        return [tabla,filas.map(f=>f[columna])];
      }));
      for(const [tabla,ids] of claves) snap[tabla]=new Map(ids.map(id=>[id,'__catalogo_remoto__']));
    }catch(e){setSync('error');console.error(e);showToast('No se pudo preparar la sincronización completa: '+(e.message||e));return;}
  }
  setSync('guardando');
  const completa=catalogoCompletoSucio;
  const now=filasNube({catalogo:completa}), movIds=new Set((state.movimientos||[]).map(m=>m.id));
  const cfg = session==='admin' ? JSON.stringify(configFila()) : null;
  const cambios=[], borrar=[];
  for(const t of ORDEN){
    if(TABLAS_CATALOGO.has(t) && !completa){
      const rows=filasCatalogoSucias(t), prev=snap[t]||new Map();
      if(rows.length) cambios.push([t,rows]);
      const rm=new Set(BORRADO_CATALOGO[t]);
      for(const id of SUCIO_CATALOGO[t]) if(!indiceProductos.has(id) && t!=='variantes') rm.add(id); else if(t==='variantes' && !indiceVariantes.has(id)) rm.add(id);
      if(rm.size) borrar.unshift([t,[...rm]]);
      continue;
    }
    const rows=now[t]; if(!rows) continue;
    const prev=snap[t]||new Map(), cur=new Set(rows.map(r=>r[pk(t)]));
    const ch=rows.filter(r=>prev.get(r[pk(t)])!==JSON.stringify(r));
    if(ch.length) cambios.push([t,ch]);
    const rm=[...prev.keys()].filter(k=>!cur.has(k));
    if(rm.length) borrar.unshift([t,rm]);
  }
  const nuevosMov=(state.movimientos||[]).filter(m=>!snap.mov.has(m.id));
  try{
    if(cfg && cfg!==snap.cfg){ const {error}=await sb.from('config').update(configFila()).eq('id',1); if(error) throw error; }
    for(const [t,ch] of cambios) for(let i=0;i<ch.length;i+=500){ const {error}=await sb.from(t).upsert(ch.slice(i,i+500)); if(error) throw error; }
    for(const [t,ks] of borrar) for(let i=0;i<ks.length;i+=200){ const {error}=await sb.from(t).delete().in(pk(t),ks.slice(i,i+200)); if(error) throw error; }
    if(nuevosMov.length){ const {error}=await sb.from('movimientos').insert(nuevosMov.map(m=>({id:m.id, fecha:m.fecha, hora:m.hora, rol:m.rol||'', accion:m.accion, detalle:m.detalle||''}))); if(error) throw error; }
    if(completa){
      snap=snapDe(filasNube(),movIds,cfg);
    }else{
      for(const t of ORDEN){
        if(TABLAS_CATALOGO.has(t)){
          const mapa=snap[t]||new Map();
          for(const fila of filasCatalogoSucias(t)) mapa.set(fila[pk(t)],JSON.stringify(fila));
          for(const id of BORRADO_CATALOGO[t]) mapa.delete(id);
          for(const id of SUCIO_CATALOGO[t]) if(t==='variantes'?!indiceVariantes.has(id):!indiceProductos.has(id)) mapa.delete(id);
          snap[t]=mapa;
        }else if(now[t]) snap[t]=new Map(now[t].map(r=>[r[pk(t)],JSON.stringify(r)]));
      }
      snap.mov=movIds; if(cfg!==null) snap.cfg=cfg;
    }
    limpiarCatalogoSucio();
    setSync('ok');
  }catch(e){
    setSync('error');
    console.error(e);
    showToast('No se pudo guardar en la nube: '+(e.message||e));
  }
}
let estadoSync = 'ok';
function setSync(e){
  estadoSync = e;
  const t = document.getElementById('syncTag'); if(!t) return;
  t.className = 'sync-tag' + (e==='error' ? ' err' : '');
  t.textContent = !session ? '' : e==='guardando' ? 'Guardando…' : e==='error' ? 'Sin guardar' : '✓ Guardado';
}
function sincronizar(){
  if(timerGuardado){ clearTimeout(timerGuardado); timerGuardado=null; }
  return cola = cola.then(empujar).catch(e=>console.error(e));
}
function save(){
  if(timerGuardado) clearTimeout(timerGuardado);
  timerGuardado=setTimeout(()=>{ timerGuardado=null; sincronizar(); },100);
}

async function actualizarEstadoTrasVenta(ventaId, variantesAfectadas){
  const ids=[...new Set(variantesAfectadas.map(x=>x.varianteId))];
  const [ventaR,itemsR,pagosR,variantesR]=await Promise.all([
    sb.from('ventas').select('*').eq('id',ventaId).single(),
    sb.from('venta_items').select('*').eq('venta_id',ventaId).order('idx'),
    sb.from('venta_pagos').select('*').eq('venta_id',ventaId),
    sb.from('variantes').select('*').in('id',ids)
  ]);
  for(const r of [ventaR,itemsR,pagosR,variantesR]) if(r.error) throw r.error;
  const itemIds=(itemsR.data||[]).map(x=>x.id);
  const costosR=session==='admin'&&itemIds.length ? await sb.from('venta_items_costos').select('item_id,costo_unit').in('item_id',itemIds) : {data:[],error:null};
  if(costosR.error) throw costosR.error;
  const v=ventaR.data, costoPorItem=Object.fromEntries((costosR.data||[]).map(x=>[x.item_id,N(x.costo_unit)]));
  const items=(itemsR.data||[]).map(x=>({productoId:x.producto_id,nombre:x.nombre,categoria:x.categoria,varianteId:x.variante_id,codigo:x.codigo,talle:x.talle,color:x.color,varianteLabel:x.variante_label,cantidad:x.cantidad,precioUnit:N(x.precio_unit),costoUnit:costoPorItem[x.id]||0}));
  const pagos=(pagosR.data||[]).map(x=>({metodo:x.metodo,monto:N(x.monto)}));
  const nueva={id:v.id,fecha:v.fecha,hora:H(v.hora),turnoId:v.turno_id,items,metodoPago:v.metodo_pago,pagos,subtotal:N(v.subtotal),recargoPct:N(v.recargo_pct),total:N(v.total)};
  state.ventas=state.ventas.filter(x=>x.id!==ventaId); state.ventas.push(nueva);
  invalidarResumenCatalogo();
  asegurarIndiceCatalogo();
  for(const fila of variantesR.data||[]){
    const ref=indiceVariantes.get(fila.id); if(!ref) continue;
    ref.variante.stock=fila.stock;
    if(fila.etiquetas_pendientes>0) state.etiquetasPendientes[fila.id]=fila.etiquetas_pendientes; else delete state.etiquetasPendientes[fila.id];
    snap.variantes.set(fila.id,JSON.stringify(filaVariante(ref.producto,ref.variante)));
  }
}

async function cargarTodo(){
  const adm=session==='admin', vacio=Promise.resolve([]), dh=desdeHistorial(), productosCargados=state.productos||[];
  const [cfg,tu,ga,ve,it,ic,pg,dv,dl,cp,cl,mv] = await Promise.all([
    traer('config'),
    traer('turnos'), traer('turno_gastos'), traerDesde('ventas',dh),
    traerDesde('venta_items',dh,'id','*, ventas!inner(fecha)','ventas.fecha'),
    adm?traerDesde('venta_items_costos',dh,'item_id','*, venta_items!inner(ventas!inner(fecha))','venta_items.ventas.fecha'):vacio,
    traerDesde('venta_pagos',dh,'id','*, ventas!inner(fecha)','ventas.fecha'),
    traerDesde('devoluciones',dh),
    traerDesde('devolucion_lineas',dh,'id','*, devoluciones!inner(fecha)','devoluciones.fecha'),
    adm?traer('compras'):vacio, adm?traer('compra_lineas'):vacio, adm?traerDesde('movimientos',dh):vacio]);
  const s=defaultState(), c=cfg[0]||{}, agr=(o,k,v)=>(o[k]=o[k]||[]).push(v);
  s.productos=productosCargados;
  s.config={...s.config, nombreLocal:c.nombre_local||'Zero Zed', debitoPct:N(c.debito_pct), creditoPct:N(c.credito_pct), categorias:c.categorias||[], pins:{admin:'',empleado:''}, ultimoRespaldo:todayStr(), respaldoPospuestoHasta:'2999-12-31'};
  for(const p of s.productos) for(const v of p.variantes||[]) if(v.etiquetas_pendientes>0) s.etiquetasPendientes[v.id]=v.etiquetas_pendientes;
  const gm={}; ga.forEach(g=>agr(gm,g.turno_id,g));
  s.turnos=tu.sort(ordCreado).map(t=>({id:t.id, fecha:t.fecha, turno:t.turno, cambioInicial:N(t.cambio_inicial), cambioFinal:t.cambio_final==null?null:N(t.cambio_final), efectivoEsperado:t.efectivo_esperado==null?null:N(t.efectivo_esperado), abierto:t.abierto, horaApertura:H(t.hora_apertura), horaCierre:H(t.hora_cierre)||null, gastos:(gm[t.id]||[]).sort((a,b)=>suf(a.id)-suf(b.id)).map(g=>({desc:g.descripcion, monto:N(g.monto), hora:H(g.hora)}))}));
  const cim=Object.fromEntries(ic.map(x=>[x.item_id,N(x.costo_unit)])), im={}, pgm={};
  it.sort((a,b)=>a.idx-b.idx).forEach(x=>agr(im,x.venta_id,{productoId:x.producto_id, nombre:x.nombre, categoria:x.categoria, varianteId:x.variante_id, codigo:x.codigo, talle:x.talle, color:x.color, varianteLabel:x.variante_label, cantidad:x.cantidad, precioUnit:N(x.precio_unit), costoUnit:cim[x.id]||0}));
  pg.forEach(x=>agr(pgm,x.venta_id,{metodo:x.metodo, monto:N(x.monto)}));
  s.ventas=ve.sort(ordFH).map(v=>({id:v.id, fecha:v.fecha, hora:H(v.hora), turnoId:v.turno_id, items:im[v.id]||[], metodoPago:v.metodo_pago, pagos:pgm[v.id]||[], subtotal:N(v.subtotal), recargoPct:N(v.recargo_pct), total:N(v.total)}));
  const dlm={}; dl.sort((a,b)=>a.orden-b.orden).forEach(x=>agr(dlm,x.devolucion_id,{productoId:x.producto_id, varianteId:x.variante_id, nombre:x.nombre, varianteLabel:x.variante_label, codigo:x.codigo, cantidad:x.cantidad, precioUnit:N(x.precio_unit), etiquetasPendientesRestadas:0}));
  s.devoluciones=dv.sort(ordFH).map(x=>{ const L=dlm[x.id]||[], f=L[0]||{}; return {id:x.id, fecha:x.fecha, hora:H(x.hora), ventaId:x.venta_id, productoId:x.producto_id, varianteId:x.variante_id, ventaFecha:x.venta_fecha||'', itemIdx:x.item_idx, nombre:x.nombre, varianteLabel:x.variante_label, codigo:x.codigo, cantidad:x.cantidad, montoDevuelto:N(x.monto_devuelto), tipo:x.tipo, montoNuevo:N(x.monto_nuevo), productosNuevos:L, productoNuevoId:f.productoId, varianteNuevaId:f.varianteId, nombreNuevo:f.nombre, varianteNuevaLabel:f.varianteLabel, codigoNuevo:f.codigo, montoDiferencia:N(x.monto_diferencia), motivo:x.motivo, reintegro:x.reintegro, metodoDiferencia:x.metodo_diferencia, turnoId:x.turno_id}; });
  const clm={}; cl.sort((a,b)=>suf(a.id)-suf(b.id)).forEach(x=>agr(clm,x.compra_id,{productoId:x.producto_id, varianteId:x.variante_id, nombre:x.nombre, varianteLabel:x.variante_label, cantidad:x.cantidad}));
  s.compras=cp.sort(ordFH).map(x=>({id:x.id, fecha:x.fecha, descripcion:x.descripcion, lugar:x.lugar, proveedor:x.proveedor, direccion:x.direccion, telefono:x.telefono, costo:N(x.costo), notas:x.notas, lineas:clm[x.id]||[]}));
  s.movimientos=mv.sort(ordFH).map(x=>({id:x.id, fecha:x.fecha, hora:H(x.hora), rol:x.rol, accion:x.accion, detalle:x.detalle}));
  s.etiquetasInicialesImpresas=true;
  state=s;
  catalogoCompletoEnMemoria=false;
  reconstruirIndiceCatalogo();
  if(typeof invalidarIndicesBusqueda==='function') invalidarIndicesBusqueda();
  snap=snapDe(filasNube(), new Set(s.movimientos.map(m=>m.id)), adm?JSON.stringify(configFila()):null);
  limpiarCatalogoSucio();
  try{stockResumenNube=await consultarResumenCatalogo();}catch(e){console.warn('Resumen del catálogo no disponible:',e);}
}
