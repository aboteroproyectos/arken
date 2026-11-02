// ARKEN BANK · pruebas del núcleo: catálogo, matemática financiera, normas de vivienda,
// motor de viabilidad, coherencia entre documentos y concepto.
import { nucleo, afirmar, igual, terminar } from './comun.mjs';

const N = nucleo();
const { Catalogo, Bancos, Motor, Coherencia, Concepto, Demo } = N;
const HOY = '2026-11-02';
const bancos = Bancos.iniciales(HOY);
const P = Object.assign({}, Bancos.PARAMETROS);
const ctxVacio = (c) => ({ hoy: HOY, docs: Coherencia.estado(c, [], HOY), alertas: [] });
const cliente = (id) => Demo.clientes(HOY).find((c) => c.id === id);

console.log('Catálogo');
igual(Catalogo.TIPOS_CLIENTE.length, 7, 'siete tipos de cliente');
afirmar(Catalogo.productosPara('asalariado').some((p) => p.id === 'hipotecario') && Catalogo.productosPara('asalariado').some((p) => p.id === 'leasing_hab'), 'el asalariado puede pedir hipotecario y leasing habitacional');
afirmar(Catalogo.productosPara('constructora').some((p) => p.id === 'constructor'), 'la constructora puede pedir crédito constructor');
afirmar(!Catalogo.productosPara('asalariado').some((p) => p.id === 'constructor'), 'el asalariado no puede pedir crédito constructor');
const docsAsal = Catalogo.documentosRequeridos('asalariado', 'hipotecario').map((x) => x.doc.id);
afirmar(['cedula', 'cert_laboral', 'desprendibles', 'tradicion'].every((d) => docsAsal.includes(d)), 'hipotecario de asalariado pide cédula, certificado laboral, desprendibles y tradición');
const docsCons = Catalogo.documentosRequeridos('constructora', 'constructor').map((x) => x.doc.id);
afirmar(docsCons.includes('licencia_construccion') && docsCons.includes('cuadro_ventas'), 'crédito constructor pide licencia y certificación de preventas');
afirmar(!docsCons.includes('cert_laboral'), 'a la constructora no se le pide certificado laboral');

console.log('Matemática financiera');
const im = Motor.tasaMensual(12);
afirmar(Math.abs(Math.pow(1 + im, 12) - 1.12) < 1e-12, 'la tasa mensual equivale a la efectiva anual');
const c = Motor.cuota(100000000, im, 240);
afirmar(Math.abs(c - 1058623) < 5, 'cuota de $100 millones a 12 % E.A. y 20 años = $1.058.623 (' + Math.round(c) + ')');
const A = Motor.amortizacion(100000000, 12, 240, 0);
afirmar(Math.abs(A.filas[239].saldo) < 1, 'la tabla de amortización termina en saldo cero');
afirmar(Math.abs(A.filas.reduce((s, f) => s + f.abono, 0) - 100000000) < 1, 'los abonos suman el capital');
igual(Motor.cuota(1200, 0, 12), 100, 'sin interés, la cuota es capital entre meses');

console.log('Motor: persona natural');
const laura = cliente('cli_demo_laura');
const opsL = Motor.opciones(laura, bancos, P, ctxVacio(laura), 'hipotecario');
afirmar(opsL.length >= 9, 'Laura tiene opciones en los bancos que ofrecen hipotecario (' + opsL.length + ')');
afirmar(['viable', 'condicionado'].includes(opsL[0].dictamen), 'Laura es viable en su mejor opción (' + opsL[0].dictamen + ')');
const cfL = opsL[0].cifras;
afirmar(cfL.cuotaAprobable <= cfL.ingresos * P.cuotaIngresoLey546 / 100 + 1, 'la cuota de Laura respeta el 30 % del ingreso (Ley 546)');
afirmar(cfL.montoAprobable <= laura.perfil.valorInmueble * P.finNoVISLey546 / 100, 'el monto respeta el 70 % No VIS');
const carlos = cliente('cli_demo_carlos');
const rC = Motor.opciones(carlos, bancos, P, ctxVacio(carlos), 'leasing_hab')[0];
igual(rC.dictamen, 'ajustado', 'Carlos queda con monto ajustado');
afirmar(rC.cifras.montoAprobable < carlos.perfil.montoSolicitado && rC.cifras.montoAprobable > 0, 'el monto ajustado es menor que lo solicitado');
afirmar(rC.cifras.montoAprobable % 100000 === 0, 'el monto aprobable va en centenas de mil');
const marta = cliente('cli_demo_marta');
const rM = Motor.opciones(marta, bancos, P, ctxVacio(marta), 'hipotecario')[0];
afirmar(rM.cifras.plazoAnios < marta.perfil.plazoAnios, 'la edad de Marta recorta el plazo (' + rM.cifras.plazoAnios + ' años)');
const malo = JSON.parse(JSON.stringify(laura)); malo.perfil.reportesNegativos = true;
igual(Motor.opciones(malo, bancos, P, ctxVacio(malo), 'hipotecario')[0].dictamen, 'no_viable', 'un reporte negativo vigente hace no viable');
const emb = JSON.parse(JSON.stringify(laura)); emb.perfil.gravamenes = 'Embargo';
igual(Motor.opciones(emb, bancos, P, ctxVacio(emb), 'hipotecario')[0].dictamen, 'no_viable', 'un embargo en el certificado de tradición hace no viable');
const inc = JSON.parse(JSON.stringify(laura)); delete inc.perfil.ingresoMensual;
igual(Motor.opciones(inc, bancos, P, ctxVacio(inc), 'hipotecario')[0].dictamen, 'incompleto', 'sin ingreso, la información está incompleta');
const vis = JSON.parse(JSON.stringify(laura)); vis.perfil.valorInmueble = 150 * P.smmlv; vis.perfil.esVIS = true; vis.perfil.montoSolicitado = Math.round(vis.perfil.valorInmueble * 0.8);
const rV = Motor.opciones(vis, bancos, P, ctxVacio(vis), 'hipotecario')[0];
afirmar(rV.cifras.finMax === 80, 'en VIS la financiación máxima es el 80 %');

