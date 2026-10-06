// ARKEN PRECIOS · app de escritorio (Windows, macOS y Linux).
//
// Muestra el programa en una ventana propia, servido desde la app (app://precios/), y le da lo
// que una página web no tiene:
//   · el motor de conectores (precios/motor), que lee las fuentes certificadas desde este equipo;
//   · la bóveda del sistema operativo para la clave de API y el token del servidor;
//   · una copia interna de los datos y una copia por día de los últimos 10 días.
// Los datos quedan en la carpeta de la app del usuario:
//   Windows: %APPDATA%\ARKEN PRECIOS
//   macOS:   ~/Library/Application Support/ARKEN PRECIOS
//   Linux:   ~/.config/ARKEN PRECIOS

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, safeStorage, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { crearFetch } = require('./red.cjs');
const { crearBoveda, cifradoDelSistema } = require('./boveda.cjs');
const { crearCopias } = require('./copias.cjs');
const { crearMotor } = require('./motor.cjs');

const ESQUEMA = 'app';
const ORIGEN = 'app://precios';
const WWW = path.join(__dirname, '..', 'www');
const ID_APP = 'com.aboteroproyectos.arkenprecios';
const NOMBRE = 'ARKEN PRECIOS';

protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
  },
]);

// Una sola ventana: dos copias abiertas pelearían por los mismos datos y por el motor
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
let boveda = null;
let copias = null;
let motor = null;

/* ─────────────  Rutas de datos  ───────────── */
const dirDatos = () => path.join(app.getPath('userData'), 'datos');
const archivoVentana = () => path.join(app.getPath('userData'), 'ventana.json');

function iniciar() {
  if (process.platform === 'win32') app.setAppUserModelId(ID_APP);

  protocol.handle(ESQUEMA, (req) => {
    const url = new URL(req.url);
    if (url.host !== 'precios') return new Response('No encontrado', { status: 404 });
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.join(WWW, ruta);
    const relativa = path.relative(WWW, archivo);
    if (relativa.startsWith('..') || path.isAbsolute(relativa)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(archivo).toString());
  });

  boveda = crearBoveda({ archivo: path.join(app.getPath('userData'), 'secretos.json'), cifrado: cifradoDelSistema(safeStorage) });
  copias = crearCopias({ carpeta: dirDatos() });
  motor = crearMotor({ programa: path.join(WWW, 'index.html'), carpeta: path.join(app.getPath('userData'), 'motor'), fetch: crearFetch() });

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
      plugins: true,
      spellcheck: true,
      additionalArguments: ['--arken-precios-version=' + app.getVersion()],
    },
  });
  if (estado.maximizada) ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  protegerContenido(ventana.webContents);
  let puedeCerrar = false;
  let espera = null;

  ventana.webContents.on('render-process-gone', (_e, detalle) => {
    if (detalle.reason === 'clean-exit') return;
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'error',
      buttons: ['Volver a cargar', 'Cerrar'],
      title: NOMBRE,
      message: 'ARKEN PRECIOS se detuvo de forma inesperada.',
      detail: 'Los datos guardados hasta el último cambio se conservan.',
    });
    if (r === 0) ventana.reload();
    else {
      puedeCerrar = true;
      ventana.close();
    }
  });

  // Al cerrar: si el motor está leyendo, se pregunta; luego el programa termina de guardar y se cierra
  ventana.on('close', (e) => {
    guardarEstadoVentana();
    if (puedeCerrar) return;
    e.preventDefault();
    if (motor.ocupado()) {
      const r = dialog.showMessageBoxSync(ventana, {
        type: 'warning',
        buttons: ['Cerrar y cancelar la lectura', 'Seguir leyendo'],
        defaultId: 1,
        cancelId: 1,
        title: NOMBRE,
        message: motor.ocupado() === 'prueba' ? 'El motor está probando una fuente.' : 'El motor está leyendo las fuentes.',
        detail: 'Si cierra ahora, la lectura se cancela. Lo que ya se guardó en la base se conserva.',
      });
      if (r !== 0) return;
      motor.cancelar();
    }
    ventana.webContents.send('precios:cerrar');
    clearTimeout(espera);
    espera = setTimeout(() => {
      puedeCerrar = true;
      if (ventana) ventana.close();
    }, 8000);
  });
  ipcMain.removeAllListeners('precios:listo-para-cerrar');
  ipcMain.on('precios:listo-para-cerrar', (e) => {
    if (!ventana || e.sender !== ventana.webContents) return;
    clearTimeout(espera);
    puedeCerrar = true;
    ventana.close();
  });
  ventana.on('closed', () => {
    ventana = null;
  });

  ventana.loadURL(ORIGEN + '/index.html');
}

