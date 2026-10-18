/* ══════════════════════════════════════════════════════════════════════════
   EXCEL DE PRESUPUESTO DE ARKEN CONTROL (contrato, §4.2 y Anexo A)

   ubicarColumnas, leerHojaExcel, COLS_*_IMP y validarPresupuestoExcel son
   COPIA FIEL de programa/ARKEN_CONTROL.html (versión 1.26.10). No se
   «mejoran» aquí: si ARKEN cambia su lector, se vuelven a copiar. Con ellos
   ANALYTICA relee cada libro que genera exactamente como lo leerá ARKEN y no
   deja guardarlo si ARKEN fuera a encontrar un solo error. La prueba
   pruebas/ida-y-vuelta.mjs lo confirma contra el ARKEN_CONTROL.html real.

   Lo propio de ANALYTICA va al final: armar el libro (Instrucciones,
   Insumos, APU, Actividades y Resumen), convertir un plan validado en un
   presupuesto, y leer el AIU de la hoja Resumen cuando el libro es nuestro.
   ══════════════════════════════════════════════════════════════════════════ */
const ExcelArken = (function(){
  const normaliza = Util.normaliza;
  const CATEGORIAS_INSUMO = Calculo.CATEGORIAS_INSUMO;

  /* ─────────── Copia fiel de ARKEN CONTROL: inicio ─────────── */
function ubicarColumnas(encabezado, reglas){
  const normE = (encabezado||[]).map(c => normaliza(c||''));
  const usada = new Array(normE.length).fill(false);
  const cumpleGrupo = (texto, grupo) => (grupo||[]).every(w => texto.indexOf(w) >= 0);
  const col = {};
  reglas.forEach(r => {
    const alternativas = Array.isArray(r.si[0]) ? r.si : [r.si];
    let idx = -1;
    for (let i = 0; i < normE.length; i++){
      if (usada[i]) continue;
      if ((r.no||[]).some(w => normE[i].indexOf(w) >= 0)) continue;
      if (alternativas.some(alt => cumpleGrupo(normE[i], alt))){ idx = i; break; }
    }
    if (idx >= 0) usada[idx] = true;
    col[r.k] = idx;
  });
  return col;
}

/** Encuentra, dentro del libro, la hoja cuyo nombre contiene "palabraHoja"
    (sin acentos ni mayúsculas) y, dentro de ella, la fila de encabezado real:
    la primera con al menos 3 celdas no vacías que además contenga
    "palabraEncabezado". El mínimo de 3 celdas es lo que evita confundir el
    encabezado con el título de una sola celda que antepone Documentos.excel
    a cada hoja (p. ej. "...y Actividades del presupuesto" también contiene
    "activ", pero cabe en una sola celda). Las filas de datos guardan su
    número real de Excel (1-based) para que los errores señalen la fila exacta. */
function leerHojaExcel(wb, palabraHoja, palabraEncabezado){
  const nombreHoja = wb.SheetNames.find(n => normaliza(n).indexOf(palabraHoja) >= 0);
  if (!nombreHoja) return null;
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header:1, defval:'' });
  const iEnc = filas.findIndex(r => r.filter(c => String(c||'').trim() !== '').length >= 3 &&
    r.some(c => normaliza(c||'').indexOf(palabraEncabezado) >= 0));
  if (iEnc < 0) return { nombreHoja, encabezado:null, datos:[] };
  const datos = [];
  for (let i = iEnc + 1; i < filas.length; i++){
    const r = filas[i];
    if (!r || r.every(c => String(c||'').trim() === '')) continue; // fila en blanco: se ignora, no corta la lectura
    datos.push({ fila:i + 1, celdas:r });
  }
  return { nombreHoja, encabezado:filas[iEnc], datos };
}

