// ARKEN FOLDER · pruebas del núcleo, sin Electron:
//   · qué rutas puede ver el programa (accesos.cjs), con rutas de Windows y de Linux
//   · que una ruta con «..», otra unidad o un nombre parecido no se cuele
//   · el guardado del tablero (almacen.cjs): escritura segura, copia anterior y archivo dañado
//
// Uso: npm run prueba:nucleo

import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { crearAccesos } = require('../electron/accesos.cjs');
const { crearAlmacen, sanear } = require('../electron/almacen.cjs');

let fallas = 0, total = 0;
const ok = (cond, texto) => {
  total++;
  if (cond) console.log('  ✓ ' + texto);
  else { fallas++; console.error('  ✖ ' + texto); }
};
const seccion = (t) => console.log('\n' + t);

/* ─── Windows ─── */
seccion('Rutas de Windows');
const w = crearAccesos(path.win32);
ok(w.normalizar('c:\\Obras\\Casa 12\\') === 'C:\\Obras\\Casa 12', 'Normaliza la unidad en mayúscula y quita la barra final');
ok(w.normalizar('C:\\') === 'C:\\', 'La raíz de la unidad conserva su barra');
ok(w.estaDentro('C:\\obras\\casa 12\\Planos', 'C:\\Obras\\Casa 12'), 'Sin distinguir mayúsculas, una subcarpeta está dentro');
ok(!w.estaDentro('C:\\Obras\\Casa 120', 'C:\\Obras\\Casa 12'), '«Casa 120» no está dentro de «Casa 12»');
ok(!w.estaDentro('C:\\Obras\\Casa 12\\..\\Otra', 'C:\\Obras\\Casa 12'), 'Con «..» no se sale del acceso');
ok(!w.estaDentro('D:\\Obras\\Casa 12', 'C:\\Obras\\Casa 12'), 'Otra unidad no está dentro');
const supW = w.supercarpetas('C:\\Users\\Adolfo\\Obras\\Casa 12');
ok(JSON.stringify(supW) === JSON.stringify(['C:\\', 'C:\\Users', 'C:\\Users\\Adolfo', 'C:\\Users\\Adolfo\\Obras']), 'Supercarpetas de la unidad hacia abajo: ' + supW.join(' › '));
ok(w.nombre('C:\\') === 'C:', 'La unidad se llama «C:»');
ok(w.nombre('C:\\Obras\\Señora Ñañez') === 'Señora Ñañez', 'Nombres con tildes y «ñ»');

const accesoW = [{ ruta: 'C:\\Users\\Adolfo\\Obras\\Casa 12', supercarpetas: true, tope: null }];
ok(w.permiso('C:\\Users\\Adolfo\\Obras\\Casa 12\\Planos\\A-01.dwg', accesoW).como === 'dentro', 'Un archivo en una subcarpeta profunda: permitido');
ok(w.permiso('C:\\Users\\Adolfo\\Obras', accesoW).como === 'super', 'La supercarpeta: permitida');
ok(w.permiso('C:\\Windows\\System32', accesoW).permitido, 'Con la unidad como supercarpeta visible, lo demás de la unidad se ve');
ok(!w.permiso('D:\\Contabilidad', accesoW).permitido, 'Otra unidad: sin permiso');
const conTope = [{ ...accesoW[0], tope: 'C:\\Users\\Adolfo' }];
ok(w.permiso('C:\\Users\\Adolfo\\Documentos', conTope).permitido, 'Con tope en «Adolfo»: lo de «Adolfo» se ve');
ok(!w.permiso('C:\\Windows', conTope).permitido, 'Con tope en «Adolfo»: «C:\\Windows» ya no');
ok(!w.permiso('C:\\Users', conTope).permitido, 'Con tope en «Adolfo»: «C:\\Users» ya no');
ok(JSON.stringify(w.supercarpetasVisibles(conTope[0])) === JSON.stringify(['C:\\Users\\Adolfo', 'C:\\Users\\Adolfo\\Obras']), 'Supercarpetas visibles desde el tope');
const sinSup = [{ ...accesoW[0], supercarpetas: false }];
ok(!w.permiso('C:\\Users\\Adolfo\\Obras', sinSup).permitido, 'Sin supercarpetas: la carpeta que la contiene no se ve');
ok(w.permiso('C:\\Users\\Adolfo\\Obras\\Casa 12', sinSup).permitido, 'Sin supercarpetas: la carpeta sí');
ok(!w.permiso('', accesoW).permitido && !w.permiso(null, accesoW).permitido && !w.permiso('C:\\a\0b', accesoW).permitido, 'Rutas vacías o con caracteres nulos: sin permiso');
ok(!w.permiso('C:\\Users\\Adolfo\\Obras\\Casa 12', []).permitido, 'Sin accesos no se ve nada');
const red = w.supercarpetas('\\\\SERVIDOR\\Compartida\\Obras\\Casa 12');
ok(red[0] === '\\\\SERVIDOR\\Compartida\\' && red.length === 2, 'Carpetas de red: la supercarpeta más alta es la carpeta compartida');

