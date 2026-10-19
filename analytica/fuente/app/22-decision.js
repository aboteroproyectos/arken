/* ══════════════════════════════════════════════════════════════════════════
   DECISIÓN (§18.12, §19, §21) — lo que el principal guarda del concepto de
   adjudicación y del informe, y la exportación del presupuesto adjudicado.
   El cálculo y la redacción de partida viven en fuente/evaluacion/ (Concepto,
   Informe, Graficas); aquí se guarda, se firma, se dibuja y se audita.

   · El concepto es un registro por proceso (almacén «conceptos»): los textos
     que el comité editó, las firmas y la huella de lo firmado. Si la
     evaluación cambia después de firmar, la huella ya no coincide y el
     concepto vuelve a ser un borrador (con aviso): nadie firma un texto y
     adjudica otro.
   · Cada informe generado es una versión (almacén «informes») con su
     configuración, sus huellas y sus archivos en el almacén de archivos.
   ══════════════════════════════════════════════════════════════════════════ */
const Decision = (function(){

  /* ── Concepto ── */
  function registro(p){ return (S.conceptos||[]).find(c => c.procesoId === p.id) || null; }
  function colores(p, R){ return Object.fromEntries(R.ofertas.map(o => [o.id, Recepcion.colorDe(p, o.invitadoId)])); }

  /** El concepto vigente: el generado con los textos del comité encima, su estado y si lo firmado sigue valiendo. */
  async function concepto(p){
    const R = Evaluacion.analisis(p);
    if (!R) return null;
    const c = registro(p) || { textos:{}, firmas:[] };
    const final = Concepto.aplicarTextos(Concepto.generar(R, { alertas:Evaluacion.alertas(p.id) }), c.textos);
    let estado = Concepto.estado(c), cambio = false;
    if (estado === 'firmado'){
      const h = await Cripto.sha256(Concepto.contenidoFirmado(final));
      if (h !== c.huella){ estado = 'borrador'; cambio = true; }
    }
    return { R, final, estado, firmas:estado === 'firmado' ? c.firmas : [], firmasAnteriores:cambio ? c.firmas : [], huella:estado === 'firmado' ? c.huella : null, cambioDespuesDeFirmar:cambio, registro:c };
  }
  /** Lo que se puede saber sin esperar la huella (para pintar rápido el tablero y el cuadro gerencial). */
  function estadoRapido(p){ const c = registro(p); return c && Concepto.estado(c) === 'firmado' ? { estado:'firmado', recomendado:c.recomendado } : { estado:'borrador' }; }

  async function guardar(p, cambio, accion, detalle){
    const c = Util.copia(registro(p) || { id:'cp-' + p.id, procesoId:p.id, textos:{}, firmas:[], historia:[], creado:new Date().toISOString() });
    cambio(c);
    c.actualizado = new Date().toISOString();
    await Almacen.poner('conceptos', c);
    await Auditoria.registrar(accion, 'concepto de adjudicación', detalle, p.id);
    return c;
  }
  /** Textos editados por el comité: { resumen, recomendacion, condiciones[], riesgos{id:[]}, notas }. */
  async function guardarTextos(p, textos){
    Permisos.exigir('redactarConcepto');
    const c = registro(p);
    if (c && Concepto.estado(c) === 'firmado') throw new Error('El concepto está firmado. Para cambiarlo, el comité anula las firmas primero.');
    const limpio = {};
    ['resumen', 'recomendacion', 'notas'].forEach(k => { if (textos[k] !== undefined && String(textos[k]).trim()) limpio[k] = String(textos[k]).trim(); });
    if (Array.isArray(textos.condiciones)) limpio.condiciones = textos.condiciones.map(x => String(x).trim()).filter(Boolean);
    if (textos.riesgos) limpio.riesgos = Object.fromEntries(Object.entries(textos.riesgos).map(([k, v]) => [k, (v || []).map(x => String(x).trim()).filter(Boolean)]));
    return guardar(p, x => { x.textos = limpio; }, 'editar', 'Textos del concepto');
  }
  /** Firma: dos miembros distintos del comité, autenticados en el momento, sobre el texto final y el orden vigentes. */
  async function firmar(p, firmantes){
    Permisos.exigir('decidirComite');
    const k = await concepto(p);
    if (!k) throw new Error('No hay ofertas abiertas.');
    if (k.final.provisional) throw new Error('El puntaje es provisional: termine las verificaciones y las subsanaciones antes de firmar.');
    if (!k.final.recomendado) throw new Error('No hay un proponente recomendado: no hay ofertas habilitadas.');
    if (k.estado === 'firmado') throw new Error('El concepto ya está firmado.');
    const F = await Recepcion.autenticarComite(firmantes);
    const huella = await Cripto.sha256(Concepto.contenidoFirmado(k.final));
    const rec = k.R.ofertas.find(o => o.id === k.final.recomendado);
    return guardar(p, x => {
      if ((x.firmas || []).length) x.historia = (x.historia || []).concat([{ firmas:x.firmas, huella:x.huella, anulado:new Date().toISOString(), motivo:'Reemplazado por una nueva firma' }]);
      x.firmas = F; x.huella = huella; x.recomendado = k.final.recomendado; x.firmado = new Date().toISOString();
    }, 'firmar', 'Concepto firmado por ' + F.map(f => f.usuario).join(' y ') + ' · recomienda ' + (rec ? rec.nombre : '') + ' · ' + huella);
  }
  async function anularFirmas(p, motivo){
    Permisos.exigir('decidirComite');
    if (!String(motivo || '').trim()) throw new Error('Escriba el motivo para anular las firmas.');
    return guardar(p, x => { x.historia = (x.historia || []).concat([{ firmas:x.firmas, huella:x.huella, anulado:new Date().toISOString(), motivo }]); x.firmas = []; x.huella = null; x.recomendado = null; },
      'anular', 'Firmas del concepto anuladas: ' + motivo);
  }
  /** El concepto solo, en PDF, con la marca de borrador en cada página mientras no esté firmado. */
  async function pdfConcepto(p){
    const k = await concepto(p);
    const A = Informe.armar(k.R, { secciones:[{ id:'concepto', marcada:true }].concat(Informe.secciones(k.R).filter(s => s.id !== 'concepto').map(s => ({ id:s.id, marcada:false }))) },
      { concepto:k, alertas:Evaluacion.alertas(p.id) });
    const r = Pdf.generar({ titulo:'Concepto de adjudicación', subtitulo:p.codigo + ' · ' + p.nombre + (p.demo ? ' · DEMOSTRACIÓN' : ''), documento:'Concepto de adjudicación', bloques:A.bloques, marcaAgua:A.marcaAgua });
    await Auditoria.registrar('exportar', 'concepto de adjudicación', k.estado, p.id);
    return { blob:r.blob, nombre:'ARKEN_ANALYTICA_' + Util.codigoArchivo(p.codigo) + '_Concepto_' + Util.hoyISO().replace(/-/g, '') + '.pdf' };
  }

  /* ── Gráficas: de SVG a PNG nítido ── */
  function svgAImagen(svg, escala){
    const s = Graficas.paraExportar(svg);
    const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(s);
    const w = m ? Number(m[1]) : 720, h = m ? Number(m[2]) : 400, k = escala || 2.5;
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        res({ src:c.toDataURL('image/png'), ancho:w, alto:h, canvas:c });
      };
      img.onerror = () => rej(new Error('No se pudo dibujar la gráfica como imagen.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  async function exportarGrafica(p, id, formato, op){
    const R = Evaluacion.analisis(p);
    const g = Graficas.una(id, R, Object.assign({ colores:colores(p, R) }, op || {}));
    const base = 'ARKEN_ANALYTICA_' + Util.codigoArchivo(p.codigo) + '_Grafica_' + String(g.numero).padStart(2, '0') + '_' + id;
    if (formato === 'svg') UI.descargar(base + '.svg', Graficas.paraExportar(g.svg), 'image/svg+xml');
    else {
      const im = await svgAImagen(g.svg);
      if (formato === 'png') UI.descargar(base + '.png', await new Promise(r => im.canvas.toBlob(r, 'image/png')));
      else UI.descargar(base + '.pdf', Pdf.generar({ titulo:g.numero + '. ' + g.titulo, subtitulo:p.codigo + (p.demo ? ' · DEMOSTRACIÓN' : ''), documento:'Gráfica', orientacion:im.ancho > im.alto ? 'l' : 'p',
        bloques:[{ t:'imagen', src:im.src, ancho:im.ancho, alto:im.alto }, { t:'texto', txt:g.descripcion, gris:true }] }).blob);
    }
    await Auditoria.registrar('exportar', 'gráfica', g.numero + ' · ' + g.titulo + ' · ' + formato, p.id);
  }

  /* ── Informe ── */
  function configInforme(p, R){
    const e = (p.evaluacion || {}).informe || {};
    return { secciones:Informe.normalizar(R, e), graficas:Array.isArray(e.graficas) ? e.graficas.filter(id => Graficas.LISTA.some(g => g.id === id)) : Graficas.LISTA.map(g => g.id) };
  }
  async function guardarConfigInforme(p, cfg){
    Permisos.exigir('generarInforme');
    return Evaluacion.guardarEvaluacion(p, ev => { ev.informe = { secciones:(cfg.secciones || []).map(s => ({ id:s.id, marcada:s.marcada !== false })), graficas:(cfg.graficas || []).slice() }; },
      'configurar', 'Secciones del informe: ' + (cfg.secciones || []).filter(s => s.marcada !== false).length + ' · gráficas ' + (cfg.graficas || []).length);
  }
  async function alternarGrafica(p, id){
    const R = Evaluacion.analisis(p);
    const cfg = configInforme(p, R);
    const i = cfg.graficas.indexOf(id);
    if (i >= 0) cfg.graficas.splice(i, 1); else cfg.graficas.push(id);
    await guardarConfigInforme(p, cfg);
    return i < 0;
  }
  function informes(p){ return (S.informes||[]).filter(x => x.procesoId === p.id).sort((a, b) => a.version - b.version); }

  /** Genera el PDF y el Excel con la configuración guardada; cada uno queda como versión, con su huella. */
  async function generarInforme(p){
    Permisos.exigir('generarInforme');
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    await Evaluacion.leerDocumentos(p);
    await Evaluacion.actualizarAlertas(p);
    const k = await concepto(p);
    if (!k) throw new Error('No hay ofertas abiertas.');
    const R = k.R;
    const cfg = configInforme(p, R);
    const conGraficas = cfg.secciones.some(s => s.id === 'graficas' && s.marcada);
    const imagenes = {};
    if (conGraficas) for (const id of cfg.graficas) imagenes[id] = await svgAImagen(Graficas.una(id, R, { colores:colores(p, R) }).svg);
    const docs = [];
    Recepcion.ofertas(p.id).forEach(o => Recepcion.documentos(o.id).forEach(d => docs.push({ oferta:Evaluacion.nombreOferta(p, o), requisito:d.requisito, nombre:d.nombre, sha256:d.sha256, ronda:d.ronda })));
    const fecha = new Date().toISOString();
    const usuario = Sesion.usuario ? Sesion.usuario.nombre || Sesion.usuario.usuario : '';
    const A = Informe.armar(R, cfg, { proceso:p, empresa:S.empresa, concepto:k, alertas:Evaluacion.alertas(p.id), graficas:cfg.graficas, imagenes, opcionesGraficas:{ colores:colores(p, R) },
      actas:Recepcion.actas(p.id).map(a => ({ tipo:a.tipo, fecha:a.fecha, usuario:a.usuario, sha256Pdf:a.sha256Pdf })), documentos:docs, usuario, fecha });
    const pdf = Pdf.generar({ nombre:'informe', titulo:'Informe de evaluación', documento:'Informe de evaluación · ' + p.codigo, bloques:A.bloques, marcaAgua:A.marcaAgua });
    const wb = XLSX.utils.book_new();
    A.hojas.forEach(h => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.filas), h.nombre));
    if (!A.hojas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Las secciones elegidas no tienen tablas.']]), 'Informe');
    const xlsx = new Blob([XLSX.write(wb, { type:'array', bookType:'xlsx' })], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const shaPdf = await Archivos.huella(pdf.blob), shaXlsx = await Archivos.huella(xlsx);
    await Almacen.ponerArchivo(shaPdf, pdf.blob); await Almacen.ponerArchivo(shaXlsx, xlsx);
    const version = informes(p).length + 1;
    const reg = { id:Util.uid('inf'), procesoId:p.id, version, fecha, usuario:Sesion.usuario ? Sesion.usuario.usuario : '', secciones:A.secciones, graficas:conGraficas ? cfg.graficas.slice() : [],
      paginas:pdf.paginas, sha256Pdf:shaPdf, sha256Xlsx:shaXlsx, nombrePdf:Informe.nombreArchivo(p.codigo, fecha, 'pdf'), nombreXlsx:Informe.nombreArchivo(p.codigo, fecha, 'xlsx'),
      concepto:k.estado, provisional:R.puntaje.provisional, demo:!!p.demo };
    await Almacen.poner('informes', reg);
    await Auditoria.registrar('generar', 'informe de evaluación', 'Versión ' + version + ' · ' + A.secciones.length + ' secciones · ' + pdf.paginas + ' páginas · ' + shaPdf, p.id);
    return Object.assign({ pdf:pdf.blob, xlsx }, reg);
  }

  /* ── Presupuesto adjudicado hacia ARKEN CONTROL (§26.4) ── */
  async function exportarAdjudicado(p){
    Permisos.exigir('exportarAdjudicado');
    const k = await concepto(p);
    if (!k || k.estado !== 'firmado') throw new Error('El presupuesto adjudicado sale cuando el concepto de adjudicación está firmado por el comité.');
    const o = k.R.ofertas.find(x => x.id === k.final.recomendado);
    if (!o) throw new Error('No se encontró la oferta recomendada.');
    // Las cantidades del pliego con los precios del adjudicatario: el mismo presupuesto que se recalculó en la apertura.
    const pres = Util.copia(o.pres);
    await Auditoria.registrar('exportar', 'presupuesto adjudicado', o.nombre + ' · ' + Util.money(o.totales.total) + ' · para ARKEN CONTROL', p.id);
    return Documentos.exportarParaArken(p, pres, o.nombre);
  }

  return { concepto, estadoRapido, guardarTextos, firmar, anularFirmas, pdfConcepto, colores, svgAImagen, exportarGrafica, configInforme, guardarConfigInforme, alternarGrafica, informes, generarInforme, exportarAdjudicado };
})();
