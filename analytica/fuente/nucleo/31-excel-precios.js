/* ══════════════════════════════════════════════════════════════════════════
   EXCEL DE ARKEN PRECIOS (§4.3) — el mismo que ARKEN CONTROL importa en su
   módulo 04: primera hoja, encabezado en la primera fila cuya columna A
   contiene «categor», columnas A Categoría · B Unidad · C Descripción del
   insumo · D Precio unitario (con IVA incluido). Se conservan las filas con
   columna C no vacía. El emparejamiento es por descripción normalizada.
   ══════════════════════════════════════════════════════════════════════════ */
const ExcelPrecios = (function(){

  /** { filas:[{ fila, categoria, unidad, nombre, precio }], avisos[], errores[] } */
  function leer(wb){
    const errores = [], avisos = [];
    const nombreHoja = wb.SheetNames[0];
    if (!nombreHoja){ errores.push('El libro no tiene hojas.'); return { filas:[], avisos, errores }; }
    const datos = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header:1, defval:'' });
    const iEnc = datos.findIndex(r => Util.normaliza(r[0]).indexOf('categor') >= 0);
    if (iEnc < 0){
      errores.push('No se encontró la fila de encabezado: ninguna fila de la hoja «' + nombreHoja + '» tiene «Categoría» en la columna A.');
      return { filas:[], avisos, errores };
    }
    const filas = [];
    for (let i = iEnc + 1; i < datos.length; i++){
      const r = datos[i] || [];
      const nombre = String(r[2]||'').trim();
      if (!nombre) continue;
      let categoria = String(r[0]||'').trim();
      if (Calculo.CATEGORIAS_INSUMO.indexOf(categoria) < 0){
        avisos.push('Fila ' + (i+1) + ': la categoría «' + categoria + '» no es una de las siete de ARKEN; se usará «Materiales».');
        categoria = 'Materiales';
      }
      const precio = Number(r[3]);
      if (!isFinite(precio) || precio < 0){
        avisos.push('Fila ' + (i+1) + ': el precio de «' + nombre + '» no es un número válido; la fila no se usará.');
        continue;
      }
      filas.push({ fila:i+1, categoria, unidad:String(r[1]||'').trim() || 'UN', nombre, precio });
    }
    return { filas, avisos, errores };
  }

  /** Vista previa de la actualización de la base de precios: qué cambia,
      qué es nuevo y qué queda igual. No escribe nada. */
  function compararConBase(filas, base){
    const porNombre = new Map();
    (base||[]).forEach(i => porNombre.set(Util.normaliza(i.nombre), i));
    const cambios = [], nuevos = [], iguales = [];
    filas.forEach(f => {
      const ex = porNombre.get(Util.normaliza(f.nombre));
      if (!ex) nuevos.push(f);
      else if (Math.abs(Number(ex.precio||0) - f.precio) >= 0.0005) cambios.push({ insumo:ex, antes:Number(ex.precio||0), despues:f.precio, fila:f.fila });
      else iguales.push(f);
    });
    return { cambios, nuevos, iguales };
  }
  return { leer, compararConBase };
})();
