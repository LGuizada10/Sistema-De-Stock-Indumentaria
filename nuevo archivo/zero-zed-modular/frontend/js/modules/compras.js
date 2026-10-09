// [ZZ] modules/compras.js — Administración de compras con búsqueda y páginas cargadas desde Supabase.
let nuevaCompra = {fecha:todayStr(),descripcion:'',lugar:'',proveedor:'',direccion:'',telefono:'',costo:'',notas:''};
let compraLineas = [];
let compraRapida = {nombre:'',categoria:'',descripcion:'',talle:'',color:'',codigo:'',costo:'',precio:'',cantidad:1};
let comprasBusqueda='', comprasPaginaActual=0, comprasPorPagina=20;
let comprasPagina=[], comprasTotal=0, comprasCargando=false, comprasError='', comprasInicializado=false;
let comprasSecuencia=0, comprasTimer=null, compraGuardando=false;

function renderCompras(){
  if(session!=='admin')return '';
  iniciarHistorialCompras();
  const unidadesEnBorrador=compraLineas.reduce((n,l)=>n+(Number(l.cantidad)||0),0);
  return `
  <header class="compras-header">
    <div><span class="compras-eyebrow">ADMINISTRACIÓN · ABASTECIMIENTO</span><h2 class="section-title">Compras</h2><p class="section-note">Registrá mercadería, actualizá el stock y encontrá compras anteriores desde el historial.</p></div>
    <div class="compras-header-badge"><span class="compras-status-dot"></span>Historial conectado</div>
  </header>

  <section class="compras-resumen" aria-label="Resumen del historial">
    <article class="compras-stat"><span>Resultados</span><strong>${comprasTotal.toLocaleString('es-AR')}</strong><small>${comprasBusqueda?'para esta búsqueda':'en la consulta actual'}</small></article>
    <article class="compras-stat"><span>En esta página</span><strong>${comprasPagina.length}</strong><small>${comprasPorPagina} registros por página</small></article>
    <article class="compras-stat compras-stat-highlight"><span>Importe visible</span><strong>${money(comprasPagina.reduce((t,c)=>t+Number(c.costo||0),0))}</strong><small>subtotal de esta página</small></article>
  </section>

  <section class="card compras-card">
    <div class="compras-card-heading"><div><span class="compras-step">01</span><div><h3>Nueva compra</h3><p>Completá los datos y agregá las prendas recibidas.</p></div></div><span class="compras-draft-count">${unidadesEnBorrador} u. en preparación</span></div>
    <div class="compras-subheading"><span>Datos del comprobante</span><i></i></div>
    <div class="compras-form-grid">
      <div class="field"><label for="compraFecha">Fecha</label><input id="compraFecha" type="date" value="${escaparHTML(nuevaCompra.fecha)}" oninput="nuevaCompra.fecha=this.value"></div>
      <div class="field compras-span-2"><label for="compraDescripcion">Descripción</label><input id="compraDescripcion" type="text" placeholder="Ej.: Reposición de remeras de invierno" value="${escaparHTML(nuevaCompra.descripcion)}" oninput="nuevaCompra.descripcion=this.value"></div>
      <div class="field"><label for="compraLugar">Lugar de compra</label><input id="compraLugar" type="text" placeholder="Ej.: Flores" value="${escaparHTML(nuevaCompra.lugar)}" oninput="nuevaCompra.lugar=this.value"></div>
      <div class="field"><label for="compraProveedor">Proveedor / local</label><input id="compraProveedor" type="text" placeholder="Nombre del local" value="${escaparHTML(nuevaCompra.proveedor)}" oninput="nuevaCompra.proveedor=this.value"></div>
      <div class="field compras-span-2"><label for="compraDireccion">Dirección</label><input id="compraDireccion" type="text" placeholder="Calle y altura" value="${escaparHTML(nuevaCompra.direccion)}" oninput="nuevaCompra.direccion=this.value"></div>
      <div class="field"><label for="compraTelefono">Teléfono</label><input id="compraTelefono" type="tel" placeholder="Contacto del proveedor" value="${escaparHTML(nuevaCompra.telefono)}" oninput="nuevaCompra.telefono=this.value"></div>
      <div class="field"><label for="compraCosto">Costo total</label><div class="compras-money-input"><span>$</span><input id="compraCosto" type="number" min="0" step="1" placeholder="0" value="${escaparHTML(nuevaCompra.costo)}" oninput="nuevaCompra.costo=this.value"></div></div>
    </div>
    <div class="field compras-notes"><label for="compraNotas">Notas <span>(opcional)</span></label><textarea id="compraNotas" rows="2" placeholder="Forma de pago, número de factura u otro detalle" oninput="nuevaCompra.notas=this.value">${escaparHTML(nuevaCompra.notas)}</textarea></div>

    <div class="compras-subheading"><span>Prendas que ingresan al stock</span><i></i></div>
    <p class="compras-help">Agregá cada talle y color. Al registrar la compra, las cantidades se suman al inventario.</p>
    <div class="compras-form-grid compras-stock-grid">
      <div class="field compras-span-2"><label for="compraRapidaNombre">Nombre de la prenda</label><input id="compraRapidaNombre" type="text" placeholder="Ej.: Remera bordada" value="${escaparHTML(compraRapida.nombre)}" oninput="compraRapida.nombre=this.value"></div>
      <div class="field"><label for="compraRapidaCategoria">Categoría</label><select id="compraRapidaCategoria" onchange="compraRapida.categoria=this.value"><option value="">Elegí categoría</option>${state.config.categorias.map(c=>`<option value="${escaparHTML(c)}" ${compraRapida.categoria===c?'selected':''}>${escaparHTML(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="compraRapidaTalle">Talles</label><input id="compraRapidaTalle" type="text" placeholder="1, 2, 3" value="${escaparHTML(compraRapida.talle)}" oninput="compraRapida.talle=this.value"></div>
      <div class="field"><label for="compraRapidaColor">Colores</label><input id="compraRapidaColor" type="text" placeholder="Negro, blanco" value="${escaparHTML(compraRapida.color)}" oninput="compraRapida.color=this.value"></div>
      <div class="field"><label for="compraRapidaCantidad">Unidades por variante</label><input id="compraRapidaCantidad" type="number" min="1" step="1" value="${escaparHTML(compraRapida.cantidad)}" oninput="compraRapida.cantidad=this.value"></div>
      <div class="field compras-span-2"><label for="compraRapidaDetalle">Descripción / diseño <span>(opcional)</span></label><input id="compraRapidaDetalle" type="text" placeholder="Ej.: estampado frontal" value="${escaparHTML(compraRapida.descripcion)}" oninput="compraRapida.descripcion=this.value"></div>
      <div class="field"><label for="compraRapidaCosto">Costo unitario</label><div class="compras-money-input"><span>$</span><input id="compraRapidaCosto" type="number" min="0" step="1" placeholder="0" value="${escaparHTML(compraRapida.costo)}" oninput="compraRapida.costo=this.value"></div></div>
      <div class="field"><label for="compraRapidaPrecio">Precio de venta</label><div class="compras-money-input"><span>$</span><input id="compraRapidaPrecio" type="number" min="0" step="1" placeholder="0" value="${escaparHTML(compraRapida.precio)}" oninput="compraRapida.precio=this.value"></div></div>
    </div>
    <button class="btn small ghost compras-add-line" type="button" onclick="agregarCompraRapida()">＋ Agregar variantes a la compra</button>
    ${renderLineasCompraBorrador()}
    <div class="compras-form-footer"><span>El historial y las líneas se guardan en la base de datos.</span><button class="btn primary compras-save" type="button" onclick="registrarCompra()" ${compraGuardando?'disabled':''}>${compraGuardando?'Guardando…':'Registrar compra'}</button></div>
  </section>

  <section class="card compras-card compras-history-card">
    <div class="compras-history-heading"><div><span class="compras-step">02</span><div><h3>Historial de compras</h3><p>La búsqueda y la paginación se resuelven directamente en Supabase.</p></div></div></div>
    <div class="compras-search-row"><label class="compras-search" for="comprasBusqueda"><span aria-hidden="true">⌕</span><input id="comprasBusqueda" type="search" placeholder="Buscar por descripción, lugar, proveedor, dirección o notas" value="${escaparHTML(comprasBusqueda)}" oninput="actualizarFiltroCompras(this)">${comprasBusqueda?'<button type="button" aria-label="Limpiar búsqueda" onclick="limpiarFiltroCompras()">×</button>':''}</label><label class="compras-page-size">Mostrar<select aria-label="Compras por página" onchange="cambiarTamanoPaginaCompras(this.value)"><option value="10" ${comprasPorPagina===10?'selected':''}>10</option><option value="20" ${comprasPorPagina===20?'selected':''}>20</option><option value="50" ${comprasPorPagina===50?'selected':''}>50</option></select></label></div>
    <div class="compras-search-hint">Buscá mientras escribís; solo se descarga la página visible.</div>
    <div id="comprasHistoryBody">${renderListadoCompras()}</div>
  </section>`;
}

function iniciarHistorialCompras(){
  if(comprasInicializado)return;
  comprasInicializado=true;
  comprasCargando=true;
  Promise.resolve().then(()=>cargarComprasDesdeSupabase(0));
}
function renderLineasCompraBorrador(){
  if(!compraLineas.length)return '<div class="compras-empty-lines">Todavía no agregaste prendas. También podés registrar la compra sin líneas si solo querés guardar el comprobante.</div>';
  return `<div class="compras-lines">${compraLineas.map((l,i)=>`<div class="compras-line"><span class="compras-line-icon">＋</span><div class="compras-line-name"><strong>${escaparHTML(l.nombre)}</strong><small>${escaparHTML(l.varianteLabel||'Único')}</small></div><span class="compras-line-qty">× ${Number(l.cantidad)||0}</span><button type="button" class="compras-line-remove" aria-label="Quitar ${escaparHTML(l.nombre)}" onclick="quitarLineaCompra(${i})">×</button></div>`).join('')}</div>`;
}
function renderListadoCompras(){
  if(comprasCargando)return '<div class="compras-loading"><span></span><span></span><span></span><small>Consultando compras…</small></div>';
  if(comprasError)return `<div class="compras-empty"><strong>No se pudo cargar el historial</strong><p>${escaparHTML(comprasError)}</p><button class="btn small ghost" onclick="cargarComprasDesdeSupabase(comprasPaginaActual)">Reintentar</button></div>`;
  if(!comprasPagina.length)return `<div class="compras-empty"><span class="compras-empty-mark">⌕</span><strong>${comprasBusqueda?'No encontramos compras con esa búsqueda':'Todavía no hay compras registradas'}</strong><p>${comprasBusqueda?'Probá con otro proveedor, lugar o descripción.':'Cuando registres una compra, aparecerá acá.'}</p></div>`;
  const inicio=comprasPaginaActual*comprasPorPagina+1, fin=Math.min(comprasPaginaActual*comprasPorPagina+comprasPagina.length,comprasTotal), paginas=Math.max(1,Math.ceil(comprasTotal/comprasPorPagina));
  return `<div class="compras-results">${comprasPagina.map(c=>{
    const lineas=c.lineas||[];
    const ubicacion=[c.lugar,c.proveedor].filter(Boolean).join(' · ');
    const contacto=[c.direccion,c.telefono].filter(Boolean).join(' · ');
    return `<article class="compras-record"><div class="compras-record-top"><div class="compras-record-title"><span class="compras-record-date">${fmtDate(c.fecha)}</span><h4>${escaparHTML(c.descripcion||'Compra sin descripción')}</h4></div><div class="compras-record-value"><small>Total de compra</small><strong>${money(c.costo)}</strong></div></div><div class="compras-record-meta">${ubicacion?`<span>⌖ ${escaparHTML(ubicacion)}</span>`:''}${contacto?`<span>☎ ${escaparHTML(contacto)}</span>`:''}</div>${c.notas?`<p class="compras-record-note">${escaparHTML(c.notas)}</p>`:''}${lineas.length?`<div class="compras-record-lines"><span class="compras-record-lines-label">${lineas.reduce((n,l)=>n+Number(l.cantidad||0),0)} unidades recibidas</span><div>${lineas.map(l=>`<span>${Number(l.cantidad)||0} × ${escaparHTML(l.nombre||'Prenda')}${l.varianteLabel?' · '+escaparHTML(l.varianteLabel):''}</span>`).join('')}</div></div>`:'<div class="compras-record-lines compras-no-lines">Sin prendas vinculadas al stock</div>'}<div class="compras-record-footer"><span>${escaparHTML(c.proveedor||'Registro de compra')}${c.lugar&&c.proveedor?' · '+escaparHTML(c.lugar):''}</span><button type="button" class="compras-delete" onclick="eliminarCompra('${escaparHTML(c.id)}')">Eliminar registro</button></div></article>`;
  }).join('')}</div><div class="compras-pagination"><span>Mostrando <strong>${inicio}–${fin}</strong> de <strong>${comprasTotal.toLocaleString('es-AR')}</strong></span><div><button type="button" class="btn small ghost" onclick="irPaginaCompras(${comprasPaginaActual-1})" ${comprasPaginaActual===0?'disabled':''}>← Anterior</button><span class="compras-page-indicator">${comprasPaginaActual+1} / ${paginas}</span><button type="button" class="btn small ghost" onclick="irPaginaCompras(${comprasPaginaActual+1})" ${fin>=comprasTotal?'disabled':''}>Siguiente →</button></div></div>`;
}
function refrescarListadoCompras(){
  const el=document.getElementById('comprasHistoryBody');if(el)el.innerHTML=renderListadoCompras();
  const resumen=document.querySelector('.compras-stat-highlight strong');
  if(resumen)resumen.textContent=money(comprasPagina.reduce((t,c)=>t+Number(c.costo||0),0));
  const resultado=document.querySelector('.compras-resumen .compras-stat:first-child strong');if(resultado)resultado.textContent=comprasTotal.toLocaleString('es-AR');
  const pagina=document.querySelector('.compras-resumen .compras-stat:nth-child(2) strong');if(pagina)pagina.textContent=String(comprasPagina.length);
}
async function cargarComprasDesdeSupabase(pagina=0,secuencia){
  const ticket=secuencia??++comprasSecuencia;
  comprasPaginaActual=Math.max(0,pagina);comprasCargando=true;comprasError='';refrescarListadoCompras();
  try{
    const resultado=await consultarComprasNube(comprasBusqueda,comprasPaginaActual*comprasPorPagina,comprasPorPagina);
    if(ticket!==comprasSecuencia)return;
    comprasPagina=resultado.compras;comprasTotal=resultado.total;state.compras=comprasPagina;
  }catch(e){if(ticket===comprasSecuencia){comprasPagina=[];comprasTotal=0;comprasError=e.message||String(e);}}
  finally{if(ticket===comprasSecuencia){comprasCargando=false;refrescarListadoCompras();}}
}
function actualizarFiltroCompras(input){
  comprasBusqueda=input.value;comprasPaginaActual=0;
  if(comprasTimer)clearTimeout(comprasTimer);
  const ticket=++comprasSecuencia;
  comprasError='';comprasCargando=true;comprasPagina=[];comprasTotal=0;refrescarListadoCompras();
  comprasTimer=setTimeout(()=>{comprasTimer=null;cargarComprasDesdeSupabase(0,ticket);},280);
}
function limpiarFiltroCompras(){const input=document.getElementById('comprasBusqueda');if(input)input.value='';actualizarFiltroCompras({value:''});}
function cambiarTamanoPaginaCompras(valor){comprasPorPagina=Math.max(10,Math.min(50,Number(valor)||20));cargarComprasDesdeSupabase(0);}
function irPaginaCompras(pagina){
  const max=Math.max(0,Math.ceil(comprasTotal/comprasPorPagina)-1);
  if(pagina<0||pagina>max||comprasCargando)return;
  cargarComprasDesdeSupabase(pagina);
}

async function agregarCompraRapida(){
  const nombre=compraRapida.nombre.trim();
  if(!nombre){showToast('Escribí el nombre de la prenda');return;}
  try{await consultarCatalogo(nombre,'',0,100);}catch(e){showToast(e.message||'No se pudo consultar el catálogo');return;}
  const cantidad=Math.max(1,parseInt(compraRapida.cantidad)||0),categoria=compraRapida.categoria||state.config.categorias[0]||'Otros';
  if(nombreAmbiguo(nombre,compraRapida.descripcion)){showToast('Hay varias prendas con ese nombre. Agregá una descripción para elegir la correcta');return;}
  let producto=buscarProductoPorNombre(nombre,compraRapida.descripcion);
  if(!producto){
    let num;try{num=await nuevoNumeroProducto();}catch(e){showToast('No se pudo obtener el número de prenda: '+(e.message||e));return;}
    producto={id:uid(),num,nombre,descripcion:compraRapida.descripcion.trim(),categoria,costo:Number(compraRapida.costo)||0,precio:Number(compraRapida.precio)||0,variantes:[]};state.productos.push(producto);
  }else{
    if(compraRapida.descripcion.trim())producto.descripcion=compraRapida.descripcion.trim();
    if(compraRapida.costo!=='')producto.costo=Number(compraRapida.costo)||0;
    if(compraRapida.precio!=='')cambiarPrecioProducto(producto,Number(compraRapida.precio)||0);
    producto.categoria=categoria;
  }
  marcarProductoSucio(producto);
  if(!state.config.categorias.some(c=>c.toLowerCase()===categoria.toLowerCase()))state.config.categorias.push(categoria);
  const talles=(compraRapida.talle.trim()||'Único').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
  const colores=(compraRapida.color.trim()||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean),coloresFinales=colores.length?colores:[''];
  talles.forEach(talle=>coloresFinales.forEach(color=>{
    const codigoGenerado=claveAutomatica(producto,talle,color);let variante=producto.variantes.find(v=>mismaTalleColor(v,talle,color));
    if(!variante){variante={id:uid(),talle,color,codigo:codigoGenerado,stock:0};producto.variantes.push(variante);}
    marcarVarianteSucia(producto,variante);
    const existente=compraLineas.find(l=>l.varianteId===variante.id);
    if(existente)existente.cantidad+=cantidad;
    else compraLineas.push({productoId:producto.id,varianteId:variante.id,nombre:producto.nombre,varianteLabel:[talle,color].filter(Boolean).join(' / ')||'Único',cantidad});
  }));
  compraRapida.talle='';compraRapida.color='';compraRapida.cantidad=1;
  showToast(talles.length*coloresFinales.length+' variante(s) agregada(s) a la compra');renderAll();
}
function quitarLineaCompra(indice){compraLineas.splice(indice,1);renderAll();}

async function registrarCompra(){
  if(session!=='admin'||compraGuardando)return;
  if(!nuevaCompra.descripcion.trim()){showToast('Escribí la descripción de la compra');return;}
  compraGuardando=true;renderAll();
  let compraCreada=null;
  try{
    await sincronizar();
    if(estadoSync==='error')throw new Error('Hay cambios de stock pendientes. Revisá la conexión y volvé a intentar.');
    const {data,error}=await sb.from('compras').insert({fecha:nuevaCompra.fecha||todayStr(),descripcion:nuevaCompra.descripcion.trim(),lugar:nuevaCompra.lugar.trim(),proveedor:nuevaCompra.proveedor.trim(),direccion:nuevaCompra.direccion.trim(),telefono:nuevaCompra.telefono.trim(),costo:Number(nuevaCompra.costo)||0,notas:nuevaCompra.notas.trim()}).select('*').single();
    if(error)throw error;
    compraCreada=data;
    if(compraLineas.length){
      const lineas=compraLineas.map((l,i)=>({id:data.id+'-l'+i,compra_id:data.id,producto_id:l.productoId||null,variante_id:l.varianteId||null,nombre:l.nombre||'',variante_label:l.varianteLabel||'',cantidad:Math.max(1,Math.floor(Number(l.cantidad)||1))}));
      const resultado=await sb.from('compra_lineas').insert(lineas);
      if(resultado.error){await sb.from('compras').delete().eq('id',data.id);compraCreada=null;throw resultado.error;}
    }
    compraLineas.forEach(l=>{
      const p=productoPorId(l.productoId),v=p&&p.variantes.find(x=>x.id===l.varianteId);
      if(v){v.stock+=l.cantidad;marcarProductoSucio(p);marcarVarianteSucia(p,v);registrarEtiquetasPendientes(v.id,l.cantidad);}
    });
    const descripcion=nuevaCompra.descripcion.trim(),costo=Number(nuevaCompra.costo)||0,unidades=compraLineas.reduce((n,l)=>n+l.cantidad,0);
    registrarMovimiento('Compra registrada',descripcion+' · '+money(costo)+(unidades?' · +'+unidades+' u. al stock':''));
    nuevaCompra={fecha:todayStr(),descripcion:'',lugar:'',proveedor:'',direccion:'',telefono:'',costo:'',notas:''};compraLineas=[];
    save();await sincronizar();
    if(estadoSync==='error')showToast('La compra quedó registrada, pero no se pudo confirmar la actualización del stock. Revisá la conexión antes de cargar otra vez.');
    else showToast(unidades?'Compra registrada y stock actualizado':'Compra registrada');
    if(currentTab==='compras')await cargarComprasDesdeSupabase(0);
  }catch(e){
    console.error(e);
    showToast(compraCreada?'La compra se guardó, pero hubo un problema al completar el registro: '+(e.message||e):'No se pudo registrar la compra: '+(e.message||e));
  }finally{compraGuardando=false;renderAll();}
}

async function eliminarCompra(id){
  const compra=comprasPagina.find(c=>c.id===id);if(!compra||session!=='admin')return;
  if(!confirm('¿Eliminar el registro de compra “'+compra.descripcion+'”?'))return;
  const lineas=compra.lineas||[];
  const restar=lineas.length&&confirm('Esta compra sumó '+lineas.reduce((n,l)=>n+(Number(l.cantidad)||0),0)+' unidades al stock. ¿También querés descontarlas?');
  try{
    const {error}=await sb.from('compras').delete().eq('id',id);if(error)throw error;
    if(restar){
      lineas.forEach(l=>{const p=productoPorId(l.productoId),v=p&&p.variantes.find(x=>x.id===l.varianteId);if(v){retirarEtiquetasPendientes(v.id,l.cantidad);v.stock=Math.max(0,v.stock-l.cantidad);marcarVarianteSucia(p,v);}});
      save();await sincronizar();
      if(estadoSync==='error')showToast('Se eliminó la compra, pero no se pudo guardar el ajuste de stock. Revisá la conexión.');
    }
    registrarMovimiento('Compra eliminada',compra.descripcion+' · '+money(compra.costo));save();
    comprasTotal=Math.max(0,comprasTotal-1);
    const ultima=Math.max(0,Math.ceil(comprasTotal/comprasPorPagina)-1);
    await cargarComprasDesdeSupabase(Math.min(comprasPaginaActual,ultima));
    if(estadoSync!=='error')showToast('Compra eliminada');
  }catch(e){console.error(e);showToast('No se pudo eliminar la compra: '+(e.message||e));}
}
