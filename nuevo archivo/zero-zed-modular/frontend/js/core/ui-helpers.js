// [ZZ] core/ui-helpers.js — Ayudas de interfaz: detección iOS, conservar foco y scroll al re-renderizar.
function isIOSBrowser(){
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getFocusableTarget(){
  const el = document.activeElement;
  if(!el || !['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return null;
  const key = el.id || el.getAttribute('data-search') || el.getAttribute('data-dev-manual-search') || el.getAttribute('data-compras-lugar') || el.name || null;
  if(!key) return null;
  const start = typeof el.selectionStart === 'number' ? el.selectionStart : null;
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : null;
  return { key, start, end };
}

function restoreFocusableTarget(snapshot){
  if(!snapshot || !snapshot.key) return;
  const selector = document.getElementById(snapshot.key)
    || document.querySelector(`[data-search="${snapshot.key}"]`)
    || document.querySelector(`[data-dev-manual-search="${snapshot.key}"]`)
    || document.querySelector(`[data-compras-lugar="${snapshot.key}"]`)
    || document.querySelector(`[name="${snapshot.key}"]`);
  if(!selector) return;
  requestAnimationFrame(()=>{
    selector.focus();
    if(typeof selector.setSelectionRange === 'function' && typeof snapshot.start === 'number' && typeof snapshot.end === 'number'){
      selector.setSelectionRange(snapshot.start, snapshot.end);
    }
  });
}

let receiptScrollY = null;
function restoreReceiptScroll(){
  if(receiptScrollY===null) return;
  const scrollY = receiptScrollY;
  receiptScrollY = null;
  requestAnimationFrame(()=>window.scrollTo(0,scrollY));
}
