// [ZZ] modules/resumen.js — Pestaña RESUMEN (admin): gráficos de ventas, ganancia y KPIs.
function renderGraficoVentasDiarias(fechaFinal=historialFecha){
  fechaFinal = fechaFinal || todayStr();
  const datos = Array.from({length:7},(_,i)=>{
    const fecha = fechaSumandoDias(fechaFinal,i-6);
    return {fecha, total:totalNetoDeFecha(fecha)};
  });
  const maximo = Math.max(1,...datos.map(d=>d.total));
  return `<div class="sales-chart">${datos.map(d=>`
    <div class="sales-chart-day" title="${fmtDate(d.fecha)} · ${money(d.total)}">
      <span class="sales-chart-value">${money(d.total)}</span>
      <div class="sales-chart-bar" style="height:${Math.max(3,(Math.max(0,d.total)/maximo)*145)}px;"></div>
      <span class="sales-chart-label">${d.fecha.slice(8,10)}/${d.fecha.slice(5,7)}</span>
    </div>`).join('')}</div>`;
}
let gananciaModo = 'mes';
let gananciaMes = todayStr().slice(0,7);
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function fmtMes(m){ const [y,mm]=m.split('-'); return MESES_LARGO[Number(mm)-1]+' '+y; }
function mesSumando(m,n){ const [y,mm]=m.split('-').map(Number); const d=new Date(y,mm-1+n,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function esGastoDeDevolucion(g){ return /^(Devolución|Diferencia de cambio):/.test(String(g.desc||'')); }
function costoDeItem(item, productoId){
  const prod = productoPorId(productoId);
  const cv = item ? (Number(item.costoUnit)||0) : 0;
  return cv>0 ? cv : (Number(prod ? prod.costo : 0)||0);
}
/* Ganancia bruta = ventas − devoluciones/cambios (precio − costo) × cantidad. Neta = bruta − gastos de turnos
   (los reintegros en efectivo que se cargan como gasto de turno se excluyen: ya están en las devoluciones). */
function calcularGanancia(filtroFecha){
  const mapa = {}; const sinCosto = new Set(); let ajusteDev = 0;
  const fila = nombre => (mapa[nombre] = mapa[nombre] || {nombre, cantidad:0, ganancia:0, venta:0});
  state.ventas.filter(v=>filtroFecha(v.fecha)).forEach(v=>v.items.forEach(i=>{
    const costo = costoDeItem(i, i.productoId);
    if(!(costo>0)){ sinCosto.add(i.nombre); return; }
    const m = fila(i.nombre);
    m.cantidad += i.cantidad;
    m.venta += i.cantidad*i.precioUnit;
    m.ganancia += i.cantidad*(i.precioUnit-costo);
  }));
  state.devoluciones.filter(d=>filtroFecha(d.fecha)).forEach(d=>{
    const venta = d.ventaId ? state.ventas.find(v=>v.id===d.ventaId) : null;
    const item = venta && d.itemIdx!=null ? venta.items[d.itemIdx] : null;
    const cant = Number(d.cantidad)||0;
    const costo = costoDeItem(item, d.productoId);
    const precio = cant ? Number(d.montoDevuelto||0)/cant : 0;
    if(costo>0 && cant){
      const g = cant*(precio-costo);
      const m = fila(item ? item.nombre : d.nombre);
      m.cantidad -= cant; m.venta -= cant*precio; m.ganancia -= g; ajusteDev -= g;
    }
    if(esCambioDevolucion(d)){
      productosRecibidosCambio(d).forEach(l=>{
        const prod = productoPorId(l.productoId);
        const c = Number(prod ? prod.costo : 0)||0;
        const nombre = prod ? prod.nombre+(prod.descripcion?' ('+prod.descripcion+')':'') : l.nombre;
        if(!(c>0)){ sinCosto.add(nombre); return; }
        const q = Number(l.cantidad||0), pu = Number(l.precioUnit||0);
        const m = fila(nombre);
        m.cantidad += q; m.venta += q*pu; m.ganancia += q*(pu-c); ajusteDev += q*(pu-c);
      });
    }
  });
  const filas = Object.values(mapa).filter(f=>f.cantidad!==0 || Math.abs(f.ganancia)>0.5).sort((a,b)=>b.ganancia-a.ganancia);
  const bruta = filas.reduce((t,f)=>t+f.ganancia,0);
  const gastos = state.turnos.filter(t=>filtroFecha(t.fecha))
    .reduce((tot,t)=>tot+(t.gastos||[]).filter(g=>!esGastoDeDevolucion(g)).reduce((x,g)=>x+Number(g.monto||0),0),0);
  return {filas, sinCosto:[...sinCosto], bruta, gastos, neta:bruta-gastos, ajusteDev};
}
function renderGraficoGananciaPrendas(){
  const esMes = gananciaModo==='mes';
  const filtro = esMes ? (f=>f.startsWith(gananciaMes)) : (f=>f===historialFecha);
  const {filas, sinCosto, bruta, gastos, neta, ajusteDev} = calcularGanancia(filtro);
  const LIMITE = 15;
  const mostradas = filas.slice(0,LIMITE);
  const max = Math.max(1,...mostradas.map(f=>Math.abs(f.ganancia)));
  const barras = filas.length===0
    ? '<p class="empty">Sin ventas con costo cargado en este período.</p>'
    : mostradas.map(f=>`
      <div style="display:grid;grid-template-columns:minmax(90px,1.3fr) 3fr auto;gap:10px;align-items:center;margin:8px 0;font-size:13px;" title="${escaparHTML(f.nombre)} · ${f.cantidad} u. · vendido ${money(f.venta)}">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHTML(f.nombre)} <span class="muted">×${f.cantidad}</span></span>
        <div style="background:var(--line-soft);border-radius:3px;height:16px;overflow:hidden;">
          <div style="height:100%;width:${Math.max(2,(Math.abs(f.ganancia)/max)*100)}%;background:${f.ganancia<0?'var(--brick)':'var(--mustard)'};"></div>
        </div>
        <span class="num" style="min-width:70px;text-align:right;">${money(f.ganancia)}</span>
      </div>`).join('') + (filas.length>LIMITE ? `<p class="section-note" style="margin-top:6px;">Se muestran las ${LIMITE} prendas con más ganancia (${filas.length-LIMITE} más no aparecen).</p>` : '');

  let tendencia = '';
  if(esMes){
    const meses = Array.from({length:12},(_,i)=>mesSumando(gananciaMes,i-11));
    const datos = meses.map(m=>({m, ...calcularGanancia(f=>f.startsWith(m))}));
    const maxM = Math.max(1,...datos.map(d=>Math.max(d.bruta,d.neta)));
    const alto = x=>Math.max(3,(Math.max(0,x)/maxM)*145);
    const faltanMeses = desdeHistorial() > mesesParaGrafico();
    tendencia = `
    <div style="font-size:12px;color:var(--ink-soft);margin:10px 0 2px;">Ganancia por mes · últimos 12 meses (tocá una columna para ver ese mes)</div>
    ${faltanMeses ? '<p class="section-note">Cargando los meses anteriores… los valores se completan en unos segundos.</p>' : ''}
    <div style="font-size:11px;color:var(--ink-soft);margin-bottom:2px;"><span style="color:var(--mustard);">■</span> Bruta &nbsp; <span style="color:var(--warn);">■</span> Neta (después de gastos) &nbsp; <span style="color:var(--brick);">■</span> Neta negativa</div>
    <div style="overflow-x:auto;">
      <div class="sales-chart" style="min-width:${12*46}px;">${datos.map(d=>`
        <div class="sales-chart-day" style="cursor:pointer;" title="${fmtMes(d.m)} · bruta ${money(d.bruta)} · gastos ${money(d.gastos)} · neta ${money(d.neta)}" onclick="gananciaMes='${d.m}'; renderAll();">
          <span class="sales-chart-value">${money(d.neta)}</span>
          <div style="display:flex;align-items:flex-end;gap:2px;width:100%;justify-content:center;opacity:${d.m===gananciaMes?1:0.5};">
            <div class="sales-chart-bar" style="width:38%;max-width:18px;height:${alto(d.bruta)}px;background:var(--mustard);"></div>
            <div class="sales-chart-bar" style="width:38%;max-width:18px;height:${alto(d.neta)}px;background:${d.neta<0?'var(--brick)':'var(--warn)'};border-color:transparent;"></div>
          </div>
          <span class="sales-chart-label" style="${d.m===gananciaMes?'color:var(--ink);font-weight:600;':''}">${MESES_CORTO[Number(d.m.slice(5,7))-1]} ${d.m.slice(2,4)}</span>
        </div>`).join('')}</div>
    </div>
    <div style="font-size:12px;color:var(--ink-soft);margin:14px 0 2px;">Ganancia bruta por prenda · ${fmtMes(gananciaMes)}</div>`;
  }
  return `
  <div class="card">
    <div class="card-title"><span>Ganancia · ${esMes ? fmtMes(gananciaMes) : fmtDate(historialFecha)}</span><span class="num">${money(neta)}</span></div>
    <div class="row" style="align-items:flex-end;margin-bottom:6px;">
      <div class="field" style="flex:0 0 auto;">
        <label>Ver por</label>
        <div style="display:flex;gap:6px;">
          <button class="btn small ${esMes?'primary':'ghost'}" onclick="gananciaModo='mes'; renderAll();">Mes</button>
          <button class="btn small ${esMes?'ghost':'primary'}" onclick="gananciaModo='dia'; renderAll();">Día</button>
        </div>
      </div>
      ${esMes ? `<div class="field" style="max-width:190px;">
        <label>Mes</label>
        <input type="month" value="${gananciaMes}" onchange="gananciaMes=this.value||gananciaMes; renderAll(); asegurarHistorialDesde(mesesParaGrafico());">
      </div>` : `<p class="section-note" style="margin:0;">El día se elige con la fecha de arriba.</p>`}
    </div>
    <div class="top-summary" style="margin-bottom:8px;">
      <div class="stat"><div class="v">${money(bruta)}</div><div class="l">Ganancia bruta</div></div>
      <div class="stat"><div class="v">${money(gastos)}</div><div class="l">Gastos de turnos</div></div>
      <div class="stat"><div class="v" style="color:${neta<0?'var(--brick)':'inherit'};">${money(neta)}</div><div class="l">Ganancia neta</div></div>
    </div>
    <p class="section-note" style="margin-bottom:4px;">Bruta = (precio de venta − costo unitario) × cantidad, ya restando devoluciones y cambios${ajusteDev ? ' ('+(ajusteDev>0?'+':'−')+money(Math.abs(ajusteDev))+' en este período)' : ''}. Neta = bruta − gastos cargados en los turnos. La mercadería que comprás no se resta acá porque ya está en el costo de cada prenda. Solo visible para el administrador.</p>
    ${tendencia}
    ${barras}
    ${sinCosto.length ? `<p class="section-note" style="margin-top:8px;">Sin costo cargado (no incluidas): ${sinCosto.map(escaparHTML).join(', ')}.</p>` : ''}
  </div>`;
}
function renderResumenAdmin(){
  if(session!=='admin') return '';
  const fechaHoy=todayStr();
  const ventasHoy=ventasDe(fechaHoy);
  const devolucionesHoy=state.devoluciones.filter(devolucion=>devolucion.fecha===fechaHoy);
  const unidadesVendidas=ventasHoy.reduce((total,venta)=>total+venta.items.reduce((subtotal,item)=>subtotal+Number(item.cantidad||0),0),0);
  const gananciaHoy=calcularGanancia(fecha=>fecha===fechaHoy);
  const gananciaCompleta=gananciaHoy.sinCosto.length===0;
  const turno=turnoAbierto();
  const caja=turno ? resumenCajaDeTurno(turno) : null;
  const stockAgotado=state.productos.flatMap(producto=>producto.variantes
    .filter(variante=>Number(variante.stock||0)<=0)
    .map(variante=>({producto,variante})));
  const agotadasTotal=Number(stockResumenNube?.agotadas??stockAgotado.length);
  const filasStock=stockResumenNube?.agotadasMuestra ? stockResumenNube.agotadasMuestra.map(x=>({producto:{nombre:x.nombre},variante:{talle:x.talle,color:x.color}})) : stockAgotado.slice(0,6);
  const totalVentasHoy=totalNetoDeFecha(fechaHoy);

  return `
  <div class="summary-heading">
    <div><h2 class="section-title">Resumen</h2><p class="section-note">Actividad del local · ${fmtDate(fechaHoy)}</p></div>
    <div class="summary-actions">
      <button class="btn small ghost" onclick="historialFecha='${fechaHoy}'; goTab('historial')">Ver historial</button>
      <button class="btn small ghost" onclick="goTab('stock')">Ver stock</button>
    </div>
  </div>

  <div class="summary-kpis">
    <div class="summary-kpi"><div class="summary-kpi-label">Ventas netas hoy</div><div class="summary-kpi-value">${money(totalVentasHoy)}</div><div class="summary-kpi-note">${ventasHoy.length} venta(s) registrada(s)</div></div>
    <div class="summary-kpi"><div class="summary-kpi-label">Unidades vendidas</div><div class="summary-kpi-value">${unidadesVendidas}</div><div class="summary-kpi-note">Sin descontar devoluciones</div></div>
    <div class="summary-kpi"><div class="summary-kpi-label">Ganancia neta estimada</div><div class="summary-kpi-value">${gananciaCompleta?money(gananciaHoy.neta):'—'}</div><div class="summary-kpi-note">${gananciaCompleta?'Después de costos y gastos':'Faltan costos en '+gananciaHoy.sinCosto.length+' producto(s)'}</div></div>
    <div class="summary-kpi"><div class="summary-kpi-label">Variantes agotadas</div><div class="summary-kpi-value">${agotadasTotal}</div><div class="summary-kpi-note">Talles o colores con stock cero</div></div>
  </div>

  <div class="summary-grid">
    <div class="card">
      <div class="card-title">Movimiento de hoy</div>
      <div class="summary-line"><span class="summary-line-label">Ventas registradas</span><span class="summary-line-value">${ventasHoy.length}</span></div>
      <div class="summary-line"><span class="summary-line-label">Devoluciones y cambios</span><span class="summary-line-value">${devolucionesHoy.length}</span></div>
      <div class="summary-line"><span class="summary-line-label">Ajuste neto por devoluciones</span><span class="summary-line-value">${money(totalVentasHoy-ventasHoy.reduce((total,venta)=>total+Number(venta.total||0),0))}</span></div>
      ${!gananciaCompleta?`<p class="section-note" style="margin:10px 0 0;">Completá los costos faltantes para ver una ganancia confiable: ${gananciaHoy.sinCosto.slice(0,3).map(escaparHTML).join(', ')}${gananciaHoy.sinCosto.length>3?' y más':''}.</p>`:''}
    </div>
    <div class="card">
      <div class="card-title">Turno y caja</div>
      ${turno ? `
        <p class="section-note" style="margin:-2px 0 8px;">Turno ${escaparHTML(turno.turno)} · abierto ${escaparHTML(turno.horaApertura||'')}</p>
        <div class="summary-line"><span class="summary-line-label">Cambio inicial</span><span class="summary-line-value">${money(turno.cambioInicial)}</span></div>
        <div class="summary-line"><span class="summary-line-label">Ventas en efectivo</span><span class="summary-line-value">${money(caja.efectivoVentas)}</span></div>
        <div class="summary-line"><span class="summary-line-label">Diferencias cobradas en efectivo</span><span class="summary-line-value">${money(caja.ingresosCambioEfectivo)}</span></div>
        <div class="summary-line"><span class="summary-line-label">Gastos</span><span class="summary-line-value">− ${money(caja.totalGastos)}</span></div>
        <div class="summary-line"><span class="summary-line-label"><b>Efectivo esperado</b></span><span class="summary-line-value"><b>${money(caja.efectivoEsperado)}</b></span></div>
      ` : `<p class="empty">No hay un turno abierto.</p><button class="btn small" onclick="goTab('turno')">Abrir turno</button>`}
    </div>
  </div>

  <div class="card summary-trend">
    <div class="card-title">Ventas netas · últimos 7 días</div>
    <p class="section-note" style="margin-bottom:4px;">Ventas menos devoluciones y diferencias de cambios.</p>
    ${renderGraficoVentasDiarias(fechaHoy)}
  </div>

  <div class="card">
    <div class="card-title">Stock agotado <button class="btn small ghost" onclick="goTab('stock')">Revisar stock</button></div>
    ${filasStock.length ? `<div class="summary-stock-list">${filasStock.map(({producto,variante})=>`
      <div class="summary-stock-item"><div><div class="summary-stock-name">${escaparHTML(producto.nombre)}</div><div class="summary-stock-meta">${escaparHTML([variante.talle,variante.color].filter(Boolean).join(' · ')||'Único')}</div></div><span class="pill low">0</span></div>
    `).join('')}</div>${agotadasTotal>filasStock.length?`<p class="section-note" style="margin:8px 0 0;">Y ${agotadasTotal-filasStock.length} variante(s) más.</p>`:''}`:'<p class="empty">No hay variantes agotadas.</p>'}
  </div>
  `;
}
