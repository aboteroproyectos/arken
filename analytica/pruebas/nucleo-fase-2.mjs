// ARKEN ANALYTICA · pruebas del núcleo de la Fase 2 (§13 a §17), en Node.
//
//   · el pliego de cada invitado (ARKEN-PLIEGO) no lleva precios del presupuesto base, en ninguna etapa
//   · incrustar el pliego en ARKEN OFERTA no deja escapar HTML, ni con una razón social maliciosa
//   · manifiesto firmado: un archivo cambiado, que falta o que sobra se nombra
//   · ZIP maliciosos: rutas que salen de la carpeta, nombres con HTML, bombas, demasiados archivos
//   · PDF con JavaScript o /Launch, también escritos con #xx
//   · cabecera del sobre: proceso, código de invitación, NIT, retirado, huella, versión y hora del cierre
//   · recálculo de la oferta con las cantidades del pliego: precios distintos, faltantes y sobrantes
//   · respuestas y adendas firmadas: una letra cambiada invalida la firma
//   · diferencias entre versiones del pliego, «solo prórroga» y lo que queda para revisar
//   · actas de cierre y apertura
//
// Uso: npm run prueba:nucleo-fase-2

import { nucleo, marcador } from './comun.mjs';

const N = nucleo();
const { Util, Calculo, Nit, Cronograma, Cripto, Demo, Paquete, Sobre, Adendas, Actas, PlantillaCondiciones } = N;
const m = marcador('Núcleo de la Fase 2');

/* ── Un proceso de demostración, armado con las mismas funciones del programa ── */
const pres = Demo.presupuesto();
const invitados = Demo.invitados('pr1');
const llavesReg = await Cripto.crearLlaves('el comité abre las ofertas', 'DEMO-2026-001', 1000);
const llaves = await Cripto.abrirLlaves(llavesReg, 'el comité abre las ofertas');
const cron = Cronograma.proponer(Cronograma.nuevo(), '2026-11-03');
const proceso = { id: 'pr1', codigo: 'DEMO-2026-001', nombre: 'Casa campestre (DEMOSTRACIÓN)', modalidad: 'invitación cerrada', tipoContrato: 'precios unitarios',
  versionPliego: 1, demo: true, politicaApu: 'todas', cronograma: cron, confidencialidad: { envios: 'dos', firma: 'electronica' }, general: {} };
const requisitos = PlantillaCondiciones.anexoB();
const ctx = (extra = {}) => Object.assign({ proceso, empresa: Demo.EMPRESA, presupuesto: pres, requisitos, documentos: [], llaves: llavesReg, invitado: invitados[0],
  huellaPliegoPdf: 'a'.repeat(64), nombrePliegoPdf: 'Pliego_DEMO-2026-001_v1.pdf', etapa: 'completo' }, extra);
const totales = Calculo.totales(pres);

function numerosConPrecio(obj, ruta = '', fuera = []) {
  if (Array.isArray(obj)) obj.forEach((x, i) => numerosConPrecio(x, ruta + '[' + i + ']', fuera));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && /precio|valor|costo|total|presupuesto/i.test(k) && v > 0) fuera.push(ruta + '.' + k + '=' + v);
    numerosConPrecio(v, ruta + '.' + k, fuera);
  }
  return fuera;
}

