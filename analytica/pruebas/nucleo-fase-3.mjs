// ARKEN ANALYTICA · pruebas del núcleo de la Fase 3 (§18), en Node, contra cálculos hechos a mano.
//
//   · estadísticos robustos: mediana, MAD, z robusto, correlación, media geométrica
//   · costo empresa mínimo de la mano de obra (SMMLV, auxilio, prestaciones y seguridad social)
//   · cada método de evaluación económica, la TRM, las reglas de los ponderables y el desempate
//   · habilitación: subsanable, plazo vencido, valor bajo, versión anterior
//   · indicadores financieros, consorcio, experiencia en SMMLV, personal, días hábiles y ruta crítica
//   · las cinco ofertas de demostración: cada alerta esperada, con evidencia, y ninguna de más en Alfa
//   · posibles acuerdos: dos ofertas clonadas se señalan por APU, correlación y cifras
//   · el orden de elegibilidad completo, calculado a mano a partir de los totales
//
// Uso: npm run prueba:nucleo-fase-3

import { nucleo, marcador } from './comun.mjs';

const N = nucleo();
const { Util, Calculo, Demo, PlantillaCondiciones, Parametros, Estadistica, Presupuestal, Tecnico, Puntaje, Alertas, Motor, DemoOfertas, Paquete, Sobre } = N;
const m = marcador('Núcleo de la Fase 3');
const cerca = (a, b, tol = 0.005) => a !== null && a !== undefined && Math.abs(a - b) <= tol;

/* ── Estadística ── */
m.seccion('Estadísticos robustos');
m.ok(Estadistica.mediana([5, 1, 3]) === 3 && Estadistica.mediana([4, 1, 3, 2]) === 2.5, 'Mediana con número impar y par de datos');
m.ok(Estadistica.mad([1, 2, 3, 4, 100], 3) === 1, 'MAD de [1, 2, 3, 4, 100] = 1 (mediana de 2, 1, 0, 1, 97)');
m.ok(cerca(Estadistica.zRobusto(100, 3, 1), 0.6745 * 97, 1e-9), 'z robusto de 100 = 0,6745 × 97 / 1 = 65,43');
m.ok(Estadistica.zRobusto(5, 5, 0) === null, 'Con MAD cero no hay z robusto (no se divide por cero)');
m.ok(cerca(Estadistica.pearson([1, 2, 3], [2, 4, 6]), 1, 1e-12) && cerca(Estadistica.pearson([1, 2, 3], [6, 4, 2]), -1, 1e-12), 'Correlación 1 y −1');
m.ok(cerca(Estadistica.mediaGeometrica([2, 8]), 4, 1e-12), 'Media geométrica de 2 y 8 = 4');

/* ── Costo empresa mínimo ── */
m.seccion('Mano de obra: costo empresa mínimo');
const P = Parametros.iniciales();
const ce = Parametros.costoEmpresaMinimo(P, '2026-11-01');
// SMMLV 1.750.905 + auxilio 249.095 = 2.000.000; cesantías 8,33 % e intereses 1 % y prima 8,33 % sobre 2.000.000;
// vacaciones 4,17 %, pensión 12 %, ARL 6,96 % y caja 4 % sobre el SMMLV.
const aMano = 2000000 + 166600 + 20000 + 166600 + 1750905 * (0.0417 + 0.12 + 0.0696 + 0.04);
m.ok(cerca(ce.mensual, aMano, 0.01) && cerca(ce.mensual, 2828220.53, 0.01), 'Mensual 2026 = ' + Util.money(ce.mensual) + ' (a mano 2.828.220,53)');
m.ok(ce.divisor === 210 && cerca(ce.hora, aMano / 210, 1e-6) && cerca(ce.jornal, aMano / 210 * 7, 1e-6), 'Hora = mensual ÷ 210 y jornal = 7 horas (Ley 2101 de 2021, desde julio de 2026)');
m.ok(Parametros.costoEmpresaMinimo(P, '2026-03-01').divisor === 220, 'Antes de julio de 2026 el divisor es 220');

