// [ZZ] modules/login.js — Pantalla de login.
/* =================== LOGIN =================== */
function renderLogin(){
  if(nubeCargando) return `<div class="login-wrap"><div class="login-card" role="status" aria-label="Cargando acceso"><div class="loading-skeleton title"></div><div class="loading-skeleton"></div><div class="loading-skeleton field"></div><div class="loading-skeleton field"></div><div class="loading-skeleton button"></div></div></div>`;
  return `
  <div class="login-wrap">
    <div class="login-card">
      <h2 class="section-title" style="margin-bottom:4px;">Entrar</h2>
      <p class="section-note">Ingresá con tu mail y contraseña.</p>
      <div class="field"><input type="email" autocomplete="username" placeholder="Mail" value="${loginEmail}" oninput="loginEmail=this.value"></div>
      <div class="field"><input type="password" autocomplete="current-password" placeholder="Contraseña" value="${loginPass}" oninput="loginPass=this.value" onkeydown="if(event.key==='Enter') iniciarSesion();"></div>
      ${loginError ? `<p style="color:var(--brick);font-size:12.5px;margin:-4px 0 10px;">${loginError}</p>` : ''}
      <button class="btn primary role-btn" onclick="iniciarSesion()">Ingresar</button>
    </div>
  </div>`;
}
