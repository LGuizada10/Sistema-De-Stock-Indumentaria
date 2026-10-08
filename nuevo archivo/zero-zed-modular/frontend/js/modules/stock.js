// [ZZ] modules/stock.js — Pestaña STOCK: productos, variantes, talles/colores, carga rápida, costos.
/* =================== STOCK =================== */
let showNuevoProducto = false;
let nuevoProd = {nombre:'', descripcion:'', categoria:'', costo:'', precio:''};
let addVarianteFormFor = null;
let nuevaVariante = {talle:'', color:'', stock:'', codigo:''};
let productoEditandoId = null;
let productoAEliminarId = null;
let productoEditDraft = null;
let stockSearch = '', stockClaveConsultada = '';
let stockCategoryFilter = '';

let costosPendDraft = {};
let costosPendAbierto = false, costosPendTodos = false;
function productosSinCosto(){
  const vendidas = {};
  state.ventas.forEach(v=>v.items.forEach(i=>{ vendidas[i.productoId] = (vendidas[i.productoId]||0) + Number(i.cantidad||0); }));
  return state.productos.filter(p=>!(Number(p.costo)>0))
    .map(p=>({p, vendidas:vendidas[p.id]||0}))
    .sort((a,b)=>b.vendidas-a.vendidas || a.p.nombre.localeCompare(b.p.nombre,'es'));
}
function renderCostosPendientes(){
  if(session!=='admin') return '';
  const lista = productosSinCosto();
  if(!lista.length) return '';
  const visibles = costosPendTodos ? lista : lista.slice(0,10);
  const cargados = Object.values(costosPendDraft).filter(v=>Number(v)>0).length;
  return `
  <div class="card" style="border-color:var(--warn);">
    <div class="card-title" style="cursor:pointer;" onclick="costosPendAbierto=!costosPendAbierto; renderAll();">
      <span>⚠ Costos pendientes · ${lista.length} prenda(s) sin costo</span>
      <span class="muted" style="font-size:12px;">${costosPendAbierto?'Ocultar':'Ver y cargar'}</span>
    </div>
    ${costosPendAbierto ? `
    <p class="section-note" style="margin-bottom:6px;">Ordenadas por unidades vendidas. El costo vale para todos los talles y colores de la prenda, y se aplica también a las ventas anteriores. Solo visible para el administrador.</p>
    <table><thead><tr><th>Prenda</th><th>Categoría</th><th>Vendidas</th><th>Costo unitario</th></tr></thead><tbody>
    ${visibles.map(({p,vendidas})=>`<tr>
      <td>${escaparHTML(p.nombre)}${p.descripcion?' <span class="muted">('+escaparHTML(p.descripcion)+')</span>':''}</td>
      <td>${escaparHTML(p.categoria||'')}</td>
      <td class="num">${vendidas}</td>
      <td><input type="number" min="0" placeholder="0" style="width:110px;" value="${costosPendDraft[p.id]??''}" oninput="costosPendDraft['${p.id}']=this.value; actualizarBotonCostosPend();"></td>
    </tr>`).join('')}
    </tbody></table>
    <div class="row" style="margin-top:10px;align-items:center;">
      <button class="btn primary" id="btnGuardarCostosPend" onclick="guardarCostosPendientes()" ${cargados?'':'disabled'}>Guardar costos${cargados?' ('+cargados+')':''}</button>
      ${lista.length>10 ? `<button class="btn ghost" onclick="costosPendTodos=!costosPendTodos; renderAll();">${costosPendTodos?'Ver solo las 10 más vendidas':'Ver todas ('+lista.length+')'}</button>` : ''}
    </div>` : ''}
  </div>`;
}
function actualizarBotonCostosPend(){
  const b = document.getElementById('btnGuardarCostosPend'); if(!b) return;
  const n = Object.values(costosPendDraft).filter(v=>Number(v)>0).length;
  b.disabled = !n; b.textContent = 'Guardar costos' + (n?' ('+n+')':'');
}
function guardarCostosPendientes(){
  if(session!=='admin') return;
  let n = 0; const nombresCostos = [];
  Object.entries(costosPendDraft).forEach(([id,v])=>{
    const c = Number(v);
    const prod = state.productos.find(p=>p.id===id);
    if(prod && c>0){ prod.costo = c; n++; nombresCostos.push(prod.nombre+' '+money(c)); }
  });
  costosPendDraft = {};
  if(n){ registrarMovimiento('Costos cargados', n+' prenda(s): '+nombresCostos.slice(0,8).join(', ')+(nombresCostos.length>8?' y '+(nombresCostos.length-8)+' más':'')); save(); }
  showToast(n ? n+' costo(s) guardado(s)' : 'No había costos para guardar');
  renderAll();
}

