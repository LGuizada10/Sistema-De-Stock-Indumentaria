// [ZZ] modules/turno.js — Pestaña TURNO: apertura, gastos, cierre de caja.
/* =================== TURNO =================== */
let nuevoTurno = {turno: sugerirTurno(), cambioInicial:''};
let nuevoGasto = {desc:'', monto:''};
let cerrandoTurno = false;
let cambioFinalInput = '';

function renderTurno(){
  const t = turnoAbierto();
  const cerrados = state.turnos.filter(t=>!t.abierto).sort((a,b)=> (b.fecha+b.horaApertura).localeCompare(a.fecha+a.horaApertura)).slice(0,6);

  if(!t){
    return `
    <h2 class="section-title">Turno</h2>
    <p class="section-note">Abrí el turno indicando con cuánto cambio empezás la caja.</p>
    <div class="card">
      <div class="row">
        <div class="field">
          <label>Turno</label>
          <select onchange="nuevoTurno.turno=this.value">
            <option ${nuevoTurno.turno==='Mañana'?'selected':''}>Mañana</option>
            <option ${nuevoTurno.turno==='Tarde'?'selected':''}>Tarde</option>
          </select>
        </div>
        <div class="field">
          <label>Cambio inicial</label>
          <input type="number" min="0" placeholder="0" value="${nuevoTurno.cambioInicial}" oninput="nuevoTurno.cambioInicial=this.value">
        </div>
      </div>
      <button class="btn primary" onclick="abrirTurno()">Abrir turno</button>
    </div>
    ${renderTurnosCerrados(cerrados)}
    `;
  }

  const caja = resumenCajaDeTurno(t);
  const ventasTurno = caja.ventasTurno;
  const devolucionesTurno = state.devoluciones.filter(d=>d.turnoId===t.id);
  const porMetodo = {};
  METODOS.forEach(m=>porMetodo[m]=0);
  ventasTurno.forEach(v=>sumarVentaPorMetodo(porMetodo,v));
  devolucionesTurno.forEach(d=>aplicarAjusteDevolucionPorMetodo(porMetodo,d));
  const ajustesDevoluciones = devolucionesTurno.reduce((total,d)=>total+ajusteEconomicoDevolucion(d),0);
  const {efectivoVentas,totalGastos,ingresosCambioEfectivo,efectivoEsperado} = caja;

  return `
  <h2 class="section-title">Turno ${t.turno}</h2>
  <p class="section-note">Abierto a las ${t.horaApertura} · cambio inicial ${money(t.cambioInicial)}</p>

  ${session==='admin'?`<div class="turno-cash-hero">
    <div class="summary-kpi-label">Efectivo esperado en caja</div>
    <div class="summary-kpi-value">${money(efectivoEsperado)}</div>
    <div class="summary-kpi-note">Turno ${escaparHTML(t.turno)} · abierto ${escaparHTML(t.horaApertura||'')}</div>
    <details class="turno-cash-details">
      <summary>Ver detalle de caja</summary>
      <div class="summary-line"><span class="summary-line-label">Cambio inicial</span><span class="summary-line-value">${money(t.cambioInicial)}</span></div>
      <div class="summary-line"><span class="summary-line-label">Ventas en efectivo</span><span class="summary-line-value">${money(efectivoVentas)}</span></div>
      <div class="summary-line"><span class="summary-line-label">Diferencias cobradas en efectivo</span><span class="summary-line-value">${money(ingresosCambioEfectivo)}</span></div>
      <div class="summary-line"><span class="summary-line-label">Gastos</span><span class="summary-line-value">− ${money(totalGastos)}</span></div>
    </details>
  </div>`:''}

  <div class="grid2">
    <div class="card">
      <div class="card-title">Ventas del turno</div>
      ${METODOS.map(m=>`<div class="totalline"><span class="muted">${m}</span><span class="num">${money(porMetodo[m])}</span></div>`).join('')}
      <div class="totalline big"><span>Total neto</span><span class="num">${money(ventasTurno.reduce((total,v)=>total+Number(v.total||0),0)+ajustesDevoluciones)}</span></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Gastos del turno <span class="muted" style="font-weight:400;font-size:12px;">(compras chicas, viáticos, etc.)</span></div>
    ${t.gastos.length===0 ? '<p class="empty">Sin gastos registrados.</p>' : `
    <table><thead><tr><th>Hora</th><th>Descripción</th><th>Monto</th><th></th></tr></thead>
    <tbody>${t.gastos.map((g,idx)=>`<tr><td>${g.hora}</td><td>${g.desc}</td><td class="num">${money(g.monto)}</td><td>${session==='admin' ? `<button class="link-btn" onclick="quitarGasto('${t.id}',${idx})">quitar</button>` : ''}</td></tr>`).join('')}</tbody></table>`}
    <div class="row" style="margin-top:8px;">
      <div class="field" style="flex:2 1 160px;"><label>Descripción</label><input type="text" placeholder="Ej: galletitas" value="${nuevoGasto.desc}" oninput="nuevoGasto.desc=this.value"></div>
      <div class="field" style="flex:1 1 100px;"><label>Monto</label><input type="number" min="0" placeholder="0" value="${nuevoGasto.monto}" oninput="nuevoGasto.monto=this.value"></div>
      <div class="field" style="flex:0 0 auto;justify-content:flex-end;"><button class="btn small primary" onclick="agregarGasto('${t.id}')">Agregar gasto</button></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Cerrar turno</div>
    ${!cerrandoTurno ? `<button class="btn danger" onclick="cerrandoTurno=true; renderAll();">Cerrar turno</button>` : `
    <p class="section-note">Contá la caja y anotá cuánto efectivo hay realmente.</p>
    <div class="row">
      <div class="field" style="max-width:160px;"><label>Efectivo contado</label><input type="number" min="0" value="${cambioFinalInput}" oninput="cambioFinalInput=this.value"></div>
    </div>
    ${session === 'admin' ? `<p class="section-note">Esperado: ${money(efectivoEsperado)} ${cambioFinalInput!=='' ? '· Diferencia: ' + money(Number(cambioFinalInput)-efectivoEsperado) : ''}</p>` : ''}
    <button class="btn primary" onclick="cerrarTurno('${t.id}', ${efectivoEsperado})">Confirmar cierre</button>
    <button class="btn ghost" onclick="cerrandoTurno=false; renderAll();">Cancelar</button>
    `}
  </div>

  ${renderTurnosCerrados(cerrados)}
  `;
}

