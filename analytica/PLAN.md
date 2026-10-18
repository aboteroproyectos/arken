# ARKEN ANALYTICA · Plan (una página)

## Arquitectura

- **Un solo código fuente, dos programas.** `analytica/fuente/` tiene el núcleo (sin pantalla: modelo, cálculo, Excel de ARKEN, festivos, NIT, criptografía, revisión de emisión, textos legales) y la interfaz del principal. `herramientas/construir.mjs` arma `programa/ARKEN_ANALYTICA.html` concatenando estilos, cuerpo, librerías y módulos. ARKEN OFERTA (Fase 2) se arma del mismo núcleo, así el proponente ve los mismos totales que el evaluador.
- **Sin internet.** Las librerías (jsPDF 2.5.1, jspdf-autotable 3.8.2, SheetJS 0.18.5, pdf.js 3.11.174 y JSZip 3.10.1) van **dentro** del HTML, tomadas de `node_modules` con versión fija. `npm run comprobar` falla si el HTML del repositorio no es exactamente el que sale de `fuente/`.
- **Patrón ARKEN.** Módulos con nombre propio (`const Calculo = (function(){ … })();`). El núcleo corre igual en el navegador y en Node (`node:vm`), que es como lo prueban las pruebas unitarias.
- **Pesado fuera del hilo de la pantalla.** Las huellas SHA-256 de archivos se calculan en un Web Worker.
- **Escritorio y móvil** (Electron, Capacitor) llegan en la Fase 4, como dice §26.

## Estructura de archivos

```
analytica/
  programa/ARKEN_ANALYTICA.html   ← producto armado (no se edita a mano; siempre sin datos)
  fuente/estilos.css · cuerpo.html
  fuente/nucleo/*.js              ← Util, Calculo, Nit, Festivos, ExcelArken, ExcelPrecios, Parametros,
                                     PlantillaCondiciones, Confidencialidad, Revision, Cripto, Demo
  fuente/app/*.js                 ← Almacen (IndexedDB), Sesion y Permisos, UI, Pdf, Documentos,
                                     Respaldo, Vistas de cada módulo, App
  herramientas/construir.mjs
  pruebas/ unitarias · cripto · ida-y-vuelta (con el ARKEN_CONTROL.html real) · humo
  PLAN · DECISIONES · CAMBIOS · GUIA_DE_PRUEBA · README
```

## Modelo de datos (IndexedDB `arken-analytica`, esquema 1)

Almacenes de §7: `empresa`, `procesos`, `presupuestosBase` (por proceso y versión, estructura exacta de ARKEN CONTROL más `cantidadIncierta`, `obligatorioApu`, `notas`), `basePrecios` (con historial), `requisitos`, `plantillasCondiciones`, `documentosProceso`, `archivos` (Blob por SHA-256), `invitados`, `confidencialidad`, `parametros`, `usuarios`, `auditoria` (solo agrega), `configuracion`, `llaves`. Los de las fases 2 a 4 (`sobres`, `ofertas`, `documentosOferta`, `evaluaciones`, `subsanaciones`, `alertas`, `conceptos`, `informes`, `actas`, `preguntas`, `adendas`) se crean ya vacíos, con sus índices, para no migrar después.

## Riesgos

1. **Contrato con ARKEN CONTROL.** Se mitiga copiando al pie de la letra `leerHojaExcel`, `ubicarColumnas`, `validarPresupuestoExcel` y `COLS_*_IMP`, y con la prueba de ida y vuelta contra el `programa/ARKEN_CONTROL.html` real.
2. **Textos legales** (acuerdo de confidencialidad, pliego): el programa los redacta, pero no se emiten sin la aprobación registrada de un abogado.
3. **Pérdida de llaves:** si se pierden la frase y su respaldo, ninguna oferta se abre. Por eso el respaldo es obligatorio antes de emitir.
4. **Fórmulas de Colombia Compra Eficiente:** el pliego las transcribe; la versión del documento tipo se registra por proceso y se vuelve a verificar al construir el puntaje (Fase 3).
5. **Tamaño:** el HTML pesa unos 3,5 MB por las librerías embebidas; a cambio funciona sin internet.
