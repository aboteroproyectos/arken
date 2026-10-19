// ARKEN ANALYTICA · pruebas del núcleo de la Fase 4 (§19, §20, §21), en Node, sobre el
// proceso de demostración evaluado de punta a punta (pruebas/escenario-evaluacion.mjs):
//
//   · cuadro comparativo: cada nivel suma lo mismo que Calculo, la mediana y las desviaciones
//   · cuadro gerencial: orden, semáforo y recomendado solo con el concepto firmado
//   · las 15 gráficas: SVG bien formado, sin NaN ni undefined, con su número
//   · concepto: recomienda al primero del orden; los textos del comité reemplazan los generados
//   · informe: las 23 secciones, un requisito creado por el usuario entra con la suya y en el Excel
//     (§27.10); marca de agua mientras no esté firmado
//   · presupuesto adjudicado: el libro para ARKEN CONTROL da el mismo costo directo de la oferta,
//     aunque la oferta repita códigos de APU o descripciones de insumo con otro precio
//
// Uso: npm run prueba:nucleo-fase-4

import { nucleo, marcador } from './comun.mjs';
import { escenario } from './escenario-evaluacion.mjs';

const N = nucleo();
const { Util, Calculo, PlantillaCondiciones, Comparativo, Graficas, Concepto, Informe, ExcelArken } = N;
const m = marcador('Núcleo de la Fase 4');
const cerca = (a, b, tol = 0.01) => a !== null && a !== undefined && Math.abs(a - b) <= tol;

// Un requisito creado por el usuario, además del Anexo B
const ADI = Object.assign({}, PlantillaCondiciones.anexoB().find((r) => r.codigo === 'JUR-03'),
  { id: 'req-adi-01', codigo: 'ADI-01', grupo: 'Adicional', nombre: 'Visita de obra DEMO', descripcion: 'Requisito creado por el usuario para la prueba.' });
const { R } = escenario(N, { requisitos: PlantillaCondiciones.anexoB().concat([ADI]) });

/* ── Cuadro comparativo ── */
m.seccion('Cuadro comparativo');
const C = Comparativo.cuadro(R, { nivel: 'capitulo' });
m.ok(C.columnas.length === 5 && C.filas.length === R.ctx.base.capitulos.length, 'Cinco proponentes y un renglón por capítulo del presupuesto base');
m.ok(R.ofertas.every((o) => cerca(C.filas.reduce((t, f) => t + (f.celdas[o.id] ? f.celdas[o.id].valor : 0), 0), Calculo.costoDirecto(o.pres))),
  'Los capítulos de cada oferta suman su costo directo (Calculo)');
m.ok(cerca(C.filas.reduce((t, f) => t + f.base, 0), Calculo.costoDirecto(R.ctx.base)), 'Los capítulos del presupuesto base suman su costo directo');
const tot = C.pie.find((f) => f.clave === 'total');
m.ok(R.ofertas.every((o) => cerca(tot.celdas[o.id].valor, o.totales.total) && cerca(tot.celdas[o.id].pctBase, (o.totales.total - R.totalesBase.total) / R.totalesBase.total, 1e-9)),
  'El total de cada oferta y su desviación frente a la base');
const vs = R.ofertas.map((o) => o.totales.total).sort((a, b) => a - b);
m.ok(cerca(tot.mediana, vs[2]), 'La mediana de cinco totales es el tercero');
const CA = Comparativo.cuadro(R, { nivel: 'actividad' });
m.ok(R.ofertas.every((o) => cerca(CA.filas.filter((f) => f.tipo === 'act').reduce((t, f) => t + (f.celdas[o.id] ? f.celdas[o.id].valor : 0), 0), Calculo.costoDirecto(o.pres))),
  'Al nivel de actividad también suman el costo directo');
const CS = Comparativo.cuadro(R, { nivel: 'actividad', soloAlertas: true });
m.ok(CS.filas.filter((f) => f.tipo === 'act').length > 0 && CS.filas.filter((f) => f.tipo === 'act').every((f) => f.alerta), 'El filtro «solo con alertas» deja solo actividades con alerta');
const T = Comparativo.tabla(C, true);
m.ok(T.filas.every((f) => f.celdas.every((x) => typeof x !== 'number' || Number.isFinite(x))), 'La tabla plana para Excel y PDF no trae NaN ni infinitos');

