// [ZZ] modules/datos.js — Copias de seguridad, Excel (importar/exportar) y borrado total de datos.
async function exportarDatos(){
  try{await asegurarCatalogoCompleto();}
  catch(e){showToast(e.message||'No se pudo preparar la copia');return;}
  let comprasRespaldo=[];
  try{comprasRespaldo=await comprasParaRespaldo();}
  catch(e){showToast(e.message||'No se pudo incluir el historial completo de compras');return;}
  state.config.ultimoRespaldo = todayStr();
  delete state.config.respaldoPospuestoHasta;
  registrarMovimiento('Copia de seguridad','Se descargó una copia de seguridad');
  save();
  const respaldo={...state,compras:comprasRespaldo};
  const contenido = JSON.stringify(respaldo,null,2);
  descargarArchivo('zero-zed-backup-'+todayStr()+'.json', contenido, 'application/json');
}
async function exportarStockExcel(){
  try{await asegurarCatalogoCompleto();}
  catch(e){showToast(e.message||'No se pudo cargar todo el stock');return;}
  if(typeof XLSX === 'undefined'){ showToast('El generador de Excel sigue cargando, probá de nuevo en un segundo'); return; }
  const filas = [];
  state.productos.forEach(p=>{
    if(p.variantes.length===0){
      filas.push({Categoria:p.categoria, Producto:p.nombre, Descripcion:p.descripcion||'', Codigo:'', Talle:'', Color:'', Costo:p.costo, Precio:p.precio, Stock:0});
    }else{
      p.variantes.forEach(v=>{
        filas.push({Categoria:p.categoria, Producto:p.nombre, Descripcion:p.descripcion||'', Codigo:v.codigo||'', Talle:v.talle||'', Color:v.color||'', Costo:p.costo, Precio:p.precio, Stock:v.stock});
      });
    }
  });
  if(filas.length===0){ showToast('Todavía no cargaste productos'); return; }
  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock');
  const arrayBuf = XLSX.write(wb, {type:'array', bookType:'xlsx'});
  const blob = new Blob([arrayBuf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  await descargarArchivo('zero-zed-stock-'+todayStr()+'.xlsx', blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
const columnasExcelCache = new WeakMap();
function valorColumna(row, nombres){
  let columnas=columnasExcelCache.get(row);
  if(!columnas){ columnas=new Map(Object.keys(row).map(k=>[k.toString().trim().toLowerCase(),k])); columnasExcelCache.set(row,columnas); }
  for(const nombre of nombres){ const clave=columnas.get(nombre); if(clave!==undefined) return row[clave]; }
  return '';
}
function textoExcel(value){ return value===undefined || value===null ? '' : String(value).trim(); }
function importarStockExcel(event){
  const file = event.target.files[0];
  event.target.value = '';
  if(!file) return;
  if(typeof XLSX === 'undefined'){ showToast('El lector de Excel sigue cargando, probá de nuevo en un segundo'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      await asegurarCatalogoCompleto();
      const libro = XLSX.read(reader.result, {type:'array'});
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, {defval:''});
      if(!filas.length) throw new Error('sin filas');
      const normalizadas=filas.map(row=>({
        nombre:textoExcel(valorColumna(row,['producto','nombre'])),
        categoria:textoExcel(valorColumna(row,['categoria','categoría']))||'Otros',
        descripcion:textoExcel(valorColumna(row,['descripcion','descripción'])),
        codigoImportado:textoExcel(valorColumna(row,['codigo','código'])).toUpperCase(),
        talle:textoExcel(valorColumna(row,['talle','talla']))||'Único',
        color:textoExcel(valorColumna(row,['color'])),
        stock:Math.max(0,Number(valorColumna(row,['stock','cantidad']))||0),
        costo:textoExcel(valorColumna(row,['costo','costo unitario'])),
        precio:textoExcel(valorColumna(row,['precio','precio de venta']))
      })).filter(row=>row.nombre);
      if(!normalizadas.length) throw new Error('La planilla no tiene prendas con nombre');
      const nuevosPorClave=new Map();
      for(const fila of normalizadas){
        if(buscarProductoPorNombre(fila.nombre,fila.descripcion)) continue;
        const clave=JSON.stringify([fila.nombre.toLowerCase(),fila.descripcion.toLowerCase()]);
        if(!nuevosPorClave.has(clave)) nuevosPorClave.set(clave,{num:null});
      }
      if(nuevosPorClave.size){
        const numeros=await reservarNumerosProductos(nuevosPorClave.size);
        [...nuevosPorClave.values()].forEach((registro,i)=>registro.num=numeros[i]);
      }
      let actualizadas = 0; let creadas = 0;
      for(const fila of normalizadas){
        const {nombre,categoria,descripcion,codigoImportado,talle,color,stock,costo:costoTexto,precio:precioTexto}=fila;
        let codigo = codigoImportado;
        let producto = buscarProductoPorNombre(nombre, descripcion);
        if(!producto){
          const clave=JSON.stringify([nombre.toLowerCase(),descripcion.toLowerCase()]), reserva=nuevosPorClave.get(clave);
          if(!reserva) throw new Error('No se pudo reservar el número de una prenda nueva');
          producto = {id:uid(), num:reserva.num, nombre, descripcion, categoria, costo:Number(costoTexto)||0, precio:Number(precioTexto)||0, variantes:[]};
          state.productos.push(producto); creadas++;
        }else{
          if(descripcion) producto.descripcion = descripcion;
          if(categoria) producto.categoria = categoria;
          if(costoTexto!=='') producto.costo = Number(costoTexto)||0;
          if(precioTexto!=='') cambiarPrecioProducto(producto, Number(precioTexto)||0);
        }
        marcarProductoSucio(producto);
        if(!state.config.categorias.some(c=>c.toLowerCase()===categoria.toLowerCase())) state.config.categorias.push(categoria);
        let variante = producto.variantes.find(v=>mismaTalleColor(v,talle,color));
        if(!variante){
          if(!codigo) codigo = claveAutomatica(producto, talle, color);
          variante = {id:uid(), talle, color, codigo, stock};
          producto.variantes.push(variante);
          registrarVarianteEnIndiceBusqueda(producto,variante);
          registrarEtiquetasPendientes(variante.id,stock);
        }else{
          if(codigoImportado && codigoImportado!==variante.codigo){ quitarVarianteDelIndiceBusqueda(producto,variante); variante.codigo = codigoImportado; }
          const diferenciaStock=stock-Number(variante.stock||0);
          if(diferenciaStock>0) registrarEtiquetasPendientes(variante.id,diferenciaStock);
          else if(diferenciaStock<0) retirarEtiquetasPendientes(variante.id,Math.abs(diferenciaStock));
          variante.stock = stock;
        }
        marcarVarianteSucia(producto,variante);
        actualizadas++;
      }
      if(!actualizadas) throw new Error('sin productos válidos');
      registrarMovimiento('Stock importado (Excel)', actualizadas+' fila(s), '+creadas+' producto(s) nuevo(s)');
      save();
      showToast('Stock importado: '+actualizadas+' fila(s), '+creadas+' producto(s) nuevo(s)');
      renderAll();
    }catch(e){ console.error(e); showToast(e.message||'No se pudo leer la planilla. Usá la plantilla del botón Descargar stock.'); }
  };
  reader.readAsArrayBuffer(file);
}
function importarDatos(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data.productos || !data.ventas) throw new Error('formato inválido');
      if(!data.config.categorias) data.config.categorias = DEFAULT_CATEGORIAS.slice();
      if(!data.config.pins) data.config.pins = { admin:"1234", empleado:"0000" };
      if(!data.devoluciones) data.devoluciones = [];
      if(typeof data.etiquetasInicialesImpresas!=='boolean'){
        data.etiquetasInicialesImpresas=!!data.etiquetasPendientes
          && Object.keys(data.etiquetasPendientes).length===0
          && data.productos.some(producto=>producto.variantes.some(variante=>Number(variante.stock)>0));
      }
      if(!data.etiquetasPendientes || typeof data.etiquetasPendientes!=='object') data.etiquetasPendientes = {};
      if(!Array.isArray(data.movimientos)) data.movimientos = [];
      if(!Array.isArray(data.promociones)) data.promociones = [];
      const comprasRespaldo=Array.isArray(data.compras)?data.compras:[];
      state = data;
      state.compras=[];
      marcarCatalogoCompletoSucio();
      await sincronizar();
      if(estadoSync==='error') throw new Error('No se pudieron guardar los datos del respaldo antes de restaurar las compras');
      await reemplazarComprasDesdeRespaldo(comprasRespaldo);
      registrarMovimiento('Copia importada','Se restauraron los datos desde un archivo de copia');
      await sincronizar();
      if(estadoSync==='error') throw new Error('La copia se importó parcialmente; revisá la conexión antes de volver a intentarlo');
      await cargarComprasDesdeSupabase(0);
      showToast('Datos importados');
      renderAll();
    }catch(e){
      console.error(e);
      showToast(e.message||'El archivo no es una copia válida');
    }
  };
  reader.readAsText(file);
}
async function borrarTodo(){
  if(session!=='admin'){ showToast('Solo el administrador puede borrar todo'); return; }
  if(!confirm('Esto borra todo: productos, ventas, turnos, compras y facturas. ¿Seguro?')) return;
  if(!confirm('Última confirmación: no se puede deshacer. ¿Borrar todo?')) return;
  try{
    await sincronizar();
    // Facturas y ventas no se sincronizan solas: se borran directo en la nube
    // (al borrar las ventas se van también sus ítems, costos y pagos).
    for(const t of ['solicitudes_factura','ventas','compras']){
      const {error} = await sb.from(t).delete().neq('id','');
      if(error) throw error;
    }
  }catch(e){ showToast('No se pudo borrar: '+(e.message||e)); return; }
  facturas = []; facSel.clear();
  const movimientosPrevios = state.movimientos || [];
  state = defaultState();
  marcarCatalogoCompletoSucio();
  state.movimientos = movimientosPrevios;
  registrarMovimiento('Datos borrados','Se borraron todos los datos del sistema');
  save();
  showToast('Datos borrados');
  renderAll();
}
