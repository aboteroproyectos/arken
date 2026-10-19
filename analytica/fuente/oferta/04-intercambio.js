/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · INTERCAMBIO — lo que entra y sale del programa:
     · el sobre de oferta (§16) y el sobre de confidencialidad (§14.2);
     · el borrador en archivo, para seguir en otro equipo;
     · la plantilla de precios en Excel y la importación de precios, de esa
       plantilla o del Excel de ARKEN CONTROL (§15), siempre con vista previa;
     · el archivo de preguntas y la lectura de respuestas y adendas firmadas;
     · la programación desde Microsoft Project (XML) o Excel.
   ══════════════════════════════════════════════════════════════════════════ */
const Intercambio = (function(){

  const FECHA_ZIP = new Date('2026-01-01T00:00:00Z');
  const TIPO_ZIP = 'application/zip';
  function exigirLibrerias(){ if (!window.JSZip) throw new Error('No se pudo cargar JSZip dentro del programa. Abra de nuevo el archivo ARKEN_OFERTA.'); }

  /* ── Adjuntos ── */
  const TIPOS = { pdf:['pdf'], imagen:['png','jpg','jpeg'], excel:['xlsx','xls'], word:['docx','doc'], xml:['xml'], dwg:['dwg'], zip:['zip'] };
  function extension(n){ const m = /\.([a-z0-9]+)$/i.exec(String(n||'')); return m ? m[1].toLowerCase() : ''; }
  function tiposAceptados(r){ const t = ((r && r.documento) || {}).tipos || ['pdf']; return t.flatMap(x => TIPOS[x] || [x]); }
  /** Revisa el archivo contra el requisito (formato y peso) y que no traiga JavaScript. */
  async function revisarAdjunto(file, r){
    const ext = extension(file.name), ok = tiposAceptados(r);
    if (ok.indexOf(ext) < 0) throw new Error('«' + file.name + '» no tiene un formato aceptado para ' + (r ? r.codigo : 'este requisito') + ' (acepta: ' + ok.join(', ') + ').');
    const max = Number(((r && r.documento) || {}).pesoMaxMB) || 25;
    if (file.size > max * 1048576) throw new Error('«' + file.name + '» pesa ' + Util.pesoLegible(file.size) + ' y el máximo para este requisito es ' + max + ' MB.');
    if (ext === 'pdf'){
      const malo = Sobre.pdfConScript(new Uint8Array(await file.arrayBuffer()));
      if (malo) throw new Error('«' + file.name + '» ' + malo + ': por seguridad la EMPRESA PRINCIPAL no lo recibiría. Imprímalo de nuevo a PDF sin formularios activos.');
    }
  }
  async function guardarAdjunto(file){
    const sha256 = await huellaBlob(file);
    await AlmacenOferta.ponerArchivo(sha256, file);
    return { sha256, peso:file.size };
  }

  /* ── Sobre de oferta ── */
  /** Rutas únicas Adjuntos/<código>/<archivo> para cada adjunto. */
  function rutas(b){
    const usadas = new Set(), m = new Map();
    (b.adjuntos||[]).forEach(x => {
      let r = Sobre.rutaAdjunto(x.requisito, x.nombre), n = 2;
      while (usadas.has(r)){ r = Sobre.rutaAdjunto(x.requisito, n + '_' + x.nombre); n++; }
      usadas.add(r); m.set(x.id, r);
    });
    return m;
  }
  async function bytesDe(blob){ return new Uint8Array(await blob.arrayBuffer()); }
  /** Arma el sobre. Devuelve { nombre, blob, cabecera }. */
  async function sobre(b, pl){
    exigirLibrerias();
    const conf = pl.etapa === 'confidencialidad';
    const ahora = new Date();
    const mapa = rutas(b);
    const archivos = [];
    if (conf){
      archivos.push({ ruta:'confidencialidad.json', bytes:new TextEncoder().encode(JSON.stringify({ formato:Sobre.FORMATO_CONF, version:1, proceso:pl.proceso.codigo,
        invitado:pl.invitado, proponente:b.proponente, aceptado:b.acuerdo, generado:ahora.toISOString(),
        adjuntos:(b.adjuntos||[]).map(x => ({ requisito:x.requisito, nombre:x.nombre, ruta:mapa.get(x.id), sha256:x.sha256, peso:x.peso })) }, null, 1)) });
    } else {
      const o = Borrador.oferta(b, pl, mapa);
      o.generado = ahora.toISOString();
      archivos.push({ ruta:'oferta.json', bytes:new TextEncoder().encode(JSON.stringify(o, null, 1)) });
    }
    for (const x of (b.adjuntos||[])){
      const blob = await AlmacenOferta.leerArchivo(x.sha256);
      if (!blob) throw new Error('El adjunto «' + x.nombre + '» (' + x.requisito + ') ya no está en este equipo. Adjúntelo de nuevo.');
      archivos.push({ ruta:mapa.get(x.id), bytes:await bytesDe(blob) });
    }
    const cifrado = !conf && pl.proceso.sobreCerrado !== false;
    const externo = new JSZip();
    const lista = [];
    if (cifrado){
      if (!pl.llavePublicaCifrado) throw new Error('El pliego no trae la llave pública de cifrado del proceso: no se puede cerrar el sobre.');
      const interno = new JSZip();
      archivos.forEach(a => interno.file(a.ruta, a.bytes, { date:FECHA_ZIP }));
      const claro = await interno.generateAsync({ type:'uint8array', compression:'DEFLATE' });
      const c = await Cripto.cifrarSobre(pl.llavePublicaCifrado, claro);
      const env = new TextEncoder().encode(JSON.stringify(c.envuelta, null, 1));
      externo.file('oferta.cifrada', c.cifrado, { date:FECHA_ZIP }); externo.file('llave.envuelta', env, { date:FECHA_ZIP });
      lista.push({ ruta:'oferta.cifrada', sha256:await Cripto.sha256(c.cifrado) }, { ruta:'llave.envuelta', sha256:await Cripto.sha256(env) });
    } else {
      for (const a of archivos){ externo.file(a.ruta, a.bytes, { date:FECHA_ZIP }); lista.push({ ruta:a.ruta, sha256:await Cripto.sha256(a.bytes) }); }
    }
    const cab = Sobre.cabecera({ tipo:conf ? 'confidencialidad' : 'oferta', proceso:pl.proceso.codigo, versionPliego:pl.versionPliego,
      huellaPliego:await Cripto.sha256(Paquete.texto(pl)), invitado:pl.invitado, generado:ahora.toISOString(), versionPrograma:VERSION_PROGRAMA,
      sha256Contenido:await Sobre.huellaContenido(lista), cifrado });
    externo.file('sobre.json', JSON.stringify(cab, null, 1), { date:FECHA_ZIP });
    const blob = await externo.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:TIPO_ZIP });
    const nombre = conf ? Sobre.nombreConfidencialidad(b.proponente.razonSocial, pl.proceso.codigo, ahora) : Sobre.nombre(b.proponente.razonSocial, pl.proceso.codigo, pl.versionPliego, ahora);
    return { nombre, blob, cabecera:cab };
  }

  /* ── Borrador en archivo ── */
  async function borradorArchivo(b){
    exigirLibrerias();
    const z = new JSZip();
    z.file('borrador.json', JSON.stringify({ formato:'ARKEN-OFERTA-BORRADOR', version:1, guardado:new Date().toISOString(), borrador:b }, null, 1), { date:FECHA_ZIP });
    for (const x of (b.adjuntos||[])){ const bl = await AlmacenOferta.leerArchivo(x.sha256); if (bl) z.file('archivos/' + x.sha256, bl, { date:FECHA_ZIP }); }
    return { nombre:Util.razonSocialArchivo(b.proponente.razonSocial) + '_' + Util.codigoArchivo(b.proceso) + '_BORRADOR_' + Util.selloArchivo(Date.now(), true) + '.zip',
      blob:await z.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:TIPO_ZIP }) };
  }
  async function leerBorradorArchivo(file, pl){
    exigirLibrerias();
    let z;
    try { z = await JSZip.loadAsync(file); } catch(e){ throw new Error('El archivo no es un ZIP legible.'); }
    const es = []; z.forEach((ruta, f) => es.push({ nombre:f.unsafeOriginalName || ruta, dir:f.dir, descomprimido:f._data && f._data.uncompressedSize, comprimido:f._data && f._data.compressedSize }));
    const malo = Sobre.revisarZip(es);
    if (malo) throw new Error(malo);
    const j = z.file('borrador.json');
    if (!j) throw new Error('El ZIP no trae borrador.json: no es un borrador de ARKEN OFERTA.');
    let o; try { o = JSON.parse(await j.async('string')); } catch(e){ throw new Error('borrador.json no es un JSON válido.'); }
    if (!o || o.formato !== 'ARKEN-OFERTA-BORRADOR' || !o.borrador) throw new Error('El archivo no es un borrador de ARKEN OFERTA.');
    const b = o.borrador;
    if (b.id !== pl.invitado.codigoInvitacion) throw new Error('El borrador es de otra invitación (código ' + b.id + '), no de la de este paquete.');
    for (const x of (b.adjuntos||[])){
      const f = z.file('archivos/' + x.sha256);
      if (!f) continue;
      const bytes = await f.async('uint8array');
      if (await Cripto.sha256(bytes) !== x.sha256) throw new Error('El adjunto «' + x.nombre + '» del borrador no coincide con su huella.');
      await AlmacenOferta.ponerArchivo(x.sha256, new Blob([bytes]));
    }
    return { borrador:b, guardado:o.guardado };
  }

  /* ── Plantilla de precios en Excel ── */
  const ENC_PRECIOS = ['Código capítulo','Capítulo','Código subcapítulo','Subcapítulo','Código actividad','Descripción','Unidad','Cantidad','Precio unitario','Valor'];
  const ENC_APU = ['Código actividad','Código APU','Nombre del APU','Unidad del APU','Insumo','Unidad del insumo','Categoría','Precio (IVA incluido)','Rendimiento'];
  /** Libro con las actividades del pliego. Las columnas A a H no se pueden cambiar: la importación lo comprueba. */
  function plantillaPrecios(b, pl){
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    const acts = Borrador.actividades(pl);
    const filas = [ENC_PRECIOS].concat(acts.map((a, i) => {
      const x = Borrador.act(b, a.clave);
      const pu = (x.apus||[]).some(ap => (ap.insumos||[]).length) ? '' : (Number(x.precioUnitario) || '');
      return [a.cap, a.capNombre, a.sub, a.subNombre, a.codigo, a.nombre, a.unidad, a.cantidad, pu, { f:'H' + (i + 2) + '*I' + (i + 2) }];
    }));
    const apu = [ENC_APU];
    acts.forEach(a => (Borrador.act(b, a.clave).apus||[]).forEach(ap => (ap.insumos||[]).forEach(i =>
      apu.push([a.codigo, ap.codigo, ap.nombre, ap.unidad, i.descripcion, i.unidad, i.categoria, Number(i.precio||0), Number(i.cantidad||0)]))));
    const ins = [['Instrucciones de la plantilla de precios'], [''],
      ['Proceso', pl.proceso.codigo + ' · ' + pl.proceso.nombre], ['Proponente', b.proponente.razonSocial], ['Versión del pliego', pl.versionPliego], [''],
      ['1. En la hoja «Precios» escriba el precio unitario de cada actividad (columna I). No cambie las columnas A a H: código, descripción, unidad y cantidad son del pliego.'],
      ['2. Si quiere entregar APU, use la hoja «APU»: un renglón por insumo, con el código de la actividad. Donde haya APU, el precio unitario es la suma del APU.'],
      ['3. Las categorías válidas son: ' + Calculo.CATEGORIAS_INSUMO.join(', ') + '. Los precios de insumo van con IVA incluido.'],
      ['4. Guarde el libro y en ARKEN OFERTA, módulo 03, elija «Importar precios». El programa muestra qué coincide, qué falta y qué sobra antes de escribir nada.'],
      ['5. Las observaciones a las cantidades no se hacen aquí: se hacen como preguntas (módulo 13).']];
    const control = [['formato','ARKEN-PLANTILLA-PRECIOS'], ['version', 1], ['proceso', pl.proceso.codigo], ['versionPliego', pl.versionPliego], ['codigoInvitacion', pl.invitado.codigoInvitacion]];
    const wb = XLSX.utils.book_new();
    const hP = XLSX.utils.aoa_to_sheet(filas);
    hP['!cols'] = [{ wch:10 },{ wch:28 },{ wch:10 },{ wch:28 },{ wch:12 },{ wch:50 },{ wch:8 },{ wch:12 },{ wch:16 },{ wch:18 }];
    const hA = XLSX.utils.aoa_to_sheet(apu);
    hA['!cols'] = [{ wch:12 },{ wch:12 },{ wch:32 },{ wch:10 },{ wch:40 },{ wch:10 },{ wch:14 },{ wch:16 },{ wch:12 }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ins), 'Instrucciones');
    XLSX.utils.book_append_sheet(wb, hP, 'Precios');
    XLSX.utils.book_append_sheet(wb, hA, 'APU');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(control), 'Control');
    wb.Workbook = { Sheets:[{ Hidden:0 }, { Hidden:0 }, { Hidden:0 }, { Hidden:1 }] };
    const datos = XLSX.write(wb, { type:'array', bookType:'xlsx' });
    return { nombre:Util.razonSocialArchivo(b.proponente.razonSocial) + '_' + Util.codigoArchivo(pl.proceso.codigo) + '_PLANTILLA_PRECIOS_v' + pl.versionPliego + '.xlsx',
      blob:new Blob([datos], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }

  const num = v => { if (typeof v === 'number') return v; const s = String(v === undefined || v === null ? '' : v).trim().replace(/\$|\s/g, '').replace(/,/g, ''); return s === '' ? NaN : Number(s); };
  function hoja(wb, nombre){ const n = wb.SheetNames.find(x => Util.normaliza(x) === Util.normaliza(nombre)); return n ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header:1, defval:'', raw:true }) : null; }
  /** Plan de importación: { origen, acts:Map(clave → { precioUnitario, apus }), coinciden, faltan, sobran, errores, avisos }. */
  function planVacio(origen){ return { origen, acts:new Map(), coinciden:[], faltan:[], sobran:[], errores:[], avisos:[] }; }
  function cerrarPlan(plan, pl){
    Borrador.actividades(pl).forEach(a => { if (plan.acts.has(a.clave)) plan.coinciden.push(a.codigo); else plan.faltan.push(a.codigo + ' ' + a.nombre); });
    return plan;
  }
  function leerPlantilla(wb, pl){
    const plan = planVacio('Plantilla de precios de ARKEN OFERTA');
    const ctl = hoja(wb, 'Control');
    if (ctl){
      const m = new Map(ctl.map(f => [String(f[0]), f[1]]));
      if (m.get('proceso') && Util.codigoArchivo(m.get('proceso')) !== Util.codigoArchivo(pl.proceso.codigo)) plan.errores.push('La plantilla es del proceso ' + m.get('proceso') + ', no de ' + pl.proceso.codigo + '.');
      if (m.get('versionPliego') && Number(m.get('versionPliego')) !== Number(pl.versionPliego)) plan.avisos.push('La plantilla se generó con la versión ' + m.get('versionPliego') + ' del pliego; la vigente es la ' + pl.versionPliego + '. Se empareja por código y se revisan las cantidades.');
    }
    const P = hoja(wb, 'Precios');
    if (!P) { plan.errores.push('El libro no trae la hoja «Precios».'); return plan; }
    const acts = Borrador.actividades(pl);
    const porClave = new Map(acts.map(a => [a.clave, a]));
    const porCodigo = new Map(); acts.forEach(a => { if (!porCodigo.has(Util.normaliza(a.codigo))) porCodigo.set(Util.normaliza(a.codigo), a); });
    P.slice(1).forEach((f, i) => {
      const fila = i + 2;
      if (!String(f[4]||'').trim()) return;
      const a = porClave.get(Sobre.claveActividad(f[0], f[2], f[4])) || porCodigo.get(Util.normaliza(f[4]));
      if (!a){ plan.sobran.push(String(f[4])); return; }
      if (Util.normaliza(f[5]) !== Util.normaliza(a.nombre)) plan.errores.push('Precios, fila ' + fila + ': cambió la descripción de ' + a.codigo + ' (las columnas A a H no se pueden cambiar).');
      if (Util.normaliza(f[6]) !== Util.normaliza(a.unidad)) plan.errores.push('Precios, fila ' + fila + ': cambió la unidad de ' + a.codigo + '.');
      if (Math.abs(num(f[7]) - a.cantidad) > 1e-6) plan.errores.push('Precios, fila ' + fila + ': cambió la cantidad de ' + a.codigo + ' (el pliego dice ' + Util.cant(a.cantidad) + ').');
      const pu = num(f[8]);
      if (String(f[8]).trim() !== '' && !(pu >= 0)) plan.errores.push('Precios, fila ' + fila + ': el precio unitario de ' + a.codigo + ' no es un número.');
      plan.acts.set(a.clave, { precioUnitario:pu >= 0 ? pu : 0, apus:[] });
    });
    const A = hoja(wb, 'APU') || [];
    const grupos = new Map();
    A.slice(1).forEach((f, i) => {
      const fila = i + 2;
      if (!String(f[0]||'').trim() && !String(f[4]||'').trim()) return;
      const a = porCodigo.get(Util.normaliza(f[0]));
      if (!a){ plan.avisos.push('APU, fila ' + fila + ': la actividad ' + f[0] + ' no está en el pliego; se ignora.'); return; }
      const cat = Calculo.CATEGORIAS_INSUMO.find(c => Util.normaliza(c) === Util.normaliza(f[6]));
      if (!cat) plan.errores.push('APU, fila ' + fila + ': la categoría «' + f[6] + '» no es una de las siete de ARKEN.');
      const precio = num(f[7]), cantidad = num(f[8]);
      if (!(precio >= 0)) plan.errores.push('APU, fila ' + fila + ': el precio no es un número.');
      if (!(cantidad >= 0)) plan.errores.push('APU, fila ' + fila + ': el rendimiento no es un número.');
      const k = a.clave + '#' + Util.normaliza(f[1] || 'APU');
      if (!grupos.has(k)) grupos.set(k, { clave:a.clave, ap:{ id:Util.uid('ap'), codigo:String(f[1] || 'APU-' + a.codigo), nombre:String(f[2] || a.nombre), unidad:String(f[3] || a.unidad), insumos:[] } });
      grupos.get(k).ap.insumos.push({ descripcion:String(f[4]||''), unidad:String(f[5]||''), categoria:cat || 'Materiales', precio:precio >= 0 ? precio : 0, cantidad:cantidad >= 0 ? cantidad : 0 });
    });
    grupos.forEach(g => { const x = plan.acts.get(g.clave) || { precioUnitario:0, apus:[] }; x.apus.push(g.ap); plan.acts.set(g.clave, x); });
    return cerrarPlan(plan, pl);
  }
  /** El Excel de presupuesto de ARKEN CONTROL (§4.2), emparejado por código de actividad. */
  function leerArken(wb, pl){
    const plan = planVacio('Excel de ARKEN CONTROL');
    const v = ExcelArken.validarPresupuestoExcel({ capitulos:[], apus:[], insumos:[] }, wb);
    v.errores.forEach(e => plan.errores.push(e.hoja + (e.fila ? ', fila ' + e.fila : '') + ': ' + e.msg));
    if (v.errores.length) return plan;
    const pres = ExcelArken.aplicarPlan({ capitulos:[], apus:[], insumos:[], aiu:{ a:0, i:0, u:0 } }, v, { modo:'reemplazar' });
    const acts = Borrador.actividades(pl);
    const porClave = new Map(acts.map(a => [a.clave, a]));
    const porCodigo = new Map(); acts.forEach(a => { if (!porCodigo.has(Util.normaliza(a.codigo))) porCodigo.set(Util.normaliza(a.codigo), a); });
    Calculo.recorrerActividades(pres, (x, s, c) => {
      const a = porClave.get(Sobre.claveActividad(c.codigo, s.codigo, x.codigo)) || porCodigo.get(Util.normaliza(x.codigo));
      if (!a){ plan.sobran.push(x.codigo + ' ' + x.nombre); return; }
      if (Math.abs(Number(x.cantidad||0) - a.cantidad) > 1e-6) plan.avisos.push(a.codigo + ': el Excel dice ' + Util.cant(x.cantidad) + ' ' + x.unidad + ' y el pliego ' + Util.cant(a.cantidad) + ' ' + a.unidad + '. Se usa la cantidad del pliego.');
      plan.acts.set(a.clave, { precioUnitario:0, apus:(x.apus||[]).map(id => {
        const ap = Calculo.apu(pres, id);
        return { id:Util.uid('ap'), codigo:ap.codigo, nombre:ap.nombre, unidad:ap.unidad, insumos:(ap.insumos||[]).map(l => {
          const ins = Calculo.insumo(pres, l.idInsumo) || {};
          return { descripcion:ins.nombre || '', unidad:ins.unidad || '', categoria:ins.categoria || 'Materiales', precio:Number(ins.precio||0), cantidad:Number(l.cantidad||0) };
        }) };
      }) });
    });
    return cerrarPlan(plan, pl);
  }
  /** Lee un libro y decide si es la plantilla de ARKEN OFERTA o un Excel de ARKEN CONTROL. */
  function leerPrecios(arrayBuffer, pl){
    if (!window.XLSX) throw new Error('No se pudo cargar SheetJS dentro del programa.');
    let wb;
    try { wb = XLSX.read(arrayBuffer, { type:'array' }); } catch(e){ throw new Error('El archivo no es un libro de Excel legible.'); }
    return hoja(wb, 'Precios') ? leerPlantilla(wb, pl) : leerArken(wb, pl);
  }
  /** Escribe el plan en el borrador: solo las actividades que trae el archivo. */
  function aplicarPrecios(b, plan){
    plan.acts.forEach((x, clave) => {
      b.acts[clave] = { precioUnitario:x.precioUnitario, apus:x.apus };
      Borrador.marcarRevisado(b, 'actividades', clave);
    });
  }

  /* ── Preguntas, respuestas y adendas ── */
  function archivoPreguntas(b, pl, preguntas){
    const ahora = Date.now();
    const o = Adendas.archivoPreguntas({ proceso:pl.proceso.codigo, versionPliego:pl.versionPliego, invitado:pl.invitado, generado:new Date(ahora).toISOString(), preguntas });
    return { nombre:Adendas.nombrePreguntas(b.proponente.razonSocial, pl.proceso.codigo, ahora), texto:JSON.stringify(o, null, 1) };
  }
  async function leerRespuestas(texto, pl){ return Adendas.leerFirmado(texto, Adendas.F_RESPUESTAS, pl.proceso.codigo, pl.llavePublicaFirma); }
  async function leerAdenda(texto, pl){
    const a = await Adendas.leerFirmado(texto, Adendas.F_ADENDA, pl.proceso.codigo, pl.llavePublicaFirma);
    if (Number(a.versionAnterior) !== Number(pl.versionPliego))
      throw new Error('La adenda ' + a.numero + ' cambia la versión ' + a.versionAnterior + ' del pliego y este programa tiene la ' + pl.versionPliego + '. Importe las adendas en orden.');
    if (!a.pliego || a.pliego.formato !== Paquete.FORMATO) throw new Error('La adenda no trae el pliego de la versión nueva.');
    return a;
  }

  /* ── Programación ── */
  /** Microsoft Project XML: tareas con nombre, inicio, fin y predecesoras. */
  function leerProject(texto){
    const doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un XML legible.');
    const tareas = Array.from(doc.getElementsByTagName('Task'));
    if (!tareas.length) throw new Error('El XML no trae tareas de Microsoft Project.');
    const t = el => (n => n ? n.textContent.trim() : '')(el);
    const hijo = (x, n) => t(x.getElementsByTagName(n)[0]);
    const porUid = new Map();
    const filas = [];
    tareas.forEach(x => {
      if (hijo(x, 'Summary') === '1' || hijo(x, 'OutlineLevel') === '0' || !hijo(x, 'Name')) return;
      const f = { uid:hijo(x, 'UID'), actividad:hijo(x, 'Name'), inicio:hijo(x, 'Start').slice(0, 10), fin:hijo(x, 'Finish').slice(0, 10),
        predUids:Array.from(x.getElementsByTagName('PredecessorLink')).map(p => hijo(p, 'PredecessorUID')), cuadrillas:'' };
      porUid.set(f.uid, f); filas.push(f);
    });
    return filas.map(f => ({ actividad:f.actividad, inicio:f.inicio, fin:f.fin, predecesoras:f.predUids.map(u => (porUid.get(u)||{}).actividad).filter(Boolean).join(', '), cuadrillas:f.cuadrillas }));
  }
  function fechaExcel(v){
    if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    const s = String(v||'').trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    return m ? m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0') : s.slice(0, 10);
  }
  function leerProgramacionExcel(arrayBuffer){
    const wb = XLSX.read(arrayBuffer, { type:'array' });
    const F = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'', raw:true });
    const enc = (F[0]||[]).map(Util.normaliza);
    const col = claves => enc.findIndex(h => claves.some(c => h.indexOf(c) >= 0));
    const c = { actividad:col(['actividad','tarea','nombre']), inicio:col(['inicio','comienzo']), fin:col(['fin']), predecesoras:col(['predecesora']), cuadrillas:col(['cuadrilla']) };
    if (c.actividad < 0 || c.inicio < 0 || c.fin < 0) throw new Error('La primera hoja debe tener columnas Actividad, Inicio y Fin (y, si quiere, Predecesoras y Cuadrillas).');
    return F.slice(1).filter(f => String(f[c.actividad]||'').trim()).map(f => ({ actividad:String(f[c.actividad]).trim(), inicio:fechaExcel(f[c.inicio]), fin:fechaExcel(f[c.fin]),
      predecesoras:c.predecesoras >= 0 ? String(f[c.predecesoras]||'') : '', cuadrillas:c.cuadrillas >= 0 ? f[c.cuadrillas] : '' }));
  }

  return { tiposAceptados, extension, revisarAdjunto, guardarAdjunto, rutas, sobre, borradorArchivo, leerBorradorArchivo, plantillaPrecios,
    leerPrecios, aplicarPrecios, archivoPreguntas, leerRespuestas, leerAdenda, leerProject, leerProgramacionExcel };
})();
