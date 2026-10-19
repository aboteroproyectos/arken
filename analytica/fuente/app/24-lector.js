/* ══════════════════════════════════════════════════════════════════════════
   LECTOR DE DOCUMENTOS (§18.13) — dentro del programa, sin internet.
   En la verificación de un requisito, busca en el texto de un PDF del
   proponente los datos que pide el requisito (LectorLocal, en
   fuente/evaluacion/95-lector.js) y los muestra con el fragmento del
   documento y la página. «Usar como evidencia» llena el documento, la página
   y el texto literal de la verificación; el «¿Cumple?» lo decide el
   evaluador. Cada lectura queda guardada en «lecturasIA» (el nombre viene de
   la 0.4, cuando las hacía la IA) y en la auditoría.
   ══════════════════════════════════════════════════════════════════════════ */
const Lector = (function(){
  const cache = new Map();
  /** Texto de cada página con sus saltos de línea: el lector usa las líneas para saber dónde termina un dato. */
  async function paginas(sha256){
    if (cache.has(sha256)) return cache.get(sha256);
    const b = await Almacen.leerArchivo(sha256);
    if (!b) throw new Error('El archivo no está en este equipo.');
    if (!window.pdfjsLib) throw new Error('El lector de PDF no está disponible.');
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await b.arrayBuffer()), isEvalSupported:false, enableXfa:false }).promise;
    const L = [];
    for (let i = 1; i <= pdf.numPages; i++){
      const t = await (await pdf.getPage(i)).getTextContent();
      L.push(t.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join(''));
    }
    cache.set(sha256, L);
    return L;
  }

  /** Lee un documento y guarda la lectura. */
  async function leer(p, o, r, doc, campos, otro){
    if (!Evaluacion.puedeEvaluar(r)) throw new Error('Su usuario no verifica este requisito.');
    if (Archivos.extension(doc.nombre) !== 'pdf') throw new Error('El lector lee documentos PDF.');
    const pags = await paginas(doc.sha256);
    if (!pags.join('').trim()) throw new Error('El PDF no tiene texto (es una imagen escaneada): los datos se escriben a mano.');
    const datos = LectorLocal.leer(pags, campos, otro);
    const faltan = LectorLocal.faltantes(datos, campos);
    const lec = { id:Util.uid('lec'), procesoId:p.id, ofertaId:o.id, requisito:r.codigo, docId:doc.id, sha256:doc.sha256, documento:doc.nombre, fecha:new Date().toISOString(),
      usuario:Sesion.usuario ? Sesion.usuario.usuario : '', modelo:'lector', campos, datos, faltan, demo:!!p.demo };
    await Almacen.poner('lecturasIA', lec);
    await Auditoria.registrar('leer', 'documento con el lector', r.codigo + ' · ' + o.nombre + ' · ' + doc.nombre + ' · ' + datos.length + ' dato(s)', p.id);
    return lec;
  }

  /** Dentro de la verificación: elegir documento y datos, leer y usar un dato como evidencia. */
  function enVerificacion(p, o, r, docs, el){
    const caja = $('#vrLector', el);
    const pdfs = docs.filter(d => Archivos.extension(d.nombre) === 'pdf');
    if (!pdfs.length) { caja.innerHTML = '<div class="nota warn">Este requisito no tiene documentos PDF.</div>'; return; }
    const sugeridos = new Set(LectorLocal.camposDe(r.grupo));
    caja.innerHTML = '<div class="card" style="margin-top:8px"><div class="card-body small"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label>Documento <select id="lcDoc">' + pdfs.map(d => '<option value="' + d.id + '">' + esc(d.nombre) + '</option>').join('') + '</select></label></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0">' + LectorLocal.CAMPOS.map(c => '<label class="checkline small"><input type="checkbox" data-lccampo="' + c.k + '"' + (sugeridos.has(c.k) ? ' checked' : '') + '> ' + esc(c.nombre) + '</label>').join('') + '</div>' +
      '<input id="lcOtro" placeholder="Si marcó «Otro dato», escriba la palabra que lo antecede (p. ej. «número de póliza»)" style="max-width:480px"> <button class="btn sm primary" type="button" id="lcLeer">Leer</button><div id="lcRes"></div></div></div>';
    $('#lcLeer', caja).onclick = async () => {
      const doc = pdfs.find(d => d.id === $('#lcDoc', caja).value);
      const campos = $$('[data-lccampo]', caja).filter(x => x.checked).map(x => x.dataset.lccampo);
      if (!campos.length) return UI.toast('Marque al menos un dato.', 'bad');
      const b = $('#lcLeer', caja); b.disabled = true; b.textContent = 'Leyendo…';
      try { pintar($('#lcRes', caja), await leer(p, o, r, doc, campos, $('#lcOtro', caja).value.trim()), el); }
      catch(e){ UI.error(e, 'lector de documentos'); }
      finally { b.disabled = false; b.textContent = 'Leer'; }
    };
  }
  function valorLegible(d){
    if (d.normalizado === null || d.normalizado === undefined) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(d.normalizado))) return Util.fmtFecha(d.normalizado);
    return typeof d.normalizado === 'number' ? Util.cant(d.normalizado) : '';
  }
  function pintar(caja, lec, el){
    caja.innerHTML = (lec.datos.length ? '<div class="tw"><table class="t"><thead><tr><th>Dato</th><th>Valor</th><th>Dónde está en el documento</th><th class="n">Pág.</th><th></th></tr></thead><tbody>' +
      lec.datos.map((d, i) => '<tr class="' + (d.motivo ? 'muted' : '') + '"><td>' + esc(d.nombreCampo || d.campo) + '</td><td><b>' + esc(d.valor) + '</b>' + (valorLegible(d) && valorLegible(d) !== d.valor ? '<div class="small muted">' + esc(valorLegible(d)) + '</div>' : '') + '</td>' +
        '<td class="small">«' + esc(d.texto) + '»' + (d.motivo ? '<div class="muted">' + esc(d.motivo) + '</div>' : '') + '</td><td class="n">' + d.pagina + '</td>' +
        '<td><button class="btn xs" type="button" data-lcusar="' + i + '">Usar como evidencia</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="nota">No se encontró ninguno de esos datos en el texto del documento.</div>') +
      (lec.faltan.length && lec.datos.length ? '<p class="small">No se encontró: ' + esc(lec.faltan.join(', ')) + '.</p>' : '') +
      '<p class="small muted">Encontrado por el lector del programa, sin internet. Revise el valor en el documento: «Usar como evidencia» solo llena el documento, la página y el texto literal; usted decide si cumple.</p>';
    $$('[data-lcusar]', caja).forEach(b => b.onclick = async () => {
      const d = lec.datos[Number(b.dataset.lcusar)];
      const set = (id, v) => { const x = $('#' + id, el); if (x) x.value = v; };
      set('vr_doc', lec.docId); set('vr_pagina', d.pagina); set('vr_texto', d.texto);
      d.usado = { usuario:Sesion.usuario ? Sesion.usuario.usuario : '', fecha:new Date().toISOString() };
      await Almacen.poner('lecturasIA', lec);
      UI.toast('Evidencia llenada con el dato del documento. Revise y guarde la verificación.', 'ok');
    });
  }
  return { paginas, leer, enVerificacion };
})();