const COLS_ACTIVIDADES_IMP = [
  // "sub" se excluye de codCap/nomCap porque "subcapitulo" contiene "capitulo"
  // como subcadena: sin el no:['sub'], la columna de "Código subcapítulo"
  // podía confundirse con la de "Código capítulo" si aparecía antes en la hoja.
  { k:'codCap', si:['codigo','capitulo'], no:['sub'] },
  { k:'nomCap', si:['capitulo'], no:['codigo','sub'] },
  { k:'codSub', si:['codigo','sub'] },
  { k:'nomSub', si:['sub'], no:['codigo'] },
  { k:'codAct', si:['codigo','activ'] },
  { k:'nomAct', si:['activ'], no:['codigo'] },
  { k:'unidad', si:['unidad'] },
  { k:'cantidad', si:['cantidad'] },
  { k:'apu', si:['apu'] }
];
const COLS_APU_IMP = [
  { k:'codApu', si:['codigo','apu'] },
  { k:'nomApu', si:['apu'], no:['codigo'] },
  { k:'unidad', si:['unidad'] },
  { k:'codIns', si:['codigo','insumo'] },
  { k:'cantidad', si:['cantidad'] }
];
const COLS_INSUMOS_IMP = [
  { k:'codigo', si:['codigo'] },
  { k:'categoria', si:['categor'] },
  { k:'nombre', si:[['descrip'],['nombre']], no:['apu','capitulo','sub','activ'] },
  { k:'unidad', si:['unidad'] },
  { k:'precio', si:['precio'] }
];


