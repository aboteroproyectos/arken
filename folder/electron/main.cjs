// ARKEN FOLDER · app de escritorio para Windows.
//
// Un tablero personalizable con accesos directos a las carpetas a las que el usuario le da permiso,
// a todas sus subcarpetas y a sus supercarpetas. Muestra lo que hay dentro, con vista previa de
// imágenes, PDF, video, audio y texto, y abre cada cosa en el Explorador o en su programa.
//
//   · El programa (ui/) se sirve desde app://folder/ y no tiene acceso a Node ni al disco: cada
//     consulta pasa por este proceso, que solo responde por rutas que el usuario autorizó.
//   · Solo lee: nunca crea, cambia, mueve ni borra archivos del usuario.
//   · Nada sale a internet: la app cancela toda conexión fuera de ella.
//   · El tablero se guarda en %APPDATA%\ARKEN FOLDER (vea almacen.cjs).

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, protocol, screen, session, shell } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { crearAccesos } = require('./accesos.cjs');
const { crearAlmacen } = require('./almacen.cjs');

const NOMBRE = 'ARKEN FOLDER';
const ID_APP = 'com.aboteroproyectos.arkenfolder';
const ORIGEN = 'app://folder';
const ORIGEN_DATOS = 'app://datos';
const ESQUEMA_ARCHIVO = 'arkenarchivo';
const UI = path.join(__dirname, '..', 'ui');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.ogv': 'video/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
const IMAGENES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.avif']);

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
  { scheme: ESQUEMA_ARCHIVO, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } },
]);

const acc = crearAccesos();
let almacen = null;
let estado = null;
let ventana = null;
let vigilante = null;
const busquedas = new Map();

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

const carpetaDatos = () => app.getPath('userData');
const carpetaImagenes = () => path.join(carpetaDatos(), 'imagenes');
const archivoVentana = () => path.join(carpetaDatos(), 'ventana.json');

function iniciar() {
  if (process.platform === 'win32') app.setAppUserModelId(ID_APP);
  almacen = crearAlmacen(carpetaDatos());
  estado = almacen.leer();

  protocol.handle('app', servirApp);
  protocol.handle(ESQUEMA_ARCHIVO, servirArchivo);
  configurarSesion(session.defaultSession);
  registrarIPC();
  Menu.setApplicationMenu(crearMenu());
  crearVentana();
}

app.on('window-all-closed', () => app.quit());

