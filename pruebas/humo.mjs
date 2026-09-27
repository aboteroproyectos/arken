// ARKEN CONTROL · prueba de humo de www/ en Chromium.
//
// Abre la app en tres modos y recorre lo esencial:
//   web        el programa tal cual, como en un navegador (la capa de la app no actúa)
//   escritorio como en Windows/macOS, con el puente de Electron simulado
//   android    como en el celular, con los plugins de Capacitor simulados
// En cada modo: ingreso, cambio obligatorio de contraseña y sistema abierto. En los
// modos de app: copia interna y restauración si se pierde el almacenamiento. En
// Android: descargas, PDF en el visor, ventanas nuevas y enlaces externos.
//
// Uso: npm run preparar && npm run prueba

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');
if (!existsSync(join(WWW, 'index.html'))) {
  console.error('Falta www/. Ejecute primero: npm run preparar');
  process.exit(1);
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const servidor = createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const archivo = normalize(join(WWW, ruta === '/' ? 'index.html' : ruta));
  if (!archivo.startsWith(WWW) || !existsSync(archivo)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream' });
  res.end(readFileSync(archivo));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const URL_APP = `http://localhost:${servidor.address().port}/index.html`;

function rutaChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        if (existsSync(join(base, d, sub))) return join(base, d, sub);
      }
    }
  }
  return undefined;
}
const ejecutable = rutaChromium();
const navegador = await chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });

let fallas = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg);
  }
};

/* Simulaciones de la app, inyectadas antes de que cargue la página */
function simularEscritorio() {
  window.arkenEscritorio = {
    plataforma: 'windows',
    leerMetaCopia: () => window.__nodo('meta'),
    leerCopia: () => window.__nodo('leer'),
    guardarCopia: (texto, actualizado) => window.__nodo('guardar', texto, actualizado),
    borrarCopia: () => window.__nodo('borrar'),
    abrirCopias: () => Promise.resolve(true),
    alCerrar: (fn) => {
      window.__alCerrar = fn;
    },
    listoParaCerrar: () => {
      window.__listoParaCerrar = true;
    },
  };
}

function simularAndroid() {
  window.androidBridge = { postMessage() {} };
  const oyentes = {};
  window.__registro = { compartido: [], abiertos: [], oyentes };
  const fs = (op, ...args) => window.__fs(op, ...args);
  window.Capacitor = {
    Plugins: {
      Filesystem: {
        writeFile: (o) => fs('escribir', o, false),
        appendFile: (o) => fs('escribir', o, true),
        readFile: (o) => fs('leer', o),
        readFileInChunks: async (o, cb) => {
          const trozos = await fs('trozos', o);
          for (const data of trozos) cb({ data });
          cb({ data: '' });
          return 'id';
        },
        deleteFile: (o) => fs('borrar', o),
        rename: (o) => fs('renombrar', o),
        rmdir: (o) => fs('borrarCarpeta', o),
        mkdir: async () => {},
        getUri: async (o) => ({ uri: 'file:///simulado/' + o.directory + '/' + o.path }),
      },
      Share: {
        share: async (o) => {
          window.__registro.compartido.push(o);
          return {};
        },
      },
      App: {
        addListener: async (ev, fn) => {
          (oyentes[ev] = oyentes[ev] || []).push(fn);
          return { remove() {} };
        },
        minimizeApp: async () => {
          window.__registro.minimizada = true;
        },
      },
      AppLauncher: {
        openUrl: async ({ url }) => {
          window.__registro.abiertos.push(url);
          return { completed: true };
        },
      },
    },
  };
}

// Almacenes del lado de Node: sobreviven a las recargas de la página
function puenteEscritorio(contexto) {
  const copia = { texto: null, meta: null, escrituras: 0 };
  return contexto
    .exposeFunction('__nodo', (op, texto, actualizado) => {
      if (op === 'meta') return copia.meta;
      if (op === 'leer') return copia.texto;
      if (op === 'guardar') {
        copia.texto = texto;
        copia.meta = { actualizado, caracteres: texto.length };
        copia.escrituras++;
        return true;
      }
      if (op === 'borrar') {
        copia.texto = copia.meta = null;
        return true;
      }
      return null;
    })
    .then(() => copia);
}

