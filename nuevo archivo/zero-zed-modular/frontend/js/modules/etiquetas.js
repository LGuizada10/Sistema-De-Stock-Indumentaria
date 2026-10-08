// [ZZ] modules/etiquetas.js — Etiquetas con código de barras: generación Code 128, impresión y reimpresión.
function contarEtiquetasStock(){
  if(stockResumenNube) return Number(stockResumenNube.unidades)||0;
  return state.productos.reduce((total,producto)=>total+producto.variantes.reduce((subtotal,variante)=>subtotal+Math.max(0,Number(variante.stock)||0),0),0);
}
function contarEtiquetasPendientes(){
  if(stockResumenNube) return Number(stockResumenNube.etiquetasPendientes)||0;
  return Object.values(state.etiquetasPendientes||{}).reduce((total,cantidad)=>total+Math.max(0,Number(cantidad)||0),0);
}
/* Las etiquetas pendientes SOLO cambian cuando cambia el precio de la prenda (ver marcarEtiquetasPorPrecio).
   Agregar, quitar o ajustar stock ya no las modifica. */
function registrarEtiquetasPendientes(varianteId,cantidad){ return 0; }
function retirarEtiquetasPendientes(varianteId,cantidad){ return 0; }
function marcarEtiquetasPorPrecio(producto){
  state.etiquetasPendientes=state.etiquetasPendientes||{};
  (producto.variantes||[]).forEach(v=>{
    const n=Math.max(0,Number(v.stock)||0);
    if(n>0) state.etiquetasPendientes[v.id]=n; else delete state.etiquetasPendientes[v.id];
    marcarVarianteSucia(producto,v);
  });
}
function cambiarPrecioProducto(producto,nuevoPrecio){
  const cambio=Number(producto.precio||0)!==Number(nuevoPrecio||0);
  producto.precio=nuevoPrecio;
  if(cambio) marcarEtiquetasPorPrecio(producto);
  return cambio;
}
function retirarEtiquetasImpresas(varianteId,cantidad){
  const pendientes=state.etiquetasPendientes||{};
  const retiro=Math.min(Math.max(0,Number(pendientes[varianteId])||0),Math.max(0,Number(cantidad)||0));
  const restantes=(Number(pendientes[varianteId])||0)-retiro;
  if(restantes>0)pendientes[varianteId]=restantes;
  else delete pendientes[varianteId];
  marcarVariantePorIdSucia(varianteId);
  return retiro;
}
function cerrarEtiquetasStock(){
  document.body.classList.remove('labels-printing');
  const overlay=document.getElementById('labelPrintOverlay');
  overlay.classList.remove('active');
  overlay.innerHTML='';
  window.etiquetasImpresion=null;
  renderAll();
}
async function imprimirEtiquetasStock(modo='todas', pid=null, cant=null){
  if(!pid && modo!=='reimpresion'){
    try{await asegurarCatalogoCompleto();}
    catch(e){showToast(e.message||'No se pudo cargar el catálogo completo');return;}
  }
  const etiquetas=(pid?state.productos.filter(p=>p.id===pid):state.productos).flatMap(producto=>producto.variantes.flatMap(variante=>{
    const stock=Math.max(0,Number(variante.stock)||0);
    const cantidadPendiente=Math.max(0,Number(state.etiquetasPendientes?.[variante.id])||0);
    const cantidad=modo==='reimpresion'?((cant&&cant[variante.id])||0):modo==='nuevas'?Math.min(stock,cantidadPendiente):stock;
    return Array.from({length:cantidad},()=>({producto,variante}));
  }));
  if(!etiquetas.length){showToast('No hay prendas con stock para imprimir');return;}
  const pctDebito=Number(state.config.debitoPct)||0;
  const pctCredito=Number(state.config.creditoPct)||0;
  const overlay=document.getElementById('labelPrintOverlay');
  const conteoImpreso=etiquetas.reduce((conteo,{variante})=>{conteo[variante.id]=(conteo[variante.id]||0)+1;return conteo;},{});
  window.etiquetasImpresion={modo,conteo:conteoImpreso};
  overlay.innerHTML=`<div class="label-print-toolbar"><b>${etiquetas.length} etiqueta(s) ${modo==='reimpresion'?'para reimprimir':modo==='nuevas'?'nuevas pendientes':'de todo el stock'}</b><div class="row"><button class="btn" onclick="imprimirEtiquetasVista()">Imprimir / Guardar PDF</button>${modo==='reimpresion'?`<button class="btn" onclick="abrirReimpresion('${pid}')">Cambiar cantidades</button>`:`<button class="btn primary" data-mark-labels onclick="marcarEtiquetasImpresas()">Marcar impresas</button>`}<button class="btn ghost" onclick="cerrarEtiquetasStock()">Cerrar</button></div></div>
    <div class="label-grid">${etiquetas.map(({producto,variante})=>{
      const precio=Number(producto.precio)||0;
      const precioDebito=precio+Math.round(precio*pctDebito/100);
      const precioCredito=precio+Math.round(precio*pctCredito/100);
      const varianteTexto=([variante.talle,variante.color].filter(Boolean).join(' / ')||'Único')+(producto.descripcion?' · '+producto.descripcion:'');
      return `<article class="price-label">
        <div class="price-label-name">${escaparHTML(producto.nombre)}</div>
        <div class="price-label-variant">${escaparHTML(varianteTexto)}</div>
        <div class="price-label-barcode">${variante.codigo ? code128Svg(codigoBarras(variante,producto),'7mm') : ''}<span>${escaparHTML(variante.codigo ? codigoBarras(variante,producto) : 'SIN CLAVE')}</span></div>
        <div class="price-label-prices">
          <span>Efectivo / transf.<strong>${money(precio)}</strong></span>
          <span>Débito<strong>${money(precioDebito)}</strong></span>
          <span>Crédito<strong>${money(precioCredito)}</strong></span>
        </div>
      </article>`;
    }).join('')}</div>`;
  overlay.classList.add('active');
  document.body.classList.add('labels-printing');
}
function abrirReimpresion(pid){
  const p=state.productos.find(x=>x.id===pid); if(!p) return;
  const ov=document.getElementById('labelPrintOverlay');
  ov.innerHTML=`<div class="label-print-toolbar"><b>Etiquetas · ${escaparHTML(p.nombre)}</b><button class="btn ghost" onclick="cerrarEtiquetasStock()">Cerrar</button></div>
    <div class="card" style="max-width:520px;margin:0 auto;">
      <p class="section-note" style="margin-top:0;">Precio actual: <b>${money(p.precio)}</b>. Elegí cuántas etiquetas querés de cada talle/color. Se imprimen con el precio de hoy.</p>
      ${p.variantes.map(v=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;"><span>${escaparHTML(etiquetaVariante(v))} <span class="section-note">(stock ${Number(v.stock)||0})</span></span><input type="number" min="0" max="99" inputmode="numeric" data-reimp="${v.id}" value="${Math.max(0,Number(v.stock)||0)}" style="width:80px;"></div>`).join('')}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn small" onclick="reimpPonerTodas('stock')">Todo el stock</button>
        <button class="btn small" onclick="reimpPonerTodas(1)">1 de cada una</button>
        <button class="btn small primary" onclick="verReimpresion('${p.id}')">Ver etiquetas</button>
      </div></div>`;
  ov.classList.add('active');
  document.body.classList.add('labels-printing');
}
function reimpPonerTodas(modo){
  const vars=state.productos.flatMap(p=>p.variantes);
  document.querySelectorAll('[data-reimp]').forEach(i=>{ const v=vars.find(x=>x.id===i.dataset.reimp); i.value = modo==='stock' ? Math.max(0,Number(v&&v.stock)||0) : 1; });
}
function verReimpresion(pid){
  const cant={};
  document.querySelectorAll('[data-reimp]').forEach(i=>{ const n=Math.min(99,Math.max(0,parseInt(i.value)||0)); if(n) cant[i.dataset.reimp]=n; });
  if(!Object.keys(cant).length){ showToast('Poné al menos una etiqueta'); return; }
  imprimirEtiquetasStock('reimpresion', pid, cant);
}
function imprimirEtiquetasVista(){
  if(!window.etiquetasImpresion)return;
  window.addEventListener('afterprint',registrarEtiquetasImpresas,{once:true});
  window.print();
}
function registrarEtiquetasImpresas(){
  if(!window.etiquetasImpresion||window.etiquetasImpresion.impresas)return;
  if(window.etiquetasImpresion.modo==='reimpresion')return; // reimprimir no toca las etiquetas pendientes
  if(window.etiquetasImpresion.modo==='todas'){
    state.etiquetasPendientes={};
    state.etiquetasInicialesImpresas=true;
  }
  else Object.entries(window.etiquetasImpresion.conteo).forEach(([varianteId,cantidad])=>retirarEtiquetasImpresas(varianteId,cantidad));
  save();
  window.etiquetasImpresion.impresas=true;
  const button=document.querySelector('#labelPrintOverlay [data-mark-labels]');
  if(button){button.disabled=true;button.textContent='Ya registradas';}
  showToast('Etiquetas impresas y registradas');
}
function marcarEtiquetasImpresas(){
  registrarEtiquetasImpresas();
  cerrarEtiquetasStock();
}

/* ===== Código de barras Code 128 (subconjunto B), sin librerías externas ===== */
const CODE128_PATRONES = ["212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112"];
function code128Svg(texto, alto){
  const t = (texto||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'-');
  if(!t) return '';
  const valores = [104]; let suma = 104;
  for(let i=0;i<t.length;i++){ const v = t.charCodeAt(i)-32; valores.push(v); suma += v*(i+1); }
  valores.push(suma%103); valores.push(106);
  const ZONA = 10; let x = ZONA, d = '';
  valores.forEach(v=>{
    const p = CODE128_PATRONES[v];
    for(let k=0;k<p.length;k++){ const w = Number(p[k]); if(k%2===0) d += 'M'+x+' 0h'+w+'v1h-'+w+'z'; x += w; }
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(x+ZONA)+' 1" preserveAspectRatio="none" style="width:100%;height:'+alto+';display:block;" shape-rendering="crispEdges" role="img" aria-label="Código de barras '+escaparHTML(t)+'"><path fill="#000" d="'+d+'"/></svg>';
}
/* Si hay una sola variante con esa clave (o una sola con stock) se elige sola; si hay varios talles, se elige la prenda y se deja elegir el talle. */
/* Valor que va dentro del código de barras de la etiqueta.
   Prendas con número (clave compartida entre talles): se agrega el talle, así cada etiqueta lee SU talle (REM-COR-001-NEG-M).
   Prendas viejas (la clave ya trae el talle): queda igual. */
function codigoBarras(v, p){
  const c = (v.codigo||'').trim();
  if(!c || !p || !p.num) return c;
  const talle = (v.talle||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'') || 'U';
  return c + '-' + talle;
}