/* ─────────────  Programa y archivos  ───────────── */
async function servirApp(req) {
  const url = new URL(req.url);
  let base;
  if (url.host === 'folder') base = UI;
  else if (url.host === 'datos') base = carpetaImagenes();
  else return new Response('No encontrado', { status: 404 });
  let ruta = decodeURIComponent(url.pathname);
  if (ruta === '/' || ruta === '') ruta = '/index.html';
  const archivo = path.join(base, ruta);
  const relativa = path.relative(base, archivo);
  if (!relativa || relativa.startsWith('..') || path.isAbsolute(relativa)) return new Response('Prohibido', { status: 403 });
  try {
    const datos = await fsp.readFile(archivo);
    return new Response(datos, { headers: { 'content-type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' } });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
}

/** arkenarchivo://f/?r=<ruta>: un archivo del usuario, solo si está dentro de un acceso. Soporta Range (video). */
async function servirArchivo(req) {
  const url = new URL(req.url);
  const ruta = url.searchParams.get('r');
  if (!ruta || !acc.permiso(ruta, estado.accesos).permitido) return new Response('Sin permiso', { status: 403 });
  let st;
  try {
    st = await fsp.stat(ruta);
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
  if (!st.isFile()) return new Response('No es un archivo', { status: 400 });
  const tipo = TIPOS[path.extname(ruta).toLowerCase()] || 'application/octet-stream';
  const comunes = { 'content-type': tipo, 'accept-ranges': 'bytes', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (tipo === 'image/svg+xml') comunes['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (rango && st.size > 0) {
    let inicio = rango[1] === '' ? Math.max(0, st.size - Number(rango[2])) : Number(rango[1]);
    let fin = rango[1] !== '' && rango[2] !== '' ? Number(rango[2]) : st.size - 1;
    fin = Math.min(fin, st.size - 1);
    if (inicio > fin) return new Response('', { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
    const flujo = Readable.toWeb(fs.createReadStream(ruta, { start: inicio, end: fin }));
    return new Response(flujo, {
      status: 206,
      headers: { ...comunes, 'content-length': String(fin - inicio + 1), 'content-range': `bytes ${inicio}-${fin}/${st.size}` },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(ruta)), { headers: { ...comunes, 'content-length': String(st.size) } });
}

/* ─────────────  Ventana  ───────────── */
function crearVentana() {
  const e = leerEstadoVentana();
  ventana = new BrowserWindow({
    ...e.limites,
    minWidth: 900,
    minHeight: 580,
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
      plugins: true, // visor de PDF de Chromium
      spellcheck: false,
      additionalArguments: ['--arken-folder-version=' + app.getVersion()],
    },
  });
  if (e.maximizada) ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  protegerContenido(ventana.webContents);
  ventana.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason === 'clean-exit' || !ventana) return;
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'error', buttons: ['Volver a cargar', 'Cerrar'], title: NOMBRE,
      message: 'ARKEN FOLDER se detuvo de forma inesperada.', detail: 'Su tablero guardado se conserva.',
    });
    if (r === 0) ventana.reload();
    else ventana.destroy();
  });
  ventana.on('close', guardarEstadoVentana);
  ventana.on('closed', () => {
    ventana = null;
    detenerVigilancia();
  });
  ventana.loadURL(ORIGEN + '/index.html');
}

function protegerContenido(contenido) {
  contenido.setWindowOpenHandler(() => ({ action: 'deny' }));
  contenido.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEN + '/')) e.preventDefault();
  });
  contenido.on('will-attach-webview', (e) => e.preventDefault());
}

function configurarSesion(ses) {
  const PERMITIDOS = new Set(['clipboard-sanitized-write', 'fullscreen']);
  const esNuestro = (url) => String(url || '').startsWith(ORIGEN);
  ses.setPermissionRequestHandler((_wc, permiso, responder, d) => responder(PERMITIDOS.has(permiso) && esNuestro(d.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permiso, origen) => PERMITIDOS.has(permiso) && esNuestro(origen));
  ses.webRequest.onBeforeRequest((d, responder) => {
    const u = d.url;
    const propio = u.startsWith(ORIGEN + '/') || u.startsWith(ORIGEN_DATOS + '/') || u.startsWith(ESQUEMA_ARCHIVO + '://') ||
      /^(blob|data|devtools|chrome-extension|chrome):/i.test(u);
    responder({ cancel: !propio });
  });
  ses.on('will-download', (e) => e.preventDefault());
}

/* ─────────────  Lo que el programa le puede pedir al computador  ───────────── */
function registrarIPC() {
  const deLaApp = (e) => !!(e.senderFrame && String(e.senderFrame.url).startsWith(ORIGEN + '/'));
  const manejar = (canal, fn) =>
    ipcMain.handle(canal, async (e, ...args) => {
      if (!deLaApp(e)) return { ok: false, error: 'Solo el programa de la app puede usar esta función.' };
      try {
        return { ok: true, valor: await fn(e, ...args) };
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err).slice(0, 600) };
      }
    });

  manejar('folder:estado', () => vistaEstado());
  manejar('folder:dar-acceso', () => darAcceso());
  manejar('folder:quitar-acceso', (_e, id) => quitarAcceso(id));
  manejar('folder:ajustar-acceso', (_e, id, cambios) => ajustarAcceso(id, cambios));
  manejar('folder:guardar', (_e, datos) => guardarTablero(datos));
  manejar('folder:listar', (_e, ruta, opciones) => listar(ruta, opciones));
  manejar('folder:subcarpetas', (_e, ruta) => subcarpetas(ruta));
  manejar('folder:info', (_e, rutas) => info(rutas));
  manejar('folder:texto', (_e, ruta) => leerTexto(ruta));
  manejar('folder:abrir', (_e, ruta) => abrir(ruta));
  manejar('folder:mostrar', (_e, ruta) => mostrarEnCarpeta(ruta));
  manejar('folder:copiar-ruta', (_e, ruta) => {
    clipboard.writeText(exigir(ruta));
    return true;
  });
  manejar('folder:buscar', (_e, id, texto, opciones) => buscar(id, texto, opciones));
  manejar('folder:cancelar-busqueda', (_e, id) => {
    const b = busquedas.get(id);
    if (b) b.cancelada = true;
    return true;
  });
  manejar('folder:vigilar', (e, ruta) => vigilar(e.sender, ruta));
  manejar('folder:elegir-imagen', () => elegirImagen());
  manejar('folder:exportar', () => exportar());
  manejar('folder:importar', () => importar());
  manejar('folder:abrir-datos', async () => {
    await shell.openPath(carpetaDatos());
    return true;
  });

  // Arrastrar un archivo del programa a otra aplicación (correo, WhatsApp, el escritorio…)
  ipcMain.on('folder:arrastrar', (e, ruta) => {
    if (!deLaApp(e)) return;
    try {
      const r = exigir(ruta);
      const icono = nativeImage.createFromPath(path.join(__dirname, '..', 'recursos', 'icono.png')).resize({ width: 48, height: 48 });
      e.sender.startDrag({ file: r, icon: icono });
    } catch {}
  });
}

