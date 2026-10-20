// ARKEN ANALYTICA · app de escritorio (Windows, macOS y Linux), recomendada para la empresa (§6).
//
// Muestra el programa en una ventana propia, servido desde la app (app://analytica/), y le da lo
// que una página web no tiene: una copia de los datos por día, de los últimos 10 días.
// Los datos del programa quedan en el almacenamiento de la app, en la carpeta del usuario:
//   Windows: %APPDATA%\ARKEN ANALYTICA
//   macOS:   ~/Library/Application Support/ARKEN ANALYTICA
//   Linux:   ~/.config/ARKEN ANALYTICA
// Nada sale a internet: la app bloquea toda conexión fuera de ella.

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { crearCopias } = require('./copias.cjs');

const ESQUEMA = 'app';
const ORIGEN = 'app://analytica';
const WWW = path.join(__dirname, '..', 'www');
const ID_APP = 'com.aboteroproyectos.arkenanalytica';
const NOMBRE = 'ARKEN ANALYTICA';
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
  },
]);

// Una sola ventana: dos copias abiertas pelearían por los mismos datos
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });
  app.whenReady().then(iniciar);
}

let ventana = null;
let copias = null;

const archivoVentana = () => path.join(app.getPath('userData'), 'ventana.json');

function iniciar() {
  if (process.platform === 'win32') app.setAppUserModelId(ID_APP);

  // Los archivos de www/ se leen del disco, no con net.fetch(file://…): esa petición pasa por el
  // bloqueo de red de configurarSesion, que la cancela, y la ventana quedaba en blanco (0.4.0 y 0.5.0)
  protocol.handle(ESQUEMA, async (req) => {
    const url = new URL(req.url);
    if (url.host !== 'analytica') return new Response('No encontrado', { status: 404 });
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.join(WWW, ruta);
    const relativa = path.relative(WWW, archivo);
    if (relativa.startsWith('..') || path.isAbsolute(relativa)) return new Response('Prohibido', { status: 403 });
    try {
      const datos = await fsp.readFile(archivo);
      return new Response(datos, { headers: { 'content-type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' } });
    } catch {
      return new Response('No encontrado', { status: 404 });
    }
  });

  // La 0.4 guardaba aquí, cifrada, la clave de API del asistente de IA, que ya no existe
  fs.rmSync(path.join(app.getPath('userData'), 'secretos.json'), { force: true });
  copias = crearCopias({ carpeta: path.join(app.getPath('userData'), 'datos') });

  configurarSesion(session.defaultSession);
  registrarIPC();
  Menu.setApplicationMenu(crearMenu());
  crearVentana();

  app.on('activate', () => {
    if (!ventana) crearVentana();
  });
}

app.on('window-all-closed', () => app.quit());

/* ─────────────  Ventana principal  ───────────── */
function crearVentana() {
  const estado = leerEstadoVentana();
  ventana = new BrowserWindow({
    ...estado.limites,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: NOMBRE,
    backgroundColor: '#16181A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      plugins: true, // el visor de PDF de Chromium para los documentos de los proponentes
      spellcheck: true,
      additionalArguments: ['--arken-analytica-version=' + app.getVersion()],
    },
  });
  if (estado.maximizada) ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  protegerContenido(ventana.webContents);

  ventana.webContents.on('render-process-gone', (_e, detalle) => {
    if (detalle.reason === 'clean-exit') return;
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'error',
      buttons: ['Volver a cargar', 'Cerrar'],
      title: NOMBRE,
      message: 'ARKEN ANALYTICA se detuvo de forma inesperada.',
      detail: 'Los datos guardados hasta el último cambio se conservan.',
    });
    if (r === 0) ventana.reload();
    else ventana.destroy();
  });
  ventana.on('close', guardarEstadoVentana);
  ventana.on('closed', () => {
    ventana = null;
  });
  ventana.loadURL(ORIGEN + '/index.html');
}

