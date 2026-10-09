// [ZZ] ui/navegacion.js — Navegación por pestañas (barra superior y menú "Más").
/* ---------- navegación ---------- */
let currentTab = 'vender';
const ALL_TABS = [
  {id:'resumen', label:'Resumen', roles:['admin']},
  {id:'turno', label:'Turno', roles:['admin','empleado']},
  {id:'vender', label:'Vender', roles:['admin','empleado']},
  {id:'stock', label:'Stock', roles:['admin','empleado']},
  {id:'devoluciones', label:'Devoluciones', roles:['admin','empleado']},
  {id:'historial', label:'Historial', roles:['admin','empleado']},
  {id:'facturas', label:'Facturas', roles:['admin']},
  {id:'compras', label:'Compras', roles:['admin']},
  {id:'promociones', label:'Promociones', roles:['admin']},
  {id:'ajustes', label:'Ajustes', roles:['admin']}
];
function tabsPermitidas(){ return ALL_TABS.filter(t=>t.roles.includes(session)); }
let masAbierto = false;
const NAV_PRINCIPAL = ['resumen','vender','stock','turno','devoluciones'];
let navMobileMode=null;
function renderNav(){
  const nav = document.getElementById('tabsNav');
  if(!session){ nav.innerHTML=''; return; }
  const mobile=window.matchMedia('(max-width:600px)').matches;
  navMobileMode=mobile;
  const ts = tabsPermitidas(), principal=mobile?(session==='admin'?['resumen','vender','stock']:['vender','turno','stock']):NAV_PRINCIPAL;
  const pri = principal.map(id=>ts.find(t=>t.id===id)).filter(Boolean), mas = ts.filter(t=>!principal.includes(t.id));
  const btn = t=>`<button type="button" data-tab="${t.id}" class="${t.id===currentTab?'active':''}" onclick="masAbierto=false; goTab('${t.id}')"><span>${t.label}</span></button>`;
  const menuMas = masAbierto ? `<div class="nav-more-menu" role="menu">${mas.map(t=>`<button type="button" role="menuitem" class="${t.id===currentTab?'active':''}" onclick="masAbierto=false; goTab('${t.id}')">${t.label}</button>`).join('')}</div>` : '';
  nav.innerHTML = pri.map(btn).join('') + (mas.length ? `<div class="nav-more-wrap"><button type="button" aria-expanded="${masAbierto}" class="${mas.some(t=>t.id===currentTab)?'active':''}" onclick="masAbierto=!masAbierto; renderNav()"><span>Más ${masAbierto?'▴':'▾'}</span></button>${menuMas}</div>` : '');
}
document.addEventListener('click', event=>{
  if(masAbierto && !event.target.closest('.nav-more-wrap')){ masAbierto=false; renderNav(); }
});
document.addEventListener('keydown', event=>{
  if(event.key==='Escape' && masAbierto){
    masAbierto=false;
    renderNav();
    document.querySelector('#tabsNav .nav-more-wrap > button')?.focus();
  }
});
window.addEventListener('resize',()=>{
  const mobile=window.matchMedia('(max-width:600px)').matches;
  if(navMobileMode!==null&&mobile!==navMobileMode){masAbierto=false;renderNav();}
});