/** La ruta normalizada, o un error si el usuario no dio acceso a ella. */
function exigir(ruta) {
  const p = acc.permiso(ruta, estado.accesos);
  if (!p.permitido) throw new Error('ARKEN FOLDER no tiene permiso para esa ruta. Dé acceso a la carpeta primero.');
  return acc.normalizar(ruta);
}

function vistaEstado() {
  return {
    accesos: estado.accesos.map((a) => ({
      ...a,
      nombre: acc.nombre(a.ruta),
      existe: fs.existsSync(a.ruta),
      supercarpetasTodas: acc.supercarpetas(a.ruta).map((r) => ({ ruta: r, nombre: acc.nombre(r) })),
      supercarpetasVisibles: acc.supercarpetasVisibles(a).map((r) => ({ ruta: r, nombre: acc.nombre(r) })),
    })),
    tablero: estado.tablero,
    recientes: estado.recientes,
    sistema: { plataforma: process.platform, separador: path.sep, version: app.getVersion() },
  };
}

function persistir() {
  estado = almacen.guardar(estado);
}

async function darAcceso() {
  const r = await dialog.showOpenDialog(ventana, {
    title: 'Dar acceso a una carpeta',
    buttonLabel: 'Dar acceso',
    properties: ['openDirectory', 'multiSelections', 'dontAddToRecent'],
  });
  if (r.canceled || !r.filePaths.length) return { nuevos: [], estado: vistaEstado() };
  const nuevos = [];
  for (const elegida of r.filePaths) {
    const ruta = acc.normalizar(elegida);
    if (estado.accesos.some((a) => acc.clave(a.ruta) === acc.clave(ruta))) continue;
    const acceso = { id: crypto.randomUUID(), ruta, supercarpetas: true, tope: null, agregado: new Date().toISOString() };
    estado.accesos.push(acceso);
    nuevos.push(acceso.id);
  }
  persistir();
  return { nuevos, estado: vistaEstado() };
}

function quitarAcceso(id) {
  estado.accesos = estado.accesos.filter((a) => a.id !== id);
  persistir();
  return vistaEstado();
}

