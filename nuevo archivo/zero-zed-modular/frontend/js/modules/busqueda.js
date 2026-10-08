// [ZZ] modules/busqueda.js — Buscadores compartidos (Vender, Stock, Compras), lector de código de barras y resultados.
let cacheTextoCatalogo = new WeakMap(), indiceCodigosCatalogo = null, indiceEtiquetasCatalogo = null;
const temporizadoresBusqueda = {};
let ventaResultadosNube=[], ventaTotalNube=0, ventaCargandoNube=false, secuenciaVentaNube=0;
async function buscarProductosVenta(){
  const secuencia=++secuenciaVentaNube, term=ventaSearch.trim();
  if(!term){ventaResultadosNube=[];ventaTotalNube=0;ventaCargandoNube=false;actualizarResultadosVenta();return;}
  ventaCargandoNube=true;actualizarResultadosVenta();
  try{
    const resultado=await consultarCatalogo(term,ventaSelCat,0,8);
    if(secuencia!==secuenciaVentaNube)return;
    ventaResultadosNube=resultado.productos;ventaTotalNube=resultado.total;
  }catch(e){if(secuencia===secuenciaVentaNube)showToast(e.message||'No se pudo buscar en Supabase');}
  finally{if(secuencia===secuenciaVentaNube){ventaCargandoNube=false;actualizarResultadosVenta();}}
}
function invalidarTextoProducto(producto){ if(producto) cacheTextoCatalogo.delete(producto); }
function invalidarIndicesBusqueda(){ cacheTextoCatalogo=new WeakMap(); indiceCodigosCatalogo=null; indiceEtiquetasCatalogo=null; }
function agregarAlIndice(indice,clave,ref){ if(!clave) return; const lista=indice.get(clave)||[]; if(!lista.some(x=>x.v===ref.v)) lista.push(ref); indice.set(clave,lista); }
function quitarDelIndice(indice,clave,variante){
  const lista=indice.get(clave); if(!lista) return;
  const siguiente=lista.filter(x=>x.v!==variante);
  if(siguiente.length) indice.set(clave,siguiente); else indice.delete(clave);
}
function registrarVarianteEnIndiceBusqueda(producto,variante){
  invalidarTextoProducto(producto);
  if(!indiceCodigosCatalogo||!indiceEtiquetasCatalogo) return;
  agregarAlIndice(indiceCodigosCatalogo,(variante.codigo||'').trim().toLowerCase(),{p:producto,v:variante});
  agregarAlIndice(indiceEtiquetasCatalogo,codigoBarras(variante,producto).trim().toLowerCase(),{p:producto,v:variante});
}
function quitarVarianteDelIndiceBusqueda(producto,variante){
  invalidarTextoProducto(producto);
  if(!indiceCodigosCatalogo||!indiceEtiquetasCatalogo) return;
  quitarDelIndice(indiceCodigosCatalogo,(variante.codigo||'').trim().toLowerCase(),variante);
  quitarDelIndice(indiceEtiquetasCatalogo,codigoBarras(variante,producto).trim().toLowerCase(),variante);
}
function asegurarIndicesCodigos(){
  if(indiceCodigosCatalogo&&indiceEtiquetasCatalogo) return;
  indiceCodigosCatalogo=new Map(); indiceEtiquetasCatalogo=new Map();
  for(const p of state.productos) for(const v of p.variantes){
    agregarAlIndice(indiceCodigosCatalogo,(v.codigo||'').trim().toLowerCase(),{p,v});
    agregarAlIndice(indiceEtiquetasCatalogo,codigoBarras(v,p).trim().toLowerCase(),{p,v});
  }
}
function productosConCodigo(codigo){ asegurarIndicesCodigos(); return indiceCodigosCatalogo.get((codigo||'').trim().toLowerCase())||[]; }
function coincideBusquedaProducto(p,termino){
  let texto=cacheTextoCatalogo.get(p);
  if(texto===undefined){ texto=[p.nombre,p.descripcion,p.categoria,p.id,...p.variantes.map(v=>v.codigo||'')].join(' ').toLowerCase(); cacheTextoCatalogo.set(p,texto); }
  return !termino||texto.includes(termino);
}
function actualizarBusqueda(tipo, input){
  if(tipo==='venta') ventaSearch = input.value;
  if(tipo==='stock'){
    if(stockSearch!==input.value) stockCantidadVisible={};
    stockSearch = input.value;
  }
  if(tipo==='venta') ventaClaveConsultada = '';
  if(tipo==='stock') stockClaveConsultada = '';
  clearTimeout(temporizadoresBusqueda[tipo]);
  temporizadoresBusqueda[tipo]=setTimeout(()=>{
    if(tipo==='venta') buscarProductosVenta();
    if(tipo==='stock') refrescarResultadosStockNube();
  },70);
}
/* Lector de códigos de barras: el lector "escribe" la clave y pulsa Enter.
   - Una sola prenda posible (o un solo talle con stock): se agrega sola al carrito.
   - Varios talles con stock: se elige la prenda y se deja elegir el talle.
   Devuelve false si la clave no existe (entonces sigue la búsqueda normal). */
