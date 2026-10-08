// [ZZ] ui/aviso-almacenamiento.js — Aviso informativo sobre el almacenamiento del navegador (sesión y tema) con enlace a la política.
/* El sistema SOLO usa almacenamiento esencial (sesión, tema, dato del contador). No hay analítica ni publicidad,
   por eso el aviso es informativo y no ofrece "rechazar". Si algún día se suma analítica o píxeles de terceros
   (por ejemplo con Tiendanube), hace falta un consentimiento real con opción de rechazar ANTES de cargarlos. */
const AVISO_ALMACENAMIENTO_KEY = 'zz_aviso_almacenamiento_v1';
(function(){
  const aviso = document.getElementById('avisoAlmacenamiento');
  if(!aviso) return;
  let visto = false;
  try{ visto = localStorage.getItem(AVISO_ALMACENAMIENTO_KEY)==='1'; }catch(e){}
  if(visto) return;
  aviso.hidden = false;
  document.getElementById('avisoAlmacenamientoOk').addEventListener('click', ()=>{
    try{ localStorage.setItem(AVISO_ALMACENAMIENTO_KEY,'1'); }catch(e){}
    aviso.hidden = true;
  });
})();
