// ARKEN PAY · prueba de la app de escritorio (Electron) con el almacén local.
// Abre la app con una carpeta de datos vacía, elige «Solo este equipo», crea el administrador,
// registra la empresa, cierra, vuelve a abrir y comprueba que los datos siguen ahí y que la
// bitácora en disco está encadenada.
// Uso: npm run prueba:escritorio  (en Linux sin pantalla: xvfb-run -a npm run prueba:escritorio)

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = createRequire(import.meta.url)('../nucleo/arken-pay-nucleo.js');
const datos = mkdtempSync(join(tmpdir(), 'arken-pay-'));
let app = null;
const binario = createRequire(import.meta.url)('electron');

async function abrir() {
  const app = await electron.launch({
    executablePath: binario,
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), RAIZ],
    env: { ...process.env, ARKEN_PAY_DATOS: datos, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
    timeout: 60000,
  });
  const ventana = await app.firstWindow();
  const errores = [];
  ventana.on('pageerror', (e) => errores.push(e.message));
  return { app, ventana, errores };
}

try {
  console.log('· Primera apertura: conexión local y administrador');
  let ventana, errores;
  ({ app, ventana, errores } = await abrir());
  await ventana.waitForSelector('#cxGuardar');
  assert.equal(await ventana.evaluate(() => window.arkenPay.escritorio), true);
  assert.equal(await ventana.evaluate(() => typeof require), 'undefined', 'el programa no tiene acceso a Node');
  await ventana.check('input[name=modo][value=local]');
  await ventana.click('#cxGuardar');
  await ventana.waitForSelector('#instalar');
  await ventana.fill('[name=nombre]', 'Adolfo');
  await ventana.fill('[name=usuario]', 'adolfo');
  await ventana.fill('[name=clave]', 'ArkenPay2026');
  await ventana.fill('[name=clave2]', 'ArkenPay2026');
  await ventana.click('#instalar');
  await ventana.waitForSelector('#codigoRec');
  await ventana.check('#codigoGuardado');
  await ventana.click('.modal [data-ok]');
  await ventana.waitForSelector('#fIngreso');
  await ventana.fill('#fIngreso [name=usuario]', 'adolfo');
  await ventana.fill('#fIngreso [name=clave]', 'ArkenPay2026');
  await ventana.click('#fIngreso button[type=submit]');
  await ventana.waitForSelector('#rail');
  await ventana.click('#rail [data-vista=configuracion]');
  await ventana.click('#nuevaEmpresa');
  await ventana.fill('.modal [name=nit]', '900123456');
  await ventana.fill('.modal [name=razonSocial]', 'ARKEN PROYECTOS S.A.S.');
  await ventana.click('.modal [data-ok]');
  await ventana.waitForFunction(() => !document.querySelector('.velo'));
  assert.deepEqual(errores, []);
  await app.close();

  const lineas = readFileSync(join(datos, 'eventos.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lineas.length, 3, 'sistema.iniciado (con el código de recuperación), usuario.creado y empresa.registrada en disco');
  assert.equal((await N.verificarCadena(lineas)).ok, true, 'cadena de hashes en disco');

  console.log('· Segunda apertura: los datos siguen ahí');
  ({ app, ventana, errores } = await abrir());
  await ventana.waitForSelector('#fIngreso');
  await ventana.fill('#fIngreso [name=usuario]', 'adolfo');
  await ventana.fill('#fIngreso [name=clave]', 'ArkenPay2026');
  await ventana.click('#fIngreso button[type=submit]');
  await ventana.waitForSelector('#topEmpresa');
  assert.match(await ventana.textContent('#topEmpresa'), /ARKEN PROYECTOS/);
  assert.match(await ventana.textContent('#topCx'), /Solo este equipo/);

  console.log('· Nadie recuerda la contraseña: empezar de cero sin borrar los datos');
  await ventana.click('#btnSalir');
  await ventana.waitForSelector('#olvido');
  await ventana.click('#olvido');
  await ventana.fill('#confirmaCero', 'empezar de cero');
  await ventana.click('#empezarCero');
  await ventana.waitForSelector('#instalar');
  assert.deepEqual(errores, []);
  await app.close();
  const archivados = readdirSync(datos).filter((n) => /^eventos-archivado-.*\.jsonl$/.test(n));
  assert.equal(archivados.length, 1, 'la bitácora anterior queda archivada');
  assert.equal(readFileSync(join(datos, archivados[0]), 'utf8').trim().split('\n').length, 3, 'con sus 3 eventos');
  assert.equal(existsSync(join(datos, 'eventos.jsonl')), false);
  console.log('\n✔ App de escritorio probada.');
} catch (e) {
  console.error('\n✖ ' + (e.stack || e.message));
  process.exitCode = 1;
} finally {
  await app?.close().catch(() => {});
  rmSync(datos, { recursive: true, force: true });
}
