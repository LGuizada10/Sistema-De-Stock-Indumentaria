// [ZZ] modules/devoluciones.js — Pestaña DEVOLUCIONES y cambios.
function cantidadPendienteDeDevolver(venta, item){
  const itemIdx = venta.items.indexOf(item);
  const devuelta = state.devoluciones.filter(d=>d.ventaId===venta.id && (d.itemIdx!=null ? Number(d.itemIdx)===itemIdx : d.varianteId===item.varianteId)).reduce((total,d)=>total+Number(d.cantidad||0),0);
  return Math.max(0, Number(item.cantidad||0)-devuelta);
}
function esCambioDevolucion(devolucion){
  return devolucion.tipo==='cambio' || devolucion.reintegro==='Sin reintegro';
}
function productosRecibidosCambio(devolucion){
  if(Array.isArray(devolucion.productosNuevos) && devolucion.productosNuevos.length) return devolucion.productosNuevos;
  if(!devolucion.nombreNuevo) return [];
  return [{
    productoId:devolucion.productoNuevoId||null,
    varianteId:devolucion.varianteNuevaId||null,
    nombre:devolucion.nombreNuevo,
    varianteLabel:devolucion.varianteNuevaLabel||'',
    codigo:devolucion.codigoNuevo||'',
    cantidad:Number(devolucion.cantidad||1),
    precioUnit:Number(devolucion.montoNuevo||0)/Math.max(1,Number(devolucion.cantidad||1))
  }];
}
function descripcionProductosRecibidos(devolucion){
  return productosRecibidosCambio(devolucion).map(linea=>
    `${linea.nombre}${linea.varianteLabel?' ('+linea.varianteLabel+')':''} ×${linea.cantidad}`
  ).join(', ') || 'Cambio sin reintegro';
}
function ajusteEconomicoDevolucion(devolucion){
  return esCambioDevolucion(devolucion) ? Number(devolucion.montoDiferencia||0) : -Number(devolucion.montoDevuelto||0);
}
function aplicarAjusteDevolucionPorMetodo(porMetodo, devolucion){
  const ajuste = ajusteEconomicoDevolucion(devolucion);
  const metodo = esCambioDevolucion(devolucion) && ajuste>0 ? devolucion.metodoDiferencia : devolucion.reintegro;
  if(ajuste && porMetodo[metodo]!=null) porMetodo[metodo] += ajuste;
}

/* =================== DEVOLUCIONES =================== */
let devFecha = '';
let devVentaId = '';
let devItemIdx = '';
let devCantidad = 1;
let devMotivo = '';
let devReintegro = 'Efectivo';
let devTipo = 'devolucion';
let devCambioProdId = '';
let devCambioVarId = '';
let devCambioSearch = '';
let devCambioCantidad = 1;
let devCambioLineas = [];
let devMetodoDiferencia = 'Efectivo';
// modo manual (cuando la venta no está en el sistema)
let devManualProdId = '';
let devManualVarId = '';
let devManualSearch = '';
let devManualCategory = '';

