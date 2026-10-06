# ARKEN PRECIOS

Observatorio de precios de insumos de obra en Colombia, app hermana de [ARKEN CONTROL](../README.md). Guarda cada precio con su fuente, su fecha, su ciudad y el texto donde apareció; calcula por insumo y ciudad un precio recomendado con su nivel de confianza, y entrega un Excel que ARKEN CONTROL importa sin tocarlo (**Módulo 04 › Exportar / importar… › Importar desde Excel**).

**Estado:** Fase 2. Al núcleo de la Fase 1, que funciona sin internet (cotizaciones, listas de precios en Excel, CSV o PDF y registros a mano), se suma el **Investigador IA**: busca precios publicados en internet con la API de Claude y solo deja entrar los que están escritos en la página que leyó. El motor de recolección llega en la Fase 3. El plan está en [PLAN.md](PLAN.md), las decisiones en [DECISIONES.md](DECISIONES.md) y lo que cambió en [CAMBIOS.md](CAMBIOS.md).

## Abrirlo

1. Descargue [`programa/ARKEN_PRECIOS.html`](programa/ARKEN_PRECIOS.html) (en GitHub: abra el archivo y pulse «Download raw file»).
2. Ábralo con Chrome o Edge. No hay nada que instalar.
3. Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.

Las librerías de Excel y PDF (SheetJS, jsPDF y pdf.js) se cargan de internet al abrir el programa, como en ARKEN CONTROL. Si lo abre sin conexión, todo lo demás funciona: el Excel avisa que no está disponible y el PDF sale por la impresión del navegador. El SDK de Anthropic que usa el Investigador IA va dentro del archivo; el Investigador sí necesita internet.

## Cómo se guardan los datos

- Todo se guarda solo, en el navegador de ese equipo (IndexedDB). Otro navegador u otro equipo no ve esos datos.
- **Administración › Respaldos › Descargar respaldo** crea un archivo `ARKEN_PRECIOS_respaldo_<fecha>.json.gz` con todo; **Restaurar…** lo carga en este equipo o en otro, también desde la pantalla de ingreso. Descárguelo con frecuencia.
- **Guardar copia…** crea un `ARKEN_PRECIOS_copia_<fecha>.html` con el catálogo, las equivalencias, los parámetros y el corte activo adentro, para consultar esos precios en otro equipo. No lleva las observaciones ni los usuarios: no reemplaza el respaldo.
- La clave de API del Investigador IA se guarda solo si usted lo autoriza, cifrada y solo en ese navegador, o se usa solo durante la sesión. Nunca viaja en respaldos, copias ni paquetes: en otro equipo hay que escribirla de nuevo.

> **El repositorio es público.** Nunca suba un respaldo ni una copia con datos de la empresa. El `programa/ARKEN_PRECIOS.html` de esta carpeta va siempre vacío, y `npm run verificar-sin-datos` lo comprueba en cada cambio.

## Llevar los precios a ARKEN CONTROL

1. En ARKEN PRECIOS: **08 · Exportar e imprimir › Excel para ARKEN CONTROL**. Elija el alcance, la ciudad y el corte (o los precios vigentes).
2. El validador lee el archivo ya escrito como lo lee ARKEN: categorías válidas, precios mayores que cero, descripciones sin repetir, y cuántos renglones saldrán como «Ya existe». Si algo falla, no deja guardar.
3. En ARKEN CONTROL: abra el proyecto y vaya a **Módulo 04 › Exportar / importar… › Importar desde Excel › Seleccionar archivo…**.
4. Revise la lista: los insumos que ya existen salen como «Ya existe». Pulse **Sobrescribir todos los que coinciden**, luego **Importar** y confirme.

Al sobrescribir, ARKEN cambia solo el precio: la unidad y la categoría quedan iguales. Para que los códigos coincidan con los de un proyecto, exporte en ARKEN la lista maestra (**Módulo 04 › Excel — Lista maestra**) e impórtela en **09 · Catálogo y equivalencias › Lista maestra de ARKEN**.

## Investigador IA

Es opcional y se paga con su propia cuenta de Anthropic. Por cada insumo y ciudad, Claude busca en internet precios publicados, lee cada página y le entrega al programa el texto donde aparece el precio. El programa compara ese texto con la página leída:

- **Si el precio no está escrito en la página, se descarta.** La IA nunca escribe un precio en la base: lo que entra lo registra el programa, con la misma revisión que un precio a mano.
- Lo que es claramente el insumo buscado entra como observación, con el enlace, el texto literal y la huella de la página.
- Lo dudoso (otro producto parecido, la unidad, la ciudad) espera en **02 · Actualizar precios › Revisar hallazgos**, donde una persona lo confirma con la página a la vista. Lo que no se pudo leer (un PDF escaneado) queda pendiente hasta que alguien abra el enlace.
- Los productos que no están en el catálogo llegan a la bandeja de nuevos del Módulo 09, y los sitios nuevos a **03 · Fuentes › Fuentes propuestas**. Nada se activa solo.