function puenteAndroid(contexto) {
  const archivos = new Map();
  const clave = (o) => (o.directory || '') + '/' + o.path;
  return contexto
    .exposeFunction('__fs', (op, o, anexar) => {
      if (op === 'escribir') {
        const b = o.encoding === 'utf8' ? Buffer.from(o.data, 'utf8') : Buffer.from(o.data, 'base64');
        archivos.set(clave(o), anexar && archivos.has(clave(o)) ? Buffer.concat([archivos.get(clave(o)), b]) : b);
        return { uri: 'file:///simulado/' + clave(o) };
      }
      if (op === 'leer') {
        if (!archivos.has(clave(o))) throw new Error('No existe ' + clave(o));
        const b = archivos.get(clave(o));
        return { data: o.encoding === 'utf8' ? b.toString('utf8') : b.toString('base64') };
      }
      if (op === 'trozos') {
        if (!archivos.has(clave(o))) throw new Error('No existe ' + clave(o));
        const b = archivos.get(clave(o));
        const out = [];
        for (let i = 0; i < b.length; i += o.chunkSize) out.push(b.subarray(i, i + o.chunkSize).toString('base64'));
        return out;
      }
      if (op === 'borrar') {
        archivos.delete(clave(o));
        return {};
      }
      if (op === 'renombrar') {
        const de = (o.directory || '') + '/' + o.from;
        const a = (o.toDirectory || o.directory || '') + '/' + o.to;
        if (!archivos.has(de)) throw new Error('No existe ' + de);
        archivos.set(a, archivos.get(de));
        archivos.delete(de);
        return {};
      }
      if (op === 'borrarCarpeta') {
        for (const k of [...archivos.keys()]) if (k.startsWith((o.directory || '') + '/' + o.path + '/')) archivos.delete(k);
        return {};
      }
      return null;
    })
    .then(() => archivos);
}

async function abrir(pagina) {
  await pagina.goto(URL_APP);
  await pagina.waitForSelector('#gate', { state: 'visible', timeout: 30000 });
  await pagina.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
}

async function ingresar(pagina, usuario, clave, nuevaClave) {
  await pagina.fill('#gUser', usuario);
  await pagina.fill('#gPass', clave);
  await pagina.click('#gBtn');
  if (nuevaClave) {
    await pagina.waitForSelector('#ccA', { timeout: 30000 });
    await pagina.fill('#ccA', nuevaClave);
    await pagina.fill('#ccB', nuevaClave);
    await pagina.click('text=Cambiar y continuar');
  }
  await pagina.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
}

async function borrarAlmacenamiento(pagina) {
  await pagina.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => {
      const r = indexedDB.deleteDatabase('arken_control');
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
  });
}

async function modo(nombre, preparar) {
  console.log(`\n▸ Modo ${nombre}`);
  const contexto = await navegador.newContext({ viewport: nombre === 'android' ? { width: 412, height: 915 } : { width: 1366, height: 860 } });
  const errores = [];
  const extra = preparar ? await preparar(contexto) : null;
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => errores.push(e.message));
  await abrir(pagina);
  await ingresar(pagina, 'admin', 'arken', 'prueba123');
  ok(true, 'ingreso con admin, cambio obligatorio de contraseña y sistema abierto');
  const worker = await pagina.evaluate(() => (window.pdfjsLib ? pdfjsLib.GlobalWorkerOptions.workerSrc : ''));
  return { contexto, pagina, errores, extra, worker };
}

