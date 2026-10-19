/* ══════════════════════════════════════════════════════════════════════════
   RESPALDO COMPLETO EN ZIP (§6, §24): manifiesto con huellas, un JSON por
   almacén y los archivos por su huella. La restauración muestra antes qué
   trae y qué reemplaza, verifica cada huella y nunca escribe en silencio.
   Las llaves privadas viajan cifradas con la frase del proceso, como están
   guardadas; los respaldos no llevan nada sin cifrar que abra una oferta.
   ══════════════════════════════════════════════════════════════════════════ */
const Respaldo = (function(){
  const FORMATO = 'ARKEN-ANALYTICA-RESPALDO';
  const LIMITES = { entradas:200000, totalMB:8192 };

  async function generar(){
    if (!window.JSZip) throw new Error('No se pudo cargar JSZip dentro del programa.');
    const zip = new window.JSZip();
    const manifiesto = { formato:FORMATO, version:1, programa:'ARKEN ANALYTICA ' + VERSION_PROGRAMA, esquema:Almacen.VERSION,
      generado:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', almacenes:{}, archivos:[] };
    for (const n of Almacen.ALMACENES){
      const texto = JSON.stringify(S[n] || []);
      zip.file('datos/' + n + '.json', texto);
      manifiesto.almacenes[n] = { registros:(S[n]||[]).length, sha256:await Cripto.sha256(texto) };
    }
    const usados = new Set((S.documentosProceso||[]).map(d => d.sha256).concat(...(S.invitados||[]).map(i => (i.confidencialidad && i.confidencialidad.sha256) ? [i.confidencialidad.sha256] : [])));
    for (const sha of usados){
      const b = await Almacen.leerArchivo(sha); if (!b) continue;
      zip.file('archivos/' + sha, b);
      manifiesto.archivos.push({ sha256:sha, peso:b.size });
    }
    zip.file('manifiesto.json', JSON.stringify(manifiesto, null, 2));
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level:6 } });
    await Auditoria.registrar('exportar', 'respaldo', manifiesto.archivos.length + ' archivo(s)');
    return { blob, nombre:'ARKEN_ANALYTICA_respaldo_' + Util.selloArchivo(Date.now(), true) + '.zip', manifiesto };
  }

  /** Ruta segura dentro de un ZIP: sin «..», sin rutas absolutas ni unidades. */
  function rutaSegura(r){ return !(/(^|[\\/])\.\.([\\/]|$)/.test(r) || /^[\\/]/.test(r) || /^[a-zA-Z]:/.test(r)); }

  async function leer(file){
    if (!window.JSZip) throw new Error('No se pudo cargar JSZip dentro del programa.');
    let zip;
    try { zip = await window.JSZip.loadAsync(file); } catch(e){ throw new Error('El archivo no es un ZIP legible.'); }
    const nombres = Object.keys(zip.files);
    if (nombres.length > LIMITES.entradas) throw new Error('El ZIP tiene demasiados archivos para ser un respaldo.');
    let total = 0;
    for (const n of nombres){
      if (!rutaSegura(n)) throw new Error('El ZIP trae una ruta no permitida («' + n + '»). No se restaura.');
      total += (zip.files[n]._data && zip.files[n]._data.uncompressedSize) || 0;
    }
    if (total > LIMITES.totalMB * 1048576) throw new Error('El ZIP descomprimido superaría ' + LIMITES.totalMB + ' MB. No se restaura.');
    const fm = zip.file('manifiesto.json');
    if (!fm) throw new Error('El ZIP no trae manifiesto.json: no es un respaldo de ARKEN ANALYTICA.');
    const man = JSON.parse(await fm.async('string'));
    if (man.formato !== FORMATO) throw new Error('El ZIP no es un respaldo de ARKEN ANALYTICA (formato «' + man.formato + '»).');
    if (man.version !== 1 || Number(man.esquema) > Almacen.VERSION) throw new Error('El respaldo es de una versión más nueva del programa. Actualice ARKEN ANALYTICA.');
    const datos = {}, problemas = [];
    for (const n of Object.keys(man.almacenes || {})){
      if (Almacen.ALMACENES.indexOf(n) < 0) continue;
      const f = zip.file('datos/' + n + '.json');
      if (!f){ problemas.push('Falta datos/' + n + '.json.'); continue; }
      const texto = await f.async('string');
      if (await Cripto.sha256(texto) !== man.almacenes[n].sha256) problemas.push('La huella de datos/' + n + '.json no coincide con el manifiesto.');
      datos[n] = JSON.parse(texto);
    }
    const archivos = [];
    for (const a of (man.archivos || [])){
      const f = zip.file('archivos/' + a.sha256);
      if (!f){ problemas.push('Falta el archivo ' + a.sha256.slice(0, 12) + '….'); continue; }
      const blob = await f.async('blob');
      if (await Cripto.sha256(await blob.arrayBuffer()) !== a.sha256) problemas.push('El archivo ' + a.sha256.slice(0, 12) + '… está alterado.');
      archivos.push({ sha256:a.sha256, blob });
    }
    return { manifiesto:man, datos, archivos, problemas };
  }

  /** Flujo completo con vista previa y confirmación. */
  async function restaurar(file, alTerminar){
    const r = await leer(file);
    const filas = Almacen.ALMACENES.filter(n => n !== 'unicos').map(n =>
      '<tr><td>' + esc(n) + '</td><td class="n">' + (S[n]||[]).length + '</td><td class="n">' + ((r.datos[n]||[]).length) + '</td></tr>').join('');
    const cuerpo = (r.problemas.length ? '<div class="nota bad"><b>El respaldo tiene problemas y no se puede restaurar:</b><ul>' +
        r.problemas.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' : '') +
      '<p>Respaldo generado el <b>' + esc(Util.fmtSello(r.manifiesto.generado)) + '</b> por <b>' + esc(r.manifiesto.usuario || '—') + '</b> con ' + esc(r.manifiesto.programa) + '.</p>' +
      '<div class="nota warn">Restaurar <b>reemplaza todos los datos de este equipo</b> por los del respaldo: procesos, presupuestos, usuarios, auditoría y archivos. Lo que hoy existe y no está en el respaldo se pierde. Descargue antes un respaldo de lo actual si lo necesita.</div>' +
      '<div class="tw"><table class="t"><thead><tr><th>Almacén</th><th class="n">Hoy en este equipo</th><th class="n">En el respaldo</th></tr></thead><tbody>' + filas +
      '<tr><td>archivos</td><td class="n">—</td><td class="n">' + r.archivos.length + '</td></tr></tbody></table></div>';
    if (r.problemas.length){ UI.aviso('Revisión del respaldo', cuerpo, 'wide'); return false; }
    const ok = await UI.confirmar({ titulo:'Restaurar respaldo', eyebrow:'Acción irreversible', ancho:'wide', cuerpo,
      palabra:'REEMPLAZAR', textoAceptar:'Reemplazar todos los datos', claseAceptar:'danger' });
    if (!ok) return false;
    await Almacen.reemplazarTodo(r.datos, r.archivos);
    await Auditoria.registrar('restaurar', 'respaldo', 'Respaldo del ' + Util.fmtSello(r.manifiesto.generado));
    if (alTerminar) alTerminar();
    return true;
  }
  return { generar, leer, restaurar, rutaSegura };
})();
