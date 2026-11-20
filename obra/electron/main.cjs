// ARKEN OBRA · un solo programa de escritorio con las apps de la familia ARKEN 360.
//
// Abre una pantalla de inicio (app://obra/) y, desde ella, cada app en su propia ventana:
//   ARKEN CONTROL    app://arken/       control de obra
//   ARKEN PRECIOS    app://precios/     observatorio de precios de insumos
//   ARKEN ANALYTICA  app://analytica/   evaluación de propuestas y ARKEN OFERTA
//   ARKEN BANK       app://bank/        análisis de créditos (cuando esté en el repositorio)
// Los programas son los mismos de cada app (obra/apps/, armado por herramientas/armar.mjs) y se
// les da el mismo puente con el computador que en su app propia, con los mismos canales.
//
// Cada app tiene su propia sesión (persist:<id>): su almacenamiento, sus permisos y su regla de
// red quedan aparte, como si fuera su app de siempre. Sus datos quedan en la carpeta del usuario:
//   Windows: %APPDATA%\ARKEN OBRA\Partitions\<id>     lo que guarda el programa
//            %APPDATA%\ARKEN OBRA\apps\<id>\datos     copia interna y copias diarias
// La primera vez que se abre una app, si en el equipo estaba instalada su app propia (ARKEN
// CONTROL, ARKEN PRECIOS o ARKEN ANALYTICA), se traen sus datos: se copian, la app vieja no se
// toca.

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, safeStorage, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ESQUEMA = 'app';
const ORIGEN_INICIO = 'app://obra';
const NOMBRE = 'ARKEN OBRA';
const ID_APP = 'com.aboteroproyectos.arkenobra';
const DIR_APPS = path.join(__dirname, '..', 'apps');
const DIR_INICIO = path.join(__dirname, '..', 'inicio');
const COPIAS_DIARIAS_CONTROL = 10;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.bcmap': 'application/octet-stream',
};

let manifiesto = {};
try {
  manifiesto = JSON.parse(fs.readFileSync(path.join(DIR_APPS, 'manifiesto.json'), 'utf8'));
} catch {}

/**
 * Las apps de la familia. `vieja` es el nombre de la carpeta de datos de su app propia, de donde
 * se traen los datos la primera vez. `cierre` es el prefijo de los canales con que el programa
 * termina de guardar antes de cerrar la ventana. `sinRed`: nada sale a internet (como en su app).
 */
const APPS = [
  {
    id: 'control',
    nombre: 'ARKEN CONTROL',
    host: 'arken',
    vieja: 'ARKEN CONTROL',
    descripcion: 'Control de obra: proyectos, presupuesto, causaciones, bitácora, facturación, flujo de fondos, programación, contabilidad, supervisión, RR. HH. y nómina.',
    preload: 'preload.cjs',
    cierre: 'arken',
    espera: 6000,
    permisos: ['media', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem'],
    prefijoDescarga: 'ARKEN_CONTROL_documento',
  },
  {
    id: 'precios',
    nombre: 'ARKEN PRECIOS',
    host: 'precios',
    vieja: 'ARKEN PRECIOS',
    descripcion: 'Observatorio de precios de insumos de obra en Colombia: fuentes certificadas, historial y análisis.',
    preload: 'preload.cjs',
    argVersion: '--arken-precios-version=',
    cierre: 'precios',
    espera: 8000,
    permisos: ['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem'],
    prefijoDescarga: 'ARKEN_PRECIOS_documento',
  },
  {
    id: 'analytica',
    nombre: 'ARKEN ANALYTICA',
    host: 'analytica',
    vieja: 'ARKEN ANALYTICA',
    descripcion: 'Evaluación de propuestas y licitaciones de obra, con ARKEN OFERTA para los proponentes.',
    preload: 'preload.cjs',
    argVersion: '--arken-analytica-version=',
    sinRed: true,
    permisos: ['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem'],
    prefijoDescarga: 'ARKEN_ANALYTICA_documento',
  },
  {
    id: 'bank',
    nombre: 'ARKEN BANK',
    host: 'bank',
    vieja: null,
    descripcion: 'Análisis de créditos bancarios: tipos de crédito, documentos, bancos y concepto de viabilidad.',
    preload: null,
    sinRed: true,
    permisos: ['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem'],
    prefijoDescarga: 'ARKEN_BANK_documento',
  },
];
const PORID = Object.fromEntries(APPS.map((a) => [a.id, a]));
const origen = (a) => `app://${a.host}`;
const disponible = (a) => !!manifiesto[a.id] && fs.existsSync(path.join(DIR_APPS, a.id, 'www', 'index.html'));

protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
  },
]);

