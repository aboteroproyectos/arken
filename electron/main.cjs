// ARKEN CONTROL · app de escritorio (Windows y macOS).
//
// Muestra el programa en una ventana propia, servido desde la app (app://arken/),
// sin internet. Los datos quedan en la carpeta de la app del usuario:
//   Windows: %APPDATA%\ARKEN CONTROL
//   macOS:   ~/Library/Application Support/ARKEN CONTROL
// Además del almacenamiento del programa, se guarda una copia interna y una
// copia por día de los últimos 10 días en la subcarpeta «datos».

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ESQUEMA = 'app';
const ORIGEN = 'app://arken';
const WWW = path.join(__dirname, '..', 'www');
const ID_APP = 'com.aboteroproyectos.arkencontrol';
const COPIAS_DIARIAS = 10;

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

/* ─────────────  Rutas de datos  ───────────── */
const dirDatos = () => path.join(app.getPath('userData'), 'datos');
const dirDiarias = () => path.join(dirDatos(), 'copias-diarias');
const archivoCopia = () => path.join(dirDatos(), 'copia.json');
const archivoMeta = () => path.join(dirDatos(), 'copia-meta.json');
const archivoVentana = () => path.join(app.getPath('userData'), 'ventana.json');

function iniciar() {
  if (process.platform === 'win32') app.setAppUserModelId(ID_APP);

  protocol.handle(ESQUEMA, (req) => {
    const url = new URL(req.url);
    if (url.host !== 'arken') return new Response('No encontrado', { status: 404 });
    let ruta = decodeURIComponent(url.pathname);
    if (ruta === '/' || ruta === '') ruta = '/index.html';
    const archivo = path.join(WWW, ruta);
    const relativa = path.relative(WWW, archivo);
    if (relativa.startsWith('..') || path.isAbsolute(relativa)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(archivo).toString());
  });

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
    title: 'ARKEN CONTROL',
    backgroundColor: '#16181A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      plugins: true,
      spellcheck: true,
    },
  });
  if (estado.maximizada) ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  protegerContenido(ventana.webContents);
  let puedeCerrar = false;
  let espera = null;

  // El programa avisa al cerrar solo si los cambios quedaron en memoria
  ventana.webContents.on('will-prevent-unload', (e) => {
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'warning',
      buttons: ['Cerrar de todas formas', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'ARKEN CONTROL',
      message: 'Hay cambios que no se pudieron guardar.',
      detail: 'Si cierra ahora se perderán. Use Administración › Datos › Exportar respaldo antes de salir.',
    });
    if (r === 0) e.preventDefault();
    else puedeCerrar = false;
  });

  ventana.webContents.on('render-process-gone', (_e, detalle) => {
    if (detalle.reason === 'clean-exit') return;
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'error',
      buttons: ['Volver a cargar', 'Cerrar'],
      title: 'ARKEN CONTROL',
      message: 'ARKEN CONTROL se detuvo de forma inesperada.',
      detail: 'Los datos guardados hasta el último cambio se conservan.',
    });
    if (r === 0) ventana.reload();
    else {
      puedeCerrar = true;
      ventana.close();
    }
  });

  // Al cerrar: el programa termina de guardar y luego se cierra la ventana
  ventana.on('close', (e) => {
    guardarEstadoVentana();
    if (puedeCerrar) return;
    e.preventDefault();
    ventana.webContents.send('arken:cerrar');
    clearTimeout(espera);
    espera = setTimeout(() => {
      puedeCerrar = true;
      if (ventana) ventana.close();
    }, 6000);
  });
  ipcMain.removeAllListeners('arken:listo-para-cerrar');
  ipcMain.on('arken:listo-para-cerrar', (e) => {
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

/** Solo se navega dentro de la app; los enlaces externos se abren en el sistema. */
function protegerContenido(contenido) {
  contenido.setWindowOpenHandler(({ url }) => {
    if (url === '' || url === 'about:blank' || url.startsWith('blob:' + ORIGEN)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 850,
          autoHideMenuBar: true,
          backgroundColor: '#FFFFFF',
          webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, plugins: true },
        },
      };
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
  if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(url)) shell.openExternal(url);
}

/* ─────────────  Permisos y descargas  ───────────── */
function configurarSesion(ses) {
  const PERMITIDOS = new Set(['media', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'fileSystem']);
  const esNuestro = (url) => String(url || '').startsWith(ORIGEN);
  ses.setPermissionRequestHandler((_wc, permiso, responder, detalle) =>
    responder(PERMITIDOS.has(permiso) && esNuestro(detalle.requestingUrl || detalle.securityOrigin)),
  );
  ses.setPermissionCheckHandler((_wc, permiso, origen) => PERMITIDOS.has(permiso) && esNuestro(origen));
  ses.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({
      title: 'Guardar archivo',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    });
  });
}