/* ── Métodos económicos ── */
m.seccion('Evaluación económica, a mano: A = 900, B = 1.000, C = 1.100, presupuesto 1.200, 500 puntos');
const V = [{ id: 'A', valor: 900 }, { id: 'B', valor: 1000 }, { id: 'C', valor: 1100 }];
const c0 = { pmax: 500, presupuestoOficial: 1200, kBajo: 1, kAlto: 2 };
const eq = (r, e) => Object.keys(e).every((k) => cerca(r.puntajes[k], e[k], 0.005));
m.ok(eq(Puntaje.economico('menor', V, c0), { A: 500, B: 450, C: 409.09 }), 'Menor valor: 500 · 450 · 409,09');
m.ok(eq(Puntaje.economico('cercania', V, c0), { A: 416.67, B: 458.33, C: 500 }), 'Cercanía al presupuesto (Dmín = 100): 416,67 · 458,33 · 500');
m.ok(eq(Puntaje.economico('media', V, c0), { A: 450, B: 500, C: 400 }), 'Media aritmética (X̄ = 1.000): 450 · 500 · 400');
m.ok(eq(Puntaje.economico('mediaAlta', V, c0), { A: 428.57, B: 476.19, C: 452.38 }), 'Media aritmética alta (XA = 1.050): 428,57 · 476,19 · 452,38');
const G = Math.pow(1200 * 900 * 1000 * 1100, 1 / 4);
const pg = (v) => Math.round((v <= G ? 500 * (1 - (G - v) / G) : 500 * (1 - 2 * (v - G) / G)) * 100) / 100;
const geo = Puntaje.economico('geometrica', V, c0);
m.ok(cerca(geo.referencia, G, 1e-6) && eq(geo, { A: pg(900), B: pg(1000), C: pg(1100) }), 'Media geométrica con el presupuesto una vez (3 ofertas): G = ' + G.toFixed(2));
m.ok(Puntaje.vecesPO(3) === 1 && Puntaje.vecesPO(4) === 2 && Puntaje.vecesPO(7) === 3, 'El presupuesto entra 1 vez con 1 a 3 ofertas, 2 con 4 a 6, 3 con 7 a 9');
m.ok(Puntaje.metodoPorTrm(4123.10).metodo === 'media' && Puntaje.metodoPorTrm(4123.37).metodo === 'mediaAlta' && Puntaje.metodoPorTrm(4123.60).metodo === 'geometrica' && Puntaje.metodoPorTrm(4123.80).metodo === 'menor',
  'TRM: centavos 10 media, 37 media alta, 60 geométrica, 80 menor valor');
m.ok(eq(Puntaje.economico('trm', V, Object.assign({ trm: 4123.80 }, c0)), { A: 500, B: 450 }), 'Con TRM de centavos 80 se aplica el menor valor');
let sinTrm = false; try { Puntaje.economico('trm', V, c0); } catch (e) { sinTrm = /TRM/.test(e.message); }
m.ok(sinTrm, 'Sin TRM el método por TRM no calcula y lo dice');

