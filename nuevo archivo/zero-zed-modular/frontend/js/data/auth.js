// [ZZ] data/auth.js — CAPA DE DATOS: inicio y cierre de sesión con Supabase Auth.
let loginEmail = '', loginPass = '', nubeCargando = false, ventaEnCurso = false;
async function entrarConSesion(userId){
  const {data:pf,error} = await sb.from('perfiles').select('rol').eq('id',userId).single();
  if(error||!pf) throw new Error('Tu usuario no tiene perfil. Avisale al administrador.');
  session = pf.rol;
  currentTab = session==='admin' ? 'resumen' : 'vender';
  masAbierto = false;
  await cargarTodo();
}
async function iniciarSesion(){
  if(nubeCargando) return;
  nubeCargando = true; loginError = ''; renderAll();
  try{
    const {data,error} = await sb.auth.signInWithPassword({email:loginEmail.trim(), password:loginPass});
    if(error) throw new Error('Mail o contraseña incorrectos');
    await entrarConSesion(data.user.id);
    registrarMovimiento('Inicio de sesión','Ingresó como '+(session==='admin'?'Administrador':'Empleado'),{guardar:true});
    loginPass = '';
    if(session==='empleado' && (currentTab==='compras' || currentTab==='ajustes')) currentTab='vender';
  }catch(e){ session = null; loginError = e.message||String(e); }
  nubeCargando = false; renderAll();
}
async function cerrarSesion(){
  registrarMovimiento('Cierre de sesión','');
  await sincronizar();
  await sb.auth.signOut();
  session = null; historialDesde = null; facturas = []; facReq = false; facConsent = false; facDatos = {nombre:'', tipo:'DNI', doc:'', email:'', tel:'', dom:''}; facSel.clear(); state = defaultState(); state.etiquetasInicialesImpresas = true;
  snap = {mov:new Set(), cfg:null}; currentTab = 'vender';
  renderAll();
}
