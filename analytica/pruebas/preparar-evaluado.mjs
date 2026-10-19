// En el navegador: un proceso de demostración evaluado de punta a punta, como lo deja la Fase 3
// (cinco ofertas abiertas, todo verificado, Delta y Gamma subsanadas y la justificación aceptada).
// Lo usan las pruebas de la Fase 4 para partir de una evaluación terminada.

import { irA, botonModal, prepararEmitido } from './comun.mjs';
// Las mismas calificaciones de la Fase 3 (y de escenario-evaluacion.mjs).
export const CALIF = { Alfa: { 'SG-04': 18, 'TEC-01': 55, 'TEC-03': 45 }, Beta: { 'SG-04': 15, 'TEC-01': 50, 'TEC-03': 40 }, Gamma: { 'SG-04': 12, 'TEC-01': 40, 'TEC-03': 35 },
  Delta: { 'SG-04': 16, 'TEC-01': 52, 'TEC-03': 42 }, 'Épsilon': { 'SG-04': 14, 'TEC-01': 48, 'TEC-03': 38 } };

export async function prepararEvaluado(pp, frase = 'el comité abre las ofertas') {
  const accion = (nombre) => pp.click(`#stage [data-accion="${nombre}"]`);
  await prepararEmitido(pp, frase);
  await pp.evaluate(async () => {
    for (const [usuario, nombre, roles] of [['tecnico1', 'Evaluador técnico de prueba', ['tecnico']], ['juridica1', 'Evaluadora jurídica de prueba', ['juridicoEval']], ['financiero1', 'Evaluador financiero de prueba', ['financiero']]])
      await Usuarios.guardar({ usuario, nombre, cargo: 'Prueba', roles }, 'clave-' + usuario + '-2026');
  });
  await irA(pp, '09');
  await accion('demo-ofertas'); await botonModal(pp, 'Generar y recibir');
  await pp.waitForFunction(() => Recepcion.vigentes(Modelo.activo().id).length === 5, null, { timeout: 60000 });
  await accion('demo-cierre'); await botonModal(pp, 'Adelantar');
  await pp.waitForFunction(() => Recepcion.cerrado(Modelo.activo()), null, { timeout: 15000 });
  await pp.waitForSelector('#stage [data-accion="acta-cierre"]');
  await accion('acta-cierre');
  await pp.waitForFunction(() => Recepcion.actas(Modelo.activo().id, 'cierre').length === 1, null, { timeout: 30000 });
  await pp.waitForSelector('#stage [data-accion="abrir-ofertas"]:not([disabled])');
  await accion('abrir-ofertas');
  await pp.fill('#pd_frase', frase); await pp.fill('#pd_u1', 'comite1'); await pp.fill('#pd_c1', 'clave-comite1-2026'); await pp.fill('#pd_u2', 'comite2'); await pp.fill('#pd_c2', 'clave-comite2-2026');
  await botonModal(pp, 'Abrir los 5 sobre(s)');
  await pp.waitForFunction(() => Recepcion.ofertas(Modelo.activo().id).length === 5 && Recepcion.actas(Modelo.activo().id, 'apertura').length === 1, null, { timeout: 90000 });
  return pp.evaluate(async (CALIF) => {
    const p = Modelo.activo(), ofs = Recepcion.ofertas(p.id);
    const R = Evaluacion.analisis(p);
    const clave = (o) => Object.keys(CALIF).find((k) => o.nombre.includes(k));
    for (const o of R.ofertas) for (const r of R.requisitos) {
      const s = R.sugerencias[o.id][r.codigo] || {};
      const v = { cumple: s.cumple || 'sí', observacion: s.motivo || 'Verificado con el documento.' };
      if (s.valor !== null && s.valor !== undefined) v.valorVerificado = s.valor;
      if (r.codigo === 'TEC-05') v.valorVerificado = 60;
      if (CALIF[clave(o)][r.codigo] !== undefined) v.puntaje = CALIF[clave(o)][r.codigo];
      await Evaluacion.evaluar(p, o.id, r.codigo, v);
    }
    const id = (re) => ofs.find((o) => re.test(o.proponente.razonSocial)).id;
    const pdf = (t) => { const d = new window.jspdf.jsPDF(); d.text(t, 20, 20); return new File([d.output('blob')], t.replace(/\W+/g, '_') + '.pdf', { type: 'application/pdf' }); };
    const s1 = (await Evaluacion.pedir(p, id(/Delta/), 'JUR-02', 3, 'Aporte el certificado vigente')).s;
    await Evaluacion.responder(p, s1.id, [pdf('Certificado de existencia vigente DEMO')], '');
    await Evaluacion.evaluar(p, id(/Delta/), 'JUR-02', { cumple: 'sí', observacion: 'Certificado vigente aportado en la subsanación' });
    const s2 = (await Evaluacion.pedir(p, id(/Gamma/), 'PER-02', 3, 'Reemplace al residente por uno con 5 años de experiencia')).s;
    await Evaluacion.responder(p, s2.id, [pdf('Hoja de vida residente reemplazo DEMO')], '');
    await Evaluacion.evaluar(p, id(/Gamma/), 'PER-02', { cumple: 'sí', observacion: 'Reemplazo con 6 años', valorVerificado: 0 });
    const s3 = (await Evaluacion.pedir(p, id(/Gamma/), null, 3, 'Justifique el valor', 'justificacion')).s;
    await Evaluacion.responder(p, s3.id, [pdf('Justificacion del valor DEMO')], '');
    const yo = Sesion.usuario;
    Sesion.usuario = S.usuarios.find((u) => u.usuario === 'comite1');
    await Evaluacion.decidirJustificacion(p, s3.id, 'aceptada', 'Precios soportados con cotizaciones');
    Sesion.usuario = yo;
    await Evaluacion.actualizarAlertas(p);
    App.render();
    const R2 = Evaluacion.analisis(p);
    return { provisional: R2.puntaje.provisional, orden: R2.puntaje.orden.map((f) => [f.nombre, f.total]) };
  }, CALIF);
}