m.seccion('Reglas de los ponderables y desempate');
const exp2 = { reglaPuntaje: { tipo: 'proporcional', criterio: 'Área construida' }, puntajeMaximo: 150 };
const rp = Puntaje.regla(exp2, { a: 2400, b: 1800 });
m.ok(rp.a === 150 && rp.b === 112.5, 'Proporcional al mejor: 2.400 → 150 y 1.800 → 112,5');
const rmenor = Puntaje.regla({ reglaPuntaje: { tipo: 'proporcional', criterio: 'Menor plazo' }, puntajeMaximo: 100 }, { a: 200, b: 250 });
m.ok(rmenor.a === 100 && rmenor.b === 80, 'Proporcional inversa cuando el criterio dice «menor»: 200 → 100 y 250 → 80');
const per01 = PlantillaCondiciones.anexoB().find((r) => r.codigo === 'PER-01');
const rr = Puntaje.regla(per01, { a: 6, b: 2, c: 1, d: 0 });
m.ok(rr.a === 60 && rr.b === 40 && rr.c === 20 && rr.d === 20, 'Por rangos (PER-01): 6 → 60, 2 → 40 (el límite entra en el rango de arriba), 1 → 20, 0 → 20');
m.ok(Puntaje.regla({ reglaPuntaje: { tipo: 'sino' }, puntajeMaximo: 40 }, { a: 'Sí', b: 'No' }).a === 40, 'Sí o no');
m.ok(Puntaje.regla({ reglaPuntaje: { tipo: 'formula', formula: 'pmax * vmin / v' }, puntajeMaximo: 100 }, { a: 50, b: 100 }).b === 50, 'Por fórmula, sin eval');
let malicioso = false; try { Puntaje.evaluarFormula('alert(1)', { v: 1 }); } catch (e) { malicioso = true; }
m.ok(malicioso, 'Una fórmula con algo distinto de números, operaciones y variables no se evalúa');
const reglasEmpate = ['Mayor puntaje en la evaluación económica.', 'Mayor puntaje técnico.', 'Sorteo en audiencia, con acta.'];
const o1 = Puntaje.orden([{ id: 'x', total: 800, economico: 400, tecnico: 400 }, { id: 'y', total: 800, economico: 450, tecnico: 350 }], reglasEmpate);
m.ok(o1.orden[0].id === 'y', 'Empate en total: gana el mayor puntaje económico');
const o2 = Puntaje.orden([{ id: 'x', total: 800, economico: 400, tecnico: 400 }, { id: 'y', total: 800, economico: 400, tecnico: 400 }], reglasEmpate);
m.ok(o2.empates.length === 1, 'Empate total sin sorteo: se informa el empate');
const o3 = Puntaje.orden([{ id: 'x', total: 800, economico: 400, tecnico: 400 }, { id: 'y', total: 800, economico: 400, tecnico: 400 }], reglasEmpate, ['y', 'x']);
m.ok(o3.orden[0].id === 'y' && !o3.empates.length, 'Con sorteo registrado, decide el sorteo');

m.seccion('Habilitación');
const reqH = [{ codigo: 'R1', nombre: 'Uno', naturaleza: 'habilitante', subsanable: true }, { codigo: 'R2', nombre: 'Dos', naturaleza: 'habilitante', subsanable: false }];
const hab = (fil, sub, extra) => Puntaje.habilitacion(Object.assign({ requisitos: reqH, ahora: '2026-11-20T10:00:00Z', vigente: (c) => fil[c] || null, subsanacion: (c) => (sub || {})[c] || null }, extra || {}));
m.ok(hab({ R1: { cumple: 'sí' }, R2: { cumple: 'no aplica' } }).estado === 'habilitada', 'Sí y no aplica: habilitada');
m.ok(hab({ R1: { cumple: 'sí' } }).estado === 'pendiente', 'Un habilitante sin verificar: pendiente');
m.ok(hab({ R1: { cumple: 'sí' }, R2: { cumple: 'subsanable' } }).estado === 'no habilitada', 'Subsanable en un requisito que el pliego no deja subsanar: no habilitada');
m.ok(hab({ R1: { cumple: 'subsanable' }, R2: { cumple: 'sí' } }, { R1: { plazo: '2026-11-18' } }).estado === 'no habilitada', 'No subsanó dentro del plazo: no habilitada');
m.ok(hab({ R1: { cumple: 'subsanable' }, R2: { cumple: 'sí' } }, { R1: { plazo: '2026-11-25' } }).estado === 'pendiente', 'Subsanación pedida y en plazo: pendiente');
m.ok(hab({ R1: { cumple: 'sí' }, R2: { cumple: 'sí' } }, null, { economico: { valorBajo: true, justificacion: { decision: 'rechazada' } } }).estado === 'no habilitada', 'Valor bajo con la justificación rechazada: no habilitada');
m.ok(hab({ R1: { cumple: 'sí' }, R2: { cumple: 'sí' } }, null, { versionAnterior: true }).estado === 'pendiente', 'Versión anterior del pliego sin decisión del comité: pendiente');