function productosManualDevolucion(){
  const term = devManualSearch.trim().toLowerCase();
  const resultados = state.productos.filter(p=>{
    if(devManualCategory && p.categoria!==devManualCategory) return false;
    if(!term) return true;
    const nombre = (p.nombre||'').toLowerCase();
    const descripcion = (p.descripcion||'').toLowerCase();
    const categoria = (p.categoria||'').toLowerCase();
    const id = (p.id||'').toLowerCase();
    const claves = p.variantes.map(v=>(v.codigo||'').toLowerCase());
    const empiezaCon = nombre.startsWith(term) || descripcion.startsWith(term) || categoria.startsWith(term) || id.startsWith(term) || claves.some(c=>c.startsWith(term));
    const incluye = nombre.includes(term) || descripcion.includes(term) || categoria.includes(term) || id.includes(term) || claves.some(c=>c.includes(term));
    return empiezaCon || incluye;
  });

  if(!term) return resultados;
  return resultados.sort((a,b)=>{
    const aScore = scoreManualDevolucion(a, term);
    const bScore = scoreManualDevolucion(b, term);
    return bScore - aScore;
  });
}
function renderResultadosManualDevolucion(){
  const resultados = productosManualDevolucion();
  const term = devManualSearch.trim();
  if(!term){ return ''; }
  const coincidencias = [];
  resultados.forEach(p=>{
    p.variantes.forEach(v=>{
      const codigo = (v.codigo||'').toLowerCase();
      const nombre = (p.nombre||'').toLowerCase();
      const claveTerm = term.toLowerCase();
      const coincide = !claveTerm || nombre.includes(claveTerm) || codigo.includes(claveTerm) || (p.descripcion||'').toLowerCase().includes(claveTerm) || (p.categoria||'').toLowerCase().includes(claveTerm);
      if(coincide) coincidencias.push({p,v});
    });
  });
  if(!coincidencias.length){
    return `<div class="card" style="margin-top:10px;"><p class="empty">No hay prendas que coincidan con "${term}".</p></div>`;
  }
  return `
    <div class="card" style="margin-top:10px;">
      <div class="card-title">Productos encontrados: "${term}"</div>
      <div style="max-height:360px;overflow-y:auto;">
      <table><thead><tr><th>Prenda</th><th>Categoría</th><th>Clave</th><th>Talle / color</th><th>Stock</th></tr></thead>
      <tbody>${coincidencias.map(({p,v})=>`<tr>
        <td>${p.nombre}</td>
        <td>${p.categoria||'-'}</td>
        <td class="num">${v.codigo||'-'}</td>
        <td>${[v.talle,v.color].filter(Boolean).join(' / ')||'Único'}</td>
        <td class="num">${v.stock}</td>
      </tr>`).join('')}</tbody></table>
      </div>
    </div>`;
}
function scoreManualDevolucion(producto, term){
  const nombre = (producto.nombre||'').toLowerCase();
  const descripcion = (producto.descripcion||'').toLowerCase();
  const categoria = (producto.categoria||'').toLowerCase();
  const id = (producto.id||'').toLowerCase();
  const claves = producto.variantes.map(v=>(v.codigo||'').toLowerCase());
  let score = 0;
  if(nombre.startsWith(term)) score += 100;
  if(descripcion.startsWith(term)) score += 80;
  if(categoria.startsWith(term)) score += 70;
  if(id.startsWith(term)) score += 90;
  if(claves.some(c=>c.startsWith(term))) score += 95;
  if(nombre.includes(term)) score += 20;
  if(descripcion.includes(term)) score += 15;
  if(categoria.includes(term)) score += 10;
  if(id.includes(term)) score += 18;
  if(claves.some(c=>c.includes(term))) score += 16;
  return score;
}
function buscarManualConEnter(event){
  if(event.key !== 'Enter') return;
  event.preventDefault();
  const input = event.target;
  const valor = (input && input.value !== undefined ? input.value : devManualSearch).trim();
  devManualSearch = valor;

  const coincidencias = state.productos.filter(p=>{
    if(devManualCategory && p.categoria!==devManualCategory) return false;
    if(!valor) return true;
    return scoreManualDevolucion(p, valor.toLowerCase()) > 0;
  }).sort((a,b)=>scoreManualDevolucion(b, valor.toLowerCase()) - scoreManualDevolucion(a, valor.toLowerCase()));

  if(coincidencias.length){
    devManualProdId = coincidencias[0].id;
    devManualVarId = coincidencias[0].variantes[0]?.id || '';
  }else{
    devManualProdId = '';
    devManualVarId = '';
  }

  const select = document.getElementById('devManualProductSelect');
  if(select){
    select.innerHTML = '<option value="">Elegí un producto</option>' + coincidencias.map(p=>`<option value="${p.id}" ${devManualProdId===p.id?'selected':''}>${p.nombre}${p.descripcion?(' — '+p.descripcion):''}</option>`).join('');
    select.value = devManualProdId || '';
  }

  renderAll();
}
function actualizarBusquedaDevolucionManual(tipo,input){
  if(tipo==='texto') devManualSearch=input.value;
  if(tipo==='categoria') devManualCategory=input.value;
  const select=document.getElementById('devManualProductSelect');
  if(!select) return;
  select.innerHTML='<option value="">Elegí un producto</option>'+productosManualDevolucion().map(p=>`<option value="${p.id}">${p.nombre}${p.descripcion?(' — '+p.descripcion):''}</option>`).join('');
  select.value=devManualProdId;
}

