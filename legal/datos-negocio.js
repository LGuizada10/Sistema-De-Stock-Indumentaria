/* =====================================================================
   DATOS DEL NEGOCIO — es el ÚNICO archivo que tenés que completar.
   Reemplazá cada texto que empieza con "[COMPLETAR" por el dato real (dejá las comillas).
   Estos datos se muestran automáticamente en el pie del programa y en las páginas legales.
   Cuando termines y un profesional haya revisado los textos, poné  borrador: false
   ===================================================================== */
window.NEGOCIO = {
  nombreComercial:   'Zero Zed',
  razonSocial:       '[COMPLETAR: razón social o nombre y apellido del titular]',
  cuit:              '[COMPLETAR: CUIT]',
  condicionIva:      '[COMPLETAR: ej. Responsable Inscripto / Monotributista]',
  domicilio:         '[COMPLETAR: calle, número, local y shopping]',
  ciudad:            '[COMPLETAR: ciudad y provincia]',
  email:             '[COMPLETAR: mail de contacto]',
  telefono:          '[COMPLETAR: teléfono o WhatsApp de contacto]',
  horarios:          '[COMPLETAR: días y horarios de atención]',
  responsableDatos:  '[COMPLETAR: nombre de quien responde por los datos personales]',
  contador:          '[COMPLETAR: nombre del contador o estudio contable]',
  plazoCambioDias:   '[COMPLETAR: cantidad de días para cambios, ej. 30]',
  fechaActualizacion:'07/10/2026',

  // Poné true cuando conectes Tiendanube: se muestran los apartados de venta online en las páginas legales.
  tiendanubeActiva:  false,
  // Mientras sea true, las páginas legales muestran un cartel de "borrador". Ponelo en false cuando estén revisadas.
  borrador:          true
};
(function(){
  function llenar(){
    var N = window.NEGOCIO || {};
    document.querySelectorAll('[data-negocio]').forEach(function(el){
      var v = N[el.getAttribute('data-negocio')];
      el.textContent = v == null ? '' : v;
      if(String(v).indexOf('[COMPLETAR') === 0) el.classList.add('pendiente');
    });
    // En el programa (no en las páginas legales), el pie solo muestra los datos cuando ya están completos.
    document.querySelectorAll('[data-negocio-opcional]').forEach(function(el){
      var k = el.getAttribute('data-negocio-opcional');
      if(String(N[k]).indexOf('[COMPLETAR') === 0) el.hidden = true;
    });
    document.querySelectorAll('[data-si]').forEach(function(el){
      el.hidden = !N[el.getAttribute('data-si')];
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', llenar); else llenar();
})();
