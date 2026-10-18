/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · VERIFICACIÓN DEL PAQUETE (§13) — el proponente elige el ZIP
   que recibió; el programa comprueba, en orden:
     1. que es un ZIP sano (sin rutas que salgan de su carpeta ni bombas);
     2. que manifiesto.firma es la firma ECDSA P-384 de manifiesto.json con la
        llave de firma del proceso que trae el pliego;
     3. que el manifiesto es de este proceso, de este invitado y de esta
        versión, y que la huella del pliego incrustado es la del manifiesto;
     4. que cada archivo existe y tiene el tamaño y la huella del manifiesto,
        y que no sobra ninguno.
   Si algo falla, dice qué archivo y por qué, y no deja ofertar.
   ══════════════════════════════════════════════════════════════════════════ */
const Verificacion = (function(){

  function entradas(zip){
    const lista = [];
    zip.forEach((ruta, f) => lista.push({ nombre:ruta, dir:f.dir, descomprimido:f._data && f._data.uncompressedSize, comprimido:f._data && f._data.compressedSize, f }));
    return lista;
  }

  /** Devuelve { ok, problemas:[{ ruta, motivo }], manifiesto, huellaFirma, huellaPliego, blobs:Map(ruta → Blob) }. */
  async function verificar(archivo, pl, textoPliego){
    const r = { ok:false, problemas:[], manifiesto:null, huellaFirma:'', huellaPliego:'', blobs:new Map() };
    const falla = (ruta, motivo) => { r.problemas.push({ ruta, motivo }); return r; };
    if (!window.JSZip) return falla('ARKEN OFERTA', 'no se pudo cargar JSZip dentro del programa');
    r.huellaFirma = pl.llavePublicaFirma ? await Cripto.huellaPublica(pl.llavePublicaFirma) : '';
    r.huellaPliego = await Cripto.sha256(textoPliego);
    let zip;
    try { zip = await JSZip.loadAsync(archivo); } catch(e){ return falla(archivo.name, 'no es un archivo ZIP legible'); }
    const es = entradas(zip);
    const malo = Sobre.revisarZip(es);
    if (malo) return falla(archivo.name, malo);
    const man = zip.file('manifiesto.json'), firma = zip.file('manifiesto.firma');
    if (!man) return falla('manifiesto.json', 'falta en el paquete');
    if (!firma) return falla('manifiesto.firma', 'falta en el paquete');
    const textoMan = await man.async('string');
    const textoFirma = (await firma.async('string')).trim();
    if (!pl.llavePublicaFirma) return falla('pliego', 'no trae la llave pública de firma del proceso');
    let firmaOk = false;
    try { firmaOk = await Cripto.verificar(pl.llavePublicaFirma, textoMan, textoFirma); } catch(e){ firmaOk = false; }
    if (!firmaOk) return falla('manifiesto.firma', 'la firma no corresponde al manifiesto con la llave del proceso: el manifiesto fue modificado o no es de este proceso');
    let m;
    try { m = JSON.parse(textoMan); } catch(e){ return falla('manifiesto.json', 'no es un JSON válido'); }
    r.manifiesto = m;
    if (m.formato !== Paquete.FORMATO_MANIFIESTO) return falla('manifiesto.json', 'no tiene el formato ARKEN-MANIFIESTO');
    if (Util.codigoArchivo(m.proceso) !== Util.codigoArchivo(pl.proceso.codigo)) return falla('manifiesto.json', 'es del proceso ' + m.proceso + ', no de ' + pl.proceso.codigo);
    if (!m.invitado || m.invitado.codigoInvitacion !== pl.invitado.codigoInvitacion) return falla('manifiesto.json', 'es de otro invitado (código ' + ((m.invitado||{}).codigoInvitacion || '—') + ')');
    if (Number(m.versionPliego) !== Number(pl.versionPliego)) return falla('manifiesto.json', 'es de la versión ' + m.versionPliego + ' del pliego y este programa trae la ' + pl.versionPliego);
    if (m.huellaPliego !== r.huellaPliego) return falla(Paquete.nombreOferta(pl.proceso.codigo), 'el pliego que trae este programa no es el que firmó la EMPRESA PRINCIPAL (huella distinta)');
    const mapa = new Map(), rutas = [];
    for (const e of es){
      if (e.dir) continue;
      rutas.push(e.nombre);
      if (e.nombre === 'manifiesto.json' || e.nombre === 'manifiesto.firma') continue;
      const bytes = await e.f.async('uint8array');
      mapa.set(e.nombre, { peso:bytes.length, sha256:await Cripto.sha256(bytes) });
      r.blobs.set(e.nombre, new Blob([bytes]));
    }
    r.problemas = Paquete.compararArchivos(m, mapa, rutas);
    r.ok = !r.problemas.length;
    return r;
  }

  /** Registro de la verificación: se guarda para no pedir el ZIP cada vez. */
  function id(pl, huellaPliego){ return pl.invitado.codigoInvitacion + '@' + pl.versionPliego + '@' + huellaPliego; }
  async function guardar(pl, r){
    // Los documentos del proceso quedan en este equipo para consultarlos en el módulo 02.
    for (const d of (pl.documentos||[])) if (d.ruta && r.blobs.has(d.ruta)) await AlmacenOferta.ponerArchivo(d.sha256, r.blobs.get(d.ruta));
    const reg = { id:id(pl, r.huellaPliego), fecha:new Date().toISOString(), huellaFirma:r.huellaFirma, huellaPliego:r.huellaPliego, archivos:(r.manifiesto.archivos||[]).length };
    await AlmacenOferta.poner('verificaciones', reg);
    return reg;
  }
  async function previa(pl, huellaPliego){ return AlmacenOferta.leer('verificaciones', id(pl, huellaPliego)); }

  return { verificar, guardar, previa };
})();