m.seccion('El pliego de cada invitado no lleva precios (criterio 2)');
const pl = Paquete.pliego(ctx());
const texto = Paquete.texto(pl);
const preciosBase = pres.insumos.map((i) => i.precio).filter((x) => x >= 100).map(String).concat([String(Util.redondear(totales.total)), String(Util.redondear(totales.costoDirecto))]);
m.ok(numerosConPrecio(pl).length === 0, 'Ningún campo de precio, valor, costo o total con un número en el pliego');
m.ok(preciosBase.filter((s) => s.length >= 5 && new RegExp('[^0-9.]' + s.replace('.', '\\.') + '[^0-9]').test(texto)).length === 0, 'Ninguno de los ' + preciosBase.length + ' precios de insumo ni el total aparecen en el texto del pliego');
m.ok(pl.formularioCantidades.insumosSugeridos.length > 10 && pl.formularioCantidades.insumosSugeridos.every((x) => !('precio' in x)), 'Los insumos sugeridos van con descripción, unidad y categoría, sin precio');
m.ok(pl.formularioCantidades.capitulos.flatMap((c) => c.subs.flatMap((s) => s.acts)).every((a) => a.apuObligatorio && a.cantidad > 0 && !('precio' in a)), 'El formulario trae las cantidades y marca el APU obligatorio, sin precio');
const plConf = Paquete.pliego(ctx({ etapa: 'confidencialidad' }));
m.ok(plConf.requisitos.length === 0 && plConf.formularioCantidades.capitulos.length === 0 && plConf.documentos.length === 0 && plConf.pliegoPdf === null, 'En el primer envío el pliego no trae requisitos, cantidades ni documentos');
const plVisible = Paquete.pliego(ctx({ proceso: Object.assign({}, proceso, { presupuestoOficialVisible: true }) }));
m.ok(plVisible.presupuestoOficial === totales.total && numerosConPrecio(plVisible).length === 1, 'Solo si el proceso lo hace visible, el pliego trae el valor total del presupuesto oficial, y nada más');
const sinEvaluador = pl.requisitos.every((r) => !('evaluador' in r) && !('notasInternas' in r));
m.ok(sinEvaluador, 'Los requisitos viajan sin evaluador ni notas internas');

m.seccion('Incrustar el pliego en ARKEN OFERTA');
const plantilla = '<html><body><script id="arken-pliego" type="application/json">null</script><script>var x=1</script></body></html>';
const malicioso = Paquete.pliego(ctx({ invitado: Object.assign({}, invitados[0], { razonSocial: 'DEMO </script><script>alert(1)</script><!-- S.A.S.' }) }));
const html = Paquete.incrustar(plantilla, Paquete.texto(malicioso));
const bloque = /<script id="arken-pliego" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1];
m.ok((html.match(/<\/script/gi) || []).length === 2 && !/<!--/.test(bloque), 'Una razón social con </script> o <!-- no abre ni cierra ningún bloque de script');
m.ok(JSON.parse(bloque).invitado.razonSocial === malicioso.invitado.razonSocial, 'El pliego incrustado se lee igual que el original');
let e1 = '';
try { Paquete.incrustar('<html></html>', texto); } catch (e) { e1 = e.message; }
m.ok(/no tiene el lugar del pliego/.test(e1), 'Una plantilla sin el lugar del pliego se rechaza');
m.ok(Paquete.nombrePaquete('DEMO-2026-001', 'DEMO Constructora Alfa S.A.S.', 2, 'completo') === 'ARKEN_INVITACION_DEMO-2026-001_DEMO-CONSTRUCTORA-ALFA-S-A-S_v2.zip', 'Nombre del paquete de §13');
let e2 = '';
try { Paquete.leerPliego(JSON.stringify({ formato: 'OTRO' })); } catch (e) { e2 = e.message; }
m.ok(/ARKEN-PLIEGO/.test(e2), 'Un pliego con otro formato se rechaza');

m.seccion('Manifiesto firmado');
const archivos = [{ ruta: 'ARKEN_OFERTA_DEMO-2026-001.html', peso: 100, sha256: 'b'.repeat(64) }, { ruta: 'LEAME_PRIMERO.pdf', peso: 50, sha256: 'c'.repeat(64) }];
const man = Paquete.manifiesto({ proceso: 'DEMO-2026-001', versionPliego: 1, invitado: pl.invitado, huellaPliego: await Cripto.sha256(texto), archivos });
const firma = await Cripto.firmar(llaves.firma, man);
m.ok(await Cripto.verificar(llavesReg.publicaFirma, man, firma), 'El manifiesto verifica con la llave pública del proceso');
m.ok(!(await Cripto.verificar(llavesReg.publicaFirma, man.replace('"versionPliego": 1', '"versionPliego": 2'), firma)), 'Un manifiesto editado ya no verifica');
const mapa = new Map(archivos.map((a) => [a.ruta, a]));
const mo = JSON.parse(man);
m.ok(Paquete.compararArchivos(mo, mapa, archivos.map((a) => a.ruta)).length === 0, 'Con todo en su lugar no hay problemas');
const cambiado = new Map(mapa); cambiado.set('LEAME_PRIMERO.pdf', { peso: 50, sha256: 'd'.repeat(64) });
const p1 = Paquete.compararArchivos(mo, cambiado, archivos.map((a) => a.ruta));
m.ok(p1.length === 1 && p1[0].ruta === 'LEAME_PRIMERO.pdf' && /modificado/.test(p1[0].motivo), 'Un archivo cambiado se nombra: ' + p1[0].ruta + ', ' + p1[0].motivo);
const falta = new Map(mapa); falta.delete('LEAME_PRIMERO.pdf');
m.ok(Paquete.compararArchivos(mo, falta, ['ARKEN_OFERTA_DEMO-2026-001.html']).some((x) => x.ruta === 'LEAME_PRIMERO.pdf' && /falta/.test(x.motivo)), 'Un archivo que falta se nombra');
m.ok(Paquete.compararArchivos(mo, mapa, archivos.map((a) => a.ruta).concat(['extra.exe'])).some((x) => x.ruta === 'extra.exe' && /agregado/.test(x.motivo)), 'Un archivo agregado se nombra');

