// ARKEN PRECIOS · archivos de prueba del motor: los Excel del IDU y del DANE y un PDF de precios.
//
// Se arman en memoria con la misma forma que los archivos reales (hojas, filas, columnas y textos
// de los encabezados, revisados el 5 de octubre de 2026), pero con datos de prueba: no son
// precios del IDU ni índices del DANE.

import XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const FORMATO_PESOS = '"$ "#,##0';

function hojaDe(celdas, ref) {
  const ws = {};
  for (const [dir, valor, formato] of celdas) {
    if (valor === null || valor === undefined) continue;
    const c = typeof valor === 'number' ? { t: 'n', v: valor } : { t: 's', v: String(valor) };
    if (formato) c.z = formato;
    ws[dir] = c;
  }
  ws['!ref'] = ref;
  return ws;
}

function libro(hojas) {
  const wb = XLSX.utils.book_new();
  for (const [nombre, ws] of hojas) XLSX.utils.book_append_sheet(wb, ws, nombre);
  return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** Filas de la hoja de insumos de prueba: [grupo, código, nombre, UM, precio]. */
export const FILAS_IDU = [
  ['CONCRETOS Y MORTEROS PREMEZCLADOS', 324, 'CONCRETO GRAVA COMÚN 3000 PSI 21 MPa (210 Kg/cm2) PRUEBA', 'M3', 611111],
  ['EQUIPO PESADO', 1505, 'COMPACTADOR DE LLANTAS - MASA SIN LASTRES DE 9 A 11 TONELADAS - INCLUYE OPERARIO PRUEBA', 'HR', 199999],
  ['LADRILLOS, BLOQUES Y ADOQUINES', 2798, 'LADRILLO TOLETE COMUN RECOCIDO PRUEBA', 'UN', 888],
  ['AGREGADOS PÉTREOS, BASES Y SUBBASES GRANULARES', 2308, 'ARENA DE RIO LAVADA PRUEBA', 'M3', 133333],
  ['MALLAS Y ACEROS PARA REFUERZO', 1794, 'ALAMBRE RECOCIDO No.18 PRUEBA', 'KG', 5777],
];

/** Excel con la forma del visor de precios del IDU (hoja «Inusmos», encabezados en la fila 11). */
export function excelIdu(o = {}) {
  const hoja = o.hoja || 'Inusmos';
  const celdas = [
    ['A1', 'dtini2026'],
    ['B3', 'Precios de referencia'],
    ['E3', 'Insumos'],
    ['B5', 'Insumos (DATOS DE PRUEBA: no son precios del IDU)'],
    ['G7', 'Fecha de publicación: 4/09/2026'],
    ['G8', 'Fecha del último ajuste parcial: 28/09/2026'],
    ['G9', 'Ver resumen de fechas de publicación'],
    ['B11', 'Origen'],
    ['C11', 'Grupo de base de datos'],
    ['D11', 'Código'],
    ['E11', 'Nombre'],
    ['F11', 'UM'],
    ['G11', 'Precio'],
    ['H11', 'Fecha de Actualización '],
  ];
  FILAS_IDU.forEach(([grupo, codigo, nombre, um, precio], k) => {
    const f = 12 + k;
    celdas.push(['B' + f, 'Demanda'], ['C' + f, grupo], ['D' + f, codigo], ['E' + f, nombre], ['F' + f, um], ['G' + f, precio, FORMATO_PESOS], ['H' + f, 'Actualización 2026-I Fase I']);
  });
  const ultima = 12 + FILAS_IDU.length;
  celdas.push(['B' + (ultima + 1), 'Fin de la tabla de prueba']);
  return libro([
    ['Portada', hojaDe([['A1', 'Visor de precios (prueba)']], 'A1:A1')],
    ['Menu', hojaDe([['A1', 'Menú']], 'A1:A1')],
    [hoja, hojaDe(celdas, 'A1:H' + (ultima + 1))],
    ['APU', hojaDe([['A1', 'APU de prueba']], 'A1:A1')],
  ]);
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Dominios de prueba del Anexo 1, con el nombre como viene en los anexos (el último no existe). */
export const DOMINIOS_ANEXO1 = ['Valle del Aburra*', 'Barranquilla AM*', 'Bogotá_Cundinamarca AR*', 'Cartagena AU*', 'Bucaramanga AM*', 'Dominio Inventado AU*'];

/** Índice de prueba de la serie k en el mes m (0 = enero de 2025). */
export function indicePrueba(k, m) {
  return Math.round((110 + k * 2 + m * 0.5) * 1000) / 1000;
}

/** Excel con la forma de los anexos del ICOCED (Anexo 1 y Anexo 6.7). */
export function excelIcoced() {
  const col = (i) => XLSX.utils.encode_col(i);
  const a1 = [
    ['A3', 'Índice de Costos de la Construcción de Edificaciones - ICOCED (DATOS DE PRUEBA)'],
    ['A4', 'A1. ICOCED. Número índice y variación mensual, del año corrido y anual para el total y según dominios geográficos'],
    ['A5', 'Número índice base diciembre de 2021 = 100'],
    ['A6', '2025 -  2026'],
    ['A7', 'Año'],
    ['B7', 'Mes '],
    ['C7', 'Total'],
    ['G7', 'Dominio geográfico'],
    ['C10', 'Número índice'],
    ['D10', 'Variación (%)'],
    ['D11', 'Mensual'],
    ['E11', 'Año corrido'],
    ['F11', 'Anual'],
  ];
  const series = ['Total'].concat(DOMINIOS_ANEXO1);
  DOMINIOS_ANEXO1.forEach((d, k) => {
    const c = 6 + k * 4;
    a1.push([col(c) + '8', d], [col(c) + '10', 'Número índice'], [col(c + 1) + '10', 'Variación (%)'], [col(c + 1) + '11', 'Mensual'], [col(c + 2) + '11', 'Año corrido'], [col(c + 3) + '11', 'Anual']);
  });
  let fila = 12;
  for (let m = 0; m < 20; m++) {
    const anio = 2025 + Math.floor(m / 12);
    if (m % 12 === 0) a1.push(['A' + fila, String(anio)]);
    a1.push(['B' + fila, MESES[m % 12]]);
    series.forEach((s, k) => {
      const c = 2 + k * 4;
      const v = indicePrueba(k, m);
      a1.push([col(c) + fila, v]);
      a1.push([col(c + 1) + fila, m ? Math.round(((v / indicePrueba(k, m - 1)) - 1) * 100000) / 1000 : 0.5]);
      a1.push([col(c + 2) + fila, Math.round(((v / indicePrueba(k, Math.floor(m / 12) * 12)) - 1) * 100000) / 1000]);
      if (m >= 12) a1.push([col(c + 3) + fila, Math.round(((v / indicePrueba(k, m - 12)) - 1) * 100000) / 1000]);
    });
    fila++;
  }
  a1.push(['A' + (fila + 1), 'Fuente: DANE, ICOCED (DATOS DE PRUEBA)']);
  a1.push(['A' + (fila + 2), 'Villavicencio AU: Villavicencio']);
  const ultimaCol = col(2 + series.length * 4);

  const a67 = [
    ['A3', 'Índice de Costos de la Construcción de Edificaciones - ICOCED (DATOS DE PRUEBA)'],
    ['A4', 'A.6.7. ICOCED. Número índice variación y contribución mensual, del año corrido y anual del ICOCED según dominios geográficos total y grupos de costo'],
    ['A5', 'Número índice base diciembre de 2021 = 100'],
    ['A6', 'Agosto de 2026'],
    ['B6', 'Septiembre 2023'],
    ['A7', 'Dominio geográfico'],
    ['B7', 'Grupos de costos'],
    ['C7', 'Total y según dominio'],
    ['C10', 'Peso en %*'],
    ['D10', 'Número índice'],
    ['E10', 'Variación (%)'],
    ['H10', 'Contribución en p.p'],
    ['E11', 'Mensual'],
    ['F11', 'Año corrido'],
    ['G11', 'Anual'],
    ['H11', 'Mensual'],
    ['I11', 'Año corrido'],
    ['J11', 'Anual'],
  ];
  const grupos = [
    ['Materiales', 49.34],
    ['Mano de obra', 38.1],
    ['Maquinaria y equipo', 12.56],
  ];
  let f = 12;
  for (const [d, base] of [
    ['Total nacional', 120],
    ['Valle de Aburra AM', 125],
    ['Bucaramanga AM', 118],
  ]) {
    grupos.forEach(([g, peso], k) => {
      if (k === 0) a67.push(['A' + f, d]);
      a67.push(['B' + f, g], ['C' + f, peso], ['D' + f, base + k], ['E' + f, 0.1 * (k + 1)], ['F' + f, 2 + k], ['G' + f, 3 + k], ['H' + f, 0.01], ['I' + f, 0.9], ['J' + f, 1.1]);
      f++;
    });
  }
  a67.push(['A' + (f + 1), 'Fuente: DANE.'], ['A' + (f + 2), '* Peso del grupo en el total (prueba).'], ['A' + (f + 3), 'Actualizado el 30 de septiembre de 2026']);

  return libro([
    ['Índice', hojaDe([['A1', 'Índice de anexos (prueba)']], 'A1:A1')],
    ['Anexo 1', hojaDe(a1, 'A1:' + ultimaCol + (fila + 2))],
    ['Anexo 2.1', hojaDe([['A1', 'Otro anexo']], 'A1:A1')],
    ['Anexo 6.7', hojaDe(a67, 'A1:J' + (f + 3))],
  ]);
}

/** PDF de una lista de precios con columnas alineadas (como las de una entidad o un fabricante). */
export function pdfPrecios() {
  const d = new jsPDF({ unit: 'pt', format: 'a4' });
  d.setFontSize(10);
  d.text('LISTA DE PRECIOS DE PRUEBA - VIGENTE DESDE EL 1/10/2026', 40, 40);
  d.text('Código', 40, 80);
  d.text('Descripción', 100, 80);
  d.text('Unidad', 360, 80);
  d.text('Valor', 450, 80);
  const filas = [
    ['101', 'Cemento gris uso general 50 kg Prueba', 'BTO', '$ 33.333'],
    ['205', 'Tubo PVC sanitario 4" x 6 m Prueba', 'UN', '$ 88.888'],
    ['999', 'Servicio de transporte Prueba', 'VIAJE', 'A convenir'],
  ];
  filas.forEach(([c, t, u, v], k) => {
    const y = 100 + k * 18;
    d.text(c, 40, y);
    d.text(t, 100, y);
    d.text(u, 360, y);
    d.text(v, 450, y);
  });
  return new Uint8Array(d.output('arraybuffer'));
}
