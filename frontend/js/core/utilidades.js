// [ZZ] core/utilidades.js — Utilidades generales: descargas, ids, dinero, fechas (zona horaria Argentina), toasts, escape de HTML, normalizar claves.
let downloadsCap = null;
(async()=>{
  try{
    if(window.claude && typeof window.claude.use === 'function'){
      downloadsCap = await window.claude.use('downloads');
    }
  }catch(e){ downloadsCap = null; }
})();

async function descargarArchivo(filename, contenido, mime){
  if(downloadsCap){
    try{
      const res = await downloadsCap.save({filename, data: contenido});
      showToast(res.status==='saved' ? 'Archivo guardado' : 'Archivo enviado');
      return;
    }catch(err){
      if(err && err.code==='declined'){ showToast('Guardado cancelado'); return; }
      if(err && err.code==='rate_limited'){ showToast('Esperá un segundo y probá de nuevo'); return; }
    }
  }
  try{
    const blob = new Blob([contenido], {type: mime || 'application/octet-stream'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    showToast('Archivo descargado');
  }catch(e){
    showToast('No se pudo descargar el archivo');
  }
}
function uid(){ return 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function money(n){ n = Number(n)||0; return '$' + n.toLocaleString('es-AR',{minimumFractionDigits:0, maximumFractionDigits:0}); }
function fechaLocalStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function partesAhora(){
  const o = {};
  new Intl.DateTimeFormat('en-CA',{timeZone:ZONA_HORARIA,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date()).forEach(p=>{ o[p.type]=p.value; });
  return o;
}
function todayStr(){ const o=partesAhora(); return o.year+'-'+o.month+'-'+o.day; } // siempre fecha de Buenos Aires
function timeStr(){ const o=partesAhora(); return o.hour+':'+o.minute; } // siempre hora de Buenos Aires
function fmtDate(s){ const [y,m,d]=s.split('-'); return d+'/'+m+'/'+y; }
function sugerirTurno(){ return Number(partesAhora().hour) < 15 ? 'Mañana' : 'Tarde'; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}
function escaparHTML(valor){
  return String(valor??'').replace(/[&<>"']/g,caracter=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[caracter]));
}
function normalizarClave(texto){
  return (texto||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
}