/* ── Financiero, experiencia, personal, programación ── */
m.seccion('Financiero');
const reqs = PlantillaCondiciones.anexoB();
const umb = Tecnico.umbralesFinancieros(reqs);
m.ok(umb.length === 6 && umb.find((u) => u.clave === 'liquidez').valor === 1.5 && umb.find((u) => u.clave === 'endeudamiento').op === '<=', 'Los seis umbrales salen de las reglas del pliego («Liquidez ≥ 1,5»…)');
const f1 = { activoCorriente: 300, pasivoCorriente: 200, activoTotal: 1000, pasivoTotal: 700, patrimonio: 300, utilidadOperacional: 60, gastosIntereses: 0 };
const fin = Object.fromEntries(Tecnico.financiero(f1, umb, 400).map((x) => [x.clave, x]));
m.ok(cerca(fin.liquidez.valorCalculado, 1.5, 1e-12) && fin.liquidez.cumple, 'Liquidez 300 / 200 = 1,5: cumple (el límite cumple)');
m.ok(cerca(fin.endeudamiento.valorCalculado, 0.7, 1e-12) && fin.endeudamiento.cumple === false, 'Endeudamiento 700 / 1.000 = 0,70 > 0,65: no cumple');
m.ok(fin.cobertura.cumple === true, 'Sin gastos de intereses la cobertura cumple (regla del pliego)');
m.ok(fin.capitalTrabajo.valorCalculado === 100 && fin.capitalTrabajo.limite === 80 && fin.capitalTrabajo.cumple, 'Capital de trabajo 100 frente al 20 % de 400 = 80: cumple');
m.ok(cerca(fin.rentPatrimonio.valorCalculado, 0.2, 1e-12) && cerca(fin.rentActivo.valorCalculado, 0.06, 1e-12), 'Rentabilidad del patrimonio 0,20 y del activo 0,06');
const cons = Tecnico.combinarConsorcio([{ porcentaje: 60, financiero: { activoCorriente: 100, pasivoCorriente: 50 } }, { porcentaje: 40, financiero: { activoCorriente: 200, pasivoCorriente: 150 } }]);
m.ok(cerca(cons.activoCorriente, 140, 1e-9) && cerca(cons.pasivoCorriente, 90, 1e-9), 'Consorcio 60/40: AC = 0,6 × 100 + 0,4 × 200 = 140; PC = 90');

m.seccion('Experiencia en SMMLV');
const exp1 = reqs.find((r) => r.codigo === 'EXP-01');
const re1 = Tecnico.reglasExperiencia(exp1);
m.ok(re1.maxContratos === 3 && re1.anios === 10 && re1.multiplo === 1.5, 'Reglas leídas de EXP-01: máximo 3 contratos, últimos 10 años, 1,5 veces');
const ex = Tecnico.experiencia([
  { contratante: 'Uno', valor: 1300000000, participacion: 50, terminacion: '2024-06-30', inicio: '2023-01-01' },
  { contratante: 'Dos', valor: 2000000000, participacion: 100, terminacion: '2022-03-31', inicio: '2021-01-01' },
  { contratante: 'Tres', valor: 908526000, participacion: 100, terminacion: '2021-12-31', inicio: '2021-01-01' },
  { contratante: 'Cuatro', valor: 5000000000, participacion: 100, terminacion: '2025-12-31', inicio: '2025-01-01' },
  { contratante: 'Cinco', valor: 5000000000, participacion: 100, terminacion: '2014-12-31', inicio: '2014-01-01' }
], re1, { fechaCierre: '2026-11-10', presupuestoOficial: 1750905000, parametros: P });
// 1.300.000.000 × 50 % / 1.300.000 = 500; 2.000.000.000 / 1.000.000 = 2.000; 908.526.000 / 908.526 = 1.000. Suma 3.500.
// Presupuesto 1.750.905.000 / 1.750.905 = 1.000 SMMLV; exigido 1,5 × 1.000 = 1.500.
m.ok(cerca(ex.suma, 3500, 1e-6) && cerca(ex.exigido, 1500, 1e-6) && ex.cumpleSuma, 'Suma 500 + 2.000 + 1.000 = 3.500 SMMLV frente a 1.500 exigidos');
m.ok(!ex.contratos[3].cuenta && /máximo/.test(ex.contratos[3].motivo), 'El cuarto contrato no cuenta: pasa del máximo, en el orden declarado');
m.ok(!ex.contratos[4].cuenta, 'El contrato terminado hace más de 10 años no cuenta');
const rep = Tecnico.experiencia([{ contratante: 'Uno', valor: 100, terminacion: '2024-01-01' }, { contratante: 'uno', valor: 100, terminacion: '2024-01-01' }], {}, { fechaCierre: '2026-11-10', parametros: P });
m.ok(rep.avisos.some((a) => a.tipo === 'repetido'), 'El mismo contrato dos veces se avisa');