/* ── Cuadro gerencial ── */
m.seccion('Cuadro gerencial');
const G = Comparativo.gerencial(R);
m.ok(G.filas.length === 5 && G.filas.filter((f) => f.puesto).every((f, i, a) => !i || a[i - 1].puesto < f.puesto), 'Los proponentes en el orden de elegibilidad');
m.ok(G.filas.every((f) => ['verde', 'amarillo', 'rojo'].includes(f.semaforo)) && G.filas.filter((f) => f.habilitacion === 'no habilitada').every((f) => f.semaforo === 'rojo'), 'Semáforo por proponente; los no habilitados en rojo');
m.ok(G.portada === 'En evaluación' && !G.recomendado, 'Sin concepto firmado la portada dice «En evaluación»');
const G2 = Comparativo.gerencial(R, { concepto: { estado: 'firmado', recomendado: R.puntaje.orden[0].id } });
m.ok(G2.recomendado === R.puntaje.orden[0].nombre && /^Recomendado: /.test(G2.portada), 'Con el concepto firmado la portada dice a quién se recomienda');

/* ── Gráficas ── */
m.seccion('Las 15 gráficas');
const todas = Graficas.todas(R, {});
m.ok(todas.length === 15 && todas.every((g, i) => g.numero === i + 1), 'Quince gráficas numeradas del 1 al 15');
const malas = todas.filter((g) => !/^<svg[\s\S]*<\/svg>$/.test(g.svg.trim()) || /NaN|undefined|Infinity/.test(g.svg) || (g.svg.match(/<[a-z]+/g) || []).length < 5);
m.ok(!malas.length, 'Cada gráfica es un SVG completo, sin NaN ni undefined' + (malas.length ? ': ' + malas.map((g) => g.id).join(', ') : ''));
m.ok(todas.every((g) => g.titulo && g.descripcion), 'Cada gráfica trae título y descripción');
const cap = R.ctx.base.capitulos[0].codigo;
m.ok(/subcapítulo/.test(Graficas.una('calor', R, { capitulo: cap }).titulo), 'El mapa de calor baja a los subcapítulos de un capítulo');
m.ok(Graficas.una('cascada', R, { ofertaId: R.ofertas[2].id }).titulo.includes(R.ofertas[2].nombre), 'La cascada se arma para la oferta elegida');
m.ok(!/var\(--/.test(Graficas.paraExportar(todas[0].svg)), 'Al exportar, los colores del tema quedan fijos');

/* ── Concepto ── */
m.seccion('Concepto de adjudicación');
const g = Concepto.generar(R, { alertas: [], ahora: '2026-11-16T10:00:00Z' });
m.ok(!g.provisional && g.recomendado === R.puntaje.orden[0].id && g.recomendacion.includes(R.puntaje.orden[0].nombre), 'Recomienda al primero del orden de elegibilidad');
m.ok(g.orden.length === R.puntaje.orden.length && Object.keys(g.riesgos).length === Math.min(2, g.orden.length), 'Riesgos del primero y del segundo');
m.ok(g.porGrupo.some((x) => x.requisitos.some((r) => r.codigo === 'ADI-01')), 'El requisito creado por el usuario está en el análisis por requisito');
const f = Concepto.aplicarTextos(g, { resumen: 'Resumen del comité DEMO', condiciones: ['Condición DEMO', ''] });
m.ok(f.resumen === 'Resumen del comité DEMO' && f.recomendacion === g.recomendacion && f.condiciones.length === 1, 'Lo editado por el comité reemplaza lo generado, campo por campo');
m.ok(Concepto.estado({ firmas: [{ usuario: 'a' }] , huella: 'x' }) === 'borrador' && Concepto.estado({ firmas: [{ usuario: 'a' }, { usuario: 'b' }], huella: 'x' }) === 'firmado', 'Hacen falta dos firmas');
m.ok(Concepto.contenidoFirmado(f) !== Concepto.contenidoFirmado(Concepto.aplicarTextos(f, { notas: 'otra' })), 'Un cambio después de firmar cambia el contenido firmado');

/* ── Informe ── */
m.seccion('Informe final');
const sec = Informe.secciones(R);
m.ok(sec.length === Informe.BASE.length && sec.some((s) => s.id === 'req:ADI-01' && s.adicional), 'Las secciones del informe, con la del requisito creado por el usuario en el lugar de los adicionales');
m.ok(sec.findIndex((s) => s.id === 'req:ADI-01') === Informe.BASE.findIndex((s) => s.id === 'adicionales'), 'Va después de la programación y antes de las alertas');
const A = Informe.armar(R, { secciones: sec }, { alertas: [] });
m.ok(A.marcaAgua && /BORRADOR/.test(A.marcaAgua), 'Sin concepto firmado, el informe lleva la marca de agua de borrador');
m.ok(A.bloques.some((b) => b.t === 'sec' && /ADI-01/.test(b.txt)) && A.hojas.some((h) => h.nombre === 'Req ADI-01'), 'El requisito adicional tiene su sección en el PDF y su hoja en el Excel');
m.ok(new Set(A.hojas.map((h) => h.nombre)).size === A.hojas.length && A.hojas.every((h) => h.nombre.length <= 31), 'Las hojas del Excel tienen nombres únicos de hasta 31 caracteres');
const reorden = sec.slice().reverse().map((s) => (s.id === 'apu' ? Object.assign({}, s, { marcada: false }) : s));
const A2 = Informe.armar(R, { secciones: reorden }, { concepto: { estado: 'firmado' } });
m.ok(A2.secciones[0] === 'anexos' && !A2.secciones.includes('apu') && !A2.marcaAgua, 'El orden y las casillas elegidas se respetan; firmado, sin marca de agua');
const norm = Informe.normalizar(R, { secciones: [{ id: 'totales', marcada: false }, { id: 'ya-no-existe' }] });
m.ok(norm[0].id === 'totales' && !norm[0].marcada && norm.length === sec.length, 'Una configuración guardada se pone al día: las secciones nuevas entran, las que no existen salen');
m.ok(/^ARKEN_ANALYTICA_DEMO-2026-001_Informe_20261116\.xlsx$/.test(Informe.nombreArchivo('DEMO-2026-001', '2026-11-16', 'xlsx')), 'Nombre del archivo del informe');

/* ── Presupuesto adjudicado para ARKEN CONTROL ── */
m.seccion('Presupuesto adjudicado');
const fila = (h, n) => (h.find((x) => x.nombre === n) || {}).filas || [];
let todosIguales = true, sinRepetidos = true;
for (const o of R.ofertas) {
  const h = ExcelArken.hojasPresupuesto(o.pres, { proceso: 'DEMO-2026-001', proponente: o.nombre });
  const ins = fila(h, 'Insumos'), apu = fila(h, 'APU'), act = fila(h, 'Actividades');
  const P = new Map(ins.slice(1).map((r) => [String(r[0]), Number(r[4])]));
  const U = new Map(); let cur = null;
  apu.slice(1).forEach((r) => { if (r[0]) cur = String(r[0]); U.set(cur, (U.get(cur) || 0) + Number(r[4]) * (P.get(String(r[3])) || 0)); });
  let cd = 0;
  act.slice(1).forEach((r) => { const ids = String(r[8] || '').split(',').map((s) => s.trim()).filter(Boolean); cd += Number(r[7]) * ids.reduce((t, i) => t + (U.get(i) || 0), 0); });
  if (!cerca(cd, Calculo.costoDirecto(o.pres), 1)) { todosIguales = false; console.log('   ', o.nombre, Util.money(cd), '≠', Util.money(Calculo.costoDirecto(o.pres))); }
  const porNombre = new Map();
  ins.slice(1).forEach((r) => { const k = Util.normaliza(r[2]); porNombre.set(k, (porNombre.get(k) || new Set()).add(r[4])); });
  if ([...porNombre.values()].some((s) => s.size > 1)) sinRepetidos = false;
}
m.ok(todosIguales, 'El libro de cada oferta, leído como lo lee ARKEN CONTROL, da el mismo costo directo');
m.ok(sinRepetidos, 'Ninguna descripción de insumo queda con dos precios (ARKEN CONTROL las juntaría)');

m.terminar();
