// ARKEN PAY · pruebas del núcleo (reglas tributarias, facturas, recaudos, cartera y bitácora).
// Uso: node --test pruebas/nucleo.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const N = createRequire(import.meta.url)('../nucleo/arken-pay-nucleo.js');

const CUFE = (n) => n.toString(16).padStart(96, 'a');

/** Un libro de eventos en memoria, como el almacén real: sella, valida y aplica. */
function libro() {
  const estado = N.crearEstado();
  const eventos = [];
  let reloj = Date.parse('2026-01-02T15:00:00Z');
  return {
    estado,
    eventos,
    async emitir(tipo, datos, usuario = 'u_admin') {
      const ev = await N.sellarEvento(estado, { tipo, datos, usuario, fecha: new Date((reloj += 60000)).toISOString() });
      N.aplicar(estado, ev);
      eventos.push(ev);
      return ev;
    },
    async falla(tipo, datos, usuario, re) {
      const ev = await N.sellarEvento(estado, { tipo, datos, usuario });
      const antes = JSON.stringify(estado);
      assert.throws(() => N.aplicar(estado, ev), re);
      assert.equal(JSON.stringify(estado), antes, 'un evento rechazado no debe cambiar el estado');
    },
  };
}

async function base() {
  const L = libro();
  const clave = await N.derivarClave('ClaveSegura2026', null, 1000);
  await L.emitir('sistema.iniciado', { nombre: 'Prueba' }, '');
  await L.emitir('usuario.creado', { id: 'u_admin', usuario: 'admin', nombre: 'Admin', roles: ['administrador'], claveHash: clave }, '');
  await L.emitir('usuario.creado', { id: 'u_fac', usuario: 'fac', nombre: 'Facturación', roles: ['facturacion'], claveHash: clave });
  await L.emitir('usuario.creado', { id: 'u_tes', usuario: 'tes', nombre: 'Tesorería', roles: ['tesoreria'], claveHash: clave });
  await L.emitir('usuario.creado', { id: 'u_apr', usuario: 'apr', nombre: 'Contador', roles: ['aprobador'], claveHash: clave });
  await L.emitir('empresa.registrada', { id: 'e1', nit: '900123456', dv: 8, razonSocial: 'ARKEN SAS', icaPpm: N.aPpm('9,66', 'pormil') });
  await L.emitir('resolucion.registrada', { id: 'r1', empresaId: 'e1', numero: '18764000000001', fecha: '2025-12-01', prefijo: 'FE', desde: 1, hasta: 1000, vigenciaDesde: '2025-12-01', vigenciaHasta: '2027-12-01' }, 'u_fac');
  await L.emitir('cliente.registrado', { id: 'c1', tipoDocumento: 'NIT', documento: '860034313', dv: 7, razonSocial: 'Cliente Grande SA', retieneRenta: true, retieneIva: true, retieneIca: true, plazoDias: 30, granEmpresa: true }, 'u_fac');
  await L.emitir('cliente.registrado', { id: 'c2', tipoDocumento: 'CC', documento: '1020304050', razonSocial: 'Persona Natural', plazoDias: 0 }, 'u_fac');
  await L.emitir('proyecto.registrado', { id: 'p1', codigo: 'obr-01', nombre: 'Torre Norte', clienteId: 'c1', valorContratado: 100_000_000_00, garantiaPpm: 50000 }, 'u_fac');
  await L.emitir('proyecto.registrado', { id: 'p2', codigo: 'OBR-02', nombre: 'Casa', clienteId: 'c2' }, 'u_fac');
  return L;
}

const factura = (o = {}) => ({
  id: 'f' + (o.numero || 1),
  empresaId: 'e1',
  clienteId: 'c1',
  proyectoId: 'p1',
  resolucionId: 'r1',
  prefijo: 'FE',
  numero: 1,
  cufe: CUFE(o.numero || 1),
  fechaEmision: '2026-01-10',
  fechaVencimiento: '2026-02-09',
  items: [{ descripcion: 'Avance de obra', cantidadMil: 1000, valorUnitario: 10_000_000_00, ivaPpm: 190000 }],
  ...o,
});