m.seccion('ZIP maliciosos');
const ok = (nombre, d = 10, c = 10) => ({ nombre, dir: false, descomprimido: d, comprimido: c });
m.ok(Sobre.revisarZip([ok('sobre.json'), ok('oferta.cifrada'), ok('Adjuntos/JUR-01/Camara.pdf')]) === '', 'Un sobre normal pasa');
for (const [n, nombre] of [['../../etc/passwd', 'sube de carpeta'], ['/etc/passwd', 'ruta absoluta'], ['C:/Windows/x.dll', 'unidad de Windows'], ['Adjuntos\\..\\x', 'barra invertida'],
  ['<img src=x onerror=alert(1)>.pdf', 'nombre con HTML'], ['a\u0000b.pdf', 'carácter de control'], ['x'.repeat(300), 'ruta larguísima']]) {
  m.ok(Sobre.revisarZip([ok('sobre.json'), ok(n)]) !== '', 'Se rechaza un ZIP con ' + nombre);
}
m.ok(/bomba ZIP/.test(Sobre.revisarZip([ok('sobre.json'), ok('oferta.cifrada', 500 * 1048576, 1048576)])), 'Se rechaza una bomba ZIP (un archivo que se expande 500 veces)');
m.ok(/máximo/.test(Sobre.revisarZip(Array.from({ length: 2001 }, (_, i) => ok('a' + i)))), 'Se rechaza un ZIP con más de 2.000 archivos');
m.ok(/supera el límite/.test(Sobre.revisarZip([ok('a', 3000 * 1048576, 1000 * 1048576), ok('b', 3000 * 1048576, 1000 * 1048576)])), 'Se rechaza un ZIP que descomprimido pasaría de 4 GB');

m.seccion('PDF con scripts');
const pdf = (s) => new TextEncoder().encode('%PDF-1.7\n' + s + '\n%%EOF');
m.ok(Sobre.pdfConScript(pdf('1 0 obj << /Type /Catalog >> endobj')) === '', 'Un PDF sin scripts pasa');
m.ok(/JavaScript/.test(Sobre.pdfConScript(pdf('<< /S /JavaScript /JS (app.alert(1)) >>'))), 'Un PDF con /JavaScript se rechaza');
m.ok(/JavaScript/.test(Sobre.pdfConScript(pdf('<< /OpenAction << /S /J#61vaScript /J#53 (x) >> >>'))), 'Un PDF que esconde /JavaScript con #xx se rechaza');
m.ok(/JavaScript/.test(Sobre.pdfConScript(pdf('<< /AA << /O << /JS 12 0 R >> >> >>'))), 'Un PDF con /JS por referencia se rechaza');
m.ok(/Launch/.test(Sobre.pdfConScript(pdf('<< /S /Launch /F (calc.exe) >>'))), 'Un PDF con /Launch se rechaza');
m.ok(Sobre.pdfConScript(new TextEncoder().encode('no es un pdf /JavaScript')) === '', 'Lo que no es PDF no se trata como PDF');

m.seccion('Cabecera del sobre (§16)');
const inv = invitados[1];
const lista = [{ ruta: 'oferta.cifrada', sha256: 'e'.repeat(64) }, { ruta: 'llave.envuelta', sha256: 'f'.repeat(64) }];
const huella = await Sobre.huellaContenido(lista);
const cab = (x = {}) => Object.assign(Sobre.cabecera({ proceso: 'DEMO-2026-001', versionPliego: 2, invitado: { razonSocial: inv.razonSocial, nit: Nit.formatear(inv.nit, inv.dv), codigoInvitacion: inv.codigoInvitacion },
  generado: '2026-11-20T10:00:00-05:00', sha256Contenido: huella, cifrado: true }), x);