let inicio = null;
const ventanas = {}; // id → BrowserWindow

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => mostrarInicio());
  app.whenReady().then(iniciar);
}

/* ─────────────  Rutas de datos  ───────────── */
const dirApp = (id) => path.join(app.getPath('userData'), 'apps', id);
const dirDatos = (id) => path.join(dirApp(id), 'datos');
const archivoVentana = (id) => (id ? path.join(dirApp(id), 'ventana.json') : path.join(app.getPath('userData'), 'ventana-inicio.json'));
const archivoMigracion = () => path.join(app.getPath('userData'), 'migracion.json');

function iniciar() {
  if (process.platform === 'win32') app.setAppUserModelId(ID_APP);
  session.defaultSession.protocol.handle(ESQUEMA, servidor('obra', DIR_INICIO));
  configurarInicio(session.defaultSession);
  registrarIPC();
  Menu.setApplicationMenu(crearMenu());
  mostrarInicio();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mostrarInicio();
  });
}

app.on('window-all-closed', () => app.quit());

/** Sirve los archivos de una carpeta en app://<host>/. Se leen del disco (no con net.fetch de
 *  file://), porque el bloqueo de red de las apps sin red cancelaría esa petición (ANALYTICA 0.5.0). */
function servidor(host, carpeta) {
  return async (req) => {
    const url = new URL(req.url);
    if (url.host !== host) return new Response('No encontrado', { status: 404 });
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.join(carpeta, ruta);
    const relativa = path.relative(carpeta, archivo);
    if (relativa.startsWith('..') || path.isAbsolute(relativa)) return new Response('Prohibido', { status: 403 });
    try {
      const datos = await fsp.readFile(archivo);
      return new Response(datos, { headers: { 'content-type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' } });
    } catch {
      return new Response('No encontrado', { status: 404 });
    }
  };
}

/* ─────────────  Pantalla de inicio  ───────────── */
function mostrarInicio() {
  if (inicio) {
    if (inicio.isMinimized()) inicio.restore();
    inicio.focus();
    return;
  }
  const estado = leerEstadoVentana(null, { width: 1120, height: 760 });
  inicio = new BrowserWindow({
    ...estado.limites,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: NOMBRE,
    backgroundColor: '#F1F2F2',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-inicio.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (estado.maximizada) inicio.maximize();
  inicio.once('ready-to-show', () => inicio.show());
  inicio.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  inicio.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN_INICIO + '/')) e.preventDefault();
  });
  inicio.on('close', () => guardarEstadoVentana(inicio, null));
  inicio.on('closed', () => {
    inicio = null;
  });
  inicio.loadURL(ORIGEN_INICIO + '/index.html');
}

function configurarInicio(ses) {
  ses.setPermissionRequestHandler((_wc, _permiso, responder) => responder(false));
  ses.setPermissionCheckHandler(() => false);
  ses.webRequest.onBeforeRequest((detalle, responder) => {
    const u = detalle.url;
    responder({ cancel: !(u.startsWith(ORIGEN_INICIO + '/') || /^(data|devtools|chrome-extension|chrome):/i.test(u)) });
  });
}

/* ─────────────  Ventana de cada app  ───────────── */
const sesionesListas = new Set();