async function escanearEnVender(clave){
  const todas=ventaResultadosNube.flatMap(p=>p.variantes.map(v=>({p,v})));
  const codigo=clave.trim().toLowerCase();
  const r=todas.find(({p,v})=>codigoBarras(v,p).toLowerCase()===codigo)||resolverClaveExacta(clave);
  if(!r) return false;
  const nombre = r.p.nombre + (r.p.descripcion?' ('+r.p.descripcion+')':'');
  ventaSearch = ''; ventaClaveConsultada = ''; ventaSelQty = 1;
  if(r.v){
    const etiqueta = [r.v.talle, r.v.color].filter(x=>x&&x!=='-').join(' / ');
    if(r.v.stock < 1){ pitido(false); showToast('Sin stock: '+nombre+(etiqueta?' · '+etiqueta:'')); ventaSelProd=''; ventaSelVar=''; renderAll(); }
    else { ventaSelProd = r.p.id; ventaSelVar = r.v.id; const antes = cart.reduce((a,i)=>a+i.cantidad,0); agregarAlCarrito(); pitido(cart.reduce((a,i)=>a+i.cantidad,0)>antes); ventaSelProd=''; ventaSelVar=''; showToast('Agregado: '+nombre+(etiqueta?' · '+etiqueta:'')); }
  } else {
    ventaSelProd = r.p.id; ventaSelVar = ''; ventaSearch = r.p.nombre;
    pitido(false); showToast('Elegí el talle de '+nombre);
    renderAll();
  }
  setTimeout(()=>{ const i=document.querySelector('[data-search="venta"]'); if(i){ i.value=ventaSearch; i.focus(); i.select(); } }, 30);
  return true;
}
async function buscarClaveConEnter(tipo, event, input){
  if(event.key!=='Enter') return;
  event.preventDefault();
  clearTimeout(temporizadoresBusqueda[tipo]);
  if(tipo==='venta') await buscarProductosVenta();
  if(tipo==='stock') await cargarStockDesdeSupabase(true);
  const clave = input.value.trim();
  if(tipo==='venta' && await escanearEnVender(clave)) return;
  if(tipo==='venta') ventaClaveConsultada = clave;
  if(tipo==='stock') stockClaveConsultada = clave;
  const panel = document.getElementById(tipo==='venta'?'ventaClaveResultado':'stockClaveResultado');
  if(panel) panel.innerHTML = renderHistorialClave(clave);
}
function actualizarFiltroCompras(input){
  const posicion = input.selectionStart;
  comprasLugarFiltro = input.value;
  renderAll();
  requestAnimationFrame(()=>{
    const nuevoInput = document.querySelector('[data-compras-lugar]');
    if(!nuevoInput) return;
    nuevoInput.focus();
    nuevoInput.setSelectionRange(posicion, posicion);
  });
}
function renderHistorialClave(clave){
  if(!clave) return '';
  const termino = clave.toLowerCase();
  const coincidencias = [];
  state.productos.forEach(p=>{
    const coincideProducto = p.nombre.toLowerCase().includes(termino) || (p.descripcion||'').toLowerCase().includes(termino) || (p.categoria||'').toLowerCase().includes(termino);
    p.variantes.forEach(v=>{
      if(coincideProducto || (v.codigo||'').toLowerCase().includes(termino)) coincidencias.push({p,v});
    });
  });
  const visibles = coincidencias.slice(0, MAX_SEARCH_ITEMS);
  return `
    <div class="card" style="margin-top:10px;">
      <div class="card-title">Productos encontrados: "${clave}"</div>
      ${visibles.length===0 ? '<p class="empty">No hay prendas que coincidan con esa búsqueda.</p>' : `
      <div style="max-height:320px;overflow-y:auto;">
        <table><thead><tr><th>Prenda</th><th>Categoría</th><th>Clave</th><th>Talle / color</th><th>Stock</th></tr></thead>
        <tbody>${visibles.map(({p,v})=>`<tr>
          <td>${p.nombre}</td><td>${p.categoria||'-'}</td><td class="num">${v.codigo||'-'}</td>
          <td>${[v.talle,v.color].filter(Boolean).join(' / ')||'Único'}</td><td class="num">${v.stock}</td>
        </tr>`).join('')}</tbody></table>
      </div>`}
    </div>`;
}
function ventaResultadosHTML(){
  const term = ventaSearch.trim().toLowerCase();
  const nota = t => `<p class="section-note" style="margin:10px 0 2px;">${t}</p>`;
  if(!term) return nota('Escribí un nombre o escaneá una etiqueta. Tocá un talle para agregarlo.');
  if(ventaCargandoNube&&!ventaResultadosNube.length) return nota('Buscando en Supabase…');
  const lista = ventaResultadosNube;
  if(!lista.length) return nota('No encontramos esa prenda.');
  return lista.map(p=>`<div class="res-prod"><div class="res-top"><span><b>${escaparHTML(p.nombre)}</b>${p.descripcion?` <span class="muted">· ${escaparHTML(p.descripcion)}</span>`:''}</span><span>${money(p.precio)}</span></div><div class="talles">${p.variantes.map(v=>{const n=Number(v.stock)||0, e=[v.talle,v.color].filter(x=>x&&x!=='-').join(' · ')||'Único'; return `<button type="button" class="talle ${n<=0?'sin':''}" ${n<=0?'disabled':''} onclick="agregarVariante('${p.id}','${v.id}')">${escaparHTML(e)}<small>${n}</small></button>`;}).join('')}</div></div>`).join('');
}
function agregarVariante(pid,vid){
  ventaSearch=''; ventaSelProd=pid; ventaSelVar=vid; ventaSelQty=1;
  agregarAlCarrito();
  ventaSelProd=''; ventaSelVar='';
  if(!window.matchMedia('(pointer: coarse)').matches){
    setTimeout(()=>{ const i=document.querySelector('[data-search="venta"]'); if(i) i.focus(); },30);
  }
}
function actualizarResultadosVenta(){
  const r=document.getElementById('ventaResultados'); if(r) r.innerHTML=ventaResultadosHTML();
  const h=document.getElementById('ventaClaveResultado'); if(h) h.innerHTML='';
}
