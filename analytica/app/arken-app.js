/* ═══════════════════════════════════════════════════════════════════════════
   ARKEN ANALYTICA · capa de la app (Windows, macOS, Linux, Android e iOS)

   El programa es el mismo archivo HTML de siempre. Esta capa se carga antes que
   él y ajusta solo lo que un navegador hace distinto dentro de una app (§6):

   · En el computador (Electron, electron/preload.cjs expone window.arkenAnalytica):
     una copia de los datos por día. Al entrar, si hoy no hay copia, se arma el
     respaldo completo del programa (el mismo ZIP de Administración › Respaldos,
     sin la bóveda de secretos) y se guarda en la carpeta de la app; quedan los
     últimos 10 días. La clave de API del asistente la cifra el sistema operativo.
   · En el celular y la tableta (Capacitor): el principal solo CONSULTA el
     tablero, el comparativo y el informe (window.ArkenApp.soloConsulta). Los
     datos llegan restaurando un respaldo hecho en el computador. Los archivos
     que el programa descarga (PDF, Excel, imágenes) se abren en el menú
     Compartir del teléfono.
   En un navegador normal esta capa no hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const Cap = window.Capacitor;
  const Escritorio = window.arkenAnalytica && window.arkenAnalytica.copias ? window.arkenAnalytica : null;
  const nativo = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const plataforma = nativo ? Cap.getPlatform() : Escritorio ? Escritorio.plataforma : 'web';
  if (plataforma === 'web') return;
  const MOVIL = plataforma === 'android' || plataforma === 'ios';

  const registrar = (msg, err) => {
    console.warn('ARKEN ANALYTICA · ' + msg, err || '');
    try {
      if (typeof RegistroTecnico !== 'undefined') RegistroTecnico.anotar('App: ' + msg, err instanceof Error ? err : new Error(String(err || msg)));
    } catch (e) {}
  };
  const aviso = (msg, tipo) => {
    try {
      if (typeof UI !== 'undefined') return UI.toast(msg, tipo);
    } catch (e) {}
  };

  document.documentElement.setAttribute('data-app', plataforma);

  /* ─────────────────────────  CELULAR: CONSULTA Y COMPARTIR  ───────────────────────── */
  if (MOVIL) {
    const plugin = (nombre) => (Cap.Plugins && Cap.Plugins[nombre]) || Cap.registerPlugin(nombre);
    const Filesystem = plugin('Filesystem');
    const Compartir = plugin('Share');
    const TROZO = 3 * 1024 * 1024;
    const base64De = (blob) =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = () => rej(r.error);
        r.readAsDataURL(blob);
      });
    const nombreSeguro = (n) => String(n || 'archivo').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 150);
    /** Escribe el archivo por trozos (un PDF grande no cabe en un solo puente) y devuelve su dirección. */
    async function escribir(nombre, blob) {
      const ruta = 'exportados/' + nombreSeguro(nombre);
      let pos = 0;
      do {
        const data = await base64De(blob.slice(pos, pos + TROZO));
        if (pos === 0) await Filesystem.writeFile({ path: ruta, directory: 'CACHE', data, recursive: true });
        else await Filesystem.appendFile({ path: ruta, directory: 'CACHE', data });
        pos += TROZO;
      } while (pos < blob.size);
      return (await Filesystem.getUri({ path: ruta, directory: 'CACHE' })).uri;
    }
    window.ArkenApp = {
      plataforma,
      soloConsulta: true,
      async descargar(nombre, blob) {
        try {
          const url = await escribir(nombre, blob);
          await Compartir.share({ title: nombre, files: [url], dialogTitle: 'Abrir o compartir ' + nombre });
        } catch (e) {
          if (/cancel/i.test(String((e && e.message) || e))) return;
          registrar('compartir ' + nombre, e);
          aviso('No fue posible abrir el archivo en el teléfono.', 'bad');
        }
      },
    };
    return;
  }

  /* ─────────────────────────  COMPUTADOR: COPIA DE CADA DÍA  ───────────────────────── */
  window.ArkenApp = { plataforma, soloConsulta: false };
  let haciendo = false;
  async function copiaDelDia() {
    if (haciendo || typeof Sesion === 'undefined' || !Sesion.usuario || typeof Respaldo === 'undefined' || !S.cargado) return;
    haciendo = true;
    try {
      if (await Escritorio.copias.hayDeHoy()) return;
      const r = await Respaldo.generar({ copiaDiaria: true });
      const bytes = new Uint8Array(await r.blob.arrayBuffer());
      // La bóveda no entra en los respaldos; aun así, una copia con algo con forma de clave no se guarda.
      const muestra = new TextDecoder('latin1').decode(bytes);
      if (/sk-ant-[A-Za-z0-9_-]{20,}/.test(muestra)) throw new Error('La copia tenía algo con forma de clave de API: no se guardó.');
      await Escritorio.copias.guardar(bytes);
    } catch (e) {
      registrar('copia del día', e);
    } finally {
      haciendo = false;
    }
  }
  // Después de entrar, y cada hora mientras el programa siga abierto (por si pasa la medianoche).
  setInterval(copiaDelDia, 60 * 60 * 1000);
  const espera = setInterval(() => {
    if (typeof Sesion !== 'undefined' && Sesion.usuario) {
      clearInterval(espera);
      setTimeout(copiaDelDia, 20000);
    }
  }, 3000);
})();
