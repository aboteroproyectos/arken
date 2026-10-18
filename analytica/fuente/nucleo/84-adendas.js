/* ══════════════════════════════════════════════════════════════════════════
   PREGUNTAS, RESPUESTAS Y ADENDAS (§12.3) — los archivos que van y vienen
   entre el principal y ARKEN OFERTA, y la comparación entre dos versiones
   del pliego.

   · El archivo de preguntas lo genera ARKEN OFERTA; el principal lo registra
     con su autor.
   · El documento de respuestas se publica a todos por igual, sin decir quién
     preguntó, firmado con la llave de firma del proceso.
   · La adenda trae el pliego nuevo completo (sin datos del invitado) y la
     lista de cambios, firmada. ARKEN OFERTA la importa sin perder lo que el
     proponente ya llenó, y marca para revisar lo que la adenda invalida.
   ══════════════════════════════════════════════════════════════════════════ */
const Adendas = (function(){

  const F_PREGUNTAS = 'ARKEN-PREGUNTAS', F_RESPUESTAS = 'ARKEN-RESPUESTAS', F_ADENDA = 'ARKEN-ADENDA';

  /* ── Preguntas ── */
  function archivoPreguntas(d){
    return { formato:F_PREGUNTAS, version:1, proceso:d.proceso, versionPliego:d.versionPliego,
      invitado:{ razonSocial:d.invitado.razonSocial, nit:d.invitado.nit, codigoInvitacion:d.invitado.codigoInvitacion },
      generado:d.generado || new Date().toISOString(),
      preguntas:(d.preguntas||[]).map((q, i) => ({ id:q.id || 'q' + (i + 1), texto:String(q.texto||''), referencia:String(q.referencia||'') })) };
  }
  function nombrePreguntas(razonSocial, codigo, ts){
    return Util.razonSocialArchivo(razonSocial) + '_' + Util.codigoArchivo(codigo) + '_PREGUNTAS_' + Util.selloArchivo(ts, true) + '.json';
  }
  function leerPreguntas(texto, codigoProceso){
    let o;
    try { o = JSON.parse(texto); } catch(e){ throw new Error('El archivo de preguntas no es un JSON válido.'); }
    if (!o || o.formato !== F_PREGUNTAS || o.version !== 1) throw new Error('El archivo no es un archivo de preguntas de ARKEN OFERTA (formato ARKEN-PREGUNTAS, versión 1).');
    if (Util.codigoArchivo(o.proceso) !== Util.codigoArchivo(codigoProceso)) throw new Error('Las preguntas son del proceso ' + o.proceso + ', no de ' + codigoProceso + '.');
    if (!Array.isArray(o.preguntas) || !o.preguntas.length) throw new Error('El archivo no trae preguntas.');
    return o;
  }

  /* ── Firma de documentos JSON ── */
  /** El texto que se firma: el objeto sin su firma, en el orden de sus claves. */
  function textoFirmable(obj){ const c = Object.assign({}, obj); delete c.firma; return JSON.stringify(c); }
  async function firmar(obj, llavePrivadaFirma){ obj.firma = await Cripto.firmar(llavePrivadaFirma, textoFirmable(obj)); return obj; }
  async function verificarFirma(obj, publicaFirmaJwk){
    if (!obj.firma) return false;
    try { return await Cripto.verificar(publicaFirmaJwk, textoFirmable(obj), obj.firma); } catch(e){ return false; }
  }

  /* ── Respuestas ── */
  /** items = [{ numero, pregunta, respuesta, referencia }]: sin autor. */
  function archivoRespuestas(d){
    return { formato:F_RESPUESTAS, version:1, proceso:d.proceso, numero:d.numero, versionPliego:d.versionPliego, fecha:d.fecha || new Date().toISOString(),
      items:(d.items||[]).map((x, i) => ({ numero:x.numero || i + 1, pregunta:String(x.pregunta||''), respuesta:String(x.respuesta||''), referencia:String(x.referencia||'') })) };
  }
  function nombreRespuestas(codigo, numero){ return 'ARKEN_RESPUESTAS_' + Util.codigoArchivo(codigo) + '_' + String(numero).padStart(2,'0') + '.json'; }

  /* ── Adendas ── */
  function nombreAdenda(codigo, numero){ return 'ARKEN_ADENDA_' + Util.codigoArchivo(codigo) + '_' + String(numero).padStart(2,'0') + '.json'; }
  function archivoAdenda(d){
    return { formato:F_ADENDA, version:1, proceso:d.proceso, numero:d.numero, versionAnterior:d.versionAnterior, versionNueva:d.versionNueva,
      fecha:d.fecha || new Date().toISOString(), motivo:String(d.motivo||''), soloProrroga:!!d.soloProrroga,
      cambios:(d.cambios||[]).map(String), huellaPliegoPdf:d.huellaPliegoPdf || '', pliego:d.pliego };
  }
  /** Lee una respuesta o una adenda firmada. Verifica formato, proceso y firma. */
  async function leerFirmado(texto, formato, codigoProceso, publicaFirmaJwk){
    let o;
    try { o = JSON.parse(texto); } catch(e){ throw new Error('El archivo no es un JSON válido.'); }
    const nombre = formato === F_ADENDA ? 'adenda' : 'documento de respuestas';
    if (!o || o.formato !== formato || o.version !== 1) throw new Error('El archivo no es un ' + nombre + ' de ARKEN ANALYTICA (formato ' + formato + ', versión 1).');
    if (Util.codigoArchivo(o.proceso) !== Util.codigoArchivo(codigoProceso)) throw new Error('El ' + nombre + ' es del proceso ' + o.proceso + ', no de ' + codigoProceso + '.');
    if (!(await verificarFirma(o, publicaFirmaJwk))) throw new Error('La firma del ' + nombre + ' no corresponde a la llave del proceso: no es auténtico o fue modificado.');
    return o;
  }

  /* ── Diferencias entre dos versiones del pliego ── */
  function actividadesDe(pl){
    const m = new Map();
    ((pl.formularioCantidades||{}).capitulos||[]).forEach(c => (c.subs||[]).forEach(s => (s.acts||[]).forEach(a =>
      m.set(Sobre.claveActividad(c.codigo, s.codigo, a.codigo), { cap:c.codigo, sub:s.codigo, codigo:a.codigo, nombre:a.nombre, unidad:a.unidad, cantidad:Number(a.cantidad||0), apuObligatorio:!!a.apuObligatorio }))));
    return m;
  }
  function porCampo(lista, campo){ const m = new Map(); (lista||[]).forEach(x => m.set(x[campo], x)); return m; }
  /** Qué cambió de un pliego a otro. Devuelve listas por tema y las frases para la adenda. */
  function diferencias(a, b){
    const r = { actividades:{ nuevas:[], quitadas:[], cambiadas:[] }, requisitos:{ nuevos:[], quitados:[], cambiados:[] },
      documentos:{ nuevos:[], quitados:[], cambiados:[] }, cronograma:[], lista:[] };
    const A = actividadesDe(a), B = actividadesDe(b);
    B.forEach((x, k) => {
      const y = A.get(k);
      if (!y){ r.actividades.nuevas.push(x); r.lista.push('Actividad nueva ' + x.codigo + ' «' + x.nombre + '» (' + Util.cant(x.cantidad) + ' ' + x.unidad + ').'); return; }
      const campos = [];
      if (Math.abs(y.cantidad - x.cantidad) > 1e-9) campos.push(['cantidad', y.cantidad, x.cantidad]);
      if (y.unidad !== x.unidad) campos.push(['unidad', y.unidad, x.unidad]);
      if (y.nombre !== x.nombre) campos.push(['descripción', y.nombre, x.nombre]);
      if (y.apuObligatorio !== x.apuObligatorio) campos.push(['APU obligatorio', y.apuObligatorio ? 'Sí' : 'No', x.apuObligatorio ? 'Sí' : 'No']);
      if (campos.length){
        r.actividades.cambiadas.push(Object.assign({ campos }, x));
        r.lista.push('Actividad ' + x.codigo + ': ' + campos.map(([c, de, a2]) => c + ' de ' + (c === 'cantidad' ? Util.cant(de) : de) + ' a ' + (c === 'cantidad' ? Util.cant(a2) : a2)).join('; ') + '.');
      }
    });
    A.forEach((x, k) => { if (!B.has(k)){ r.actividades.quitadas.push(x); r.lista.push('Se quita la actividad ' + x.codigo + ' «' + x.nombre + '».'); } });

    const RA = porCampo(a.requisitos, 'codigo'), RB = porCampo(b.requisitos, 'codigo');
    RB.forEach((x, k) => {
      const y = RA.get(k);
      if (!y){ r.requisitos.nuevos.push(x); r.lista.push('Requisito nuevo ' + k + ' «' + x.nombre + '».'); }
      else if (JSON.stringify(y) !== JSON.stringify(x)){ r.requisitos.cambiados.push(x); r.lista.push('Cambia el requisito ' + k + ' «' + x.nombre + '».'); }
    });
    RA.forEach((x, k) => { if (!RB.has(k)){ r.requisitos.quitados.push(x); r.lista.push('Se quita el requisito ' + k + ' «' + x.nombre + '».'); } });

    const DA = porCampo(a.documentos, 'nombre'), DB = porCampo(b.documentos, 'nombre');
    DB.forEach((x, k) => {
      const y = DA.get(k);
      if (!y){ r.documentos.nuevos.push(x); r.lista.push('Documento nuevo «' + k + '».'); }
      else if (y.sha256 !== x.sha256 || y.version !== x.version){ r.documentos.cambiados.push(x); r.lista.push('Nueva versión del documento «' + k + '» (v' + x.version + ').'); }
    });
    DA.forEach((x, k) => { if (!DB.has(k)){ r.documentos.quitados.push(x); r.lista.push('Se retira el documento «' + k + '».'); } });

    const CA = porCampo(a.cronograma, 'clave');
    (b.cronograma||[]).forEach(h => {
      const y = CA.get(h.clave);
      if (!y || y.fecha !== h.fecha || y.hora !== h.hora){
        r.cronograma.push({ clave:h.clave, nombre:h.nombre, antes:y ? y.fecha + ' ' + y.hora : '', despues:h.fecha + ' ' + h.hora });
        r.lista.push(h.nombre + ': ' + (y ? Util.fmtFecha(y.fecha) + ' ' + y.hora + ' → ' : '') + Util.fmtFecha(h.fecha) + ' ' + h.hora + '.');
      }
    });
    if (Number(a.presupuestoOficial||0) !== Number(b.presupuestoOficial||0) && (a.presupuestoOficial || b.presupuestoOficial)) r.lista.push('Cambia el valor del presupuesto oficial.');
    return r;
  }
  /** ¿La adenda solo prorroga el cierre? (§12.3: es lo único permitido
      después del plazo de adendas). Se aceptan movidas hacia adelante del
      cierre y de los hitos que lo siguen; nada más. */
  function soloProrroga(dif, a, b){
    if (dif.actividades.nuevas.length + dif.actividades.quitadas.length + dif.actividades.cambiadas.length) return false;
    if (dif.requisitos.nuevos.length + dif.requisitos.quitados.length + dif.requisitos.cambiados.length) return false;
    if (dif.documentos.nuevos.length + dif.documentos.quitados.length + dif.documentos.cambiados.length) return false;
    if (!dif.cronograma.length) return false;
    const orden = Cronograma.HITOS.map(h => h[0]);
    const iCierre = orden.indexOf('cierre');
    const instante = (pl, clave) => { const h = (pl.cronograma||[]).find(x => x.clave === clave); return h ? new Date(Cronograma.instante(h)).getTime() : NaN; };
    if (!(instante(b, 'cierre') > instante(a, 'cierre'))) return false;
    return dif.cronograma.every(c => orden.indexOf(c.clave) >= iCierre && instante(b, c.clave) >= instante(a, c.clave));
  }
  /** Lo que la adenda deja para revisar en el borrador del proponente:
      claves de actividades con precio o APU que cambiaron de cantidad,
      unidad o descripción, y códigos de requisitos nuevos o cambiados. */
  function invalidaciones(dif){
    return { actividades:dif.actividades.cambiadas.map(x => Sobre.claveActividad(x.cap, x.sub, x.codigo)),
      actividadesNuevas:dif.actividades.nuevas.map(x => Sobre.claveActividad(x.cap, x.sub, x.codigo)),
      requisitos:dif.requisitos.nuevos.concat(dif.requisitos.cambiados).map(x => x.codigo) };
  }

  return { F_PREGUNTAS, F_RESPUESTAS, F_ADENDA, archivoPreguntas, nombrePreguntas, leerPreguntas, textoFirmable, firmar, verificarFirma,
    archivoRespuestas, nombreRespuestas, nombreAdenda, archivoAdenda, leerFirmado, diferencias, soloProrroga, invalidaciones };
})();