function renderDevoluciones(){
  const ventasPendientes = state.ventas.filter(v=>(!devFecha || v.fecha===devFecha) && v.items.some(i=>cantidadPendienteDeDevolver(v,i)>0)).slice().reverse();
  const ventaSel = ventasPendientes.find(v=>v.id===devVentaId);
  const itemSel = ventaSel && ventaSel.items[devItemIdx] && cantidadPendienteDeDevolver(ventaSel,ventaSel.items[devItemIdx])>0 ? ventaSel.items[devItemIdx] : null;
  const historial = state.devoluciones.slice().reverse();

  const manualProd = state.productos.find(p=>p.id===devManualProdId);
  const productosManual = productosManualDevolucion().slice(0, MAX_SEARCH_ITEMS);
  const manualVarSeleccionada = manualProd && manualProd.variantes.some(v=>v.id===devManualVarId)
    ? devManualVarId
    : (manualProd && manualProd.variantes.length ? manualProd.variantes[0].id : '');

  return `
  <h2 class="section-title">Devoluciones</h2>
  <p class="section-note">Se muestran ventas de cualquier fecha con prendas pendientes de devolución. El reintegro o la diferencia se registra en el turno que está abierto ahora.</p>

  <div class="card">
    <div class="card-title">Buscar la venta</div>
    <div class="row">
      <div class="field" style="max-width:210px;"><label>Fecha de compra</label><input type="date" title="Opcional: dejalo vacío para buscar en todas las fechas" value="${devFecha}" onchange="devFecha=this.value; devVentaId=''; devItemIdx=''; renderAll(); asegurarHistorialDesde(this.value);"></div>
      <div class="field" style="flex:2 1 240px;">
        <label>Venta pendiente (${ventasPendientes.length})</label>
        <select onchange="devVentaId=this.value; devItemIdx=''; renderAll();">
          <option value="">Elegí una venta de cualquier fecha</option>
          ${ventasPendientes.map(v=>{
            const pendientes=v.items.filter(i=>cantidadPendienteDeDevolver(v,i)>0).map(i=>cantidadPendienteDeDevolver(v,i)+'x '+i.nombre+(i.varianteLabel?' ('+i.varianteLabel+')':'' )).join(', ');
            return `<option value="${v.id}" ${devVentaId===v.id?'selected':''}>${fmtDate(v.fecha)} · ${v.hora} · ${pendientes} · ${money(v.total)}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="field" style="flex:2 1 200px;">
        <label>Producto de esa venta</label>
        <select onchange="devItemIdx=this.value; renderAll();" ${!ventaSel?'disabled':''}>
          <option value="">Elegí un producto</option>
          ${ventaSel ? ventaSel.items.map((i,idx)=>({i,idx,pendiente:cantidadPendienteDeDevolver(ventaSel,i)})).filter(x=>x.pendiente>0).map(({i,idx,pendiente})=>`<option value="${idx}" ${String(devItemIdx)===String(idx)?'selected':''}>${pendiente} disponible(s) · ${i.nombre}${i.varianteLabel?(' ('+i.varianteLabel+')'):''}</option>`).join('') : ''}
        </select>
      </div>
    </div>
    ${itemSel ? renderFormDevolucion({
        origen:'venta', ventaId: ventaSel.id, productoId:itemSel.productoId, varianteId:itemSel.varianteId,
          nombre:itemSel.nombre, varianteLabel:itemSel.varianteLabel, codigo:itemSel.codigo||'', precioUnit:itemSel.precioUnit, maxCantidad:cantidadPendienteDeDevolver(ventaSel,itemSel)
      }) : ''}
  </div>

  <div class="card">
    <div class="card-title">¿La venta no está en el sistema? Devolución manual</div>
    <p class="section-note" style="margin-top:-4px;">Elegí directamente el producto y la variante a devolver.</p>
    <div class="row">
      <div class="field" style="flex:2 1 220px;"><label>Buscar por nombre o clave</label><input type="text" data-dev-manual-search placeholder="Ej: REM-SAK-BLA-02" value="${devManualSearch}" oninput="actualizarBusquedaDevolucionManual('texto', this)" onkeydown="buscarManualConEnter(event)"></div>
      <div class="field"><label>Filtrar por categoría</label><select onchange="devManualCategory=this.value; devManualProdId=''; devManualVarId=''; renderAll();"><option value="">Todas</option>${state.config.categorias.map(c=>`<option value="${c}" ${devManualCategory===c?'selected':''}>${c}</option>`).join('')}</select></div>
      ${renderResultadosManualDevolucion()}
      <div class="field" style="flex:2 1 200px;">
        <label>Producto</label>
        <select id="devManualProductSelect" onchange="devManualProdId=this.value; devManualVarId=''; renderAll();">
          <option value="">Elegí un producto</option>
          ${productosManual.map(p=>`<option value="${p.id}" ${devManualProdId===p.id?'selected':''}>${p.nombre}${p.descripcion?(' — '+p.descripcion):''}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="flex:1 1 160px;">
        <label>Variante</label>
        <select onchange="devManualVarId=this.value; renderAll();" ${!manualProd?'disabled':''}>
          <option value="">Elegí variante</option>
          ${manualProd ? manualProd.variantes.map(v=>`<option value="${v.id}" ${manualVarSeleccionada===v.id?'selected':''}>${v.talle} ${v.color}</option>`).join('') : ''}
        </select>
      </div>
    </div>
    ${(manualProd && manualProd.variantes.find(v=>v.id===manualVarSeleccionada)) ? (()=>{
        const v = manualProd.variantes.find(v=>v.id===manualVarSeleccionada);
        return renderFormDevolucion({
          origen:'manual', ventaId:null, productoId:manualProd.id, varianteId:v.id,
          nombre:manualProd.nombre, varianteLabel:[v.talle,v.color].filter(x=>x&&x!=='-').join(' / ')||'Único',
          codigo:v.codigo||'', precioUnit:manualProd.precio, maxCantidad:9999
        });
      })() : ''}
  </div>

  <div class="card">
    <div class="card-title">Historial de devoluciones</div>
    ${historial.length===0 ? '<p class="empty">Todavía no registraste devoluciones.</p>' : `
    <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto devuelto</th><th>Producto recibido</th><th>Cant.</th><th>Importe</th><th></th></tr></thead>
    <tbody>${historial.map(d=>{
      const esCambio = esCambioDevolucion(d);
      const diferencia = Number(d.montoDiferencia || 0);
      const importe = esCambio ? diferencia : Number(d.montoDevuelto || 0);
      const color = esCambio ? (importe > 0 ? 'var(--green)' : importe < 0 ? 'var(--brick)' : 'var(--muted)') : 'var(--brick)';
      const texto = esCambio
        ? (importe === 0 ? '0' : `${importe > 0 ? '+' : '-'}${money(Math.abs(importe))}`)
        : `-${money(importe)}`;
      return `<tr>
        <td>${fmtDate(d.fecha)} ${d.hora}</td>
        <td>${esCambio?'Cambio':'Devolución'}</td>
        <td>${d.nombre}${d.varianteLabel?(' ('+d.varianteLabel+')'):''}${d.motivo?'<br><span class="muted">'+d.motivo+'</span>':''}</td>
        <td>${esCambio ? descripcionProductosRecibidos(d) : 'Reintegro '+d.reintegro}</td>
        <td class="num">${d.cantidad}</td>
        <td class="num" style="color:${color};">${texto}</td>
        <td>${session==='admin' ? `<button class="link-btn" onclick="eliminarDevolucion('${d.id}')">eliminar</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`}
  </div>
  `;
}

function renderFormDevolucion(ctx){
  window._devCtx = ctx; // guardamos el contexto actual para confirmarDevolucion()
  const productoNuevo = state.productos.find(p=>p.id===devCambioProdId);
  const varianteNueva = productoNuevo && productoNuevo.variantes.find(v=>v.id===devCambioVarId);
  const precioViejo = ctx.precioUnit*devCantidad;
  const precioNuevo = devCambioLineas.reduce((total,linea)=>total+Number(linea.precioUnit||0)*Number(linea.cantidad||0),0);
  const diferencia = precioNuevo-precioViejo;
  return `
  <hr class="stitch">
  <div class="field" style="max-width:260px;">
    <label>Qué necesita el cliente</label>
    <select onchange="devTipo=this.value; devCambioProdId=''; devCambioVarId=''; devCambioSearch=''; devCambioCantidad=1; devCambioLineas=[]; renderAll();">
      <option value="devolucion" ${devTipo==='devolucion'?'selected':''}>Devolución con reintegro</option>
      <option value="cambio" ${devTipo==='cambio'?'selected':''}>Cambio por otro producto o talle</option>
    </select>
  </div>
  <div class="row">
    <div class="field" style="max-width:100px;">
      <label>Cantidad</label>
      <input type="number" min="1" max="${ctx.maxCantidad}" value="${devCantidad}" onchange="devCantidad=Math.max(1,parseInt(this.value)||1); renderAll();">
    </div>
    <div class="field" style="flex:2 1 200px;">
      <label>Motivo (opcional)</label>
      <input type="text" placeholder="Ej: talle equivocado, defecto de fábrica..." value="${devMotivo}" oninput="devMotivo=this.value">
    </div>
    <div class="field" style="max-width:200px;">
      <label>Medio para devolver el dinero</label>
      <select onchange="devReintegro=this.value" ${devTipo==='cambio'?'disabled':''}>
        ${['Efectivo','Mercado Pago','Débito','Crédito'].map(m=>`<option ${devReintegro===m?'selected':''}>${m}</option>`).join('')}
      </select>
    </div>
  </div>
  ${devTipo==='cambio' ? `
  <div class="row">
    <div class="field" style="flex:3 1 320px;">
      <label>Buscar prenda por clave o nombre</label>
      <input type="text" data-dev-cambio-search placeholder="Ej: REM- o nombre de la prenda" value="${escaparHTML(devCambioSearch)}" oninput="actualizarBusquedaCambio(this)" onkeydown="buscarCambioConEnter(event)">
      <div id="devCambioSearchResults">${renderResultadosCambio()}</div>
      ${productoNuevo&&varianteNueva?`<div class="exchange-selected"><span><strong>${escaparHTML(productoNuevo.nombre)}</strong><span class="exchange-result-meta">${escaparHTML([varianteNueva.talle,varianteNueva.color].filter(Boolean).join(' / ')||'Único')} · ${escaparHTML(varianteNueva.codigo||'Sin clave')} · ${money(productoNuevo.precio)} · stock ${varianteNueva.stock}</span></span><button class="btn small ghost" onclick="limpiarSeleccionCambio()">Cambiar</button></div>`:''}
    </div>
    <div class="field" style="max-width:110px;">
      <label>Cantidad</label>
      <input type="number" min="1" max="${varianteNueva?.stock||1}" value="${devCambioCantidad}" oninput="devCambioCantidad=Math.max(1,parseInt(this.value)||1)">
    </div>
    <div class="field" style="flex:0 0 auto;justify-content:flex-end;">
      <button class="btn small" onclick="agregarPrendaCambio()" ${!varianteNueva?'disabled':''}>Agregar prenda</button>
    </div>
  </div>
  ${devCambioLineas.length ? `<div class="card" style="margin-top:0;">
    <div class="card-title">Prendas agregadas al cambio</div>
    <table><thead><tr><th>Producto</th><th>Variante</th><th>Cant.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${devCambioLineas.map((linea,index)=>`<tr><td>${linea.nombre}</td><td>${linea.varianteLabel}</td><td class="num">${linea.cantidad}</td><td class="num">${money(linea.precioUnit*linea.cantidad)}</td><td><button class="link-btn" onclick="quitarPrendaCambio(${index})">quitar</button></td></tr>`).join('')}</tbody>
    </table>
  </div>` : '<p class="section-note">Agregá una o más prendas. Se comparará el valor total con la prenda devuelta.</p>'}
  ${devCambioLineas.length ? `<p class="section-note"><b>Valor de la prenda devuelta:</b> ${money(precioViejo)} · <b>Valor total del cambio:</b> ${money(precioNuevo)}<br><b>${diferencia>0?'El cliente te paga':diferencia<0?'Le devolvés al cliente':'Sin diferencia'}: ${money(Math.abs(diferencia))}</b></p>
    ${diferencia!==0 ? `<div class="field" style="max-width:250px;"><label>${diferencia>0?'Medio de cobro de la diferencia':'Medio de reintegro de la diferencia'}</label><select onchange="devMetodoDiferencia=this.value">${['Efectivo','Mercado Pago','Débito','Crédito'].map(m=>`<option ${devMetodoDiferencia===m?'selected':''}>${m}</option>`).join('')}</select></div>` : ''}` : ''}
  ` : `<p class="section-note">Se devuelve ${money(precioViejo)} por ${devCantidad} unidad(es) y se repone esa cantidad al stock.</p>`}
  <button class="btn primary" onclick="confirmarDevolucion()">Registrar devolución</button>
  `;
}

function resultadosBusquedaCambio(){
  const termino=normalizarClave(devCambioSearch);
  if(!termino)return [];
  return state.productos.flatMap(producto=>producto.variantes
    .filter(variante=>Number(variante.stock)>0)
    .map(variante=>({producto,variante}))
    .map(item=>{
      const codigo=normalizarClave(item.variante.codigo||'');
      const nombre=normalizarClave(item.producto.nombre||'');
      const descripcion=normalizarClave(item.producto.descripcion||'');
      const categoria=normalizarClave(item.producto.categoria||'');
      const coincide=codigo.includes(termino)||nombre.includes(termino)||descripcion.includes(termino)||categoria.includes(termino);
      const prioridad=codigo.startsWith(termino)?100:nombre.startsWith(termino)?80:codigo.includes(termino)?50:nombre.includes(termino)?30:10;
      return {...item,coincide,prioridad};
    })
    .filter(item=>item.coincide)
  ).sort((a,b)=>b.prioridad-a.prioridad||a.producto.nombre.localeCompare(b.producto.nombre,'es')).slice(0,MAX_SEARCH_ITEMS);
}
function renderResultadosCambio(){
  if(!devCambioSearch.trim())return '';
  const coincidencias=resultadosBusquedaCambio();
  if(!coincidencias.length)return '<div class="exchange-empty">No hay prendas con stock que coincidan con la búsqueda.</div>';
  return `<div class="exchange-results" role="listbox" aria-label="Resultados de prendas para cambio">${coincidencias.map(({producto,variante})=>
    `<button type="button" class="exchange-result" role="option" onclick="seleccionarPrendaCambio('${escaparHTML(producto.id)}','${escaparHTML(variante.id)}')"><span><span class="exchange-result-name">${escaparHTML(producto.nombre)}</span><span class="exchange-result-meta">${escaparHTML([variante.talle,variante.color].filter(Boolean).join(' / ')||'Único')} · stock ${variante.stock} · ${money(producto.precio)}</span></span><span class="exchange-result-code">${escaparHTML(variante.codigo||'Sin clave')}</span></button>`
  ).join('')}</div>`;
}
function actualizarBusquedaCambio(input){
  devCambioSearch=input.value;
  const resultados=document.getElementById('devCambioSearchResults');
  if(resultados)resultados.innerHTML=renderResultadosCambio();
}
function buscarCambioConEnter(event){
  if(event.key!=='Enter')return;
  event.preventDefault();
  const termino=normalizarClave(devCambioSearch);
  const coincidencias=resultadosBusquedaCambio();
  const exactas=coincidencias.filter(({variante})=>normalizarClave(variante.codigo||'')===termino && variante.stock>0);
  if(exactas.length===1)seleccionarPrendaCambio(exactas[0].producto.id,exactas[0].variante.id);
}
function seleccionarPrendaCambio(productoId,varianteId){
  const producto=state.productos.find(p=>p.id===productoId);
  const variante=producto&&producto.variantes.find(v=>v.id===varianteId&&v.stock>0);
  if(!producto||!variante)return;
  devCambioProdId=producto.id;
  devCambioVarId=variante.id;
  devCambioSearch='';
  renderAll();
}
function limpiarSeleccionCambio(){
  devCambioProdId='';
  devCambioVarId='';
  renderAll();
}

function agregarPrendaCambio(){
  const producto=state.productos.find(p=>p.id===devCambioProdId);
  const variante=producto&&producto.variantes.find(v=>v.id===devCambioVarId);
  if(!producto||!variante){showToast('Elegí el producto y la variante');return;}
  const cantidad=Math.max(1,parseInt(devCambioCantidad)||1);
  const yaAgregada=devCambioLineas.filter(linea=>linea.varianteId===variante.id).reduce((total,linea)=>total+linea.cantidad,0);
  if(yaAgregada+cantidad>variante.stock){showToast('No hay stock suficiente para esa cantidad');return;}
  devCambioLineas.push({
    productoId:producto.id,varianteId:variante.id,nombre:producto.nombre,
    varianteLabel:[variante.talle,variante.color].filter(Boolean).join(' / ')||'Único',
    codigo:variante.codigo||'',cantidad,precioUnit:Number(producto.precio||0)
  });
  devCambioProdId='';devCambioVarId='';devCambioSearch='';devCambioCantidad=1;
  renderAll();
}
function quitarPrendaCambio(index){devCambioLineas.splice(index,1);renderAll();}

function confirmarDevolucion(){
  const ctx = window._devCtx;
  if(!ctx) return;
  const p = state.productos.find(p=>p.id===ctx.productoId);
  const v = p ? p.variantes.find(v=>v.id===ctx.varianteId) : null;
  if(!v){ showToast('No se encontró esa variante en el stock actual'); return; }
  const cantidad = Math.max(1, Math.min(devCantidad, ctx.maxCantidad));
  const montoDevuelto = ctx.precioUnit * cantidad;
  let lineasNuevas = [];
  let montoNuevo = 0;
  let diferencia = -montoDevuelto;
  if(devTipo==='cambio'){
    if(!devCambioLineas.length){showToast('Agregá al menos una prenda para el cambio');return;}
    lineasNuevas=devCambioLineas.map(linea=>({...linea}));
    const cantidadesPorVariante=new Map();
    lineasNuevas.forEach(linea=>{
      const clave=linea.productoId+'|'+linea.varianteId;
      cantidadesPorVariante.set(clave,(cantidadesPorVariante.get(clave)||0)+linea.cantidad);
    });
    for(const [clave,cantidadSolicitada] of cantidadesPorVariante){
      const [productoId,varianteId]=clave.split('|');
      const producto=state.productos.find(p=>p.id===productoId);
      const variante=producto&&producto.variantes.find(v=>v.id===varianteId);
      if(!variante||variante.stock<cantidadSolicitada){showToast('No hay stock suficiente para completar el cambio');return;}
    }
    montoNuevo=lineasNuevas.reduce((total,linea)=>total+Number(linea.precioUnit||0)*linea.cantidad,0);
    diferencia = montoNuevo-montoDevuelto;
    lineasNuevas.forEach(linea=>{
      const producto=state.productos.find(p=>p.id===linea.productoId);
      const variante=producto.variantes.find(v=>v.id===linea.varianteId);
      linea.etiquetasPendientesRestadas=retirarEtiquetasPendientes(variante.id,linea.cantidad);
      variante.stock-=linea.cantidad;
    });
  }
  v.stock += cantidad;

  const t = turnoAbierto();
  const primeraLinea=lineasNuevas[0];
  const productoNuevo=primeraLinea&&state.productos.find(p=>p.id===primeraLinea.productoId);
  const reintegro = devTipo==='devolucion' ? devReintegro : (diferencia<0 ? devMetodoDiferencia : 'Sin reintegro');
  const metodoDiferencia = diferencia>0 ? devMetodoDiferencia : '';
  if(t && ((devTipo==='devolucion' && devReintegro==='Efectivo') || (devTipo==='cambio' && diferencia<0 && devMetodoDiferencia==='Efectivo'))){
    const salida = devTipo==='devolucion' ? montoDevuelto : Math.abs(diferencia);
    t.gastos = t.gastos || [];
    t.gastos.push({desc:(devTipo==='cambio'?'Diferencia de cambio':'Devolución')+': '+ctx.nombre, monto:salida, hora:timeStr()});
  }
  if(t && devTipo==='cambio' && diferencia>0 && devMetodoDiferencia==='Efectivo'){
    t.ingresosCambio = t.ingresosCambio || [];
    t.ingresosCambio.push({desc:'Diferencia de cambio: '+productoNuevo.nombre, monto:diferencia, hora:timeStr()});
  }

  state.devoluciones.push({
    id: uid(), fecha: todayStr(), hora: timeStr(),
    ventaId: ctx.ventaId, productoId: ctx.productoId, varianteId: ctx.varianteId,
    ventaFecha: ctx.ventaId ? (state.ventas.find(venta=>venta.id===ctx.ventaId)?.fecha||'') : '',
    itemIdx: ctx.ventaId ? Number(devItemIdx) : null, nombre: ctx.nombre, varianteLabel: ctx.varianteLabel, codigo:ctx.codigo||'',
    cantidad, montoDevuelto, tipo:devTipo, montoNuevo,
    productosNuevos:lineasNuevas,
    productoNuevoId:primeraLinea?.productoId||null, varianteNuevaId:primeraLinea?.varianteId||null,
    nombreNuevo:productoNuevo?.nombre||'', varianteNuevaLabel:primeraLinea?.varianteLabel||'',
    codigoNuevo:primeraLinea?.codigo||'', montoDiferencia:diferencia,
    motivo: devMotivo.trim(), reintegro, metodoDiferencia,
    turnoId: t ? t.id : null
  });
  save();
  registrarMovimiento(devTipo==='cambio'?'Cambio':'Devolución', ctx.nombre+' ×'+cantidad+' · '+money(montoDevuelto)+(devTipo==='cambio' ? ' · diferencia '+money(diferencia) : ' · reintegro '+reintegro), {guardar:true});
  showToast(devTipo==='cambio' ? 'Cambio registrado' : 'Devolución y reintegro registrados');
  devVentaId=''; devItemIdx=''; devCantidad=1; devMotivo=''; devReintegro='Efectivo';
  devTipo='devolucion'; devCambioProdId=''; devCambioVarId=''; devCambioSearch=''; devCambioCantidad=1; devCambioLineas=[]; devMetodoDiferencia='Efectivo';
  devManualProdId=''; devManualVarId='';
  renderAll();
}

function eliminarDevolucion(id){
  if(session!=='admin') return;
  const d = state.devoluciones.find(d=>d.id===id);
  if(!d) return;
  if(!confirm('¿Eliminar esta devolución del historial?')) return;
  const esCambio=esCambioDevolucion(d);
  const preguntaStock=esCambio
    ? '¿También revertir el stock del cambio? Se restará la prenda devuelta y se repondrán las prendas entregadas.'
    : '¿También revertir el stock que había sumado esta devolución (restar '+d.cantidad+' unidad/es)?';
  if(confirm(preguntaStock)){
    const p = state.productos.find(p=>p.id===d.productoId);
    const v = p ? p.variantes.find(v=>v.id===d.varianteId) : null;
    if(v) v.stock = Math.max(0, v.stock - d.cantidad);
    if(esCambio){
      productosRecibidosCambio(d).forEach(linea=>{
        const producto=state.productos.find(p=>p.id===linea.productoId);
        const variante=producto&&producto.variantes.find(v=>v.id===linea.varianteId);
        if(variante){
          variante.stock+=Number(linea.cantidad||0);
          registrarEtiquetasPendientes(variante.id,linea.etiquetasPendientesRestadas||0);
        }
      });
    }
  }
  registrarMovimiento('Devolución eliminada', d.nombre+' ×'+d.cantidad+' · '+money(d.montoDevuelto)+' (del '+fmtDate(d.fecha)+')');
  state.devoluciones = state.devoluciones.filter(x=>x.id!==id);
  save();
  showToast('Devolución eliminada');
  renderAll();
}
