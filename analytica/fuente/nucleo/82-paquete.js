/* ══════════════════════════════════════════════════════════════════════════
   PAQUETE DE INVITACIÓN (§13, contrato) — el pliego que viaja dentro de
   ARKEN OFERTA y el manifiesto firmado del paquete.

   Lo que sale de aquí es lo único del proceso que llega a un invitado. Por
   eso se arma por lista blanca: cada campo se copia a mano, nunca un objeto
   entero. El formulario de cantidades lleva códigos, nombres, unidades y
   cantidades, y los insumos sugeridos sin precio. Nunca un precio, un APU,
   un valor ni el AIU de la EMPRESA PRINCIPAL; si el proceso hace visible el
   presupuesto oficial, solo su total.
   ══════════════════════════════════════════════════════════════════════════ */
const Paquete = (function(){

  const FORMATO = 'ARKEN-PLIEGO', VERSION = 1;
  const FORMATO_MANIFIESTO = 'ARKEN-MANIFIESTO';

  /** El requisito como lo ve el proponente: sin evaluador ni notas internas. */
  function requisito(r){
    const x = { id:r.id, codigo:r.codigo, grupo:r.grupo, nombre:r.nombre, descripcion:r.descripcion || '', ayuda:r.ayuda || '',
      tipoRespuesta:r.tipoRespuesta || 'documento', obligatorio:r.obligatorio !== false, naturaleza:r.naturaleza,
      tambienHabilitante:!!r.tambienHabilitante, subsanable:!!r.subsanable, notaSubsanable:r.notaSubsanable || '',
      puntajeMaximo:r.naturaleza === 'ponderable' ? Number(r.puntajeMaximo||0) : 0,
      reglaPuntaje:r.reglaPuntaje ? { tipo:r.reglaPuntaje.tipo, nombre:PlantillaCondiciones.TIPOS_REGLA[r.reglaPuntaje.tipo] || '',
        criterio:r.reglaPuntaje.criterio || r.reglaPuntaje.criterios || '', rangos:Util.copia(r.reglaPuntaje.rangos) || undefined } : null,
      reglasVerificacion:(r.reglasVerificacion||[]).slice(), condicional:r.condicional || '' };
    if (x.tipoRespuesta === 'documento') x.documento = { tipos:((r.documento||{}).tipos || ['pdf']).slice(), pesoMaxMB:Number((r.documento||{}).pesoMaxMB) || 25, varios:!!(r.documento||{}).varios };
    if (x.tipoRespuesta === 'dato') x.dato = { tipo:(r.dato||{}).tipo || 'texto', opciones:((r.dato||{}).opciones || []).slice() };
    if (x.tipoRespuesta === 'tabla'){
      const t = r.tabla || {};
      const cols = (t.columnas && t.columnas.length) ? t.columnas : PlantillaCondiciones.columnas(t.plantilla);
      x.tabla = { plantilla:t.plantilla || '', columnas:cols.map(c => ({ clave:c.clave, titulo:c.titulo, tipo:c.tipo })) };
    }
    return x;
  }

  /** Formulario de cantidades sin precios (§13). */
  function formulario(pres, politicaApu){
    const exigen = Calculo.exigenApu(pres, politicaApu || 'manual');
    const capitulos = (pres.capitulos||[]).map(c => ({ codigo:c.codigo, nombre:c.nombre,
      subs:(c.subs||[]).map(s => ({ codigo:s.codigo, nombre:s.nombre,
        acts:(s.acts||[]).map(a => ({ codigo:a.codigo, nombre:a.nombre, unidad:a.unidad, cantidad:Number(a.cantidad||0),
          apuObligatorio:exigen.has(a.id), cantidadIncierta:!!a.cantidadIncierta })) })) }));
    // Insumos sugeridos: los que usa el presupuesto base, con su descripción,
    // unidad y categoría. El precio no sale.
    const usados = new Map();
    Calculo.recorrerActividades(pres, act => (act.apus||[]).forEach(id => {
      const ap = Calculo.apu(pres, id); if (!ap) return;
      (ap.insumos||[]).forEach(x => {
        const ins = Calculo.insumo(pres, x.idInsumo);
        if (ins && !usados.has(Util.normaliza(ins.nombre))) usados.set(Util.normaliza(ins.nombre), { descripcion:ins.nombre, unidad:ins.unidad, categoria:ins.categoria });
      });
    }));
    const insumosSugeridos = Array.from(usados.values()).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
    return { capitulos, insumosSugeridos };
  }

  /** Carpeta y nombre de un documento dentro del paquete. */
  function nombreSeguro(n){
    return String(n||'archivo').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'archivo';
  }
  function rutaDocumento(d){ return 'Documentos_del_proceso/' + nombreSeguro(d.clase || 'Otros') + '/' + nombreSeguro(d.nombre); }

  /** El objeto ARKEN-PLIEGO de §13.
      ctx = { proceso, empresa, presupuesto, requisitos, documentos, llaves, invitado, huellaPliegoPdf,
              nombrePliegoPdf, etapa:'completo'|'confidencialidad', emitido, adendas } */
  function pliego(ctx){
    const p = ctx.proceso, e = ctx.empresa || {}, inv = ctx.invitado || {}, ll = ctx.llaves || {};
    const pres = ctx.presupuesto || { capitulos:[] };
    const etapa = ctx.etapa || 'completo';
    const g = Object.assign(Pliego.generalPorDefecto(), p.general || {});
    const t = Calculo.totales(pres);
    const conf = p.confidencialidad || {};
    const obj = {
      formato:FORMATO, version:VERSION, etapa,
      proceso:{ codigo:p.codigo, nombre:p.nombre, objeto:p.objeto || '', modalidad:p.modalidad, tipoContrato:p.tipoContrato,
        pais:p.pais || 'Colombia', moneda:p.moneda || 'COP', ciudad:p.ciudad || '', ubicacionObra:p.ubicacionObra || '',
        areaConstruida:Number(p.areaConstruida||0), plazoMaximoDias:Number(p.plazoMaximoDias||0),
        presupuestoOficialVisible:!!p.presupuestoOficialVisible, sobreCerrado:p.sobreCerrado !== false,
        envios:conf.envios || 'dos', politicaApu:p.politicaApu || 'manual', demo:!!p.demo,
        iva:{ tarifa:Number((pres.iva||{}).tarifa === undefined ? 19 : pres.iva.tarifa), base:(pres.iva||{}).base || 'utilidad' },
        metodoEconomico:(Pliego.METODOS[g.metodoEconomico] || Pliego.METODOS.menor).nombre, consorcios:!!g.consorcios },
      versionPliego:p.versionPliego,
      empresaPrincipal:{ razonSocial:e.razonSocial || '', nit:e.nit ? Nit.formatear(e.nit, e.dv) : '', ciudad:e.ciudad || '', correo:e.correo || '', telefono:e.telefono || '' },
      invitado:{ razonSocial:inv.razonSocial || '', nit:inv.nit ? Nit.formatear(inv.nit, inv.dv) : '', codigoInvitacion:inv.codigoInvitacion || '' },
      cronograma:((p.cronograma && p.cronograma.hitos) || []).filter(h => h.activo !== false).map(h => ({ clave:h.clave, nombre:h.nombre, fecha:h.fecha, hora:h.hora })),
      zona:(p.cronograma && p.cronograma.zona) || 'America/Bogota',
      requisitos:etapa === 'completo' ? (ctx.requisitos||[]).filter(r => r.activo !== false).map(requisito) : [],
      formularioCantidades:etapa === 'completo' ? formulario(pres, p.politicaApu) : { capitulos:[], insumosSugeridos:[] },
      documentos:etapa === 'completo' ? (ctx.documentos||[]).filter(d => d.visibleParaProponentes !== false && d.vigente !== false).map(d => {
        const x = { ruta:d.enlace ? '' : rutaDocumento(d), nombre:d.nombre, clase:d.clase || 'Otros', disciplina:d.disciplina || '', version:d.version || 1, sha256:d.sha256 || '', peso:Number(d.peso||0) };
        if (d.enlace) x.enlace = Util.enlaceSeguro(d.enlace);
        return x;
      }) : [],
      pliegoPdf:etapa === 'completo' ? { nombre:ctx.nombrePliegoPdf || '', sha256:ctx.huellaPliegoPdf || '' } : null,
      acuerdo:{ nombre:'Acuerdo_de_confidencialidad_' + Util.codigoArchivo(p.codigo) + '.pdf', firma:conf.firma || 'electronica',
        aprobadoPor:conf.aprobacion ? conf.aprobacion.nombre : '', huellaTexto:conf.aprobacion ? conf.aprobacion.huella : '' },
      llavePublicaCifrado:ll.publicaCifrado ? { kty:'EC', crv:ll.publicaCifrado.crv, x:ll.publicaCifrado.x, y:ll.publicaCifrado.y } : null,
      llavePublicaFirma:ll.publicaFirma ? { kty:'EC', crv:ll.publicaFirma.crv, x:ll.publicaFirma.x, y:ll.publicaFirma.y } : null,
      emitido:ctx.emitido || new Date().toISOString(),
      adendas:(ctx.adendas||[]).map(a => ({ numero:a.numero, version:a.versionNueva, fecha:a.fecha }))
    };
    if (p.presupuestoOficialVisible && etapa === 'completo') obj.presupuestoOficial = t.total;
    return obj;
  }
  /** Texto exacto que viaja en el HTML. Su huella va en el manifiesto. */
  function texto(obj){ return JSON.stringify(obj); }
  /** Dentro de <script>, «</» cerraría el bloque: se escribe «<\/», que JSON lee igual. */
  function paraScript(t){ return String(t).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--'); }
  function incrustar(htmlPlantilla, textoPliego){
    const marca = '<script id="arken-pliego" type="application/json">null</script>';
    if (htmlPlantilla.indexOf(marca) < 0) throw new Error('La plantilla de ARKEN OFERTA no tiene el lugar del pliego.');
    return htmlPlantilla.replace(marca, () => '<script id="arken-pliego" type="application/json">' + paraScript(textoPliego) + '</script>');
  }

  /* ── Nombres de §13 ── */
  function nombrePaquete(codigo, razonSocial, version, etapa){
    return 'ARKEN_INVITACION_' + Util.codigoArchivo(codigo) + '_' + Util.razonSocialArchivo(razonSocial) + '_v' + version + (etapa === 'confidencialidad' ? '_confidencialidad' : '') + '.zip';
  }
  function nombreOferta(codigo){ return 'ARKEN_OFERTA_' + Util.codigoArchivo(codigo) + '.html'; }
  function nombrePliegoPdf(codigo, version){ return 'Pliego_' + Util.codigoArchivo(codigo) + '_v' + version + '.pdf'; }
  function nombreAcuerdo(codigo){ return 'Acuerdo_de_confidencialidad_' + Util.codigoArchivo(codigo) + '.pdf'; }

  /** manifiesto.json: cada archivo con ruta, tamaño y huella, la versión del
      pliego y la huella del pliego incrustado en ARKEN OFERTA. Las claves van
      en orden fijo para que la firma se verifique sobre el mismo texto. */
  function manifiesto(m){
    return JSON.stringify({ formato:FORMATO_MANIFIESTO, version:1, proceso:m.proceso, versionPliego:m.versionPliego, etapa:m.etapa || 'completo',
      invitado:{ razonSocial:m.invitado.razonSocial, nit:m.invitado.nit, codigoInvitacion:m.invitado.codigoInvitacion },
      huellaPliego:m.huellaPliego, generado:m.generado || new Date().toISOString(),
      archivos:m.archivos.map(a => ({ ruta:a.ruta, peso:a.peso, sha256:a.sha256 })) }, null, 1);
  }
  /** Compara el manifiesto con lo que trae el ZIP. mapa: ruta → { peso, sha256 }.
      Devuelve la lista de problemas, cada uno con el archivo y el porqué. */
  function compararArchivos(man, mapa, rutasZip){
    const problemas = [];
    const listadas = new Set();
    (man.archivos||[]).forEach(a => {
      listadas.add(a.ruta);
      const real = mapa.get(a.ruta);
      if (!real) problemas.push({ ruta:a.ruta, motivo:'falta en el paquete' });
      else if (real.sha256 !== a.sha256) problemas.push({ ruta:a.ruta, motivo:'su contenido no coincide con la huella del manifiesto (fue modificado)' });
      else if (Number(real.peso) !== Number(a.peso)) problemas.push({ ruta:a.ruta, motivo:'su tamaño no coincide con el manifiesto' });
    });
    (rutasZip||[]).forEach(r => { if (!listadas.has(r) && r !== 'manifiesto.json' && r !== 'manifiesto.firma') problemas.push({ ruta:r, motivo:'no está en el manifiesto (archivo agregado)' }); });
    return problemas;
  }
  function leerPliego(texto){
    let o;
    try { o = JSON.parse(texto); } catch(e){ throw new Error('El pliego incrustado no es un JSON válido.'); }
    if (!o || o.formato !== FORMATO) throw new Error('Este archivo no trae un pliego de ARKEN ANALYTICA (formato ARKEN-PLIEGO).');
    if (o.version !== VERSION) throw new Error('El pliego tiene la versión de formato ' + o.version + ' y este programa lee la ' + VERSION + '.');
    return o;
  }

  return { FORMATO, VERSION, FORMATO_MANIFIESTO, requisito, formulario, rutaDocumento, nombreSeguro, pliego, texto, paraScript, incrustar,
    nombrePaquete, nombreOferta, nombrePliegoPdf, nombreAcuerdo, manifiesto, compararArchivos, leerPliego };
})();