const base = { codigoProceso: 'DEMO-2026-001', invitados, versionVigente: 2, cierre: '2026-11-24T15:00:00-05:00', nombreArchivo: Sobre.nombre(inv.razonSocial, 'DEMO-2026-001', 2, '2026-11-20T10:00:00-05:00'), sha256Calculado: huella, ahora: new Date('2026-11-21T00:00:00-05:00').getTime() };
const v = (c, x = {}) => Sobre.validarCabecera(c, Object.assign({}, base, x));
const bien = v(cab());
m.ok(bien.ok && bien.invitado.id === inv.id && !bien.avisos.length, 'Un sobre en regla se asigna a su invitado por el código de invitación');
m.ok(/no trae sobre\.json/.test(v(null).motivo), 'Sin sobre.json no es un sobre');
m.ok(/formato ARKEN-SOBRE/.test(v(cab({ formato: 'X' })).motivo), 'Otro formato se rechaza');
m.ok(/es del proceso/.test(v(cab({ proceso: 'OTRO-1' })).motivo), 'Un sobre de otro proceso se rechaza');
m.ok(/no corresponde a ningún invitado/.test(v(cab({ invitado: { codigoInvitacion: 'ZZZZ-ZZZZ', nit: inv.nit } })).motivo), 'Un código de invitación que no existe se rechaza');
m.ok(/NIT/.test(v(cab({ invitado: { codigoInvitacion: inv.codigoInvitacion, nit: '999999999-1' } })).motivo), 'Un NIT que no es el del invitado se rechaza');
const retirados = invitados.map((x) => x.id === inv.id ? Object.assign({}, x, { estado: 'retirado' }) : x);
m.ok(/retirado/.test(v(cab(), { invitados: retirados }).motivo), 'El sobre de un invitado retirado no se recibe');
m.ok(/huella del contenido/.test(v(cab(), { sha256Calculado: '0'.repeat(64) }).motivo), 'Un contenido que no coincide con su huella se rechaza');
m.ok(/no existe/.test(v(cab({ versionPliego: 3 })).motivo), 'Una versión del pliego que no existe se rechaza');
const ant = v(cab({ versionPliego: 1 }));
m.ok(ant.ok && ant.versionAnterior && /versión 1 del pliego/.test(ant.avisos.join(' ')), 'Una oferta sobre la versión anterior se recibe con aviso para el comité');
m.ok(/después del cierre/.test(v(cab({ generado: '2026-11-24T15:00:01-05:00' })).motivo), 'Un sobre generado un segundo después del cierre se rechaza');
m.ok(v(cab({ generado: '2026-11-24T15:00:00-05:00' })).ok, 'Un sobre generado en el instante del cierre se recibe');
m.ok(/adelante del reloj/.test(v(cab(), { ahora: new Date('2026-11-20T09:00:00-05:00').getTime() }).avisos.join(' ')), 'Un sobre con la hora adelantada se recibe con aviso');
m.ok(/razón social/.test(v(cab(), { nombreArchivo: 'otro_nombre.zip' }).avisos.join(' ')), 'Un archivo renombrado se recibe con aviso, porque manda el código de invitación');
const conf = v(cab({ tipo: 'confidencialidad', versionPliego: 1, generado: '2026-12-31T00:00:00-05:00' }));
m.ok(conf.ok, 'El sobre de confidencialidad no depende de la versión ni del cierre');

m.seccion('Recálculo con las cantidades del pliego');
const form = Paquete.formulario(pres, 'todas');
const acts = form.capitulos.flatMap((c) => c.subs.flatMap((s) => s.acts.map((a) => ({ c, s, a }))));
const poBien = { actividades: acts.map(({ c, s, a }, i) => ({ capitulo: c.codigo, subcapitulo: s.codigo, codigo: a.codigo, precioUnitario: 1000 + i * 10,
  apus: [{ codigo: 'APU-' + i, nombre: a.nombre, unidad: a.unidad, insumos: [{ descripcion: 'Material ' + i, unidad: a.unidad, categoria: 'Materiales', precio: 800 + i * 10, cantidad: 1 },
    { descripcion: 'Cuadrilla', unidad: 'día', categoria: 'Mano de Obra', precio: 200000, cantidad: 0.001 }] }] })), aiu: { a: 20, i: 4, u: 6 }, iva: { tarifa: 19, base: 'utilidad' } };
