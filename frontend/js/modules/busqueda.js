// [ZZ] modules/busqueda.js — Buscadores compartidos (Vender, Stock, Compras), lector de código de barras y resultados.
function actualizarBusqueda(tipo, input){
  if(tipo==='venta') ventaSearch = input.value;
  if(tipo==='stock') stockSearch = input.value;
  if(tipo==='venta') ventaClaveConsultada = '';
  if(tipo==='stock') stockClaveConsultada = '';
  if(tipo==='venta') actualizarResultadosVenta();
  if(tipo==='stock') actualizarResultadosStock();
}
/* Lector de códigos de barras: el lector "escribe" la clave y pulsa Enter.
   - Una sola prenda posible (o un solo talle con stock): se agrega sola al carrito.
   - Varios talles con stock: se elige la prenda y se deja elegir el talle.
   Devuelve false si la clave no existe (entonces sigue la búsqueda normal). */
function escanearEnVender(clave){
  const r = resolverClaveExacta(clave);
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
function buscarClaveConEnter(tipo, event, input){
  if(event.key!=='Enter') return;
  event.preventDefault();
  const clave = input.value.trim();
  if(tipo==='venta' && escanearEnVender(clave)) return;
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
  const lista = state.productos.filter(p=>(!ventaSelCat||p.categoria===ventaSelCat)&&(p.nombre.toLowerCase().includes(term)||(p.descripcion||'').toLowerCase().includes(term)||(p.categoria||'').toLowerCase().includes(term)||p.variantes.some(v=>(v.codigo||'').toLowerCase().includes(term)))).slice(0,8);
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
function actualizarResultadosStock(){
  const resultados = document.getElementById('stockSearchResults');
  if(!resultados) return;
  const term = stockSearch.trim().toLowerCase();
  let filtrados = state.productos;
  if(stockCategoryFilter) filtrados = filtrados.filter(p=>p.categoria===stockCategoryFilter);
  if(term) filtrados = filtrados.filter(p=>p.nombre.toLowerCase().includes(term) || (p.descripcion||'').toLowerCase().includes(term) || p.id.toLowerCase().includes(term) || p.variantes.some(v=>(v.codigo||'').toLowerCase().includes(term)));
  resultados.innerHTML = renderResultadosStock(filtrados, state.config.categorias);
  const historial = document.getElementById('stockClaveResultado');
  if(historial) historial.innerHTML = '';
}
