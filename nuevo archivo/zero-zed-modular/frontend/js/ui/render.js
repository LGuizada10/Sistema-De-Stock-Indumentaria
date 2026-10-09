// [ZZ] ui/render.js — Render principal (renderAll): decide qué pestaña dibujar y conserva scroll/foco.
let ultimaVistaRenderizada = '';
function capturarScrolls(){
  const m = {};
  document.querySelectorAll('[data-scrollkey]').forEach(el=>{ m[el.dataset.scrollkey] = el.scrollTop; });
  return {y: window.scrollY, m};
}
function restaurarScrolls(snap){
  document.querySelectorAll('[data-scrollkey]').forEach(el=>{
    const v = snap.m[el.dataset.scrollkey];
    if(v!=null) el.scrollTop = v;
  });
  window.scrollTo(0, snap.y);
}
function renderAll(){
  const snapScroll = capturarScrolls();
  const vistaActual = (session||'')+'|'+currentTab;
  const focusSnapshot = isIOSBrowser() ? getFocusableTarget() : null;
  const appEl = document.getElementById('app');
  const overlay = document.getElementById('receiptOverlay');
  if(printVentaId){
    if(appEl.style.display!=='none') receiptScrollY = window.scrollY;
    appEl.style.display = 'none';
    overlay.style.display = 'block';
    overlay.innerHTML = renderRecibo(printVentaId);
    return;
  }
  appEl.style.display = '';
  overlay.style.display = 'none';
  overlay.innerHTML = '';

  renderHeader();
  renderNav();
  const c = document.getElementById('content');
  if(!session){ c.innerHTML = renderLogin(); afterRenderHooks(); restoreFocusableTarget(focusSnapshot); restoreReceiptScroll(); return; }
  const permitido = tabsPermitidas().some(t=>t.id===currentTab);
  if(!permitido) currentTab = 'vender';
  if(currentTab==='vender') c.innerHTML = renderVender();
  else if(currentTab==='resumen') c.innerHTML = renderResumenAdmin();
  else if(currentTab==='stock') c.innerHTML = renderStock();
  else if(currentTab==='turno') c.innerHTML = renderTurno();
  else if(currentTab==='historial') c.innerHTML = renderHistorial();
  else if(currentTab==='facturas') c.innerHTML = renderFacturas();
  else if(currentTab==='devoluciones') c.innerHTML = renderDevoluciones();
  else if(currentTab==='compras') c.innerHTML = renderCompras();
  else if(currentTab==='promociones') c.innerHTML = renderPromociones();
  else if(currentTab==='ajustes') c.innerHTML = renderAjustes();
  if(session==='admin') c.innerHTML = renderAvisosAdmin() + c.innerHTML;
  if(ultimaVistaRenderizada!==vistaActual&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){c.classList.remove('view-enter');void c.offsetWidth;c.classList.add('view-enter');}
  if(currentTab==='vender') animarTotalPago();
  afterRenderHooks();
  if(ultimaVistaRenderizada===vistaActual) restaurarScrolls(snapScroll); else window.scrollTo(0,0);
  ultimaVistaRenderizada = vistaActual;
  restoreFocusableTarget(focusSnapshot);
  restoreReceiptScroll();
}

function afterRenderHooks(){ mejorarAccesibilidad(); if(session && currentTab==='vender' && !window.matchMedia('(pointer: coarse)').matches && document.activeElement===document.body){ const i=document.querySelector('[data-search="venta"]'); if(i) i.focus(); } }