m.seccion('Personal, días hábiles y ruta crítica');
const per = Tecnico.personal([{ cargo: 'Director de obra', anios: 8, dedicacion: 40, matricula: '' }], per01);
m.ok(per[0].faltas.length === 3, 'Director con 8 años, 40 % y sin matrícula: tres faltas (10 años, 50 %, matrícula)');
m.ok(Tecnico.diasLaborables('2026-12-07', '2026-12-12') === 5, 'Del lunes 7 al sábado 12 de diciembre de 2026: 5 días laborables (el 8 es festivo)');
const cpm = Tecnico.rutaCritica([{ clave: 'a', nombre: 'A', duracion: 3, predecesoras: [] }, { clave: 'b', nombre: 'B', duracion: 2, predecesoras: ['a'] },
  { clave: 'c', nombre: 'C', duracion: 5, predecesoras: ['a'] }, { clave: 'd', nombre: 'D', duracion: 1, predecesoras: ['b', 'c'] }]);
m.ok(cpm.duracion === 9 && cpm.critica.join() === 'A,C,D' && cpm.actividades.find((x) => x.clave === 'b').holgura === 3, 'Ruta crítica A → C → D de 9 días; B con 3 días de holgura');
m.ok(Tecnico.rutaCritica([{ clave: 'a', nombre: 'A', duracion: 1, predecesoras: ['b'] }, { clave: 'b', nombre: 'B', duracion: 1, predecesoras: ['a'] }]).ciclo, 'Dependencias en ciclo: se detectan');
m.ok(Tecnico.clasificarSgsst(59) === 'crítico' && Tecnico.clasificarSgsst(85) === 'moderadamente aceptable' && Tecnico.clasificarSgsst(86) === 'aceptable', 'SG-SST (Resolución 0312 de 2019): 59 crítico, 85 moderadamente aceptable, 86 aceptable');

/* ── Las cinco ofertas de demostración ── */
m.seccion('Las cinco ofertas de demostración');
const base = Demo.presupuesto();
const proceso = { id: 'p1', codigo: 'DEMO-2026-001', politicaApu: 'todas', plazoMaximoDias: 300, iva: { tarifa: 19, base: 'utilidad' }, general: {}, demo: true };
const invitados = Demo.invitados('p1');
const cierre = '2026-11-10T17:00:00.000Z';
const gen = DemoOfertas.generar({ proceso, base, requisitos: reqs, invitados, cierre, versionPliego: 1 });
m.ok(gen.length === 5 && gen.every((g) => g.oferta.demo && /^DEMO /.test(g.oferta.proponente.razonSocial) && /^999/.test(g.oferta.proponente.nit) && /\.invalid$/.test(g.oferta.proponente.correo)),
  'Cinco ofertas marcadas como demostración: «DEMO», NIT 999 y correos .invalid');
const ofertas = gen.map((g, i) => ({ id: 'of-' + g.clave, nombre: g.oferta.proponente.razonSocial, oferta: g.oferta, versionPliego: 1,
  documentos: g.documentos.map((d, j) => Object.assign({ id: 'd' + i + '-' + j, sha256: String(i) + j, meta: { legible: true, autor: d.autor } }, d)) }));