const declarado = Sobre.recalcular({ presupuesto: poBien }, form).totales;
const of = { presupuesto: Object.assign({}, poBien, { totales: declarado }) };
const rc = Sobre.recalcular(of, form);
m.ok(rc.diferencias.length === 0 && rc.diferenciasTotales.length === 0 && rc.faltantes.length === 0 && rc.totalDeclarado === rc.totales.total, 'Una oferta bien hecha se recalcula igual: ' + Util.money(rc.totales.total));
const of2 = JSON.parse(JSON.stringify(of));
of2.presupuesto.actividades[0].precioUnitario = 999999;
of2.presupuesto.totales.total += 5000;
const rc2 = Sobre.recalcular(of2, form);
m.ok(rc2.diferencias.length === 1 && rc2.diferencias[0].codigo === acts[0].a.codigo && rc2.diferenciasTotales.some((d) => d.concepto === 'total'), 'Un precio unitario que no es la suma de su APU y un total inflado se detectan');
const of3 = JSON.parse(JSON.stringify(of));
of3.presupuesto.actividades.pop();
of3.presupuesto.actividades.push({ capitulo: '9', subcapitulo: '9.1', codigo: '9.1.1', precioUnitario: 100, apus: [] });
const rc3 = Sobre.recalcular(of3, form);
m.ok(rc3.faltantes.length === 1 && rc3.sobrantes.length === 1, 'Una actividad sin precio y otra que no está en el pliego se detectan');
const of4 = JSON.parse(JSON.stringify(of));
of4.presupuesto.actividades.forEach((a) => { a.cantidad = 1; });
const rc4 = Sobre.recalcular(of4, form);
m.ok(Util.igualDinero(rc4.totales.total, rc.totales.total), 'Las cantidades que escriba el proponente no cuentan: mandan las del pliego');
let e3 = '';
try { Sobre.leerOferta('{"formato":"X"}'); } catch (e) { e3 = e.message; }
m.ok(/ARKEN-OFERTA/.test(e3), 'Un oferta.json con otro formato se rechaza');

m.seccion('Respuestas y adendas firmadas');
const resp = await Adendas.firmar(Adendas.archivoRespuestas({ proceso: 'DEMO-2026-001', numero: 1, versionPliego: 1, items: [{ pregunta: '¿Incluye retiro?', respuesta: 'Sí.' }] }), llaves.firma);
m.ok(await Adendas.verificarFirma(resp, llavesReg.publicaFirma) && !('autor' in resp.items[0]) && !JSON.stringify(resp).includes(invitados[0].razonSocial), 'El documento de respuestas verifica y no dice quién preguntó');
const respMal = JSON.parse(JSON.stringify(resp)); respMal.items[0].respuesta = 'No.';
m.ok(!(await Adendas.verificarFirma(respMal, llavesReg.publicaFirma)), 'Una respuesta cambiada después de firmar invalida la firma');
let e4 = '';
try { await Adendas.leerFirmado(JSON.stringify(respMal), Adendas.F_RESPUESTAS, 'DEMO-2026-001', llavesReg.publicaFirma); } catch (e) { e4 = e.message; }
m.ok(/no es auténtico o fue modificado/.test(e4), 'ARKEN OFERTA rechaza un documento de respuestas alterado');
let e5 = '';
try { await Adendas.leerFirmado(JSON.stringify(resp), Adendas.F_RESPUESTAS, 'OTRO-1', llavesReg.publicaFirma); } catch (e) { e5 = e.message; }
m.ok(/es del proceso/.test(e5), 'Y uno de otro proceso');
let e6 = '';
try { Adendas.leerPreguntas(JSON.stringify(Adendas.archivoPreguntas({ proceso: 'DEMO-2026-001', versionPliego: 1, invitado: pl.invitado, preguntas: [] })), 'DEMO-2026-001'); } catch (e) { e6 = e.message; }
m.ok(/no trae preguntas/.test(e6), 'Un archivo de preguntas vacío se rechaza');