let masVendidasAbierto = false;
function masVendidas30Dias(){
  const desde = fechaSumandoDias(todayStr(),-29);
  const acum = {};
  state.ventas.filter(v=>v.fecha>=desde).forEach(v=>v.items.forEach(i=>{
    const a = acum[i.productoId] = acum[i.productoId] || {productoId:i.productoId, nombre:i.nombre, cant:0};
    a.cant += Number(i.cantidad||0);
  }));
  return Object.values(acum).sort((a,b)=>b.cant-a.cant).slice(0,5).map(x=>{
    const p = state.productos.find(p=>p.id===x.productoId);
    return {...x, existe:!!p,
      stock: p ? p.variantes.reduce((t,v)=>t+Number(v.stock||0),0) : 0};
  });
}
function renderAlertasStock(){
  const top = masVendidas30Dias();
  const cardTop = `
  <div class="card">
    <div class="card-title" style="cursor:pointer;" onclick="masVendidasAbierto=!masVendidasAbierto; renderAll();">
      <span>Más vendidas · últimos 30 días</span>
      <span class="muted" style="font-size:12px;">${masVendidasAbierto?'Ocultar':'Ver'}</span>
    </div>
    ${masVendidasAbierto ? (top.length===0 ? '<p class="empty">Todavía no hay ventas en los últimos 30 días.</p>' : `
    <p class="section-note" style="margin-bottom:6px;">Las 5 prendas con más unidades vendidas y cuánto stock te queda.</p>
    <table><thead><tr><th>#</th><th>Prenda</th><th>Vendidas</th><th>Stock actual</th></tr></thead><tbody>
    ${top.map((x,i)=>`<tr><td class="num">${i+1}</td><td>${escaparHTML(x.nombre)}</td><td class="num">${x.cant}</td>
      <td>${x.existe ? `<span class="pill ${x.stock<=0?'low':'ok'}">${x.stock}</span>` : '<span class="muted">ya no está en stock</span>'}</td></tr>`).join('')}
    </tbody></table>`) : ''}
  </div>`;
  return cardTop;
}

function renderFiltroCategorias(categorias){
  const conteo = {};
  state.productos.forEach(p=>{ conteo[p.categoria] = (conteo[p.categoria]||0) + 1; });
  const lista = (stockCategoryFilter && !categorias.includes(stockCategoryFilter)) ? [...categorias, stockCategoryFilter] : categorias;
  const opciones = lista.map(c=>`<option value="${escaparHTML(c)}" ${stockCategoryFilter===c?'selected':''}>${escaparHTML(c)} (${conteo[c]||0})</option>`).join('');
  return `
  <div class="stk-field stk-field-cat">
    <label for="stockCategoria">Categoría</label>
    <select id="stockCategoria" onchange="stockCategoryFilter=this.value; renderAll();">
      <option value="">Todas las categorías (${state.productos.length})</option>
      ${opciones}
    </select>
  </div>`;
}
/* Indicadores del inventario (arriba de la pestaña). El valor a costo solo lo ve el administrador. */
function resumenStock(){
  let unidades=0, sinStock=0, bajo=0, costo=0, venta=0;
  state.productos.forEach(p=>{
    p.variantes.forEach(v=>{
      const s = Number(v.stock)||0;
      unidades += s;
      if(s<=0) sinStock++; else if(s<=LOW_STOCK) bajo++;
      costo += s*(Number(p.costo)||0);
      venta += s*(Number(p.precio)||0);
    });
  });
  return {prendas:state.productos.length, unidades, sinStock, bajo, costo, venta};
}
function renderKpisStock(){
  const r = resumenStock();
  const kpi = (valor,rotulo,clase='')=>`<div class="stk-kpi ${clase}"><span class="stk-kpi-v num">${valor}</span><span class="stk-kpi-l">${rotulo}</span></div>`;
  return `<div class="stk-kpis" role="group" aria-label="Resumen del inventario">
    ${kpi(r.prendas,'Prendas')}
    ${kpi(r.unidades,'Unidades en stock')}
    ${kpi(r.bajo,'Con stock bajo', r.bajo?'warn':'')}
    ${kpi(r.sinStock,'Variantes sin stock', r.sinStock?'bad':'')}
    ${session==='admin' ? kpi(money(r.costo),'Valor a costo') : ''}
    ${session==='admin' ? kpi(money(r.venta),'Valor a precio de venta') : ''}
  </div>`;
}
function renderStock(){
  const categorias = state.config.categorias;
  if(!nuevoProd.categoria) nuevoProd.categoria = categorias[0] || '';

  const term = stockSearch.trim().toLowerCase();
  let productosFiltrados = state.productos;
  if(stockCategoryFilter) productosFiltrados = productosFiltrados.filter(p=>p.categoria===stockCategoryFilter);
  if(term){
    productosFiltrados = productosFiltrados.filter(p=>
      p.nombre.toLowerCase().includes(term) ||
      (p.descripcion||'').toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.variantes.some(v=>(v.codigo||'').toLowerCase().includes(term))
    );
  }

  return `
  <div class="stk-head">
    <div>
      <h2 class="section-title" style="margin-bottom:2px;">Stock</h2>
      <p class="section-note" style="margin:0;">Inventario por prenda, talle y color.</p>
    </div>
    <button class="btn primary" onclick="showNuevoProducto=!showNuevoProducto; renderAll();" aria-expanded="${showNuevoProducto}">${showNuevoProducto?'Cerrar carga':'+ Añadir prenda'}</button>
  </div>
  ${renderKpisStock()}
  ${renderCostosPendientes()}
  ${renderAlertasStock()}

  ${showNuevoProducto ? `
  <section class="card stk-form" aria-label="Carga rápida de prendas">
    <div class="card-title">Carga rápida de prendas</div>
    <p class="section-note">Escribí varios talles o colores separados por coma (por ejemplo 1,2,3) y se crea una variante por cada combinación.</p>
    <div class="stk-form-grid">
      <div class="stk-field stk-span2"><label for="npNombre">Prenda</label><input id="npNombre" type="text" placeholder="Ej: Remera lisa Corteiz" value="${escaparHTML(nuevoProd.nombre)}" oninput="nuevoProd.nombre=this.value"></div>
      <div class="stk-field"><label for="npCat">Categoría</label>
        <select id="npCat" onchange="nuevoProd.categoria=this.value">
          ${categorias.map(c=>`<option value="${escaparHTML(c)}" ${nuevoProd.categoria===c?'selected':''}>${escaparHTML(c)}</option>`).join('')}
        </select>
      </div>
      <div class="stk-field stk-span2"><label for="npDesc">Descripción / diseño (opcional)</label><input id="npDesc" type="text" placeholder="Ej: bolsillo cargo, estampa frontal..." value="${escaparHTML(nuevoProd.descripcion)}" oninput="nuevoProd.descripcion=this.value"></div>
      ${session === 'admin' ? `<div class="stk-field"><label for="npCosto">Costo unitario</label><input id="npCosto" type="number" min="0" placeholder="0" value="${escaparHTML(nuevoProd.costo)}" oninput="nuevoProd.costo=this.value"></div>` : ''}
      <div class="stk-field"><label for="npPrecio">Precio de venta</label><input id="npPrecio" type="number" min="0" placeholder="0" value="${escaparHTML(nuevoProd.precio)}" oninput="nuevoProd.precio=this.value"></div>
      <div class="stk-field"><label for="npTalles">Talles</label><input id="npTalles" type="text" placeholder="1,2,3 o S,M,L" value="${escaparHTML(nuevaVariante.talle)}" oninput="nuevaVariante.talle=this.value"></div>
      <div class="stk-field"><label for="npColores">Colores</label><input id="npColores" type="text" placeholder="Negro,Blanco" value="${escaparHTML(nuevaVariante.color)}" oninput="nuevaVariante.color=this.value"></div>
      <div class="stk-field"><label for="npCant">Cantidad (c/u)</label><input id="npCant" type="number" min="1" value="${nuevaVariante.stock||1}" oninput="nuevaVariante.stock=this.value"></div>
    </div>
    <div class="stk-actions">
      <button class="btn primary" onclick="guardarCargaRapidaStock()">Agregar al stock</button>
      <button class="btn ghost" onclick="cancelarNuevoProducto()">Cancelar</button>
    </div>
  </section>` : ''}

  <div class="stk-toolbar" role="search">
    <div class="stk-field stk-field-search">
      <label for="stockBuscar">Buscar por clave o nombre</label>
      <input id="stockBuscar" type="search" data-search="stock" placeholder="Ej: REM-SAK o jean..." value="${escaparHTML(stockSearch)}" autocomplete="off" oninput="actualizarBusqueda('stock', this);" onkeydown="buscarClaveConEnter('stock', event, this);">
    </div>
    ${renderFiltroCategorias(categorias)}
    <div class="stk-toolbar-actions">
      ${state.etiquetasInicialesImpresas ? '' : `<button class="btn" onclick="imprimirEtiquetasStock('todas')">Imprimir todas (${contarEtiquetasStock()})</button>`}
      <button class="btn" onclick="imprimirEtiquetasStock('nuevas')" ${contarEtiquetasPendientes()===0?'disabled':''}>Etiquetas nuevas (${contarEtiquetasPendientes()})</button>
    </div>
  </div>
  <div id="stockClaveResultado">${renderHistorialClave(stockClaveConsultada)}</div>

  <div id="stockSearchResults">${renderResultadosStock(productosFiltrados,categorias)}</div>
  `;
}

