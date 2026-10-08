// [ZZ] modules/compras.js — Pestaña COMPRAS (admin).
/* =================== COMPRAS (solo admin) =================== */
let nuevaCompra = {fecha: todayStr(), descripcion:'', lugar:'', proveedor:'', direccion:'', telefono:'', costo:'', notas:''};
let compraLineaProd = '';
let compraLineaVar = '';
let compraLineaCant = 1;
let compraLineas = []; // [{productoId, varianteId, nombre, varianteLabel, cantidad}]
let compraRapida = {nombre:'', categoria:'', descripcion:'', talle:'', color:'', codigo:'', costo:'', precio:'', cantidad:1};
let comprasLugarFiltro = '';

function renderCompras(){
  const prodLinea = state.productos.find(p=>p.id===compraLineaProd);
  const compras = state.compras.slice().reverse();
  const comprasFiltradas = comprasLugarFiltro.trim() ? compras.filter(c=>[c.lugar,c.proveedor,c.direccion,c.telefono].join(' ').toLowerCase().includes(comprasLugarFiltro.trim().toLowerCase())) : compras;
  return `
  <h2 class="section-title">Compras</h2>
  <p class="section-note">Registrá todo lo que comprás para revender. Al confirmar, cada línea suma automáticamente su cantidad al stock de esa variante.</p>

  <div class="card">
    <div class="card-title">Nueva compra</div>
    <div class="row">
      <div class="field" style="max-width:150px;"><label>Fecha</label><input type="date" value="${nuevaCompra.fecha}" onchange="nuevaCompra.fecha=this.value"></div>
      <div class="field" style="flex:2 1 220px;"><label>Qué compraste</label><input type="text" placeholder="Ej: Remeras blancas angelito" value="${nuevaCompra.descripcion}" oninput="nuevaCompra.descripcion=this.value"></div>
      <div class="field" style="flex:1 1 170px;"><label>Lugar</label><input type="text" placeholder="Las Flores" value="${nuevaCompra.lugar}" oninput="nuevaCompra.lugar=this.value"></div>
      <div class="field" style="flex:1 1 170px;"><label>Proveedor / local</label><input type="text" placeholder="Local 321" value="${nuevaCompra.proveedor}" oninput="nuevaCompra.proveedor=this.value"></div>
      <div class="field" style="flex:2 1 220px;"><label>Dirección</label><input type="text" placeholder="Av. Rivadavia 1231" value="${nuevaCompra.direccion}" oninput="nuevaCompra.direccion=this.value"></div>
      <div class="field" style="flex:1 1 150px;"><label>Teléfono</label><input type="tel" placeholder="11 5555 5555" value="${nuevaCompra.telefono}" oninput="nuevaCompra.telefono=this.value"></div>
      <div class="field" style="max-width:130px;"><label>Costo total</label><input type="number" min="0" placeholder="0" value="${nuevaCompra.costo}" oninput="nuevaCompra.costo=this.value"></div>
    </div>
    <div class="field"><label>Notas (opcional)</label><textarea rows="2" placeholder="Detalles extra..." oninput="nuevaCompra.notas=this.value">${nuevaCompra.notas}</textarea></div>

    <hr class="stitch">
    <div class="card-title">Carga rápida de prendas</div>
    <p class="section-note">Completá una variante por vez. Si la prenda o la variante no existen, se crean automáticamente. Repetí la operación para cada talle y color.</p>
    <div class="row">
      <div class="field" style="flex:2 1 220px;"><label>Prenda</label><input type="text" placeholder="Ej: Remera lisa bordado Corteiz" value="${compraRapida.nombre}" oninput="compraRapida.nombre=this.value"></div>
      <div class="field"><label>Categoría</label><select onchange="compraRapida.categoria=this.value"><option value="">Elegí categoría</option>${state.config.categorias.map(c=>`<option value="${c}" ${compraRapida.categoria===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Talle</label><input type="text" placeholder="1, 2, 3" value="${compraRapida.talle}" oninput="compraRapida.talle=this.value"></div>
      <div class="field"><label>Color</label><input type="text" placeholder="Negro / Blanco" value="${compraRapida.color}" oninput="compraRapida.color=this.value"></div>
      <div class="field" style="max-width:100px;"><label>Cantidad</label><input type="number" min="1" value="${compraRapida.cantidad}" oninput="compraRapida.cantidad=this.value"></div>
    </div>
    <div class="row">
      <div class="field" style="flex:2 1 220px;"><label>Descripción / diseño (opcional)</label><input type="text" placeholder="Ej: bordado Corteiz" value="${compraRapida.descripcion}" oninput="compraRapida.descripcion=this.value"></div>
      <div class="field"><label>Costo unitario</label><input type="number" min="0" placeholder="0" value="${compraRapida.costo}" oninput="compraRapida.costo=this.value"></div>
      <div class="field"><label>Precio de venta</label><input type="number" min="0" placeholder="0" value="${compraRapida.precio}" oninput="compraRapida.precio=this.value"></div>
      <div class="field" style="flex:0 0 auto;justify-content:flex-end;"><button class="btn small primary" onclick="agregarCompraRapida()">Agregar variante</button></div>
    </div>

    ${compraLineas.length ? `
    <table><thead><tr><th>Producto</th><th>Variante</th><th>Cantidad</th><th></th></tr></thead>
    <tbody>${compraLineas.map((l,idx)=>`<tr><td>${l.nombre}</td><td>${l.varianteLabel}</td><td class="num">${l.cantidad}</td><td><button class="link-btn" onclick="quitarLineaCompra(${idx})">quitar</button></td></tr>`).join('')}</tbody></table>
    ` : '<p class="empty">Todavía no agregaste ninguna línea (esto es opcional si solo querés dejar la nota, sin sumar stock).</p>'}

    <button class="btn primary" style="margin-top:10px;" onclick="registrarCompra()">Registrar compra</button>
  </div>

  <div class="card">
    <div class="card-title">Historial de compras</div>
    <div class="field" style="max-width:420px;">
      <label>Buscar compras por lugar o proveedor</label>
      <input type="text" data-compras-lugar placeholder="Ej: Las Flores o Av. Rivadavia" value="${comprasLugarFiltro}" oninput="actualizarFiltroCompras(this)">
    </div>
    ${compras.length===0 ? '<p class="empty">Todavía no registraste compras.</p>' : comprasFiltradas.length===0 ? '<p class="empty">No hay compras registradas en ese lugar.</p>' : comprasFiltradas.map(c=>{
      const lineas = c.lineas && c.lineas.length ? c.lineas : (c.productoId ? [{nombre:'', varianteLabel:'', cantidad:c.cantidad}] : []);
      return `
      <div style="padding:8px 0;border-bottom:1px dashed var(--line-soft);font-size:13.5px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <b>${fmtDate(c.fecha)} · ${c.descripcion}</b>
          <span style="display:flex;align-items:center;gap:10px;">
            <span class="num">${money(c.costo)}</span>
            <button class="link-btn" onclick="eliminarCompra('${c.id}')">eliminar</button>
          </span>
        </div>
        <div class="muted">${[c.lugar,c.proveedor,c.direccion,c.telefono].filter(Boolean).join(' · ')||'-'}${c.notas?(' · '+c.notas):''}</div>
        ${lineas.length ? `<div class="muted" style="margin-top:2px;">${lineas.map(l=>l.cantidad+'x '+(l.nombre||'')+(l.varianteLabel?(' ('+l.varianteLabel+')'):'')).join(', ')}</div>` : ''}
      </div>`;
    }).join('')}
  </div>
  `;
}

function agregarLineaCompra(){
  const p = state.productos.find(p=>p.id===compraLineaProd);
  if(!p) return;
  const v = p.variantes.find(v=>v.id===compraLineaVar);
  if(!v) return;
  compraLineas.push({
    productoId:p.id, varianteId:v.id, nombre:p.nombre,
    varianteLabel:[v.talle,v.color].filter(x=>x&&x!=='-').join(' / ')||'Único',
    cantidad: Math.max(1, compraLineaCant||1)
  });
  compraLineaVar=''; compraLineaCant=1;
  renderAll();
}
async function agregarCompraRapida(){
  const nombre = compraRapida.nombre.trim();
  if(!nombre){ showToast('Escribí el nombre de la prenda'); return; }
  const cantidad = Math.max(1, parseInt(compraRapida.cantidad)||0);
  const categoria = compraRapida.categoria || state.config.categorias[0] || 'Otros';
  if(nombreAmbiguo(nombre, compraRapida.descripcion)){ showToast('Hay varias "'+nombre+'". Escribí la descripción para saber a cuál sumar'); return; }
  let producto = buscarProductoPorNombre(nombre, compraRapida.descripcion);
  if(!producto){
    let num; try{ num = await nuevoNumeroProducto(); }catch(e){ showToast('No se pudo obtener el número de prenda: '+(e.message||e)); return; }
    producto = {id:uid(), num, nombre, descripcion:compraRapida.descripcion.trim(), categoria, costo:Number(compraRapida.costo)||0, precio:Number(compraRapida.precio)||0, variantes:[]};
    state.productos.push(producto);
  }else{
    if(compraRapida.descripcion.trim()) producto.descripcion = compraRapida.descripcion.trim();
    if(compraRapida.costo!=='') producto.costo = Number(compraRapida.costo)||0;
    if(compraRapida.precio!=='') cambiarPrecioProducto(producto, Number(compraRapida.precio)||0);
    producto.categoria = categoria;
  }
  if(!state.config.categorias.some(c=>c.toLowerCase()===categoria.toLowerCase())) state.config.categorias.push(categoria);
  const talles = (compraRapida.talle.trim() || 'Único').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
  const colores = (compraRapida.color.trim() || '').split(/[,;]+/).map(x=>x.trim()).filter(Boolean);
  const coloresFinales = colores.length ? colores : [''];
  talles.forEach(talle=>coloresFinales.forEach(color=>{
    const codigoGenerado = claveAutomatica(producto, talle, color);
    let variante = producto.variantes.find(v=>mismaTalleColor(v,talle,color));
    if(!variante){ variante = {id:uid(), talle, color, codigo:codigoGenerado, stock:0}; producto.variantes.push(variante); }
    const existente = compraLineas.find(l=>l.varianteId===variante.id);
    if(existente) existente.cantidad += cantidad;
    else compraLineas.push({productoId:producto.id, varianteId:variante.id, nombre:producto.nombre, varianteLabel:[talle,color].filter(Boolean).join(' / ')||'Único', cantidad});
  }));
  compraRapida.talle=''; compraRapida.color=''; compraRapida.codigo=''; compraRapida.cantidad=1;
  showToast(talles.length*coloresFinales.length+' variante(s) agregada(s) a la compra');
  renderAll();
}
function quitarLineaCompra(idx){ compraLineas.splice(idx,1); renderAll(); }

function registrarCompra(){
  if(!nuevaCompra.descripcion.trim()){ showToast('Contame qué compraste'); return; }
  state.compras.push({
    id: uid(), fecha: nuevaCompra.fecha, descripcion: nuevaCompra.descripcion.trim(),
    lugar: nuevaCompra.lugar.trim(), proveedor: nuevaCompra.proveedor.trim(), direccion: nuevaCompra.direccion.trim(), telefono: nuevaCompra.telefono.trim(), costo: Number(nuevaCompra.costo)||0,
    notas: nuevaCompra.notas.trim(), lineas: compraLineas.map(l=>({...l}))
  });
  compraLineas.forEach(l=>{
    const p = state.productos.find(p=>p.id===l.productoId);
    const v = p ? p.variantes.find(v=>v.id===l.varianteId) : null;
    if(v){v.stock += l.cantidad;registrarEtiquetasPendientes(v.id,l.cantidad);}
  });
  save();
  registrarMovimiento('Compra registrada', nuevaCompra.descripcion.trim()+' · '+money(Number(nuevaCompra.costo)||0)+(compraLineas.length ? ' · +'+compraLineas.reduce((a,l)=>a+l.cantidad,0)+' u. al stock' : ''), {guardar:true});
  showToast(compraLineas.length ? 'Compra registrada y stock actualizado' : 'Compra registrada');
  nuevaCompra = {fecha: todayStr(), descripcion:'', lugar:'', proveedor:'', direccion:'', telefono:'', costo:'', notas:''};
  compraLineas = [];
  renderAll();
}
function eliminarCompra(id){
  const c = state.compras.find(c=>c.id===id);
  if(!c) return;
  if(!confirm('¿Eliminar esta compra del historial?')) return;
  const lineas = c.lineas && c.lineas.length ? c.lineas : (c.productoId && c.cantidad>0 ? [{productoId:c.productoId, varianteId:c.varianteId, cantidad:c.cantidad}] : []);
  if(lineas.length && confirm('Esta compra había sumado stock ('+lineas.reduce((a,l)=>a+l.cantidad,0)+' unidades en total). ¿Querés restarlas también del stock actual?')){
    lineas.forEach(l=>{
      const p = state.productos.find(p=>p.id===l.productoId);
      const v = p ? p.variantes.find(v=>v.id===l.varianteId) : null;
      if(v){retirarEtiquetasPendientes(v.id,l.cantidad);v.stock = Math.max(0, v.stock - l.cantidad);}
    });
  }
  registrarMovimiento('Compra eliminada', c.descripcion+' · '+money(c.costo));
  state.compras = state.compras.filter(x=>x.id!==id);
  save();
  showToast('Compra eliminada');
  renderAll();
}
