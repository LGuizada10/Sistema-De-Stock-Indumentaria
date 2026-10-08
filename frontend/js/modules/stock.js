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
  <div class="field" style="max-width:300px;">
    <label>Categoría</label>
    <select onchange="stockCategoryFilter=this.value; renderAll();">
      <option value="">Todas las categorías (${state.productos.length})</option>
      ${opciones}
    </select>
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
  <h2 class="section-title">Stock</h2>
  <p class="section-note">Tus productos, talles/colores y cantidades disponibles.</p>
  ${renderCostosPendientes()}
  ${renderAlertasStock()}
  <div class="row" style="margin-bottom:12px;">
    ${state.etiquetasInicialesImpresas ? '' : `<button class="btn" onclick="imprimirEtiquetasStock('todas')">Imprimir todas (${contarEtiquetasStock()})</button>`}
    <button class="btn primary" onclick="imprimirEtiquetasStock('nuevas')" ${contarEtiquetasPendientes()===0?'disabled':''}>Nuevas Etiquetas (${contarEtiquetasPendientes()})</button>
  </div>

  <div class="row" style="align-items:flex-end;margin-bottom:4px;">
  <div class="field" style="max-width:340px;">
    <label>Buscar por clave o nombre</label>
    <input type="text" data-search="stock" placeholder="Ej: REM-SAK o jean..." value="${stockSearch}" aria-label="Buscar por clave o nombre" oninput="actualizarBusqueda('stock', this);" onkeydown="buscarClaveConEnter('stock', event, this);">
  </div>
  ${renderFiltroCategorias(categorias)}
  </div>
  <div id="stockClaveResultado">${renderHistorialClave(stockClaveConsultada)}</div>
  <div style="height:8px;"></div>

  <button class="btn primary" onclick="showNuevoProducto=!showNuevoProducto; renderAll();">${showNuevoProducto?'Cancelar':'+ Añadir prenda'}</button>

  ${showNuevoProducto ? `
  <div class="card" style="margin-top:12px;">
    <div class="card-title">Carga rápida de prendas</div>
    <p class="section-note">Completá una variante por vez. Podés escribir varios talles o colores separados por coma, por ejemplo: 1,2,3.</p>
    <div class="row">
      <div class="field" style="flex:2 1 200px;">
        <label>Prenda</label>
        <input type="text" placeholder="Ej: Remera lisa Corteiz" value="${nuevoProd.nombre}" oninput="nuevoProd.nombre=this.value">
      </div>
      <div class="field">
        <label>Categoría</label>
        <select onchange="nuevoProd.categoria=this.value">
          ${categorias.map(c=>`<option value="${c}" ${nuevoProd.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="flex:2 1 200px;">
        <label>Descripción / diseño (opcional)</label>
        <input type="text" placeholder="Ej: bolsillo cargo, estampa frontal..." value="${nuevoProd.descripcion}" oninput="nuevoProd.descripcion=this.value">
      </div>
      ${session === 'admin' ? `<div class="field">
        <label>Costo unitario</label>
        <input type="number" min="0" placeholder="0" value="${nuevoProd.costo}" oninput="nuevoProd.costo=this.value">
      </div>` : ''}
      <div class="field">
        <label>Precio de venta</label>
        <input type="number" min="0" placeholder="0" value="${nuevoProd.precio}" oninput="nuevoProd.precio=this.value">
      </div>
    </div>
    <div class="row">
      <div class="field"><label>Talles</label><input type="text" placeholder="1,2,3 o S,M,L" value="${nuevaVariante.talle}" oninput="nuevaVariante.talle=this.value"></div>
      <div class="field"><label>Colores</label><input type="text" placeholder="Negro,Blanco" value="${nuevaVariante.color}" oninput="nuevaVariante.color=this.value"></div>
      <div class="field" style="max-width:110px;"><label>Cantidad</label><input type="number" min="1" value="${nuevaVariante.stock||1}" oninput="nuevaVariante.stock=this.value"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn primary" onclick="guardarCargaRapidaStock()">Agregar al stock</button>
      <button class="btn ghost" onclick="cancelarNuevoProducto()">Cancelar</button>
    </div>
  </div>` : ''}

  <hr class="stitch">

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
  return `${categorias.map(cat=>{
    const items = itemsLimitados(porCategoria[cat]);
    if(!items.length) return '';
    return `<div class="cat-heading">${escaparHTML(cat)}</div><div data-scrollkey="stockcat:${escaparHTML(cat)}" style="max-height:360px;overflow-y:auto;">${items.map(p=>renderProductoCard(p)).join('')}</div>`;
  }).join('')}
  ${sinCategoria.length ? `<div class="cat-heading">Sin categoría</div><div data-scrollkey="stockcat:__sin" style="max-height:360px;overflow-y:auto;">${itemsLimitados(sinCategoria).map(p=>renderProductoCard(p)).join('')}</div>` : ''}
  ${state.productos.length===0 ? '<p class="empty">Todavía no cargaste productos.</p>' : ''}
  ${state.productos.length>0 && productosFiltrados.length===0 ? '<p class="empty">No encontramos productos con ese filtro.</p>' : ''}`;
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
function renderProductoCard(p){
  const totalStock = p.variantes.reduce((a,v)=>a+v.stock,0);
  const variantesOrdenadas = p.variantes.slice().sort(compararVariantesPorTalle);
  return `
  <div class="card">
    <div class="card-title">
      <span>${p.nombre} <span class="muted num" style="font-size:12px;">· ${session === 'admin' ? 'costo '+money(p.costo)+' · ' : ''}venta ${money(p.precio)}${porcentajeRecargo('Débito')>0 ? ' · débito '+money(Math.round(p.precio*(1+porcentajeRecargo('Débito')/100))) : ''}${porcentajeRecargo('Crédito')>0 ? ' · crédito '+money(Math.round(p.precio*(1+porcentajeRecargo('Crédito')/100))) : ''}</span></span>
      <span style="display:flex;align-items:center;gap:8px;"><span class="pill ${totalStock<=0?'low':totalStock<=LOW_STOCK?'mid':'ok'}">${totalStock} en stock</span><button class="btn small ghost" onclick="iniciarEdicionProducto('${p.id}')">Editar</button></span>
    </div>
    ${p.descripcion ? `<div class="prod-desc">${p.descripcion}</div>` : ''}
    ${productoEditandoId===p.id ? `
      <div class="row" style="margin-top:10px;">
        <div class="field"><label>Nombre</label><input type="text" value="${productoEditDraft.nombre}" oninput="productoEditDraft.nombre=this.value"></div>
        <div class="field"><label>Categoría</label><select oninput="productoEditDraft.categoria=this.value">${state.config.categorias.map(c=>`<option value="${c}" ${productoEditDraft.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Descripción</label><input type="text" value="${productoEditDraft.descripcion}" oninput="productoEditDraft.descripcion=this.value"></div>
        ${session === 'admin' ? `<div class="field"><label>Costo</label><input type="number" min="0" value="${productoEditDraft.costo}" oninput="productoEditDraft.costo=this.value"></div>` : ''}
        <div class="field"><label>Precio</label><input type="number" min="0" value="${productoEditDraft.precio}" oninput="productoEditDraft.precio=this.value"></div>
      </div>
      <button class="btn small primary" onclick="guardarEdicionProducto('${p.id}')">Guardar cambios</button>
      <button class="btn small ghost" onclick="cancelarEdicionProducto()">Cancelar</button>
    ` : ''}
    ${p.variantes.length===0 ? '<p class="empty">Sin variantes cargadas todavía.</p>' : variantesOrdenadas.map(v=>`
      <div class="variant-row">
        <span class="vlabel">${v.talle||'-'} ${v.color?('· '+v.color):''} ${v.codigo?`<span class="pill mid" style="margin-left:4px;">${v.codigo}</span>`:''}</span>
        <span class="pill ${v.stock<=0?'low':v.stock<=LOW_STOCK?'mid':'ok'}">${v.stock}</span>
        <div class="stepper">
          <button onclick="ajustarStock('${p.id}','${v.id}',-1)">−</button>
          <button onclick="ajustarStock('${p.id}','${v.id}',1)">+</button>
        </div>
        <button class="link-btn" onclick="eliminarVariante('${p.id}','${v.id}')">Quitar</button>
      </div>
    `).join('')}
    <div class="row" style="margin-top:10px;">
      ${addVarianteFormFor===p.id ? `
        <div class="field" style="flex:1 1 90px;"><label>Talles</label><input type="text" value="${nuevaVariante.talle}" oninput="nuevaVariante.talle=this.value" placeholder="1,2,3 o S,M,L"></div>
        <div class="field" style="flex:1 1 90px;"><label>Colores</label><input type="text" value="${nuevaVariante.color}" oninput="nuevaVariante.color=this.value" placeholder="Negro, Blanco..."></div>
        <div class="field" style="flex:1 1 70px;"><label>Cantidad (c/u)</label><input type="number" min="1" value="${nuevaVariante.stock||1}" oninput="nuevaVariante.stock=this.value"></div>
        <div class="field" style="flex:0 0 auto;justify-content:flex-end;">
          <div style="display:flex;gap:6px;"><button class="btn small primary" onclick="guardarVariante('${p.id}')">Agregar</button><button class="btn small ghost" onclick="addVarianteFormFor=null; renderAll();">Cancelar</button></div>
        </div>
      ` : `<button class="btn small ghost" onclick="addVarianteFormFor='${p.id}'; nuevaVariante={talle:'',color:'',stock:'',codigo:''}; renderAll();">+ Talle/color</button>`}
      ${productoAEliminarId===p.id ? `
        <span class="muted" style="font-size:12.5px;align-self:center;">¿Eliminar este producto y todas sus variantes?</span>
        <button class="btn small danger" onclick="eliminarProducto('${p.id}')">Sí, eliminar</button>
        <button class="btn small ghost" onclick="productoAEliminarId=null; renderAll();">Cancelar</button>
      ` : `${addVarianteFormFor===p.id ? '' : `<button class="btn small" onclick="abrirReimpresion('${p.id}')">Etiquetas</button>`}
        <button class="btn small danger" onclick="pedirEliminarProducto('${p.id}')">Eliminar producto</button>`}
    </div>
  </div>`;
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
