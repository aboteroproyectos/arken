// El proceso de demostración evaluado de punta a punta, en Node: cinco ofertas de demostración,
// verificadas con lo que sugiere el programa, con las subsanaciones de Delta y Gamma y la
// justificación del valor bajo aceptada. Es el mismo caso de pruebas/nucleo-fase-3.mjs, para que
// las pruebas de la Fase 4 partan de una evaluación terminada.

export const CALIF = { alfa: { 'SG-04': 18, 'TEC-01': 55, 'TEC-03': 45 }, beta: { 'SG-04': 15, 'TEC-01': 50, 'TEC-03': 40 }, gamma: { 'SG-04': 12, 'TEC-01': 40, 'TEC-03': 35 },
  delta: { 'SG-04': 16, 'TEC-01': 52, 'TEC-03': 42 }, epsilon: { 'SG-04': 14, 'TEC-01': 48, 'TEC-03': 38 } };

export function escenario(N, extra = {}) {
  const { Demo, PlantillaCondiciones, Parametros, Motor, DemoOfertas } = N;
  const reqs = extra.requisitos || PlantillaCondiciones.anexoB();
  const P = Parametros.iniciales();
  const base = Demo.presupuesto();
  const proceso = Object.assign({ id: 'p1', codigo: 'DEMO-2026-001', nombre: 'Proceso de demostración', politicaApu: 'todas', plazoMaximoDias: 300, iva: { tarifa: 19, base: 'utilidad' }, general: {}, demo: true }, extra.proceso || {});
  const invitados = Demo.invitados('p1');
  const cierre = '2026-11-10T17:00:00.000Z';
  const gen = DemoOfertas.generar({ proceso, base, requisitos: reqs, invitados, cierre, versionPliego: 1 });
  const ofertas = gen.map((g, i) => ({ id: 'of-' + g.clave, nombre: g.oferta.proponente.razonSocial, oferta: g.oferta, versionPliego: 1,
    documentos: g.documentos.map((d, j) => Object.assign({ id: 'd' + i + '-' + j, sha256: String(i) + j, meta: { legible: true, autor: d.autor } }, d)) }));
  const datos = { proceso, base, requisitos: reqs, parametros: P, cierre, firma: '2026-12-15', ofertas, evaluaciones: [], subsanaciones: [], ahora: '2026-11-11T10:00:00Z' };
  const R0 = Motor.analizar(datos);
  let sec = 0;
  const evaluaciones = [];
  R0.ofertas.forEach((o) => {
    const c = o.id.slice(3);
    reqs.filter((r) => r.activo !== false).forEach((r) => {
      const s = R0.sugerencias[o.id][r.codigo] || {};
      const e = { id: 'e' + (++sec), ofertaId: o.id, requisitoId: r.codigo, cumple: s.cumple || 'sí', fecha: '2026-11-12T10:00:00Z', secuencia: sec, observacion: s.motivo || '', evaluador: 'admin' };
      if (!r.obligatorio && !o.documentos.some((d) => d.requisito === r.codigo) && r.tipoRespuesta === 'documento') e.cumple = 'no aplica';
      if (s.valor !== null && s.valor !== undefined) e.valorVerificado = s.valor;
      if (r.codigo === 'TEC-05') e.valorVerificado = 60;
      if (CALIF[c] && CALIF[c][r.codigo] !== undefined) e.puntaje = CALIF[c][r.codigo];
      evaluaciones.push(e);
    });
  });
  const subsanaciones = [
    { id: 's1', ofertaId: 'of-delta', requisito: 'JUR-02', tipo: 'requisito', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-13T09:00:00Z' } },
    { id: 's2', ofertaId: 'of-gamma', requisito: 'PER-02', tipo: 'requisito', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-13T09:00:00Z' } },
    { id: 's3', ofertaId: 'of-gamma', tipo: 'justificacion', solicitada: '2026-11-12T12:00:00Z', plazo: '2026-11-17', respuesta: { fecha: '2026-11-14T09:00:00Z' }, decision: 'aceptada', motivo: 'Precios soportados con cotizaciones' }];
  evaluaciones.push({ id: 'e' + (++sec), ofertaId: 'of-delta', requisitoId: 'JUR-02', cumple: 'sí', fecha: '2026-11-14T10:00:00Z', secuencia: sec, observacion: 'Certificado vigente aportado en la subsanación', ronda: 2, evaluador: 'admin' });
  evaluaciones.push({ id: 'e' + (++sec), ofertaId: 'of-gamma', requisitoId: 'PER-02', cumple: 'sí', fecha: '2026-11-14T10:00:00Z', secuencia: sec, observacion: 'Reemplazo con 6 años', ronda: 2, valorVerificado: 0, evaluador: 'admin' });
  const final = Object.assign({}, datos, { evaluaciones, subsanaciones, ahora: '2026-11-15T10:00:00Z' });
  return { datos: final, R: Motor.analizar(final), base, proceso, reqs, P };
}
