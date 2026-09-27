/* ═══════════════════════════════════════════════════════════════════════════
   ARKEN CONTROL · capa de la app (Android, iOS, Windows y macOS)

   El programa es el mismo archivo HTML de siempre. Esta capa se carga antes que
   él y ajusta solo lo que un navegador hace distinto dentro de una app:

   · Guardado: el programa guarda en IndexedDB como siempre. La capa mantiene
     además una copia interna en un archivo del equipo y la usa si el sistema
     llegara a borrar el almacenamiento del navegador interno. En el
     computador guarda también una copia por día (las últimas 10).
   · Archivos que el programa descarga (PDF, Excel, respaldos): en el celular
     se abren en un visor o en el menú Compartir del teléfono.
   · Ventanas nuevas (vistas previas, impresión): en el celular se muestran
     dentro de la app.
   · Imprimir: en el celular sale el PDF del documento, listo para compartir o
     imprimir.
   · Correo y WhatsApp: se abren en la app del teléfono o del computador.
   · Respaldos: además del .json, se puede restaurar el ARKEN_CONTROL.html con
     datos embebidos.

   En un navegador normal esta capa no hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────────────────  PLATAFORMA  ───────────────────────── */
  const Cap = window.Capacitor;
  const Escritorio = window.arkenEscritorio || null; // lo expone electron/preload.cjs
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
    console.log('ARKEN · ' + msg);
  };
  const registrar = (msg, err) => console.warn('ARKEN · ' + msg, err || '');
  const intentar = (fn) => {
    try {
      fn();
    } catch (e) {
      registrar('ajuste no aplicado', e);
    }
  };
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

  const ArkenApp = (window.ArkenApp = { plataforma, movil: MOVIL });

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

  /** Escribe texto por partes, sin partir un carácter en dos. */
  async function escribirTexto(ruta, texto, directorio) {
    const TROZO = 512 * 1024;
    let i = 0;
    do {
      let fin = Math.min(i + TROZO, texto.length);
      if (fin < texto.length) {
        const c = texto.charCodeAt(fin - 1);
        if (c >= 0xd800 && c <= 0xdbff) fin--;
      }
      const data = texto.slice(i, fin);
      if (i === 0) await Filesystem.writeFile({ path: ruta, directory: directorio, data, encoding: 'utf8', recursive: true });
      else await Filesystem.appendFile({ path: ruta, directory: directorio, data, encoding: 'utf8' });
      i = fin;
    } while (i < texto.length);
  }

  /** Lee un archivo de texto grande por partes. */
  function leerTextoGrande(ruta, directorio) {
    return new Promise((res, rej) => {
      const decodificador = new TextDecoder('utf-8');
      let texto = '';
      let cadena = Promise.resolve();
      Promise.resolve(
        Filesystem.readFileInChunks({ path: ruta, directory: directorio, chunkSize: 3 * 256 * 1024 }, (parte, err) => {
          if (err) return rej(err);
          const b64 = parte && parte.data ? String(parte.data) : '';
          cadena = cadena.then(async () => {
            if (!b64) {
              res(texto + decodificador.decode());
              return;
            }
            const bytes = new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer());
            texto += decodificador.decode(bytes, { stream: true });
          }).catch(rej);
        }),
      ).catch(rej);
    });
  }

  const nombreSeguro = (n) =>
    String(n || 'archivo')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
      .trim()
      .slice(0, 150) || 'archivo';

  /* ─────────────────────────  COPIA INTERNA DE LOS DATOS  ─────────────────────────
     El programa guarda el estado completo en IndexedDB (base arken_control,
     almacén «estado»). La capa observa ese guardado —sin cambiarlo— y lo copia
     a un archivo del equipo cada cierto tiempo y al salir de la app. */
  const CLAVE_ESTADO = 'arken_control_empresa_v1';
  const MARCA_IDB = 'arken_app_idb_actualizado';

  const Copia = MOVIL
    ? {
        async meta() {
          try {
            const r = await Filesystem.readFile({ path: 'arken/copia-meta.json', directory: DIR_INTERNO, encoding: 'utf8' });
            return JSON.parse(r.data);
          } catch (e) {
            return null;
          }
        },
        async leer() {
          try {
            return await leerTextoGrande('arken/copia.json', DIR_INTERNO);
          } catch (e) {
            return await leerTextoGrande('arken/copia.tmp', DIR_INTERNO); // la escritura se cortó justo al reemplazar
          }
        },
        async escribir(texto, actualizado) {
          await escribirTexto('arken/copia.tmp', texto, DIR_INTERNO);
          await Filesystem.deleteFile({ path: 'arken/copia.json', directory: DIR_INTERNO }).catch(() => {});
          await Filesystem.rename({ from: 'arken/copia.tmp', to: 'arken/copia.json', directory: DIR_INTERNO, toDirectory: DIR_INTERNO });
          await Filesystem.writeFile({
            path: 'arken/copia-meta.json',
            directory: DIR_INTERNO,
            encoding: 'utf8',
            data: JSON.stringify({ actualizado, caracteres: texto.length }),
          });
        },
        async borrar() {
          await Filesystem.deleteFile({ path: 'arken/copia-meta.json', directory: DIR_INTERNO }).catch(() => {});
          await Filesystem.deleteFile({ path: 'arken/copia.json', directory: DIR_INTERNO }).catch(() => {});
        },
      }
    : {
        meta: () => Escritorio.leerMetaCopia(),
        leer: () => Escritorio.leerCopia(),
        escribir: (texto, actualizado) => Escritorio.guardarCopia(texto, actualizado),
        borrar: () => Escritorio.borrarCopia(),
      };

  const Espejo = (() => {
    const RETARDO = MOVIL ? 30000 : 8000;
    let pendiente = null;
    let temporizador = null;
    let enCurso = Promise.resolve();
    function programar(texto, actualizado) {
      pendiente = { texto, actualizado };
      if (!temporizador) temporizador = setTimeout(volcar, RETARDO);
    }
    function volcar() {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
      if (pendiente) {
        const { texto, actualizado } = pendiente;
        pendiente = null;
        enCurso = enCurso
          .then(() => (texto ? Copia.escribir(texto, actualizado) : Copia.borrar()))
          .catch((e) => registrar('no se pudo actualizar la copia interna', e));
      }
      return enCurso;
    }
    return { programar, volcar };
  })();

  let ultimaTransaccion = Promise.resolve();
  intentar(() => {
    const putOriginal = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (valor, clave) {
      const req = putOriginal.apply(this, arguments);
      try {
        if (clave === CLAVE_ESTADO && this.name === 'estado' && typeof valor === 'string') {
          const m = valor.slice(0, 400).match(/"actualizado":(\d+)/);
          const actualizado = m ? Number(m[1]) : Date.now();
          const tx = this.transaction;
          ultimaTransaccion = new Promise((res) => {
            tx.addEventListener('complete', () => {
              // Fecha de lo que quedó en IndexedDB: al arrancar se compara con la copia interna
              try {
                localStorage.setItem(MARCA_IDB, String(valor ? actualizado : Date.now()));
              } catch (e) {}
              res();
            });
            tx.addEventListener('error', res);
            tx.addEventListener('abort', res);
          });
          Espejo.programar(valor, actualizado);
        }
      } catch (e) {
        registrar('no se pudo seguir el guardado', e);
      }
      return req;
    };
  });

  /** Guarda todo ya: lo pendiente del programa, IndexedDB y la copia interna. */
  async function guardarTodo() {
    try {
      if (typeof Store !== 'undefined' && Store.pendiente) Store.guardar(true);
    } catch (e) {}
    await pausa(60); // el programa abre la transacción en el siguiente ciclo
    await Promise.race([ultimaTransaccion, pausa(4000)]);
    await Espejo.volcar();
  }
  ArkenApp.guardarTodo = guardarTodo;

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
  const esImagen = (nombre, tipo) => /^image\//i.test(tipo || '') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(nombre || '');

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
      if (esPDF(nombre, blob.type) || esImagen(nombre, blob.type)) {
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
  ArkenApp.entregarArchivo = entregarArchivo;

  async function entregarURL(url, nombre) {
    try {
      entregarArchivo(nombre, await blobDe(url));
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

  if (MOVIL) {
    intentar(() => {
      // Descargas por código: a.click() y el dispatchEvent de jsPDF
      const clicOriginal = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (esDescarga(this)) return void entregarURL(this.href, this.getAttribute('download') || 'archivo');
        if (this.target === '_blank' && esExterna(this.href)) return void abrirExterno(this.href);
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
      // Toques del usuario sobre enlaces
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
            abrirURLEnVisor(a.href, a.textContent.trim());
          }
        },
        true,
      );

      // jsPDF: «Guardar PDF» entrega el PDF con su nombre
      if (window.jspdf && jspdf.jsPDF && jspdf.jsPDF.API) {
        jspdf.jsPDF.API.save = function (nombre) {
          entregarArchivo(nombre || 'documento.pdf', this.output('blob'));
          return this;
        };
      }

      // Compartir: el menú del teléfono, con el PDF adjunto
      const compartir = async (datos) => {
        datos = datos || {};
        const archivos = [];
        for (const f of datos.files || []) archivos.push(await guardarTemporal(f.name || 'archivo', f));
        try {
          await Compartir.share({
            title: datos.title || undefined,
            text: datos.text || undefined,
            url: datos.url || undefined,
            files: archivos.length ? archivos : undefined,
            dialogTitle: 'Compartir',
          });
        } catch (e) {
          if (/cancel/i.test(String((e && e.message) || e))) throw new DOMException('Cancelado', 'AbortError');
          throw e;
        }
      };
      Object.defineProperty(navigator, 'share', { value: compartir, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', {
        value: (d) => !!(d && ((d.files && d.files.length) || d.text || d.url || d.title)),
        configurable: true,
        writable: true,
      });

      // Ventanas nuevas: vistas previas e impresión se muestran dentro de la app
      window.open = function (url) {
        const u = url === undefined || url === null ? '' : String(url);
        if (u === '' || u === 'about:blank') return ventanaVirtual();
        if (/^(blob:|data:)/i.test(u)) {
          abrirURLEnVisor(u);
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
      window.ARKEN_IMPRIMIR = function (cfg) {
        try {
          if (!cfg || typeof Documentos === 'undefined' || !Documentos.generarPDF) throw new Error('sin documento');
          const doc = Documentos.generarPDF(cfg);
          const nombre = nombreSeguro((cfg.nombre || 'ARKEN_documento') + '.pdf');
          Visor.abrir({ titulo: cfg.titulo || nombre, nombre, blob: doc.output('blob') });
        } catch (e) {
          registrar('no se pudo preparar la impresión', e);
          aviso('No fue posible preparar el documento. Use «Guardar PDF».', 'bad');
        }
      };
      window.print = function () {
        aviso('Para imprimir, use «Guardar PDF» y luego Compartir › Imprimir', 'warn');
      };
    });
  }

  function ventanaCerrada() {
    return {
      closed: true,
      close() {},
      focus() {},
      document: { write() {}, writeln() {}, open() {}, close() {}, body: {} },
      location: { href: '' },
    };
  }

  /** Imita la ventana que devuelve window.open('') para que el programa pueda
      escribir en ella con document.write; lo escrito se muestra en el visor. */
  function ventanaVirtual() {
    let html = '';
    let titulo = '';
    let mostrado = null;
    let programado = false;
    const mostrar = () => {
      programado = false;
      if (!html || html === mostrado) return;
      mostrado = html;
      abrirHTMLEnVisor(html, titulo);
    };
    const programar = () => {
      if (!programado) {
        programado = true;
        setTimeout(mostrar, 0);
      }
    };
    const navegar = (u) => {
      u = String(u || '');
      if (/^(blob:|data:)/i.test(u)) abrirURLEnVisor(u, titulo);
      else if (esExterna(u)) abrirExterno(u);
    };
    const documento = {
      write: (...p) => {
        html += p.join('');
        programar();
      },
      writeln: (...p) => {
        html += p.join('') + '\n';
        programar();
      },
      open: () => {
        html = '';
        return documento;
      },
      close: mostrar,
      get title() {
        return titulo;
      },
      set title(t) {
        titulo = String(t || '');
      },
      body: {
        set innerText(t) {},
        set innerHTML(h) {
          html = String(h || '');
          programar();
        },
      },
    };
    const ubicacion = {
      get href() {
        return 'about:blank';
      },
      set href(u) {
        navegar(u);
      },
      assign: navegar,
      replace: navegar,
    };
    return {
      document: documento,
      get location() {
        return ubicacion;
      },
      set location(u) {
        navegar(u);
      },
      closed: false,
      opener: window,
      focus() {},
      blur() {},
      print() {},
      close() {
        this.closed = true;
      },
      addEventListener() {},
      removeEventListener() {},
    };
  }

  async function abrirURLEnVisor(url, titulo) {
    try {
      const blob = await blobDe(url);
      const nombre = nombreSeguro(titulo || (esPDF('', blob.type) ? 'documento.pdf' : 'archivo'));
      if (/html/i.test(blob.type)) return abrirHTMLEnVisor(await blob.text(), titulo);
      Visor.abrir({ titulo: titulo || nombre, nombre, blob });
    } catch (e) {
      aviso('No fue posible abrir el archivo', 'bad');
    }
  }

  /** HTML escrito en una ventana nueva: si es solo un PDF o una imagen, se abre
      en el visor; si es un documento, se muestra tal cual. */
  function abrirHTMLEnVisor(html, titulo) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    const t = titulo || d.title || 'Documento';
    const incrustados = d.body ? d.body.querySelectorAll('iframe, embed, object, img') : [];
    if (incrustados.length === 1 && d.body.textContent.trim() === '') {
      const el = incrustados[0];
      const src = el.getAttribute('src') || el.getAttribute('data') || '';
      if (/^(blob:|data:)/i.test(src)) return abrirURLEnVisor(src, t);
    }
    Visor.abrir({ titulo: t, html });
  }

  /* ─────────────────────────  VISOR (CELULAR)  ───────────────────────── */
  const Visor = (() => {
    let actual = null;

    function crear(titulo, acciones) {
      cerrar();
      const el = document.createElement('div');
      el.className = 'arken-visor';
      el.setAttribute('data-arken-app', '');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML =
        '<div class="arken-visor-barra">' +
        '<button type="button" class="arken-visor-boton" data-accion="cerrar">Cerrar</button>' +
        '<div class="arken-visor-titulo"></div>' +
        '<div class="arken-visor-acciones"></div>' +
        '</div>' +
        '<div class="arken-visor-cuerpo"></div>';
      el.querySelector('.arken-visor-titulo').textContent = titulo;
      const zona = el.querySelector('.arken-visor-acciones');
      for (const a of acciones) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'arken-visor-boton primario';
        b.textContent = a.texto;
        b.onclick = a.accion;
        zona.appendChild(b);
      }
      el.querySelector('[data-accion="cerrar"]').onclick = cerrar;
      document.body.appendChild(el);
      actual = { el, limpiar: [] };
      return el.querySelector('.arken-visor-cuerpo');
    }

    function cerrar() {
      if (!actual) return;
      for (const f of actual.limpiar) intentar(f);
      actual.el.remove();
      actual = null;
    }

    function abrir({ titulo, nombre, blob, html }) {
      if (html !== undefined) return abrirHTML(titulo, html);
      const acciones = [
        {
          texto: 'Compartir',
          accion: () => compartirArchivo(nombre, blob, titulo).catch(() => aviso('No fue posible compartir', 'bad')),
        },
      ];
      const cuerpo = crear(titulo, acciones);
      if (esPDF(nombre, blob.type)) {
        pintarPDF(cuerpo, blob).catch((e) => {
          registrar('visor PDF', e);
          cuerpo.innerHTML = '<p class="arken-visor-nota">No fue posible mostrar el PDF aquí. Use «Compartir» para abrirlo con otra app.</p>';
        });
      } else if (esImagen(nombre, blob.type)) {
        const img = document.createElement('img');
        img.className = 'arken-visor-imagen';
        const url = URL.createObjectURL(blob);
        img.src = url;
        img.alt = titulo;
        cuerpo.appendChild(img);
        actual.limpiar.push(() => URL.revokeObjectURL(url));
      } else {
        cuerpo.innerHTML = '<p class="arken-visor-nota">Este archivo no se puede mostrar aquí. Use «Compartir» para abrirlo con otra app.</p>';
      }
    }

    function abrirHTML(titulo, html) {
      let marco = null;
      const cuerpo = crear(titulo, [
        {
          texto: 'PDF',
          accion: () => convertirMarcoAPDF(marco, titulo),
        },
      ]);
      marco = document.createElement('iframe');
      marco.className = 'arken-visor-marco';
      marco.title = titulo;
      // window.print() dentro del documento se convierte en su PDF
      const puente =
        '<script>window.print=function(){try{parent.ArkenApp.imprimirMarco(window.frameElement)}catch(e){}};</' + 'script>';
      marco.srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + puente) : puente + html;
      cuerpo.appendChild(marco);
    }

    async function convertirMarcoAPDF(marco, titulo) {
      if (!marco || !marco.contentDocument) return;
      if (!window.html2canvas || !window.jspdf) {
        aviso('No fue posible preparar el PDF', 'bad');
        return;
      }
      aviso('Preparando el PDF…', 'info');
      try {
        const blob = await htmlAPDF(marco.contentDocument);
        const nombre = nombreSeguro((titulo || 'documento').replace(/\.pdf$/i, '') + '.pdf');
        abrir({ titulo: nombre, nombre, blob });
      } catch (e) {
        registrar('PDF del documento', e);
        aviso('No fue posible preparar el PDF', 'bad');
      }
    }

    ArkenApp.imprimirMarco = (marco) => convertirMarcoAPDF(marco, marco && marco.title);

    return { abrir, cerrar, abierto: () => !!actual, convertirMarcoAPDF };
  })();
  ArkenApp.visor = Visor;

  async function pintarPDF(cuerpo, blob) {
    const datos = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: datos }).promise;
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
    // Solo se dibujan las páginas cercanas a la vista: un plano de 60 páginas no agota la memoria del teléfono
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
      caja.className = 'arken-visor-pagina';
      caja.style.width = ancho + 'px';
      caja.style.height = Math.round(vp1.height * escala) + 'px';
      caja._pagina = pagina;
      caja._escala = escala;
      cuerpo.appendChild(caja);
      observador.observe(caja);
    }
    const visor = cuerpo.closest('.arken-visor');
    const cerrar = () => {
      observador.disconnect();
      pdf.destroy();
    };
    if (!visor || !visor.isConnected) cerrar();
    else new MutationObserver((_, mo) => {
      if (!visor.isConnected) {
        mo.disconnect();
        cerrar();
      }
    }).observe(document.body, { childList: true });
  }

  /** Documento HTML → PDF tamaño carta (imagen de cada hoja). */
  async function htmlAPDF(doc) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'p' });
    const ANCHO = 215.9;
    const ALTO = 279.4;
    const hojas = [...doc.querySelectorAll('.fun-page, .p-doc')];
    const objetivos = hojas.length ? hojas : [doc.body];
    let primera = true;
    for (const el of objetivos) {
      const lienzo = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const img = lienzo.toDataURL('image/jpeg', 0.92);
      const alto = (lienzo.height * ANCHO) / lienzo.width;
      for (let y = 0; y < alto - 0.5; y += ALTO) {
        if (!primera) pdf.addPage('letter', 'p');
        primera = false;
        pdf.addImage(img, 'JPEG', 0, -y, ANCHO, alto);
      }
    }
    return pdf.output('blob');
  }

  /* ─────────────────────────  AJUSTES SOBRE EL PROGRAMA  ─────────────────────────
     Se aplican cuando el programa ya cargó y antes de que arranque. */
  function instalarAjustes() {
    // Arranque: si el almacenamiento interno se perdió, se usa la copia del equipo
    intentar(() => {
      const precargar = Store.precargar;
      Store.precargar = async function () {
        await precargar.apply(this, arguments);
        try {
          const meta = await Copia.meta();
          const enIDB = Number(localStorage.getItem(MARCA_IDB) || 0);
          if (meta && meta.actualizado > enIDB) {
            const texto = await Copia.leer();
            const tag = document.getElementById('arken-datos');
            // Store.cargar() compara por fecha lo embebido con IndexedDB y usa lo más reciente
            if (texto && tag) tag.textContent = texto;
          }
        } catch (e) {
          registrar('no se pudo leer la copia interna', e);
        }
      };
    });

    // Restaurar también desde el ARKEN_CONTROL.html con datos embebidos
    intentar(() => {
      const importar = Store.importarJSON;
      Store.importarJSON = function (txt) {
        return importar.call(this, datosDeRespaldo(txt));
      };
    });

    // La copia en HTML que se guarda desde la app se abre igual en cualquier navegador
    intentar(() => {
      const fijar = Documentos.fijarPlantilla;
      Documentos.fijarPlantilla = function (html) {
        fijar.call(this, plantillaPortable(html));
        intentar(ajustarBarra); // después de capturar la plantilla, para no alterarla
      };
    });

    // En la app los datos se guardan solos: no hay archivo que enlazar
    intentar(() => {
      Documentos.haySoporte = () => false;
    });
    intentar(() => {
      const pintar = App.pintarEstadoArchivo;
      App.pintarEstadoArchivo = function (estado) {
        pintar.apply(this, arguments);
        if (estado === 'error' || estado === 'permiso') return;
        if (typeof Store !== 'undefined' && Store._backend === 'memoria') return;
        const e = document.getElementById('tbSaved');
        if (!e) return;
        e.className = 'saved';
        e.title = 'Cada cambio se guarda solo en este equipo.';
        const s = e.querySelector('span');
        if (s) s.textContent = 'Guardado';
      };
    });
    intentar(() => {
      if (typeof window.adDatos !== 'function') return;
      const pintarDatos = window.adDatos;
      window.adDatos = function (c) {
        pintarDatos.apply(this, arguments);
        intentar(() => ajustarPanelDatos(c));
      };
    });

    // Celular: el selector de archivos no filtra por extensión, así no se esconden los respaldos
    if (MOVIL) {
      intentar(() => {
        const pedir = UI.pedirArchivo;
        UI.pedirArchivo = function (accept, cb, comoTexto) {
          if (/\.json/i.test(accept || '')) accept = '';
          return pedir.call(this, accept, cb, comoTexto);
        };
      });
    }
  }

  function datosDeRespaldo(txt) {
    const s = String(txt || '');
    if (!/^\s*</.test(s)) return s;
    const m = s.match(/<script id="arken-datos" type="application\/json">([\s\S]*?)<\/script>/);
    const d = m ? m[1].trim() : '';
    if (!d || d === 'null') {
      throw new Error('Ese archivo HTML no trae datos. Use el ARKEN_CONTROL.html guardado con «Guardar archivo» o un respaldo .json.');
    }
    return d;
  }

  function plantillaPortable(html) {
    return String(html)
      .replace(/<script src="vendor\/[^"]*" data-cdn="([^"]+)"><\/script>/g, '<script src="$1"></script>')
      .replace(/\n?<script\b[^>]*\bdata-arken-app\b[^>]*><\/script>/g, '')
      .replace(/\n?<link\b[^>]*\bdata-arken-app\b[^>]*>/g, '');
  }

  function ajustarBarra() {
    const b = document.getElementById('btnGuardar');
    if (!b) return;
    b.textContent = 'Guardar copia';
    b.title =
      'Los cambios ya se guardan solos en este equipo. Este botón guarda una copia del sistema con todos los datos ' +
      '(ARKEN_CONTROL.html), para abrirla en un navegador o restaurarla en otro equipo.';
  }

  function ajustarPanelDatos(c) {
    const valor = c.querySelector('.stat .val');
    if (valor) valor.textContent = 'En este equipo';
    const secciones = [...c.querySelectorAll('.p-sec')];
    const sec = secciones.find((s) => /Guardado automático/i.test(s.textContent));
    if (sec) {
      sec.textContent = 'Guardado automático';
      const alerta = sec.nextElementSibling;
      if (alerta && alerta.classList.contains('alert')) {
        alerta.className = 'alert ok';
        alerta.innerHTML =
          '<div class="ic">✓</div><div class="bd"><b>Cada cambio se guarda solo en este equipo.</b>' +
          '<div class="small">La app guarda además una copia interna de seguridad' +
          (MOVIL ? '' : ' y una copia por día de los últimos 10 días') +
          '. Para llevar los datos a otro equipo, exporte un respaldo y restáurelo allá.</div>' +
          (MOVIL
            ? ''
            : '<div class="btn-row" style="margin-top:10px"><button class="btn sm" id="adCopias" type="button">' +
              'Abrir la carpeta de copias diarias</button></div>') +
          '</div>';
        const b = alerta.querySelector('#adCopias');
        if (b) b.onclick = () => Escritorio.abrirCopias();
      }
    }
    const imp = c.querySelector('#adImp');
    if (imp) imp.textContent = 'Importar respaldo (.json o .html)';
    const alertas = [...c.querySelectorAll('.alert')];
    const viaje = alertas.find((a) => /Cómo viaja la información/i.test(a.textContent));
    const texto = viaje && viaje.querySelector('.small');
    if (texto) {
      texto.textContent =
        'Cada equipo guarda sus propios datos: no se sincronizan solos. Para pasar la información a otro equipo, ' +
        'exporte un respaldo (.json) o guarde el archivo HTML con los datos embebidos, y restáurelo allá con ' +
        '«Importar respaldo».';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Store === 'undefined' || typeof Documentos === 'undefined') return;
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
    // Al pasar a segundo plano se guarda todo: el sistema puede cerrar la app sin avisar
    enSegundoPlano(() => AppNativa.addListener('pause', () => guardarTodo()));
    enSegundoPlano(() =>
      AppNativa.addListener('appStateChange', (s) => {
        if (s && s.isActive === false) guardarTodo();
      }),
    );

    // Botón «atrás» de Android: cierra el visor o la ventana abierta; en la pantalla principal minimiza
    if (plataforma === 'android') {
      enSegundoPlano(() =>
        AppNativa.addListener('backButton', () => {
          if (Visor.abierto()) return Visor.cerrar();
          const ventanas = document.querySelectorAll('#modales .overlay');
          const ultima = ventanas[ventanas.length - 1];
          const cerrar = ultima && ultima.querySelector('[data-cerrar]');
          if (cerrar) return cerrar.click();
          enSegundoPlano(() => AppNativa.minimizeApp());
        }),
      );
    }

    // Íconos claros en la barra de estado: la barra superior del programa es oscura
    enSegundoPlano(() => BarrasSistema.setStyle({ style: 'DARK' }));

    // Los archivos entregados en sesiones anteriores ya no se necesitan
    enSegundoPlano(() => Filesystem.rmdir({ path: 'exportados', directory: DIR_SALIDA, recursive: true }).catch(() => {}));
  } else {
    // Computador: al cerrar la ventana se guarda todo antes de salir
    intentar(() =>
      Escritorio.alCerrar(async () => {
        try {
          await guardarTodo();
        } finally {
          Escritorio.listoParaCerrar();
        }
      }),
    );
  }
})();