m.seccion('Diferencias entre versiones del pliego');
const pres2 = JSON.parse(JSON.stringify(pres));
const a0 = pres2.capitulos[0].subs[0].acts[0];
a0.cantidad = Number(a0.cantidad) + 10;
pres2.capitulos[0].subs[0].acts.push(Object.assign({}, a0, { id: 'nueva', codigo: a0.codigo + '-B', nombre: 'Actividad nueva', apus: a0.apus }));
const req2 = requisitos.filter((r, i) => i !== 3);
const pl2 = Paquete.pliego(ctx({ presupuesto: pres2, requisitos: req2, proceso: Object.assign({}, proceso, { versionPliego: 2 }) }));
const dif = Adendas.diferencias(pl, pl2);
m.ok(dif.actividades.cambiadas.length === 1 && dif.actividades.nuevas.length === 1 && dif.requisitos.quitados.length === 1, 'Detecta la cantidad cambiada, la actividad nueva y el requisito quitado');
m.ok(dif.lista.some((x) => x.includes(a0.codigo) && /cantidad/.test(x)), 'La lista de cambios nombra la actividad y el campo: ' + dif.lista.find((x) => x.includes(a0.codigo)));
m.ok(!Adendas.soloProrroga(dif, pl, pl2), 'Cambiar cantidades no es una prórroga');
const inval = Adendas.invalidaciones(dif);
m.ok(inval.actividades.length === 1 && inval.actividadesNuevas.length === 1, 'Lo que queda para revisar en el borrador: la actividad cambiada y la nueva');
const cron2 = JSON.parse(JSON.stringify(cron));
const hc = cron2.hitos.find((h) => h.clave === 'cierre'); hc.fecha = '2026-12-15';
cron2.hitos.filter((h) => Cronograma.HITOS.map((x) => x[0]).indexOf(h.clave) > Cronograma.HITOS.map((x) => x[0]).indexOf('cierre') && h.fecha).forEach((h) => { h.fecha = '2026-12-30'; });
const plP = Paquete.pliego(ctx({ proceso: Object.assign({}, proceso, { cronograma: cron2, versionPliego: 2 }) }));
const difP = Adendas.diferencias(pl, plP);
m.ok(Adendas.soloProrroga(difP, pl, plP), 'Mover el cierre hacia adelante es una prórroga');
const cron3 = JSON.parse(JSON.stringify(cron)); cron3.hitos.find((h) => h.clave === 'cierre').fecha = '2026-11-04';
const plA = Paquete.pliego(ctx({ proceso: Object.assign({}, proceso, { cronograma: cron3 }) }));
m.ok(!Adendas.soloProrroga(Adendas.diferencias(pl, plA), pl, plA), 'Adelantar el cierre no es una prórroga');

m.seccion('Actas');
const sobres = [{ proponente: inv.razonSocial, archivo: 'a.zip', sha256: 'e'.repeat(64), recibido: '2026-11-20T10:00:00-05:00', estado: 'recibido sellado' },
  { proponente: inv.razonSocial, archivo: 'b.zip', sha256: 'f'.repeat(64), recibido: '2026-11-19T10:00:00-05:00', estado: 'reemplazado' }];
const bc = Actas.cierre({ proceso, empresa: Demo.EMPRESA, cierre: '2026-11-24T15:00:00-05:00', sobres, usuario: 'admin', fecha: '2026-11-24T15:05:00-05:00' });
const tc = JSON.stringify(bc);
m.ok(/ACTA DE CIERRE/.test(tc) && /quedan 1 sobre/.test(tc) && tc.includes('e'.repeat(64)), 'El acta de cierre lista cada archivo con su huella y cuenta los vigentes');
const ba = Actas.apertura({ proceso, empresa: Demo.EMPRESA, fecha: '2026-11-24T16:00:00-05:00', filas: [{ proponente: inv.razonSocial, declarado: 100, recalculado: 100, documentos: 3, novedades: [] }],
  rechazados: [], firmantes: [{ nombre: 'Comité uno', cargo: '', usuario: 'c1' }, { nombre: 'Comité dos', cargo: '', usuario: 'c2' }] });
const ta = JSON.stringify(ba);
m.ok(/ACTA DE APERTURA/.test(ta) && ta.includes('Comité uno') && ta.includes('Comité dos') && ta.includes(inv.razonSocial), 'El acta de apertura nombra a los dos miembros del comité y a cada proponente');

m.terminar();
