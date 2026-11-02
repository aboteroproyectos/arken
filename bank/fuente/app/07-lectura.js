/* ══════════════════════════════════════════════════════════════════════════
   DOCUMENTOS DEL CLIENTE — carga, texto y lectura, todo dentro del equipo.
   · Cargar: cada archivo se guarda en el almacén por su huella SHA-256 (un
     mismo archivo nunca se guarda dos veces) y queda asociado al cliente y al
     tipo de documento del catálogo.
   · Texto: de los PDF lo saca pdf.js. Las páginas sin texto (escaneadas) y las
     imágenes (JPG, PNG) pasan por el reconocimiento de texto (OCR, Tesseract
     en español), que viaja dentro del programa: no se usa internet.
   · Lectura: el lector (fuente/nucleo/30-lector.js) busca los datos de ese
     tipo de documento, y cada dato queda con su página y su texto literal.
   · Al perfil: el analista revisa los datos y elige cuáles pasan al perfil
     del cliente; cada valor recuerda de qué documento salió.
   ══════════════════════════════════════════════════════════════════════════ */
const Archivos = (function(){
  const TIPOS_OK = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff', 'txt'];
  const MAX_MB = 40;
  function extension(n){ const m = /\.([a-z0-9]+)$/i.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; }
  function esImagen(n){ return ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].indexOf(extension(n)) >= 0; }

  async function cargar(c, tipoDoc, files){
    Permisos.exigir('cargarDocumentos');
    const hechos = [];
    for (const f of files){
      const ext = extension(f.name);
      if (TIPOS_OK.indexOf(ext) < 0){ UI.toast('«' + f.name + '»: use PDF o imágenes (JPG, PNG).', 'bad'); continue; }
      if (f.size > MAX_MB * 1048576){ UI.toast('«' + f.name + '» pesa más de ' + MAX_MB + ' MB.', 'bad'); continue; }
      const bytes = new Uint8Array(await f.arrayBuffer());
      const sha = await Cripto.sha256(bytes);
      const repetido = Modelo.documentos(c.id).find(d => d.sha256 === sha);
      if (repetido){ UI.toast('«' + f.name + '» ya está cargado como «' + repetido.nombre + '».', 'bad'); continue; }
      if (!(await Almacen.hayArchivo(sha))) await Almacen.ponerArchivo(sha, new Blob([bytes], { type:f.type || (ext === 'pdf' ? 'application/pdf' : '') }));
      const d = { id:Util.uid('doc'), clienteId:c.id, tipoDoc:tipoDoc || 'otro', nombre:f.name, sha256:sha, peso:f.size, tipo:f.type || '',
        cargado:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', lectura:null, fechaExpedicion:'', demo:!!c.demo };
      await Modelo.guardarDocumento(d);
      await Auditoria.registrar('cargar', 'documento', f.name + ' · ' + ((Catalogo.documento(tipoDoc) || {}).nombre || 'Otro'), c.id);
      hechos.push(d);
    }
    return hechos;
  }
  async function blob(d){ const b = await Almacen.leerArchivo(d.sha256); if (!b) throw new Error('El archivo «' + d.nombre + '» no está en este equipo.'); return b; }
  /** Muestra el archivo en un visor dentro del programa. */
  async function ver(d){
    const b = await blob(d);
    const url = URL.createObjectURL(b.type ? b : new Blob([b], { type:extension(d.nombre) === 'pdf' ? 'application/pdf' : 'image/' + extension(d.nombre) }));
    const cuerpo = esImagen(d.nombre) ? '<div class="visor"><img alt="" src="' + url + '"></div>' : '<iframe class="visor-pdf" title="' + esc(d.nombre) + '" src="' + url + '"></iframe>';
    UI.modal({ titulo:d.nombre, eyebrow:'Documento del cliente', ancho:'full', cuerpo, alCerrar(){ setTimeout(() => URL.revokeObjectURL(url), 1000); },
      botones:[{ texto:'Descargar', accion:() => UI.descargar(d.nombre, b) }, { texto:'Cerrar', clase:'primary' }] });
  }
  return { TIPOS_OK, extension, esImagen, cargar, blob, ver };
})();

