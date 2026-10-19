// ARKEN ANALYTICA · prueba de punta a punta de la Fase 3 (§25, §27), en Chromium.
//
//   · un proceso de demostración emitido recibe cinco sobres cerrados de proponentes ficticios, uno
//     con cada rasgo de §25 (desbalanceada, documento vencido, valor bajo, el mismo profesional en
//     dos ofertas y aritmética errada); se cierra y se abre con el comité, como cualquier proceso
//   · cada alerta esperada aparece en la bandeja con su porqué y su evidencia (criterio 8), y la
//     evidencia está a dos clics: la bandeja y el enlace (criterio 7)
//   · cada evaluador verifica solo lo de su rol; la verificación queda como fila nueva y auditada
//   · subsanación con plazo en días hábiles y su PDF, respuesta, justificación del valor bajo y
//     decisión del comité
//   · el orden de elegibilidad coincide con el calculado a mano, con cada método económico (criterio 9)
//   · una alerta descartada sigue descartada al volver a analizar; la demostración se borra entera
//   · sin errores de JavaScript y sin peticiones a internet
//
// Uso: npm run prueba:punta-a-punta-fase-3

import { RUTA_ANALYTICA, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, irA, pestana, botonModal, marcador, prepararEmitido } from './comun.mjs';

const m = marcador('Prueba de punta a punta de ARKEN ANALYTICA (Fase 3)');
const srv = await servidor();
const nav = await navegador();
const FRASE = 'el comité abre las ofertas';
const ctx = await contexto(nav);
const pp = await ctx.newPage();
const errores = vigilarErrores(pp);
pp.on('dialog', (d) => d.accept());
const accion = (nombre, extra = '') => pp.click(`#stage [data-accion="${nombre}"]${extra}`);
async function confirmar(texto) { await botonModal(pp, texto); }

