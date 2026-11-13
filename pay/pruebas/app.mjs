// ARKEN PAY · prueba de la interfaz en Chromium, de punta a punta, con el anfitrión del navegador.
// Instala, crea usuarios, configura la empresa, registra un cliente, un proyecto, una factura y
// su pago, recorre todas las pantallas y verifica la bitácora. Falla ante cualquier error de la página.
// Uso: npm run prueba:app   (CHROME_PATH=/ruta/a/chrome para elegir el navegador)

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const WWW = join(dirname(fileURLToPath(import.meta.url)), '..', 'www');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const servidor = createServer((req, res) => {
  const ruta = join(WWW, new URL(req.url, 'http://x').pathname.replace(/^\/$/, '/index.html'));
  if (!ruta.startsWith(WWW) || !existsSync(ruta)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' }).end(readFileSync(ruta));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const URL_APP = `http://127.0.0.1:${servidor.address().port}/`;

const candidatos = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const ejecutable = candidatos.find((c) => existsSync(c));
const navegador = await chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

const paso = (t) => console.log('· ' + t);
const llenar = async (sel, valores) => {
  for (const [k, v] of Object.entries(valores)) {
    const el = pagina.locator(`${sel} [name="${k}"]`);
    const tipo = await el.evaluate((x) => x.tagName + ':' + (x.type || ''));
    if (tipo.startsWith('SELECT')) await el.selectOption(v);
    else if (tipo.endsWith(':checkbox')) await el.setChecked(v);
    else await el.fill(String(v));
  }
};
const modal = '.velo:last-of-type .modal';
const aceptar = async () => {
  await pagina.click(`${modal} [data-ok]`);
  await pagina.waitForFunction(() => !document.querySelector('.velo') || document.querySelector('.toast.bad'), null, { timeout: 15000 });
  const malo = await pagina.locator('.toast.bad').count();
  if (malo) throw new Error('La app rechazó la acción: ' + (await pagina.locator('.toast.bad').textContent()));
};
const ir = async (vista) => {
  await pagina.click(`#rail [data-vista="${vista}"]`);
  await pagina.waitForSelector(`#rail [data-vista="${vista}"].active`);
};
const ingresar = async (usuario, clave) => {
  await pagina.waitForSelector('#fIngreso');
  await llenar('#fIngreso', { usuario, clave });
  await pagina.click('#fIngreso button[type=submit]');
};

try {
  await pagina.goto(URL_APP);

  paso('Primer uso: administrador');
  await pagina.waitForSelector('#instalar');
  await llenar('.ingreso-caja', { nombre: 'Adolfo Botero', usuario: 'adolfo', clave: 'ArkenPay2026', clave2: 'ArkenPay2026' });
  await pagina.click('#instalar');
  await ingresar('adolfo', 'ArkenPay2026');
  await pagina.waitForSelector('#stage .page-head');

  paso('Configuración: empresa, resolución y usuario de facturación y tesorería');
  await ir('configuracion');
  await pagina.click('#nuevaEmpresa');
  await llenar(modal, { nit: '900123456', razonSocial: 'ARKEN PROYECTOS S.A.S.', ciiu: '7110', ica: '9,66' });
  assert.equal(await pagina.inputValue(`${modal} [name=dv]`), '8', 'dígito de verificación');
  await aceptar();
  await pagina.click('#nuevaRes');
  await llenar(modal, { numero: '18764000000001', fecha: '2026-01-10', prefijo: 'FE', desde: '1', hasta: '1000', vigenciaDesde: '2026-01-10', vigenciaHasta: '2028-01-10' });
  await aceptar();
  await pagina.click('#nuevoUsuario');
  await llenar(modal, { nombre: 'Ana Gómez', usuario: 'ana', clave: 'Temporal2026', rol_facturacion: true, rol_tesoreria: true });
  await aceptar();
  await pagina.click('#nuevoUsuario');
  await llenar(modal, { nombre: 'Carlos Ruiz', usuario: 'carlos', clave: 'Temporal2026', rol_aprobador: true });
  await aceptar();

  paso('Ingreso de Ana con cambio de contraseña obligatorio');
  await pagina.click('#btnSalir');
  await ingresar('ana', 'Temporal2026');
  await pagina.waitForSelector(`${modal} [name=c1]`);
  await llenar(modal, { c1: 'AnaSegura2026', c2: 'AnaSegura2026' });
  await aceptar();
  await pagina.waitForSelector('#stage .page-head');

  paso('Cliente agente retenedor y proyecto');
  await ir('clientes');
  await pagina.click('#nuevoCliente');
  await llenar(modal, { documento: '860034313', razonSocial: 'CONSTRUCTORA ANDINA S.A.', plazoDias: '45', retieneRenta: true, retieneIva: true, retieneIca: true, granEmpresa: true });
  assert.equal(await pagina.inputValue(`${modal} [name=dv]`), '7');
  await aceptar();
  await ir('proyectos');
  await pagina.click('#nuevoProyecto');
  await llenar(modal, { codigo: 'P-001', nombre: 'Diseño estructural Torre Norte', valorContratado: '100.000.000', garantia: '5' });
  await pagina.selectOption(`${modal} [name=clienteId]`, { label: 'CONSTRUCTORA ANDINA S.A.' });
  await aceptar();

  paso('Factura digitada con IVA y retenciones');
  await ir('facturas');
  await pagina.click('#nuevaFactura');
  await pagina.selectOption(`${modal} [name=clienteId]`, { label: 'CONSTRUCTORA ANDINA S.A.' });
  await llenar(modal, { numero: '1', cufe: 'a'.repeat(96), fechaEmision: '2026-11-03', fechaVencimiento: '2026-12-18' });
  await pagina.fill(`${modal} #itemsTabla [data-k=descripcion]`, 'Diseño estructural, avance 1');
  await pagina.fill(`${modal} #itemsTabla [data-k=valorUnitario]`, '10.000.000');
  await pagina.dispatchEvent(`${modal} #itemsTabla [data-k=valorUnitario]`, 'change');
  await pagina.click(`${modal} #sugerirRet`);
    const ret = (await pagina.locator(`${modal} #retTabla input`).evaluateAll((xs) => xs.map((x) => x.value))).join(' | ');
  const resumen = await pagina.textContent(`${modal} #resumenFactura`);
  if (process.env.VER) console.log(ret, resumen);
  assert.match(ret, /400\.000/, 'retención en la fuente 4 % (servicios, declarante, Decreto 572 de 2025)');
  assert.match(ret, /285\.000/, 'ReteIVA 15 % del IVA');
  assert.match(ret, /96\.600/, 'ReteICA 9,66 por mil');
  assert.match(resumen, /11\.900\.000/, 'total con IVA');
  assert.match(resumen, /Garantía retenida\$ -?500\.000|Garantía retenida.*500\.000/s, 'garantía 5 %');
  await aceptar();
  const filas = await pagina.locator('#tablaFacturas tbody tr').count();
  assert.equal(filas, 1);
  assert.match(await pagina.textContent('#tablaFacturas'), /FE1/);

  paso('Pago neto con retenciones desde el detalle de la factura');
  await pagina.click('#tablaFacturas tbody tr');
  await pagina.click(`${modal} [data-a=pago]`);
  await llenar(modal, { cuenta: 'Bancolombia 123-456789-00', referencia: 'TRF 991' });
  await aceptar();
  await ir('facturas');
  assert.match(await pagina.textContent('#tablaFacturas'), /Solo garantía pendiente/);
  const saldo = await pagina.textContent('#tablaFacturas tbody tr td:nth-child(7)');
  paso('  saldo después del pago: ' + saldo.trim() + ' (la garantía del 5 % queda pendiente)');
  assert.match(saldo, /500\.000/, 'queda la garantía de 5 % sobre la base');

  paso('Factura desde el XML de la DIAN (AttachedDocument con respuesta de validación)');
  await pagina.click('#nuevaFactura');
  await pagina.setInputFiles(`${modal} #xmlArchivo`, join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'FE2-attached.xml'));
  await pagina.waitForSelector(`${modal} #xmlMsg .aviso`);
  const msgXml = await pagina.textContent(`${modal} #xmlMsg`);
  assert.match(msgXml, /XML leído: factura FE2 por \$ 23\.800\.000/, msgXml);
  assert.equal(await pagina.inputValue(`${modal} [name=cufe]`), 'b'.repeat(96));
  assert.equal(await pagina.inputValue(`${modal} [name=ordenCompra]`), 'OC-7781');
  assert.equal(await pagina.inputValue(`${modal} [name=fechaVencimiento]`), '2026-12-25');
  await aceptar();
  assert.match(await pagina.textContent('#tablaFacturas'), /FE2/);
  assert.equal(await pagina.locator('#tablaFacturas tbody tr').count(), 2);

  paso('Recorrer todas las pantallas');
  for (const v of ['tablero', 'facturas', 'recaudos', 'cartera', 'proyectos', 'clientes', 'retenciones', 'conciliacion', 'reportes', 'bitacora', 'configuracion']) {
    await ir(v);
    const malo = await pagina.locator('#stage > .aviso.bad').count();
    assert.equal(malo, 0, `la pantalla ${v} mostró un error: ` + (malo ? await pagina.textContent('#stage > .aviso.bad') : ''));
  }
  if (process.env.CAPTURA) await pagina.screenshot({ path: process.env.CAPTURA });

  paso('Bitácora íntegra');
  await ir('bitacora');
  await pagina.click('#verificar');
  await pagina.waitForSelector('#verMsg .aviso');
  assert.match(await pagina.textContent('#verMsg'), /Integridad verificada/);

  paso('Control interno: Ana no puede reversar; Carlos (aprobador) sí, y no registra pagos');
  await ir('recaudos');
  assert.equal(await pagina.locator('[data-reversar]').count(), 0);
  await pagina.click('#btnSalir');
  await ingresar('carlos', 'Temporal2026');
  await pagina.waitForSelector(`${modal} [name=c1]`);
  await llenar(modal, { c1: 'CarlosSeguro2026', c2: 'CarlosSeguro2026' });
  await aceptar();
  await ir('recaudos');
  assert.equal(await pagina.locator('#nuevoRecaudo').count(), 0);
  await pagina.click('[data-reversar]');
  await llenar(modal, { motivo: 'Consignación devuelta por el banco' });
  await aceptar();
  assert.match(await pagina.textContent('#stage'), /Reversado/);

  assert.deepEqual(errores, [], 'errores en la página');
  console.log('\n✔ Interfaz de ARKEN PAY probada de punta a punta.');
} catch (e) {
  console.error('\n✖ ' + e.message);
  if (errores.length) console.error('Errores de la página:\n' + errores.join('\n'));
  if (process.env.CAPTURA) await pagina.screenshot({ path: process.env.CAPTURA.replace(/\.png$/, '-fallo.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await navegador.close();
  servidor.close();
}