function renderTurnosCerrados(cerrados){
  if(!cerrados.length || session!=='admin') return '';
  return `
  <hr class="stitch">
  <h3 style="font-family:var(--font-display);font-weight:700;font-size:18px;margin:0 0 8px;">Turnos anteriores</h3>
  <table>
    <thead><tr><th>Fecha</th><th>Turno</th><th>Inicial</th><th>Contado</th><th>Diferencia</th><th>Gastos</th></tr></thead>
    <tbody>
      ${cerrados.map(t=>{
        const gastos = t.gastos.reduce((a,g)=>a+g.monto,0);
        const diff = (t.cambioFinal ?? 0) - (t.efectivoEsperado ?? 0);
        return `<tr>
          <td>${fmtDate(t.fecha)}</td><td>${t.turno}</td>
          <td class="num">${money(t.cambioInicial)}</td>
          <td class="num">${money(t.cambioFinal)}</td>
          <td class="num" style="color:${diff<0?'var(--brick)':diff>0?'var(--green)':'inherit'}">${money(diff)}</td>
          <td class="num">${money(gastos)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function abrirTurno(){
  if(turnoAbierto()){ showToast('Ya hay un turno abierto'); return; }
  state.turnos.push({
    id: uid(), fecha: todayStr(), turno: nuevoTurno.turno,
    cambioInicial: Number(nuevoTurno.cambioInicial)||0, cambioFinal:null,
    gastos: [], abierto:true, horaApertura: timeStr(), horaCierre:null, efectivoEsperado:null
  });
  registrarMovimiento('Turno abierto', nuevoTurno.turno+' · cambio inicial '+money(Number(nuevoTurno.cambioInicial)||0));
  save();
  nuevoTurno = {turno: sugerirTurno(), cambioInicial:''};
  showToast('Turno abierto');
  renderAll();
}
function agregarGasto(turnoId){
  if(!nuevoGasto.desc.trim() || !nuevoGasto.monto){ showToast('Completá descripción y monto'); return; }
  const t = state.turnos.find(t=>t.id===turnoId);
  t.gastos.push({desc:nuevoGasto.desc.trim(), monto:Number(nuevoGasto.monto)||0, hora:timeStr()});
  registrarMovimiento('Gasto agregado', nuevoGasto.desc.trim()+' · '+money(Number(nuevoGasto.monto)||0));
  save();
  nuevoGasto = {desc:'', monto:''};
  renderAll();
}
function quitarGasto(turnoId, idx){
  if(session!=='admin') return;
  const t = state.turnos.find(t=>t.id===turnoId);
  if(t.gastos[idx]) registrarMovimiento('Gasto quitado', t.gastos[idx].desc+' · '+money(t.gastos[idx].monto));
  t.gastos.splice(idx,1);
  save(); renderAll();
}
function cerrarTurno(turnoId, esperado){
  const t = state.turnos.find(t=>t.id===turnoId);
  t.abierto = false;
  t.cambioFinal = Number(cambioFinalInput)||0;
  t.efectivoEsperado = esperado;
  t.horaCierre = timeStr();
  registrarMovimiento('Turno cerrado', t.turno+' · contado '+money(t.cambioFinal)+' · esperado '+money(esperado)+' · diferencia '+money(t.cambioFinal-esperado));
  save();
  cerrandoTurno = false; cambioFinalInput='';
  showToast('Turno cerrado');
  renderAll();
}
