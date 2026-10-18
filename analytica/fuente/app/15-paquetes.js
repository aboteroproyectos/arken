/* ══════════════════════════════════════════════════════════════════════════
   PAQUETES DE INVITACIÓN (§13) — un ZIP por invitado con ARKEN OFERTA (el
   pliego adentro), LEAME_PRIMERO, el pliego en PDF, el acuerdo, los
   documentos vigentes y el manifiesto firmado con la llave del proceso.
   En el modo de dos envíos, el primer paquete solo trae el acuerdo y la
   versión mínima de ARKEN OFERTA que genera el sobre de confidencialidad.

   Las llaves privadas se abren con la frase una vez por sesión y quedan solo
   en memoria (Sesion.llaves); nunca se guardan abiertas ni salen del equipo.
   ══════════════════════════════════════════════════════════════════════════ */
const Paquetes = (function(){

  const FECHA_ZIP = new Date('2026-01-01T00:00:00Z');
  let plantilla = null;

  /** El HTML de ARKEN OFERTA que viaja comprimido dentro de este programa. */
  async function plantillaOferta(){
    if (plantilla) return plantilla;
    const el = $('#plantilla-oferta');
    if (!el || !window.JSZip) throw new Error('Este programa no trae la plantilla de ARKEN OFERTA. Descargue de nuevo ARKEN_ANALYTICA.html.');
    const z = await JSZip.loadAsync(el.textContent.trim(), { base64:true });
    plantilla = await z.file('ARKEN_OFERTA.html').async('string');
    return plantilla;
  }

  /** Abre las llaves privadas con la frase (una vez por sesión). */
  async function llavesAbiertas(p, motivo){
    Sesion.llaves = Sesion.llaves || {};
    if (Sesion.llaves[p.id]) return Sesion.llaves[p.id];
    const reg = Modelo.llaves(p.id);
    if (!reg) throw new Error('El proceso no tiene llaves (módulo 07 › Llaves del proceso).');
    const v = await UI.pedir({ titulo:'Frase del proceso', eyebrow:motivo || 'Firma con la llave del proceso', ancho:'', textoAceptar:'Abrir las llaves',
      antes:'<p class="small">Las llaves privadas se abren con la frase y quedan en la memoria de esta sesión. Se cierran al salir.</p>',
      campos:[{ k:'frase', lab:'Frase del proceso', tipo:'password', c2:true }] });
    if (!v) throw new Error('Sin la frase del proceso no se puede firmar.');
    const ll = await Cripto.abrirLlaves(reg, v.frase);
    Sesion.llaves[p.id] = ll;
    return ll;
  }

  /** ¿Qué paquete le toca al invitado? En dos envíos, el completo solo con el acuerdo verificado. */
  function etapa(p, inv){
    const envios = (p.confidencialidad || {}).envios || 'dos';
    return envios === 'dos' && (inv.confidencialidad || {}).estado !== 'verificado' ? 'confidencialidad' : 'completo';
  }

  /** El pliego PDF de la versión vigente: el que se guardó al generarlo. */
  async function blobPliego(p){
    const g = p.pliego && p.pliego.generado;
    if (!g) throw new Error('El pliego no se ha generado (módulo 07 › Pliego).');
    let b = await Almacen.leerArchivo(g.sha256);
    if (b) return b;
    if (!(await UI.confirmar({ titulo:'Falta el PDF del pliego', textoAceptar:'Elegir el archivo',
      mensaje:'El PDF del pliego no quedó guardado en este equipo. Elija el archivo ' + g.nombre + ' que descargó al generarlo: el programa comprueba que su huella sea ' + g.sha256 + '.' }))) throw new Error('Sin el PDF del pliego no se arma el paquete.');
    const [f] = await UI.elegirArchivos('.pdf');
    if (!f) throw new Error('Sin el PDF del pliego no se arma el paquete.');
    const r = await Archivos.guardar(f);
    if (r.sha256 !== g.sha256) throw new Error('Ese archivo no es el pliego generado: su huella es ' + r.sha256 + '.');
    return Almacen.leerArchivo(g.sha256);
  }

  function adendasEmitidas(p){ return (S.adendas||[]).filter(a => a.procesoId === p.id).sort((a, b) => a.numero - b.numero); }

  /** El pliego (ARKEN-PLIEGO) de un invitado, o genérico (sin invitado) para las adendas. */
  function pliegoDe(p, inv, et, version){
    const v = version || p.versionPliego;
    const g = p.pliego && p.pliego.generado;
    return Paquete.pliego({ proceso:Object.assign({}, p, { versionPliego:v }), empresa:S.empresa, presupuesto:Modelo.presupuesto(p.id, v), requisitos:Modelo.requisitosVersion(p.id, v),
      documentos:Modelo.documentos(p.id), llaves:Modelo.llaves(p.id), invitado:inv || {}, huellaPliegoPdf:g ? g.sha256 : '', nombrePliegoPdf:g ? g.nombre : '',
      etapa:et || 'completo', emitido:(p.emitido || {}).fecha, adendas:adendasEmitidas(p) });
  }

  /** Arma el paquete de un invitado. Devuelve { nombre, blob, sha256, etapa }. */
  async function generar(p, inv){
    Permisos.exigir('emitir');
    if (Modelo.editable(p) && !p.emitido) throw new Error('Emita el proceso antes de generar los paquetes.');
    if (p.adendaEnCurso) throw new Error('Hay una adenda en preparación: emítala o descártela antes de generar paquetes.');
    if (inv.estado === 'retirado') throw new Error(inv.razonSocial + ' fue retirado del proceso.');
    const et = etapa(p, inv);
    const ll = await llavesAbiertas(p, 'Paquete de ' + inv.razonSocial);
    const pl = pliegoDe(p, inv, et);
    const textoPl = Paquete.texto(pl);
    const html = Paquete.incrustar(await plantillaOferta(), textoPl);
    const enc = new TextEncoder();
    const archivos = [];
    const agregar = async (ruta, datos) => {
      const bytes = datos instanceof Uint8Array ? datos : datos instanceof Blob ? new Uint8Array(await datos.arrayBuffer()) : enc.encode(datos);
      archivos.push({ ruta, bytes, peso:bytes.length, sha256:await Cripto.sha256(bytes) });
    };
    await agregar(Paquete.nombreOferta(p.codigo), html);
    const huellaFirma = await Cripto.huellaPublica(Modelo.llaves(p.id).publicaFirma);
    const cierre = Cronograma.hito(p.cronograma, 'cierre');
    await agregar('LEAME_PRIMERO.pdf', Pdf.generar({ titulo:'', documento:'Léame primero ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre,
      marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '', bloques:Actas.leame({ pliego:pl, cierreTexto:cierre ? Util.fmtFecha(cierre.fecha) + ' a las ' + cierre.hora : 'según el cronograma', huellaFirma }) }).blob);
    await agregar(Paquete.nombreAcuerdo(p.codigo), Documentos.blobConfidencialidad(p, inv));
    if (et === 'completo'){
      await agregar(p.pliego.generado.nombre, await blobPliego(p));
      for (const d of pl.documentos.filter(x => x.ruta)){
        const b = await Almacen.leerArchivo(d.sha256);
        if (!b) throw new Error('El documento «' + d.nombre + '» no está en este equipo: cárguelo de nuevo en el módulo 05.');
        await agregar(d.ruta, b);
      }
    }
    const man = Paquete.manifiesto({ proceso:p.codigo, versionPliego:p.versionPliego, etapa:et, invitado:pl.invitado, huellaPliego:await Cripto.sha256(textoPl),
      generado:new Date().toISOString(), archivos });
    const firma = await Cripto.firmar(ll.firma, man);
    const z = new JSZip();
    archivos.forEach(a => z.file(a.ruta, a.bytes, { date:FECHA_ZIP }));
    z.file('manifiesto.json', man, { date:FECHA_ZIP });
    z.file('manifiesto.firma', firma, { date:FECHA_ZIP });
    const blob = await z.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:'application/zip' });
    const nombre = Paquete.nombrePaquete(p.codigo, inv.razonSocial, p.versionPliego, et);
    const sha256 = await Archivos.huella(blob);
    const i = Util.copia(inv);
    i.paquetesEmitidos = (i.paquetesEmitidos||[]).concat([{ version:p.versionPliego, etapa:et, nombre, sha256, peso:blob.size, fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario }]);
    if (i.estado === 'por invitar') i.estado = 'invitado';
    await Modelo.guardarInvitado(i, 'paquete ' + (et === 'confidencialidad' ? 'de confidencialidad' : 'completo') + ' v' + p.versionPliego + ' · ' + sha256);
    return { nombre, blob, sha256, etapa:et };
  }

  /** Correo preparado (el usuario lo envía, como en ARKEN): mailto con asunto y cuerpo. */
  function correo(p, inv, nombrePaquete, et){
    const e = S.empresa || {};
    const asunto = (et === 'confidencialidad' ? 'Acuerdo de confidencialidad · ' : 'Invitación a ofertar · ') + p.codigo + ' · ' + p.nombre;
    const cierre = Cronograma.hito(p.cronograma, 'cierre');
    const cuerpo = 'Señores ' + inv.razonSocial + ':\n\n' + (et === 'confidencialidad'
      ? 'Adjuntamos el acuerdo de confidencialidad del proceso ' + p.codigo + '. Descomprima el archivo ' + nombrePaquete + ', abra ARKEN OFERTA con doble clic y siga el LÉAME PRIMERO. Cuando recibamos el sobre de confidencialidad firmado, le enviaremos el paquete completo.'
      : 'Lo invitamos a presentar oferta en el proceso ' + p.codigo + '. Adjuntamos el paquete ' + nombrePaquete + ': descomprímalo, abra ARKEN OFERTA con doble clic y siga el LÉAME PRIMERO. El cierre es el ' + (cierre ? Util.fmtFecha(cierre.fecha) + ' a las ' + cierre.hora : '(ver cronograma)') + '.') +
      '\n\nSu código de invitación es ' + inv.codigoInvitacion + '. El paquete es personal: no lo comparta.\n\nCordialmente,\n' + (Sesion.usuario.nombre || Sesion.usuario.usuario) + '\n' + (e.razonSocial || '');
    return 'mailto:' + encodeURIComponent((inv.contacto||{}).correo || '') + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  }
  function abrirCorreo(url){ const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }

  return { plantillaOferta, llavesAbiertas, etapa, pliegoDe, generar, correo, abrirCorreo, adendasEmitidas };
})();
