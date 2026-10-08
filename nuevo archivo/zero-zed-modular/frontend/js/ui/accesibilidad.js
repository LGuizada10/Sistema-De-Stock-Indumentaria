// [ZZ] ui/accesibilidad.js — Accesibilidad: etiquetas asociadas a cada campo, elementos clickeables operables con teclado.
/* Se ejecuta después de cada renderAll() (ver afterRenderHooks en ui/render.js).
   No cambia el diseño ni el comportamiento: solo agrega atributos ARIA para lectores de pantalla y teclado. */
let a11yContador = 0;
function a11yTieneNombre(c){
  return !!(c.getAttribute('aria-label') || c.getAttribute('aria-labelledby') || c.title ||
    (c.id && document.querySelector('label[for="'+c.id+'"]')) || c.closest('label'));
}
function a11yTexto(el){ return (el && el.textContent || '').replace(/\s+/g,' ').trim(); }
function mejorarAccesibilidad(){
  const raiz = document.getElementById('content');
  if(!raiz) return;
  // 1) Cada campo toma su nombre de la etiqueta (<label>) que lo precede dentro del mismo bloque.
  raiz.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(c=>{
    if(a11yTieneNombre(c)) return;
    let ancestro = c.parentElement, etiqueta = null;
    for(let nivel=0; ancestro && ancestro!==raiz && nivel<3 && !etiqueta; nivel++, ancestro=ancestro.parentElement){
      const candidatas = [...ancestro.querySelectorAll('label')].filter(l=>!l.htmlFor && !l.querySelector('input,select,textarea') && (l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
      if(candidatas.length) etiqueta = candidatas[candidatas.length-1];
    }
    if(etiqueta){
      if(!etiqueta.id) etiqueta.id = 'a11y-lbl-'+(++a11yContador);
      c.setAttribute('aria-labelledby', etiqueta.id);
    }else if(c.placeholder){
      c.setAttribute('aria-label', c.placeholder);
    }
  });
  // 2) Elementos con onclick que no son botones: se pueden enfocar y activar con Enter o Espacio.
  raiz.querySelectorAll('[onclick]').forEach(e=>{
    if(['BUTTON','A','INPUT','SELECT','SUMMARY','LABEL'].includes(e.tagName) || e.getAttribute('role')) return;
    e.setAttribute('role','button');
    e.tabIndex = 0;
    if(!e.getAttribute('aria-label') && e.title) e.setAttribute('aria-label', e.title);
  });
}
document.addEventListener('keydown', ev=>{
  const e = ev.target;
  if(!e || e.getAttribute('role')!=='button' || ['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(e.tagName)) return;
  if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); e.click(); }
});