const datos = { proceso, base, requisitos: reqs, parametros: P, cierre, firma: '2026-12-15', ofertas, evaluaciones: [], subsanaciones: [], ahora: '2026-11-11T10:00:00Z' };
let R = Motor.analizar(datos);
const de = (id, tipo) => R.alertas.filter((a) => a.ofertas.indexOf('of-' + id) >= 0 && a.tipo === tipo);
m.ok(R.alertas.every((a) => a.evidencia.length > 0 && a.porque && a.accion && a.regla && a.clave), 'Cada alerta trae evidencia, por qué importa, la regla y qué hacer');
m.ok(R.alertas.filter((a) => a.ofertas.indexOf('of-alfa') >= 0).length === 0, 'Alfa, la oferta pareja, no tiene alertas');
m.ok(de('beta', 'desbalance').length === 1 && R.desbalance.indicador['of-beta'] > 3 * R.desbalance.indicador['of-alfa'], 'Beta: desbalanceada (indicador ' + (R.desbalance.indicador['of-beta'] * 100).toFixed(1) + ' % frente a ' + (R.desbalance.indicador['of-alfa'] * 100).toFixed(1) + ' % de Alfa)');
m.ok(de('beta', 'cargue al inicio').length === 1, 'Beta: precios cargados al inicio de la obra');
m.ok(!R.desbalance.marcadas.some((x) => x.ofertaId === 'of-gamma'), 'Gamma, toda más barata por igual, no queda desbalanceada (el z se mide frente al nivel de cada oferta)');
const vbG = R.valorBajo.filas.find((f) => f.id === 'of-gamma');
const tots = R.ofertas.map((o) => o.totales.total).sort((a, b) => a - b);
m.ok(de('gamma', 'valor bajo').length === 1 && cerca(vbG.desvMediana, vbG.total / tots[2] - 1, 1e-12) && vbG.desvMediana < -0.15, 'Gamma: valor artificialmente bajo, ' + (vbG.desvMediana * 100).toFixed(1) + ' % frente a la mediana de las cinco');
m.ok(de('gamma', 'mano de obra').length === 1 && /Ayudante/.test(de('gamma', 'mano de obra')[0].donde), 'Gamma: el ayudante por debajo del costo empresa mínimo');
m.ok(de('gamma', 'personal').length === 1, 'Gamma: el residente no tiene los años exigidos');
m.ok(de('delta', 'documento vencido').length === 1 && de('delta', 'documento vencido')[0].evidencia[0].tipo === 'documento', 'Delta: el certificado de existencia vencido, con el documento como evidencia');
const misma = R.alertas.filter((a) => a.tipo === 'colusión' && /misma persona/i.test(a.titulo));
m.ok(misma.length === 1 && misma[0].ofertas.sort().join() === 'of-delta,of-epsilon' && misma[0].recordatorio, 'Delta y Épsilon: el mismo director de obra, con el recordatorio de que no se acusa a nadie');
m.ok(de('epsilon', 'apu no suma').length === 1 && de('epsilon', 'apu no suma')[0].evidencia.length === 3, 'Épsilon: tres precios unitarios que no son la suma de su APU');
m.ok(de('epsilon', 'aritmética').length === 1, 'Épsilon: los totales declarados no cuadran');
m.ok(de('epsilon', 'financiero').length === 1 && /Endeudamiento/.test(de('epsilon', 'financiero')[0].titulo), 'Épsilon: endeudamiento por encima de 0,65');
m.ok(!R.alertas.some((a) => a.tipo === 'colusión' && a.objeto !== 'persona ' + misma[0].objeto.slice(8)), 'Ninguna otra coincidencia entre las cinco');
const claves = R.alertas.map((a) => a.clave);
m.ok(new Set(claves).size === claves.length && JSON.stringify(Motor.analizar(datos).alertas.map((a) => a.clave)) === JSON.stringify(claves), 'Las claves de las alertas son únicas y estables entre corridas');

m.seccion('Posibles acuerdos: una oferta clonada');
const clon = Object.assign({}, R.ofertas[0], { id: 'of-clon', nombre: 'DEMO Clon ficticio' });
const col = Alertas.colusion([R.ofertas[0], clon], base);
m.ok(col.some((a) => a.objeto === 'apu') && col.some((a) => a.objeto === 'correlación') && col.some((a) => a.objeto === 'cifras'), 'APU idénticos, precios que se mueven juntos y las mismas cifras');
m.ok(col.some((a) => a.objeto === 'contacto'), 'Los mismos datos de contacto');