function sesionDe(a) {
  const ses = session.fromPartition('persist:' + a.id);
  if (sesionesListas.has(a.id)) return ses;
  sesionesListas.add(a.id);
  ses.protocol.handle(ESQUEMA, servidor(a.host, path.join(DIR_APPS, a.id, 'www')));
  const PERMITIDOS = new Set(a.permisos);
  const esNuestro = (url) => String(url || '').startsWith(origen(a));
  ses.setPermissionRequestHandler((_wc, permiso, responder, detalle) =>
    responder(PERMITIDOS.has(permiso) && esNuestro(detalle.requestingUrl || detalle.securityOrigin)),
  );
  ses.setPermissionCheckHandler((_wc, permiso, org) => PERMITIDOS.has(permiso) && esNuestro(org));
  if (a.sinRed) {
    ses.webRequest.onBeforeRequest((detalle, responder) => {
      const u = detalle.url;
      const propio = u.startsWith(origen(a) + '/') || /^(blob|data|devtools|chrome-extension|chrome):/i.test(u);
      responder({ cancel: !propio });
    });
  }
  ses.on('will-download', (_e, item) => {
    let nombre = item.getFilename();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.\w+)?$/i.test(nombre)) nombre = a.prefijoDescarga + path.extname(nombre);
    item.setSaveDialogOptions({ title: 'Guardar archivo', defaultPath: path.join(app.getPath('downloads'), nombre) });
  });
  return ses;
}

async function abrirApp(id) {
  const a = PORID[id];
  if (!a || !disponible(a)) return false;
  const abierta = ventanas[id];
  if (abierta && !abierta.isDestroyed()) {
    if (abierta.isMinimized()) abierta.restore();
    abierta.focus();
    return true;
  }
  if (!(await traerDatosDeLaAppVieja(a))) return false;
  crearVentanaApp(a);
  return true;
}

function crearVentanaApp(a) {
  const ses = sesionDe(a);
  const estado = leerEstadoVentana(a.id, { width: 1440, height: 900 });
  const args = a.argVersion ? [a.argVersion + manifiesto[a.id].version] : [];
  const v = new BrowserWindow({
    ...estado.limites,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: a.nombre,
    backgroundColor: '#16181A',
    autoHideMenuBar: true,
    webPreferences: {
      session: ses,
      preload: a.preload ? path.join(DIR_APPS, a.id, 'electron', a.preload) : undefined,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      plugins: true,
      spellcheck: true,
      additionalArguments: args,
    },
  });
  ventanas[a.id] = v;
  if (estado.maximizada) v.maximize();
  v.once('ready-to-show', () => v.show());
  protegerContenido(v.webContents, a);
  let puedeCerrar = !a.cierre;
  let espera = null;

  // El programa avisa al cerrar solo si los cambios quedaron en memoria
  v.webContents.on('will-prevent-unload', (e) => {
    const r = dialog.showMessageBoxSync(v, {
      type: 'warning',
      buttons: ['Cerrar de todas formas', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: a.nombre,
      message: 'Hay cambios que no se pudieron guardar.',
      detail: 'Si cierra ahora se perderán. Exporte un respaldo desde Administración antes de salir.',
    });
    if (r === 0) e.preventDefault();
    else puedeCerrar = !a.cierre;
  });

  v.webContents.on('render-process-gone', (_e, detalle) => {
    if (detalle.reason === 'clean-exit') return;
    const r = dialog.showMessageBoxSync(v, {
      type: 'error',
      buttons: ['Volver a cargar', 'Cerrar'],
      title: a.nombre,
      message: `${a.nombre} se detuvo de forma inesperada.`,
      detail: 'Los datos guardados hasta el último cambio se conservan.',
    });
    if (r === 0) v.reload();
    else v.destroy();
  });

  // Al cerrar: el programa termina de guardar y luego se cierra la ventana (CONTROL y PRECIOS)
  v.on('close', (e) => {
    guardarEstadoVentana(v, a.id);
    if (puedeCerrar) return;
    e.preventDefault();
    if (a.id === 'precios' && motor && motor.ocupado()) {
      const r = dialog.showMessageBoxSync(v, {
        type: 'warning',
        buttons: ['Cerrar y cancelar la lectura', 'Seguir leyendo'],
        defaultId: 1,
        cancelId: 1,
        title: a.nombre,
        message: motor.ocupado() === 'prueba' ? 'El motor está probando una fuente.' : 'El motor está leyendo las fuentes.',
        detail: 'Si cierra ahora, la lectura se cancela. Lo que ya se guardó en la base se conserva.',
      });
      if (r !== 0) return;
      motor.cancelar();
    }
    v.webContents.send(a.cierre + ':cerrar');
    clearTimeout(espera);
    espera = setTimeout(() => {
      puedeCerrar = true;
      if (!v.isDestroyed()) v.close();
    }, a.espera);
  });
  v.__listoParaCerrar = () => {
    clearTimeout(espera);
    puedeCerrar = true;
    if (!v.isDestroyed()) v.close();
  };
  v.on('closed', () => {
    clearTimeout(espera);
    if (ventanas[a.id] === v) delete ventanas[a.id];
  });

  v.loadURL(origen(a) + '/index.html');
  return v;
}

/** Solo se navega dentro de la app; los enlaces externos se abren en el sistema. */
function protegerContenido(contenido, a) {
  const O = origen(a);
  contenido.setWindowOpenHandler(({ url }) => {
    // CONTROL abre sus vistas previas e impresiones en una ventana aparte
    if (a.id === 'control' && (url === '' || url === 'about:blank' || url.startsWith('blob:' + O))) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 850,
          autoHideMenuBar: true,
          backgroundColor: '#FFFFFF',
          webPreferences: { session: sesionDe(a), contextIsolation: true, sandbox: true, nodeIntegration: false, plugins: true },
        },
      };
    }
    // En las demás, un archivo que el programa abre en otra ventana se ofrece para guardar
    if (url.startsWith('blob:' + O + '/')) {
      contenido.downloadURL(url);
      return { action: 'deny' };
    }
    abrirFuera(url);
    return { action: 'deny' };
  });
  contenido.on('will-navigate', (e, url) => {
    if (url.startsWith(O + '/')) return;
    e.preventDefault();
    abrirFuera(url);
  });
  contenido.on('will-attach-webview', (e) => e.preventDefault());
  contenido.on('did-create-window', (hija) => protegerContenido(hija.webContents, a));
}

