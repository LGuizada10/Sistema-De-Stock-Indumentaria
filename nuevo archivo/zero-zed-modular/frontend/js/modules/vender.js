// [ZZ] modules/vender.js — Pestaña VENDER: carrito, pagos (incluye pago dividido) y confirmación de venta.
/* =================== VENDER =================== */
let cart = [];
let ventaSelCat = '', ventaSelProd = '', ventaSelVar = '', ventaSelQty = 1, ventaMetodo = 'Efectivo', ventaSearch = '', ventaClaveConsultada = '';
let ventaDividida = false, ventaMetodoB = 'Mercado Pago', ventaMontoA = '';
let ventaConfirmadaHasta=0, ventaConfirmadaTotal=0;

function porcentajeRecargo(metodo){ return metodo==='Débito' ? state.config.debitoPct : metodo==='Crédito' ? state.config.creditoPct : 0; }
/* Un método: paga todo con ese método. Dividido: "ventaMontoA" del precio con el método A y el resto con el B.
   El recargo de tarjeta se aplica solo a la parte que se paga con tarjeta. */
function calcularPagoVenta(subtotal){
  if(!ventaDividida){
    const pct = porcentajeRecargo(ventaMetodo);
    const recargo = Math.round(subtotal*pct/100);
    return {ok:subtotal>0, error:'', dividido:false, pct, recargo, total:subtotal+recargo,
            pagos:[{metodo:ventaMetodo, base:subtotal, monto:subtotal+recargo}]};
  }
  const a = Math.round(Number(ventaMontoA)||0);
  const b = subtotal - a;
  let error = '';
  if(!(a>0) || !(b>0)) error = 'Cargá los montos: efectivo + Mercado Pago tienen que sumar el subtotal';
  else if(ventaMetodo===ventaMetodoB) error = 'Elegí dos métodos distintos';
  const partes = [{metodo:ventaMetodo, base:Math.max(0,a)},{metodo:ventaMetodoB, base:Math.max(0,b)}];
  const pagos = partes.map(x=>({metodo:x.metodo, base:x.base, monto:x.base+Math.round(x.base*porcentajeRecargo(x.metodo)/100)}));
  const recargo = pagos.reduce((t,x)=>t+x.monto-x.base,0);
  return {ok:!error && subtotal>0, error, dividido:true, pct:0, recargo, total:subtotal+recargo, pagos};
}
function subtotalCarrito(){ return cart.reduce((a,i)=>a+i.cantidad*i.precioUnit,0); }
function renderResumenPago(){
  const subtotal = subtotalCarrito();
  const r = calcularPagoVenta(subtotal);
  let h = `<div class="totalline"><span class="muted">Subtotal</span><span class="num">${money(subtotal)}</span></div>`;
  if(r.recargo>0) h += `<div class="totalline"><span class="muted">Recargo ${r.dividido?'tarjeta':ventaMetodo+' ('+r.pct+'%)'}</span><span class="num">${money(r.recargo)}</span></div>`;
  h += `<div class="totalline big"><span>Total</span><span class="num">${money(r.total)}</span></div>`;
  if(r.dividido){
    h += r.pagos.map(x=>`<div class="totalline"><span class="muted">A cobrar en ${x.metodo}</span><span class="num">${money(x.monto)}</span></div>`).join('');
    if(r.error) h += `<p class="section-note" style="color:var(--brick);margin:6px 0 0;">${r.error}</p>`;
  }
  return h;
}
function actualizarResumenPago(){
  const el = document.getElementById('resumenPagoVenta');
  if(el) el.innerHTML = renderResumenPago();
  const b = document.getElementById('btnConfirmarVenta');
  if(b) b.disabled = cart.length===0 || !calcularPagoVenta(subtotalCarrito()).ok;
}
let ultimoTotalContado=null;
function animarTotalPago(){
  const objetivo=document.querySelector('#resumenPagoVenta .totalline.big .num');
  if(!objetivo)return;
  const destino=Number(calcularPagoVenta(subtotalCarrito()).total)||0;
  const inicio=ultimoTotalContado===null?destino:ultimoTotalContado;
  ultimoTotalContado=destino;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||inicio===destino){objetivo.textContent=money(destino);return;}
  const empieza=performance.now(),duracion=260;
  const avanzar=ahora=>{
    const progreso=Math.min(1,(ahora-empieza)/duracion);
    objetivo.textContent=money(Math.round(inicio+(destino-inicio)*progreso));
    if(progreso<1)requestAnimationFrame(avanzar);
  };
  requestAnimationFrame(avanzar);
}
function renderVender(){
  const t = turnoAbierto();
  if(!t){
    return `
      <h2 class="section-title">Vender</h2>
      <p class="section-note">Para registrar ventas primero tenés que abrir un turno.</p>
      <div class="card">
        <p style="margin:0 0 10px;">No hay ningún turno abierto ahora mismo.</p>
        <button class="btn primary" onclick="goTab('turno')">Ir a abrir turno</button>
      </div>`;
  }

  const categorias = state.config.categorias;
  const productos = state.productos;
  const term = ventaSearch.trim().toLowerCase();

  // si el término coincide EXACTO con el código de una variante, la seleccionamos directo (tipo escaneo de etiqueta)
  if(term){
    const exacta = resolverClaveExacta(term);
    if(exacta){ ventaSelProd = exacta.p.id; ventaSelVar = exacta.v ? exacta.v.id : ''; }
  }

  let prodsFiltrados = ventaSelCat ? productos.filter(p=>p.categoria===ventaSelCat) : productos;
  if(term){
    prodsFiltrados = prodsFiltrados.filter(p=>
      p.nombre.toLowerCase().includes(term) ||
      (p.descripcion||'').toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term) ||
      p.variantes.some(v=>(v.codigo||'').toLowerCase().includes(term))
    );
  }
  const prodSel = productos.find(p=>p.id===ventaSelProd);
  const variantes = prodSel ? prodSel.variantes : [];
  const varSel = prodSel ? variantes.find(v=>v.id===ventaSelVar) : null;

  const subtotal = cart.reduce((a,i)=>a+i.cantidad*i.precioUnit,0);
  const pct = ventaMetodo==='Débito' ? state.config.debitoPct : ventaMetodo==='Crédito' ? state.config.creditoPct : 0;
  const recargo = Math.round(subtotal*pct/100);
  const total = subtotal + recargo;

  return `
  <h2 class="section-title">Vender</h2>
  <p class="section-note">Turno ${t.turno} en curso · agregá productos a la venta y elegí cómo paga.</p>
  ${Date.now()<ventaConfirmadaHasta?`<div class="checkout-success" role="status"><span class="checkout-check" aria-hidden="true">✓</span>Venta registrada · ${money(ventaConfirmadaTotal)}</div>`:''}
  ${ultimaVentaId ? `
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <span class="muted" style="font-size:13px;">Última venta registrada.</span>
    <button class="btn small primary" onclick="verComprobante('${ultimaVentaId}')">🧾 Ver comprobante</button>
  </div>` : ''}

  <div class="card">
    <div class="buscador"><span aria-hidden="true">⌕</span><input type="text" data-search="venta" placeholder="Escaneá la etiqueta o buscá una prenda" value="${ventaSearch}" aria-label="Buscar prenda" autocomplete="off" oninput="actualizarBusqueda('venta', this)" onkeydown="buscarClaveConEnter('venta', event, this)"></div>
    <details class="sales-category-filter" ${ventaSelCat?'open':''}>
      <summary>${ventaSelCat?'Categoría: '+escaparHTML(ventaSelCat):'Filtrar por categoría'}</summary>
      <select aria-label="Filtrar prendas por categoría" onchange="ventaSelCat=this.value; renderAll();">
        <option value="">Todas las categorías</option>
        ${categorias.map(c=>`<option value="${escaparHTML(c)}" ${ventaSelCat===c?'selected':''}>${escaparHTML(c)}</option>`).join('')}
      </select>
    </details>
    <div id="ventaResultados">${ventaResultadosHTML()}</div>
    <div id="ventaClaveResultado">${renderHistorialClave(ventaClaveConsultada)}</div>
  </div>

  <div class="card">
    <div class="card-title">Venta actual</div>
    ${cart.length===0 ? '<p class="empty">Todavía no agregaste productos.</p>' : `
    <table class="cart-table">
      <thead><tr><th>Producto</th><th>Variante</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>
        ${cart.map((i,idx)=>`
          <tr class="${i.varianteId===window.__nuevaLinea?'fila-nueva':''}">
            <td>${i.nombre}</td>
            <td>${i.varianteLabel}</td>
            <td class="num">${i.cantidad}</td>
            <td class="num">${money(i.precioUnit)}</td>
            <td class="num">${money(i.cantidad*i.precioUnit)}</td>
            <td><button class="link-btn" onclick="quitarDelCarrito(${idx})">quitar</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`}

    <hr class="stitch">
    <label style="font-size:11.5px;color:var(--ink-soft);font-weight:600;display:block;margin-bottom:6px;">Método de pago</label>
    <div class="payment-methods">
      ${METODOS.map(m=>`<button type="button" class="cat-scroll-chip ${(!ventaDividida && ventaMetodo===m)?'active':''}" onclick="elegirMetodoVenta('${m}')">${m}${(m==='Débito'||m==='Crédito') ? ' (+' + porcentajeRecargo(m) + '%)' : ''}</button>`).join('')}
      <button type="button" class="cat-scroll-chip ${ventaDividida?'active':''}" onclick="elegirPagoDividido()">Efectivo + Mercado Pago</button>
    </div>
    ${ventaDividida ? `<div class="row" style="margin-bottom:4px;">
      <div class="field" style="max-width:220px;">
        <label>Efectivo</label>
        <input type="number" id="ventaMontoEfectivo" min="0" inputmode="numeric" placeholder="0" value="${ventaMontoA}" oninput="setMontoEfectivoSplit(this.value)">
      </div>
      <div class="field" style="max-width:220px;">
        <label>Mercado Pago</label>
        <input type="number" id="ventaMontoMP" min="0" inputmode="numeric" placeholder="0" value="${ventaMontoA===''?'':Math.round(subtotal-(Number(ventaMontoA)||0))}" oninput="setMontoMPSplit(this.value)">
      </div>
    </div>
    <p class="section-note" style="margin:0 0 6px;">Cargá uno de los dos montos y el otro se completa solo con lo que falta.</p>` : ''}
    ${ventaFacturaHTML()}
    <div id="resumenPagoVenta">${renderResumenPago()}</div>
    <div style="margin-top:10px;display:flex;gap:8px;">
      <button class="btn primary checkout-button" id="btnConfirmarVenta" ${(cart.length===0 || !calcularPagoVenta(subtotal).ok)?'disabled':''} onclick="confirmarVenta()">${cart.length ? 'Cobrar '+money(calcularPagoVenta(subtotal).total||total) : 'Cobrar'}</button>
      <button class="btn ghost" ${cart.length===0?'disabled':''} onclick="cart=[]; renderAll();">Vaciar</button>
    </div>
  </div>
  `;
}

function elegirMetodoVenta(m){ ventaDividida=false; ventaMontoA=''; ventaMetodo=m; renderAll(); }
function elegirPagoDividido(){ ventaDividida=true; ventaMetodo='Efectivo'; ventaMetodoB='Mercado Pago'; ventaMontoA=''; renderAll(); }
function setMontoEfectivoSplit(v){
  ventaMontoA = v;
  const mp = document.getElementById('ventaMontoMP');
  if(mp) mp.value = v==='' ? '' : Math.round(subtotalCarrito()-(Number(v)||0));
  actualizarResumenPago();
}
function setMontoMPSplit(v){
  ventaMontoA = v==='' ? '' : String(Math.round(subtotalCarrito()-(Number(v)||0)));
  const ef = document.getElementById('ventaMontoEfectivo');
  if(ef) ef.value = ventaMontoA;
  actualizarResumenPago();
}
function agregarAlCarrito(){
  const p = state.productos.find(p=>p.id===ventaSelProd);
  if(!p) return;
  const v = p.variantes.find(v=>v.id===ventaSelVar);
  if(!v) return;
  const qty = Math.max(1, ventaSelQty||1);
  const yaEnCarrito = cart.filter(i=>i.varianteId===v.id).reduce((a,i)=>a+i.cantidad,0);
  if(yaEnCarrito + qty > v.stock){
    showToast('No hay stock suficiente (quedan '+v.stock+')');
    return;
  }
  const linea = {
    productoId:p.id, nombre:p.nombre + (p.descripcion?(' ('+p.descripcion+')'):''), categoria:p.categoria,
    varianteId:v.id, codigo:v.codigo||'', talle:v.talle||'', color:v.color||'', varianteLabel:[v.talle,v.color].filter(x=>x&&x!=='-').join(' / ')||'Único',
    cantidad:qty, precioUnit:p.precio, costoUnit:Number(p.costo)||0
  };
  window.__nuevaLinea = v.id;
  const ex = cart.find(i=>i.varianteId===v.id && i.precioUnit===linea.precioUnit);
  if(ex) ex.cantidad += qty; else cart.push(linea);
  if(navigator.vibrate && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(12);
  ventaSelQty = 1;
  renderAll();
}
function quitarDelCarrito(idx){ cart.splice(idx,1); renderAll(); }

async function confirmarVenta(){
  const t = turnoAbierto();
  if(!t || cart.length===0 || ventaEnCurso) return;
  const subtotal = subtotalCarrito();
  const pago = calcularPagoVenta(subtotal);
  if(!pago.ok){ showToast(pago.error || 'Revisá el pago'); return; }
  const errFac = facReq ? facValidar() : '';
  if(errFac){ showToast(errFac); return; }
  ventaEnCurso = true;
  try{
    await sincronizar();
    const pagos = pago.dividido ? pago.pagos.map(x=>({metodo:x.metodo, base:x.base})) : [{metodo:pago.pagos[0].metodo}];
    const {data:id,error} = await sb.rpc('registrar_venta',{p_turno_id:t.id, p_items:cart.map(i=>({variante_id:i.varianteId, cantidad:i.cantidad})), p_pagos:pagos});
    if(error) throw error;
    await cargarTodo();
    if(facReq){
      const d = facDatos;
      const {error:ef} = await sb.from('solicitudes_factura').insert({venta_id:id, fecha:todayStr(), total:pago.total, nombre:d.nombre.trim(), documento_tipo:d.tipo, documento:d.doc.replace(/\D/g,''), email:d.email.trim(), telefono:d.tel.trim(), domicilio:d.dom.trim()});
      if(ef) showToast('Venta registrada, pero NO se guardó el pedido de factura: '+ef.message+'. Anotá los datos del cliente.');
      facReq = false; facConsent = false; facDatos = {nombre:'', tipo:'DNI', doc:'', email:'', tel:'', dom:''};
    }
    cart = []; ventaDividida = false; ventaMetodo='Efectivo'; ventaMontoA = ''; ventaSearch=''; ventaClaveConsultada=''; ventaSelProd=''; ventaSelVar=''; ventaSelQty=1;
    ultimaVentaId = id;
    ventaConfirmadaTotal=pago.total; ventaConfirmadaHasta=Date.now()+1600;
    showToast('Venta registrada · ' + money(pago.total));
    ventaEnCurso = false;
    renderAll();
    setTimeout(()=>{if(currentTab==='vender'&&Date.now()>=ventaConfirmadaHasta)renderAll();},1700);
    if(!window.matchMedia('(pointer: coarse)').matches){
      setTimeout(()=>{const input=document.querySelector('[data-search="venta"]');if(currentTab==='vender'&&input){input.focus();input.select();}},0);
    }
  }catch(e){
    ventaEnCurso = false;
    showToast('No se pudo registrar la venta: ' + (e.message||e));
  }
}