test('dinero: conversión de formatos colombianos y redondeo', () => {
  assert.equal(N.aCentavos('$ 1.234.567,89'), 123456789);
  assert.equal(N.aCentavos('1.234.567'), 123456700);
  assert.equal(N.aCentavos('1234.5'), 123450);
  assert.equal(N.aCentavos('0,005'), 1); // mitad hacia arriba
  assert.equal(N.aCentavos('0,004'), 0);
  assert.equal(N.aCentavos('-150,25'), -15025);
  assert.equal(N.aCentavosXml('1190000.00'), 119000000);
  assert.throws(() => N.aCentavos('12a'));
  assert.equal(N.aplicarTarifa(100, 190000), 19); // 1 peso × 19 % = 19 centavos
  assert.equal(N.aplicarTarifa(150, 30000), 5); // 4,5 → 5 (mitad hacia arriba)
  assert.equal(N.aplicarTarifa(-150, 30000), -5);
  assert.equal(N.redondearAPeso(12345), 12300);
  assert.equal(N.redondearAPeso(12350), 12400);
  assert.equal(N.aPpm('19'), 190000);
  assert.equal(N.aPpm('9,66', 'pormil'), 9660);
  assert.equal(N.aPpm('0,966'), 9660);
  assert.equal(N.formatoPesos(123456789), '$ 1.234.567,89');
  assert.equal(N.formatoPesos(100000), '$ 1.000');
});

test('dígito de verificación DIAN', () => {
  assert.equal(N.digitoVerificacion('860034313'), 7);
  assert.equal(N.digitoVerificacion('900123456'), 8);
  assert.equal(N.digitoVerificacion('800197268'), 4); // DIAN
  assert.equal(N.digitoVerificacion('899999068'), 1);
});

test('cálculo de factura: IVA por ítem, descuentos y base AIU', () => {
  const c = N.calcularFactura([
    { descripcion: 'Costo directo', cantidadMil: 1000, valorUnitario: 80_000_000, ivaTipo: 'excluido' },
    { descripcion: 'Utilidad (AIU)', cantidadMil: 1000, valorUnitario: 5_000_000, ivaPpm: 190000 },
    { descripcion: 'Material', cantidadMil: 2500, valorUnitario: 33_333, descuento: 333, ivaPpm: 190000 },
  ]);
  assert.equal(c.subtotal, 80_000_000 + 5_000_000 + 83_333); // 2,5 × 333,33 = 833,325 → 833,33
  assert.equal(c.descuentos, 333);
  assert.equal(c.iva, 950_000 + N.aplicarTarifa(83_000, 190000));
  assert.equal(c.total, c.subtotal - c.descuentos + c.iva);
  assert.throws(() => N.calcularFactura([]), /al menos un ítem/);
  assert.throws(() => N.calcularFactura([{ valorUnitario: 100, descuento: 200 }]), /descuento supera/);
});

test('retenciones sugeridas según cliente, concepto y base mínima en UVT', async () => {
  const L = await base();
  const r = N.sugerirRetenciones(L.estado, { clienteId: 'c1', fecha: '2026-01-10', baseAntesIva: 10_000_000_00, iva: 1_900_000_00, conceptoRetencion: 'SERV-D', icaPpm: 9660 });
  assert.deepEqual(
    r.retenciones.map((x) => [x.tipo, x.valor]),
    [
      ['renta', 400_000_00],
      ['iva', 285_000_00],
      ['ica', 9_660_000],
    ],
  );
  // Base menor a 2 UVT de 2026 (2 × 52.374 = 104.748): no hay retención en la fuente
  const r2 = N.sugerirRetenciones(L.estado, { clienteId: 'c1', fecha: '2026-01-10', baseAntesIva: 100_000_00, iva: 0, conceptoRetencion: 'SERV-D' });
  assert.equal(r2.retenciones.length, 0);
  assert.match(r2.avisos[0], /no alcanza el mínimo/);
  // Cliente que no es agente retenedor
  assert.equal(N.sugerirRetenciones(L.estado, { clienteId: 'c2', fecha: '2026-01-10', baseAntesIva: 10_000_000_00, iva: 0, conceptoRetencion: 'SERV-D', icaPpm: 9660 }).retenciones.length, 0);
});

