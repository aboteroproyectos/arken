/* ══════════════════════════════════════════════════════════════════════════
   ARCHIVOS — huellas SHA-256 en un Web Worker (la pantalla no se congela con
   un modelo de cientos de MB), guardado sin duplicados y visor de PDF e
   imágenes. pdf.js abre los PDF sin ejecutar sus scripts.
   ══════════════════════════════════════════════════════════════════════════ */
const Archivos = (function(){

  const CODIGO_WORKER = 'self.onmessage=async e=>{try{const b=await e.data.arrayBuffer();const h=await crypto.subtle.digest("SHA-256",b);' +
    'self.postMessage({ok:true,hex:Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join("")});}catch(err){self.postMessage({ok:false,error:String(err)});}};';
  let urlWorker = null;

  /** Huella de un Blob o File. Si el navegador no permite el Worker (algunos
      lo impiden con file://), se calcula en el hilo principal. */
  function huella(blob){
    return new Promise((res, rej) => {
      let w;
      try {
        urlWorker = urlWorker || URL.createObjectURL(new Blob([CODIGO_WORKER], { type:'text/javascript' }));
        w = new Worker(urlWorker);
      } catch(e){ blob.arrayBuffer().then(b => Cripto.sha256(b)).then(res, rej); return; }
      w.onmessage = ev => { w.terminate(); if (ev.data.ok) res(ev.data.hex); else blob.arrayBuffer().then(b => Cripto.sha256(b)).then(res, rej); };
      w.onerror = () => { w.terminate(); blob.arrayBuffer().then(b => Cripto.sha256(b)).then(res, rej); };
      w.postMessage(blob);
    });
  }
  function limiteArchivoMB(){ return Number(S.config.limiteArchivoMB) || 500; }
  function limitePaqueteMB(){ return Number(S.config.limitePaqueteMB) || 1024; }

  const TIPOS = { pdf:'PDF', dwg:'AutoCAD DWG', dxf:'AutoCAD DXF', rvt:'Revit', rfa:'Familia de Revit', ifc:'IFC (BIM abierto)', nwd:'Navisworks',
    xlsx:'Excel', xls:'Excel', docx:'Word', doc:'Word', png:'Imagen', jpg:'Imagen', jpeg:'Imagen', webp:'Imagen', zip:'ZIP', txt:'Texto' };
  function extension(nombre){ const m = /\.([a-z0-9]+)$/i.exec(String(nombre||'')); return m ? m[1].toLowerCase() : ''; }
  function tipoLegible(nombre){ return TIPOS[extension(nombre)] || (extension(nombre) ? extension(nombre).toUpperCase() : 'Archivo'); }
  function esImagen(nombre){ return ['png','jpg','jpeg','webp','gif'].indexOf(extension(nombre)) >= 0; }

  /** Guarda el contenido (una sola vez por huella) y devuelve { sha256, peso }. */
  async function guardar(file){
    const sha256 = await huella(file);
    if (!(await Almacen.hayArchivo(sha256))) await Almacen.ponerArchivo(sha256, file);
    return { sha256, peso:file.size };
  }
  async function descargar(sha256, nombre){
    const b = await Almacen.leerArchivo(sha256);
    if (!b) throw new Error('El archivo «' + nombre + '» no está en este equipo (quizás se restauró un respaldo sin archivos).');
    UI.descargar(nombre, b);
  }

  /** Visor: PDF con pdf.js (sin scripts) e imágenes. Lo demás se describe y se descarga. */
  async function ver(doc){
    const b = await Almacen.leerArchivo(doc.sha256);
    if (!b) throw new Error('El archivo no está en este equipo.');
    const ext = extension(doc.nombre);
    const m = UI.modal({ titulo:doc.nombre, eyebrow:tipoLegible(doc.nombre) + ' · ' + Util.pesoLegible(doc.peso), ancho:'xwide',
      cuerpo:'<div class="visor" id="visor"><div class="muted small" style="color:#C5C5C5">Cargando…</div></div>',
      botones:[{ texto:'Descargar', accion:() => descargar(doc.sha256, doc.nombre) }, { texto:'Cerrar', clase:'primary' }] });
    const v = $('#visor', m.el);
    if (esImagen(doc.nombre)){
      const url = URL.createObjectURL(b);
      v.innerHTML = '<img alt="' + esc(doc.nombre) + '">'; $('img', v).src = url;
      return;
    }
    if (ext !== 'pdf' || !window.pdfjsLib){
      v.innerHTML = '<div style="color:#E3E5E6;padding:30px;text-align:center">Este formato (' + esc(tipoLegible(doc.nombre)) +
        ') no se visualiza dentro del programa. Descárguelo para abrirlo con su programa habitual.<br><span class="huella" style="color:#C5C5C5">SHA-256 ' + esc(doc.sha256) + '</span></div>';
      return;
    }
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await b.arrayBuffer()), isEvalSupported:false, enableXfa:false }).promise;
    v.innerHTML = '';
    const max = Math.min(pdf.numPages, 40);
    for (let i = 1; i <= max; i++){
      if (!document.body.contains(v)) return;
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale:1.4 });
      const c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      v.appendChild(c);
      await page.render({ canvasContext:c.getContext('2d'), viewport:vp }).promise;
    }
    if (pdf.numPages > max) v.insertAdjacentHTML('beforeend', '<div style="color:#E3E5E6">Se muestran las primeras ' + max + ' de ' + pdf.numPages + ' páginas. Descargue el archivo para verlo completo.</div>');
  }
  return { huella, guardar, descargar, ver, limiteArchivoMB, limitePaqueteMB, tipoLegible, extension, esImagen };
})();