function renderResultadosStock(productosFiltrados,categorias){
  const porCategoria = {};
  categorias.forEach(c=>porCategoria[c]=[]);
  const sinCategoria = [];
  productosFiltrados.forEach(p=>{
    if(porCategoria[p.categoria]) porCategoria[p.categoria].push(p);
    else sinCategoria.push(p);
  });
  const itemsLimitados = (items)=>items.slice(0, MAX_SEARCH_ITEMS);
  const bloque = (titulo, clave, todos)=>{
    const items = itemsLimitados(todos);
    if(!items.length) return '';
    const uds = todos.reduce((t,p)=>t+p.variantes.reduce((a,v)=>a+(Number(v.stock)||0),0),0);
    return `<section class="stk-group" aria-label="${escaparHTML(titulo)}">
      <div class="stk-group-head"><h3>${escaparHTML(titulo)}</h3><span class="stk-group-meta">${todos.length} prenda${todos.length===1?'':'s'} · ${uds} u.</span></div>
      <div class="stk-group-list" data-scrollkey="stockcat:${escaparHTML(clave)}">${items.map(p=>renderProductoCard(p)).join('')}</div>
    </section>`;
  };
  return `${categorias.map(cat=>bloque(cat,cat,porCategoria[cat])).join('')}
  ${bloque('Sin categoría','__sin',sinCategoria)}
  ${state.productos.length===0 ? '<div class="stk-empty"><strong>Todavía no cargaste productos.</strong><span>Usá “+ Añadir prenda” para empezar con la carga rápida.</span></div>' : ''}
  ${state.productos.length>0 && productosFiltrados.length===0 ? '<div class="stk-empty"><strong>No encontramos productos con ese filtro.</strong><span>Probá con otra palabra o elegí “Todas las categorías”.</span></div>' : ''}`;
}

