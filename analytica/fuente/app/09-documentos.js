/* ══════════════════════════════════════════════════════════════════════════
   DOCUMENTOS — PDF del presupuesto, del pliego y del acuerdo; y el
   intercambio de presupuestos con ARKEN CONTROL (§4.2) con su validador
   previo obligatorio: el libro se relee como lo leerá ARKEN y, si hay un
   solo error, no se deja guardar.
   ══════════════════════════════════════════════════════════════════════════ */
const Documentos = (function(){

  function marcaDe(p, borrador){ return [p && p.demo ? 'DEMOSTRACIÓN' : '', borrador || ''].filter(Boolean).join(' · '); }
  function guardarPdf(nombre, cfg){
    const r = Pdf.generar(cfg);
    UI.descargar(nombre, r.blob);
    return r;
  }

  /* ── Presupuesto base en PDF: los cuatro niveles de ARKEN ── */
  const NIVELES = { capitulos:'Resumen por capítulos', subcapitulos:'Capítulos y subcapítulos', actividades:'Capítulos, subcapítulos y actividades', apu:'Con análisis de precios unitarios' };
  function filasTotales(pres){
    const t = Calculo.totales(pres);
    return [['', 'Costo directo', money(t.costoDirecto)], ['', 'Administración (' + t.pctA + ' %)', money(t.a)], ['', 'Imprevistos (' + t.pctI + ' %)', money(t.i)],
      ['', 'Utilidad (' + t.pctU + ' %)', money(t.u)], ['', 'IVA ' + t.tarifaIva + ' % ' + ({ utilidad:'sobre la utilidad', total:'sobre el total', ninguno:'(no aplica)' })[t.modoIva], money(t.iva)],
      ['', 'TOTAL', money(t.total)]].map(c => ({ celdas:c }));
  }
  function bloquesPresupuesto(p, pres, nivel){
    const B = [];
    const cd = Calculo.costoDirecto(pres) || 1;
    if (nivel === 'capitulos' || nivel === 'subcapitulos'){
      const filas = [];
      (pres.capitulos||[]).forEach(c => {
        const v = Calculo.valorCapitulo(pres, c);
        filas.push({ tipo: nivel === 'subcapitulos' ? 'cap' : undefined, celdas:[c.codigo, c.nombre, money(v), Util.pct(v / cd * 100)] });
        if (nivel === 'subcapitulos') (c.subs||[]).forEach(s => { const vs = Calculo.valorSubcapitulo(pres, s); filas.push({ celdas:[s.codigo, s.nombre, money(vs), Util.pct(vs / cd * 100)] }); });
      });
      B.push({ t:'tabla', cabeza:['Código','Descripción','Valor','% del costo directo'], anchos:[20, 110, 36, 28], alinear:{ 2:'right', 3:'right' }, filas });
    } else {
      const filas = [];
      (pres.capitulos||[]).forEach(c => {
        filas.push({ tipo:'cap', celdas:[c.codigo, c.nombre, '', '', '', money(Calculo.valorCapitulo(pres, c))] });
        (c.subs||[]).forEach(s => {
          filas.push({ tipo:'sub', celdas:[s.codigo, s.nombre, '', '', '', money(Calculo.valorSubcapitulo(pres, s))] });
          (s.acts||[]).forEach(a => filas.push({ celdas:[a.codigo, a.nombre, a.unidad, cant(a.cantidad), money3(Calculo.unitarioActividad(pres, a)), money(Calculo.valorActividad(pres, a))] }));
        });
      });
      B.push({ t:'tabla', cabeza:['Código','Descripción','Unidad','Cantidad','Unitario','Valor'], anchos:[18, 82, 14, 20, 28, 30], alinear:{ 3:'right', 4:'right', 5:'right' }, filas });
    }
    B.push({ t:'sec', txt:'AIU, IVA y total' });
    B.push({ t:'tabla', cabeza:['','Concepto','Valor'], anchos:[4, 120, 40], alinear:{ 2:'right' }, filas:filasTotales(pres) });
    if (nivel === 'apu'){
      B.push({ t:'salto' });
      B.push({ t:'sec', txt:'Análisis de precios unitarios' });
      (pres.apus||[]).forEach(ap => {
        B.push({ t:'sec', nivel:2, txt:ap.codigo + ' · ' + ap.nombre + ' · ' + ap.unidad + ' · ' + money3(Calculo.unitarioAPU(pres, ap.id)) });
        B.push({ t:'tabla', cabeza:['Insumo','Categoría','Unidad','Rendimiento','Precio','Parcial'], anchos:[70, 26, 14, 22, 26, 26], alinear:{ 3:'right', 4:'right', 5:'right' },
          filas:(ap.insumos||[]).map(x => { const ins = Calculo.insumo(pres, x.idInsumo) || {}; return { celdas:[ins.nombre || '(insumo no encontrado)', ins.categoria || '', ins.unidad || '',
            cant(x.cantidad), money3(ins.precio), money3(Number(x.cantidad||0) * Number(ins.precio||0))] }; }) });
      });
    }
    return B;
  }
  function pdfPresupuesto(p, nivel){
    const pres = Modelo.presupuesto(p.id);
    guardarPdf('ARKEN_ANALYTICA_' + Util.codigoArchivo(p.codigo) + '_presupuesto_base_' + nivel + '.pdf', {
      titulo:'Presupuesto base · ' + NIVELES[nivel], subtitulo:p.codigo + ' · ' + p.nombre + ' · versión del pliego ' + p.versionPliego,
      documento:'Presupuesto base', lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, orientacion:nivel === 'apu' || nivel === 'actividades' ? 'p' : 'p',
      bloques:bloquesPresupuesto(p, pres, nivel), marcaAgua:marcaDe(p) });
    Auditoria.registrar('exportar', 'presupuesto base PDF', NIVELES[nivel], p.id);
  }

  /* ── Pliego ── */
  async function pdfPliego(p){
    Permisos.exigir('generarPliego');
    const ctx = Modelo.contextoPliego(p);
    const bloques = Pliego.bloques(ctx);
    const huellaContenido = Pliego.huellaContenido(bloques);
    ctx.huella = huellaContenido;
    const r = Pdf.generar({ titulo:'Pliego de condiciones', documento:'Pliego ' + p.codigo + ' v' + p.versionPliego,
      lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, bloques:Pliego.bloques(ctx), marcaAgua:marcaDe(p) });
    const sha256 = await Cripto.sha256(await r.blob.arrayBuffer());
    // El PDF queda guardado: va dentro de cada paquete de invitación (§13).
    await Almacen.ponerArchivo(sha256, r.blob);
    const nombre = 'Pliego_' + Util.codigoArchivo(p.codigo) + '_v' + p.versionPliego + '.pdf';
    p.pliego = { generado:{ fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario, sha256, huellaContenido, paginas:r.paginas, nombre }, revisado:false };
    await Modelo.guardarProceso(p, 'Pliego generado · ' + sha256);
    UI.descargar(nombre, r.blob);
    return p.pliego.generado;
  }

  /* ── Acuerdo de confidencialidad ── */
  function cfgConfidencialidad(p, invitado){
    const ctx = Modelo.contextoConfidencialidad(p, invitado);
    const est = Confidencialidad.estado(ctx);
    const cl = Confidencialidad.armar(ctx);
    const B = [{ t:'texto', txt:'ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN — PROCESO ' + (p.codigo||''), negrita:true, tam:10 }];
    if (est === 'aprobado') B.push({ t:'texto', gris:true, tam:7.4, txt:'Texto aprobado por ' + p.confidencialidad.aprobacion.nombre + ', T.P. ' + p.confidencialidad.aprobacion.tarjetaProfesional +
      ', el ' + Util.fmtFecha(p.confidencialidad.aprobacion.fecha) + '. Huella SHA-256 del texto: ' + p.confidencialidad.aprobacion.huella + '.' });
    cl.forEach(c => { B.push({ t:'sec', nivel:2, txt:c.titulo }); B.push({ t:'texto', txt:c.segmentos.map(s => s.t !== undefined ? s.t : s.valor).join('') }); });
    B.push({ t:'sec', nivel:2, txt:'Firmas' });
    B.push({ t:'texto', txt:'Por LA EMPRESA: ______________________________   Por EL RECEPTOR: ______________________________\nNombre y documento:                                       Nombre y documento:\nFecha:                                                     Fecha:' });
    B.push({ t:'salto' });
    B.push({ t:'texto', txt:Confidencialidad.ANEXO_1 });
    B.push({ t:'tabla', cabeza:['Nombre','Documento','Cargo','Empresa','Firma del compromiso'], anchos:[40, 26, 30, 36, 36], filas:[1,2,3,4,5,6].map(() => ({ celdas:['','','','',''] })) });
    B.push({ t:'salto' });
    B.push({ t:'texto', txt:Confidencialidad.anexo2(ctx) });
    const adv = Confidencialidad.advertenciaPais(p.pais);
    if (adv) B.unshift({ t:'texto', txt:adv, negrita:true });
    return { est, cfg:{ titulo:'', documento:'Acuerdo de confidencialidad', bloques:B, lineaIzquierda:'Proceso: ' + p.codigo,
      marcaAgua:marcaDe(p, est === 'aprobado' ? '' : p.demo ? 'BORRADOR' : 'BORRADOR · SIN APROBAR') } };
  }
  /** El acuerdo de un invitado, para el paquete (§13). */
  function blobConfidencialidad(p, invitado){ return Pdf.generar(cfgConfidencialidad(p, invitado).cfg).blob; }
  function pdfConfidencialidad(p, invitado){
    const c = cfgConfidencialidad(p, invitado);
    guardarPdf('Acuerdo_de_confidencialidad_' + Util.codigoArchivo(p.codigo) + (invitado ? '_' + Util.razonSocialArchivo(invitado.razonSocial) : '') + '.pdf', c.cfg);
    Auditoria.registrar('exportar', 'acuerdo de confidencialidad PDF', c.est + (invitado ? ' · ' + invitado.razonSocial : ''), p.id);
  }

  /* ── Exportar el presupuesto para ARKEN CONTROL (§4.2) ── */
  function leerLibro(arrayBuffer){ return XLSX.read(arrayBuffer, { type:'array' }); }
  function exportarParaArken(p, pres, quien){
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    const hojas = ExcelArken.hojasPresupuesto(pres, { proceso:p.codigo + ' · ' + p.nombre, versionPliego:p.versionPliego, proponente:quien || '' });
    const wb = ExcelArken.libro(hojas, S.empresa.razonSocial, Sesion.usuario ? Sesion.usuario.usuario : '');
    const datos = XLSX.write(wb, { type:'array', bookType:'xlsx' });
    // Validador previo: el libro generado se relee con la copia fiel del lector de ARKEN.
    const rev = ExcelArken.revisar(leerLibro(datos));
    const t = Calculo.totales(pres);
    const nombre = ExcelArken.nombreArchivo(p.codigo, quien);
    const c = rev.conteo;
    const cuerpo =
      '<p>Así leerá ARKEN CONTROL este libro (módulo 03 › «Importar desde Excel»):</p>' +
      '<div class="sumario">' + [['Capítulos', c.capitulos], ['Subcapítulos', c.subcapitulos], ['Actividades', c.actividades], ['APU', c.apus], ['Insumos', c.insumos]]
        .map(([l, v]) => '<div class="stat"><div class="lab">' + l + '</div><div class="val">' + v + '</div></div>').join('') + '</div>' +
      (rev.errores.length
        ? '<div class="nota bad"><b>ARKEN encontraría ' + rev.errores.length + ' error(es). Corríjalos en el presupuesto; mientras haya uno, no se puede guardar.</b><ul>' +
            rev.errores.map(e => '<li>' + esc(e.hoja) + (e.fila ? ', fila ' + e.fila : '') + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>'
        : '<div class="nota ok">Sin errores: ARKEN CONTROL lo leerá sin editarlo.</div>') +
      (rev.avisos.length ? '<div class="nota warn"><b>Avisos:</b><ul>' + rev.avisos.map(e => '<li>' + esc(e.hoja) + ', fila ' + e.fila + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
      '<p class="small muted">Costo directo ' + money(t.costoDirecto) + ' · AIU ' + t.pctA + ' / ' + t.pctI + ' / ' + t.pctU + ' % · total ' + money(t.total) + '.</p>';
    UI.modal({ titulo:'Exportar para ARKEN CONTROL', eyebrow:'Validador previo', ancho:'wide', cuerpo,
      botones:[{ texto:'Cancelar' }, { texto:'Guardar ' + nombre, clase:'primary', deshabilitado:!!rev.errores.length, id:'btnGuardarXlsx', accion:m => {
        UI.descargar(nombre, new Blob([datos], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        Auditoria.registrar('exportar', 'presupuesto para ARKEN CONTROL', nombre + ' · ' + c.actividades + ' actividades', p.id);
        m.cerrar();
        UI.aviso('Pasos en ARKEN CONTROL',
          '<ol class="small" style="padding-left:18px;line-height:1.8"><li>Abra el proyecto y vaya al módulo 03 · Presupuesto.</li><li>Elija «Importar desde Excel» y seleccione <b>' + esc(nombre) + '</b>.</li>' +
          '<li>Revise el resumen que muestra ARKEN.</li><li>Elija <b>Reemplazar</b> o <b>Adicionar</b> y confirme.</li>' +
          '<li>Digite el AIU a mano en el módulo 03, porque ARKEN no lo lee del archivo: <b>A ' + t.pctA + ' %, I ' + t.pctI + ' %, U ' + t.pctU + ' %</b>.</li></ol>');
      } }] });
    return rev;
  }

  /* ── Importar desde ARKEN CONTROL (o desde la plantilla de ARKEN) ── */
  async function importarDeArken(p, archivo, alTerminar){
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    const pres = Modelo.presupuesto(p.id);
    let wb;
    try { wb = leerLibro(await archivo.arrayBuffer()); } catch(e){ throw new Error('El archivo no es un libro de Excel legible.'); }
    const plan = ExcelArken.validarPresupuestoExcel(pres, wb);
    const resumen = ExcelArken.leerResumen(wb);
    let subs = 0, acts = 0; plan.capitulos.forEach(c => { subs += c.subs.length; c.subs.forEach(s => acts += s.acts.length); });
    const tiene = Calculo.contar(pres).actividades > 0;
    const cuerpo =
      '<div class="sumario">' + [['Capítulos', plan.capitulos.length], ['Subcapítulos', subs], ['Actividades', acts], ['APU', plan.apus.length], ['Insumos', plan.insumos.length]]
        .map(([l, v]) => '<div class="stat"><div class="lab">' + l + '</div><div class="val">' + v + '</div></div>').join('') + '</div>' +
      (plan.errores.length ? '<div class="nota bad"><b>El libro tiene ' + plan.errores.length + ' error(es). Corríjalos en Excel y vuelva a cargarlo:</b><ul>' +
        plan.errores.map(e => '<li>' + esc(e.hoja) + (e.fila ? ', fila ' + e.fila : '') + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
      (plan.avisos.length ? '<div class="nota warn"><b>Avisos:</b><ul>' + plan.avisos.map(e => '<li>' + esc(e.hoja) + ', fila ' + e.fila + ': ' + esc(e.msg) + '</li>').join('') + '</ul></div>' : '') +
      (resumen ? '<div class="nota">El libro trae la hoja Resumen de ANALYTICA: se tomará su AIU (A ' + resumen.aiu.a + ' %, I ' + resumen.aiu.i + ' %, U ' + resumen.aiu.u + ' %).</div>'
        : '<div class="nota">Los libros de ARKEN CONTROL no traen el AIU: después de importar, defínalo en la pestaña «AIU e IVA».</div>') +
      (tiene ? '<div class="field"><label for="impModo">El presupuesto base ya tiene actividades</label><select id="impModo">' +
          '<option value="reemplazar">Reemplazar: queda solo lo del archivo</option><option value="adicionar">Adicionar: se conserva lo actual y se actualiza por código</option></select></div>' +
          '<label class="checkline" style="margin-top:10px"><input type="checkbox" id="impPrecios" checked> Actualizar el precio de los insumos que ya existen (por descripción)</label>' : '');
    UI.modal({ titulo:'Importar presupuesto desde Excel', eyebrow:archivo.name, ancho:'wide', cuerpo,
      botones:[{ texto:'Cancelar' }, { texto:'Importar', clase:'primary', deshabilitado:!!plan.errores.length, accion:async m => {
        const modo = tiene ? $('#impModo', m.el).value : 'reemplazar';
        const actualizarPrecios = tiene ? $('#impPrecios', m.el).checked : true;
        ExcelArken.aplicarPlan(pres, plan, { modo, actualizarPrecios });
        if (resumen){ pres.aiu = resumen.aiu; if (resumen.iva) pres.iva = resumen.iva; }
        await Modelo.guardarPresupuesto(pres, 'Importado de Excel (' + modo + '): ' + archivo.name + ' · ' + acts + ' actividades');
        m.cerrar();
        UI.toast('Presupuesto importado: ' + acts + ' actividades', 'ok');
        if (alTerminar) alTerminar();
      } }] });
  }

  /* ── Excel de ARKEN PRECIOS → base de precios ── */
  async function importarDePrecios(archivo, alTerminar){
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    let wb;
    try { wb = leerLibro(await archivo.arrayBuffer()); } catch(e){ throw new Error('El archivo no es un libro de Excel legible.'); }
    const r = ExcelPrecios.leer(wb);
    if (r.errores.length){ UI.aviso('No se pudo leer el archivo', '<p>' + r.errores.map(esc).join('<br>') + '</p>'); return; }
    const cmp = ExcelPrecios.compararConBase(r.filas, S.basePrecios);
    const filas = cmp.cambios.map((c, i) => '<tr><td><input type="checkbox" data-c="' + i + '" checked aria-label="Aplicar"></td><td>' + esc(c.insumo.nombre) + '</td><td class="n">' + money3(c.antes) +
      '</td><td class="n">' + money3(c.despues) + '</td><td class="n">' + Util.pct((c.despues - c.antes) / (c.antes || 1) * 100) + '</td></tr>').join('');
    const nuevos = cmp.nuevos.map((f, i) => '<tr><td><input type="checkbox" data-n="' + i + '" checked aria-label="Agregar"></td><td>' + esc(f.nombre) + '</td><td>' + esc(f.categoria) + '</td><td>' + esc(f.unidad) + '</td><td class="n">' + money3(f.precio) + '</td></tr>').join('');
    UI.modal({ titulo:'Actualizar la base de precios', eyebrow:'Excel de ARKEN PRECIOS · ' + archivo.name, ancho:'xwide',
      cuerpo:'<p>' + r.filas.length + ' insumos en el archivo: <b>' + cmp.cambios.length + '</b> cambian de precio, <b>' + cmp.nuevos.length + '</b> son nuevos y ' + cmp.iguales.length + ' quedan igual. Nada se escribe hasta que usted confirme.</p>' +
        (r.avisos.length ? '<div class="nota warn"><ul>' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul></div>' : '') +
        (filas ? '<h4 style="margin:10px 0 6px">Cambios de precio (antes y después)</h4><div class="tw scroll"><table class="t"><thead><tr><th></th><th>Insumo</th><th class="n">Antes</th><th class="n">Después</th><th class="n">Variación</th></tr></thead><tbody>' + filas + '</tbody></table></div>' : '') +
        (nuevos ? '<h4 style="margin:14px 0 6px">Insumos nuevos</h4><div class="tw scroll"><table class="t"><thead><tr><th></th><th>Insumo</th><th>Categoría</th><th>Unidad</th><th class="n">Precio</th></tr></thead><tbody>' + nuevos + '</tbody></table></div>' : ''),
      botones:[{ texto:'Cancelar' }, { texto:'Aplicar lo marcado', clase:'primary', accion:async m => {
        let n = 0;
        for (const el of $$('[data-c]:checked', m.el)){ const c = cmp.cambios[+el.dataset.c]; await Modelo.guardarInsumoBase(c.insumo, c.despues, 'ARKEN PRECIOS', archivo.name); n++; }
        for (const el of $$('[data-n]:checked', m.el)){ const f = cmp.nuevos[+el.dataset.n];
          await Modelo.guardarInsumoBase({ codigo:'', nombre:f.nombre, unidad:f.unidad, categoria:f.categoria }, f.precio, 'ARKEN PRECIOS', archivo.name); n++; }
        m.cerrar(); UI.toast(n + ' insumo(s) actualizados en la base de precios', 'ok');
        if (alTerminar) alTerminar();
      } }] });
  }

  function excelAuditoria(){
    const filas = [['Fecha','Usuario','Acción','Objeto','Detalle','Proceso']].concat(Auditoria.lista().map(a => {
      const p = Modelo.proceso(a.procesoId);
      return [Util.fmtSello(a.fecha), a.usuario, a.accion, a.objeto, a.detalle, p ? p.codigo : ''];
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Auditoría');
    UI.descargar('ARKEN_ANALYTICA_auditoria_' + Util.selloArchivo(Date.now()) + '.xlsx', new Blob([XLSX.write(wb, { type:'array', bookType:'xlsx' })]));
  }

  return { NIVELES, marcaDe, pdfPresupuesto, pdfPliego, pdfConfidencialidad, blobConfidencialidad, exportarParaArken, importarDeArken, importarDePrecios, excelAuditoria, bloquesPresupuesto };
})();