test('registro de factura: numeración, CUFE, proyecto y permisos', async () => {
  const L = await base();
  await L.falla('factura.registrada', factura({ numero: 1001, cufe: CUFE(9) }), 'u_fac', /fuera del rango autorizado/);
  await L.falla('factura.registrada', factura({ prefijo: 'XX' }), 'u_fac', /no corresponde a la resolución/);
  await L.falla('factura.registrada', factura({ proyectoId: 'p2' }), 'u_fac', /es de otro cliente/);
  await L.falla('factura.registrada', factura({ cufe: 'abc' }), 'u_fac', /CUFE/);
  await L.falla('factura.registrada', factura({ fechaEmision: '2025-11-01' }), 'u_fac', /no estaba vigente/);
  await L.falla('factura.registrada', factura(), 'u_tes', /no permite/);
  await L.falla('factura.registrada', factura(), 'u_admin', /no permite/);
  await L.falla('factura.registrada', factura({ totalesXml: { total: 1 } }), 'u_fac', /no cuadra/);
  await L.emitir('factura.registrada', factura(), 'u_fac');
  await L.falla('factura.registrada', factura({ id: 'otra' }), 'u_fac', /ya está registrada/);
  await L.falla('factura.registrada', factura({ id: 'otra', numero: 2, cufe: CUFE(1) }), 'u_fac', /CUFE ya está registrado/);
  const f = L.estado.facturas.f1;
  assert.equal(f.total, 11_900_000_00);
  assert.equal(N.estadoFactura(f, '2026-01-15'), 'registrada');
  assert.equal(N.estadoFactura(f, '2026-02-10'), 'vencida');
});

test('recaudo parcial con retenciones, saldo y cartera por edades', async () => {
  const L = await base();
  await L.emitir('factura.registrada', factura({ retencionGarantia: 500_000_00, fechaLiberacionGarantia: '2026-12-31' }), 'u_fac');
  // El cliente paga 5.000.000 y practica retenciones de renta 4 % e ICA
  await L.emitir(
    'recaudo.registrado',
    {
      id: 'rc1',
      clienteId: 'c1',
      fecha: '2026-02-01',
      valor: 5_000_000_00,
      cuenta: 'Bancolombia 123',
      referencia: 'TRX-1',
      aplicaciones: [{ facturaId: 'f1', valor: 5_000_000_00 }],
      retenciones: [
        { facturaId: 'f1', tipo: 'renta', base: 10_000_000_00, ppm: 40000, valor: 400_000_00 },
        { facturaId: 'f1', tipo: 'ica', base: 10_000_000_00, ppm: 9660, valor: 9_660_000 },
      ],
    },
    'u_tes',
  );
  const f = L.estado.facturas.f1;
  const t = N.totalesFactura(f);
  assert.equal(t.saldo, 11_900_000_00 - 5_000_000_00 - 400_000_00 - 9_660_000);
  assert.equal(t.garantiaPendiente, 500_000_00);
  assert.equal(N.estadoFactura(f, '2026-02-05'), 'con_abonos');
  // Cartera al 15 de marzo: el saldo exigible venció el 9 de febrero (34 días) y la garantía está por vencer
  const c = N.carteraPorEdades(L.estado, '2026-03-15');
  assert.equal(c.totales.d31_60, t.saldoExigible);
  assert.equal(c.totales.por_vencer, 500_000_00);
  assert.equal(c.totales.total, t.saldo);
  // Al corte del 20 de enero aún no había pago
  assert.equal(N.carteraPorEdades(L.estado, '2026-01-20').totales.total, 11_900_000_00);
  // Misma referencia bancaria → rechazo
  await L.falla('recaudo.registrado', { id: 'rc2', clienteId: 'c1', fecha: '2026-02-02', valor: 100, cuenta: 'Bancolombia 123', referencia: 'TRX-1', aplicaciones: [{ facturaId: 'f1', valor: 100 }] }, 'u_tes', /referencia/);
  // Aplicar más que el saldo → rechazo
  await L.falla('recaudo.registrado', { id: 'rc3', clienteId: 'c1', fecha: '2026-02-02', valor: 99_000_000_00, cuenta: 'B', aplicaciones: [{ facturaId: 'f1', valor: 99_000_000_00 }] }, 'u_tes', /su saldo es/);
  // Excedente sin destino → rechazo
  await L.falla('recaudo.registrado', { id: 'rc4', clienteId: 'c1', fecha: '2026-02-02', valor: 200, cuenta: 'B', aplicaciones: [{ facturaId: 'f1', valor: 100 }] }, 'u_tes', /sin aplicar/);
  // Pago del resto: la factura queda pagada
  await L.emitir('recaudo.registrado', { id: 'rc5', clienteId: 'c1', fecha: '2026-03-01', valor: t.saldo, cuenta: 'B', aplicaciones: [{ facturaId: 'f1', valor: t.saldo }] }, 'u_tes');
  assert.equal(N.estadoFactura(f, '2026-03-02'), 'pagada');
  assert.equal(N.carteraPorEdades(L.estado, '2026-03-02').totales.total, 0);
});

