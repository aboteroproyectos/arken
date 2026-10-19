// ARKEN ANALYTICA · pruebas del lector de documentos (§18.13), en Node, sin internet:
//
//   · encuentra fechas, valores, NIT, porcentajes, áreas, nombres, textos, matrículas e indicadores
//     financieros por sus etiquetas usuales, sin importar mayúsculas ni tildes
//   · cada dato sale con un fragmento que está en el documento y la página donde está
//   · no confunde «total activo no corriente» con el activo total ni «pasivo y patrimonio» con el
//     patrimonio; en estados de dos columnas toma la primera
//   · fechas y cifras escritas a la colombiana se convierten bien; un paréntesis es negativo
//   · un PDF sin texto (escaneado) no da datos; el lector no hace ninguna conexión
//
// Uso: npm run prueba:lector

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nucleo, marcador, ANALYTICA } from './comun.mjs';

const { LectorLocal: L } = nucleo();
const m = marcador('Lector de documentos');

const PAGINAS = [
  `CÁMARA DE COMERCIO DE MEDELLÍN PARA ANTIOQUIA (DEMO)
CERTIFICADO DE EXISTENCIA Y REPRESENTACIÓN LEGAL
Fecha de expedición: 9 de octubre de 2026
Razón social: CONSTRUCTORA DEMO DELTA S.A.S.
NIT: 999.000.004-1
OBJETO SOCIAL: La sociedad tendrá como objeto principal la construcción de obras civiles y edificaciones. Podrá además comercializar materiales.
REPRESENTANTE LEGAL: JUAN CARLOS PÉREZ GÓMEZ identificado con C.C. 99.999.999
FACULTADES: El gerente podrá celebrar contratos hasta por 5.000 SMMLV sin autorización de la junta directiva.`,
  `PÓLIZA DE SERIEDAD DE LA OFERTA (DEMO)
Valor asegurado: $ 145.300.000
Vigencia desde 01/10/2026 hasta 30/01/2027`,
  `ESTADO DE SITUACION FINANCIERA A 31 DE DICIEMBRE (DEMO)
Activo corriente 2.345.678.000 2.100.000.000
Total activo no corriente 900.000.000
Total activos 3.245.678.000 3.000.000.000
Pasivo corriente 1.100.000.000 1.000.000.000
Total pasivos 1.500.000.000
Total pasivo y patrimonio 3.245.678.000
Total patrimonio 1.745.678.000
Utilidad operacional (120.500.000)
Gastos financieros 45.000.000`,
  `CERTIFICADO DE EXPERIENCIA (DEMO)
Contratante: ALCALDÍA DE ENVIGADO
Objeto del contrato: Construcción de la sede administrativa del barrio La Paz, incluida la urbanización.
Valor del contrato: $1.234.567.890,50
Fecha de inicio: marzo 15 de 2023  Fecha de terminación: 2024-06-30
Área construida: 2.450 m2
Porcentaje de participación: 60 %
Matrícula profesional No. 05202-123456 ANT`,
];
const todos = L.CAMPOS.map((c) => c.k);
const D = L.leer(PAGINAS, todos, 'razón social');
const uno = (k) => D.find((d) => d.campo === k) || {};

m.seccion('Cada dato con su fragmento y su página');
const enDoc = D.every((d) => L.plano(PAGINAS[d.pagina - 1]).includes(d.texto) && d.texto.includes(d.valor));
m.ok(D.length >= 23 && enDoc, 'Los ' + D.length + ' datos traen un fragmento que está en su página, y el valor está dentro del fragmento');
m.ok(!L.faltantes(D, todos).length, 'Encuentra todos los datos del ejemplo');
m.ok(todos.every((k) => D.filter((d) => d.campo === k).length <= 3), 'Hasta tres coincidencias por dato, la mejor primero');

m.seccion('Jurídico');
m.ok(uno('fecha_expedicion').valor === '9 de octubre de 2026' && uno('fecha_expedicion').normalizado === '2026-10-09' && uno('fecha_expedicion').pagina === 1, 'Fecha de expedición en letras: 9 de octubre de 2026 → 2026-10-09');
m.ok(uno('nit').valor === '999.000.004-1' && uno('nit').normalizado === '9990000041', 'NIT con su dígito de verificación');
m.ok(uno('representante_legal').valor === 'JUAN CARLOS PÉREZ GÓMEZ', 'El nombre del representante legal termina antes de «identificado con C.C.»');
m.ok(/^La sociedad tendrá como objeto principal .* edificaciones\.$/.test(uno('objeto_social').valor), 'El objeto social: la frase completa, hasta el punto');
m.ok(/^El gerente podrá celebrar contratos hasta por 5\.000 SMMLV/.test(uno('facultades').valor), 'Las facultades del representante legal');
m.ok(uno('valor_asegurado').normalizado === 145300000 && uno('valor_asegurado').pagina === 2, 'Valor asegurado de la póliza: $ 145.300.000');
m.ok(uno('vigencia_desde').normalizado === '2026-10-01' && uno('vigencia_hasta').normalizado === '2027-01-30', 'Vigencia desde y hasta en dd/mm/aaaa (día antes que mes)');

