# ARKEN ANALYTICA · Plan (una página)

## Arquitectura

- **Un solo código fuente, dos programas.** `analytica/fuente/` tiene el núcleo (sin pantalla: modelo, cálculo, Excel de ARKEN, festivos, NIT, criptografía, revisión de emisión, textos legales) y la interfaz del principal. `herramientas/construir.mjs` arma `programa/ARKEN_ANALYTICA.html` concatenando estilos, cuerpo, librerías y módulos. ARKEN OFERTA se arma del mismo núcleo, así el proponente ve los mismos totales que el evaluador. Su HTML viaja comprimido dentro del principal, que lo copia en cada paquete con el pliego del invitado.
- **Sin internet.** Las librerías (jsPDF 2.5.1, jspdf-autotable 3.8.2, SheetJS 0.18.5, pdf.js 3.11.174 y JSZip 3.10.1) van **dentro** del HTML, tomadas de `node_modules` con versión fija. `npm run comprobar` falla si el HTML del repositorio no es exactamente el que sale de `fuente/`.
- **Patrón ARKEN.** Módulos con nombre propio (`const Calculo = (function(){ … })();`). El núcleo corre igual en el navegador y en Node (`node:vm`), que es como lo prueban las pruebas unitarias.
- **Pesado fuera del hilo de la pantalla.** Las huellas SHA-256 de archivos se calculan en un Web Worker. El análisis de la Fase 3 (`Motor.analizar`) es una función pura sobre los datos del proceso; corre en el hilo de la pantalla con caché y se puede llevar a un Worker sin cambiarla (decisión 82).
- **Escritorio y móvil** (Electron, Capacitor) llegan en la Fase 4, como dice §26.

## Estructura de archivos

```
analytica/
  programa/ARKEN_ANALYTICA.html   ← producto armado (no se edita a mano; siempre sin datos)
  fuente/estilos.css · cuerpo.html
  fuente/nucleo/*.js              ← Util, Calculo, Nit, Festivos, ExcelArken, ExcelPrecios, Parametros,
                                     PlantillaCondiciones, Confidencialidad, Revision, Cripto, Demo
  fuente/nucleo/8x-*.js           ← Paquete, Sobre, Adendas, Actas (Fase 2)
  fuente/evaluacion/*.js          ← Estadistica, Presupuestal, Tecnico, Puntaje, Alertas, Motor, DemoOfertas (Fase 3;
                                     solo en el principal)
  fuente/app/*.js                 ← Almacen (IndexedDB), Sesion y Permisos, UI, Pdf, Documentos,
                                     Respaldo, Paquetes, Consultas, Recepcion, Evaluacion, Bandeja, Vistas, App
  fuente/oferta/*                 ← ARKEN OFERTA: cuerpo, estilos, almacén, verificación, borrador,
                                     intercambio, vistas y App
  herramientas/construir.mjs
  pruebas/ unitarias · cripto · nucleo-fase-2 · sobres-maliciosos · ida-y-vuelta (con el ARKEN_CONTROL.html real)
           · nucleo-fase-3 · humo · oferta · punta-a-punta · punta-a-punta-fase-3
  PLAN · DECISIONES · CAMBIOS · GUIA_DE_PRUEBA · README
```

## Modelo de datos (IndexedDB `arken-analytica`, esquema 1)

Almacenes de §7: `empresa`, `procesos`, `presupuestosBase` (por proceso y versión, estructura exacta de ARKEN CONTROL más `cantidadIncierta`, `obligatorioApu`, `notas`), `basePrecios` (con historial), `requisitos`, `plantillasCondiciones`, `documentosProceso`, `archivos` (Blob por SHA-256), `invitados`, `confidencialidad`, `parametros`, `usuarios`, `auditoria` (solo agrega), `configuracion`, `llaves`. Los de las fases 2 a 4 (`sobres`, `ofertas`, `documentosOferta`, `evaluaciones`, `subsanaciones`, `alertas`, `conceptos`, `informes`, `actas`, `preguntas`, `adendas`) se crean ya vacíos, con sus índices, para no migrar después.

## Riesgos

1. **Contrato con ARKEN CONTROL.** Se mitiga copiando al pie de la letra `leerHojaExcel`, `ubicarColumnas`, `validarPresupuestoExcel` y `COLS_*_IMP`, y con la prueba de ida y vuelta contra el `programa/ARKEN_CONTROL.html` real.
2. **Textos legales** (acuerdo de confidencialidad, pliego): el programa los redacta, pero no se emiten sin la aprobación registrada de un abogado.
3. **Pérdida de llaves:** si se pierden la frase y su respaldo, ninguna oferta se abre. Por eso el respaldo es obligatorio antes de emitir.
4. **Fórmulas de Colombia Compra Eficiente:** el pliego las transcribe; la versión del documento tipo se registra por proceso y se vuelve a verificar al construir el puntaje (Fase 3).
5. **Tamaño:** el principal pesa unos 4,2 MB por las librerías embebidas y ARKEN OFERTA comprimido; a cambio funciona sin internet.
6. **Reloj de los equipos:** el cierre depende del reloj de cada equipo. Se mitiga con la hora en el sobre, el aviso de reloj adelantado y la hora de recepción en el acta.
