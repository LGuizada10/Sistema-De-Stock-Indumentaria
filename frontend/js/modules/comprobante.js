// [ZZ] modules/comprobante.js — Comprobante / recibo de venta (ver, imprimir, PDF).
/* =================== COMPROBANTE / RECIBO =================== */
let printVentaId = null;
let ultimaVentaId = null;

function verComprobante(ventaId){
  printVentaId = ventaId;
  renderAll();
}
function cerrarComprobante(){
  printVentaId = null;
  renderAll();
}
function filasComprobante(v){
  return v.items.map(i=>`
    <tr>
      <td colspan="2">${i.cantidad}x ${i.nombre}${i.varianteLabel?(' ('+i.varianteLabel+')'):''}</td>
    </tr>
    <tr>
      <td style="color:#5B6660;">&nbsp;&nbsp;${money(i.precioUnit)} c/u</td>
      <td style="text-align:right;">${money(i.cantidad*i.precioUnit)}</td>
    </tr>
  `).join('');
}

function renderRecibo(ventaId){
  const v = state.ventas.find(v=>v.id===ventaId);
  if(!v){
    return `<div class="receipt-wrap"><div class="receipt"><p>No se encontró esa venta.</p>
      <div class="receipt-actions no-print"><button class="btn ghost" onclick="cerrarComprobante()">Cerrar</button></div>
    </div></div>`;
  }
  return `
  <div class="receipt-wrap">
    <div class="receipt" style="position:relative;">
      <button class="no-print" onclick="cerrarComprobante()" title="Cerrar sin guardar" style="position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;border:1.5px solid #14181A;background:#fff;color:#14181A;font-size:15px;font-weight:700;cursor:pointer;line-height:1;">✕</button>
      <div class="receipt-head">
        <div class="rname">ZERO ZED</div>
        <div class="rmeta">${fmtDate(v.fecha)} · ${v.hora}hs</div>
        <div class="rmeta">Comprobante interno · no válido como factura</div>
      </div>
      <hr>
      <table>${filasComprobante(v)}</table>
      <hr>
      <div class="rline"><span>Subtotal</span><span>${money(v.subtotal)}</span></div>
      ${(v.total-v.subtotal)>0 ? `<div class="rline"><span>Recargo${v.recargoPct>0?' ('+v.recargoPct+'%)':' tarjeta'}</span><span>${money(v.total-v.subtotal)}</span></div>` : ''}
      <div class="rtotal"><span>TOTAL</span><span>${money(v.total)}</span></div>
      <div style="margin-top:6px;">${pagosDeVenta(v).length>1 ? pagosDeVenta(v).map(x=>`<div class="rline"><span>Pago en ${x.metodo}</span><span>${money(x.monto)}</span></div>`).join('') : `<div class="rline"><span>Método de pago</span><span>${v.metodoPago}</span></div>`}</div>
      <div class="receipt-foot">¡Gracias por tu compra!</div>
      <div class="receipt-actions no-print">
        <button class="btn primary" onclick="guardarComprobante('${v.id}')">💾 Descargar (PDF)</button>
        <button class="btn ghost" onclick="window.print()">Imprimir</button>
        <button class="btn ghost" onclick="cerrarComprobante()">Cerrar</button>
      </div>
    </div>
  </div>`;
}

async function guardarComprobante(ventaId){
  const v = state.ventas.find(v=>v.id===ventaId);
  if(!v) return;
  if(typeof window.jspdf === 'undefined'){ showToast('El generador de PDF sigue cargando, probá de nuevo en un segundo'); return; }
  const { jsPDF } = window.jspdf;
  const anchoMM = 72;
  const altoMM = 48 + v.items.length*10 + ((v.total-v.subtotal)>0?6:0) + (pagosDeVenta(v).length>1 ? pagosDeVenta(v).length*4.5 : 0);
  const doc = new jsPDF({unit:'mm', format:[anchoMM, altoMM]});
  const cx = anchoMM/2;
  let y = 8;

  doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('ZERO ZED', cx, y, {align:'center'}); y += 5;
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,100,95);
  doc.text(fmtDate(v.fecha)+' · '+v.hora+'hs', cx, y, {align:'center'}); y += 4;
  doc.text('Comprobante interno · no válido como factura', cx, y, {align:'center'}); y += 4;
  doc.setTextColor(20,24,26);
  doc.setLineDash([0.8,0.8],0); doc.line(4,y,anchoMM-4,y); y += 5;

  doc.setFontSize(8.5);
  v.items.forEach(i=>{
    const nombreLinea = i.cantidad+'x '+i.nombre+(i.varianteLabel?(' ('+i.varianteLabel+')'):'');
    const partido = doc.splitTextToSize(nombreLinea, anchoMM-8);
    doc.setFont('helvetica','normal');
    doc.text(partido, 4, y); y += 4*partido.length;
    doc.setTextColor(90,100,95); doc.setFontSize(7.5);
    doc.text(money(i.precioUnit)+' c/u', 4, y);
    doc.setTextColor(20,24,26); doc.setFontSize(8.5);
    doc.text(money(i.cantidad*i.precioUnit), anchoMM-4, y, {align:'right'});
    y += 5;
  });

  doc.setLineDash([0.8,0.8],0); doc.line(4,y,anchoMM-4,y); y += 5;
  doc.setFontSize(8.5);
  doc.text('Subtotal', 4, y); doc.text(money(v.subtotal), anchoMM-4, y, {align:'right'}); y += 4.5;
  if((v.total-v.subtotal)>0){
    doc.text('Recargo'+(v.recargoPct>0?' ('+v.recargoPct+'%)':' tarjeta'), 4, y); doc.text(money(v.total-v.subtotal), anchoMM-4, y, {align:'right'}); y += 4.5;
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text('TOTAL', 4, y); doc.text(money(v.total), anchoMM-4, y, {align:'right'}); y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  const pg = pagosDeVenta(v);
  if(pg.length>1){
    pg.forEach(x=>{ doc.text('Pago en '+x.metodo, 4, y); doc.text(money(x.monto), anchoMM-4, y, {align:'right'}); y += 4.5; });
    y += 1.5;
  }else{
    doc.text('Método de pago', 4, y); doc.text(v.metodoPago, anchoMM-4, y, {align:'right'}); y += 6;
  }
  doc.setFontSize(8); doc.setTextColor(90,100,95);
  doc.text('¡Gracias por tu compra!', cx, y, {align:'center'});

  const blob = doc.output('blob');
  const filename = 'comprobante-'+v.fecha+'-'+v.hora.replace(':','')+'.pdf';
  await descargarArchivo(filename, blob, 'application/pdf');
}