function abrirFuera(url) {
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(url)) shell.openExternal(url);
}

/* ─────────────  Datos de las apps instaladas antes  ─────────────
   El almacenamiento de cada app propia (su carpeta de usuario) guardaba solo su programa, con
   el mismo origen (app://arken, app://precios, app://analytica). Se copia tal cual a la sesión
   de esa app en ARKEN OBRA, menos las cachés. Su copia interna y sus copias diarias van a
   apps/<id>/datos. Se hace una sola vez por app, antes de abrirla por primera vez. */
const NO_SE_COPIA = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GrShaderCache',
  'ShaderCache',
  'Crashpad',
  'Partitions',
  'logs',
  'datos',
  'motor',
  'secretos.json',
  'ventana.json',
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
  'lockfile',
]);

function leerMigracion() {
  try {
    return JSON.parse(fs.readFileSync(archivoMigracion(), 'utf8'));
  } catch {
    return {};
  }
}
function marcarMigracion(id, estado) {
  const m = leerMigracion();
  m[id] = { estado, fecha: new Date().toISOString() };
  fs.mkdirSync(path.dirname(archivoMigracion()), { recursive: true });
  fs.writeFileSync(archivoMigracion(), JSON.stringify(m, null, 2));
}

async function traerDatosDeLaAppVieja(a) {
  if (leerMigracion()[a.id]) return true;
  const particion = path.join(app.getPath('userData'), 'Partitions', a.id);
  if (fs.existsSync(particion)) {
    marcarMigracion(a.id, 'ya-tenia-datos');
    return true;
  }
  const vieja = a.vieja ? path.join(app.getPath('appData'), a.vieja) : null;
  if (!vieja || !fs.existsSync(vieja)) {
    marcarMigracion(a.id, 'sin-app-anterior');
    return true;
  }
  for (;;) {
    try {
      copiarDatos(a, vieja, particion);
      marcarMigracion(a.id, 'traidos');
      return true;
    } catch (err) {
      const r = await dialog.showMessageBox(inicio && !inicio.isDestroyed() ? inicio : undefined, {
        type: 'warning',
        buttons: ['Reintentar', 'Abrir sin traer los datos', 'Cancelar'],
        defaultId: 0,
        cancelId: 2,
        title: NOMBRE,
        message: `No se pudieron traer los datos de la app ${a.nombre} que ya estaba instalada.`,
        detail:
          `Si ${a.nombre} está abierta, ciérrela y pulse «Reintentar».\n\n` +
          `Si elige «Abrir sin traer los datos», ${a.nombre} arranca vacía en ARKEN OBRA; los datos siguen en la app anterior y se pueden pasar con un respaldo.\n\n` +
          `Detalle: ${String((err && err.message) || err).slice(0, 300)}`,
      });
      if (r.response === 0) continue;
      if (r.response === 1) {
        marcarMigracion(a.id, 'omitido');
        return true;
      }
      return false;
    }
  }
}