console.log('Motor: empresas');
const valle = cliente('cli_demo_valle');
const rVa = Motor.opciones(valle, bancos, P, ctxVacio(valle), 'constructor')[0];
afirmar(['viable', 'condicionado'].includes(rVa.dictamen), 'la constructora es viable en su mejor opción (' + rVa.dictamen + ')');
const sinLic = JSON.parse(JSON.stringify(valle)); sinLic.perfil.licenciaVigente = false;
igual(Motor.opciones(sinLic, bancos, P, ctxVacio(sinLic), 'constructor')[0].dictamen, 'no_viable', 'sin licencia de construcción, el crédito constructor no es viable');
const pocas = JSON.parse(JSON.stringify(valle)); pocas.perfil.unidadesVendidas = 20;
afirmar(Motor.opciones(pocas, bancos, P, ctxVacio(pocas), 'constructor')[0].criterios.some((x) => x.k === 'preventas' && x.estado === 'bad'), 'con pocas preventas falla el punto de equilibrio');
const alt = cliente('cli_demo_altamira');
const rA = Motor.opciones(alt, bancos, P, ctxVacio(alt), 'leasing_inmob')[0];
afirmar(rA.dictamen !== 'no_ofrece' && rA.cifras.dscr > 0, 'la empresa tiene opciones de leasing inmobiliario con su DSCR');
igual(Motor.evaluar(laura, bancos.find((b) => b.id === 'bco_fna'), 'constructor', P, ctxVacio(laura)).dictamen, 'no_ofrece', 'un crédito que no aplica al cliente sale como no ofrece');

console.log('Coherencia de documentos');
const docs = [{ tipoDoc: 'cert_laboral', fechaExpedicion: '2026-08-01', lectura: { datos: [{ campo: 'salario', normalizado: 11000000, valor: '$ 11.000.000' }] } },
  { tipoDoc: 'desprendibles', fechaExpedicion: '2026-10-20', lectura: { datos: [{ campo: 'salario', normalizado: 8000000, valor: '$ 8.000.000' }] } }];
const est = Coherencia.estado(laura, docs, HOY);
afirmar(est.vencidos.some((v) => /Certificado laboral/.test(v)), 'un certificado laboral de hace tres meses sale vencido');
afirmar(est.faltantes.length > 0 && est.avance < 100, 'faltan documentos obligatorios');
afirmar(Coherencia.alertas(laura, docs, P).some((a) => /desprendibles/.test(a.titulo)), 'alerta: el salario del certificado no coincide con los desprendibles');
const ctxD = { hoy: HOY, docs: est, alertas: [] };
afirmar(Motor.evaluar(laura, bancos[0], 'hipotecario', P, ctxD).criterios.some((x) => x.k === 'documentos'), 'el motor incluye el estado de los documentos en los criterios');

console.log('Concepto');
const sec = Concepto.redactar(laura, opsL[0], P);
const titulos = sec.map((s) => s.titulo);
afirmar(['Solicitud', 'Concepto', 'Capacidad de pago y monto', 'Alcance de este concepto'].every((t) => titulos.includes(t)), 'el concepto trae solicitud, dictamen, capacidad y alcance');
afirmar(/No es una aprobación/.test(sec.find((s) => s.titulo === 'Alcance de este concepto').parrafos[0]), 'el alcance aclara que no es una aprobación');
afirmar(!/undefined|NaN/.test(JSON.stringify(sec)), 'el texto no trae «undefined» ni «NaN»');
for (const c2 of Demo.clientes(HOY)) {
  for (const r of Motor.opciones(c2, bancos, P, ctxVacio(c2))) {
    const t = JSON.stringify(Concepto.redactar(c2, r, P));
    if (/undefined|NaN/.test(t)) { afirmar(false, `concepto limpio: ${c2.nombre} · ${r.banco} · ${r.producto}`); }
  }
}
afirmar(true, 'ningún concepto de la demostración (todos los créditos, todos los bancos) trae «undefined» ni «NaN»');
terminar('Pruebas del núcleo de ARKEN BANK');