/* ─── Linux / macOS ─── */
seccion('Rutas de Linux y macOS');
const l = crearAccesos(path.posix);
ok(l.normalizar('/home/a/obras/') === '/home/a/obras', 'Normaliza');
ok(!l.estaDentro('/home/a/Obras/x', '/home/a/obras'), 'Distingue mayúsculas');
ok(JSON.stringify(l.supercarpetas('/home/a/obras')) === JSON.stringify(['/', '/home', '/home/a']), 'Supercarpetas');
ok(l.nombre('/') === '/', 'La raíz se llama «/»');
ok(!l.permiso('/home/a/obras/../../b', [{ ruta: '/home/a/obras', supercarpetas: false }]).permitido, 'Con «..» no se sale');

/* ─── Almacén ─── */
seccion('Guardado del tablero');
const dir = mkdtempSync(join(tmpdir(), 'arken-folder-'));
try {
  const al = crearAlmacen(dir);
  const vacio = al.leer();
  ok(Array.isArray(vacio.accesos) && !vacio.accesos.length && Array.isArray(vacio.tablero.tarjetas), 'Sin archivo, empieza vacío');
  const e1 = { ...vacio, accesos: [{ id: 'a1', ruta: '/x' }], tablero: { grupos: [{ id: 'g' }], tarjetas: [{ id: 't', ruta: '/x', grupo: 'g', nombre: 'Señal ñ' }], preferencias: { tema: 'oscuro' } } };
  al.guardar(e1);
  ok(al.leer().tablero.tarjetas[0].nombre === 'Señal ñ', 'Guarda y lee (con tildes)');
  ok(al.leer().accesos[0].supercarpetas === true, 'Un acceso incluye supercarpetas de fábrica');
  al.guardar({ ...e1, tablero: { ...e1.tablero, preferencias: { tema: 'claro' } } });
  ok(existsSync(join(dir, 'arken-folder.anterior.json')), 'Deja la versión anterior');
  ok(!existsSync(join(dir, 'arken-folder.json.tmp')), 'No deja el archivo temporal');
  writeFileSync(join(dir, 'arken-folder.json'), '{ esto no es json');
  ok(al.leer().tablero.preferencias.tema === 'oscuro', 'Si el archivo está dañado, usa la versión anterior');
  const s = sanear({ accesos: [{ ruta: 5 }, { id: 'b', ruta: '/b', supercarpetas: false }], tablero: { tarjetas: [{ id: 1 }, { id: 'z', ruta: '/z' }], preferencias: [] }, recientes: 'x' });
  ok(s.accesos.length === 1 && s.accesos[0].supercarpetas === false && s.tablero.tarjetas.length === 1 && !Array.isArray(s.tablero.preferencias) && Array.isArray(s.recientes), 'Descarta lo que no tiene la forma esperada');
  void readFileSync;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${total - fallas} de ${total} comprobaciones correctas.`);
if (fallas) process.exit(1);