function copiarDatos(a, vieja, particion) {
  const tmp = particion + '.trayendo';
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  for (const nombre of fs.readdirSync(vieja)) {
    if (NO_SE_COPIA.has(nombre)) continue;
    fs.cpSync(path.join(vieja, nombre), path.join(tmp, nombre), { recursive: true, force: true, errorOnExist: false });
  }
  // Copia interna, copias diarias, bitácora del motor y tamaño de la ventana
  const destino = dirApp(a.id);
  const extras = ['datos', 'motor', 'ventana.json'];
  // La bóveda de PRECIOS va cifrada por el sistema: en Windows (DPAPI) se descifra igual para el
  // mismo usuario; en macOS la clave del llavero es de la app vieja y no serviría
  if (process.platform === 'win32') extras.push('secretos.json');
  for (const n of extras) {
    const desde = path.join(vieja, n);
    const hacia = path.join(destino, n);
    if (fs.existsSync(desde) && !fs.existsSync(hacia)) fs.cpSync(desde, hacia, { recursive: true });
  }
  fs.mkdirSync(path.dirname(particion), { recursive: true });
  fs.renameSync(tmp, particion);
}

/* ─────────────  Puente con los programas  ───────────── */
let motor = null;
let boveda = null;
let copiasPrecios = null;
let copiasAnalytica = null;

const preciosModulo = (n) => require(path.join(DIR_APPS, 'precios', 'electron', n));
function delMotor() {
  if (!motor) {
    const { crearMotor } = preciosModulo('motor.cjs');
    const { crearFetch } = preciosModulo('red.cjs');
    motor = crearMotor({
      programa: path.join(DIR_APPS, 'precios', 'www', 'index.html'),
      carpeta: path.join(dirApp('precios'), 'motor'),
      fetch: crearFetch(),
    });
  }
  return motor;
}
function deLaBoveda() {
  if (!boveda) {
    const { crearBoveda, cifradoDelSistema } = preciosModulo('boveda.cjs');
    boveda = crearBoveda({ archivo: path.join(dirApp('precios'), 'secretos.json'), cifrado: cifradoDelSistema(safeStorage) });
  }
  return boveda;
}
function deCopiasPrecios() {
  if (!copiasPrecios) copiasPrecios = preciosModulo('copias.cjs').crearCopias({ carpeta: dirDatos('precios') });
  return copiasPrecios;
}
function deCopiasAnalytica() {
  if (!copiasAnalytica) copiasAnalytica = require(path.join(DIR_APPS, 'analytica', 'electron', 'copias.cjs')).crearCopias({ carpeta: dirDatos('analytica') });
  return copiasAnalytica;
}

