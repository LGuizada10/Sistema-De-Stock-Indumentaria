// [ZZ] modules/facturas.js — Pestaña FACTURAS: pedidos de factura, envío al contador por WhatsApp.
/* =================== FACTURAS (consumidor final → contador → cliente) =================== */
let facReq = false, facConsent = false, facDatos = {nombre:'', tipo:'DNI', doc:'', email:'', tel:'', dom:''};
let facturas = [], facFiltro = 'pendiente', facSel = new Set();
const FAC_ESTADOS = [['pendiente','Pendientes'],['enviada_contador','Con contador'],['facturada','Por enviar'],['enviada_cliente','Terminadas']];
function facValidar(){
  const d = facDatos, doc = d.doc.replace(/\D/g,'');
  if(d.nombre.trim().length<3) return 'Factura: falta el nombre y apellido del cliente';
  if(doc.length<7 || doc.length>11) return 'Factura: revisá el número de documento';
  if(!d.email.trim() && d.tel.replace(/\D/g,'').length<8) return 'Factura: cargá un mail o un WhatsApp para enviársela';
  if(!facConsent) return 'Factura: confirmá que le informaste al cliente cómo se usarán sus datos';
  return '';
}
function ventaFacturaHTML(){
  const d = facDatos, v = escaparHTML;
  const check = `<button type="button" class="fac-toggle ${facReq?'on':''}" onclick="facReq=!facReq; renderAll();"><span class="sw"></span><span class="tx">El cliente pide factura<small>Consumidor final</small></span></button>`;
  if(!facReq) return check;
  return check + `<div class="card" style="margin:8px 0;padding:10px;">
    <div class="field"><label>Nombre y apellido</label><input type="text" value="${v(d.nombre)}" oninput="facDatos.nombre=this.value"></div>
    <div class="field"><label>Documento</label><div style="display:flex;gap:8px;"><select onchange="facDatos.tipo=this.value">${['DNI','CUIL','CUIT'].map(t=>`<option ${d.tipo===t?'selected':''}>${t}</option>`).join('')}</select><input type="text" inputmode="numeric" placeholder="Número" value="${v(d.doc)}" oninput="facDatos.doc=this.value"></div></div>
    <div class="field"><label>Mail</label><input type="email" value="${v(d.email)}" oninput="facDatos.email=this.value"></div>
    <div class="field"><label>WhatsApp (código de área + número, sin 0 ni 15)</label><input type="tel" inputmode="tel" placeholder="11 2345 6789" value="${v(d.tel)}" oninput="facDatos.tel=this.value"></div>
    <div class="field"><label>Domicilio (opcional)</label><input type="text" value="${v(d.dom)}" oninput="facDatos.dom=this.value"></div>
    <div class="field"><label class="fac-consent" style="display:flex;gap:8px;align-items:flex-start;font-weight:400;"><input type="checkbox" class="fac-check" ${facConsent?'checked':''} onchange="facConsent=this.checked"><span>El cliente aceptó que usemos sus datos solo para emitir y enviar su factura. <a href="legal/privacidad.html" target="_blank" rel="noopener">Ver política de privacidad</a></span></label></div>
  </div>`;
}
async function cargarFacturas(){
  try{ facturas = (await traer('solicitudes_factura','creado_en')).reverse(); }
  catch(e){ showToast('No se pudieron cargar las facturas: '+(e.message||e)); }
  if(currentTab==='facturas') renderAll();
}
async function facUpdate(ids, campos){
  const {error} = await sb.from('solicitudes_factura').update(campos).in('id',ids);
  if(error){ showToast('No se pudo guardar: '+error.message); return false; }
  facSel.clear(); await cargarFacturas(); return true;
}
function facToggle(id){ facSel.has(id) ? facSel.delete(id) : facSel.add(id); }
function facSelTodas(){
  const pendientes=facturas.filter(f=>f.estado==='pendiente');
  const todasSeleccionadas=pendientes.length>0&&pendientes.every(f=>facSel.has(f.id));
  pendientes.forEach(f=>todasSeleccionadas?facSel.delete(f.id):facSel.add(f.id));
  renderAll();
}
function facElegidas(){ const l = facturas.filter(f=>facSel.has(f.id)); if(!l.length) showToast('Elegí al menos una solicitud'); return l; }
function facMarcar(estado){
  const l = facElegidas(); if(!l.length) return;
  facUpdate(l.map(f=>f.id), estado==='enviada_contador' ? {estado, fecha_envio_contador:todayStr()} : {estado, fecha_envio_cliente:todayStr()});
}
function facRegistrar(id){
  const n = (document.getElementById('nro-'+id)||{}).value||'';
  if(!n.trim()){ showToast('Escribí el número de la factura'); return; }
  facUpdate([id], {estado:'facturada', nro_comprobante:n.trim(), fecha_factura:todayStr()});
}
function facDetalle(f){ const v = state.ventas.find(x=>x.id===f.venta_id); return v ? v.items.map(i=>i.cantidad+'x '+i.nombre+(i.varianteLabel?' ('+i.varianteLabel+')':'')).join(', ') : ''; }
function facTel(t){ const d = String(t||'').replace(/\D/g,''); if(!d) return ''; return d.startsWith('54') ? d : '549'+d.replace(/^0+/,''); }
function facTexto(f){ return 'Hola '+f.nombre+', te paso la factura de tu compra del '+f.fecha+' por '+money(f.total)+(f.nro_comprobante?' (comprobante '+f.nro_comprobante+')':'')+'. ¡Gracias por elegirnos! — '+state.config.nombreLocal; }
function facDescargarCSV(){
  const l = facElegidas(); if(!l.length) return;
  const q = x => '"'+String(x==null?'':x).replace(/"/g,'""')+'"';
  const fila = f => { const v = state.ventas.find(x=>x.id===f.venta_id); return [f.fecha, String(f.venta_id||'').slice(0,8), f.nombre, f.documento_tipo, f.documento, 'Consumidor final', f.email, f.telefono, f.domicilio, f.total, v?v.metodoPago:'', facDetalle(f)].map(q).join(';'); };
  const cab = ['Fecha','Nº venta','Nombre y apellido','Tipo doc','Documento','Condición IVA','Mail','Teléfono','Domicilio','Total','Medio de pago','Detalle'].map(q).join(';');
  descargarArchivo('facturas-para-contador-'+todayStr()+'.csv', '\ufeff'+[cab].concat(l.map(fila)).join('\r\n'), 'text/csv;charset=utf-8');
}
/* Texto con TODOS los datos de las facturas elegidas, para mandarle al contador por WhatsApp */
function facTextoContador(l){
  const total = l.reduce((t,f)=>t+Number(f.total||0),0);
  const partes = l.map((f,i)=>{
    const v = state.ventas.find(x=>x.id===f.venta_id);
    return [
      (i+1)+') '+f.nombre,
      f.documento_tipo+' '+f.documento,
      'Condición IVA: Consumidor final',
      'Total: '+money(f.total)+(v&&v.metodoPago?' · '+v.metodoPago:'')+' · Fecha: '+f.fecha,
      f.email?'Mail: '+f.email:'',
      f.telefono?'Tel: '+f.telefono:'',
      f.domicilio?'Domicilio: '+f.domicilio:'',
      facDetalle(f)?'Detalle: '+facDetalle(f):''
    ].filter(Boolean).join('\n');
  });
  return 'Facturas a emitir · '+state.config.nombreLocal+' · '+todayStr()+'\n'+l.length+' factura(s) a consumidor final por '+money(total)+'\n\n'+partes.join('\n\n');
}
function facWhatsAppContador(){
  const l = facElegidas(); if(!l.length) return;
  const campo = document.getElementById('facWaContador');
  const num = facTel(campo ? campo.value : '');
  if(num.replace(/\D/g,'').length < 11){ showToast('Escribí el WhatsApp del contador (con código de área, sin 0 ni 15)'); return; }
  try{ localStorage.setItem('zz_wa_contador', campo.value); }catch(x){}
  const texto = facTextoContador(l);
  if(encodeURIComponent(texto).length <= 1800){
    window.open('https://wa.me/'+num+'?text='+encodeURIComponent(texto), '_blank', 'noopener');
    showToast('Se abrió WhatsApp. Tocá enviar y después "Marcar como enviadas"');
  } else {
    /* Demasiado largo para un enlace: se copia y se abre el chat vacío para pegarlo */
    const abrir = ()=>{ window.open('https://wa.me/'+num, '_blank', 'noopener'); showToast('Mensaje copiado: pegalo en el chat y enviá. Después "Marcar como enviadas"'); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(abrir).catch(()=>showToast('No se pudo copiar. Elegí menos solicitudes y probá de nuevo'));
    else showToast('No se pudo copiar. Elegí menos solicitudes y probá de nuevo');
  }
}
/* Abre la redacción de Gmail en una pestaña nueva (funciona sin tener un programa de correo instalado) */
function urlGmail(para, asunto, cuerpo){
  return 'https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(para||'')+'&su='+encodeURIComponent(asunto||'')+'&body='+encodeURIComponent(cuerpo||'');
}
function renderFacturas(){
  const e = escaparHTML, lista = facturas.filter(f=>f.estado===facFiltro);
  let waC = ''; try{ waC = localStorage.getItem('zz_wa_contador')||''; }catch(x){}
  if(!waC) waC = '1173617286';
  const seleccionadas=lista.filter(f=>facSel.has(f.id)).length;
  const tabs = FAC_ESTADOS.map(([k,l])=>`<button type="button" class="fac-stage-tab ${facFiltro===k?'active':''}" aria-pressed="${facFiltro===k}" onclick="facFiltro='${k}'; facSel.clear(); renderAll();"><span>${l}</span><span class="fac-stage-count">${facturas.filter(f=>f.estado===k).length}</span></button>`).join('');
  const barra = (facFiltro==='pendiente' && lista.length) ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0;">
    <div class="fac-toolbar">
      <div class="field"><label for="facWaContador">WhatsApp del contador</label><input type="tel" id="facWaContador" placeholder="Código de área y número" value="${e(waC)}" onchange="try{localStorage.setItem('zz_wa_contador',this.value)}catch(x){}"></div>
      <div class="fac-toolbar-actions">
        <span class="fac-selection-label">${seleccionadas?seleccionadas+' seleccionada(s)':'Seleccioná las solicitudes para continuar'}</span>
        <button type="button" class="btn small ghost" onclick="facSelTodas()">${lista.every(f=>facSel.has(f.id))?'Quitar selección':'Seleccionar todas'}</button>
        <button type="button" class="btn small primary" onclick="facWhatsAppContador()" ${seleccionadas?'':'disabled'}>Abrir WhatsApp</button>
        <button type="button" class="btn small ghost" onclick="facMarcar('enviada_contador')" ${seleccionadas?'':'disabled'}>Marcar enviadas</button>
        <button type="button" class="btn small ghost" onclick="facDescargarCSV()" ${seleccionadas?'':'disabled'}>Descargar CSV</button>
      </div>
    </div>` : '';
  const fichas = lista.map(f=>{
    const acc = f.estado==='enviada_contador' ? `<div class="fac-next-action"><input type="text" id="nro-${f.id}" aria-label="Número de factura de ${e(f.nombre)}" placeholder="Número de factura"><button class="btn small primary" onclick="facRegistrar('${f.id}')">Registrar factura</button></div>`
      : f.estado==='facturada' ? `<div class="fac-final-actions">
          ${f.telefono?`<a class="btn small ghost" target="_blank" rel="noopener" href="https://wa.me/${facTel(f.telefono)}?text=${encodeURIComponent(facTexto(f))}">WhatsApp</a>`:''}
          ${f.email?`<a class="btn small ghost" target="_blank" rel="noopener" href="${urlGmail(f.email, 'Tu factura · '+state.config.nombreLocal, facTexto(f))}">Mail</a>`:''}
          <button class="btn small primary" onclick="facSel.clear(); facSel.add('${f.id}'); facMarcar('enviada_cliente')">Marcar enviada</button></div>
          <p class="section-note" style="margin:6px 0 0 44px;">Adjuntá el PDF recibido del contador.</p>` : '';
    const selector=f.estado==='pendiente'?`<label class="fac-item-check" aria-label="Seleccionar solicitud de ${e(f.nombre)}"><input type="checkbox" class="fac-check" ${facSel.has(f.id)?'checked':''} onchange="facToggle('${f.id}'); renderAll();"></label>`:'<span class="fac-item-check" aria-hidden="true"></span>';
    const detalle=f.estado==='enviada_cliente'?`<span class="pill ok">Enviada al cliente</span>`:'';
    return `<article class="fac-item">
      <div class="fac-item-main">${selector}<div class="fac-client"><h3 class="fac-client-name">${e(f.nombre)}</h3><div class="fac-client-meta">${e(f.fecha)} · ${e(f.documento_tipo)}${f.nro_comprobante?' · Factura '+e(f.nro_comprobante):''}</div></div><div class="fac-total">${money(f.total)}</div></div>
      <details class="fac-details"><summary>Ver datos y productos</summary><div class="fac-details-body"><div><b>Documento:</b> ${e(f.documento_tipo)} ${e(f.documento)}</div>${f.email?`<div><b>Mail:</b> ${e(f.email)}</div>`:''}${f.telefono?`<div><b>Teléfono:</b> ${e(f.telefono)}</div>`:''}${f.domicilio?`<div><b>Domicilio:</b> ${e(f.domicilio)}</div>`:''}<div><b>Detalle:</b> ${e(facDetalle(f)||'Sin detalle de productos')}</div>${f.nro_comprobante?`<div><b>Comprobante:</b> ${e(f.nro_comprobante)}</div>`:''}</div></details>
      ${acc||detalle}
    </article>`;
  }).join('');
  return `<h2 class="section-title">Facturas a consumidor final</h2>
    <p class="section-note">Solicitudes de consumidor final · seguimiento desde el contador hasta el cliente.</p>
    <nav class="fac-stage-tabs" aria-label="Etapas de facturación">${tabs}</nav>${barra}
    ${facFiltro==='enviada_cliente' ? '<p class="section-note">Las solicitudes terminadas se eliminan automáticamente a los 21 días.</p>' : ''}
    ${fichas ? `<div class="fac-list">${fichas}</div>`:`<div class="fac-empty"><strong>No hay solicitudes en esta etapa</strong><span>Cuando haya facturas para gestionar, aparecerán acá.</span></div>`}`;
}