try {
  await abrirAnalytica(pp, srv.url(RUTA_ANALYTICA));
  await ingresar(pp, 'admin', 'arken', 'prueba-fase3-2026');

  m.seccion('Proceso de demostración con cinco sobres cerrados');
  const prep = await prepararEmitido(pp, FRASE);
  m.ok(prep.estado === 'emitido', 'El proceso de demostración queda emitido');
  await pp.evaluate(async () => {
    for (const [usuario, nombre, roles] of [['tecnico1', 'Evaluador técnico de prueba', ['tecnico']], ['juridica1', 'Evaluadora jurídica de prueba', ['juridicoEval']], ['financiero1', 'Evaluador financiero de prueba', ['financiero']]])
      await Usuarios.guardar({ usuario, nombre, cargo: 'Prueba', roles }, 'clave-' + usuario + '-2026');
  });
  await irA(pp, '09');
  await accion('demo-ofertas'); await confirmar('Generar y recibir');
  await pp.waitForFunction(() => Recepcion.vigentes(Modelo.activo().id).length === 5, null, { timeout: 60000 });
  const sob = await pp.evaluate(() => Recepcion.sobres(Modelo.activo().id).map((s) => ({ estado: s.estado, cifrado: s.cifrado, archivo: s.archivo, inv: s.invitadoId, demo: s.demo })));
  m.ok(sob.length === 5 && sob.every((s) => s.estado === 'recibido sellado' && s.cifrado && s.demo), 'Cinco sobres cerrados, recibidos por el módulo 09 y marcados como demostración');
  const nombresOk = await pp.evaluate(() => { const p = Modelo.activo(); return Recepcion.sobres(p.id).every((s) => { const i = Modelo.invitados(p.id).find((x) => x.id === s.invitadoId); return i && s.archivo.includes(Util.razonSocialArchivo(i.razonSocial)); }); });
  m.ok(nombresOk && new Set(sob.map((s) => s.inv)).size === 5, 'Cada sobre asignado a su invitado, con su razón social en el nombre del archivo');
  await accion('demo-cierre'); await confirmar('Adelantar');
  await pp.waitForFunction(() => Recepcion.cerrado(Modelo.activo()), null, { timeout: 15000 });
  await pp.waitForSelector('#stage [data-accion="acta-cierre"]');
  await accion('acta-cierre');
  await pp.waitForFunction(() => Recepcion.actas(Modelo.activo().id, 'cierre').length === 1, null, { timeout: 30000 });
  await pp.waitForSelector('#stage [data-accion="abrir-ofertas"]:not([disabled])');
  await accion('abrir-ofertas');
  await pp.fill('#pd_frase', FRASE); await pp.fill('#pd_u1', 'comite1'); await pp.fill('#pd_c1', 'clave-comite1-2026'); await pp.fill('#pd_u2', 'comite2'); await pp.fill('#pd_c2', 'clave-comite2-2026');
  await botonModal(pp, 'Abrir los 5 sobre(s)');
  await pp.waitForFunction(() => Recepcion.ofertas(Modelo.activo().id).length === 5, null, { timeout: 90000 });
  m.ok(true, 'Acta de cierre y apertura con la frase y dos miembros del comité: cinco ofertas abiertas');

  m.seccion('Módulos 11 a 14');
  for (const [mod, texto] of [['11', 'Requisitos habilitantes'], ['12', 'Total recalculado'], ['13', 'Requisito por proponente'], ['14', 'Orden de elegibilidad']]) {
    await irA(pp, mod);
    m.ok((await pp.textContent('#stage')).includes(texto), 'Módulo ' + mod + ' con las cinco ofertas: «' + texto + '»');
  }
  for (const t of ['capitulos', 'subcapitulos', 'actividades', 'insumos', 'aiu', 'desbalance', 'apu', 'configuracion']) { await irA(pp, '12'); await pestana(pp, t); }
  for (const t of ['financiero', 'experiencia', 'personal', 'sistemas', 'programacion', 'otros']) { await irA(pp, '13'); await pestana(pp, t); }
  for (const t of ['habilitacion', 'subsanaciones', 'comite']) { await irA(pp, '11'); await pestana(pp, t); }
  m.ok(!errores.length, 'Las subpestañas de 12 (Aritmética a APU y Configuración), 13 y 11 se pintan sin errores');

  m.seccion('Bandeja de alertas: cada alerta esperada, con evidencia');
  await pp.click('#btnAlertas');
  await pp.waitForSelector('#bandejaCuerpo .alerta-item', { timeout: 60000 });
  const al = await pp.evaluate(() => Evaluacion.alertas(Modelo.activo().id).map((a) => ({ id: a.id, tipo: a.alerta.tipo, titulo: a.alerta.titulo, ofertas: a.alerta.ofertas.map((id) => Evaluacion.nombreOferta(Modelo.activo(), Recepcion.ofertas(Modelo.activo().id).find((o) => o.id === id))),
    ev: a.alerta.evidencia.length, porque: !!a.alerta.porque, regla: !!a.alerta.regla, accion: !!a.alerta.accion })));
  const hay = (tipo, quien, re) => al.some((a) => a.tipo === tipo && a.ofertas.some((n) => n.includes(quien)) && (!re || re.test(a.titulo)));
  const esperadas = [['desbalance', 'Beta'], ['cargue al inicio', 'Beta'], ['valor bajo', 'Gamma'], ['mano de obra', 'Gamma'], ['documento vencido', 'Delta'],
    ['colusión', 'Delta', /misma persona/i], ['colusión', 'Épsilon', /misma persona/i], ['apu no suma', 'Épsilon'], ['aritmética', 'Épsilon']];
  esperadas.forEach(([t, q, re]) => m.ok(hay(t, q, re), 'Aparece «' + t + '»' + (re ? ' (la misma persona)' : '') + ' de ' + q));
  m.ok(al.every((a) => a.ev > 0 && a.porque && a.regla && a.accion), 'Las ' + al.length + ' alertas traen evidencia, por qué importa, la regla y qué hacer (criterio 8)');
  m.ok(!al.some((a) => a.ofertas.some((n) => n.includes('Alfa'))), 'Alfa, la oferta pareja, no tiene alertas');
  const visibles = await pp.locator('#bandejaCuerpo .alerta-item').count();
  m.ok(visibles === al.length && Number(await pp.textContent('#tbAlertas')) === al.length, 'La bandeja muestra las ' + al.length + ' abiertas y el contador de la barra las cuenta');

  // Dos clics: la bandeja y el enlace de la evidencia llevan al renglón resaltado.
  const k = await pp.evaluate(() => Bandeja.visibles(Modelo.activo()).findIndex((a) => a.alerta.tipo === 'apu no suma'));
  await pp.locator(`#bandejaCuerpo .evid[data-al="${k}"][data-ev="0"]`).click();
  await pp.waitForSelector('#stage tr.resaltado', { timeout: 15000 });
  const res = await pp.evaluate(() => ({ mod: Sesion.modulo, fila: document.querySelector('#stage tr.resaltado').textContent, tab: Sesion.pestanas.a12 }));
  m.ok(res.mod === '12' && res.tab === 'aritmetica' && /el APU no suma/.test(res.fila), 'Desde la bandeja, un clic en la evidencia lleva al renglón de Aritmética, resaltado (criterio 7)');
  await pp.click('#btnAlertas'); await pp.waitForSelector('#bandejaCuerpo .alerta-item');
  const kd = await pp.evaluate(() => Bandeja.visibles(Modelo.activo()).findIndex((a) => a.alerta.tipo === 'documento vencido'));
  await pp.locator(`#bandejaCuerpo .evid[data-al="${kd}"][data-ev="0"]`).click();
  await pp.waitForSelector('#visor canvas', { timeout: 30000 });
  m.ok(true, 'Un clic en la evidencia del documento vencido abre el PDF del proponente en el visor');
  await pp.evaluate(() => document.querySelectorAll('#modales .overlay').forEach((o) => o.remove()));

  m.seccion('Cada evaluador, lo suyo');
  const roles = await pp.evaluate(async () => {
    const p = Modelo.activo(), yo = Sesion.usuario, ofs = Recepcion.ofertas(p.id), r = {};
    Sesion.usuario = S.usuarios.find((u) => u.usuario === 'tecnico1');
    try { await Evaluacion.evaluar(p, ofs[0].id, 'JUR-02', { cumple: 'sí' }); r.tecnicoJur = 'guardó'; } catch (e) { r.tecnicoJur = e.message; }
    Sesion.usuario = S.usuarios.find((u) => u.usuario === 'financiero1');
    try { await Evaluacion.evaluar(p, ofs[0].id, 'FIN-04', { cumple: 'no' }); r.sinObs = 'guardó'; } catch (e) { r.sinObs = e.message; }
    Sesion.usuario = yo;
    return r;
  });
  m.ok(/evaluador jurídico/.test(roles.tecnicoJur), 'El evaluador técnico no puede verificar un requisito jurídico: ' + roles.tecnicoJur);
  m.ok(/observación es obligatoria/.test(roles.sinObs), '«No cumple» sin observación no se guarda');
  // La evaluadora jurídica verifica JUR-01 de Alfa desde la matriz, con el documento como evidencia.
  await pp.evaluate(() => { Sesion.usuario = S.usuarios.find((u) => u.usuario === 'juridica1'); });
  await irA(pp, '11'); await pestana(pp, 'verificacion');
  const alfa = await pp.evaluate(() => Recepcion.ofertas(Modelo.activo().id).find((o) => /Alfa/.test(o.proponente.razonSocial)).id);
  await pp.click(`#stage [data-accion="verificar"][data-of="${alfa}"][data-req="JUR-01"]`);
  await pp.selectOption('#vr_cumple', 'sí');
  await pp.fill('#vr_texto', 'Carta de presentación firmada por el representante legal');
  await botonModal(pp, 'Guardar la verificación');
  await pp.waitForFunction((a) => Evaluacion.evaluaciones(Modelo.activo().id).some((e) => e.ofertaId === a && e.requisitoId === 'JUR-01'), alfa, { timeout: 15000 });
  const fila = await pp.evaluate((a) => Evaluacion.evaluaciones(Modelo.activo().id).find((e) => e.ofertaId === a && e.requisitoId === 'JUR-01'), alfa);
  m.ok(fila.cumple === 'sí' && fila.evaluador === 'juridica1' && fila.evidencia.length === 1 && fila.evidencia[0].pagina === 1 && /firmada/.test(fila.evidencia[0].texto), 'La verificación guarda quién, cuándo y la evidencia: documento, página y texto literal');
  await pp.evaluate(() => { Sesion.usuario = S.usuarios.find((u) => u.usuario === 'admin'); App.render(); });

  m.seccion('Verificación completa, subsanaciones y comité');
  const CALIF = { Alfa: { 'SG-04': 18, 'TEC-01': 55, 'TEC-03': 45 }, Beta: { 'SG-04': 15, 'TEC-01': 50, 'TEC-03': 40 }, Gamma: { 'SG-04': 12, 'TEC-01': 40, 'TEC-03': 35 },
    Delta: { 'SG-04': 16, 'TEC-01': 52, 'TEC-03': 42 }, 'Épsilon': { 'SG-04': 14, 'TEC-01': 48, 'TEC-03': 38 } };
  const ev = await pp.evaluate(async (CALIF) => {
    const p = Modelo.activo();
    const R = Evaluacion.analisis(p);
    const clave = (o) => Object.keys(CALIF).find((k) => o.nombre.includes(k));
    for (const o of R.ofertas) for (const r of R.requisitos) {
      if (R.vigente(o.id, r.codigo)) continue;
      const s = R.sugerencias[o.id][r.codigo] || {};
      const v = { cumple: s.cumple || 'sí', observacion: s.motivo || 'Verificado con el documento.' };
      if (s.valor !== null && s.valor !== undefined) v.valorVerificado = s.valor;
      if (r.codigo === 'TEC-05') v.valorVerificado = 60;
      if (CALIF[clave(o)][r.codigo] !== undefined) v.puntaje = CALIF[clave(o)][r.codigo];
      await Evaluacion.evaluar(p, o.id, r.codigo, v);
    }
    const R2 = Evaluacion.analisis(p);
    const est = Object.fromEntries(R2.ofertas.map((o) => [clave(o), R2.porOferta[o.id].habilitacion.estado]));
    return { est, provisional: R2.puntaje.provisional, filas: Evaluacion.evaluaciones(p.id).length };
  }, CALIF);
  m.ok(ev.est.Alfa === 'habilitada' && ev.est.Beta === 'habilitada' && ev.est['Épsilon'] === 'no habilitada' && ev.est.Delta === 'pendiente' && ev.est.Gamma === 'pendiente' && ev.provisional,
    'Alfa y Beta habilitadas, Épsilon no (endeudamiento), Delta y Gamma pendientes de subsanar: puntaje provisional');
  // Subsanación desde la pestaña: el botón «Pedir» genera el PDF con el plazo en días hábiles.
  await irA(pp, '11'); await pestana(pp, 'subsanaciones');
  const delta = await pp.evaluate(() => Recepcion.ofertas(Modelo.activo().id).find((o) => /Delta/.test(o.proponente.razonSocial)).id);
  const [descarga] = await Promise.all([pp.waitForEvent('download'), (async () => { await accion('pedir-subsanacion', `[data-of="${delta}"][data-req="JUR-02"]`); await pp.fill('#pd_dias', '3'); await botonModal(pp, 'Generar la solicitud'); })()]);
  const sol = await pp.evaluate(() => Evaluacion.subsanaciones(Modelo.activo().id)[0]);
  m.ok(/^Subsanacion_.*JUR-02\.pdf$/.test(descarga.suggestedFilename()) && sol.requisito === 'JUR-02' && sol.dias === 3 && sol.plazo > sol.solicitada.slice(0, 10), 'Solicitud de subsanación de JUR-02 a Delta, con PDF y plazo de 3 días hábiles (' + sol.plazo + ')');
  const fin = await pp.evaluate(async () => {
    const p = Modelo.activo(), ofs = Recepcion.ofertas(p.id);
    const id = (re) => ofs.find((o) => re.test(o.proponente.razonSocial)).id;
    const pdf = (t) => { const d = new window.jspdf.jsPDF(); d.text(t, 20, 20); return new File([d.output('blob')], t.replace(/\W+/g, '_') + '.pdf', { type: 'application/pdf' }); };
    const s1 = Evaluacion.subsanaciones(p.id)[0];
    await Evaluacion.responder(p, s1.id, [pdf('Certificado de existencia vigente DEMO')], 'Llegó por correo');
    await Evaluacion.evaluar(p, id(/Delta/), 'JUR-02', { cumple: 'sí', observacion: 'Certificado vigente aportado en la subsanación' });
    const s2 = (await Evaluacion.pedir(p, id(/Gamma/), 'PER-02', 3, 'Reemplace al residente por uno con 5 años de experiencia')).s;
    await Evaluacion.responder(p, s2.id, [pdf('Hoja de vida residente reemplazo DEMO')], '');
    await Evaluacion.evaluar(p, id(/Gamma/), 'PER-02', { cumple: 'sí', observacion: 'Reemplazo con 6 años', valorVerificado: 0 });
    const s3 = (await Evaluacion.pedir(p, id(/Gamma/), null, 3, 'Justifique el valor', 'justificacion')).s;
    await Evaluacion.responder(p, s3.id, [pdf('Justificacion del valor DEMO')], '');
    const yo = Sesion.usuario; let sinComite = '';
    Sesion.usuario = S.usuarios.find((u) => u.usuario === 'tecnico1');
    try { await Evaluacion.decidirJustificacion(p, s3.id, 'aceptada', 'x'); } catch (e) { sinComite = e.message; }
    Sesion.usuario = S.usuarios.find((u) => u.usuario === 'comite1');
    await Evaluacion.decidirJustificacion(p, s3.id, 'aceptada', 'Precios soportados con cotizaciones');
    Sesion.usuario = yo;
    await Evaluacion.actualizarAlertas(p);
    const R = Evaluacion.analisis(p);
    const ronda2 = Recepcion.documentos(id(/Delta/)).filter((d) => d.ronda === 2).length;
    return { sinComite, ronda2, est: R.ofertas.map((o) => R.porOferta[o.id].habilitacion.estado), provisional: R.puntaje.provisional,
      tot: Object.fromEntries(R.ofertas.map((o) => [o.nombre, o.totales.total])), orden: R.puntaje.orden.map((f) => [f.nombre, f.total]), PO: R.presupuestoOficial,
      metodos: Object.fromEntries(['menor', 'cercania', 'media', 'mediaAlta', 'geometrica'].map((met) => {
        const d = Evaluacion.datos(p); d.proceso = Object.assign({}, p, { general: Object.assign({}, p.general, { metodoEconomico: met }) });
        const Rm = Motor.analizar(d);
        return [met, Rm.puntaje.orden.map((f) => [f.nombre, f.total, f.puntos['ECO-04']])];
      })) };
  });
  m.ok(/permiso/.test(fin.sinComite), 'Solo el comité decide sobre la justificación del valor bajo');
  m.ok(fin.ronda2 === 1, 'Lo que respondió el proponente queda en su carpeta, marcado como subsanación');
  m.ok(fin.est.filter((e) => e === 'habilitada').length === 4 && !fin.provisional, 'Tras subsanar y aceptar la justificación: cuatro habilitadas y el puntaje es definitivo');

  m.seccion('Orden de elegibilidad, calculado a mano, con cada método económico (criterio 9)');
  const nombre = (k) => Object.keys(fin.tot).find((n) => n.includes(k));
  const hab = ['Alfa', 'Beta', 'Gamma', 'Delta'];
  const V = Object.fromEntries(hab.map((k) => [k, fin.tot[nombre(k)]]));
  const r2 = (x) => Math.round(x * 100) / 100;
  // Lo verificado de cada ponderable: área (EXP-02, proporcional a 3.000 m²), rangos de PER-01 y PER-02, ISO (sí o no), proveedores (40) y las calificaciones.
  const AREA = { Alfa: 2400, Beta: 1800, Gamma: 1500, Delta: 3000 }, DIR = { Alfa: 60, Beta: 40, Gamma: 20, Delta: 40 }, RES = { Alfa: 30, Beta: 40, Gamma: 15, Delta: 15 };
  const SG = { Alfa: 80, Beta: 60, Gamma: 40, Delta: 80 };
  const tecnico = (k) => r2(150 * AREA[k] / 3000) + DIR[k] + RES[k] + SG[k] + 40 + CALIF[k]['SG-04'] + CALIF[k]['TEC-01'] + CALIF[k]['TEC-03'];
  const vs = hab.map((k) => V[k]), media = vs.reduce((a, b) => a + b, 0) / vs.length, vmin = Math.min(...vs), vmax = Math.max(...vs);
  const frente = (R, v) => v <= R ? 500 * (1 - (R - v) / R) : 500 * (1 - 2 * Math.abs(R - v) / R);
  const dmin = Math.min(...vs.map((v) => Math.abs(v - fin.PO)));
  const G = Math.exp((2 * Math.log(fin.PO) + vs.reduce((t, v) => t + Math.log(v), 0)) / (vs.length + 2)); // 4 ofertas: el presupuesto entra 2 veces
  const ECO = {
    menor: (v) => 500 * vmin / v,
    cercania: (v) => Math.max(0, 500 * (1 - (v < fin.PO ? 1 : 2) * (Math.abs(v - fin.PO) - dmin) / fin.PO)),
    media: (v) => Math.max(0, frente(media, v)),
    mediaAlta: (v) => Math.max(0, frente((vmax + media) / 2, v)),
    geometrica: (v) => Math.max(0, frente(G, v))
  };
  for (const met of Object.keys(ECO)) {
    const total = Object.fromEntries(hab.map((k) => [k, r2(r2(ECO[met](V[k])) + tecnico(k))]));
    const mano = hab.slice().sort((a, b) => total[b] - total[a] || r2(ECO[met](V[b])) - r2(ECO[met](V[a])));
    const prog = fin.metodos[met];
    const ok = prog.map((f) => hab.find((k) => f[0].includes(k))).join() === mano.join() && prog.every((f) => Math.abs(f[1] - total[hab.find((k) => f[0].includes(k))]) <= 0.011);
    m.ok(ok, met + ': ' + mano.map((k) => k + ' ' + total[k].toFixed(2)).join(' · ') + (ok ? '' : ' (programa: ' + prog.map((f) => f[0].split(' ')[1] + ' ' + f[1]).join(' · ') + ')'));
  }
  await irA(pp, '14');
  const pantalla = await pp.evaluate(() => Array.from(document.querySelectorAll('#stage table')[0].querySelectorAll('tbody tr')).map((tr) => tr.textContent));
  m.ok(pantalla.length === 5 && /Épsilon/.test(pantalla[4]) && /no habilitada/.test(pantalla[4]) && fin.orden.every((f, i) => pantalla[i].includes(f[0])), 'El módulo 14 muestra el orden y, al final, Épsilon no habilitada con su causal');

  m.seccion('Estados de la bandeja');
  await pp.click('#btnAlertas'); await pp.waitForSelector('#bandejaCuerpo .alerta-item');
  const titulo = await pp.locator('#bandejaCuerpo .alerta-item').first().locator('.alerta-titulo').textContent();
  await pp.locator('#bandejaCuerpo .alerta-item').first().locator('[data-estado="descartada"]').click();
  await pp.fill('#pd_motivo', 'Revisado por el comité: no afecta la evaluación');
  await botonModal(pp, 'Descartar');
  await pp.waitForFunction((t) => Evaluacion.alertas(Modelo.activo().id).some((a) => a.alerta.titulo === t && Alertas.estado(a) === 'descartada'), titulo, { timeout: 15000 });
  const sigue = await pp.evaluate(async (t) => { const p = Modelo.activo(); Evaluacion.invalidar(); await Evaluacion.actualizarAlertas(p); return Alertas.estado(Evaluacion.alertas(p.id).find((a) => a.alerta.titulo === t)); }, titulo);
  m.ok(sigue === 'descartada', 'Una alerta descartada, con su motivo, sigue descartada al volver a analizar');
  await pp.evaluate(() => document.querySelectorAll('#modales .overlay').forEach((o) => o.remove()));

  m.seccion('Borrar la demostración');
  const quedan = await pp.evaluate(async () => { await Modelo.borrarDemo(); App.render(); return ['evaluaciones', 'subsanaciones', 'alertas', 'ofertas', 'sobres', 'documentosOferta'].map((n) => (S[n] || []).length).reduce((a, b) => a + b, 0); });
  m.ok(quedan === 0, 'Se borran las verificaciones, subsanaciones, alertas, ofertas, sobres y documentos de la demostración');
  const aud = await pp.evaluate(() => Auditoria.lista().map((a) => a.accion + ' ' + a.objeto));
  m.ok(['verificar requisito', 'solicitar subsanación', 'decidir justificación de valor bajo', 'analizar alertas', 'revisar alerta', 'adelantar cierre (demostración)'].every((x) => aud.includes(x)), 'Auditoría de la verificación, la subsanación, la decisión del comité y la bandeja');
  m.ok(!errores.length, 'Sin errores de JavaScript' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  m.ok(!ctx.peticionesExternas.length, 'Ninguna petición a internet');
} catch (e) {
  m.ok(false, 'La prueba se detuvo: ' + e.message);
  console.error(e);
} finally {
  await nav.close();
  await srv.cerrar();
}
m.terminar();
