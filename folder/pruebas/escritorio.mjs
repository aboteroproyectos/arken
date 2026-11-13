// ARKEN FOLDER · la app de escritorio real (Electron), no simulada:
//
//   · abre el programa desde app://folder/ sin errores de JavaScript ni de la política de seguridad
//   · da acceso a una carpeta (con espacios, tildes y «ñ») y arma el tablero con la carpeta, sus
//     subcarpetas y sus supercarpetas
//   · explora todas las subcarpetas, con vista previa de texto, imagen y PDF
//   · busca por nombre en todas las subcarpetas
//   · no deja ver nada fuera de los accesos, ni por el puente ni por arkenarchivo://
//   · no modifica las carpetas del usuario: el árbol queda idéntico byte por byte
//   · pide confirmación antes de ejecutar un programa
//   · lo personalizado se conserva al cerrar y volver a abrir
//   · nada sale a internet
//
// Sin argumento abre la app desde esta carpeta; con la ruta de un ejecutable empacado
// (dist/linux-unpacked/arken-folder, dist/win-unpacked/arken-folder.exe) abre ese.
// En Linux sin pantalla, con xvfb-run. Con CAPTURAS=carpeta guarda capturas de pantalla.
//
// Uso: npm run prueba:escritorio [-- ruta/al/ejecutable]

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron } from 'playwright-core';

const require = createRequire(import.meta.url);
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..');
const empacada = process.argv[2];
const capturas = process.env.CAPTURAS;
const temporal = mkdtempSync(join(tmpdir(), 'arken-folder-prueba-'));

let fallas = 0, total = 0;
const ok = (cond, texto) => {
  total++;
  if (cond) console.log('  ✓ ' + texto);
  else { fallas++; console.error('  ✖ ' + texto); }
};
const seccion = (t) => console.log('\n' + t);

// Carpeta de prueba
const raiz = join(temporal, 'Mis Documentos', 'Proyectos Señor Ñañez');
const obra = join(raiz, 'Obra Casa 12');
const archivos = {
  'Planos/Arquitectónicos/A-01 Planta.dwg': 'AC1032 plano de prueba',
  'Planos/Estructurales/E-01.dxf': '0\nSECTION\n',
  'Fotos/avance.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64'),
  'Contratos/contrato.pdf': '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  'notas de obra.txt': 'Vaciado de placa: viernes.\nAcero: 3/8".',
  'instalar.exe': 'MZ falso',
  'Presupuesto 2026.xlsx': 'PK falso',
};
for (const [rel, contenido] of Object.entries(archivos)) {
  const ruta = join(obra, ...rel.split('/'));
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
}
mkdirSync(join(obra, 'Vacía'), { recursive: true });
writeFileSync(join(raiz, 'Fuera del acceso.txt'), 'hermana');
const afuera = join(temporal, 'afuera');
mkdirSync(afuera);
writeFileSync(join(afuera, 'secreto.png'), archivos['Fotos/avance.png']);
const tope = join(temporal, 'Mis Documentos');

function huella(dir) {
  const h = createHash('sha256');
  const recorrer = (d) => {
    for (const n of readdirSync(d).sort()) {
      const r = join(d, n);
      const st = statSync(r);
      h.update(r + '|' + st.isDirectory() + '|' + st.size + '|' + st.mtimeMs);
      if (st.isDirectory()) recorrer(r);
      else h.update(readFileSync(r));
    }
  };
  recorrer(dir);
  return h.digest('hex');
}
const huellaAntes = huella(join(temporal, 'Mis Documentos'));

const datos = join(temporal, 'datos de la app');
const lanzar = () => _electron.launch({
  executablePath: empacada || require('electron'),
  args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--user-data-dir=' + datos, ...(empacada ? [] : [FOLDER])],
  cwd: FOLDER,
  env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' },
  timeout: 60000,
});
const foto = async (w, nombre) => {
  if (!capturas) return;
  mkdirSync(capturas, { recursive: true });
  await w.waitForTimeout(250);
  await w.screenshot({ path: join(capturas, nombre + '.png') });
};