function registrarIPC() {
  const desde = (e, a) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(origen(a) + '/'));

  // Pantalla de inicio
  const delInicio = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(ORIGEN_INICIO + '/'));
  ipcMain.handle('obra:apps', (e) =>
    delInicio(e)
      ? APPS.map((a) => ({ id: a.id, nombre: a.nombre, descripcion: a.descripcion, disponible: disponible(a), version: (manifiesto[a.id] || {}).version || '' }))
      : [],
  );
  ipcMain.handle('obra:abrir', (e, id) => (delInicio(e) ? abrirApp(id) : false));

  // Cierre ordenado: el programa avisa que ya guardó
  for (const a of APPS.filter((x) => x.cierre)) {
    ipcMain.on(a.cierre + ':listo-para-cerrar', (e) => {
      const v = ventanas[a.id];
      if (v && !v.isDestroyed() && e.sender === v.webContents && v.__listoParaCerrar) v.__listoParaCerrar();
    });
  }

  /* CONTROL: copia interna y copias diarias (los mismos canales de electron/main.cjs) */
  const C = PORID.control;
  const dirDiariasC = () => path.join(dirDatos('control'), 'copias-diarias');
  const copiaC = () => path.join(dirDatos('control'), 'copia.json');
  const metaC = () => path.join(dirDatos('control'), 'copia-meta.json');
  ipcMain.handle('arken:copia:meta', async (e) => {
    if (!desde(e, C)) return null;
    try {
      return JSON.parse(await fsp.readFile(metaC(), 'utf8'));
    } catch {
      return null;
    }
  });
  ipcMain.handle('arken:copia:leer', async (e) => {
    if (!desde(e, C)) return null;
    for (const archivo of [copiaC(), copiaC() + '.tmp']) {
      try {
        return await fsp.readFile(archivo, 'utf8');
      } catch {}
    }
    return null;
  });
  let ultimaDiaria = 0;
  ipcMain.handle('arken:copia:guardar', async (e, texto, actualizado) => {
    if (!desde(e, C) || typeof texto !== 'string' || !texto) return false;
    await fsp.mkdir(dirDatos('control'), { recursive: true });
    const tmp = copiaC() + '.tmp';
    await fsp.writeFile(tmp, texto, 'utf8');
    await fsp.rename(tmp, copiaC());
    await fsp.writeFile(metaC(), JSON.stringify({ actualizado, caracteres: texto.length }), 'utf8');
    const ahora = Date.now();
    if (ahora - ultimaDiaria > 10 * 60 * 1000 || !fs.existsSync(diariaC(ahora))) {
      ultimaDiaria = ahora;
      await fsp.mkdir(dirDiariasC(), { recursive: true });
      await fsp.copyFile(copiaC(), diariaC(ahora));
      const archivos = (await fsp.readdir(dirDiariasC())).filter((n) => /^ARKEN_CONTROL_copia_\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
      for (const n of archivos.slice(0, Math.max(0, archivos.length - COPIAS_DIARIAS_CONTROL))) await fsp.rm(path.join(dirDiariasC(), n), { force: true });
    }
    return true;
  });
  ipcMain.handle('arken:copia:borrar', async (e) => {
    if (!desde(e, C)) return false;
    await fsp.rm(metaC(), { force: true });
    await fsp.rm(copiaC(), { force: true });
    return true;
  });
  ipcMain.handle('arken:copias:abrir', async (e) => {
    if (!desde(e, C)) return false;
    return abrirCopias('control');
  });
  function diariaC(ms) {
    const d = new Date(ms);
    const f = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return path.join(dirDiariasC(), `ARKEN_CONTROL_copia_${f}.json`);
  }

  /* PRECIOS y ANALYTICA: cada respuesta va como { ok, valor } o { ok: false, error } */
  const manejar = (a, canal, fn) =>
    ipcMain.handle(canal, async (e, ...args) => {
      if (!desde(e, a)) return { ok: false, error: 'Solo el programa de la app puede usar esta función.' };
      try {
        return { ok: true, valor: await fn(e, ...args) };
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err).slice(0, 1000) };
      }
    });

  const P = PORID.precios;
  manejar(P, 'precios:secretos:disponible', () => deLaBoveda().disponible());
  manejar(P, 'precios:secretos:guardar', (_e, n, v, meta) => deLaBoveda().guardar(n, v, meta));
  manejar(P, 'precios:secretos:info', (_e, n) => deLaBoveda().info(n));
  manejar(P, 'precios:secretos:leer', (_e, n) => deLaBoveda().leer(n));
  manejar(P, 'precios:secretos:borrar', (_e, n) => deLaBoveda().borrar(n));
  manejar(P, 'precios:motor:correr', (e, plan) =>
    delMotor().correr(plan, (ev) => {
      if (!e.sender.isDestroyed()) e.sender.send('precios:motor:evento', ev);
    }),
  );
  manejar(P, 'precios:motor:cancelar', () => delMotor().cancelar());
  manejar(P, 'precios:motor:probar', (_e, ficha, o) => delMotor().probar(ficha, o));
  manejar(P, 'precios:copia:meta', () => deCopiasPrecios().meta());
  manejar(P, 'precios:copia:leer', () => deCopiasPrecios().leer());
  manejar(P, 'precios:copia:guardar', (_e, texto, actualizado) => deCopiasPrecios().guardar(texto, actualizado));
  manejar(P, 'precios:copia:borrar', () => deCopiasPrecios().borrar());
  manejar(P, 'precios:copias:abrir', () => abrirCopias('precios'));

  const A = PORID.analytica;
  manejar(A, 'analytica:copias:hoy', () => deCopiasAnalytica().hayDeHoy());
  manejar(A, 'analytica:copias:guardar', (_e, bytes) => deCopiasAnalytica().guardar(bytes));
  manejar(A, 'analytica:copias:abrir', () => abrirCopias('analytica'));
}

