// [ZZ] ui/avisos.js — Avisos al administrador (PIN débil, recordatorio de copia de seguridad).
const PINS_DEBILES = ['1234','0000','1111','2222','4321','1212','1010'];
function esPinDebil(pin){ return PINS_DEBILES.includes(String(pin)); }
function diasDesde(fecha){ return Math.floor((new Date(todayStr()+'T12:00:00') - new Date(fecha+'T12:00:00'))/86400000); }
function cambiarPin(rol, valor){
  valor = String(valor).trim();
  const otro = rol==='admin' ? 'empleado' : 'admin';
  let error = '';
  if(!/^\d{4,8}$/.test(valor)) error = 'El PIN debe tener entre 4 y 8 números';
  else if(esPinDebil(valor)) error = 'Ese PIN es muy fácil de adivinar, elegí otro';
  else if(valor===state.config.pins[otro]) error = 'El PIN de admin y el de empleado no pueden ser iguales';
  if(error){ showToast(error); renderAll(); return; }
  state.config.pins[rol] = valor;
  registrarMovimiento('PIN cambiado','Se cambió el PIN de '+(rol==='admin'?'Administrador':'Empleado'));
  save();
  showToast('PIN actualizado');
  renderAll();
}
function posponerAvisoRespaldo(){
  state.config.respaldoPospuestoHasta = fechaSumandoDias(todayStr(), 2);
  save();
  renderAll();
}
function renderAvisosAdmin(){
  if(session!=='admin') return '';
  let h = '';
  const estilo = 'border-color:var(--warn);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:10px;';
  const hayDatos = false;
  const ult = state.config.ultimoRespaldo;
  const pospuesto = state.config.respaldoPospuestoHasta && todayStr() < state.config.respaldoPospuestoHasta;
  if(hayDatos && !pospuesto && (!ult || diasDesde(ult)>=7)){
    h += `<div class="card" style="${estilo}">
      <span>⚠ ${ult ? 'Hace '+diasDesde(ult)+' días que no descargás una copia de seguridad.' : 'Todavía no descargaste ninguna copia de seguridad.'} Los datos están solo en este dispositivo.</span>
      <span style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn small primary" onclick="exportarDatos(); renderAll();">Descargar copia ahora</button>
        <button class="btn small ghost" onclick="posponerAvisoRespaldo()">Recordármelo en 2 días</button>
      </span>
    </div>`;
  }
  const pins = state.config.pins||{};
  const debiles = [];
  if(debiles.length){
    h += `<div class="card" style="${estilo}">
      <span>⚠ El PIN de ${debiles.join(' y ')} es fácil de adivinar. Cambialo por uno propio.</span>
      <button class="btn small primary" onclick="goTab('ajustes')">Cambiar PIN</button>
    </div>`;
  }
  return h;
}
