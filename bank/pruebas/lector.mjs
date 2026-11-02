// ARKEN BANK · pruebas del lector de documentos: clasificación de cada documento de ejemplo,
// datos que se leen con su evidencia, fechas y cifras en los formatos colombianos, y el paso
// de los datos al perfil.
import { nucleo, afirmar, igual, terminar } from './comun.mjs';

const N = nucleo();
const { Lector, Catalogo, Demo } = N;
const HOY = '2026-11-02';

console.log('Clasificación y lectura de los documentos de ejemplo');
for (const d of Demo.documentos(HOY)) {
  const paginas = [d.lineas.join('\n')];
  const cl = Lector.clasificar(paginas);
  igual(cl && cl.id, d.tipoDoc, `«${d.nombre}» se reconoce como ${d.tipoDoc}`);
  const def = Catalogo.documento(d.tipoDoc);
  const datos = Lector.leer(paginas, def.lee);
  const encontrados = datos.filter((x) => !x.motivo || x.campo === 'gravamenes').map((x) => x.campo);
  const faltan = Lector.faltantes(datos, def.lee);
  afirmar(encontrados.length > 0, `  ${encontrados.length} dato(s) leídos${faltan.length ? ' · no están en el texto: ' + faltan.join(', ') : ''}`);
  afirmar(datos.every((x) => x.pagina === 1 && typeof x.texto === 'string' && x.texto.length > 0), '  cada dato trae su página y su texto literal');
}

console.log('Cifras y fechas');
igual(Lector.numero('$ 11.000.000'), 11000000, 'pesos con puntos de miles');
igual(Lector.numero('11,000,000.50'), 11000000.5, 'pesos con comas de miles y punto decimal');
igual(Lector.numero('$ 1.234.567,89'), 1234567.89, 'pesos con coma decimal');
igual(Lector.fechaIso('3 de octubre de 2026'), '2026-10-03', 'fecha escrita en letras');
igual(Lector.fechaIso('03/10/2026'), '2026-10-03', 'fecha dd/mm/aaaa');
igual(Lector.fechaIso('2026-10-03'), '2026-10-03', 'fecha ISO');

console.log('Certificado laboral leído y pasado al perfil');
const cert = ['EMPRESA EJEMPLO S.A.S.', 'NIT 900.123.456-7', 'CERTIFICA QUE:', 'El señor JUAN PÉREZ, identificado con cédula de ciudadanía No. 1.020.304.050,',
  'labora en esta empresa desde el 15 de marzo de 2019, con contrato a término indefinido,', 'desempeñando el cargo de Analista, devengando un salario básico mensual de $ 6.500.000.',
  'Se expide en Bogotá el 20 de octubre de 2026.'].join('\n');
const L = Lector.leer([cert], Catalogo.documento('cert_laboral').lee);
const v = (k) => (L.find((x) => x.campo === k) || {}).normalizado;
igual(v('salario'), 6500000, 'salario');
igual(v('fecha_ingreso'), '2019-03-15', 'fecha de ingreso');
igual(v('fecha_expedicion'), '2026-10-20', 'fecha de expedición');
afirmar(/indefinido/i.test(String((L.find((x) => x.campo === 'tipo_contrato') || {}).valor)), 'tipo de contrato');
const prop = Lector.propuesta(L.find((x) => x.campo === 'salario'), 'asalariado', L);
igual(prop && prop.k, 'ingresoMensual', 'el salario propone el ingreso mensual del perfil');
igual(prop && prop.valor, 6500000, 'con el valor leído');

console.log('Certificado de tradición');
const trad = ['CERTIFICADO DE TRADICIÓN Y LIBERTAD DE MATRÍCULA INMOBILIARIA', 'Matrícula: 001-1234567', 'ANOTACIÓN Nro 5: HIPOTECA ABIERTA', 'ANOTACIÓN Nro 6: EMBARGO EJECUTIVO'].join('\n');
const G = Lector.leer([trad], ['gravamenes']).map((x) => x.valor);
afirmar(G.includes('Embargo') && G.includes('Hipoteca'), 'encuentra la hipoteca y el embargo (' + G.join(', ') + ')');
terminar('Pruebas del lector de ARKEN BANK');