**Para encenderlo** (administrador): **10 · Configuración › Investigador IA**. Lea el aviso, marque la autorización, escriba la clave de API (se crea en la consola de Claude, console.anthropic.com), elija si la guarda cifrada en el equipo o la usa solo en la sesión, pruebe la conexión y pulse **Activar el Investigador IA**. Ahí mismo están el modelo (Claude Opus 5.5 por defecto; Sonnet 5.5 y Haiku 4.5 cuestan menos), el esfuerzo, el tope de gasto del mes (US$ 10 por defecto) y los sitios permitidos o bloqueados.

**Costo:** antes de ejecutar, la vista previa muestra cuántas búsquedas hará, el costo estimado en dólares y lo gastado en el mes; después, el costo real. Al llegar al tope, se detiene. Lo buscado en la semana se reutiliza, y va primero lo que más pesa en el presupuesto.

> **Sobre la clave:** el programa la usa desde el navegador para llamar a la API de Claude, así que quien entre al programa en ese equipo puede lanzar búsquedas con ella. Abierto como archivo, Chrome y Edge comparten lo guardado con cualquier otro HTML que se abra desde el disco en ese navegador. Use una clave solo para este programa, con un límite de gasto en la consola de Claude, y abra en ese navegador solo archivos de confianza (o use la clave solo en la sesión).

## Módulos

| | Módulo | Para qué |
|---|---|---|
| 00 | Tablero | Índice de la canasta, evolución, comparación entre ciudades, mayores alzas y bajas, con filtros de fechas, ciudades y categorías. |
| 01 | Base de precios | Precio recomendado por insumo y ciudad, con su confianza; un clic lleva a las observaciones que lo sostienen. Cortes con fecha. La ficha de cada insumo tiene sus vínculos de producto y «Actualizar este insumo ahora», también con el Investigador IA. |
| 02 | Actualizar precios | Recalcula un alcance (todo, categorías o insumos) y muestra el antes y el después. Con el Investigador IA, antes busca precios en internet: vista previa con el costo, avance por categoría y por sitio, pausa y cancelación, y la bandeja **Revisar hallazgos**. |
| 03 | Fuentes | Fuentes con su tipo, confiabilidad y revisión legal, y las **fuentes propuestas** por el Investigador IA, que nunca se activan solas. |
| 04 | Cotizaciones | Cotizaciones, precios a mano, listas de precios (Excel, CSV o PDF) y solicitudes de cotización, siempre con revisión antes de guardar. |
| 05 | Mano de obra | Oficios por ciudad, calculadora del costo empresa con el desglose a la vista, cuadrillas y parámetros laborales con vigencia. |
| 06 | Comparador | Entre ciudades, entre cortes y entre fuentes. |
| 07 | Alertas | Llegan en la Fase 4. |
| 08 | Exportar e imprimir | Excel para ARKEN, Excel de análisis, PDF e impresión (completos o por categorías), paquete de precios, archivo de intercambio y respaldo. |
| 09 | Catálogo y equivalencias | 884 insumos (los 336 de ARKEN y 548 nuevos), grupos y categorías, equivalencias con ARKEN, lista maestra y bandeja de nuevos insumos (también los que encuentra el Investigador IA). |
| 10 | Configuración | Empresa, ciudades, consolidación, IVA, parámetros laborales, apariencia (tema y densidad) e Investigador IA (clave, modelo, tope de gasto y sitios). |
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
| `prueba:investigador` | El Investigador IA con la API de Claude simulada, nunca con una clave real: la verificación literal (ningún precio entra si no está escrito en la página leída), la solicitud, las pausas, los errores, el costo, el tope y el destino de cada hallazgo; y, en Chromium, la configuración y la clave cifrada, una búsqueda desde el Módulo 02, las bandejas, la ficha, que ninguna clave quede en el HTML ni en los respaldos, y que una base de la Fase 1 se actualice sin perder nada. |
| `prueba:ida-y-vuelta` | El Excel generado se importa en el `programa/ARKEN_CONTROL.html` real de este repositorio: todos los de la semilla salen «Ya existe» y al sobrescribir solo cambia el precio. |
| `prueba:humo` | Recorre todos los módulos en Chromium: captura de precios por la interfaz, demostración, tablero, exportaciones, impresión, sin conexión, temas, densidades y 360 px. |

El SDK de Anthropic que va dentro del programa se rehace desde versiones fijas y se compara con el del programa:

```sh
npm run sdk:instalar
npm run sdk:comprobar
```

Si Chrome no está en la ruta habitual, indíquela con `CHROME_PATH`. En GitHub, el flujo [`precios.yml`](../.github/workflows/precios.yml) corre todo esto con cada cambio en `precios/` o en `programa/ARKEN_CONTROL.html`.

La guía para probarlo a mano, paso a paso, está en [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md).
