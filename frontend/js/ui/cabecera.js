// [ZZ] ui/cabecera.js — Cabecera: menú móvil, cambio de tema claro/oscuro, estado del turno.
function toggleHeaderTools(){
  const wrapper=document.getElementById('mobileTools');
  if(!wrapper)return;
  const open=wrapper.classList.toggle('open');
  wrapper.querySelector('.mobile-tools-toggle').setAttribute('aria-expanded',String(open));
}
document.addEventListener('click',event=>{
  const wrapper=document.getElementById('mobileTools');
  if(wrapper&&!wrapper.contains(event.target)){
    wrapper.classList.remove('open');
    wrapper.querySelector('.mobile-tools-toggle').setAttribute('aria-expanded','false');
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    const wrapper=document.getElementById('mobileTools');
    if(wrapper&&wrapper.classList.contains('open')){wrapper.classList.remove('open');wrapper.querySelector('.mobile-tools-toggle').setAttribute('aria-expanded','false');wrapper.querySelector('.mobile-tools-toggle').focus();}
  }
});
function goTab(id){ currentTab = id; masAbierto=false; if(id==='facturas') cargarFacturas(); renderAll(); if(id==='historial' && session==='admin') asegurarHistorialDesde(mesesParaGrafico()); }
function toggleTheme(){
  const theme = document.documentElement.dataset.theme==='light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY,theme);
  renderHeader();
}

function renderHeader(){
  document.getElementById('storeName').textContent = (state.config.nombreLocal || 'Zero Zed').toUpperCase();
  const hoy = todayStr();
  document.getElementById('dateLine').textContent = session ? (fmtDate(hoy) + ' · ' + ventasDe(hoy).length + ' venta(s) hoy · total neto ' + money(totalNetoDeFecha(hoy))) : 'Control de stock y ventas';
  const themeToggle = document.getElementById('themeToggle');
  const isDark = document.documentElement.dataset.theme!=='light';
  themeToggle.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${isDark?'☼':'☾'}</span><span>${isDark?'Modo claro':'Modo oscuro'}</span>`;
  themeToggle.setAttribute('aria-label',isDark?'Cambiar al modo claro':'Cambiar al modo oscuro');
  themeToggle.querySelector('span:last-child').textContent=isDark?'Modo claro':'Modo oscuro';
  setSync(estadoSync);
  const t = turnoAbierto();
  const tag = document.getElementById('statusTag');
  const logoutBtn = document.getElementById('logoutBtn');
  if(!session){ tag.innerHTML=''; logoutBtn.style.display='none'; return; }
  logoutBtn.style.display='flex';
  logoutBtn.textContent = 'Salir (' + (session==='admin'?'Admin':'Empleado') + ')';
  if(t){
    tag.className='status-tag';
    tag.innerHTML = `<span>Turno abierto</span><b>${t.turno}</b>`;
  }else{
    tag.className='status-tag off';
    tag.innerHTML = `<span>Sin turno</span><b>Cerrado</b>`;
  }
}
