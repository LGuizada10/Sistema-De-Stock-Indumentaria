// [ZZ] modules/historial.js — Pestaña HISTORIAL: ventas por día, exportar.
/* =================== HISTORIAL =================== */
let historialFecha = todayStr();

function renderHistorial(){
  const ventas = ventasDe(historialFecha);
  const devoluciones = state.devoluciones.filter(d=>d.fecha===historialFecha);
  const comprasReventa = state.compras.filter(c=>c.fecha===historialFecha);
  const turnosDia = state.turnos.filter(t=>t.fecha===historialFecha);
  const ajusteDevoluciones = devoluciones.reduce((total,d)=>total+ajusteEconomicoDevolucion(d),0);
  const totalVendidoNeto = ventas.reduce((total,v)=>total+Number(v.total||0),0)+ajusteDevoluciones;
  const porMetodo = {}; METODOS.forEach(m=>porMetodo[m]=0);
  ventas.forEach(v=>sumarVentaPorMetodo(porMetodo,v));
  devoluciones.forEach(d=>aplicarAjusteDevolucionPorMetodo(porMetodo,d));

  const ranking = {};
  ventas.forEach(v=>v.items.forEach(i=>{
    const key = i.nombre + (i.varianteLabel?(' · '+i.varianteLabel):'');
    ranking[key] = ranking[key] || {cantidad:0, total:0};
    ranking[key].cantidad += i.cantidad;
    ranking[key].total += i.cantidad*i.precioUnit;
  }));
  const rankingArr = Object.entries(ranking).sort((a,b)=>b[1].cantidad-a[1].cantidad).slice(0,10);

  return `
  <h2 class="section-title">Historial</h2>
  <div class="row" style="align-items:flex-end;">
    <div class="field" style="max-width:200px;">
      <label>Fecha</label>
      <input type="date" value="${historialFecha}" onchange="historialFecha=this.value; renderAll(); asegurarHistorialDesde(this.value);">
    </div>
    <div class="field" style="flex:0 0 auto;">
      <button class="btn" onclick="exportarVentasDia()">Descargar registro del día (Excel)</button>
    </div>
  </div>

  <div class="top-summary">
    <div class="stat"><div class="v">${money(totalVendidoNeto)}</div><div class="l">Ventas netas</div></div>
    <div class="stat"><div class="v">${ventas.length}</div><div class="l">Ventas</div></div>
    <div class="stat"><div class="v">${devoluciones.length}</div><div class="l">Devoluciones</div></div>
    ${session === 'admin' ? `<div class="stat"><div class="v">${money(comprasReventa.reduce((a,c)=>a+Number(c.costo||0),0))}</div><div class="l">Compras reventa</div></div>` : ''}
    ${METODOS.map(m=>`<div class="stat"><div class="v">${money(porMetodo[m])}</div><div class="l">${m}</div></div>`).join('')}
  </div>

  <div class="card">
    <div class="card-title">Ventas por día · últimos 7 días</div>
    <p class="section-note" style="margin-bottom:4px;">Importes netos: ventas menos devoluciones y diferencias de cambios.</p>
    ${renderGraficoVentasDiarias()}
  </div>

  ${session === 'admin' ? renderGraficoGananciaPrendas() : ''}

  <div class="card">
    <div class="card-title">Más vendido ese día</div>
    ${rankingArr.length===0 ? '<p class="empty">Sin ventas ese día.</p>' : `
    <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Total</th></tr></thead>
    <tbody>${rankingArr.map(([k,v])=>`<tr><td>${k}</td><td class="num">${v.cantidad}</td><td class="num">${money(v.total)}</td></tr>`).join('')}</tbody></table>`}
  </div>

  <div class="card">
    <div class="card-title">Detalle de ventas</div>
    ${ventas.length===0 ? '<p class="empty">Sin ventas registradas.</p>' : ventas.slice().reverse().map(v=>`
      <div style="padding:8px 0;border-bottom:1px dashed var(--line-soft);font-size:13.5px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <b>${v.hora} · ${etiquetaPagosDetalle(v)}</b>
          <span style="display:flex;align-items:center;gap:10px;">
            <span class="num">${money(v.total)}</span>
            <button class="link-btn" style="color:var(--mustard);" onclick="verComprobante('${v.id}')">comprobante</button>
          </span>
        </div>
        <div class="muted">${v.items.map(i=>i.cantidad+'x '+i.nombre+(i.varianteLabel?(' ('+i.varianteLabel+')'):'')).join(', ')}</div>
      </div>
    `).join('')}
  </div>

  <div class="card">
    <div class="card-title">Devoluciones del día</div>
    ${devoluciones.length===0 ? '<p class="empty">Sin devoluciones registradas ese día.</p>' : `
    <div style="max-height:360px;overflow-y:auto;">
      <table><thead><tr><th>Hora</th><th>Tipo</th><th>Producto devuelto</th><th>Recibió / diferencia</th><th>Cant.</th><th>Importe</th></tr></thead>
      <tbody>${devoluciones.slice().reverse().map(d=>{
        const esReintegro = !esCambioDevolucion(d);
        const importe = esReintegro ? Number(d.montoDevuelto||0) : Number(d.montoDiferencia||0);
        const color = esReintegro ? 'var(--brick)' : (importe > 0 ? 'var(--green)' : 'var(--brick)');
        const textoImporte = esReintegro ? '-' + money(importe) : (importe >= 0 ? '+' + money(importe) : '-' + money(Math.abs(importe)));
        return `<tr>
          <td>${d.hora}</td>
          <td>${esCambioDevolucion(d)?'Cambio':'Devolución'}</td>
          <td>${d.nombre}${d.varianteLabel?(' ('+d.varianteLabel+')'):''}${d.motivo?'<br><span class="muted">'+d.motivo+'</span>':''}</td>
          <td>${esCambioDevolucion(d) ? descripcionProductosRecibidos(d)+' · '+(d.montoDiferencia>0?'cobra '+money(d.montoDiferencia):d.montoDiferencia<0?'devuelve '+money(Math.abs(d.montoDiferencia)):'sin diferencia') : 'Reintegro '+d.reintegro}</td>
          <td class="num">${d.cantidad}</td>
          <td class="num" style="color:${color};">${textoImporte}</td>
        </tr>`;
      }).join('')}</tbody></table>
    </div>`}
  </div>

  ${session === 'admin' ? `
  <div class="card">
    <div class="card-title">Compras para reventa del día</div>
    ${comprasReventa.length===0 ? '<p class="empty">Sin compras para reventa registradas ese día.</p>' : `
    ${comprasReventa.slice().reverse().map(c=>{
      const lineas = c.lineas && c.lineas.length ? c.lineas : [];
      return `<div style="padding:8px 0;border-bottom:1px dashed var(--line-soft);font-size:13.5px;">
        <div style="display:flex;justify-content:space-between;gap:8px;"><b>${c.descripcion}</b><span class="num">${money(c.costo)}</span></div>
        <div class="muted">${c.proveedor||'-'}${c.notas?(' · '+c.notas):''}</div>
        ${lineas.length ? `<div class="muted" style="margin-top:2px;">${lineas.map(l=>l.cantidad+'x '+l.nombre+(l.varianteLabel?(' ('+l.varianteLabel+')'):'')).join(', ')}</div>` : ''}
      </div>`;
    }).join('')}`}
  </div>
  ` : ''}

  ${turnosDia.length ? `
  <div class="card">
    <div class="card-title">Turnos del día</div>
    <table><thead><tr><th>Turno</th><th>Inicial</th><th>Contado</th><th>Gastos</th><th>Estado</th></tr></thead>
    <tbody>${turnosDia.map(t=>`<tr><td>${t.turno}</td><td class="num">${money(t.cambioInicial)}</td><td class="num">${t.cambioFinal!=null?money(t.cambioFinal):'-'}</td><td class="num">${money(t.gastos.reduce((a,g)=>a+g.monto,0))}</td><td>${t.abierto?'Abierto':'Cerrado'}</td></tr>`).join('')}</tbody></table>
  </div>` : ''}
  `;
}