m.seccion('Bandeja: el estado de una alerta se conserva');
const g1 = Alertas.mezclar([], R.alertas, '2026-11-11T10:00:00Z').map((x) => x.registro);
g1[0].estados.push({ estado: 'descartada', fecha: '2026-11-11T10:30:00Z', usuario: 'comite1', motivo: 'Revisado con el comité' });
const cambios = Alertas.mezclar(g1, R.alertas.slice(0, -1), '2026-11-11T11:00:00Z');
const guardadas = new Map(g1.map((g) => [g.clave, g]));
cambios.forEach((c) => guardadas.set(c.registro.clave, c.registro));
m.ok(g1.length === R.alertas.length && g1.every((g) => Alertas.estado(g) === 'nueva' || g === g1[0]), 'La primera corrida deja cada alerta como «nueva»');
m.ok(Alertas.estado(guardadas.get(g1[0].clave)) === 'descartada' && !cambios.some((c) => c.registro.clave === g1[0].clave), 'Al volver a correr el análisis, la alerta descartada sigue descartada');
const ultima = cambios.find((c) => c.registro.clave === claves[claves.length - 1]);
m.ok(cambios.length === 1 && ultima && ultima.cambio === 'ya no se presenta' && ultima.registro.vigente === false, 'La que ya no aparece queda marcada «ya no se presenta», sin borrarse');

/* ── Evaluación completa y orden de elegibilidad, a mano ── */
m.seccion('Evaluación completa y orden de elegibilidad');
const CALIF = { alfa: { 'SG-04': 18, 'TEC-01': 55, 'TEC-03': 45 }, beta: { 'SG-04': 15, 'TEC-01': 50, 'TEC-03': 40 }, gamma: { 'SG-04': 12, 'TEC-01': 40, 'TEC-03': 35 },
  delta: { 'SG-04': 16, 'TEC-01': 52, 'TEC-03': 42 }, epsilon: { 'SG-04': 14, 'TEC-01': 48, 'TEC-03': 38 } };
