// [ZZ] modules/promociones.js — Ofertas por categoría y cálculo de precios para ventas.
let promoNombreDraft = '';
let promoCategoriasDraft = [];
let promoProductosDraft = [];
let promoModoDraft = 'categoria';
let promoBusquedaDraft = '';
let promoCatalogoEstado = 'pendiente';
let promoCatalogoError = '';
let promoNivelesDraft = [{cant:1,precio:''},{cant:2,precio:''}];
let promoDesdeDraft = '', promoHastaDraft = '';

function promoFechaActiva(p, fecha=todayStr()){
  return p.activa!==false && (!p.fecha_desde || p.fecha_desde<=fecha) && (!p.fecha_hasta || p.fecha_hasta>=fecha);
}
function promoFechasSeCruzan(a,b){
  return (!a.fecha_hasta||!b.fecha_desde||a.fecha_hasta>=b.fecha_desde)
    &&(!b.fecha_hasta||!a.fecha_desde||b.fecha_hasta>=a.fecha_desde);
}
function promoVigentePara(producto, fecha=todayStr()){
  return (state.promociones||[]).filter(p=>promoFechaActiva(p,fecha)
    && ((p.productos_ids||[]).includes(producto.id) || (p.categorias||[]).includes(producto.categoria)))
    .sort((a,b)=>String(a.creado_en||'').localeCompare(String(b.creado_en||'')))[0]||null;
}
function promoPrecioUnidades(regulares, niveles){
  const n=regulares.length;
  if(!n) return [];
  const packs=new Map();
  (niveles||[]).forEach(x=>{
    const cant=Math.floor(Number(x.cant)), precio=Math.round(Number(x.precio));
    if(cant>=1 && cant<=50 && precio>=0) packs.set(cant,Math.min(packs.get(cant)??Infinity,precio));
  });
  const base=regulares.map(Math.round), costoUnit=base.map(x=>packs.has(1)?Math.min(x,packs.get(1)):x);
  const pref=[0], best=[0], bloque=[0];
  for(let i=0;i<n;i++) pref[i+1]=pref[i]+costoUnit[i];
  for(let i=1;i<=n;i++){
    best[i]=best[i-1]+costoUnit[i-1]; bloque[i]=1;
    for(let k=2;k<=Math.min(i,50);k++) if(packs.has(k)){
      const sum=pref[i]-pref[i-k], candidato=best[i-k]+Math.min(packs.get(k),sum);
      if(candidato<best[i]){best[i]=candidato;bloque[i]=k;}
    }
  }
  const result=Array(n).fill(0);
  for(let i=n;i>0;){
    const k=bloque[i], sum=pref[i]-pref[i-k];
    if(k===1) result[i-1]=costoUnit[i-1];
    else{
      const total=Math.min(packs.get(k),sum); let asignado=0;
      for(let j=i-k;j<i-1;j++){
        const valor=sum>0?Math.floor((2*total*costoUnit[j]+sum)/(2*sum)):0;
        result[j]=Math.min(valor,total-asignado); asignado+=result[j];
      }
      result[i-1]=total-asignado;
    }
    i-=k;
  }
  return result;
}
function recalcularPreciosPromoCarrito(){
  if(!Array.isArray(cart)) return;
  const grupos=new Map(); let orden=0;
  cart.forEach(item=>{
    const p=productoPorId(item.productoId), promo=p&&promoVigentePara(p);
    const base=Math.round(Number(item.precioListaUnit??item.precioUnit)||0);
    item.precioListaUnit=base; item.precioUnit=base; item.promoAplicada=null;
    if(!promo) return;
    if(!grupos.has(promo.id)) grupos.set(promo.id,{promo,unidades:[]});
    for(let q=0;q<item.cantidad;q++) grupos.get(promo.id).unidades.push({item,base,orden:orden++});
  });
  grupos.forEach(g=>{
    const unidades=g.unidades.slice().sort((a,b)=>b.base-a.base||a.orden-b.orden);
    const precios=promoPrecioUnidades(unidades.map(x=>x.base),g.promo.niveles);
    const asignados=new Map();
    unidades.forEach((u,i)=>{asignados.set(u.item,(asignados.get(u.item)||0)+precios[i]);});
    for(const [item,total] of asignados){
      item.precioUnit=item.cantidad?total/item.cantidad:item.precioListaUnit;
      item.promoAplicada=g.promo.nombre;
    }
  });
}
function textoNivelesPromo(p){
  return (p.niveles||[]).slice().sort((a,b)=>Number(a.cant)-Number(b.cant)).map(x=>`${x.cant} por ${money(x.precio)}`).join(' · ');
}
function renderPromocionesVigentes(){
  const vigentes=(state.promociones||[]).filter(p=>promoFechaActiva(p)&&(p.categorias||[]).length);
  const porPrenda=(state.promociones||[]).filter(p=>promoFechaActiva(p)&&!(p.categorias||[]).length&&(p.productos_ids||[]).length);
  const ofertas=[...vigentes,...porPrenda];
  if(!ofertas.length)return '';
  return `<div class="card promo-aviso"><strong>Ofertas vigentes</strong>${ofertas.map(p=>`<div><span>${escaparHTML(p.nombre)}</span><small>${escaparHTML((p.categorias||[]).join(', ')||((p.productos_ids||[]).length+' prenda(s) seleccionada(s)'))} · ${escaparHTML(textoNivelesPromo(p))}</small></div>`).join('')}</div>`;
}
function toggleCategoriaPromo(categoria, activo){
  if(activo){if(!promoCategoriasDraft.includes(categoria))promoCategoriasDraft.push(categoria);}
  else promoCategoriasDraft=promoCategoriasDraft.filter(c=>c!==categoria);
  renderAll();
}
function toggleCategoriaPromoPorIndice(indice, activo){
  const categoria=(state.config.categorias||[])[indice];
  if(categoria!==undefined) toggleCategoriaPromo(categoria,activo);
}
function toggleProductoPromo(id, activo){
  if(activo){if(!promoProductosDraft.includes(id))promoProductosDraft.push(id);}
  else promoProductosDraft=promoProductosDraft.filter(x=>x!==id);
  renderListaProductosPromo();
  const n=document.getElementById('promoProductosSeleccionados');if(n)n.textContent=promoProductosDraft.length+' prenda(s) seleccionada(s)';
}
function cambiarModoPromo(modo){promoModoDraft=modo==='producto'?'producto':'categoria';renderAll();}
function prepararCatalogoPromociones(){
  if(promoCatalogoEstado!=='pendiente')return;
  promoCatalogoEstado='cargando';promoCatalogoError='';
  asegurarCatalogoCompleto().then(()=>{promoCatalogoEstado='listo';renderAll();}).catch(e=>{promoCatalogoEstado='error';promoCatalogoError=e.message||String(e);renderAll();});
}
function reintentarCatalogoPromociones(){promoCatalogoEstado='pendiente';prepararCatalogoPromociones();renderAll();}
function htmlListaProductosPromo(){
  const term=promoBusquedaDraft.trim().toLocaleLowerCase();
  const filtrados=(state.productos||[]).filter(p=>!term||[p.nombre,p.descripcion,p.categoria].some(x=>String(x||'').toLocaleLowerCase().includes(term)));
  const max=100, visibles=filtrados.slice(0,max);
  if(!visibles.length)return '<p class="empty">No hay prendas que coincidan con la búsqueda.</p>';
  return `<div class="promo-productos-scroll">${visibles.map(p=>`<label class="promo-producto"><input type="checkbox" ${promoProductosDraft.includes(p.id)?'checked':''} onchange="toggleProductoPromo('${escaparHTML(p.id)}',this.checked)"><span><strong>${escaparHTML(p.nombre)}</strong><small>${escaparHTML(p.categoria||'Sin categoría')}${p.descripcion?' · '+escaparHTML(p.descripcion):''} · ${(p.variantes||[]).length} variante(s)</small></span></label>`).join('')}</div>${filtrados.length>max?`<small>Mostrando ${max} de ${filtrados.length}. Buscá por nombre para encontrar otras prendas.</small>`:''}`;
}
function renderListaProductosPromo(){const el=document.getElementById('promoListaProductos');if(el)el.innerHTML=htmlListaProductosPromo();}
function actualizarNivelPromo(indice,campo,valor){
  if(!promoNivelesDraft[indice]) return;
  promoNivelesDraft[indice][campo]=valor;
}
function agregarNivelPromo(){promoNivelesDraft.push({cant:'',precio:''});renderAll();}
function quitarNivelPromo(indice){promoNivelesDraft.splice(indice,1);renderAll();}
function reiniciarPromoDraft(){
  promoNombreDraft='';promoCategoriasDraft=[];promoProductosDraft=[];promoModoDraft='categoria';promoBusquedaDraft='';promoNivelesDraft=[{cant:1,precio:''},{cant:2,precio:''}];promoDesdeDraft='';promoHastaDraft='';
}
async function crearPromocionNube(){
  if(session!=='admin') return;
  const nombre=promoNombreDraft.trim();
  const niveles=promoNivelesDraft.map(x=>({cant:Math.floor(Number(x.cant)),precio:Math.round(Number(x.precio))}))
    .filter(x=>x.cant>=1&&x.cant<=50&&x.precio>0);
  if(!nombre){showToast('Escribí el nombre de la oferta');return;}
  const categorias=promoModoDraft==='categoria'?promoCategoriasDraft.slice():[];
  const productosIds=promoModoDraft==='producto'?promoProductosDraft.slice():[];
  if(!categorias.length&&!productosIds.length){showToast(promoModoDraft==='producto'?'Elegí al menos una prenda':'Elegí al menos una categoría');return;}
  if(!niveles.length){showToast('Agregá al menos un precio promocional válido');return;}
  if(promoDesdeDraft&&promoHastaDraft&&promoHastaDraft<promoDesdeDraft){showToast('La fecha de fin no puede ser anterior al inicio');return;}
  const alcance={fecha_desde:promoDesdeDraft||null,fecha_hasta:promoHastaDraft||null};
  const superpuestas=(state.promociones||[]).find(p=>{
    if(p.activa===false||!promoFechasSeCruzan(p,alcance))return false;
    const pCats=p.categorias||[],pIds=p.productos_ids||[];
    return categorias.some(c=>pCats.includes(c)||pIds.some(id=>productoPorId(id)?.categoria===c))
      || productosIds.some(id=>{const prod=productoPorId(id);return pIds.includes(id)||(prod&&pCats.includes(prod.categoria));});
  });
  if(superpuestas){showToast('Una de las prendas o categorías ya participa en “'+superpuestas.nombre+'” durante esas fechas.');return;}
  const fila={id:uid(),nombre,activa:true,productos_ids:productosIds,categorias,niveles,fecha_desde:promoDesdeDraft||null,fecha_hasta:promoHastaDraft||null,creado_en:new Date().toISOString()};
  state.promociones.push(fila);
  registrarMovimiento('Promoción creada',nombre+' · '+textoNivelesPromo(fila));
  reiniciarPromoDraft();save();
  await sincronizar();
  if(estadoSync==='error'){state.promociones=state.promociones.filter(p=>p.id!==fila.id);showToast('No se pudo guardar la promoción en Supabase. Revisá que el SQL actualizado esté aplicado y tengas permisos de administrador.');return;}
  showToast('Oferta creada');renderAll();
}
async function cambiarEstadoPromocion(id){
  if(session!=='admin') return;
  const promo=(state.promociones||[]).find(p=>p.id===id);if(!promo)return;
  if(promo.activa===false&&!(promo.categorias||[]).length&&!(promo.productos_ids||[]).length){showToast('Esta oferta importada no tiene categorías ni prendas asignadas. Creá una nueva desde la categoría correspondiente.');return;}
  promo.activa=promo.activa===false;
  registrarMovimiento(promo.activa?'Promoción activada':'Promoción pausada',promo.nombre);
  save();await sincronizar();renderAll();
}
async function eliminarPromocionNube(id){
  if(session!=='admin')return;
  const promo=(state.promociones||[]).find(p=>p.id===id);if(!promo)return;
  if(!confirm('¿Eliminar la oferta “'+promo.nombre+'”? Las ventas ya registradas conservan su precio.'))return;
  state.promociones=state.promociones.filter(p=>p.id!==id);
  registrarMovimiento('Promoción eliminada',promo.nombre);
  save();await sincronizar();renderAll();
}
function renderPromociones(){
  if(session!=='admin')return '';
  prepararCatalogoPromociones();
  if(promoCatalogoEstado==='cargando')return '<h2 class="section-title">Promociones</h2><section class="card"><p class="section-note">Cargando el catálogo para que puedas seleccionar prendas…</p></section>';
  if(promoCatalogoEstado==='error')return `<h2 class="section-title">Promociones</h2><section class="card"><p class="section-note">No se pudo cargar el catálogo: ${escaparHTML(promoCatalogoError)}</p><button class="btn small" onclick="reintentarCatalogoPromociones()">Reintentar</button></section>`;
  const lista=(state.promociones||[]).slice().sort((a,b)=>String(b.creado_en||'').localeCompare(String(a.creado_en||'')));
  return `
  <h2 class="section-title">Promociones</h2>
  <p class="section-note">Elegí una categoría completa o prendas puntuales. La oferta se aplica a todos los talles y colores de cada prenda seleccionada. Cada oferta queda separada y se calcula automáticamente al vender.</p>
  <section class="card promo-form">
    <div class="card-title">Crear oferta o liquidación</div>
    <div class="field"><label for="promoNombre">Nombre de la oferta</label><input id="promoNombre" value="${escaparHTML(promoNombreDraft)}" placeholder="Ej.: Medias · 2 por $5.000" oninput="promoNombreDraft=this.value"></div>
    <div class="field"><label for="promoModo">¿A qué prendas se aplica?</label><select id="promoModo" onchange="cambiarModoPromo(this.value)"><option value="categoria" ${promoModoDraft==='categoria'?'selected':''}>A toda una o más categorías</option><option value="producto" ${promoModoDraft==='producto'?'selected':''}>Solo a prendas que seleccione</option></select></div>
    ${promoModoDraft==='categoria'?`<div class="field"><label>Categorías incluidas</label><div class="promo-categorias">${(state.config.categorias||[]).map((c,i)=>`<label><input type="checkbox" ${promoCategoriasDraft.includes(c)?'checked':''} onchange="toggleCategoriaPromoPorIndice(${i},this.checked)"> ${escaparHTML(c)}</label>`).join('')}</div><small>La categoría tiene que coincidir con la de las prendas en Stock.</small></div>`:`<div class="field"><label for="promoBuscarProductos">Buscar y seleccionar prendas</label><input id="promoBuscarProductos" type="search" value="${escaparHTML(promoBusquedaDraft)}" placeholder="Nombre, descripción o categoría" oninput="promoBusquedaDraft=this.value;renderListaProductosPromo()"><small id="promoProductosSeleccionados">${promoProductosDraft.length} prenda(s) seleccionada(s). Se incluyen todos sus talles y colores.</small><div id="promoListaProductos">${htmlListaProductosPromo()}</div></div>`}
    <div class="field"><label>Precios por cantidad</label><div class="promo-niveles">${promoNivelesDraft.map((x,i)=>`<div class="promo-nivel"><span>Llevando</span><input aria-label="Cantidad de prendas" type="number" min="1" max="50" value="${escaparHTML(x.cant)}" oninput="actualizarNivelPromo(${i},'cant',this.value)"><span>prenda(s), total</span><input aria-label="Precio total promocional" type="number" min="1" step="1" value="${escaparHTML(x.precio)}" placeholder="$" oninput="actualizarNivelPromo(${i},'precio',this.value)">${promoNivelesDraft.length>1?`<button class="link-btn" type="button" onclick="quitarNivelPromo(${i})" aria-label="Quitar nivel">Quitar</button>`:''}</div>`).join('')}</div><button class="btn small ghost" type="button" onclick="agregarNivelPromo()">Agregar otro precio por cantidad</button></div>
    <div class="row"><div class="field"><label for="promoDesde">Válida desde (opcional)</label><input id="promoDesde" type="date" value="${promoDesdeDraft}" oninput="promoDesdeDraft=this.value"></div><div class="field"><label for="promoHasta">Válida hasta (opcional)</label><input id="promoHasta" type="date" value="${promoHastaDraft}" oninput="promoHastaDraft=this.value"></div></div>
    <button class="btn primary" type="button" onclick="crearPromocionNube()">Guardar oferta</button>
  </section>
  <section class="card"><div class="card-title">Ofertas creadas · ${lista.length}</div>
    ${lista.length?`<div class="promo-list">${lista.map(p=>`<article class="promo-item"><div><strong>${escaparHTML(p.nombre)}</strong><div class="muted">${escaparHTML((p.categorias||[]).join(', ')||((p.productos_ids||[]).length?(p.productos_ids.length+' prenda(s) seleccionada(s)'):'Sin prendas asignadas'))} · ${escaparHTML(textoNivelesPromo(p))}</div><small>${p.fecha_desde?'Desde '+fmtDate(p.fecha_desde):'Sin fecha de inicio'}${p.fecha_hasta?' · Hasta '+fmtDate(p.fecha_hasta):''}</small></div><div class="promo-actions"><span class="pill ${p.activa===false?'mid':'ok'}">${p.activa===false?'Pausada':promoFechaActiva(p)?'Vigente':'Programada / vencida'}</span><button class="btn small ghost" type="button" onclick="cambiarEstadoPromocion('${escaparHTML(p.id)}')">${p.activa===false?'Activar':'Pausar'}</button><button class="link-btn" type="button" onclick="eliminarPromocionNube('${escaparHTML(p.id)}')">Eliminar</button></div></article>`).join('')}</div>`:'<p class="empty">Todavía no creaste promociones.</p>'}
  </section>`;
}