function valorOrdenTalle(talle){
  const valor = String(talle||'').trim().toUpperCase();
  const equivalencias = {S:1,M:2,L:3,XL:4,XXL:5};
  if(equivalencias[valor]) return equivalencias[valor];
  if(/^\d+$/.test(valor)) return Number(valor);
  return Number.POSITIVE_INFINITY;
}
function compararVariantesPorTalle(a,b){
  const ordenA = valorOrdenTalle(a.talle);
  const ordenB = valorOrdenTalle(b.talle);
  if(ordenA!==ordenB) return ordenA-ordenB;
  const talleA = String(a.talle||'').toUpperCase();
  const talleB = String(b.talle||'').toUpperCase();
  if(talleA!==talleB) return talleA.localeCompare(talleB,'es');
  return String(a.color||'').localeCompare(String(b.color||''),'es');
}
function estadoStock(n){ return n<=0 ? 'low' : n<=LOW_STOCK ? 'mid' : 'ok'; }
/* Menú emergente de acciones de la prenda (⋯). Eliminar solo lo ve el administrador. */
let stockAbiertos = new Set();
function toggleProd(id){ stockAbiertos.has(id) ? stockAbiertos.delete(id) : stockAbiertos.add(id); renderAll(); }
let popKey = null;
function cerrarPop(){ popKey = null; const q = document.getElementById('pop'); if(q) q.style.display = 'none'; }
function togglePop(key, el, items){
  let q = document.getElementById('pop');
  if(!q){ q = document.createElement('div'); q.id = 'pop'; q.className = 'pop'; q.setAttribute('role','menu'); document.body.appendChild(q); }
  if(popKey===key){ cerrarPop(); return; }
  popKey = key; popAbiertoEn = Date.now();
  q.innerHTML = items.map(i=>`<button type="button" role="menuitem" class="${i[2]||''}" onclick="cerrarPop(); ${i[1]}">${i[0]}</button>`).join('');
  q.style.display = 'block';
  const r = el.getBoundingClientRect(), w = q.offsetWidth;
  q.style.top = (r.bottom+6)+'px'; q.style.left = Math.max(8, Math.min(r.right-w, innerWidth-w-8))+'px';
}
document.addEventListener('click', e=>{ if(popKey && !e.target.closest('.pop') && !e.target.closest('[data-pop]')) cerrarPop(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') cerrarPop(); });
let popAbiertoEn = 0;
window.addEventListener('scroll', ()=>{ if(Date.now()-popAbiertoEn>400) cerrarPop(); }, true);
function menuProd(id, el){
  const items = [['Editar',"iniciarEdicionProducto('"+id+"')"],['Imprimir etiquetas',"abrirReimpresion('"+id+"')"]];
  if(session==='admin') items.push(['Eliminar producto',"pedirEliminarProducto('"+id+"')",'dng']);
  togglePop('p'+id, el, items);
}
function renderProductoCard(p){
  const totalStock = p.variantes.reduce((a,v)=>a+(Number(v.stock)||0),0);
  const variantesOrdenadas = p.variantes.slice().sort(compararVariantesPorTalle);
  const id = escaparHTML(p.id);
  const pctD = porcentajeRecargo('Débito'), pctC = porcentajeRecargo('Crédito');
  const chip = (rotulo,valor,clase='')=>`<span class="stk-chip ${clase}"><span class="stk-chip-l">${rotulo}</span> <span class="num">${valor}</span></span>`;
  const editando = productoEditandoId===p.id && productoEditDraft;
  const estado = totalStock<=0 ? 'Sin stock' : totalStock<=LOW_STOCK ? 'Stock bajo' : 'En stock';
  const buscado = stockSearch.trim().toLowerCase();
  const abierto = stockAbiertos.has(p.id) || productoEditandoId===p.id || addVarianteFormFor===p.id || productoAEliminarId===p.id
    || (buscado && p.variantes.some(v=>(v.codigo||'').toLowerCase()===buscado));
  return `
  <article class="card stk-card ${totalStock<=0?'is-out':''} ${abierto?'abierto':'cerrado'}">
    <header class="stk-card-head" role="button" tabindex="0" aria-expanded="${abierto}" aria-label="${abierto?'Cerrar':'Abrir'} ${escaparHTML(p.nombre)}" onclick="toggleProd('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleProd('${id}');}">
      <span class="stk-chev" aria-hidden="true">${abierto?'▾':'▸'}</span>
      <div class="stk-card-title">
        <h4>${escaparHTML(p.nombre)}${p.descripcion ? ` <span class="stk-desc">· ${escaparHTML(p.descripcion)}</span>` : ''}</h4>
      </div>
      <span class="stk-precio num">${money(p.precio)}</span>
      <div class="stk-card-side">
        <span class="pill stk-total ${estadoStock(totalStock)}" title="${estado}"><span class="num">${totalStock}</span> en stock</span>
        <button type="button" class="ico" data-pop aria-haspopup="menu" aria-label="Acciones de ${escaparHTML(p.nombre)}" onclick="event.stopPropagation(); menuProd('${id}',this)">⋯</button>
      </div>
    </header>
    ${abierto ? `<div class="stk-body">
    <div class="stk-chips">
      ${session==='admin' ? chip('Costo',money(p.costo),'muted') : ''}
      ${chip('Venta',money(p.precio),'strong')}
      ${pctD>0 ? chip('Débito',money(Math.round(p.precio*(1+pctD/100)))) : ''}
      ${pctC>0 ? chip('Crédito',money(Math.round(p.precio*(1+pctC/100)))) : ''}
    </div>
    ${editando ? `
      <div class="stk-edit">
        <div class="stk-form-grid">
          <div class="stk-field stk-span2"><label>Nombre</label><input type="text" value="${escaparHTML(productoEditDraft.nombre)}" oninput="productoEditDraft.nombre=this.value"></div>
          <div class="stk-field"><label>Categoría</label><select onchange="productoEditDraft.categoria=this.value">${state.config.categorias.map(c=>`<option value="${escaparHTML(c)}" ${productoEditDraft.categoria===c?'selected':''}>${escaparHTML(c)}</option>`).join('')}</select></div>
          <div class="stk-field stk-span2"><label>Descripción</label><input type="text" value="${escaparHTML(productoEditDraft.descripcion)}" oninput="productoEditDraft.descripcion=this.value"></div>
          ${session === 'admin' ? `<div class="stk-field"><label>Costo</label><input type="number" min="0" value="${escaparHTML(productoEditDraft.costo)}" oninput="productoEditDraft.costo=this.value"></div>` : ''}
          <div class="stk-field"><label>Precio</label><input type="number" min="0" value="${escaparHTML(productoEditDraft.precio)}" oninput="productoEditDraft.precio=this.value"></div>
        </div>
        <div class="stk-actions">
          <button class="btn small primary" onclick="guardarEdicionProducto('${id}')">Guardar cambios</button>
          <button class="btn small ghost" onclick="cancelarEdicionProducto()">Cancelar</button>
        </div>
      </div>` : ''}
    ${p.variantes.length===0 ? '<p class="stk-novars">Sin variantes cargadas todavía.</p>' : `
    <div class="stk-vars" role="table" aria-label="Variantes de ${escaparHTML(p.nombre)}">
      <div class="stk-vrow stk-vhead" role="row"><span role="columnheader">Talle</span><span role="columnheader">Color</span><span role="columnheader">Clave</span><span role="columnheader" class="r">Stock</span><span role="columnheader" class="r">Ajustar</span><span role="columnheader"><span class="sr-only">Acciones</span></span></div>
      ${variantesOrdenadas.map(v=>{
        const vid = escaparHTML(v.id), et = escaparHTML(etiquetaVariante(v));
        return `<div class="stk-vrow ${Number(v.stock)<=0?'is-out':''}" role="row">
        <span class="stk-talle" role="cell">${escaparHTML(v.talle||'-')}</span>
        <span class="stk-color" role="cell">${v.color ? escaparHTML(v.color) : '<span class="muted">—</span>'}</span>
        <span class="stk-clave" role="cell">${v.codigo ? `<code>${escaparHTML(v.codigo)}</code>` : ''}</span>
        <span class="r" role="cell"><span class="pill ${estadoStock(Number(v.stock))}"><span class="num">${v.stock}</span></span></span>
        <span class="r" role="cell"><span class="stepper">
          <button onclick="ajustarStock('${id}','${vid}',-1)" aria-label="Restar una unidad a ${et}">−</button>
          <button onclick="ajustarStock('${id}','${vid}',1)" aria-label="Sumar una unidad a ${et}">+</button>
        </span></span>
        <span class="stk-vact" role="cell"><button class="link-btn" onclick="eliminarVariante('${id}','${vid}')" aria-label="Quitar ${et}">Quitar</button></span>
      </div>`;}).join('')}
    </div>`}
    ${addVarianteFormFor===p.id ? `
    <div class="stk-addvar">
      <div class="stk-form-grid">
        <div class="stk-field"><label>Talles</label><input type="text" value="${escaparHTML(nuevaVariante.talle)}" oninput="nuevaVariante.talle=this.value" placeholder="1,2,3 o S,M,L"></div>
        <div class="stk-field"><label>Colores</label><input type="text" value="${escaparHTML(nuevaVariante.color)}" oninput="nuevaVariante.color=this.value" placeholder="Negro, Blanco..."></div>
        <div class="stk-field"><label>Cantidad (c/u)</label><input type="number" min="1" value="${nuevaVariante.stock||1}" oninput="nuevaVariante.stock=this.value"></div>
      </div>
      <div class="stk-actions"><button class="btn small primary" onclick="guardarVariante('${id}')">Agregar</button><button class="btn small ghost" onclick="addVarianteFormFor=null; renderAll();">Cancelar</button></div>
    </div>` : ''}
    ${(addVarianteFormFor!==p.id || productoAEliminarId===p.id) ? `<footer class="stk-card-foot">
      ${addVarianteFormFor===p.id ? '' : `<button class="btn small ghost" onclick="addVarianteFormFor='${id}'; nuevaVariante={talle:'',color:'',stock:'',codigo:''}; renderAll();">+ Talle / color</button>`}
      <span class="stk-spacer"></span>
      ${productoAEliminarId===p.id ? `
        <span class="stk-confirm" role="alert">¿Eliminar este producto y todas sus variantes? No se puede deshacer.</span>
        <button class="btn small danger" onclick="eliminarProducto('${id}')">Sí, eliminar</button>
        <button class="btn small ghost" onclick="productoAEliminarId=null; renderAll();">Cancelar</button>
      ` : ''}
    </footer>` : ''}
  </div>` : ''}
  </article>`;
}

/* Evita que variantes de productos distintos compartan código (rompería el escaneo). Si ya existe en otro producto, agrega -V2, -V3... */
function codigoUnicoEnCatalogo(codigo, producto){
  const base = (codigo||'').trim();
  if(!base) return base;
  const usado = c => state.productos.some(p=>p!==producto && p.variantes.some(v=>(v.codigo||'').toLowerCase()===c.toLowerCase()));
  if(!usado(base)) return base;
  let n = 2; while(usado(base+'-V'+n)) n++;
  return base+'-V'+n;
}
/* Mismo nombre + distinta descripción/diseño = producto distinto (ej.: remera negra estampa blanca vs amarilla). */
function buscarProductoPorNombre(nombre, descripcion){
  const n = (nombre||'').trim().toLowerCase(), d = (descripcion||'').trim().toLowerCase();
  if(d) return state.productos.find(p=>p.nombre.toLowerCase()===n && (p.descripcion||'').trim().toLowerCase()===d);
  const mismos = state.productos.filter(p=>p.nombre.toLowerCase()===n);
  return mismos.find(p=>!(p.descripcion||'').trim()) || (mismos.length===1 ? mismos[0] : undefined);
}
/* true si hay varias prendas con ese nombre y sin descripción no se sabe a cuál sumar */
function nombreAmbiguo(nombre, descripcion){
  if((descripcion||'').trim()) return false;
  const n = (nombre||'').trim().toLowerCase();
  const mismos = state.productos.filter(p=>p.nombre.toLowerCase()===n);
  return mismos.length>1 && !mismos.some(p=>!(p.descripcion||'').trim());
}
/* La clave SIEMPRE se genera sola; nadie puede escribirla ni cambiarla (la base de datos también lo impide). */
function claveAutomatica(producto, talle, color){
  return codigoUnicoEnCatalogo(sugerirCodigoVariante(producto.nombre, talle, color, producto.categoria, producto).trim().toUpperCase(), producto);
}
/* Misma variante = mismo talle y mismo color (la clave puede repetirse entre talles). */
function mismaTalleColor(v, talle, color){
  return (v.talle||'').toLowerCase()===(talle||'').toLowerCase() && (v.color||'').toLowerCase()===(color||'').toLowerCase();
}
function pitido(ok){
  try{
    const a = new (window.AudioContext||window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = ok ? 1100 : 300; g.gain.value = 0.08; o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + (ok ? 0.08 : 0.25));
  }catch(e){}
}
function resolverClaveExacta(term){
  const t = (term||'').trim().toLowerCase();
  if(!t) return null;
  for(const p of state.productos){
    const v = p.variantes.find(v=>codigoBarras(v,p).toLowerCase()===t);
    if(v) return {p, v};   // etiqueta con talle: variante exacta
  }
  const todas = state.productos.flatMap(p=>p.variantes.filter(v=>(v.codigo||'').toLowerCase()===t).map(v=>({p,v})));
  if(!todas.length) return null;
  const conStock = todas.filter(({v})=>Number(v.stock)>0);
  const unica = todas.length===1 ? todas[0] : (conStock.length===1 ? conStock[0] : null);
  return {p: todas[0].p, v: unica ? unica.v : null};
}
/* Número único y permanente por prenda (001, 002...). Lo entrega la base de datos (secuencia), así nunca se repite aunque carguen varios usuarios a la vez. */
async function nuevoNumeroProducto(){
  const {data,error} = await sb.rpc('siguiente_num_producto');
  if(error || !data) throw new Error(error ? error.message : 'sin número');
  return Number(data);
}
function sugerirCodigoVariante(nombre, talle, color='', categoria='', producto=null){
  const categoriaLimpia = normalizarClave(categoria);
  const categoriaCodigo = categoriaLimpia.slice(0,3);
  const palabras = (nombre||'').trim().split(/\s+/).filter(Boolean);
  const palabraNombre = palabras.find(p=>!categoriaCodigo || !normalizarClave(p).startsWith(categoriaCodigo)) || palabras[0] || '';
  const nombreCodigo = normalizarClave(palabraNombre).slice(0,3);
  const colorCodigo = normalizarClave(color).slice(0,3);
  const talleNormalizado = normalizarClave(talle);
  const talleCodigo = /^\d+$/.test(talleNormalizado) ? talleNormalizado.padStart(2,'0') : talleNormalizado;
  const numCodigo = (producto && Number(producto.num)>0) ? String(producto.num).padStart(3,'0') : '';
  /* Prendas con número: la clave identifica prenda + color (todos los talles comparten clave).
     Prendas viejas (sin número) conservan el talle en la clave para no romper etiquetas ya impresas. */
  return [categoriaCodigo || normalizarClave(palabras[0]).slice(0,3), nombreCodigo, numCodigo, colorCodigo, numCodigo ? '' : talleCodigo].filter(Boolean).join('-');
}
function iniciarEdicionProducto(id){
  const producto = state.productos.find(p=>p.id===id);
  if(!producto) return;
  productoEditandoId = id;
  productoEditDraft = {nombre:producto.nombre, categoria:producto.categoria, descripcion:producto.descripcion||'', costo:producto.costo, precio:producto.precio};
  renderAll();
}
function guardarEdicionProducto(id){
  const producto = state.productos.find(p=>p.id===id);
  if(!producto || !productoEditDraft) return;
  if(!productoEditDraft.nombre.trim()){ showToast('El nombre del producto no puede quedar vacío'); return; }
  const nuevo = {nombre:productoEditDraft.nombre.trim(), categoria:productoEditDraft.categoria, descripcion:productoEditDraft.descripcion.trim(),
    costo: session==='admin' ? (Number(productoEditDraft.costo)||0) : producto.costo, precio:Number(productoEditDraft.precio)||0};
  const cambios = [];
  if(producto.nombre!==nuevo.nombre) cambios.push('nombre "'+producto.nombre+'" → "'+nuevo.nombre+'"');
  if((producto.categoria||'')!==(nuevo.categoria||'')) cambios.push('categoría "'+(producto.categoria||'-')+'" → "'+(nuevo.categoria||'-')+'"');
  if((producto.descripcion||'')!==nuevo.descripcion) cambios.push('descripción "'+(producto.descripcion||'')+'" → "'+nuevo.descripcion+'"');
  if(Number(producto.costo||0)!==nuevo.costo) cambios.push('costo '+money(producto.costo)+' → '+money(nuevo.costo));
  if(Number(producto.precio||0)!==nuevo.precio) cambios.push('precio '+money(producto.precio)+' → '+money(nuevo.precio));
  if(cambios.length) registrarMovimiento('Producto editado', nuevo.nombre+': '+cambios.join('; '));
  const precioCambio = Number(producto.precio||0)!==nuevo.precio;
  Object.assign(producto, nuevo);
  if(precioCambio) marcarEtiquetasPorPrecio(producto);
  save();
  productoEditandoId = null; productoEditDraft = null;
  showToast(precioCambio ? 'Precio actualizado. Las etiquetas de esta prenda quedaron pendientes para reimprimir' : 'Producto actualizado');
  renderAll();
}
function cancelarEdicionProducto(){ productoEditandoId = null; productoEditDraft = null; renderAll(); }

async function crearProducto(){
  if(!nuevoProd.nombre.trim()){ showToast('Ponele un nombre al producto'); return; }
  let num; try{ num = await nuevoNumeroProducto(); }catch(e){ showToast('No se pudo obtener el número de prenda: '+(e.message||e)); return; }
  const nuevoProdNombreLog = nuevoProd.nombre.trim()+' · precio '+money(Number(nuevoProd.precio)||0);
  state.productos.push({
    id: uid(), num, nombre: nuevoProd.nombre.trim(), descripcion: nuevoProd.descripcion.trim(),
    categoria: nuevoProd.categoria, costo: session==='admin' ? (Number(nuevoProd.costo)||0) : 0, precio: Number(nuevoProd.precio)||0, variantes: []
  });
  save();
  nuevoProd = {nombre:'', descripcion:'', categoria: state.config.categorias[0]||'', costo:'', precio:''};
  showNuevoProducto = false;
  registrarMovimiento('Producto creado', nuevoProdNombreLog, {guardar:true});
  showToast('Producto creado');
  renderAll();
}
function cancelarNuevoProducto(){
  nuevoProd = {nombre:'', descripcion:'', categoria: state.config.categorias[0]||'', costo:'', precio:''};
  nuevaVariante = {talle:'', color:'', stock:'', codigo:''};
  showNuevoProducto = false;
  renderAll();
}
async function guardarCargaRapidaStock(){
  const nombre = nuevoProd.nombre.trim();
  if(!nombre){ showToast('Escribí el nombre de la prenda'); return; }
  const categoria = nuevoProd.categoria || state.config.categorias[0] || 'Otros';
  if(nombreAmbiguo(nombre, nuevoProd.descripcion)){ showToast('Hay varias "'+nombre+'". Escribí la descripción para saber a cuál sumar'); return; }
  let producto = buscarProductoPorNombre(nombre, nuevoProd.descripcion);
  if(!producto){
    let num; try{ num = await nuevoNumeroProducto(); }catch(e){ showToast('No se pudo obtener el número de prenda: '+(e.message||e)); return; }
    producto = {id:uid(), num, nombre, descripcion:nuevoProd.descripcion.trim(), categoria, costo: session==='admin' ? (Number(nuevoProd.costo)||0) : 0, precio:Number(nuevoProd.precio)||0, variantes:[]};
    state.productos.push(producto);
  }else{
    if(nuevoProd.descripcion.trim()) producto.descripcion = nuevoProd.descripcion.trim();
    if(session==='admin' && nuevoProd.costo!=='') producto.costo = Number(nuevoProd.costo)||0;
    if(nuevoProd.precio!=='') producto.precio = Number(nuevoProd.precio)||0;
    producto.categoria = categoria;
  }
  if(!state.config.categorias.some(c=>c.toLowerCase()===categoria.toLowerCase())) state.config.categorias.push(categoria);
  const talles = (nuevaVariante.talle.trim()||'Único').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
  const colores = (nuevaVariante.color.trim()||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
  const coloresFinales = colores.length ? colores : [''];
  const cantidad = Math.max(1, parseInt(nuevaVariante.stock)||0);
  let agregadas = 0;
  talles.forEach(talle=>coloresFinales.forEach(color=>{
    const codigo = claveAutomatica(producto, talle, color);
    let variante = producto.variantes.find(v=>mismaTalleColor(v,talle,color));
    if(!variante){ variante={id:uid(),talle,color,codigo,stock:0}; producto.variantes.push(variante); }
    variante.stock += cantidad;
    registrarEtiquetasPendientes(variante.id,cantidad);
    agregadas++;
  }));
  save();
  nuevoProd={nombre:'',descripcion:'',categoria:state.config.categorias[0]||'',costo:'',precio:''};
  nuevaVariante={talle:'',color:'',stock:'',codigo:''};
  showNuevoProducto=false;
  registrarMovimiento('Stock cargado', producto.nombre+': +'+cantidad+' c/u en '+agregadas+' variante(s)', {guardar:true});
  showToast(agregadas+' variante(s) agregada(s) al stock');
  renderAll();
}
function pedirEliminarProducto(id){
  productoAEliminarId = id;
  renderAll();
}
function eliminarProducto(id){
  const producto=state.productos.find(p=>p.id===id);
  const variantes = (producto && Array.isArray(producto.variantes)) ? producto.variantes : [];
  state.etiquetasPendientes = state.etiquetasPendientes || {};
  variantes.forEach(variante=>delete state.etiquetasPendientes[variante.id]);
  registrarMovimiento('Producto eliminado', producto ? producto.nombre+' ('+variantes.length+' variante(s), '+variantes.reduce((t,v)=>t+Number(v.stock||0),0)+' u. en stock)' : String(id));
  state.productos = state.productos.filter(p=>p.id!==id);
  productoAEliminarId = null;
  if(addVarianteFormFor===id) addVarianteFormFor = null;
  if(productoEditandoId===id) productoEditandoId = null;
  save(); renderAll();
  showToast('Producto eliminado');
}
function dividirLista(txt){ return (txt||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean); }
/* Acepta varios talles y/o colores separados por coma: crea una variante por cada combinación. */
function guardarVariante(prodId){
  const p = state.productos.find(p=>p.id===prodId);
  if(!p) return;
  const tallesLista = dividirLista(nuevaVariante.talle);
  const talles = tallesLista.length ? tallesLista : ['Único'];
  const colores = dividirLista(nuevaVariante.color);
  const coloresFinales = colores.length ? colores : [''];
  const cantidad = Math.max(1, Math.floor(Number(nuevaVariante.stock))||1);
  const combinaciones = talles.length*coloresFinales.length;
  let nuevas = 0, sumadas = 0;
  talles.forEach(talle=>coloresFinales.forEach(color=>{
    const codigo = claveAutomatica(p, talle, color);
    const existente = p.variantes.find(v=>mismaTalleColor(v,talle,color));
    if(existente){
      existente.stock += cantidad;
      registrarEtiquetasPendientes(existente.id,cantidad);
      registrarMovimiento('Stock agregado', p.nombre+' ('+etiquetaVariante(existente)+'): +'+cantidad+' → '+existente.stock);
      sumadas++;
    }else{
      const variante={id:uid(), talle, color, codigo, stock:cantidad};
      p.variantes.push(variante);
      registrarEtiquetasPendientes(variante.id,variante.stock);
      registrarMovimiento('Variante agregada', p.nombre+' ('+etiquetaVariante(variante)+') · stock '+variante.stock);
      nuevas++;
    }
  }));
  save();
  addVarianteFormFor = null;
  nuevaVariante = {talle:'', color:'', stock:'', codigo:''};
  if(combinaciones===1 && sumadas===1) showToast('Ya existía ese talle/color: se sumaron '+cantidad);
  else if(combinaciones===1) showToast('Agregado: '+cantidad+' prenda(s)');
  else showToast(nuevas+' variante(s) nueva(s)'+(sumadas?' · '+sumadas+' ya existían y se les sumó stock':'')+' · '+cantidad+' c/u');
  renderAll();
}
function eliminarVariante(prodId,varId){
  const p = state.productos.find(p=>p.id===prodId);
  if(!p) return;
  const vEliminada = p.variantes.find(v=>v.id===varId);
  if(vEliminada) registrarMovimiento('Variante eliminada', p.nombre+' ('+etiquetaVariante(vEliminada)+') · tenía '+vEliminada.stock+' u.');
  delete state.etiquetasPendientes[varId];
  p.variantes = p.variantes.filter(v=>v.id!==varId);
  save(); renderAll();
}
function ajustarStock(prodId,varId,delta){
  const p = state.productos.find(p=>p.id===prodId);
  const v = p.variantes.find(v=>v.id===varId);
  if(delta>0) registrarEtiquetasPendientes(v.id,delta);
  else retirarEtiquetasPendientes(v.id,Math.abs(delta));
  const stockAnterior = v.stock;
  v.stock = Math.max(0, v.stock+delta);
  registrarMovimiento('Stock ajustado', p.nombre+' ('+etiquetaVariante(v)+'): '+stockAnterior+' → '+v.stock);
  save(); renderAll();
}
