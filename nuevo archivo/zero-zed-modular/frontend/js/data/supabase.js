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
    let out=[], d=0;
    for(;;){
      const {data,error} = await sb.from(t).select(sel||'*').gte(col||'fecha', desde).order(orden||'id').range(d,d+999);
      if(error) throw error;
      out = out.concat(data);
      if(data.length<1000) return out;
      d += 1000;
    }
  }catch(e){
    console.warn('Filtro por fecha falló en '+t+', se carga todo:', e);
    return traer(t, orden);
  }
}
async function asegurarHistorialDesde(fecha){
  if(!fecha || fecha >= desdeHistorial()) return;
  historialDesde = fecha.slice(0,7)+'-01';       /* desde el primer día de ese mes */
  showToast('Cargando historial desde '+historialDesde+'…');
  try{ await cola; await cargarTodo(); renderAll(); }catch(e){ showToast('No se pudo cargar el historial: '+(e.message||e)); }
}
async function traer(t, orden){
  let out=[], desde=0;
  for(;;){
    const {data,error} = await sb.from(t).select('*').order(orden||'id').range(desde,desde+999);
    if(error) throw error;
    out = out.concat(data);
    if(data.length<1000) return out;
    desde += 1000;
  }
}
function configFila(){ const c=state.config; return {nombre_local:c.nombreLocal, debito_pct:N(c.debitoPct), credito_pct:N(c.creditoPct), categorias:c.categorias||[]}; }
function filasNube(){
  const r={}, P=state.productos, adm=session==='admin';
  r.productos = P.map(p=>({id:p.id, num:p.num||null, nombre:p.nombre, descripcion:p.descripcion||'', categoria:p.categoria||'', precio:N(p.precio)}));
  if(adm) r.productos_costos = P.map(p=>({producto_id:p.id, costo:N(p.costo)}));
  r.variantes = P.flatMap(p=>p.variantes.map(v=>({id:v.id, producto_id:p.id, talle:v.talle||'', color:v.color||'', codigo:v.codigo||'', stock:Math.max(0,Math.floor(N(v.stock))), etiquetas_pendientes:Math.max(0,Math.floor(N(state.etiquetasPendientes[v.id])))})));
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
/* Guarda en Supabase solo lo que cambió desde la última vez. Las ventas NO pasan por acá: se crean con registrar_venta. */
async function empujar(){
  if(!session) return;
  setSync('guardando');
  const now=filasNube(), movIds=new Set((state.movimientos||[]).map(m=>m.id));
  const cfg = session==='admin' ? JSON.stringify(configFila()) : null;
  const cambios=[], borrar=[];
  for(const t of ORDEN){
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
    snap=snapDe(now,movIds,cfg);
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
function sincronizar(){ return cola = cola.then(empujar).catch(e=>console.error(e)); }
function save(){ sincronizar(); }

async function cargarTodo(){
  const adm=session==='admin', vacio=Promise.resolve([]), dh=desdeHistorial();
  const [cfg,pr,va,co,tu,ga,ve,it,ic,pg,dv,dl,cp,cl,mv] = await Promise.all([
    traer('config'), traer('productos'), traer('variantes'), adm?traer('productos_costos','producto_id'):vacio,
    traer('turnos'), traer('turno_gastos'), traerDesde('ventas',dh),
    traerDesde('venta_items',dh,'id','*, ventas!inner(fecha)','ventas.fecha'),
    adm?traerDesde('venta_items_costos',dh,'item_id','*, venta_items!inner(ventas!inner(fecha))','venta_items.ventas.fecha'):vacio,
    traerDesde('venta_pagos',dh,'id','*, ventas!inner(fecha)','ventas.fecha'),
    traerDesde('devoluciones',dh),
    traerDesde('devolucion_lineas',dh,'id','*, devoluciones!inner(fecha)','devoluciones.fecha'),
    adm?traer('compras'):vacio, adm?traer('compra_lineas'):vacio, adm?traerDesde('movimientos',dh):vacio]);
  const s=defaultState(), c=cfg[0]||{}, agr=(o,k,v)=>(o[k]=o[k]||[]).push(v);
  s.config={...s.config, nombreLocal:c.nombre_local||'Zero Zed', debitoPct:N(c.debito_pct), creditoPct:N(c.credito_pct), categorias:c.categorias||[], pins:{admin:'',empleado:''}, ultimoRespaldo:todayStr(), respaldoPospuestoHasta:'2999-12-31'};
  const cm=Object.fromEntries(co.map(x=>[x.producto_id,N(x.costo)])), pm={};
  s.productos=pr.sort(ordCreado).map(p=>pm[p.id]={id:p.id, num:p.num||null, nombre:p.nombre, descripcion:p.descripcion, categoria:p.categoria, precio:N(p.precio), costo:cm[p.id]||0, variantes:[]});
  va.sort(ordCreado).forEach(v=>{
    if(pm[v.producto_id]) pm[v.producto_id].variantes.push({id:v.id, talle:v.talle, color:v.color, codigo:v.codigo, stock:v.stock});
    if(v.etiquetas_pendientes>0) s.etiquetasPendientes[v.id]=v.etiquetas_pendientes;
  });
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
  snap=snapDe(filasNube(), new Set(s.movimientos.map(m=>m.id)), adm?JSON.stringify(configFila()):null);
}