function ajustarAcceso(id, cambios) {
  const a = estado.accesos.find((x) => x.id === id);
  if (!a) throw new Error('Ese acceso ya no existe.');
  if (typeof cambios.supercarpetas === 'boolean') a.supercarpetas = cambios.supercarpetas;
  if (cambios.tope === null) a.tope = null;
  else if (typeof cambios.tope === 'string') {
    const supers = acc.supercarpetas(a.ruta);
    if (!supers.some((s) => acc.clave(s) === acc.clave(acc.normalizar(cambios.tope)))) throw new Error('Esa carpeta no contiene al acceso.');
    a.tope = acc.normalizar(cambios.tope);
  }
  persistir();
  return vistaEstado();
}

function guardarTablero(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('Tablero inválido.');
  if (datos.tablero) estado.tablero = datos.tablero;
  if (Array.isArray(datos.recientes)) estado.recientes = datos.recientes;
  persistir();
  return true;
}

const OCULTOS_SISTEMA = new Set(['desktop.ini', 'thumbs.db', '$recycle.bin', 'system volume information', 'pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'dumpstack.log.tmp']);
const esOculto = (nombre) => nombre.startsWith('.') || nombre.startsWith('~$') || OCULTOS_SISTEMA.has(nombre.toLowerCase());

async function datosDe(dir, ent) {
  const ruta = path.join(dir, ent.name);
  const d = { nombre: ent.name, ruta, esCarpeta: ent.isDirectory(), ext: ent.isDirectory() ? '' : path.extname(ent.name).slice(1).toLowerCase(), oculto: esOculto(ent.name) };
  try {
    const st = await fsp.stat(ruta);
    d.esCarpeta = st.isDirectory();
    d.tamano = st.isDirectory() ? null : st.size;
    d.modificado = st.mtimeMs;
  } catch {
    d.inaccesible = true;
  }
  return d;
}

async function enLotes(lista, n, fn) {
  const salida = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) {
      const j = i++;
      salida[j] = await fn(lista[j]);
    }
  }));
  return salida;
}

async function listar(ruta, opciones = {}) {
  const r = exigir(ruta);
  const ents = await fsp.readdir(r, { withFileTypes: true });
  const MAX = 20000;
  let entradas = await enLotes(ents.slice(0, MAX), 32, (ent) => datosDe(r, ent));
  if (!opciones.ocultos) entradas = entradas.filter((x) => !x.oculto);
  const padre = path.dirname(r);
  return {
    ruta: r,
    nombre: acc.nombre(r),
    padre: padre !== r && acc.permiso(padre, estado.accesos).permitido ? padre : null,
    migas: [...acc.supercarpetas(r), r].map((m) => ({ ruta: m, nombre: acc.nombre(m), permitido: acc.permiso(m, estado.accesos).permitido })),
    entradas,
    recortado: ents.length > MAX,
  };
}

async function subcarpetas(ruta) {
  const r = exigir(ruta);
  const ents = await fsp.readdir(r, { withFileTypes: true }).catch(() => []);
  const carpetas = [];
  for (const ent of ents) {
    if (esOculto(ent.name)) continue;
    let es = ent.isDirectory();
    if (!es && ent.isSymbolicLink()) es = await fsp.stat(path.join(r, ent.name)).then((s) => s.isDirectory(), () => false);
    if (es) carpetas.push({ nombre: ent.name, ruta: path.join(r, ent.name) });
  }
  carpetas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));
  return carpetas;
}

async function info(rutas) {
  if (!Array.isArray(rutas)) return [];
  return enLotes(rutas.slice(0, 2000), 16, async (ruta) => {
    const p = acc.permiso(ruta, estado.accesos);
    if (!p.permitido) return { ruta, permitido: false };
    try {
      const st = await fsp.stat(ruta);
      const d = { ruta, permitido: true, existe: true, esCarpeta: st.isDirectory(), tamano: st.isDirectory() ? null : st.size, modificado: st.mtimeMs };
      if (st.isDirectory()) {
        const ents = await fsp.readdir(ruta, { withFileTypes: true });
        d.carpetas = 0;
        d.archivos = 0;
        for (const e of ents) {
          if (esOculto(e.name)) continue;
          if (e.isDirectory()) d.carpetas++;
          else d.archivos++;
        }
      }
      return d;
    } catch {
      return { ruta, permitido: true, existe: false };
    }
  });
}