let app;
try {
  app = await lanzar();
  const w = await app.firstWindow({ timeout: 60000 });
  await w.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  const errores = [];
  w.on('pageerror', (e) => errores.push(e.message));
  w.on('console', (x) => { if (x.type() === 'error' || /Content Security Policy|Refused to/i.test(x.text())) errores.push(x.text()); });

  seccion('Arranque');
  await w.waitForLoadState('domcontentloaded');
  ok(w.url().startsWith('app://folder/'), 'La ventana abre el programa desde app://folder/');
  await w.waitForSelector('.bienvenida', { timeout: 30000 });
  ok(true, 'Sin carpetas, muestra la bienvenida');
  const version = await app.evaluate(({ app: a }) => a.getVersion());
  ok(version === require('../package.json').version, 'Versión ' + version);
  await foto(w, '01-bienvenida');

  seccion('Dar acceso');
  await app.evaluate(({ dialog }, ruta) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [ruta] }); }, obra);
  await w.click('#btnAcceso');
  await w.waitForSelector('.modal #cCarpeta');
  ok((await w.textContent('.modal')).includes('Sus subcarpetas (4)'), 'Ofrece las 4 subcarpetas');
  await foto(w, '02-agregar');
  // Para la prueba, las supercarpetas visibles empiezan en la carpeta temporal
  await w.click('.modal-pie .btn-brass');
  await w.waitForSelector('.tarjeta');
  const nT = await w.locator('.tarjeta').count();
  ok(nT >= 7, `El tablero tiene la carpeta, sus subcarpetas y sus supercarpetas (${nT} tarjetas)`);
  ok(await w.locator('.tarjeta.tam-l .t-nombre', { hasText: 'Obra Casa 12' }).count() === 1, 'La carpeta con acceso es una tarjeta grande');
  await w.waitForFunction(() => document.querySelector('.tarjeta.tam-l .t-meta')?.textContent.includes('carpetas'));
  const meta = (await w.textContent('.tarjeta.tam-l .t-meta')).replace(/\s+/g, ' ').trim();
  ok(/4 carpetas\s*·\s*3 archivos/.test(meta), 'Cuenta lo que hay dentro (4 carpetas, 3 archivos)');
  await w.waitForSelector('.tarjeta.tam-l .t-hijo');
  ok(await w.locator('.tarjeta.tam-l .t-hijo').count() === 4, 'La tarjeta grande muestra sus subcarpetas');
  ok(await w.locator('.acceso').count() === 1, 'El acceso aparece en la barra lateral');

  // El tope de las supercarpetas: «Mis Documentos» (para no recorrer el disco de quien prueba)
  const acceso = await w.evaluate(() => window.__arkenFolder.S.accesos[0]);
  await w.evaluate(async ([id, tope]) => { await window.arkenFolder.ajustarAcceso(id, { supercarpetas: true, tope }); }, [acceso.id, tope]);
  await foto(w, '03-tablero');

  seccion('Solo lo autorizado');
  const fuera = await w.evaluate(async (r) => { try { await window.arkenFolder.listar(r); return 'leyó'; } catch (e) { return e.message; } }, temporal);
  ok(/no tiene permiso/i.test(fuera), 'Por encima del tope: el puente no deja listar');
  const otra = await w.evaluate(async () => { try { await window.arkenFolder.texto('/etc/hostname'); return 'leyó'; } catch (e) { return e.message; } });
  ok(/no tiene permiso/i.test(otra), 'Un archivo del sistema: el puente no deja leerlo');
  const carga = (r) => w.evaluate((u) => new Promise((res) => { const i = new Image(); i.onload = () => res('cargó'); i.onerror = () => res('bloqueada'); i.src = u; }), 'arkenarchivo://f/?r=' + encodeURIComponent(r));
  ok((await carga(join(afuera, 'secreto.png'))) === 'bloqueada', 'arkenarchivo:// no entrega una imagen fuera del acceso');
  ok((await carga(join(obra, 'Fotos', 'avance.png'))) === 'cargó', 'arkenarchivo:// sí entrega una imagen del acceso');
  const hermana = await w.evaluate(async (r) => { try { return (await window.arkenFolder.texto(r)).texto; } catch (e) { return e.message; } }, join(raiz, 'Fuera del acceso.txt'));
  ok(hermana === 'hermana', 'Dentro de una supercarpeta visible sí se puede ver');

  seccion('Explorar');
  await w.click('.tarjeta.tam-l');
  await w.waitForSelector('.explorar .tabla');
  ok((await w.textContent('.migas')).includes('Obra Casa 12'), 'Abre la carpeta en Explorar');
  ok(await w.locator('.arbol .nodo-fila', { hasText: 'Planos' }).count() === 1, 'El árbol muestra las subcarpetas');
  await w.locator('.arbol .nodo-fila', { hasText: 'Planos' }).locator('[data-flecha]').click();
  await w.waitForSelector('.arbol .nodo-fila:has-text("Arquitectónicos")');
  ok(true, 'El árbol se abre en las subcarpetas de las subcarpetas');
  await w.locator('.tabla tr.fila', { hasText: 'notas de obra.txt' }).click();
  await w.waitForFunction(() => document.querySelector('.previa-marco pre')?.textContent.includes('Vaciado'));
  ok(true, 'Vista previa de texto');
  await foto(w, '04-explorar-texto');
  await w.locator('.tabla tr.fila', { hasText: 'Fotos' }).dblclick();
  await w.waitForSelector('.tabla tr.fila:has-text("avance.png")');
  await w.locator('.tabla tr.fila', { hasText: 'avance.png' }).click();
  const ancho = await w.waitForFunction(() => { const i = document.querySelector('.previa-marco img'); return i && i.complete && i.naturalWidth; }).then((h) => h.jsonValue());
  ok(ancho === 2, 'Vista previa de imagen (la imagen carga por arkenarchivo://)');
  await w.click('#xArriba');
  await w.locator('.tabla tr.fila', { hasText: 'Contratos' }).dblclick();
  await w.locator('.tabla tr.fila', { hasText: 'contrato.pdf' }).click();
  ok(await w.locator('.previa-marco iframe').count() === 1, 'Vista previa de PDF');
  await w.waitForTimeout(1200);
  await foto(w, '04b-pdf');
  await w.click('[data-modo="rejilla"]');
  ok(await w.locator('.cuadricula .celda').count() === 1, 'Vista de miniaturas');
  await w.click('[data-modo="lista"]');
  await w.click('.miga:has-text("Proyectos Señor Ñañez")');
  await w.waitForSelector('.tabla tr.fila:has-text("Fuera del acceso.txt")');
  ok(true, 'Se sube a la supercarpeta desde las migas');
  ok(await w.locator('.miga[disabled]').count() >= 1, 'Las carpetas por encima del tope aparecen sin acceso');

  seccion('Abrir archivos y programas');
  await app.evaluate(({ shell, dialog }) => {
    globalThis.__abiertos = [];
    shell.openPath = async (r) => { globalThis.__abiertos.push(r); return ''; };
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  await w.locator('.tabla tr.fila', { hasText: 'Obra Casa 12' }).dblclick();
  await w.locator('.tabla tr.fila', { hasText: 'Presupuesto 2026.xlsx' }).dblclick();
  await w.waitForTimeout(300);
  let abiertos = await app.evaluate(() => globalThis.__abiertos);
  ok(abiertos.length === 1 && abiertos[0].endsWith('Presupuesto 2026.xlsx'), 'Doble clic abre el archivo con su programa');
  await w.locator('.tabla tr.fila', { hasText: 'instalar.exe' }).dblclick();
  await w.waitForTimeout(300);
  abiertos = await app.evaluate(() => globalThis.__abiertos);
  ok(abiertos.length === 1, 'Un .exe no se ejecuta si el usuario cancela la confirmación');
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); });
  await w.locator('.tabla tr.fila', { hasText: 'instalar.exe' }).dblclick();
  await w.waitForTimeout(300);
  abiertos = await app.evaluate(() => globalThis.__abiertos);
  ok(abiertos.length === 2 && abiertos[1].endsWith('instalar.exe'), 'Con la confirmación, el programa se ejecuta');

  seccion('Buscar');
  await w.fill('#buscar', 'a-01 planta');
  await w.waitForSelector('#sugerencias .sug-item:has-text("A-01 Planta.dwg")', { timeout: 15000 });
  ok(true, 'Encuentra un archivo en una sub-subcarpeta, sin importar mayúsculas');
  await foto(w, '05-buscar');
  await w.press('#buscar', 'ArrowDown');
  await w.press('#buscar', 'Enter');
  await w.waitForSelector('.tabla tr.fila.sel:has-text("A-01 Planta.dwg")');
  ok(true, 'Elegir el resultado abre su carpeta con el archivo seleccionado');

  seccion('Personalizar');
  await w.click('.rail-btn[data-vista="tablero"]');
  const tFotos = w.locator('.tarjeta').filter({ has: w.locator('.t-nombre', { hasText: /^Fotos$/ }) });
  await tFotos.hover();
  await tFotos.locator('[data-ta="editar"]').click();
  await w.fill('#eNombre', 'Fotos de avance ñ');
  await w.click('.iconos-sel [data-icono="camara"]');
  await w.click('.colores-sel [data-color="#5B4B8A"]');
  await w.click('[data-op="tamano"] [data-v="xl"]');
  await w.click('.modal-pie .btn-brass');
  ok(await w.locator('.tarjeta.tam-xl .t-nombre', { hasText: 'Fotos de avance ñ' }).count() === 1, 'Nombre, icono, color y tamaño de una tarjeta');
  await w.click('#bGrupo');
  await w.fill('#gNombre', 'Favoritas de la semana');
  await w.click('.modal-pie .btn-brass');
  ok(await w.locator('.grupo h2', { hasText: 'Favoritas de la semana' }).count() === 1, 'Grupo nuevo');
  await w.click('#bPers');
  await w.fill('#pTitulo', 'Constructora de prueba');
  await w.click('[data-op="tema"] [data-v="oscuro"]');
  await w.click('[data-op="fondoTipo"] [data-v="degradado"]');
  await w.click('.modal-pie .btn-brass');
  ok(await w.evaluate(() => document.documentElement.dataset.tema) === 'oscuro', 'Tema oscuro');
  ok((await w.textContent('.cab h1')) === 'Constructora de prueba', 'Título del tablero');
  // Arrastrar una tarjeta al grupo nuevo
  {
    const origen = w.locator('.tarjeta').filter({ has: w.locator('.t-nombre', { hasText: /^Contratos$/ }) });
    const destino = w.locator('.grupo', { hasText: 'Favoritas de la semana' }).locator('.rejilla');
    await destino.scrollIntoViewIfNeeded();
    const a = await origen.boundingBox(), b = await destino.boundingBox();
    await w.mouse.move(a.x + a.width / 2, a.y + 20);
    await w.mouse.down();
    await w.mouse.move(a.x + a.width / 2 + 30, a.y + 40, { steps: 5 });
    await w.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await w.mouse.up();
    await w.waitForTimeout(200);
  }
  ok(await w.locator('.grupo', { hasText: 'Favoritas de la semana' }).locator('.t-nombre', { hasText: /^Contratos$/ }).count() === 1, 'Arrastrar una tarjeta a otro grupo');
  await foto(w, '06-personalizado');
  // El 403 de la imagen fuera del acceso es el que la prueba provocó a propósito
  const inesperados = errores.filter((e) => !/status of 403/.test(e));
  ok(!inesperados.length, 'Sin errores de JavaScript ni de la política de seguridad' + (inesperados.length ? ': ' + inesperados.slice(0, 3).join(' | ') : ''));

  seccion('Sin internet');
  const red = await w.evaluate(async () => { try { await fetch('https://example.com/', { mode: 'no-cors' }); return 'salió'; } catch { return 'bloqueada'; } });
  ok(red === 'bloqueada', 'Una petición a internet no sale');

  await w.waitForTimeout(700); // el tablero se guarda 350 ms después del último cambio
  await app.close();
  app = null;

  seccion('Al volver a abrir');
  app = await lanzar();
  const w2 = await app.firstWindow({ timeout: 60000 });
  await w2.waitForSelector('.tarjeta');
  ok(await w2.locator('.tarjeta.tam-xl .t-nombre', { hasText: 'Fotos de avance ñ' }).count() === 1, 'Se conserva la tarjeta personalizada');
  ok(await w2.evaluate(() => document.documentElement.dataset.tema) === 'oscuro', 'Se conserva el tema');
  ok(await w2.locator('.grupo', { hasText: 'Favoritas de la semana' }).locator('.t-nombre', { hasText: /^Contratos$/ }).count() === 1, 'Se conserva el orden y los grupos');
  await app.close();
  app = null;

  seccion('Las carpetas del usuario no cambiaron');
  ok(huella(join(temporal, 'Mis Documentos')) === huellaAntes, 'El árbol de carpetas y archivos queda idéntico (nombres, tamaños, fechas y contenido)');
  ok(readdirSync(raiz).includes('Obra Casa 12') && readdirSync(obra).includes('Fotos'), 'Cambiar el nombre de una tarjeta no cambia el de la carpeta');
} catch (err) {
  fallas++;
  console.error('✖ La prueba se detuvo: ' + (err.stack || err));
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(temporal, { recursive: true, force: true, maxRetries: 5 });
}

console.log(`\n${total - fallas} de ${total} comprobaciones correctas.`);
process.exit(fallas ? 1 : 0);