async function abrirCopias(id) {
  const carpeta =
    id === 'precios' ? deCopiasPrecios().carpetaDiarias() : id === 'analytica' ? deCopiasAnalytica().carpeta() : path.join(dirDatos('control'), 'copias-diarias');
  await fsp.mkdir(carpeta, { recursive: true });
  await shell.openPath(carpeta);
  return true;
}

/* ─────────────  Tamaño y posición de las ventanas  ───────────── */
function leerEstadoVentana(id, tamano) {
  const porDefecto = { limites: { ...tamano }, maximizada: false };
  try {
    const e = JSON.parse(fs.readFileSync(archivoVentana(id), 'utf8'));
    const area = screen.getDisplayMatching(e.limites).workArea;
    const visible =
      e.limites.x < area.x + area.width - 100 &&
      e.limites.y < area.y + area.height - 100 &&
      e.limites.x + e.limites.width > area.x + 100 &&
      e.limites.y + e.limites.height > area.y + 50;
    return visible ? e : { ...porDefecto, maximizada: !!e.maximizada };
  } catch {
    return porDefecto;
  }
}

function guardarEstadoVentana(v, id) {
  if (!v || v.isDestroyed()) return;
  try {
    const limites = v.isMaximized() || v.isFullScreen() ? v.getNormalBounds() : v.getBounds();
    fs.mkdirSync(path.dirname(archivoVentana(id)), { recursive: true });
    fs.writeFileSync(archivoVentana(id), JSON.stringify({ limites, maximizada: v.isMaximized() }));
  } catch {}
}

/* ─────────────  Menú  ───────────── */
function crearMenu() {
  const mac = process.platform === 'darwin';
  const lista = APPS.filter(disponible);
  const plantilla = [
    ...(mac
      ? [
          {
            label: NOMBRE,
            submenu: [
              { role: 'about', label: 'Acerca de ARKEN OBRA' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar ARKEN OBRA' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de ARKEN OBRA' },
            ],
          },
        ]
      : [{ label: 'Archivo', submenu: [{ label: 'Inicio', accelerator: 'Alt+Home', click: () => mostrarInicio() }, { type: 'separator' }, { role: 'quit', label: 'Salir' }] }]),
    {
      label: 'Aplicaciones',
      submenu: [
        { label: 'Inicio', accelerator: mac ? 'Alt+Home' : undefined, click: () => mostrarInicio(), visible: mac },
        ...lista.map((a, i) => ({ label: a.nombre, accelerator: `CmdOrCtrl+${i + 1}`, click: () => abrirApp(a.id) })),
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
    {
      label: 'Ventana',
      submenu: [{ role: 'minimize', label: 'Minimizar' }, ...(mac ? [{ role: 'zoom', label: 'Zoom' }] : []), { role: 'close', label: 'Cerrar' }],
    },
    {
      label: 'Ayuda',
      submenu: [
        ...lista
          .filter((a) => a.id !== 'bank')
          .map((a) => ({ label: `Abrir la carpeta de copias diarias de ${a.nombre}`, click: () => abrirCopias(a.id) })),
        ...(lista.some((a) => a.id === 'precios')
          ? [
              {
                label: 'Abrir la bitácora de la última lectura de ARKEN PRECIOS',
                click: async () => {
                  const archivo = path.join(dirApp('precios'), 'motor', 'ultima-lectura.json');
                  if (fs.existsSync(archivo)) shell.showItemInFolder(archivo);
                  else dialog.showMessageBox({ type: 'info', title: NOMBRE, message: 'Todavía no hay lecturas del motor en este equipo.' });
                },
              },
            ]
          : []),
      ],
    },
  ];
  return Menu.buildFromTemplate(plantilla);
}
