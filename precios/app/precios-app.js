/* ═══════════════════════════════════════════════════════════════════════════
   ARKEN PRECIOS · capa de la app (Windows, macOS, Linux, Android e iOS)

   El programa es el mismo archivo HTML de siempre. Esta capa se carga antes que
   él y ajusta solo lo que un navegador hace distinto dentro de una app:

   · Copia interna: el programa guarda en IndexedDB como siempre. Cuando los
     datos cambian, la capa arma un respaldo completo (el mismo de
     Administración › Respaldos, con su hash y sin la bóveda de secretos) y lo
     guarda en un archivo del equipo. Si el sistema llegara a borrar el
     almacenamiento interno, la app recupera los datos de esa copia al abrir. En
     el computador queda además una copia por día de los últimos 10 días, que se
     restaura con «Restaurar respaldo».
   · Archivos que el programa descarga (PDF, Excel, respaldos): en el celular
     se abren en un visor o en el menú Compartir del teléfono.
   · Imprimir: en el celular sale el PDF del documento, listo para compartir o
     imprimir.
   · Enlaces a tiendas, correo y WhatsApp: se abren en la app del teléfono.
   · «Guardar copia» produce el mismo HTML del repositorio, que se abre igual en
     cualquier navegador.
   · El lector de PDF funciona sin internet.

   En el computador, el motor de conectores y la bóveda de secretos los expone
   electron/preload.cjs (window.arkenPrecios) y el programa los usa directamente.
   En un navegador normal esta capa no hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────  PLATAFORMA  ───────────────────────── */
  const Cap = window.Capacitor;
  const Escritorio = window.arkenPrecios && window.arkenPrecios.copia ? window.arkenPrecios : null; // electron/preload.cjs
  const nativo = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plataforma = nativo ? Cap.getPlatform() : Escritorio ? Escritorio.plataforma : 'web';
  if (plataforma === 'web') return;
  const MOVIL = plataforma === 'android' || plataforma === 'ios';
  if (MOVIL && !nativo) return;

  const plugin = (nombre) => (Cap.Plugins && Cap.Plugins[nombre]) || Cap.registerPlugin(nombre);
  const Filesystem = MOVIL ? plugin('Filesystem') : null;
  const Compartir = MOVIL ? plugin('Share') : null;
  const AppNativa = MOVIL ? plugin('App') : null;
  const Lanzador = MOVIL ? plugin('AppLauncher') : null;
  const BarrasSistema = MOVIL ? plugin('SystemBars') : null;

  const aviso = (msg, tipo) => {
    try {
      if (typeof UI !== 'undefined') return UI.toast(msg, tipo);
    } catch (e) {}
    console.log('ARKEN PRECIOS · ' + msg);
  };
  const registrar = (msg, err) => {
    console.warn('ARKEN PRECIOS · ' + msg, err || '');
    try {
      if (typeof RegistroTecnico !== 'undefined') RegistroTecnico.anotar('App: ' + msg, err instanceof Error ? err : new Error(String(err || msg)));
    } catch (e) {}
  };
  const intentar = (fn) => {
    try {
      fn();
    } catch (e) {
      registrar('ajuste no aplicado', e);
    }
  };
  const escapar = (t) =>
    String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Lo que el programa consulta de la app (UI.descargar, imprimirHTML, la plantilla de «Guardar copia» y el panel de respaldos). */
  const PreciosApp = (window.arkenApp = { plataforma, movil: MOVIL });

  /* ─────────────────────────  LECTOR DE PDF SIN INTERNET  ─────────────────────────
     El programa apunta el trabajador de pdf.js a cdnjs. En la app se usa la copia
     local, aunque el programa vuelva a asignar la dirección. */
  intentar(() => {
    if (!window.pdfjsLib || !pdfjsLib.GlobalWorkerOptions) return;
    const local = new URL('vendor/pdf.worker.min.js', document.baseURI).href;
    Object.defineProperty(pdfjsLib.GlobalWorkerOptions, 'workerSrc', {
      get: () => local,
      set: () => {},
      configurable: true,
    });
  });

  /* ─────────────────────────  «GUARDAR COPIA»  ─────────────────────────
     La copia en HTML que se guarda desde la app es el archivo del repositorio:
     las librerías vuelven a cdnjs y la capa de la app no va, ni su política de
     seguridad (que no dejaría cargar las librerías de cdnjs). */
  PreciosApp.plantillaPortable = (html) =>
    String(html)
      .replace(/<script src="vendor\/[^"]*" data-cdn="([^"]+)"><\/script>/g, '<script src="$1"></script>')
      .replace(/\n?<script\b[^>]*\bdata-precios-app\b[^>]*><\/script>/g, '')
      .replace(/\n?<link\b[^>]*\bdata-precios-app\b[^>]*>/g, '')
      .replace(/\n?<meta\b[^>]*\bdata-precios-app\b[^>]*>/g, '');

  /* ─────────────────────────  ARCHIVOS DEL CELULAR  ───────────────────────── */
  const DIR_INTERNO = 'LIBRARY'; // iOS: Library (no visible, entra en la copia de iCloud) · Android: archivos de la app
  const DIR_SALIDA = 'CACHE';

  function base64De(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).slice(String(r.result).indexOf(',') + 1));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
  }

  /** Escribe un archivo binario por partes: el puente con el sistema no se
      atraganta con archivos de varios megas. */
  async function escribirBinario(ruta, blob, directorio) {
    const TROZO = 3 * 256 * 1024; // múltiplo de 3: cada parte en base64 es independiente
    let pos = 0;
    do {
      const data = await base64De(blob.slice(pos, pos + TROZO));
      if (pos === 0) await Filesystem.writeFile({ path: ruta, directory: directorio, data, recursive: true });
      else await Filesystem.appendFile({ path: ruta, directory: directorio, data });
      pos += TROZO;
    } while (pos < blob.size);
    return (await Filesystem.getUri({ path: ruta, directory: directorio })).uri;
  }

  /** Lee un archivo binario grande por partes y lo devuelve como Blob. */
  function leerBinarioGrande(ruta, directorio) {
    return new Promise((res, rej) => {
      const partes = [];
      let cadena = Promise.resolve();
      Promise.resolve(
        Filesystem.readFileInChunks({ path: ruta, directory: directorio, chunkSize: 3 * 256 * 1024 }, (parte, err) => {
          if (err) return rej(err);
          const b64 = parte && parte.data ? String(parte.data) : '';
          cadena = cadena
            .then(async () => {
              if (!b64) return res(new Blob(partes));
              partes.push(await (await fetch('data:application/octet-stream;base64,' + b64)).blob());
            })
            .catch(rej);
        }),
      ).catch(rej);
    });
  }

  const nombreSeguro = (n) =>
    String(n || 'archivo')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
      .trim()
      .slice(0, 150) || 'archivo';

  async function comprimir(texto) {
    if (typeof CompressionStream === 'undefined') return new Blob([texto], { type: 'application/json' });
    return await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  async function textoDe(blob) {
    const cabeza = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (cabeza[0] === 0x1f && cabeza[1] === 0x8b) return await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return await blob.text();
  }

  /* ─────────────────────────  COPIA INTERNA DE LOS DATOS  ─────────────────────────
     La capa observa las escrituras del programa en su base (arken_precios), sin
     cambiarlas, y cuando hubo cambios arma un respaldo completo y lo guarda en el
     equipo: en el computador, en la carpeta de la app (electron/copias.cjs); en el
     celular, en los archivos internos de la app. */
  const BASE = 'arken_precios';

  const Copia = MOVIL
    ? {
        async meta() {
          try {
            const r = await Filesystem.readFile({ path: 'precios/copia-meta.json', directory: DIR_INTERNO, encoding: 'utf8' });
            return JSON.parse(r.data);
          } catch (e) {
            return null;
          }
        },
        async leer() {
          for (const ruta of ['precios/copia.bin', 'precios/copia.tmp']) {
            try {
              return await textoDe(await leerBinarioGrande(ruta, DIR_INTERNO));
            } catch (e) {
              // La escritura se pudo cortar justo al reemplazar: queda la otra
            }
          }
          return null;
        },
        async escribir(texto, actualizado) {
          await escribirBinario('precios/copia.tmp', await comprimir(texto), DIR_INTERNO);
          await Filesystem.deleteFile({ path: 'precios/copia.bin', directory: DIR_INTERNO }).catch(() => {});
          await Filesystem.rename({ from: 'precios/copia.tmp', to: 'precios/copia.bin', directory: DIR_INTERNO, toDirectory: DIR_INTERNO });
          await Filesystem.writeFile({
            path: 'precios/copia-meta.json',
            directory: DIR_INTERNO,
            encoding: 'utf8',
            data: JSON.stringify({ actualizado, caracteres: texto.length }),
          });
        },
      }
    : {
        meta: () => Escritorio.copia.meta(),
        leer: () => Escritorio.copia.leer(),
        escribir: (texto, actualizado) => Escritorio.copia.guardar(texto, actualizado),
      };

  const Espejo = (() => {
    const RETARDO = MOVIL ? 45000 : 20000;
    let activo = false;
    let pendiente = false;
    let temporizador = null;
    let enCurso = Promise.resolve();
    let ultima = null;
    let avisado = false;
    const programar = () => {
      if (activo && pendiente && !temporizador) temporizador = setTimeout(volcar, RETARDO);
    };
    function cambio() {
      pendiente = true;
      programar();
    }
    /** Empieza a copiar: solo después de que el programa abrió su base en IndexedDB. */
    function activar() {
      activo = true;
      programar();
    }
    async function escribir() {
      const momento = Date.now();
      const texto = JSON.stringify(await Respaldos.armar());
      // Igual que un respaldo descargado: nada con forma de clave de API sale de la base
      if (typeof contieneClave === 'function' && contieneClave(texto)) {
        if (!avisado) {
          avisado = true;
          aviso('La copia interna no se guardó: los datos tienen algo con forma de clave de API (sk-ant-…). Bórrelo de donde lo haya pegado.', 'bad');
        }
        return;
      }
      await Copia.escribir(texto, momento);
      ultima = { fecha: momento, caracteres: texto.length };
    }
    /** Copia ya lo pendiente (al cerrar, al pasar a segundo plano o al vencer la espera). */
    function volcar() {
      clearTimeout(temporizador);
      temporizador = null;
      if (activo && pendiente) {
        pendiente = false;
        enCurso = enCurso.then(escribir).catch((e) => {
          pendiente = true;
          registrar('no se pudo actualizar la copia interna', e);
        });
      }
      return enCurso;
    }
    return { cambio, activar, volcar, ultima: () => ultima };
  })();
  PreciosApp.guardarTodo = () => Espejo.volcar();

  intentar(() => {
    for (const metodo of ['put', 'add', 'delete', 'clear']) {
      const original = IDBObjectStore.prototype[metodo];
      IDBObjectStore.prototype[metodo] = function () {
        const r = original.apply(this, arguments);
        try {
          if (this.name !== 'secretos' && this.transaction.db.name === BASE) Espejo.cambio();
        } catch (e) {}
        return r;
      };
    }
  });

  /** Si la base del programa quedó vacía y hay copia interna, los datos vuelven de la copia. */
  let recuperada = null;
  async function recuperarSiHaceFalta() {
    if (BD.backend !== 'indexeddb') return;
    if (await BD.contar('insumos')) return; // la base tiene datos: no se toca
    const meta = await Copia.meta();
    if (!meta) return;
    const texto = await Copia.leer();
    if (!texto) return;
    const obj = JSON.parse(texto);
    const v = Formatos.verificar(obj, Formatos.RESPALDO);
    if (!v.ok) throw new Error('La copia interna no pasó la verificación: ' + v.motivo);
    const almacenes = (obj.contenido && obj.contenido.almacenes) || {};
    let registros = 0;
    for (const a of BD.RESPALDABLES) {
      const filas = Array.isArray(almacenes[a]) ? almacenes[a] : [];
      for (let i = 0; i < filas.length; i += 2000) await BD.ponerVarios(a, filas.slice(i, i + 2000));
      registros += filas.length;
    }
    recuperada = { generado: obj.generado, registros };
  }

  /* ─────────────────────────  ENTREGA DE ARCHIVOS (CELULAR)  ───────────────────────── */
  const blobsPorURL = new Map();
  if (MOVIL) {
    intentar(() => {
      const crear = URL.createObjectURL;
      URL.createObjectURL = function (obj) {
        const u = crear.apply(URL, arguments);
        if (obj instanceof Blob) {
          blobsPorURL.set(u, obj);
          if (blobsPorURL.size > 40) blobsPorURL.delete(blobsPorURL.keys().next().value);
        }
        return u;
      };
      const revocar = URL.revokeObjectURL;
      URL.revokeObjectURL = function (u) {
        setTimeout(() => blobsPorURL.delete(u), 120000);
        return revocar.apply(URL, arguments);
      };
    });
  }

  async function blobDe(url) {
    if (blobsPorURL.has(url)) return blobsPorURL.get(url);
    return await (await fetch(url)).blob();
  }

  const esPDF = (nombre, tipo) => /pdf/i.test(tipo || '') || /\.pdf$/i.test(nombre || '');
  const esImagen = (nombre, tipo) => /^image\//i.test(tipo || '') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nombre || '');

  async function guardarTemporal(nombre, blob) {
    return escribirBinario('exportados/' + nombreSeguro(nombre), blob, DIR_SALIDA);
  }

  async function compartirArchivo(nombre, blob, titulo) {
    const uri = await guardarTemporal(nombre, blob);
    try {
      await Compartir.share({ title: titulo || nombre, files: [uri], dialogTitle: 'Compartir o guardar ' + nombre });
    } catch (e) {
      if (!/cancel/i.test(String((e && e.message) || e))) throw e;
    }
  }

  /** Destino de todo archivo que el programa «descarga» en el celular. */
  async function entregarArchivo(nombre, blob) {
    nombre = nombreSeguro(nombre);
    try {
      if (esPDF(nombre, blob.type) || (esImagen(nombre, blob.type) && !/svg/i.test(blob.type + nombre))) {
        Visor.abrir({ titulo: nombre, nombre, blob });
      } else {
        aviso('Elija dónde guardar «' + nombre + '» o a quién enviarlo', 'ok');
        await compartirArchivo(nombre, blob);
      }
    } catch (e) {
      registrar('no se pudo entregar el archivo', e);
      aviso('No fue posible abrir «' + nombre + '»: ' + ((e && e.message) || e), 'bad');
    }
  }

  async function entregarURL(url, nombre) {
    try {
      await entregarArchivo(nombre, await blobDe(url));
    } catch (e) {
      aviso('No fue posible leer el archivo', 'bad');
    }
  }

  const esDescarga = (a) => !!(a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/i.test(a.href || ''));
  const esExterna = (url) => /^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(url) && !String(url).startsWith(location.origin);

  function abrirExterno(url) {
    Promise.resolve(Lanzador.openUrl({ url }))
      .then((r) => {
        if (r && r.completed === false) aviso('No hay una app para abrir este enlace', 'bad');
      })
      .catch(() => aviso('No hay una app para abrir este enlace', 'bad'));
  }

  function ventanaCerrada() {
    return { closed: true, close() {}, focus() {}, document: { write() {}, writeln() {}, open() {}, close() {}, body: {} }, location: { href: '' } };
  }

  if (MOVIL) {
    // UI.descargar del programa entrega aquí cada archivo; «Guardar como…» del navegador no se usa en el teléfono
    PreciosApp.descargar = (nombre, blob) => {
      entregarArchivo(nombre, blob);
    };
    intentar(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true }));

    intentar(() => {
      // Descargas por código fuera de UI.descargar: a.click() y el dispatchEvent de jsPDF
      const clicOriginal = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (esDescarga(this)) return void entregarURL(this.href, this.getAttribute('download') || 'archivo');
        if (esExterna(this.href)) return void abrirExterno(this.href);
        return clicOriginal.apply(this, arguments);
      };
      const despachar = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function (ev) {
        if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && esDescarga(this)) {
          entregarURL(this.href, this.getAttribute('download') || 'archivo');
          return false;
        }
        return despachar.apply(this, arguments);
      };
      // Toques del usuario sobre enlaces: tiendas, correo, WhatsApp y archivos
      document.addEventListener(
        'click',
        (ev) => {
          const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
          if (!a) return;
          if (esDescarga(a)) {
            ev.preventDefault();
            ev.stopPropagation();
            entregarURL(a.href, a.getAttribute('download') || 'archivo');
          } else if (esExterna(a.href)) {
            ev.preventDefault();
            abrirExterno(a.href);
          } else if (/^(blob:|data:)/i.test(a.href)) {
            ev.preventDefault();
            entregarURL(a.href, a.textContent.trim() || 'archivo');
          }
        },
        true,
      );

      // Ventanas nuevas: el PDF que el programa abre para imprimir va al visor
      window.open = function (url) {
        const u = url === undefined || url === null ? '' : String(url);
        if (/^(blob:|data:)/i.test(u)) {
          entregarURL(u, 'documento.pdf');
          return ventanaCerrada();
        }
        if (esExterna(u)) {
          abrirExterno(u);
          return ventanaCerrada();
        }
        aviso('Esta acción no está disponible en la app', 'warn');
        return null;
      };

      // Imprimir: el PDF del documento, listo para compartir o imprimir
      PreciosApp.imprimir = async (cfg) => {
        try {
          if (!cfg || typeof Documentos === 'undefined' || !Documentos.generarPDF) throw new Error('sin documento');
          const doc = await Documentos.generarPDF(cfg);
          const nombre = nombreSeguro((cfg.nombre || 'ARKEN_PRECIOS_documento') + '.pdf');
          Visor.abrir({ titulo: cfg.titulo || nombre, nombre, blob: doc.output('blob') });
        } catch (e) {
          registrar('no se pudo preparar la impresión', e);
          aviso('No fue posible preparar el documento. Use «Guardar PDF».', 'bad');
        }
      };
      window.print = function () {
        aviso('Para imprimir, use «Guardar PDF» y luego Compartir › Imprimir', 'warn');
      };

      // Compartir: el menú del teléfono, con los archivos adjuntos
      Object.defineProperty(navigator, 'share', {
        value: async (datos) => {
          const d = datos || {};
          const archivos = [];
          for (const f of d.files || []) archivos.push(await guardarTemporal(f.name || 'archivo', f));
          try {
            await Compartir.share({ title: d.title || undefined, text: d.text || undefined, url: d.url || undefined, files: archivos.length ? archivos : undefined, dialogTitle: 'Compartir' });
          } catch (e) {
            if (/cancel/i.test(String((e && e.message) || e))) throw new DOMException('Cancelado', 'AbortError');
            throw e;
          }
        },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, 'canShare', {
        value: (d) => !!(d && ((d.files && d.files.length) || d.text || d.url || d.title)),
        configurable: true,
        writable: true,
      });
    });
  }

  /* ─────────────────────────  VISOR (CELULAR)  ───────────────────────── */
  const Visor = (() => {
    let actual = null;

    function crear(titulo, acciones) {
      cerrar();
      const el = document.createElement('div');
      el.className = 'precios-visor';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML =
        '<div class="precios-visor-barra">' +
        '<button type="button" class="precios-visor-boton" data-accion="cerrar">Cerrar</button>' +
        '<div class="precios-visor-titulo"></div>' +
        '<div class="precios-visor-acciones"></div>' +
        '</div>' +
        '<div class="precios-visor-cuerpo"></div>';
      el.querySelector('.precios-visor-titulo').textContent = titulo;
      const zona = el.querySelector('.precios-visor-acciones');
      for (const a of acciones) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'precios-visor-boton primario';
        b.textContent = a.texto;
        b.onclick = a.accion;
        zona.appendChild(b);
      }
      el.querySelector('[data-accion="cerrar"]').onclick = cerrar;
      document.body.appendChild(el);
      actual = { el, limpiar: [] };
      return el.querySelector('.precios-visor-cuerpo');
    }

    function cerrar() {
      if (!actual) return;
      for (const f of actual.limpiar) intentar(f);
      actual.el.remove();
      actual = null;
    }

    function abrir({ titulo, nombre, blob }) {
      const cuerpo = crear(titulo, [
        { texto: 'Compartir', accion: () => compartirArchivo(nombre, blob, titulo).catch(() => aviso('No fue posible compartir', 'bad')) },
      ]);
      if (esPDF(nombre, blob.type)) {
        pintarPDF(cuerpo, blob).catch((e) => {
          registrar('visor PDF', e);
          cuerpo.innerHTML = '<p class="precios-visor-nota">No fue posible mostrar el PDF aquí. Use «Compartir» para abrirlo con otra app.</p>';
        });
      } else {
        const img = document.createElement('img');
        img.className = 'precios-visor-imagen';
        const url = URL.createObjectURL(blob);
        img.src = url;
        img.alt = titulo;
        cuerpo.appendChild(img);
        actual.limpiar.push(() => URL.revokeObjectURL(url));
      }
    }

    return { abrir, cerrar, abierto: () => !!actual };
  })();
  PreciosApp.visor = Visor;

  async function pintarPDF(cuerpo, blob) {
    const datos = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: datos, isEvalSupported: false }).promise;
    const ancho = Math.max(260, cuerpo.clientWidth - 20);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const dibujar = async (caja) => {
      if (caja._lienzo) return;
      const vp = caja._pagina.getViewport({ scale: caja._escala * dpr });
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.floor(vp.width);
      lienzo.height = Math.floor(vp.height);
      caja._lienzo = lienzo;
      caja.appendChild(lienzo);
      try {
        await caja._pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vp }).promise;
      } catch (e) {}
    };
    const soltar = (caja) => {
      if (!caja._lienzo) return;
      caja._lienzo.width = 0;
      caja._lienzo.remove();
      caja._lienzo = null;
    };
    // Solo se dibujan las páginas cercanas a la vista: un documento largo no agota la memoria del teléfono
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) e.isIntersecting ? dibujar(e.target) : soltar(e.target);
      },
      { root: cuerpo, rootMargin: '900px 0px' },
    );
    for (let n = 1; n <= pdf.numPages; n++) {
      if (!cuerpo.isConnected) break;
      const pagina = await pdf.getPage(n);
      const vp1 = pagina.getViewport({ scale: 1 });
      const escala = ancho / vp1.width;
      const caja = document.createElement('div');
      caja.className = 'precios-visor-pagina';
      caja.style.width = ancho + 'px';
      caja.style.height = Math.round(vp1.height * escala) + 'px';
      caja._pagina = pagina;
      caja._escala = escala;
      cuerpo.appendChild(caja);
      observador.observe(caja);
    }
    const visor = cuerpo.closest('.precios-visor');
    const terminar = () => {
      observador.disconnect();
      pdf.destroy();
    };
    if (!visor || !visor.isConnected) terminar();
    else
      new MutationObserver((_, mo) => {
        if (!visor.isConnected) {
          mo.disconnect();
          terminar();
        }
      }).observe(document.body, { childList: true });
  }

  /* ─────────────────────────  PANEL DE RESPALDOS  ─────────────────────────
     Administración › Respaldos dice dónde está la copia interna de la app. */
  PreciosApp.panelRespaldos = async (z) => {
    const alerta = z.querySelector('.alert.warn');
    if (alerta) {
      const cuerpo = alerta.querySelector('.bd');
      if (cuerpo) cuerpo.textContent = 'Todavía no se ha descargado ningún respaldo. La app guarda además una copia interna en este equipo, pero para llevar los datos a otro equipo hace falta un respaldo.';
    }
    const caja = document.createElement('div');
    caja.className = 'card';
    caja.style.marginBottom = '10px';
    caja.innerHTML =
      '<div class="card-body"><div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:220px"><b>Copia interna de la app</b><div class="small muted" data-copia-interna>…</div></div>' +
      (MOVIL ? '' : '<div class="btn-row"><button class="btn sm" type="button" data-copias-diarias>Abrir la carpeta de copias diarias</button></div>') +
      '</div></div>';
    z.appendChild(caja);
    const b = caja.querySelector('[data-copias-diarias]');
    if (b) b.onclick = () => Escritorio.copia.abrirCarpeta().catch((e) => aviso('No fue posible abrir la carpeta: ' + e.message, 'bad'));
    let meta = null;
    try {
      meta = await Copia.meta();
    } catch (e) {}
    const fecha = meta && meta.actualizado ? (typeof fmtSello === 'function' ? fmtSello(new Date(meta.actualizado).toISOString()) : new Date(meta.actualizado).toLocaleString()) : '';
    caja.querySelector('[data-copia-interna]').innerHTML =
      'Cada cambio se copia en un archivo de este equipo, sin claves de API. Si el almacenamiento interno se perdiera, la app recupera los datos al abrir.' +
      (MOVIL ? '' : ' Además queda la copia de cada uno de los últimos 10 días, que se restaura con «Restaurar…».') +
      (fecha ? ' Última copia: <b>' + escapar(fecha) + '</b>.' : ' Todavía no hay copia: se hace con el próximo cambio.');
  };

  /* ─────────────────────────  AJUSTES SOBRE EL PROGRAMA  ─────────────────────────
     Se aplican cuando el programa ya cargó y antes de que arranque (este oyente
     se registró antes que el del programa). */
  function instalarAjustes() {
    // Arranque: si la base quedó vacía, se recupera la copia interna antes de sembrar
    intentar(() => {
      const abrir = BD.abrir;
      BD.abrir = async function () {
        const backend = await abrir.apply(this, arguments);
        try {
          await recuperarSiHaceFalta();
        } catch (e) {
          registrar('no se pudo recuperar la copia interna', e);
        }
        return backend;
      };
    });
    intentar(() => {
      const iniciar = Arranque.iniciar;
      Arranque.iniciar = async function () {
        const r = await iniciar.apply(this, arguments);
        if (BD.backend === 'indexeddb') Espejo.activar();
        if (recuperada) {
          const cuando = typeof fmtSello === 'function' ? fmtSello(recuperada.generado) : recuperada.generado;
          aviso('Se recuperaron los datos de la copia interna de este equipo (' + cuando + ').', 'ok');
          try {
            await Auditoria.registrar('recuperar copia interna', 'Copia del ' + cuando + ' · ' + recuperada.registros + ' registros');
          } catch (e) {}
        }
        return r;
      };
    });

    // Celular: el selector de archivos no filtra por extensión, así no se esconden los respaldos
    if (MOVIL) {
      intentar(() => {
        const pedir = UI.pedirArchivo;
        UI.pedirArchivo = function (accept, cb, modo) {
          if (/\.json|\.gz/i.test(accept || '')) accept = '';
          return pedir.call(this, accept, cb, modo);
        };
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof BD === 'undefined' || typeof Arranque === 'undefined' || typeof Respaldos === 'undefined') return;
    instalarAjustes();
  });

  /* ─────────────────────────  CICLO DE VIDA  ───────────────────────── */
  const enSegundoPlano = (fn) => {
    try {
      Promise.resolve(fn()).catch((e) => registrar('tarea nativa', e));
    } catch (e) {
      registrar('tarea nativa', e);
    }
  };

  if (MOVIL) {
    // Al pasar a segundo plano se copia todo: el sistema puede cerrar la app sin avisar
    enSegundoPlano(() => AppNativa.addListener('pause', () => Espejo.volcar()));
    enSegundoPlano(() =>
      AppNativa.addListener('appStateChange', (s) => {
        if (s && s.isActive === false) Espejo.volcar();
      }),
    );

    // Botón «atrás» de Android: cierra el visor o la ventana abierta; en la pantalla principal minimiza
    if (plataforma === 'android') {
      enSegundoPlano(() =>
        AppNativa.addListener('backButton', () => {
          if (Visor.abierto()) return Visor.cerrar();
          const ventanas = document.querySelectorAll('#modales .overlay');
          const ultima = ventanas[ventanas.length - 1];
          if (ultima) {
            // Una ventana sin «✕» (un avance, el cambio obligatorio de contraseña) no se cierra con «atrás»
            const cerrar = ultima.querySelector('[data-cerrar]');
            if (cerrar) cerrar.click();
            return;
          }
          enSegundoPlano(() => AppNativa.minimizeApp());
        }),
      );
    }

    // Íconos claros en la barra de estado: la barra superior del programa es oscura
    enSegundoPlano(() => BarrasSistema.setStyle({ style: 'DARK' }));

    // Los archivos entregados en sesiones anteriores ya no se necesitan
    enSegundoPlano(() => Filesystem.rmdir({ path: 'exportados', directory: DIR_SALIDA, recursive: true }).catch(() => {}));
  } else {
    // Computador: al cerrar la ventana se copia todo antes de salir
    intentar(() =>
      Escritorio.alCerrar(async () => {
        try {
          await Espejo.volcar();
        } finally {
          Escritorio.listoParaCerrar();
        }
      }),
    );
  }
})();