async function exportarVentasDia(){
  if(typeof XLSX === 'undefined'){ showToast('El generador de Excel sigue cargando, probá de nuevo en un segundo'); return; }
  const fecha = historialFecha;
  const ventas = ventasDe(fecha);
  const turnosDia = state.turnos.filter(t=>t.fecha===fecha);
  const wb = XLSX.utils.book_new();
  const turnoDeVenta = venta => turnosDia.find(t=>t.id===venta.turnoId);
  const nombreTurno = venta => turnoDeVenta(venta)?.turno || 'Sin turno asociado';
  const datosVariante = item => {
    const producto = state.productos.find(p=>p.id===item.productoId);
    const variante = producto?.variantes.find(v=>v.id===item.varianteId);
    return {
      codigo: item.codigo || variante?.codigo || '',
      talle: item.talle || variante?.talle || '',
      color: item.color || variante?.color || ''
    };
  };
  const filasVentas = [];
  ventas.forEach(v=>v.items.forEach(i=>{
    const variante = datosVariante(i);
    filasVentas.push({
      Fecha:fecha, Turno:nombreTurno(v), Hora:v.hora, VentaId:v.id,
      Metodo:v.metodoPago, Pagos:etiquetaPagosDetalle(v), Producto:i.nombre, Codigo:variante.codigo,
      Talle:variante.talle, Color:variante.color, Cantidad:i.cantidad,
      PrecioUnit:i.precioUnit, Subtotal:i.cantidad*i.precioUnit
    });
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasVentas.length ? filasVentas : [{Fecha:fecha,Producto:'Sin ventas registradas'}]), 'Ventas');

  const gastos = [];
  turnosDia.forEach(t=>(t.gastos||[]).forEach(g=>gastos.push({Fecha:fecha, Turno:t.turno, Hora:g.hora, Descripcion:g.desc, Monto:g.monto})));
  const comprasReventa = state.compras.filter(c=>c.fecha===fecha);
  const filasCompras = [];
  comprasReventa.forEach(c=>{
    const lineas = c.lineas && c.lineas.length ? c.lineas : [{nombre:c.descripcion, varianteLabel:'', cantidad:''}];
    lineas.forEach(l=>filasCompras.push({Fecha:fecha, Lugar:c.lugar||'', Proveedor:c.proveedor||'', Direccion:c.direccion||'', Telefono:c.telefono||'', Descripcion:c.descripcion, Producto:l.nombre||'', Variante:l.varianteLabel||'', Cantidad:l.cantidad, CostoTotal:c.costo, Notas:c.notas||''}));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasCompras.length ? filasCompras : [{Fecha:fecha,Descripcion:'Sin compras para reventa registradas'}]), 'Compras reventa');
  const devoluciones = state.devoluciones.filter(d=>d.fecha===fecha).map(d=>({
    Fecha:fecha, Turno:turnosDia.find(t=>t.id===d.turnoId)?.turno||'Sin turno asociado', Hora:d.hora,
    Tipo:d.tipo==='cambio'?'Cambio':'Devolución', ProductoDevuelto:d.nombre,
    VarianteDevuelta:d.varianteLabel||'', CodigoDevuelto:d.codigo||'', Cantidad:d.cantidad,
    ProductoRecibido:d.nombreNuevo||'', VarianteRecibida:d.varianteNuevaLabel||'', CodigoRecibido:d.codigoNuevo||'',
    ProductosRecibidos:descripcionProductosRecibidos(d),
    ImporteDevuelto:esCambioDevolucion(d)?0:-Number(d.montoDevuelto||0), ImporteProductoRecibido:Number(d.montoNuevo||0),
    Diferencia:ajusteEconomicoDevolucion(d),
    MetodoReintegro:d.reintegro||'', MetodoDiferencia:d.metodoDiferencia||'', Motivo:d.motivo||''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devoluciones.length ? devoluciones : [{Hora:'',Producto:'Sin devoluciones registradas'}]), 'Devoluciones');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastos.length ? gastos : [{Hora:'',Descripcion:'Sin gastos registrados'}]), 'Gastos');

  const totalVendidoBruto = ventas.reduce((a,v)=>a+Number(v.total||0),0);
  const totalAjustesDevolucion = devoluciones.reduce((a,d)=>a+Number(d.Diferencia||0),0);
  const totalVendido = totalVendidoBruto+totalAjustesDevolucion;
  const gastosOperativos = gastos.filter(g=>!/^Devolución:|^Diferencia de cambio:/i.test(g.Descripcion||''));
  const totalGastos = gastosOperativos.reduce((a,g)=>a+Number(g.Monto||0),0);
  const totalComprasReventa = comprasReventa.reduce((a,c)=>a+Number(c.costo||0),0);
  const totalDevuelto = devoluciones.reduce((a,d)=>a+Number(d.ImporteDevuelto||0),0);
  const totalNeto = totalVendido-totalGastos-totalComprasReventa;
  const resumen = [
    {Concepto:'Ventas brutas', Cantidad:ventas.length, Monto:totalVendidoBruto},
    {Concepto:'Devoluciones / ajustes (negativo)', Cantidad:devoluciones.length, Monto:totalDevuelto},
    {Concepto:'Ventas netas con cambios', Cantidad:'', Monto:totalVendido},
    {Concepto:'Gastos operativos', Cantidad:gastosOperativos.length, Monto:totalGastos},
    {Concepto:'Total compras para reventa', Cantidad:comprasReventa.length, Monto:totalComprasReventa},
    {Concepto:'Total devoluciones', Cantidad:devoluciones.length, Monto:totalDevuelto},
    {Concepto:'Neto del día (ventas - gastos - compras)', Cantidad:'', Monto:totalNeto}
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  const cierre = turnosDia.map(t=>{
    const ventasTurno = ventas.filter(v=>v.turnoId===t.id);
    const gastosTurno = (t.gastos||[]).reduce((a,g)=>a+Number(g.monto||0),0);
    const ingresosCambioEfectivo = (t.ingresosCambio||[]).reduce((a,i)=>a+Number(i.monto||0),0);
    const efectivo = ventasTurno.reduce((a,v)=>a+montoEfectivoDeVenta(v),0);
    const esperado = Number(t.cambioInicial||0)+efectivo+ingresosCambioEfectivo-gastosTurno;
    const ajustesTurno = state.devoluciones.filter(d=>d.turnoId===t.id).reduce((a,d)=>a+ajusteEconomicoDevolucion(d),0);
    const totalVendidoNetoTurno = ventasTurno.reduce((a,v)=>a+Number(v.total||0),0)+ajustesTurno;
    return {Fecha:fecha, Turno:t.turno, Apertura:t.horaApertura, Cierre:t.horaCierre||'Abierto', CambioInicial:Number(t.cambioInicial||0), TotalVendido:ventasTurno.reduce((a,v)=>a+Number(v.total||0),0), AjustesDevoluciones:ajustesTurno, VentasNetas:totalVendidoNetoTurno, EfectivoVendido:efectivo, DiferenciasCobradasEfectivo:ingresosCambioEfectivo, GastosYReintegros:gastosTurno, EfectivoEsperado:esperado, EfectivoContado:t.cambioFinal==null?'':t.cambioFinal, Diferencia:t.cambioFinal==null?'':Number(t.cambioFinal)-esperado};
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cierre.length ? cierre : [{Fecha:fecha,Turno:'Sin turnos registrados'}]), 'Cierre de caja');
  const arrayBuf = XLSX.write(wb, {type:'array', bookType:'xlsx'});
  const blob = new Blob([arrayBuf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  await descargarArchivo('zero-zed-ventas-'+fecha+'.xlsx', blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