let sec = 0;
const evaluaciones = [];
R.ofertas.forEach((o) => {
  const c = o.id.slice(3);
  reqs.filter((r) => r.activo !== false).forEach((r) => {
    const s = R.sugerencias[o.id][r.codigo] || {};
    const e = { id: 'e' + (++sec), ofertaId: o.id, requisitoId: r.codigo, cumple: s.cumple || 'sí', fecha: '2026-11-12T10:00:00Z', secuencia: sec, observacion: s.motivo || '' };
    if (!r.obligatorio && !o.documentos.some((d) => d.requisito === r.codigo) && r.tipoRespuesta === 'documento') e.cumple = 'no aplica';
    if (s.valor !== null && s.valor !== undefined) e.valorVerificado = s.valor;
    if (r.codigo === 'TEC-05') e.valorVerificado = 60;
    if (CALIF[c][r.codigo] !== undefined) e.puntaje = CALIF[c][r.codigo];
    evaluaciones.push(e);
  });
});
const sugerido = (of, cod) => evaluaciones.find((e) => e.ofertaId === of && e.requisitoId === cod).cumple;
m.ok(sugerido('of-delta', 'JUR-02') === 'subsanable' && sugerido('of-epsilon', 'FIN-04') === 'no' && sugerido('of-gamma', 'PER-02') === 'subsanable', 'Lo sugerido: JUR-02 de Delta subsanable, FIN-04 de Épsilon no cumple, PER-02 de Gamma subsanable');
R = Motor.analizar(Object.assign({}, datos, { evaluaciones }));
const est = (id) => R.porOferta['of-' + id].habilitacion.estado;
m.ok(est('alfa') === 'habilitada' && est('beta') === 'habilitada' && est('epsilon') === 'no habilitada', 'Alfa y Beta habilitadas; Épsilon no habilitada por el endeudamiento');
m.ok(est('delta') === 'pendiente' && est('gamma') === 'pendiente' && R.puntaje.provisional, 'Delta y Gamma pendientes de subsanar y de justificar: el puntaje es provisional');
/* Delta subsana JUR-02 en plazo; Gamma subsana el residente y justifica el valor; el comité acepta. */
const subsanaciones = [
  { id: 's1', ofertaId: 'of-delta', requisito: 'JUR-02', tipo: 'requisito', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-13T09:00:00Z' } },
  { id: 's2', ofertaId: 'of-gamma', requisito: 'PER-02', tipo: 'requisito', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-13T09:00:00Z' } },
  { id: 's3', ofertaId: 'of-gamma', tipo: 'justificacion', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-14T09:00:00Z' }, decision: 'aceptada', motivo: 'Precios soportados con cotizaciones' }];
evaluaciones.push({ id: 'e' + (++sec), ofertaId: 'of-delta', requisitoId: 'JUR-02', cumple: 'sí', fecha: '2026-11-14T10:00:00Z', secuencia: sec, observacion: 'Certificado vigente aportado en la subsanación', ronda: 2 });
evaluaciones.push({ id: 'e' + (++sec), ofertaId: 'of-gamma', requisitoId: 'PER-02', cumple: 'sí', fecha: '2026-11-14T10:00:00Z', secuencia: sec, observacion: 'Reemplazo con 6 años', ronda: 2, valorVerificado: 0 });
R = Motor.analizar(Object.assign({}, datos, { evaluaciones, subsanaciones, ahora: '2026-11-15T10:00:00Z' }));
m.ok(['alfa', 'beta', 'gamma', 'delta'].every((x) => est(x) === 'habilitada') && !R.puntaje.provisional, 'Tras subsanar y aceptar la justificación, cuatro habilitadas y el puntaje es definitivo');
/* A mano: menor valor entre las cuatro habilitadas, más lo verificado de cada ponderable. */
const tot = Object.fromEntries(R.ofertas.map((o) => [o.id.slice(3), o.totales.total]));
const hab4 = ['alfa', 'beta', 'gamma', 'delta'];
const vmin = Math.min(...hab4.map((x) => tot[x]));
const r2 = (x) => Math.round(x * 100) / 100;
const AREA = { alfa: 2400, beta: 1800, gamma: 1500, delta: 3000 };
const DIR = { alfa: 60, beta: 40, gamma: 20, delta: 40 }, RES = { alfa: 30, beta: 40, gamma: 15, delta: 15 };
const SG = { alfa: 40 + 20 + 20, beta: 40 + 0 + 20, gamma: 40 + 0 + 0, delta: 40 + 20 + 20 };
const esperado = Object.fromEntries(hab4.map((x) => [x, r2(r2(500 * vmin / tot[x]) + r2(150 * AREA[x] / 3000) + DIR[x] + RES[x] + SG[x] + 40 + CALIF[x]['SG-04'] + CALIF[x]['TEC-01'] + CALIF[x]['TEC-03'])]));
const ordenMano = hab4.slice().sort((a, b) => esperado[b] - esperado[a]);
m.nota('A mano: ' + ordenMano.map((x) => x + ' ' + esperado[x]).join(' · '));
m.ok(R.puntaje.orden.map((f) => f.id.slice(3)).join() === ordenMano.join(), 'El orden de elegibilidad es el calculado a mano: ' + ordenMano.join(', '));
m.ok(R.puntaje.orden.every((f) => cerca(f.total, esperado[f.id.slice(3)], 0.011)), 'Cada total coincide con el calculado a mano');
m.ok(R.puntaje.noHabilitadas.join() === 'of-epsilon' && !R.puntaje.filas.some((f) => f.id === 'of-epsilon'), 'Épsilon no entra al orden ni a la evaluación económica');
m.ok(R.puntaje.sensibilidad.length > 0 && R.puntaje.sensibilidad.every((s) => s.mas && s.menos), 'Sensibilidad: cada grupo con ±10 %');

const metodos = ['menor', 'cercania', 'media', 'mediaAlta', 'geometrica'];
metodos.forEach((met) => {
  const Rm = Motor.analizar(Object.assign({}, datos, { proceso: Object.assign({}, proceso, { general: { metodoEconomico: met } }), evaluaciones, subsanaciones, ahora: '2026-11-15T10:00:00Z' }));
  const e = Puntaje.economico(met, hab4.map((x) => ({ id: 'of-' + x, valor: tot[x] })), { pmax: 500, presupuestoOficial: Calculo.totales(base).total, kBajo: 1, kAlto: 2 });
  m.ok(hab4.every((x) => cerca(Rm.puntaje.filas.find((f) => f.id === 'of-' + x).puntos['ECO-04'], e.puntajes['of-' + x], 1e-9)), 'Método ' + met + ': el puntaje económico del motor es el del método con las cuatro habilitadas');
});

m.terminar();