m.seccion('Financiero');
m.ok(uno('activo_corriente').normalizado === 2345678000, 'Activo corriente: la primera columna (el año más reciente)');
m.ok(uno('activo_total').normalizado === 3245678000, '«Total activo no corriente» no se toma como activo total');
m.ok(uno('pasivo_corriente').normalizado === 1100000000 && uno('pasivo_total').normalizado === 1500000000, 'Pasivo corriente y pasivo total, cada uno con su fila');
m.ok(uno('patrimonio').normalizado === 1745678000 && !D.some((d) => d.campo === 'patrimonio' && d.normalizado === 3245678000), '«Total pasivo y patrimonio» no se toma como patrimonio');
m.ok(uno('utilidad_operacional').normalizado === -120500000, 'Una cifra entre paréntesis es negativa');
m.ok(uno('gastos_intereses').normalizado === 45000000, 'Gastos de intereses por «gastos financieros»');

m.seccion('Experiencia y personal');
m.ok(uno('contratante').valor === 'ALCALDÍA DE ENVIGADO', 'Contratante del certificado');
m.ok(/^Construcción de la sede administrativa/.test(uno('objeto_contrato').valor) && D.filter((d) => d.campo === 'objeto_contrato').length === 1, 'El objeto del contrato, sin confundirlo con el objeto social');
m.ok(uno('valor_contrato').normalizado === 1234567890.5, 'Valor del contrato con centavos: $1.234.567.890,50');
m.ok(uno('fecha_inicio').normalizado === '2023-03-15' && uno('fecha_terminacion').normalizado === '2024-06-30', 'Fechas «marzo 15 de 2023» y «2024-06-30» en la misma línea, cada una con su etiqueta');
m.ok(uno('area_construida').normalizado === 2450 && uno('participacion').normalizado === 60, 'Área construida en m2 y porcentaje de participación');
m.ok(uno('matricula_profesional').valor === '05202-123456', 'Matrícula profesional');
m.ok(uno('otro').valor === 'CONSTRUCTORA DEMO DELTA S.A.S.' && uno('otro').pagina === 1, '«Otro dato»: lo que sigue a la palabra que escribe el evaluador, sin importar tildes');

m.seccion('Casos difíciles');
const sinTexto = L.leer(['', '  '], todos, 'x');
m.ok(sinTexto.length === 0, 'Un PDF escaneado (sin texto) no da datos');
const una = L.leer(['Poliza DEMO. VALOR ASEGURADO $52.400.000. Vigente hasta el 30 de marzo de 2027. Pagina 1 de 1'], ['valor_asegurado', 'vigencia_hasta']);
m.ok(una.find((d) => d.campo === 'valor_asegurado').normalizado === 52400000 && una.find((d) => d.campo === 'vigencia_hasta').normalizado === '2027-03-30', 'Texto en una sola línea, en mayúsculas y sin tildes');
const fechas = ['15/03/2024', '2024-03-15', '15 de marzo de 2024', 'marzo 15 de 2024', '15 marzo 2024'].map(L.fechaIso);
m.ok(fechas.every((f) => f === '2024-03-15') && L.fechaIso('31/13/2024') === null, 'Fechas de las formas usuales; un mes 13 no es fecha');
m.ok(L.numero('1.234.567,89') === 1234567.89 && L.numero('1,234,567.89') === 1234567.89 && L.numero('$ 2.000.000') === 2000000 && L.numero('(5.000)') === -5000, 'Cifras con punto de miles o con coma de miles');
const anios = L.leer(['Valor del contrato: 2024 por definir'], ['valor_contrato']);
m.ok(!anios.length, 'Un año suelto no se toma como un valor');

m.seccion('Sin internet');
const fuente = readFileSync(join(ANALYTICA, 'fuente', 'evaluacion', '95-lector.js'), 'utf8') + readFileSync(join(ANALYTICA, 'fuente', 'app', '24-lector.js'), 'utf8');
m.ok(!/fetch\(|XMLHttpRequest|https?:\/\/|WebSocket/.test(fuente), 'El lector no hace ninguna conexión');
const html = readFileSync(join(ANALYTICA, 'programa', 'ARKEN_ANALYTICA.html'), 'utf8');
m.ok(!/api\.anthropic\.com|arken-analytica-sdk|AnthropicSDK/.test(html) && /connect-src blob: data:;/.test(html.match(/Content-Security-Policy" content="[^"]*"/)[0]), 'El programa no trae el SDK de Anthropic y su política de seguridad no deja salir a internet');

m.terminar();