try {
  /* ── web ── */
  {
    const { contexto, pagina, errores, worker } = await modo('web');
    ok((await pagina.evaluate(() => typeof window.ArkenApp)) === 'undefined', 'la capa de la app no actúa en un navegador');
    ok(!/vendor\//.test(worker), 'en el navegador el lector de PDF queda como lo dejó el programa');
    ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await contexto.close();
  }

  /* ── escritorio ── */
  {
    const { contexto, pagina, errores, extra: copia, worker } = await modo('escritorio', async (ctx) => {
      await ctx.addInitScript(simularEscritorio);
      return puenteEscritorio(ctx);
    });
    ok(worker.endsWith('/vendor/pdf.worker.min.js'), 'el lector de PDF usa la copia local');
    ok((await pagina.textContent('#btnGuardar')).trim() === 'Guardar copia', 'botón «Guardar copia» en la barra');
    await pagina.evaluate(() => window.ArkenApp.guardarTodo());
    ok(copia.escrituras > 0 && JSON.parse(copia.texto).meta.app === 'ARKEN CONTROL', 'copia interna guardada');
    const plantilla = await pagina.evaluate(() => Documentos.componerArchivo());
    ok(
      plantilla.includes('src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"') &&
        !plantilla.includes('data-arken-app') &&
        !plantilla.includes('vendor/'),
      'la copia HTML que guarda la app funciona en cualquier navegador',
    );
    // Cierre ordenado
    await pagina.evaluate(() => window.__alCerrar());
    await pagina.waitForFunction(() => window.__listoParaCerrar === true, null, { timeout: 8000 });
    ok(true, 'al cerrar, la app guarda y avisa que puede salir');
    // Se pierde el almacenamiento del programa: la copia interna lo repone
    await borrarAlmacenamiento(pagina);
    await abrir(pagina);
    await ingresar(pagina, 'admin', 'prueba123');
    ok(true, 'restauración desde la copia interna (ingresa con la contraseña nueva)');
    // Panel de datos
    await pagina.evaluate(() => Admin.abrir('datos'));
    await pagina.waitForSelector('#adImp');
    ok((await pagina.textContent('#adImp')).includes('.html'), 'restaurar acepta .json o .html');
    ok(await pagina.isVisible('#adCopias'), 'botón para abrir las copias diarias');
    ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await contexto.close();
  }

  /* ── android ── */
  {
    const { contexto, pagina, errores, extra: archivos, worker } = await modo('android', async (ctx) => {
      await ctx.addInitScript(simularAndroid);
      return puenteAndroid(ctx);
    });
    ok((await pagina.evaluate(() => window.ArkenApp && window.ArkenApp.movil)) === true, 'la capa de la app detecta el celular');
    ok(worker.endsWith('/vendor/pdf.worker.min.js'), 'el lector de PDF usa la copia local');

    // Excel / respaldo: se entregan al menú Compartir
    await pagina.evaluate(() => UI.descargar('prueba.txt', 'hola', 'text/plain'));
    await pagina.waitForFunction(() => window.__registro.compartido.length > 0, null, { timeout: 5000 });
    const comp = await pagina.evaluate(() => window.__registro.compartido[0]);
    ok(
      comp.files && comp.files[0].endsWith('exportados/prueba.txt') && archivos.get('CACHE/exportados/prueba.txt').toString() === 'hola',
      'una descarga llega completa al menú Compartir',
    );

    // PDF: jsPDF «save» abre el visor con las páginas dibujadas
    await pagina.evaluate(() => {
      const d = new jspdf.jsPDF();
      d.text('ARKEN CONTROL', 20, 20);
      d.addPage();
      d.text('Página 2', 20, 20);
      d.save('prueba.pdf');
    });
    await pagina.waitForSelector('.arken-visor .arken-visor-pagina canvas', { timeout: 15000 });
    ok((await pagina.locator('.arken-visor-pagina').count()) === 2, 'el PDF se muestra en el visor (2 páginas)');
    await pagina.click('.arken-visor [data-accion="cerrar"]');

    // Ventana nueva con una imagen (vista previa de un soporte)
    await pagina.evaluate(() => {
      const w = window.open('', '_blank');
      w.document.write(
        '<title>foto.png</title><body style="margin:0"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="></body>',
      );
      w.document.close();
    });
    await pagina.waitForSelector('.arken-visor img.arken-visor-imagen', { timeout: 5000 });
    ok(true, 'una ventana nueva con una imagen se muestra en el visor');

    // «atrás» de Android cierra el visor y, sin nada abierto, minimiza
    await pagina.evaluate(() => window.__registro.oyentes.backButton.forEach((f) => f()));
    ok((await pagina.locator('.arken-visor').count()) === 0, '«atrás» cierra el visor');
    await pagina.evaluate(() => window.__registro.oyentes.backButton.forEach((f) => f()));
    ok(await pagina.evaluate(() => window.__registro.minimizada === true), '«atrás» en la pantalla principal minimiza la app');

    // WhatsApp y correo se abren en sus apps
    await pagina.evaluate(() => window.open('https://wa.me/573000000000?text=hola', '_blank'));
    ok((await pagina.evaluate(() => window.__registro.abiertos[0])) === 'https://wa.me/573000000000?text=hola', 'WhatsApp se abre en su app');

    // Imprimir un documento del programa: sale su PDF
    await pagina.evaluate(() =>
      Documentos.previsualizar({ nombre: 'ARKEN_prueba', titulo: 'PRUEBA', documento: 'Prueba', proyecto: null, bloques: [{ t: 'nota', txt: 'Hola' }] }),
    );
    await pagina.click('.modal-foot >> text=Imprimir');
    await pagina.waitForSelector('.arken-visor .arken-visor-pagina canvas', { timeout: 15000 });
    ok(true, '«Imprimir» muestra el PDF del documento');
    await pagina.click('.arken-visor [data-accion="cerrar"]');

    // Copia interna y restauración
    await pagina.evaluate(() => window.ArkenApp.guardarTodo());
    const copia = archivos.get('LIBRARY/arken/copia.json');
    ok(copia && JSON.parse(copia.toString('utf8')).meta.app === 'ARKEN CONTROL', 'copia interna guardada en el equipo');
    await borrarAlmacenamiento(pagina);
    await abrir(pagina);
    await ingresar(pagina, 'admin', 'prueba123');
    ok(true, 'restauración desde la copia interna del celular');

    // Restaurar desde un ARKEN_CONTROL.html con datos embebidos
    const html = await pagina.evaluate(() => Documentos.componerArchivo());
    const importado = await pagina.evaluate((h) => {
      Store.importarJSON(h);
      return S.meta.app;
    }, html);
    ok(importado === 'ARKEN CONTROL', 'restaurar acepta el ARKEN_CONTROL.html con datos embebidos');
    ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
    await contexto.close();
  }
} catch (e) {
  fallas++;
  console.error('\n✖ La prueba se detuvo: ' + (e && e.stack ? e.stack : e));
} finally {
  await navegador.close();
  servidor.close();
}

if (fallas) {
  console.error(`\n✖ ${fallas} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('\n✔ Todo en orden.');
