// [ZZ] modules/ajustes.js — Pestaña AJUSTES (admin): categorías, recargos, registro de movimientos.
/* =================== AJUSTES (solo admin) =================== */
let nuevaCategoria = '';

let movAbierto = false, movFiltro = 'todos', movCantidad = 100;
function cambiarRecargo(tipo, valor){
  const clave = tipo==='debito' ? 'debitoPct' : 'creditoPct';
  const antes = state.config[clave], nuevo = Number(valor)||0;
  state.config[clave] = nuevo;
  if(antes!==nuevo) registrarMovimiento('Recargo modificado', (tipo==='debito'?'Débito':'Crédito')+': '+antes+'% → '+nuevo+'%');
  save(); renderAll();
}
function cambiarNombreLocal(valor){
  const antes = state.config.nombreLocal;
  state.config.nombreLocal = valor;
  if(antes!==valor) registrarMovimiento('Nombre del local', '"'+antes+'" → "'+valor+'"');
  save(); renderAll();
}
async function vaciarRegistroMovimientos(){
  if(session!=='admin') return;
  if(!confirm('¿Vaciar todo el registro de movimientos? No se puede deshacer.')) return;
  try{
    await cola;
    const {error}=await sb.from('movimientos').delete().neq('id','');
    if(error) throw error;
    state.movimientos=[];
    snap.mov=new Set();
    movFiltro='todos';
    movCantidad=100;
    renderAll();
    showToast('Registro vaciado');
  }catch(e){
    console.error(e);
    showToast('No se pudo vaciar el registro: '+(e.message||e));
  }
}
function renderRegistroMovimientos(){
  if(session!=='admin') return '';
  const todos = (state.movimientos||[]).slice().reverse();
  const lista = movFiltro==='todos' ? todos : todos.filter(m=>m.rol===movFiltro);
  const visibles = lista.slice(0,movCantidad);
  const rolTxt = r => r==='admin' ? 'Admin' : r==='empleado' ? 'Empleado' : 'Sistema';
  return `
  <div class="card">
    <div class="card-title" style="cursor:pointer;" onclick="movAbierto=!movAbierto; renderAll();">
      <span>Registro de movimientos · ${todos.length}</span>
      <span class="muted" style="font-size:12px;">${movAbierto?'Ocultar':'Ver'}</span>
    </div>
    ${movAbierto ? `
    <p class="section-note" style="margin-top:-4px;">Solo lo ve el administrador. Muestra quién hizo cada cambio y cuándo. Se guardan los últimos ${MAX_MOVIMIENTOS} movimientos.</p>
    <div class="row" style="align-items:flex-end;margin-bottom:8px;">
      <div class="field" style="max-width:200px;">
        <label>Mostrar</label>
        <select onchange="movFiltro=this.value; movCantidad=100; renderAll();">
          <option value="todos" ${movFiltro==='todos'?'selected':''}>Todos</option>
          <option value="empleado" ${movFiltro==='empleado'?'selected':''}>Solo empleado</option>
          <option value="admin" ${movFiltro==='admin'?'selected':''}>Solo admin</option>
        </select>
      </div>
      <div class="field" style="flex:0 0 auto;"><button class="btn small ghost" onclick="vaciarRegistroMovimientos()" ${todos.length?'':'disabled'}>Vaciar registro</button></div>
    </div>
    ${visibles.length===0 ? '<p class="empty">Todavía no hay movimientos.</p>' : `
    <div data-scrollkey="movimientos" style="overflow-x:auto;max-height:420px;overflow-y:auto;">
      <table><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>
      ${visibles.map(m=>`<tr>
        <td class="num" style="white-space:nowrap;">${fmtDate(m.fecha)} ${m.hora}</td>
        <td><span class="pill ${m.rol==='empleado'?'mid':'ok'}">${rolTxt(m.rol)}</span></td>
        <td style="white-space:nowrap;">${escaparHTML(m.accion)}</td>
        <td>${escaparHTML(m.detalle)}</td>
      </tr>`).join('')}
      </tbody></table>
    </div>
    ${lista.length>visibles.length ? `<div style="margin-top:8px;"><button class="btn small ghost" onclick="movCantidad+=100; renderAll();">Ver más (${lista.length-visibles.length} restantes)</button></div>` : ''}`}` : ''}
  </div>`;
}