/* ─────────────  Copia interna y copias diarias  ───────────── */
function registrarIPC() {
  const deLaApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(ORIGEN + '/'));

  ipcMain.handle('arken:copia:meta', async (e) => {
    if (!deLaApp(e)) return null;
    try {
      return JSON.parse(await fsp.readFile(archivoMeta(), 'utf8'));
    } catch {
      return null;
    }
  });

  ipcMain.handle('arken:copia:leer', async (e) => {
    if (!deLaApp(e)) return null;
    for (const archivo of [archivoCopia(), archivoCopia() + '.tmp']) {
      try {
        return await fsp.readFile(archivo, 'utf8');
      } catch {}
    }
    return null;
  });

  let ultimaDiaria = 0;
  ipcMain.handle('arken:copia:guardar', async (e, texto, actualizado) => {
    if (!deLaApp(e) || typeof texto !== 'string' || !texto) return false;
    await fsp.mkdir(dirDatos(), { recursive: true });
    const tmp = archivoCopia() + '.tmp';
    await fsp.writeFile(tmp, texto, 'utf8');
    await fsp.rename(tmp, archivoCopia());
    await fsp.writeFile(archivoMeta(), JSON.stringify({ actualizado, caracteres: texto.length }), 'utf8');
    // Copia del día: se actualiza cada 10 minutos de trabajo; queda la última de cada día
    const ahora = Date.now();
    if (ahora - ultimaDiaria > 10 * 60 * 1000 || !fs.existsSync(archivoDiario(ahora))) {
      ultimaDiaria = ahora;
      await fsp.mkdir(dirDiarias(), { recursive: true });
      await fsp.copyFile(archivoCopia(), archivoDiario(ahora));
      await podarDiarias();
    }
    return true;
  });

  ipcMain.handle('arken:copia:borrar', async (e) => {
    if (!deLaApp(e)) return false;
    await fsp.rm(archivoMeta(), { force: true });
    await fsp.rm(archivoCopia(), { force: true });
    return true;
  });

  ipcMain.handle('arken:copias:abrir', async (e) => {
    if (!deLaApp(e)) return false;
    await fsp.mkdir(dirDiarias(), { recursive: true });
    await shell.openPath(dirDiarias());
    return true;
  });
}

function archivoDiario(ms) {
  const d = new Date(ms);
  const f = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  return path.join(dirDiarias(), `ARKEN_CONTROL_copia_${f}.json`);
}

async function podarDiarias() {
  const archivos = (await fsp.readdir(dirDiarias())).filter((n) => /^ARKEN_CONTROL_copia_\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const n of archivos.slice(0, Math.max(0, archivos.length - COPIAS_DIARIAS))) {
    await fsp.rm(path.join(dirDiarias(), n), { force: true });
  }
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
            label: 'ARKEN CONTROL',
            submenu: [
              { role: 'about', label: 'Acerca de ARKEN CONTROL' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar ARKEN CONTROL' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de ARKEN CONTROL' },
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
        {
          label: 'Abrir la carpeta de copias diarias',
          click: async () => {
            await fsp.mkdir(dirDiarias(), { recursive: true });
            shell.openPath(dirDiarias());
          },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(plantilla);
}
