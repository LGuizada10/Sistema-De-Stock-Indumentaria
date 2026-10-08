// [ZZ] core/dominio.js — Reglas de negocio compartidas: pagos de una venta, registro de movimientos, turno abierto, ventas por día.
/* Una venta puede pagarse con uno o dos métodos. Ventas viejas: solo metodoPago + total. */
function pagosDeVenta(v){
  if(Array.isArray(v.pagos) && v.pagos.length) return v.pagos;
  return [{metodo:v.metodoPago, monto:Number(v.total)||0}];
}
function montoEfectivoDeVenta(v){ return pagosDeVenta(v).filter(p=>p.metodo==='Efectivo').reduce((t,p)=>t+Number(p.monto||0),0); }
function sumarVentaPorMetodo(porMetodo, v){ pagosDeVenta(v).forEach(p=>{ if(porMetodo[p.metodo]!=null) porMetodo[p.metodo] += Number(p.monto||0); }); }
function etiquetaPagosDetalle(v){
  const pg = pagosDeVenta(v);
  return pg.length>1 ? pg.map(p=>p.metodo+' '+money(p.monto)).join(' + ') : (v.metodoPago||pg[0].metodo);
}

function registrarMovimiento(accion, detalle, opts){
  opts = opts || {};
  if(!Array.isArray(state.movimientos)) state.movimientos = [];
  state.movimientos.push({id:uid(), fecha:todayStr(), hora:timeStr(), rol:opts.rol || session || 'sistema', accion, detalle:detalle||''});
  if(state.movimientos.length>MAX_MOVIMIENTOS) state.movimientos.splice(0, state.movimientos.length-MAX_MOVIMIENTOS);
  if(opts.guardar) save();
}
function etiquetaVariante(v){ return [v.talle,v.color].filter(x=>x&&x!=='-').join(' / ') || 'Único'; }
function turnoAbierto(){ return state.turnos.find(t=>t.abierto); }
function resumenCajaDeTurno(turno){
  const ventasTurno=state.ventas.filter(venta=>venta.turnoId===turno.id);
  const efectivoVentas=ventasTurno.reduce((total,venta)=>total+montoEfectivoDeVenta(venta),0);
  const totalGastos=(turno.gastos||[]).reduce((total,gasto)=>total+Number(gasto.monto||0),0);
  const ingresosCambioEfectivo=(turno.ingresosCambio||[]).reduce((total,ingreso)=>total+Number(ingreso.monto||0),0);
  const efectivoEsperado=(Number(turno.cambioInicial)||0)+efectivoVentas+ingresosCambioEfectivo-totalGastos;
  return {ventasTurno,efectivoVentas,totalGastos,ingresosCambioEfectivo,efectivoEsperado};
}
function ventasDe(fecha){ return state.ventas.filter(v=>v.fecha===fecha); }
function fechaSumandoDias(fecha, dias){
  const d = new Date(fecha+'T12:00:00');
  d.setDate(d.getDate()+dias);
  return fechaLocalStr(d);
}
function totalNetoDeFecha(fecha){
  const ventas = ventasDe(fecha).reduce((total,v)=>total+Number(v.total||0),0);
  const ajustes = state.devoluciones.filter(d=>d.fecha===fecha).reduce((total,d)=>total+ajusteEconomicoDevolucion(d),0);
  return ventas+ajustes;
}