/** Solo se navega dentro de la app; los enlaces externos se abren en el navegador del sistema. */
function protegerContenido(contenido) {
  contenido.setWindowOpenHandler(({ url }) => {
    // Un archivo que el programa abre en otra ventana (el PDF para imprimir en una pantalla táctil
    // pequeña) se ofrece para guardar: la ventana nueva tendría esta misma guardia, que solo deja
    // navegar dentro de app://precios/, y quedaría en blanco (decisión 84)
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

/* ─────────────  Permisos y descargas  ───────────── */
function configurarSesion(ses) {
  const PERMITIDOS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem']);
  const esNuestro = (url) => String(url || '').startsWith(ORIGEN);
  ses.setPermissionRequestHandler((_wc, permiso, responder, detalle) =>
    responder(PERMITIDOS.has(permiso) && esNuestro(detalle.requestingUrl || detalle.securityOrigin)),
  );
  ses.setPermissionCheckHandler((_wc, permiso, origen) => PERMITIDOS.has(permiso) && esNuestro(origen));
  ses.on('will-download', (_e, item) => {
    // Lo que llega de una dirección blob: sin nombre propio se llama como el número de la dirección
    let nombre = item.getFilename();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.\w+)?$/i.test(nombre)) nombre = 'ARKEN_PRECIOS_documento' + path.extname(nombre);
    item.setSaveDialogOptions({
      title: 'Guardar archivo',
      defaultPath: path.join(app.getPath('downloads'), nombre),
    });
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

  // Bóveda
  manejar('precios:secretos:disponible', () => boveda.disponible());
  manejar('precios:secretos:guardar', (_e, n, v, meta) => boveda.guardar(n, v, meta));
  manejar('precios:secretos:info', (_e, n) => boveda.info(n));
  manejar('precios:secretos:leer', (_e, n) => boveda.leer(n));
  manejar('precios:secretos:borrar', (_e, n) => boveda.borrar(n));

  // Motor
  manejar('precios:motor:correr', (e, plan) =>
    motor.correr(plan, (ev) => {
      if (!e.sender.isDestroyed()) e.sender.send('precios:motor:evento', ev);
    }),
  );
  manejar('precios:motor:cancelar', () => motor.cancelar());
  manejar('precios:motor:probar', (_e, ficha, o) => motor.probar(ficha, o));

  // Copia interna y copias diarias
  manejar('precios:copia:meta', () => copias.meta());
  manejar('precios:copia:leer', () => copias.leer());
  manejar('precios:copia:guardar', (_e, texto, actualizado) => copias.guardar(texto, actualizado));
  manejar('precios:copia:borrar', () => copias.borrar());
  manejar('precios:copias:abrir', () => abrirCopias());
}

async function abrirCopias() {
  await fsp.mkdir(copias.carpetaDiarias(), { recursive: true });
  await shell.openPath(copias.carpetaDiarias());
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
              { role: 'about', label: 'Acerca de ARKEN PRECIOS' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar ARKEN PRECIOS' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de ARKEN PRECIOS' },
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
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Abrir la carpeta de copias diarias', click: () => abrirCopias() },
        {
          label: 'Abrir la bitácora de la última lectura',
          click: async () => {
            const archivo = path.join(app.getPath('userData'), 'motor', 'ultima-lectura.json');
            if (fs.existsSync(archivo)) shell.showItemInFolder(archivo);
            else dialog.showMessageBox({ type: 'info', title: NOMBRE, message: 'Todavía no hay lecturas del motor en este equipo.' });
          },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(plantilla);
}