async function leerTexto(ruta) {
  const r = exigir(ruta);
  const MAX = 256 * 1024;
  const fh = await fsp.open(r, 'r');
  try {
    const st = await fh.stat();
    const buf = Buffer.alloc(Math.min(MAX, st.size));
    await fh.read(buf, 0, buf.length, 0);
    let texto = buf.toString('utf8');
    // Archivos de Windows en ANSI: si no es UTF-8 válido, se lee como Latin-1
    if (texto.includes('�')) texto = buf.toString('latin1');
    return { texto, recortado: st.size > MAX, tamano: st.size };
  } finally {
    await fh.close();
  }
}

const EJECUTABLES = new Set(['.exe', '.msi', '.bat', '.cmd', '.com', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.scr', '.pif', '.cpl', '.hta', '.jar', '.msc', '.reg', '.appx', '.msix']);

async function abrir(ruta) {
  const r = exigir(ruta);
  // Un programa se ejecuta solo si el usuario lo confirma en una ventana de Windows (no del programa)
  if (EJECUTABLES.has(path.extname(r).toLowerCase())) {
    const { response } = await dialog.showMessageBox(ventana, {
      type: 'warning', buttons: ['Ejecutar', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true, title: NOMBRE,
      message: '¿Ejecutar «' + path.basename(r) + '»?',
      detail: 'Es un programa o un archivo que ejecuta órdenes en el computador. Ejecútelo solo si sabe de dónde viene.\n\n' + r,
    });
    if (response !== 0) return false;
  }
  const error = await shell.openPath(r);
  if (error) throw new Error('Windows no pudo abrirlo: ' + error);
  return true;
}

function mostrarEnCarpeta(ruta) {
  shell.showItemInFolder(exigir(ruta));
  return true;
}

/** Busca por nombre dentro de «en» (o de todos los accesos), con todas sus subcarpetas. */
async function buscar(id, texto, opciones = {}) {
  const q = String(texto || '').trim();
  if (q.length < 2) return { resultados: [], completa: true };
  const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const partes = quitarTildes(q).split(/\s+/).filter(Boolean);
  const raices = opciones.en ? [exigir(opciones.en)] : estado.accesos.map((a) => a.ruta).filter((r) => fs.existsSync(r));
  const control = { cancelada: false };
  busquedas.set(id, control);
  const resultados = [];
  const MAX_RES = 500, MAX_VISTOS = 300000, MAX_MS = 20000;
  const inicio = Date.now();
  let vistos = 0;
  const cola = [...raices];
  const vistas = new Set();
  try {
    while (cola.length && !control.cancelada) {
      const dir = cola.shift();
      const k = acc.clave(dir);
      if (vistas.has(k)) continue;
      vistas.add(k);
      let ents;
      try {
        ents = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of ents) {
        if (esOculto(ent.name)) continue;
        vistos++;
        const ruta = path.join(dir, ent.name);
        if (ent.isDirectory()) cola.push(ruta);
        const n = quitarTildes(ent.name);
        if (partes.every((p) => n.includes(p))) {
          resultados.push({ nombre: ent.name, ruta, esCarpeta: ent.isDirectory(), ext: ent.isDirectory() ? '' : path.extname(ent.name).slice(1).toLowerCase(), carpeta: dir });
          if (resultados.length >= MAX_RES) return { resultados, completa: false, motivo: 'Se muestran los primeros 500 resultados.' };
        }
      }
      if (vistos > MAX_VISTOS || Date.now() - inicio > MAX_MS) return { resultados, completa: false, motivo: 'La búsqueda se detuvo para no tardar demasiado; precise el texto o busque dentro de una carpeta.' };
    }
    return { resultados, completa: !control.cancelada };
  } finally {
    busquedas.delete(id);
  }
}

function detenerVigilancia() {
  if (vigilante) {
    try { vigilante.close(); } catch {}
    vigilante = null;
  }
}

/** Avisa al programa cuando cambia la carpeta abierta, para que se actualice sola. */
function vigilar(remitente, ruta) {
  detenerVigilancia();
  if (!ruta) return true;
  const r = exigir(ruta);
  let espera = null;
  try {
    vigilante = fs.watch(r, { persistent: false }, () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        if (!remitente.isDestroyed()) remitente.send('folder:cambio', r);
      }, 350);
    });
    vigilante.on('error', detenerVigilancia);
  } catch {
    vigilante = null;
  }
  return true;
}

