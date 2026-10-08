// [ZZ] core/vendor-check.js — Avisa con un cartel claro si faltan las librerías locales (frontend/vendor/).
(function(){
  const faltan = [];
  if(typeof XLSX==='undefined') faltan.push('xlsx.full.min.js');
  if(!(window.jspdf||window.jsPDF)) faltan.push('jspdf.umd.min.js');
  if(typeof supabase==='undefined') faltan.push('supabase.min.js');
  if(!faltan.length) return;
  const d = document.createElement('div');
  d.setAttribute('role','alert');
  d.style.cssText='position:fixed;inset:0;z-index:9999;background:#0A0C0A;color:#F3F6F1;display:grid;place-items:center;padding:24px;font:16px/1.5 sans-serif;text-align:center;';
  d.innerHTML='<div style="max-width:460px"><h2>Faltan las librerías del programa</h2><p>No se encontró en <b>frontend/vendor/</b>: '+faltan.join(', ')+'.</p><p>Ejecutá <b>descargar-librerias.bat</b> (Windows) o <b>descargar-librerias.sh</b> (Mac/Linux) una vez, con internet, y recargá la página.</p></div>';
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(d));
  if(document.body) document.body.appendChild(d);
})();