/* ── Reconocimiento de texto (OCR) ──
   Tesseract.js 5.1.1, su núcleo de WebAssembly y el idioma español viajan
   dentro del programa en base64 y se cargan como blob: funciona sin internet.
   El modelo es el de LSTM «best_int» (más preciso y liviano que el combinado). */
const Ocr = (function(){
  let promesa = null;
  function bytesDe(id){
    const el = document.getElementById(id); if (!el) return null;
    const bin = atob(el.textContent.trim()); const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function urlDe(id, tipo){ const b = bytesDe(id); return b ? URL.createObjectURL(new Blob([b], { type:tipo })) : null; }
  function disponible(){ return !!(window.Tesseract && document.getElementById('ocr-core') && document.getElementById('ocr-spa')); }
  async function trabajador(progreso){
    if (!disponible()) throw new Error('El reconocimiento de texto no está disponible en este archivo del programa.');
    if (!promesa){
      promesa = (async () => {
        /* Tesseract 5.1.1 no inicializa un idioma que se le entrega como datos ({ code, data }),
           así que el modelo se le sirve como si viniera de una carpeta: el worker trae una
           «fetch» que entrega el modelo incrustado cuando se le pide arken-ocr://spa. */
        const spa = urlDe('ocr-spa', 'application/gzip');
        const prefijo = 'const __arkenSpa=' + JSON.stringify(spa) + ',__arkenFetch=self.fetch.bind(self);' +
          'self.fetch=function(u,o){return String(u).indexOf("arken-ocr://")===0?__arkenFetch(__arkenSpa,o):__arkenFetch(u,o);};\n';
        const workerPath = URL.createObjectURL(new Blob([prefijo, bytesDe('ocr-worker')], { type:'text/javascript' }));
        // El nombre debe terminar en «.js» para que Tesseract use este núcleo tal cual.
        const corePath = urlDe('ocr-core', 'text/javascript') + '#tesseract-core-simd-lstm.wasm.js';
        const listo = window.Tesseract.createWorker('spa', 1, {
          workerPath, corePath, langPath:'arken-ocr://spa', cacheMethod:'none', gzip:true, lstmOnly:true,
          logger:m => { if (actual && m && typeof m.progress === 'number') actual(m); },
          errorHandler:e => RegistroTecnico.anotar('OCR', e)
        });
        // Si el motor no arranca, la lectura no se queda esperando para siempre.
        return Promise.race([listo, new Promise((_, rej) => setTimeout(() => rej(new Error('El reconocimiento de texto no pudo arrancar en este navegador. Use un PDF con texto o actualice el navegador.')), 120000))]);
      })();
      promesa.catch(() => { promesa = null; });
    }
    actual = progreso || null;
    return promesa;
  }
  let actual = null;
  /** Texto de una imagen (Blob, canvas o URL). */
  async function reconocer(imagen, progreso){
    const w = await trabajador(progreso);
    actual = progreso || null;
    const r = await w.recognize(imagen);
    return (r && r.data && r.data.text) || '';
  }
  return { disponible, reconocer };
})();

const Lectura = (function(){
  const MIN_TEXTO = 40;   // menos caracteres que esto en una página: se trata como escaneada

  async function abrirPdf(bytes){
    if (!window.pdfjsLib) throw new Error('El lector de PDF no está disponible.');
    return window.pdfjsLib.getDocument({ data:bytes, isEvalSupported:false, enableXfa:false }).promise;
  }
  async function paginaComoImagen(pdf, n){
    const p = await pdf.getPage(n);
    const v = p.getViewport({ scale:2.2 });
    const cv = document.createElement('canvas'); cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    await p.render({ canvasContext:cx, viewport:v }).promise;
    return cv;
  }

  /** Texto de cada página. aviso(texto) informa el avance. */
  async function texto(d, aviso){
    const b = await Archivos.blob(d);
    const ext = Archivos.extension(d.nombre);
    const av = aviso || (() => {});
    if (ext === 'txt') return { paginas:[await b.text()], metodo:'texto' };
    if (Archivos.esImagen(d.nombre) || ext === 'tif' || ext === 'tiff'){
      av('Reconociendo el texto de la imagen…');
      const t = await Ocr.reconocer(b, m => av('Reconociendo texto · ' + Math.round(m.progress * 100) + ' %'));
      return { paginas:[t], metodo:'ocr' };
    }
    const pdf = await abrirPdf(new Uint8Array(await b.arrayBuffer()));
    const P = [], ocr = [];
    for (let i = 1; i <= pdf.numPages; i++){
      av('Leyendo la página ' + i + ' de ' + pdf.numPages + '…');
      const t = await (await pdf.getPage(i)).getTextContent();
      let s = t.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('');
      if (s.replace(/\s/g, '').length < MIN_TEXTO && Ocr.disponible()){
        av('Página ' + i + ' escaneada: reconociendo el texto…');
        const cv = await paginaComoImagen(pdf, i);
        s = await Ocr.reconocer(cv, m => av('Página ' + i + ' · reconociendo texto ' + Math.round(m.progress * 100) + ' %'));
        ocr.push(i);
      }
      P.push(s);
    }
    return { paginas:P, metodo:ocr.length ? (ocr.length === P.length ? 'ocr' : 'mixto') : 'texto', paginasOcr:ocr };
  }

  /** Lee el documento y guarda la lectura en él. */
  async function leer(d, aviso){
    Permisos.exigir('leerDocumentos');
    const t = await texto(d, aviso);
    const todo = t.paginas.join('\n');
    if (!todo.replace(/\s/g, '').length) throw new Error('No se encontró texto en «' + d.nombre + '». Si es una foto, tómela con más luz y de frente; si es un PDF protegido, imprímalo a PDF de nuevo.');
    const clas = Lector.clasificar(t.paginas);
    const tipo = d.tipoDoc && d.tipoDoc !== 'otro' ? d.tipoDoc : (clas ? clas.id : 'otro');
    const def = Catalogo.documento(tipo);
    const campos = def && def.lee.length ? def.lee.concat(def.lee.indexOf('fecha_expedicion') < 0 ? ['fecha_expedicion'] : []) : Lector.CAMPOS.map(c => c.k);
    const datos = Lector.leer(t.paginas, campos);
    const r = Util.copia(d);
    if (r.tipoDoc === 'otro' && clas) r.tipoDoc = clas.id;
    r.lectura = { fecha:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', metodo:t.metodo, paginasOcr:t.paginasOcr || [],
      numPaginas:t.paginas.length, clasificado:clas ? clas.id : null, coincideTipo:!clas || !d.tipoDoc || d.tipoDoc === 'otro' || clas.id === d.tipoDoc,
      datos, faltan:Lector.faltantes(datos, campos), texto:t.paginas.map(p => p.slice(0, 20000)) };
    if (!r.fechaExpedicion){ const f = datos.find(x => x.campo === 'fecha_expedicion' && !x.motivo); if (f && f.normalizado) r.fechaExpedicion = f.normalizado; }
    await Modelo.guardarDocumento(r);
    await Auditoria.registrar('leer', 'documento', d.nombre + ' · ' + datos.length + ' dato(s) · ' + t.metodo, d.clienteId);
    return Modelo.documento(r.id);
  }

  /** Las propuestas de un documento para el perfil del cliente: [{ k, valor, actual, dato, nota }]. */
  function propuestas(c, d){
    if (!d.lectura) return [];
    const usados = new Set(), out = [];
    d.lectura.datos.filter(x => !x.descartado && !x.motivo).forEach(x => {
      const p = Lector.propuesta(x, c.tipo, d.lectura.datos);
      if (!p || usados.has(p.k)) return;
      usados.add(p.k);
      out.push(Object.assign(p, { dato:x, actual:(c.perfil || {})[p.k] }));
    });
    return out;
  }
  async function aplicar(c, d, lista){
    const cambios = {}, fuentes = {};
    lista.forEach(p => { cambios[p.k] = p.valor; fuentes[p.k] = { docId:d.id, documento:d.nombre, pagina:p.dato.pagina, texto:p.dato.texto, fecha:new Date().toISOString() }; });
    return Modelo.actualizarPerfil(c.id, cambios, fuentes);
  }
  return { texto, leer, propuestas, aplicar };
})();