test('reversión con doble control y período cerrado', async () => {
  const L = await base();
  await L.emitir('factura.registrada', factura(), 'u_fac');
  await L.emitir('recaudo.registrado', { id: 'rc1', clienteId: 'c1', fecha: '2026-01-20', valor: 1_000_000_00, cuenta: 'B', aplicaciones: [{ facturaId: 'f1', valor: 1_000_000_00 }] }, 'u_tes');
  await L.falla('recaudo.reversado', { recaudoId: 'rc1', motivo: 'error', fecha: '2026-01-21' }, 'u_tes', /no permite/);
  await L.emitir('periodo.cerrado', { periodo: '2026-01' }, 'u_apr');
  await L.falla('recaudo.reversado', { recaudoId: 'rc1', motivo: 'Valor errado', fecha: '2026-01-21' }, 'u_apr', /está cerrado/);
  await L.falla('recaudo.registrado', { id: 'rc2', clienteId: 'c1', fecha: '2026-01-25', valor: 100, cuenta: 'B', aplicaciones: [{ facturaId: 'f1', valor: 100 }] }, 'u_tes', /está cerrado/);
  await L.emitir('recaudo.reversado', { recaudoId: 'rc1', motivo: 'Valor errado', fecha: '2026-02-01' }, 'u_apr');
  assert.equal(N.totalesFactura(L.estado.facturas.f1).saldo, 11_900_000_00);
  await L.falla('recaudo.reversado', { recaudoId: 'rc1', motivo: 'otra vez', fecha: '2026-02-01' }, 'u_apr', /ya fue reversado/);
});

test('notas crédito, débito y anulación', async () => {
  const L = await base();
  await L.emitir('factura.registrada', factura(), 'u_fac');
  await L.falla('nota.registrada', { id: 'n0', clase: 'credito', facturaId: 'f1', numero: 1, cude: CUFE(100), fecha: '2026-01-15', concepto: '9', valor: 100 }, 'u_fac', /Concepto/);
  await L.emitir('nota.registrada', { id: 'n1', clase: 'credito', facturaId: 'f1', prefijo: 'NC', numero: 1, cude: CUFE(101), fecha: '2026-01-15', concepto: '1', valor: 1_000_000_00 }, 'u_fac');
  await L.emitir('nota.registrada', { id: 'n2', clase: 'debito', facturaId: 'f1', prefijo: 'ND', numero: 1, cude: CUFE(102), fecha: '2026-01-16', concepto: '3', valor: 50_000_00 }, 'u_fac');
  assert.equal(N.totalesFactura(L.estado.facturas.f1).saldo, 11_900_000_00 - 1_000_000_00 + 50_000_00);
  await L.falla('nota.registrada', { id: 'n3', clase: 'credito', facturaId: 'f1', prefijo: 'NC', numero: 2, cude: CUFE(103), fecha: '2026-01-17', concepto: '2', valor: 1 }, 'u_fac', /por el total/);
  const saldo = N.totalesFactura(L.estado.facturas.f1).saldo;
  await L.emitir('nota.registrada', { id: 'n3', clase: 'credito', facturaId: 'f1', prefijo: 'NC', numero: 2, cude: CUFE(103), fecha: '2026-01-17', concepto: '2', valor: saldo }, 'u_fac');
  assert.equal(N.estadoFactura(L.estado.facturas.f1, '2026-03-01'), 'anulada');
  assert.equal(N.carteraPorEdades(L.estado, '2026-03-01').totales.total, 0);
});