function validarPresupuestoExcel(p, wb){
  const errores = [], avisos = [];
  const err = (hoja, fila, msg) => errores.push({ hoja, fila, msg });
  const avi = (hoja, fila, msg) => avisos.push({ hoja, fila, msg });

  /* ---- Insumos (opcional: un presupuesto puede usar sólo insumos que ya existen) ---- */
  const hIns = leerHojaExcel(wb, 'insumo', 'codigo');
  const insumosPorCodigo = new Map();
  if (hIns && hIns.encabezado){
    const col = ubicarColumnas(hIns.encabezado, COLS_INSUMOS_IMP);
    if (col.codigo < 0 || col.nombre < 0){
      err(hIns.nombreHoja, 0, 'No se encontraron en el encabezado las columnas "Código" y/o "Descripción".');
    } else {
      hIns.datos.forEach(r => {
        const codigo = String(r.celdas[col.codigo]||'').trim();
        const nombre = String(r.celdas[col.nombre]||'').trim();
        if (!codigo && !nombre) return;
        if (!codigo){ err(hIns.nombreHoja, r.fila, 'Falta el código de referencia del insumo.'); return; }
        if (!nombre){ err(hIns.nombreHoja, r.fila, 'Falta la descripción del insumo "' + codigo + '".'); return; }
        const key = normaliza(codigo);
        if (insumosPorCodigo.has(key)){
          err(hIns.nombreHoja, r.fila, 'El código "' + codigo + '" ya se usó en la fila ' + insumosPorCodigo.get(key).fila + ' de esta misma hoja.');
          return;
        }
        let categoria = col.categoria >= 0 ? String(r.celdas[col.categoria]||'').trim() : '';
        if (categoria && CATEGORIAS_INSUMO.indexOf(categoria) < 0){
          avi(hIns.nombreHoja, r.fila, 'La categoría "' + categoria + '" no es una categoría válida; se usará "Materiales".');
          categoria = '';
        }
        if (!categoria) categoria = 'Materiales';
        const unidad = (col.unidad >= 0 && String(r.celdas[col.unidad]||'').trim()) || 'UN';
        let precio = col.precio >= 0 ? Number(r.celdas[col.precio]) : NaN;
        if (!isFinite(precio) || precio < 0){
          if (col.precio >= 0 && String(r.celdas[col.precio]||'').trim() !== '')
            avi(hIns.nombreHoja, r.fila, 'El precio de "' + nombre + '" no es un número válido; se usará 0.');
          precio = 0;
        }
        const existente = p.insumos.find(i => normaliza(i.nombre) === normaliza(nombre) || normaliza(i.codigo) === key) || null;
        insumosPorCodigo.set(key, { fila:r.fila, codigo, categoria, nombre, unidad, precio, existente });
      });
    }
  }

  /* ---- APU ---- */
  const hApu = leerHojaExcel(wb, 'apu', 'apu');
  const apusPorCodigo = new Map();
  if (!hApu || !hApu.encabezado){
    err('APU', 0, 'No se encontró la hoja "APU" (o no tiene un encabezado reconocible) en el archivo.');
  } else {
    const col = ubicarColumnas(hApu.encabezado, COLS_APU_IMP);
    const faltan = ['codApu','codIns','cantidad'].filter(k => col[k] < 0);
    if (faltan.length){
      err(hApu.nombreHoja, 0, 'No se encontraron en el encabezado las columnas necesarias: ' + faltan.join(', ') + '.');
    } else {
      hApu.datos.forEach(r => {
        const codApu = String(r.celdas[col.codApu]||'').trim();
        const codIns = String(r.celdas[col.codIns]||'').trim();
        if (!codApu && !codIns) return;
        if (!codApu){ err(hApu.nombreHoja, r.fila, 'Falta el código del APU.'); return; }
        if (!codIns){ err(hApu.nombreHoja, r.fila, 'Falta el código del insumo para el APU "' + codApu + '".'); return; }
        let cantidad = Number(r.celdas[col.cantidad]);
        if (!isFinite(cantidad) || cantidad < 0){
          err(hApu.nombreHoja, r.fila, 'La cantidad del insumo "' + codIns + '" en el APU "' + codApu + '" no es un número válido.');
          return;
        }
        if (cantidad === 0) avi(hApu.nombreHoja, r.fila, 'La cantidad del insumo "' + codIns + '" es cero: no aportará nada al APU "' + codApu + '".');

        const keyIns = normaliza(codIns);
        const enHoja = insumosPorCodigo.has(keyIns);
        const existenteProyecto = !enHoja ? p.insumos.find(i => normaliza(i.codigo) === keyIns) : null;
        if (!enHoja && !existenteProyecto){
          err(hApu.nombreHoja, r.fila, 'El código de insumo "' + codIns + '" (APU "' + codApu + '") no aparece en la hoja Insumos ni existe en el proyecto.');
          return;
        }

        const key = normaliza(codApu);
        let grupo = apusPorCodigo.get(key);
        const nomApu = col.nomApu >= 0 ? String(r.celdas[col.nomApu]||'').trim() : '';
        const unApu = col.unidad >= 0 ? String(r.celdas[col.unidad]||'').trim() : '';
        if (!grupo){
          if (!nomApu){ err(hApu.nombreHoja, r.fila, 'El APU "' + codApu + '" no tiene nombre en su primera aparición.'); return; }
          const existente = p.apus.find(a => normaliza(a.nombre) === normaliza(nomApu)) || null;
          grupo = { fila:r.fila, codigo:codApu, nombre:nomApu, unidad: unApu || 'UN', insumos:[], existente };
          apusPorCodigo.set(key, grupo);
        } else {
          if (nomApu && normaliza(nomApu) !== normaliza(grupo.nombre))
            avi(hApu.nombreHoja, r.fila, 'El nombre "' + nomApu + '" no coincide con "' + grupo.nombre + '" (fila ' + grupo.fila + ') para el mismo APU "' + codApu + '"; se usará el de la primera fila.');
          if (unApu && normaliza(unApu) !== normaliza(grupo.unidad))
            avi(hApu.nombreHoja, r.fila, 'La unidad "' + unApu + '" no coincide con "' + grupo.unidad + '" (fila ' + grupo.fila + ') para el mismo APU "' + codApu + '"; se usará la de la primera fila.');
        }
        grupo.insumos.push({ codigoInsumo:codIns, cantidad, fila:r.fila });
      });
    }
  }

  /* ---- Actividades ---- */
  const hAct = leerHojaExcel(wb, 'activ', 'activ');
  const capitulos = [];
  const capPorCodigo = new Map(), subPorCodigo = new Map(), actPorSub = new Map();
  if (!hAct || !hAct.encabezado){
    err('Actividades', 0, 'No se encontró la hoja "Actividades" (o no tiene un encabezado reconocible) en el archivo.');
  } else {
    const col = ubicarColumnas(hAct.encabezado, COLS_ACTIVIDADES_IMP);
    const faltan = ['codCap','nomCap','codSub','nomSub','codAct','nomAct','apu'].filter(k => col[k] < 0);
    if (faltan.length){
      err(hAct.nombreHoja, 0, 'No se encontraron en el encabezado las columnas necesarias: ' + faltan.join(', ') + '.');
    } else {
      let capActual = null, subActual = null;
      hAct.datos.forEach(r => {
        const codCapCelda = String(r.celdas[col.codCap]||'').trim();
        const codActCelda = String(r.celdas[col.codAct]||'').trim();
        const nomActCelda = String(r.celdas[col.nomAct]||'').trim();
        const codSubCelda = String(r.celdas[col.codSub]||'').trim();
        if (!codCapCelda && !codSubCelda && !codActCelda && !nomActCelda) return;

        if (codCapCelda){
          const key = normaliza(codCapCelda);
          let cap = capPorCodigo.get(key);
          const nomCap = String(r.celdas[col.nomCap]||'').trim();
          if (!cap){
            if (!nomCap){ err(hAct.nombreHoja, r.fila, 'El capítulo "' + codCapCelda + '" no tiene nombre en su primera aparición.'); return; }
            cap = { codigo:codCapCelda, nombre:nomCap, subs:[], fila:r.fila };
            capPorCodigo.set(key, cap); capitulos.push(cap);
          } else if (nomCap && normaliza(nomCap) !== normaliza(cap.nombre)){
            avi(hAct.nombreHoja, r.fila, 'El nombre "' + nomCap + '" no coincide con "' + cap.nombre + '" (fila ' + cap.fila + ') para el capítulo "' + codCapCelda + '"; se usará el de la primera fila.');
          }
          capActual = cap;
        }
        if (!capActual){ err(hAct.nombreHoja, r.fila, 'Falta el código del capítulo (ninguna fila anterior lo definió).'); return; }

        if (codSubCelda){
          const key = normaliza(codSubCelda);
          let sub = subPorCodigo.get(key);
          const nomSub = String(r.celdas[col.nomSub]||'').trim();
          if (!sub){
            if (!nomSub){ err(hAct.nombreHoja, r.fila, 'El subcapítulo "' + codSubCelda + '" no tiene nombre en su primera aparición.'); return; }
            sub = { codigo:codSubCelda, nombre:nomSub, acts:[], fila:r.fila, capKey:normaliza(capActual.codigo) };
            subPorCodigo.set(key, sub); capActual.subs.push(sub);
          } else if (sub.capKey !== normaliza(capActual.codigo)){
            err(hAct.nombreHoja, r.fila, 'El subcapítulo "' + codSubCelda + '" ya aparece bajo otro capítulo (fila ' + sub.fila + '); un subcapítulo no puede repetirse en dos capítulos distintos.');
            return;
          } else if (nomSub && normaliza(nomSub) !== normaliza(sub.nombre)){
            avi(hAct.nombreHoja, r.fila, 'El nombre "' + nomSub + '" no coincide con "' + sub.nombre + '" (fila ' + sub.fila + ') para el subcapítulo "' + codSubCelda + '"; se usará el de la primera fila.');
          }
          subActual = sub;
        }
        if (!subActual || subActual.capKey !== normaliza(capActual.codigo)){
          err(hAct.nombreHoja, r.fila, 'Falta el código del subcapítulo (ninguna fila anterior, dentro de este capítulo, lo definió).');
          return;
        }

        if (!codActCelda){ err(hAct.nombreHoja, r.fila, 'Falta el código de la actividad.'); return; }
        if (!nomActCelda){ err(hAct.nombreHoja, r.fila, 'Falta el nombre de la actividad "' + codActCelda + '".'); return; }
        const keyAct = subActual.capKey + '|' + normaliza(subActual.codigo) + '|' + normaliza(codActCelda);
        if (actPorSub.has(keyAct)){
          err(hAct.nombreHoja, r.fila, 'El código de actividad "' + codActCelda + '" ya se usó en este mismo subcapítulo (fila ' + actPorSub.get(keyAct) + ').');
          return;
        }
        actPorSub.set(keyAct, r.fila);

        const unidad = (col.unidad >= 0 && String(r.celdas[col.unidad]||'').trim()) || 'UN';
        let cantidad = col.cantidad >= 0 ? Number(r.celdas[col.cantidad]) : 0;
        if (!isFinite(cantidad) || cantidad < 0){
          avi(hAct.nombreHoja, r.fila, 'La cantidad de "' + nomActCelda + '" no es un número válido; se usará 0.');
          cantidad = 0;
        }
        const apuTexto = String(r.celdas[col.apu]||'').trim();
        if (!apuTexto){ err(hAct.nombreHoja, r.fila, 'La actividad "' + nomActCelda + '" no tiene ningún código de APU.'); return; }
        const codigosApu = apuTexto.split(/[,+]/).map(s => s.trim()).filter(Boolean);
        const apusResueltos = [];
        let faltaApu = false;
        codigosApu.forEach(cod => {
          if (!apusPorCodigo.has(normaliza(cod))){
            err(hAct.nombreHoja, r.fila, 'El código de APU "' + cod + '" (actividad "' + nomActCelda + '") no aparece en la hoja APU.');
            faltaApu = true;
          } else apusResueltos.push(cod);
        });
        if (faltaApu) return;

        subActual.acts.push({ codigo:codActCelda, nombre:nomActCelda, unidad, cantidad, apus:apusResueltos, fila:r.fila });
      });
    }
  }

  return {
    errores, avisos,
    capitulos,
    apus: Array.from(apusPorCodigo.values()),
    insumos: Array.from(insumosPorCodigo.values())
  };
}
  /* ─────────── Copia fiel de ARKEN CONTROL: fin ─────────── */

  /* ═══════════ Lo que agrega ANALYTICA ═══════════ */

  const ENC_INSUMOS = ['Código (referencia en este archivo)','Categoría','Descripción del insumo','Unidad','Precio unitario (con IVA incluido)'];
  const ENC_APU = ['Código APU','Nombre del APU','Unidad del APU','Código insumo','Cantidad (rendimiento)'];
  const ENC_ACT = ['Código capítulo','Capítulo','Código subcapítulo','Subcapítulo','Código actividad','Actividad','Unidad','Cantidad','Código(s) de APU'];

  /** Hojas del libro, como las arma exportarPresupuestoImportable de ARKEN
      (solo los APU e insumos que usa alguna actividad), más Instrucciones
      al principio y Resumen al final. meta = { proceso, versionPliego, proponente }. */
  function hojasPresupuesto(pres, meta){
    const m = meta || {};
    const apusUsados = new Map(), insumosUsados = new Map();
    Calculo.recorrerActividades(pres, act => (act.apus||[]).forEach(id => {
      if (apusUsados.has(id)) return;
      const ap = Calculo.apu(pres, id); if (!ap) return;
      apusUsados.set(id, ap);
      (ap.insumos||[]).forEach(x => {
        const ins = Calculo.insumo(pres, x.idInsumo);
        if (ins && !insumosUsados.has(ins.id)) insumosUsados.set(ins.id, ins);
      });
    }));
    // El código de insumo es una referencia dentro del archivo y no puede
    // repetirse: si el presupuesto trae dos iguales o uno vacío, se numera.
    const codigoIns = new Map(), vistos = new Set();
    let n = 0;
    insumosUsados.forEach(ins => {
      let c = String(ins.codigo||'').trim();
      if (!c || vistos.has(normaliza(c))){ do { n++; c = 'INS-' + String(n).padStart(4,'0'); } while (vistos.has(normaliza(c))); }
      vistos.add(normaliza(c)); codigoIns.set(ins.id, c);
    });
    const hIns = [ENC_INSUMOS];
    insumosUsados.forEach(i => hIns.push([codigoIns.get(i.id), i.categoria, i.nombre, i.unidad, Util.redondearDec(Number(i.precio||0), 3)]));
    const hApu = [ENC_APU];
    apusUsados.forEach(ap => (ap.insumos||[]).forEach((x, k) => {
      hApu.push([ap.codigo, k === 0 ? ap.nombre : '', k === 0 ? ap.unidad : '', codigoIns.get(x.idInsumo) || '', Number(x.cantidad||0)]);
    }));
    const hAct = [ENC_ACT];
    (pres.capitulos||[]).forEach(cap => (cap.subs||[]).forEach(sub => (sub.acts||[]).forEach(a => {
      const cods = (a.apus||[]).map(id => { const x = Calculo.apu(pres, id); return x ? x.codigo : ''; }).filter(Boolean).join(', ');
      hAct.push([cap.codigo, cap.nombre, sub.codigo, sub.nombre, a.codigo, a.nombre, a.unidad, Number(a.cantidad||0), cods]);
    })));
    const t = Calculo.totales(pres);
    const hRes = [
      ['Concepto','Porcentaje','Valor'],
      ['Costo directo', '', t.costoDirecto],
      ['Administración (A)', t.pctA, t.a],
      ['Imprevistos (I)', t.pctI, t.i],
      ['Utilidad (U)', t.pctU, t.u],
      ['Subtotal', '', t.subtotal],
      ['IVA (' + ({ utilidad:'sobre la utilidad', total:'sobre el total', ninguno:'no aplica' })[t.modoIva] + ')', t.tarifaIva, t.iva],
      ['Total', '', t.total],
      [],
      ['Proceso', m.proceso || ''],
      ['Versión del pliego', m.versionPliego || ''],
      ['Proponente', m.proponente || 'Presupuesto base de la EMPRESA PRINCIPAL'],
      [],
      ['ARKEN CONTROL no lee el AIU de este libro. Después de importar, digítelo en su módulo 03: A ' +
        t.pctA + ' %, I ' + t.pctI + ' %, U ' + t.pctU + ' %.']
    ];
    const hInstr = [
      ['CÓMO LLEVAR ESTE PRESUPUESTO A ARKEN CONTROL'],
      [],
      ['1. En ARKEN CONTROL abra el proyecto y vaya al módulo 03 · Presupuesto.'],
      ['2. Elija «Importar desde Excel» y seleccione este archivo.'],
      ['3. Revise el resumen que muestra ARKEN: capítulos, subcapítulos, actividades, APU e insumos.'],
      ['4. Elija Reemplazar (borra el presupuesto actual del proyecto y crea este) o Adicionar (conserva lo que existe y actualiza por código).'],
      ['5. Confirme.'],
      ['6. Digite el AIU a mano en el módulo 03: A ' + t.pctA + ' %, I ' + t.pctI + ' %, U ' + t.pctU + ' %. ARKEN no lo lee del archivo; está en la hoja Resumen.'],
      [],
      ['No cambie los nombres de las hojas ni el texto de los encabezados. Los precios de insumo van con IVA incluido, como se cotizan en obra.']
    ];
    return [
      { nombre:'Instrucciones', titulo:'Cómo llevar este presupuesto a ARKEN CONTROL', filas:hInstr, anchos:[110] },
      { nombre:'Insumos', titulo:'Insumos usados en este presupuesto', filas:hIns, anchos:[14,16,44,10,22] },
      { nombre:'APU', titulo:'Análisis de precios unitarios usados en este presupuesto', filas:hApu, anchos:[12,40,12,16,18] },
      { nombre:'Actividades', titulo:'Capítulos, subcapítulos y actividades de este presupuesto', filas:hAct, anchos:[12,26,14,26,12,34,8,10,16] },
      { nombre:'Resumen', titulo:'AIU, IVA y totales', filas:hRes, anchos:[46,12,20] }
    ];
  }

  /** Libro de SheetJS. Las filas de título imitan las de Documentos.excel de
      ARKEN, pero la del sello va en dos celdas y no en cuatro: una fila de
      título con 3 o más celdas podría confundirse con el encabezado si el
      nombre del usuario contuviera «apu» o «activ». */
  function libro(hojas, empresa, usuario){
    const wb = XLSX.utils.book_new();
    hojas.forEach(h => {
      const titulo = [
        ['ARKEN ANALYTICA — ' + (empresa || 'Empresa principal')],
        [h.titulo || h.nombre],
        ['Generado: ' + Util.fmtSello(Date.now()), 'Usuario: ' + (usuario || '')],
        []
      ];
      const ws = XLSX.utils.aoa_to_sheet(titulo.concat(h.filas));
      if (h.anchos) ws['!cols'] = h.anchos.map(w => ({ wch:w }));
      XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0,31));
    });
    return wb;
  }

  /** Lo que leerá ARKEN de un libro: la validación de ARKEN sobre un
      proyecto vacío (así lo encuentra «Reemplazar») y los conteos. */
  function revisar(wb){
    const plan = validarPresupuestoExcel({ insumos:[], apus:[] }, wb);
    let subs = 0, acts = 0;
    plan.capitulos.forEach(c => { subs += c.subs.length; c.subs.forEach(s => acts += s.acts.length); });
    return { plan, errores:plan.errores, avisos:plan.avisos,
      conteo:{ capitulos:plan.capitulos.length, subcapitulos:subs, actividades:acts, apus:plan.apus.length, insumos:plan.insumos.length } };
  }

  /** AIU de la hoja Resumen, si el libro la trae (solo los que escribe ANALYTICA). */
  function leerResumen(wb){
    const nombre = wb.SheetNames.find(n => normaliza(n) === 'resumen');
    if (!nombre) return null;
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header:1, defval:'' });
    const buscar = (palabra) => { const r = filas.find(f => normaliza(f[0]).indexOf(palabra) === 0); return r ? Number(r[1]) : NaN; };
    const a = buscar('administracion'), i = buscar('imprevistos'), u = buscar('utilidad');
    if (![a, i, u].every(isFinite)) return null;
    const filaIva = filas.find(f => normaliza(f[0]).indexOf('iva') === 0);
    let iva = null;
    if (filaIva){
      const t = normaliza(filaIva[0]);
      iva = { tarifa:Number(filaIva[1])||0, base: t.indexOf('utilidad') >= 0 ? 'utilidad' : t.indexOf('total') >= 0 ? 'total' : 'ninguno' };
    }
    return { aiu:{ a, i, u }, iva };
  }

  /** Convierte un plan sin errores en un presupuesto de ANALYTICA.
      modo 'reemplazar': el presupuesto queda solo con lo del archivo.
      modo 'adicionar': como en ARKEN, un capítulo o subcapítulo con el mismo
      código se reutiliza y una actividad con el mismo código en el mismo
      subcapítulo se actualiza; insumos y APU se reutilizan por descripción
      o nombre normalizados, y actualizarPrecios decide si el precio cambia. */
  function aplicarPlan(pres, plan, opciones){
    const op = Object.assign({ modo:'reemplazar', actualizarPrecios:true }, opciones||{});
    if (plan.errores && plan.errores.length) throw new Error('El libro tiene errores: no se puede importar.');
    if (op.modo === 'reemplazar'){ pres.capitulos = []; pres.apus = []; pres.insumos = []; }
    const idIns = new Map();
    plan.insumos.forEach(f => {
      let ins = pres.insumos.find(i => normaliza(i.nombre) === normaliza(f.nombre));
      if (ins){ if (op.actualizarPrecios) Object.assign(ins, { unidad:f.unidad, categoria:f.categoria, precio:f.precio }); }
      else {
        ins = { id:Util.uid('in'), codigo:f.codigo, nombre:f.nombre, unidad:f.unidad, categoria:f.categoria, precio:f.precio };
        pres.insumos.push(ins);
      }
      idIns.set(normaliza(f.codigo), ins.id);
    });
    const idApu = new Map();
    plan.apus.forEach(g => {
      const lineas = g.insumos.map(x => ({ idInsumo: idIns.get(normaliza(x.codigoInsumo)) ||
        (pres.insumos.find(i => normaliza(i.codigo) === normaliza(x.codigoInsumo)) || {}).id, cantidad:x.cantidad }))
        .filter(l => l.idInsumo);
      let ap = pres.apus.find(a => normaliza(a.codigo) === normaliza(g.codigo));
      if (ap) Object.assign(ap, { nombre:g.nombre, unidad:g.unidad, insumos:lineas });
      else { ap = { id:Util.uid('ap'), codigo:g.codigo, nombre:g.nombre, unidad:g.unidad, insumos:lineas }; pres.apus.push(ap); }
      idApu.set(normaliza(g.codigo), ap.id);
    });
    plan.capitulos.forEach(cp => {
      let cap = pres.capitulos.find(c => normaliza(c.codigo) === normaliza(cp.codigo));
      if (!cap){ cap = { id:Util.uid('cp'), codigo:cp.codigo, nombre:cp.nombre, subs:[] }; pres.capitulos.push(cap); }
      else cap.nombre = cp.nombre;
      cp.subs.forEach(sp => {
        let sub = cap.subs.find(s => normaliza(s.codigo) === normaliza(sp.codigo));
        if (!sub){ sub = { id:Util.uid('sb'), codigo:sp.codigo, nombre:sp.nombre, acts:[] }; cap.subs.push(sub); }
        else sub.nombre = sp.nombre;
        sp.acts.forEach(ap => {
          const apus = ap.apus.map(c => idApu.get(normaliza(c))).filter(Boolean);
          let act = sub.acts.find(a => normaliza(a.codigo) === normaliza(ap.codigo));
          if (act) Object.assign(act, { nombre:ap.nombre, unidad:ap.unidad, cantidad:ap.cantidad, apus });
          else sub.acts.push({ id:Util.uid('ac'), codigo:ap.codigo, nombre:ap.nombre, unidad:ap.unidad, cantidad:ap.cantidad,
            apus, obligatorioApu:false, cantidadIncierta:false, notas:'' });
        });
      });
    });
    Calculo.invalidar(pres);
    return pres;
  }

  function nombreArchivo(codigoProceso, quien){
    return 'ARKEN_ANALYTICA_' + Util.codigoArchivo(codigoProceso) + '_' + (quien ? Util.razonSocialArchivo(quien) : 'base') + '_presupuesto.xlsx';
  }

  return { ubicarColumnas, leerHojaExcel, validarPresupuestoExcel, COLS_ACTIVIDADES_IMP, COLS_APU_IMP, COLS_INSUMOS_IMP,
    hojasPresupuesto, libro, revisar, leerResumen, aplicarPlan, nombreArchivo };
})();