/** Solo se navega dentro de la app; los enlaces externos se abren en el navegador del sistema. */
function protegerContenido(contenido) {
  contenido.setWindowOpenHandler(({ url }) => {
    // Un archivo que el programa abre en otra ventana se ofrece para guardar: la ventana nueva
    // tendría esta misma guardia y quedaría en blanco
    if (url.startsWith('blob:' + ORIGEN + '/')) {
      contenido.downloadURL(url);
      return { action: 'deny' };
    }
    abrirFuera(url);
    return { action: 'deny' };
  });
  contenido.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGEN + '/')) return;
    e.preventDefault();
    abrirFuera(url);
  });
  contenido.on('will-attach-webview', (e) => e.preventDefault());
  contenido.on('did-create-window', (hija) => protegerContenido(hija.webContents));
}

function abrirFuera(url) {
  if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url);
}

/* ─────────────  Permisos, red y descargas  ───────────── */
function configurarSesion(ses) {
  const PERMITIDOS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem']);
  const esNuestro = (url) => String(url || '').startsWith(ORIGEN);
  ses.setPermissionRequestHandler((_wc, permiso, responder, detalle) =>
    responder(PERMITIDOS.has(permiso) && esNuestro(detalle.requestingUrl || detalle.securityOrigin)),
  );
  ses.setPermissionCheckHandler((_wc, permiso, origen) => PERMITIDOS.has(permiso) && esNuestro(origen));
  // Nada sale a internet: solo lo de la propia app
  ses.webRequest.onBeforeRequest((detalle, responder) => {
    const u = detalle.url;
    const propio = u.startsWith(ORIGEN + '/') || /^(blob|data|devtools|chrome-extension|chrome):/i.test(u);
    responder({ cancel: !propio });
  });
  ses.on('will-download', (_e, item) => {
    let nombre = item.getFilename();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.\w+)?$/i.test(nombre)) nombre = 'ARKEN_ANALYTICA_documento' + path.extname(nombre);
    item.setSaveDialogOptions({ title: 'Guardar archivo', defaultPath: path.join(app.getPath('downloads'), nombre) });
  });
}

/* ─────────────  Puente con el programa  ───────────── */
function registrarIPC() {
  const deLaApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(ORIGEN + '/'));
  /** Cada respuesta va como { ok, valor } o { ok: false, error }: el mensaje llega al programa tal cual. */
  const manejar = (canal, fn) =>
    ipcMain.handle(canal, async (e, ...args) => {
      if (!deLaApp(e)) return { ok: false, error: 'Solo el programa de la app puede usar esta función.' };
      try {
        return { ok: true, valor: await fn(e, ...args) };
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err).slice(0, 1000) };
      }
    });

  manejar('analytica:copias:hoy', () => copias.hayDeHoy());
  manejar('analytica:copias:guardar', (_e, bytes) => copias.guardar(bytes));
  manejar('analytica:copias:abrir', () => abrirCopias());
}

async function abrirCopias() {
  await fsp.mkdir(copias.carpeta(), { recursive: true });
  await shell.openPath(copias.carpeta());
  return true;
}

/* ─────────────  Tamaño y posición de la ventana  ───────────── */
function leerEstadoVentana() {
  const porDefecto = { limites: { width: 1440, height: 900 }, maximizada: false };
  try {
    const e = JSON.parse(fs.readFileSync(archivoVentana(), 'utf8'));
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
function guardarEstadoVentana() {
  if (!ventana || ventana.isDestroyed()) return;
  try {
    const limites = ventana.isMaximized() || ventana.isFullScreen() ? ventana.getNormalBounds() : ventana.getBounds();
    fs.writeFileSync(archivoVentana(), JSON.stringify({ limites, maximizada: ventana.isMaximized() }));
  } catch {}
}

/* ─────────────  Menú  ───────────── */
function crearMenu() {
  const mac = process.platform === 'darwin';
  const plantilla = [
    ...(mac
      ? [
          {
            label: NOMBRE,
            submenu: [
              { role: 'about', label: 'Acerca de ARKEN ANALYTICA' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar ARKEN ANALYTICA' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de ARKEN ANALYTICA' },
            ],
          },
        ]
      : [{ label: 'Archivo', submenu: [{ role: 'quit', label: 'Salir' }] }]),
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
    { label: 'Ayuda', submenu: [{ label: 'Abrir la carpeta de copias diarias', click: () => abrirCopias() }] },
  ];
  return Menu.buildFromTemplate(plantilla);
}
