# ARKEN PRECIOS

Observatorio de precios de insumos de obra en Colombia, app hermana de [ARKEN CONTROL](../README.md). Guarda cada precio con su fuente, su fecha, su ciudad y el texto donde apareció; calcula por insumo y ciudad un precio recomendado con su nivel de confianza, y entrega un Excel que ARKEN CONTROL importa sin tocarlo (**Módulo 04 › Exportar / importar… › Importar desde Excel**).

**Estado:** Fase 1, el núcleo que funciona sin internet. Los precios entran por cotizaciones, listas de precios (Excel, CSV o PDF) y registros a mano. La búsqueda en la red llega con el Investigador IA (Fase 2) y el motor de recolección (Fase 3). El plan está en [PLAN.md](PLAN.md), las decisiones en [DECISIONES.md](DECISIONES.md) y lo que cambió en [CAMBIOS.md](CAMBIOS.md).

## Abrirlo

1. Descargue [`programa/ARKEN_PRECIOS.html`](programa/ARKEN_PRECIOS.html) (en GitHub: abra el archivo y pulse «Download raw file»).
2. Ábralo con Chrome o Edge. No hay nada que instalar.
3. Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.

Las librerías de Excel y PDF (SheetJS, jsPDF y pdf.js) se cargan de internet al abrir el programa, como en ARKEN CONTROL. Si lo abre sin conexión, todo lo demás funciona: el Excel avisa que no está disponible y el PDF sale por la impresión del navegador.

## Cómo se guardan los datos

- Todo se guarda solo, en el navegador de ese equipo (IndexedDB). Otro navegador u otro equipo no ve esos datos.
- **Administración › Respaldos › Descargar respaldo** crea un archivo `ARKEN_PRECIOS_respaldo_<fecha>.json.gz` con todo; **Restaurar…** lo carga en este equipo o en otro, también desde la pantalla de ingreso. Descárguelo con frecuencia.
- **Guardar copia…** crea un `ARKEN_PRECIOS_copia_<fecha>.html` con el catálogo, las equivalencias, los parámetros y el corte activo adentro, para consultar esos precios en otro equipo. No lleva las observaciones ni los usuarios: no reemplaza el respaldo.
- Las claves de API no viajan nunca en respaldos, copias ni paquetes.

> **El repositorio es público.** Nunca suba un respaldo ni una copia con datos de la empresa. El `programa/ARKEN_PRECIOS.html` de esta carpeta va siempre vacío, y `npm run verificar-sin-datos` lo comprueba en cada cambio.

## Llevar los precios a ARKEN CONTROL

1. En ARKEN PRECIOS: **08 · Exportar e imprimir › Excel para ARKEN CONTROL**. Elija el alcance, la ciudad y el corte (o los precios vigentes).
2. El validador lee el archivo ya escrito como lo lee ARKEN: categorías válidas, precios mayores que cero, descripciones sin repetir, y cuántos renglones saldrán como «Ya existe». Si algo falla, no deja guardar.
3. En ARKEN CONTROL: abra el proyecto y vaya a **Módulo 04 › Exportar / importar… › Importar desde Excel › Seleccionar archivo…**.
4. Revise la lista: los insumos que ya existen salen como «Ya existe». Pulse **Sobrescribir todos los que coinciden**, luego **Importar** y confirme.

Al sobrescribir, ARKEN cambia solo el precio: la unidad y la categoría quedan iguales. Para que los códigos coincidan con los de un proyecto, exporte en ARKEN la lista maestra (**Módulo 04 › Excel — Lista maestra**) e impórtela en **09 · Catálogo y equivalencias › Lista maestra de ARKEN**.

## Módulos

| | Módulo | Para qué |
|---|---|---|
| 00 | Tablero | Índice de la canasta, evolución, comparación entre ciudades, mayores alzas y bajas, con filtros de fechas, ciudades y categorías. |
| 01 | Base de precios | Precio recomendado por insumo y ciudad, con su confianza; un clic lleva a las observaciones que lo sostienen. Cortes con fecha. |
| 02 | Actualizar precios | Recalcula un alcance (todo, categorías o insumos) con las observaciones registradas y muestra el antes y el después. |
| 03 | Fuentes | Fuentes con su tipo, confiabilidad y revisión legal. |
| 04 | Cotizaciones | Cotizaciones, precios a mano, listas de precios (Excel, CSV o PDF) y solicitudes de cotización, siempre con revisión antes de guardar. |
| 05 | Mano de obra | Oficios por ciudad, calculadora del costo empresa con el desglose a la vista, cuadrillas y parámetros laborales con vigencia. |
| 06 | Comparador | Entre ciudades, entre cortes y entre fuentes. |
| 07 | Alertas | Llegan en la Fase 4. |
| 08 | Exportar e imprimir | Excel para ARKEN, Excel de análisis, PDF e impresión (completos o por categorías), paquete de precios, archivo de intercambio y respaldo. |
| 09 | Catálogo y equivalencias | 884 insumos (los 336 de ARKEN y 548 nuevos), grupos y categorías, equivalencias con ARKEN y lista maestra. |
| 10 | Configuración | Empresa, ciudades, consolidación, IVA, parámetros laborales y apariencia (tema y densidad). |
| 11 | Ayuda | Cómo funciona cada parte. |

## Demostración

**Administración › Demostración › Cargar la demostración** genera precios sintéticos para los insumos que tienen precio de referencia de ARKEN, en varias ciudades y meses, para ver el tablero y los informes con datos. Todo queda rotulado DEMO, una banda al pie de cada pantalla lo recuerda, no se exporta salvo que se marque y **Borrar la demostración** lo quita sin tocar los precios reales.

## Pruebas

Requieren Node 22 y Chrome o Chromium. Desde esta carpeta:

```sh
npm ci --omit=optional
npm run prueba
```

| Prueba | Qué comprueba |
|---|---|
| `verificar-sin-datos` | El HTML del programa no trae datos de la empresa ni claves. |
| `prueba:unitarias` | Lector de precios (60 formatos), unidades, IVA y AIU, estadísticos y confianza, emparejamiento, calculadora laboral contra el ejemplo hecho a mano, validador del Excel para ARKEN, escape de textos y claves, y el tablero con 50.000 observaciones. |
| `prueba:ida-y-vuelta` | El Excel generado se importa en el `programa/ARKEN_CONTROL.html` real de este repositorio: todos los de la semilla salen «Ya existe» y al sobrescribir solo cambia el precio. |
| `prueba:humo` | Recorre todos los módulos en Chromium: captura de precios por la interfaz, demostración, tablero, exportaciones, impresión, sin conexión, temas, densidades y 360 px. |

Si Chrome no está en la ruta habitual, indíquela con `CHROME_PATH`. En GitHub, el flujo [`precios.yml`](../.github/workflows/precios.yml) corre las cuatro con cada cambio en `precios/` o en `programa/ARKEN_CONTROL.html`.

La guía para probarlo a mano, paso a paso, está en [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md).
