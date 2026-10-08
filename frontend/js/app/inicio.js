// [ZZ] app/inicio.js — ARRANQUE de la app: restaurar sesión, refresco automático, tema y llamada a arrancar().
async function arrancar(){
  nubeCargando = true; renderAll();
  try{
    const {data} = await sb.auth.getSession();
    if(data.session) await entrarConSesion(data.session.user.id);
  }catch(e){ session = null; loginError = e.message||String(e); }
  nubeCargando = false; renderAll();
}
/* Actualiza los datos al volver a la app (o cada minuto) para ver lo que pasó en otros dispositivos */
async function refrescar(){
  const a = document.activeElement;
  if(!session || printVentaId || nubeCargando || ventaEnCurso || (a && ['INPUT','SELECT','TEXTAREA'].includes(a.tagName))) return;
  if(historialDesde && currentTab!=='historial' && currentTab!=='devoluciones') historialDesde = null;   /* volver a la carga liviana */
  try{ await cola; await cargarTodo(); renderAll(); }catch(e){ console.error(e); }
}
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refrescar(); });
setInterval(refrescar, 60000);

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
document.documentElement.dataset.theme = savedTheme==='light' ? 'light' : 'dark';
arrancar();
