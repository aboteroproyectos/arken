// ARKEN PAY · app de escritorio (Windows, macOS y Linux).
//
// Muestra el programa (www/index.html) en una ventana propia, servido desde app://pay/, y le da:
//   · el almacén de la bitácora de eventos (local o en la nube, ver almacen.cjs);
//   · la conexión a la nube, con la contraseña cifrada por el sistema operativo (safeStorage);
//   · guardar archivos (reportes en Excel/CSV) y abrir la carpeta de copias.
// Los datos quedan en la carpeta de la app del usuario:
//   Windows: %APPDATA%\ARKEN PAY      macOS: ~/Library/Application Support/ARKEN PAY

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, safeStorage, session, shell } = require('electron');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { crearLocal, crearNube } = require('./almacen.cjs');

const ESQUEMA = 'app';
const ORIGEN = 'app://pay';
const WWW = path.join(__dirname, '..', 'www');
const NOMBRE = 'ARKEN PAY';

protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
}

let ventana = null;
let almacen = null;
const dirDatos = () => process.env.ARKEN_PAY_DATOS || path.join(app.getPath('userData'), 'datos');
const archivoConexion = () => path.join(dirDatos(), 'conexion.json');

/* ─────────── Conexión (configuración del almacén) ─────────── */
async function leerConexion() {
  try {
    const c = JSON.parse(await fsp.readFile(archivoConexion(), 'utf8'));
    if (c.modo === 'nube' && c.claveCifrada) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('El sistema no permite descifrar la contraseña guardada.');
      c.clave = safeStorage.decryptString(Buffer.from(c.claveCifrada, 'base64'));
    }
    return c;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function guardarConexion(c) {
  await fsp.mkdir(dirDatos(), { recursive: true });
  const guardar = { modo: c.modo, guardada: new Date().toISOString() };
  if (c.modo === 'nube') {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Este equipo no tiene cifrado del sistema disponible: no se puede guardar la contraseña de forma segura.');
    Object.assign(guardar, { url: c.url, claveAnonima: c.claveAnonima, correo: c.correo, claveCifrada: safeStorage.encryptString(c.clave).toString('base64') });
  }
  await fsp.writeFile(archivoConexion(), JSON.stringify(guardar, null, 2), { mode: 0o600 });
}

function abrirAlmacen(c) {
  const carpeta = dirDatos();
  if (!c || c.modo === 'local') return crearLocal({ carpeta });
  return crearNube({ url: c.url, claveAnonima: c.claveAnonima, correo: c.correo, clave: c.clave, carpeta: path.join(carpeta, 'nube') });
}

async function iniciar() {
  protocol.handle(ESQUEMA, (req) => {
    const url = new URL(req.url);
    if (url.host !== 'pay') return new Response('No encontrado', { status: 404 });
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.join(WWW, ruta);
    const rel = path.relative(WWW, archivo);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(archivo).toString());
  });
  configurarSesion(session.defaultSession);
  registrarIPC();
  Menu.setApplicationMenu(crearMenu());
  crearVentana();
  app.on('activate', () => !ventana && crearVentana());
}
app.on('window-all-closed', () => app.quit());

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: NOMBRE,
    backgroundColor: '#16181A',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'recursos', 'icono.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
      additionalArguments: ['--arken-pay-version=' + app.getVersion()],
    },
  });
  ventana.once('ready-to-show', () => ventana.show());
  const wc = ventana.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN + '/')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  ventana.on('closed', () => (ventana = null));
  ventana.loadURL(ORIGEN + '/index.html');
}

function configurarSesion(ses) {
  ses.setPermissionRequestHandler((_wc, permiso, responder) => responder(['clipboard-sanitized-write'].includes(permiso)));
  ses.on('will-download', (_e, item) => item.setSaveDialogOptions({ title: 'Guardar archivo', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) }));
}

function registrarIPC() {
  const deLaApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(ORIGEN + '/'));
  const manejar = (canal, fn) =>
    ipcMain.handle(canal, async (e, ...args) => {
      if (!deLaApp(e)) return { ok: false, error: 'Solo el programa de la app puede usar esta función.' };
      try {
        return { ok: true, valor: await fn(e, ...args) };
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err).slice(0, 1000) };
      }
    });

  const asegurar = async () => {
    if (!almacen) almacen = abrirAlmacen(await leerConexion());
    return almacen;
  };

  manejar('pay:conexion:info', async () => {
    const c = await leerConexion();
    const a = await asegurar();
    return { configurada: !!c, ...(await a.info()), cifradoDisponible: safeStorage.isEncryptionAvailable() };
  });
  manejar('pay:conexion:probar', async (_e, c) => {
    const n = crearNube({ ...c, carpeta: path.join(dirDatos(), 'prueba') });
    return n.probar();
  });
  manejar('pay:conexion:guardar', async (_e, c) => {
    if (c.modo !== 'local' && c.modo !== 'nube') throw new Error('Modo inválido.');
    if (c.modo === 'nube') await crearNube({ ...c, carpeta: path.join(dirDatos(), 'prueba') }).probar();
    await guardarConexion(c);
    almacen = abrirAlmacen(await leerConexion());
    return almacen.info();
  });
  manejar('pay:eventos:leer', async (_e, desde) => {
    const lista = await (await asegurar()).leer(Number(desde) || 0);
    return { eventos: [...lista], sinConexion: lista.sinConexion || false };
  });
  manejar('pay:eventos:agregar', async (_e, ev) => (await asegurar()).agregar(ev));
  manejar('pay:documentos:guardar', async (_e, hash, base64, nombre) => (await asegurar()).documentos.guardar(hash, base64, nombre));
  manejar('pay:documentos:leer', async (_e, hash) => (await asegurar()).documentos.leer(hash));
  manejar('pay:archivo:guardar', async (_e, nombre, contenido) => {
    const r = await dialog.showSaveDialog(ventana, { title: 'Guardar', defaultPath: path.join(app.getPath('documents'), String(nombre).replace(/[\\/:*?"<>|]/g, '_')) });
    if (r.canceled || !r.filePath) return null;
    await fsp.writeFile(r.filePath, String(contenido), 'utf8');
    return r.filePath;
  });
  manejar('pay:local:archivar', async () => {
    const a = await asegurar();
    if (a.modo !== 'local' || !a.archivar) throw new Error('Solo una instalación «Solo este equipo» puede empezar de cero. En la nube, use el código de recuperación.');
    return a.archivar();
  });
  manejar('pay:copias:abrir', async () => {
    const dir = (await asegurar()).carpetaCopias();
    await fsp.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
    return true;
  });
}

function crearMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [{ role: 'reload', label: 'Volver a cargar' }, { type: 'separator' }, { role: 'quit', label: 'Salir de ARKEN PAY' }],
    },
    {
      label: 'Editar',
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
      submenu: [{ role: 'resetZoom', label: 'Tamaño normal' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pantalla completa' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }],
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Abrir la carpeta de copias', click: () => almacen && shell.openPath(almacen.carpetaCopias()) },
        { label: `Acerca de ${NOMBRE}`, click: () => dialog.showMessageBox(ventana, { title: NOMBRE, message: `${NOMBRE} ${app.getVersion()}`, detail: 'Control de facturación, cartera y recaudo. Familia ARKEN.' }) },
      ],
    },
  ]);
}