function renderAjustes(){
  return `
  <div class="settings-heading">
    <div><h2 class="section-title">Ajustes</h2><p class="section-note">Configuración del local, datos y administración.</p></div>
    <span class="settings-role">Solo administrador</span>
  </div>

  <div class="settings-grid">
    <section class="card settings-card">
      <div class="card-title">Datos del local</div>
      <div class="field"><label for="settingsStoreName">Nombre del local</label><input id="settingsStoreName" type="text" value="${escaparHTML(state.config.nombreLocal)}" onchange="cambiarNombreLocal(this.value)"></div>
    </section>

    <section class="card settings-card">
      <div class="card-title">Categorías</div>
      <div class="settings-categories">
        ${state.config.categorias.map(c=>`<span class="cat-chip">${escaparHTML(c)}<button type="button" onclick="eliminarCategoria('${c.replace(/'/g,"\\'")}')" aria-label="Eliminar categoría ${escaparHTML(c)}" title="Eliminar">×</button></span>`).join('')}
      </div>
      <div class="settings-actions">
        <div class="field" style="flex:1 1 180px;"><label for="settingsNewCategory">Nueva categoría</label><input id="settingsNewCategory" type="text" placeholder="Nombre de la categoría" value="${escaparHTML(nuevaCategoria)}" oninput="nuevaCategoria=this.value" onkeydown="if(event.key==='Enter') agregarCategoria();"></div>
        <button class="btn small primary" onclick="agregarCategoria()">Agregar</button>
      </div>
    </section>

    <section class="card settings-card">
      <div class="card-title">Recargos</div>
      <p class="section-note">Efectivo y Mercado Pago mantienen el precio base.</p>
      <div class="row">
        <div class="field"><label for="settingsDebit">Débito (%)</label><input id="settingsDebit" type="number" min="0" value="${state.config.debitoPct}" onchange="cambiarRecargo('debito',this.value)"></div>
        <div class="field"><label for="settingsCredit">Crédito (%)</label><input id="settingsCredit" type="number" min="0" value="${state.config.creditoPct}" onchange="cambiarRecargo('credito',this.value)"></div>
      </div>
    </section>

    <section class="card settings-card">
      <div class="card-title">Acceso al sistema</div>
      <p class="section-note">Las cuentas y contraseñas se administran desde Supabase Authentication.</p>
      <a class="btn small ghost" href="https://supabase.com/dashboard/project/ndexfoslbshazovtziza/auth/users" target="_blank" rel="noopener">Administrar usuarios</a>
    </section>

    <section class="card settings-card">
      <div class="card-title">Copia de seguridad</div>
      <p class="section-note">Los datos operativos se sincronizan con Supabase. El JSON sirve como respaldo adicional. Última copia: <b>${state.config.ultimoRespaldo ? fmtDate(state.config.ultimoRespaldo)+' · hace '+diasDesde(state.config.ultimoRespaldo)+' día(s)' : 'nunca'}</b>.</p>
      <div class="settings-actions">
        <button class="btn small" onclick="exportarDatos()">Descargar JSON</button>
        <label class="btn small ghost" style="cursor:pointer;">Importar JSON<input type="file" accept="application/json" style="display:none;" onchange="importarDatos(event)"></label>
      </div>
    </section>

    <section class="card settings-card">
      <div class="card-title">Stock por planilla</div>
      <p class="section-note">Exportá el inventario o importá una planilla. Se conserva la columna Codigo.</p>
      <div class="settings-actions">
        <button class="btn small" onclick="exportarStockExcel()">Descargar Excel</button>
        <label class="btn small ghost" style="cursor:pointer;">Importar Excel<input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" style="display:none;" onchange="importarStockExcel(event)"></label>
      </div>
      <p class="section-note" style="margin:10px 0 0;">Columnas: Producto, Categoría, Descripción, Código, Talle, Color, Costo, Precio y Stock.</p>
    </section>
  </div>

  <div class="settings-audit">${renderRegistroMovimientos()}</div>

  <section class="card settings-card settings-danger">
    <div class="card-title">Zona de riesgo</div>
    <p class="section-note">Esta acción elimina productos, ventas, turnos, compras y solicitudes de factura de forma permanente.</p>
    <button class="btn small danger" onclick="borrarTodo()">Borrar todos los datos</button>
  </section>
  `;
}

function agregarCategoria(){
  const val = nuevaCategoria.trim();
  if(!val) return;
  if(state.config.categorias.some(c=>c.toLowerCase()===val.toLowerCase())){ showToast('Esa categoría ya existe'); return; }
  state.config.categorias.push(val);
  registrarMovimiento('Categoría agregada', val);
  save();
  nuevaCategoria = '';
  renderAll();
}
function eliminarCategoria(cat){
  const enUso = state.productos.some(p=>p.categoria===cat);
  const msg = enUso ? 'Hay productos cargados en esta categoría; van a quedar sin categoría asignada. ¿Eliminar igual?' : '¿Eliminar esta categoría?';
  if(!confirm(msg)) return;
  registrarMovimiento('Categoría eliminada', cat);
  state.config.categorias = state.config.categorias.filter(c=>c!==cat);
  save();
  renderAll();
}
