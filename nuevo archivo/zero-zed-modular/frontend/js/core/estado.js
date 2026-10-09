// [ZZ] core/estado.js — Estado global de la app (state), valores por defecto y variables de sesión/rol.
function defaultState(){
  return {
    config:{
      nombreLocal:"Zero Zed",
      debitoPct:10, creditoPct:20,
      categorias: DEFAULT_CATEGORIAS.slice(),
      pins: { admin:"1234", empleado:"0000" }
    },
    productos: [],
    promociones: [],
    ventas: [],
    turnos: [],
    compras: [],
    devoluciones: [],
    movimientos: [],
    etiquetasPendientes: {},
    etiquetasInicialesImpresas: false
  };
}
let state = defaultState();
state.etiquetasInicialesImpresas = true;

/* ---------- sesión / roles ---------- */
let session = null;
let loginRoleSel = null;
let loginPin = '';
let loginError = '';