/** Una imagen propia (icono de tarjeta o fondo): se copia a la carpeta de la app. */
async function elegirImagen() {
  const r = await dialog.showOpenDialog(ventana, {
    title: 'Elegir una imagen',
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'ico'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const origen = r.filePaths[0];
  const ext = path.extname(origen).toLowerCase();
  if (!IMAGENES.has(ext)) throw new Error('Ese archivo no es una imagen.');
  const st = await fsp.stat(origen);
  if (st.size > 15 * 1024 * 1024) throw new Error('La imagen pesa más de 15 MB.');
  const datos = await fsp.readFile(origen);
  const nombre = crypto.createHash('sha256').update(datos).digest('hex').slice(0, 24) + ext;
  await fsp.mkdir(carpetaImagenes(), { recursive: true });
  await fsp.writeFile(path.join(carpetaImagenes(), nombre), datos);
  return ORIGEN_DATOS + '/' + nombre;
}

async function exportar() {
  const r = await dialog.showSaveDialog(ventana, {
    title: 'Guardar una copia del tablero',
    defaultPath: path.join(app.getPath('documents'), 'ARKEN_FOLDER_tablero.json'),
    filters: [{ name: 'Tablero de ARKEN FOLDER', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return false;
  await fsp.writeFile(r.filePath, JSON.stringify({ arkenFolder: 1, exportado: new Date().toISOString(), accesos: estado.accesos, tablero: estado.tablero }, null, 1));
  return true;
}

async function importar() {
  const r = await dialog.showOpenDialog(ventana, {
    title: 'Abrir una copia del tablero',
    properties: ['openFile'],
    filters: [{ name: 'Tablero de ARKEN FOLDER', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const datos = JSON.parse(await fsp.readFile(r.filePaths[0], 'utf8'));
  if (!datos || datos.arkenFolder !== 1) throw new Error('Ese archivo no es una copia del tablero de ARKEN FOLDER.');
  estado = almacen.guardar({ ...estado, accesos: datos.accesos, tablero: datos.tablero });
  return vistaEstado();
}

/* ─────────────  Tamaño y posición de la ventana  ───────────── */
function leerEstadoVentana() {
  const porDefecto = { limites: { width: 1400, height: 880 }, maximizada: false };
  try {
    const e = JSON.parse(fs.readFileSync(archivoVentana(), 'utf8'));
    const area = screen.getDisplayMatching(e.limites).workArea;
    const visible = e.limites.x < area.x + area.width - 100 && e.limites.y < area.y + area.height - 100 &&
      e.limites.x + e.limites.width > area.x + 100 && e.limites.y + e.limites.height > area.y + 50;
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

function crearMenu() {
  const enviar = (accion) => () => ventana && ventana.webContents.send('folder:menu', accion);
  return Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        { label: 'Dar acceso a una carpeta…', accelerator: 'CmdOrCtrl+O', click: enviar('dar-acceso') },
        { type: 'separator' },
        { label: 'Guardar una copia del tablero…', click: enviar('exportar') },
        { label: 'Abrir una copia del tablero…', click: enviar('importar') },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' },
        { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Buscar', accelerator: 'CmdOrCtrl+K', click: enviar('buscar') },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
    { label: 'Ayuda', submenu: [{ label: 'Abrir la carpeta donde se guarda el tablero', click: () => shell.openPath(carpetaDatos()) }] },
  ]);
}