test('anticipo: recaudo sin factura y amortización en la factura', async () => {
  const L = await base();
  await L.emitir('recaudo.registrado', { id: 'ant', clienteId: 'c1', proyectoId: 'p1', fecha: '2026-01-05', valor: 3_000_000_00, cuenta: 'B', aplicaciones: [], destinoExcedente: 'anticipo' }, 'u_tes');
  assert.equal(L.estado.saldosFavor.c1.porProyecto.p1, 3_000_000_00);
  await L.falla('factura.registrada', factura({ amortizacionAnticipo: 4_000_000_00 }), 'u_fac', /anticipo disponible/);
  await L.emitir('factura.registrada', factura({ amortizacionAnticipo: 3_000_000_00 }), 'u_fac');
  assert.equal(L.estado.saldosFavor.c1.porProyecto.p1, 0);
  assert.equal(N.totalesFactura(L.estado.facturas.f1).saldo, 8_900_000_00);
  // El anticipo ya usado no se puede reversar sin deshacer su aplicación
  await L.falla('recaudo.reversado', { recaudoId: 'ant', motivo: 'x', fecha: '2026-02-01' }, 'u_apr', /ya se usó/);
});

test('reclasificación de proyecto: solo un aprobador distinto a quien registró', async () => {
  const L = await base();
  await L.emitir('proyecto.registrado', { id: 'p3', codigo: 'OBR-03', nombre: 'Bodega', clienteId: 'c1' }, 'u_fac');
  await L.emitir('factura.registrada', factura(), 'u_fac');
  await L.falla('factura.reclasificada', { facturaId: 'f1', proyectoId: 'p3', motivo: 'Error' }, 'u_fac', /no permite/);
  await L.falla('factura.reclasificada', { facturaId: 'f1', proyectoId: 'p2', motivo: 'Error' }, 'u_apr', /mismo cliente/);
  await L.emitir('factura.reclasificada', { facturaId: 'f1', proyectoId: 'p3', motivo: 'Se digitó en el proyecto equivocado' }, 'u_apr');
  assert.equal(L.estado.facturas.f1.proyectoId, 'p3');
  assert.equal(L.estado.facturas.f1.reclasificaciones.length, 1);
});

test('bitácora encadenada: detecta alteraciones y huecos, y reconstruye igual', async () => {
  const L = await base();
  await L.emitir('factura.registrada', factura(), 'u_fac');
  const ok = await N.verificarCadena(L.eventos);
  assert.equal(ok.ok, true);
  const otro = N.reconstruir(L.eventos);
  assert.equal(JSON.stringify(otro.facturas), JSON.stringify(L.estado.facturas));
  const alterado = JSON.parse(JSON.stringify(L.eventos));
  alterado.at(-1).datos.items[0].valorUnitario = 1;
  assert.equal((await N.verificarCadena(alterado)).ok, false);
  const hueco = L.eventos.filter((e) => e.seq !== 5);
  assert.equal((await N.verificarCadena(hueco)).ok, false);
});

test('contraseñas PBKDF2', async () => {
  const h = await N.derivarClave('OtraClave123', null, 1000);
  assert.equal(await N.verificarClave('OtraClave123', h), true);
  assert.equal(await N.verificarClave('otraclave123', h), false);
  assert.throws(() => N.validarClaveNueva('corta1'), /10 caracteres/);
  assert.throws(() => N.validarClaveNueva('soloLetrasLargas'), /letras y números/);
});

test('reportes: proyectos, numeración, plazo legal y estado de cuenta', async () => {
  const L = await base();
  await L.emitir('factura.registrada', factura(), 'u_fac');
  await L.emitir('factura.registrada', factura({ numero: 3, cufe: CUFE(3) }), 'u_fac');
  const p = N.resumenProyectos(L.estado).find((x) => x.codigo === 'OBR-01');
  assert.equal(p.facturado, 2 * 11_900_000_00);
  assert.equal(p.porFacturar, 100_000_000_00 - 2 * 11_900_000_00);
  const num = N.controlNumeracion(L.estado, '2026-03-01')[0];
  assert.deepEqual(num.huecos, [2]);
  assert.equal(N.alertasPlazoLegal(L.estado, '2026-03-15').length, 2);
  const ec = N.estadoCuentaCliente(L.estado, 'c1');
  assert.equal(ec.filas.at(-1).saldo, 2 * 11_900_000_00);
  const s = N.sugerirAplicacion(L.estado, 'c1', 12_000_000_00);
  assert.deepEqual(s.aplicaciones.map((a) => a.valor), [11_900_000_00, 100_000_00]);
  const texto = N.csv([{ a: 'x;y', b: 1 }], [{ titulo: 'A', valor: 'a' }, { titulo: 'B', valor: (f) => f.b + 1 }]);
  assert.equal(texto, '﻿A;B\r\n"x;y";2');
});
