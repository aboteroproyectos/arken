# ARKEN PRECIOS · Guía de prueba

Esta guía recorre lo que hace el programa y dice qué debe ver en cada paso. Las secciones 1 a 11 son de la Fase 1 y siguen valiendo; las secciones 12 a 18 son del Investigador IA (Fase 2). Si ya probó la Fase 1, vaya directo a la sección 12. Al final está el estado de cada criterio de aceptación del prompt (§18), con lo que se probó y lo que no.

## Antes de empezar

1. Descargue los dos programas de la rama de la Fase 2 (en cada enlace, botón «Download raw file»):
   - [ARKEN_PRECIOS.html](https://github.com/aboteroproyectos/arken/blob/arken-precios-fase-2/precios/programa/ARKEN_PRECIOS.html)
   - [ARKEN_CONTROL.html](https://github.com/aboteroproyectos/arken/blob/arken-precios-fase-2/programa/ARKEN_CONTROL.html) (el mismo de `main`; las fases 1 y 2 no lo cambian)
2. Haga la prueba en una **ventana de incógnito** de Chrome o Edge, con internet. Así no toca sus datos reales de ARKEN CONTROL, y al cerrar la ventana se borra todo lo de la prueba. La clave de API que escriba en la sección 12 también se borra al cerrar la ventana.
3. Para las secciones 12 a 18 necesita una **clave de API de Anthropic con saldo**. Créela en la consola de Claude (console.anthropic.com), de preferencia una solo para esta prueba y con un límite de gasto. Con Claude Opus 5.5, el programa estima de partida unos US$ 0,35 por insumo y ciudad, y hasta unos US$ 0,90 en el caso alto; estas secciones hacen entre tres y cinco búsquedas. Si su organización tiene apagadas en la consola la búsqueda web o la lectura de páginas, el programa lo dice en la primera búsqueda.

> Si prueba la importación en su ARKEN de trabajo, hágalo en un proyecto nuevo. Con la «lista maestra única» activa, sobrescribir un precio en un proyecto lo cambia en todos los proyectos que tengan ese insumo.

## 1. Ingreso y recorrido

1. Abra `ARKEN_PRECIOS.html` en la ventana de incógnito (arrástrelo a la ventana).
2. Ingrese con `admin` / `arken` y cambie la contraseña cuando se lo pida.
3. Recorra los módulos 00 a 11 de la columna izquierda y sus pestañas.

**Debe ver:** la portada y los módulos con el diseño de ARKEN CONTROL (los mismos colores, letras, tarjetas y tablas). Ningún módulo muestra un error. La Base de precios trae los 884 insumos del catálogo: los 334 de ARKEN que tienen precio salen con su precio de referencia (rótulo REF) y el resto «Sin dato», porque el programa no inventa precios.

## 2. Registrar precios reales

1. **04 · Cotizaciones › Registrar un precio.** En «Insumo» escriba `cemento gris tipo ug` y elíjalo. En «Soporte» pegue `Cemento gris uso general x 50 kg $ 35.200 IVA incluido` y pulse **Leer el precio del soporte**. Pulse **Guardar el precio**.
   **Debe ver:** el precio (35,200), el IVA («Sí») y la presentación (50 KG) se llenan solos, y debajo la cuenta por unidad del insumo con y sin IVA. Al guardar, en **01 · Base de precios** el cemento queda en $ 35,200.000 con confianza baja (es una sola observación).
2. **04 › Listas de precios › Importar Excel, CSV o PDF.** Use una lista de precios real de un proveedor (Excel, CSV o PDF con columnas de descripción y precio).
   **Debe ver:** la ventana «Revisar antes de guardar», con las columnas que el programa reconoció, cada renglón emparejado con un insumo del catálogo y su porcentaje de similitud. Nada se guarda hasta que escriba la fecha de la lista y pulse **Guardar los renglones marcados**. El balance dice cuántos precios entraron, cuántos son atípicos y cuántos ya existían; **Actualizar estos N insumos ahora** los lleva a la base.
3. **04 › Cotizaciones › Importar Excel, CSV o PDF** con una cotización real: igual que la lista, pero pide el proveedor.

## 3. Del precio a su soporte (criterio 2)

En **01 · Base de precios**, haga clic en el precio del cemento.

**Debe ver:** en un clic, la ficha del insumo abierta en «Observaciones», con la fecha, el texto literal («Cemento gris uso general x 50 kg $ 35.200 IVA incluido»), la fuente y el enlace cuando lo hay. Lo mismo desde el comparador (**06**).

## 4. Demostración y tablero (criterio 6)

1. **Administración › Demostración › Cargar la demostración.**
   **Debe ver:** una banda «DEMOSTRACIÓN» al pie de todas las pantallas y un corte «DEMO · Corte …». Los precios que salen de la demostración llevan el rótulo DEMO.
2. **00 · Tablero:** cambie a la vez el periodo, las ciudades, la categoría ARKEN y los grupos y categorías.
   **Debe ver:** el índice de la canasta («Base 100 = » el primer mes con datos), la variación mensual, la evolución y la comparación entre ciudades, recalculados al instante. Las gráficas se descargan en PNG o SVG, y el tablero en PDF.

## 5. Actualizar una categoría (criterio 3)

1. Registre un precio a mano (paso 2) para un insumo de **otra** categoría, por ejemplo una varilla, y desmarque «Actualizar este insumo en esta ciudad al guardar». Registre otro para un cemento, también sin actualizar.
2. **02 · Actualizar precios:** en el alcance elija **Por categorías** y marque solo la de los cementos; pulse **Ver la vista previa** y ejecute.

**Debe ver:** el antes y el después de los cementos solamente. La varilla sigue con su precio anterior y aparece en **01 · Base de precios** con el filtro «Con precios nuevos sin actualizar». En **Historial de ejecuciones** queda la ejecución, y ninguna observación se borra.

## 6. Mano de obra (criterio 10)

**05 · Mano de obra › Calculadora de costo empresa:** salario 1,750,905, clase de riesgo V, dotación por entrega 150,000, elementos de protección por mes 30,000, exonerado (art. 114-1 ET) y FIC marcados.

**Debe ver:** el desglose línea por línea con su norma, y **costo mensual $ 2,939,493.152**, **hora $ 13,997.586** (÷ 210 h) y **jornal $ 97,983.105** (7 h). Es el ejemplo hecho a mano de la prueba automática; vale la pena que su contador lo revise, porque es la misma cuenta para todos los oficios.

## 7. Excel para ARKEN e importación en ARKEN CONTROL (criterio 1)

1. En ARKEN PRECIOS: **08 · Exportar e imprimir › Excel para ARKEN CONTROL**. Siga el asistente: alcance «Toda la base», su ciudad y los precios vigentes o el corte. En «Opciones», marque **Incluir datos de demostración** (para que haya precios de mercado) y, si quiere el archivo completo, **Incluir los que solo tienen el precio de referencia de ARKEN**.
   **Debe ver:** en «Validación y vista previa», el archivo releído como lo lee ARKEN: 0 categorías inválidas, 0 precios en cero o no numéricos, 0 descripciones repetidas, 0 que cambiarían de unidad o categoría, y cuántos saldrán como «Ya existe» y cuántos como nuevos. El archivo se llama `ARKEN_PRECIOS_…_DEMO.xlsx` porque lleva datos de demostración.
2. En la misma ventana de incógnito, abra `ARKEN_CONTROL.html` en otra pestaña, ingrese con `admin` / `arken` y cree un proyecto nuevo con la semilla **En blanco**.
3. **Módulo 04 › Exportar / importar… › Importar desde Excel › Seleccionar archivo…** y elija el Excel.
   **Debe ver:** los mismos números del validador: los insumos que ARKEN ya tiene salen como «Ya existe», y como nuevos solo los del catálogo de ARKEN PRECIOS a los que usted les registró precio. Pulse **Sobrescribir todos los que coinciden**, **Importar** y confirme. Los precios cambian; la unidad y la categoría de cada insumo quedan iguales, y no aparece ningún insumo que no viniera en el archivo.

## 8. PDF e impresión (criterio 5)

1. **08 › PDF de la base**, primero con la base completa y luego con alcance **Por categorías** (por ejemplo, G02 · Cementos).
   **Debe ver:** documentos tamaño carta con portada, metodología, gráficas y anexo de fuentes; en cada página el encabezado y el pie de ARKEN y «Página x de y».
2. **08 › Imprimir la base:** se abre el diálogo de impresión del navegador; la vista previa también lleva «Página x de y».

## 9. Sin conexión (criterio 4)

Con el programa abierto, apague el wifi. Recorra los módulos, registre un precio, actualice ese insumo y genere el Excel para ARKEN.

**Debe ver:** todo funciona. «Actualizar precios» recalcula con lo registrado; en la Fase 1 no busca en internet.

## 10. Apariencia y celular (criterio 7)

1. **10 · Configuración › Apariencia:** pruebe el tema oscuro y las densidades compacta, normal y amplia.
2. Para ver el celular sin uno: pulse F12, active la barra de dispositivos (el ícono del teléfono) y ponga 360 de ancho.

**Debe ver:** el sistema visual de ARKEN en los dos temas. A 360 px la página no se desplaza de lado (las tablas sí, dentro de su recuadro) y la franja de indicadores queda visible debajo de la barra superior.

## 11. Respaldo y borrar la demostración

1. **Administración › Respaldos › Descargar respaldo.** Si quiere, restáurelo en otro navegador desde la pantalla de ingreso («Restaurar respaldo»).
2. En la banda DEMO, pulse **Borrar la demostración** y confirme.

**Debe ver:** desaparecen las observaciones, las fuentes y los cortes DEMO; los precios que registró usted en los pasos 2 y 5 siguen ahí.

## 12. Encender el Investigador IA

1. **10 · Configuración › Investigador IA.** Lea el aviso «Antes de escribir la clave».
2. Marque «Entiendo lo anterior y autorizo usar la clave de API en este navegador», pegue la clave, elija dónde se guarda y pulse **Guardar la clave**.
   **Debe ver:** el campo se vacía y la clave aparece solo con sus últimos cuatro caracteres. Sin la autorización, o con un texto que no empieza por `sk-ant-`, no se guarda.
3. Pulse **Probar la conexión**.
   **Debe ver:** «Conexión correcta» con el nombre del modelo. Esta prueba no tiene costo.
4. En «Modelo, límites y costo», ponga el tope de gasto del mes en 5 y, si quiere ver el costo en pesos, la TRM del día en «Pesos por dólar». Pulse **Guardar la configuración** y luego **Activar el Investigador IA**.
   **Debe ver:** el estado «activo» y el gasto del mes en US$ 0,00.

## 13. Buscar precios desde el Módulo 02

1. **02 · Actualizar precios.** En «¿Qué actualizar?» elija **Insumos seleccionados** y agregue tres insumos que se vendan en internet, por ejemplo «Cemento gris tipo UG (bulto 50 kg)», «Bloque de concreto 15x20x40» y «Pintura vinilo tipo 1 lavable». En «¿En qué ciudades?» deje solo su ciudad.
2. En la tarjeta «Investigador IA», marque **Buscar precios nuevos en internet con el Investigador IA antes de recalcular** y pulse **Ver la vista previa**.
   **Debe ver:** las búsquedas con IA (3), las solicitudes a la API, el costo estimado con su rango (y en pesos, si escribió la TRM) y el gasto del mes, antes de gastar nada.
3. Pulse **Buscar con IA y actualizar 3 insumo(s)**. Mientras corre, pruebe **Pausar** y **Reanudar**.
   **Debe ver:** el avance por categoría y por sitio, y el registro en vivo con cada búsqueda, cada página que se abre y cada precio con su verificación.
4. Al terminar:
   **Debe ver:** el costo real, el «Resultado por fuente» con los sitios leídos, y los botones **Revisar hallazgos**, **Revisar cambios en la base** y **Crear corte**. En **10 · Configuración › Investigador IA**, el gasto del mes sube en lo que costó.

## 14. Revisar hallazgos (criterio 9)

1. Pulse **Revisar hallazgos** y recorra las pestañas: Por revisar, Pendientes de verificar, Productos nuevos, Registrados y Descartados.
2. En **Registrados**, abra el enlace de cada precio y búsquelo en la página (Ctrl+F) junto con el texto literal.
   **Debe ver:** cada precio registrado está escrito en esa página. Los descartados dicen por qué, por ejemplo «El texto literal no aparece tal cual en la página leída». Si una tienda le muestra otro precio porque cambió la página o porque usted está en otra ciudad, el extracto guardado en la ficha muestra lo que se leyó.
3. En **Por revisar**, confirme uno con **Es el buscado** (o con el insumo sugerido) y rechace otro con **Rechazar**, dejando marcada «No volver a usar esta página…».
   **Debe ver:** el confirmado pasa a Registrados. El rechazado deja esa página como «rechazada» para ese insumo, y lo que traiga después se descarta.
4. Si hay un **Pendiente de verificar**, pulse **Verificar con el enlace…** y luego **Registrar** sin marcar «Abrí la página…».
   **Debe ver:** no lo deja registrar. Con la casilla marcada, entra como «confirmado por persona».

## 15. Del precio a su página

1. **01 · Base de precios:** haga clic en el precio de uno de los insumos buscados.
   **Debe ver:** la ficha en «Observaciones», con la observación del Investigador IA: el texto literal, el enlace a la página y la línea «Investigador IA · verificado en el texto de la página leída · huella …».
2. En la ficha, pestaña **Vínculos de producto**.
   **Debe ver:** las páginas de ese producto: automáticas (las que entraron solas), confirmadas y rechazadas, cuántas veces se vieron y el último precio.
3. En la ficha, pulse **Actualizar este insumo ahora**.
   **Debe ver:** dos opciones, **Solo recalcular** y **Buscar con IA y recalcular**, con el costo estimado. La búsqueda desde la ficha es solo para la ciudad de la ficha, siempre busca de nuevo y se puede detener.

## 16. Fuentes y productos nuevos

1. **03 · Fuentes › Fuentes propuestas.**
   **Debe ver:** los sitios nuevos donde el Investigador IA verificó precios, con las páginas leídas. Ninguno está activo: usted decide cuáles se aprueban.
2. **09 · Catálogo y equivalencias › Bandeja de nuevos**, si en la sección 14 hubo productos nuevos.
   **Debe ver:** la propuesta con el enlace a la página y el precio visto. Si la rechaza, sus hallazgos quedan descartados; si dice que es un insumo existente, pasan a «Por revisar» con ese insumo sugerido.

## 17. Tope de gasto

1. **10 · Configuración › Investigador IA:** ponga un tope del mes menor que lo ya gastado (si gastó US$ 0,80, por ejemplo, ponga 0,5) y guarde.
2. **02 · Actualizar precios.**
   **Debe ver:** la tarjeta del Investigador IA dice que ya se gastó el tope del mes y la actualización solo recalcula. Devuelva el tope a su valor.

## 18. La clave no sale del equipo (criterio 8)

1. **Administración › Respaldos › Guardar copia…** y abra el archivo `.html` descargado con el Bloc de notas. Busque `sk-ant`.
   **Debe ver:** no aparece. El respaldo (`.json.gz`) tampoco la lleva: lo comprueba la prueba automática.
2. Salga del programa y vuelva a entrar.
   **Debe ver:** si la usó solo en la sesión, el programa la olvidó. Si la guardó cifrada, sigue ahí.
3. Para terminar, en **10 · Configuración › Investigador IA** pulse **Borrar la clave** y **Apagar el Investigador IA**.

## Pruebas automáticas

En `precios/`, con Node 22 y Chrome: `npm ci --omit=optional` y luego `npm run prueba`; para el SDK, `npm run sdk:instalar` y `npm run sdk:comprobar`. Corren también en GitHub Actions (flujo «ARKEN PRECIOS») con cada cambio. Ninguna usa una clave real: la API de Claude se simula.

| Prueba | Resultado |
|---|---|
| `verificar-sin-datos` | El HTML del programa no trae datos ni claves. |
| `sdk:comprobar` | El SDK incrustado es idéntico al oficial rehecho desde versiones fijas. |
| `prueba:unitarias` | 72 de 72 |
| `prueba:investigador` | 125 de 125 en el núcleo y 59 de 59 de punta a punta en Chromium, con la API simulada |
| `prueba:ida-y-vuelta` | 29 de 29, con el `ARKEN_CONTROL.html` real |
| `prueba:humo` | 37 de 37, en Chromium |

## Estado de los criterios de aceptación (§18)

| # | Criterio | Estado | Cómo se probó | Lo que no se probó |
|---|---|---|---|---|
| 1 | El Excel se importa en ARKEN sin editarlo | **Probado** | Ida y vuelta: el Excel generado se importa en el `ARKEN_CONTROL.html` real, en un proyecto «En blanco». 0 categorías inválidas, 0 precios en cero o no numéricos, 0 descripciones repetidas; los 331 insumos de la semilla que van en el archivo salen «Ya existe», los 3 nuevos se crean con su categoría, unidad y precio, y al sobrescribir solo cambia el precio. Luego, con la lista maestra que exporta ARKEN, los 334 renglones salen «Ya existe». | La importación en un proyecto real suyo con la «lista maestra única» activa. |
| 2 | A lo sumo dos clics del precio a sus observaciones | **Probado** | Humo: un clic desde la Base y desde el comparador abre las observaciones con fecha, texto literal y enlace. | — |
| 3 | Actualizar una categoría no toca las demás ni borra historia | **Probado** | Humo, dos veces: desde el Módulo 02 por la interfaz (solo los cementos; los concretos de una cotización siguen pendientes y sin cambio) y con la demostración cargada (ningún otro consolidado cambia, el precio nuevo de la varilla queda pendiente y no se pierde ninguna observación ni cálculo anterior). | — |
| 4 | Sin conexión funciona todo menos actualizar | **Probado, con una condición** | Humo: con el programa abierto y sin red, se recorren los módulos, se registra, se recalcula y se genera el Excel para ARKEN sin ningún pedido a internet. Investigador: con el Investigador IA encendido y sin red, dice que no hay conexión con la API y la actualización recalcula con lo registrado. | Abrir el archivo por primera vez sin internet: las librerías de Excel y PDF vienen de cdnjs, como en ARKEN CONTROL, y entonces el Excel no está disponible y el PDF sale por la impresión del navegador. Las apps de la Fase 3 las traen incluidas. |
| 5 | PDF e impresión en carta, con encabezado, pie y «Página x de y» | **Probado** | Humo: el PDF completo y el de una categoría se leen con pdf.js (tamaño carta, «ARKEN» y «Página x de y» en cada página); la impresión fija `@page` carta con la numeración, y el PDF que sale de la impresión del navegador cumple lo mismo. | La impresión en una impresora física. |
| 6 | El tablero filtra por fechas, ciudades y categorías y responde en menos de 1 s con 50.000 observaciones | **Probado** | Unitarias: con 50.000 observaciones, construir los agregados y consultar toma décimas de segundo como mucho. Humo: demostración de más de 50.000 observaciones; tres consultas con los tres filtros a la vez y el cambio de categoría en pantalla, cada uno por debajo de 1 s. | En un computador lento. Se midió en el equipo de pruebas. |
| 7 | Sistema visual de ARKEN en claro, oscuro y tres densidades; 360 px sin desplazamiento lateral | **Probado** | El CSS se copia del `ARKEN_CONTROL.html`. Humo: los 12 módulos y la ficha a 360 px en los dos temas y las tres densidades, sin desplazamiento lateral. | Que «se vea como ARKEN» es un juicio a ojo: se revisaron capturas, pero su revisión es la definitiva. |
| 8 | Ningún texto externo sin escapar; ninguna clave en HTML, respaldos ni paquetes | **Probado** | Unitarias y humo: un proveedor y un texto con `<script>` e `<img onerror>` se pintan como texto, un enlace `javascript:` se descarta, y con una clave de API guardada ni el respaldo ni el paquete la llevan. El HTML del programa se verifica vacío en cada cambio. Investigador: el texto de una página con `<script>`, `<b>` e `<img onerror>` se ve escapado en la bandeja de hallazgos, en el catálogo y en las fuentes propuestas, sin ejecutarse; la clave queda cifrada en la base del navegador (AES-GCM, llave que no se exporta) y no aparece en el HTML, en localStorage ni sessionStorage, en el respaldo, en la copia ni en el registro técnico. | Que otro HTML abierto desde el disco en el mismo navegador no pueda usarla: no se puede impedir desde el programa, y el aviso lo dice (decisión 53). |
| 9 | La IA no puede crear un precio que no esté literalmente en una página leída | **Probado con la API simulada; no probado con la API real** | Investigador, núcleo: un precio que no está en el texto literal, un texto literal que no está en la página, una página que no se leyó, otra moneda, números cortados, separadores y Markdown. De punta a punta, con respuestas en streaming de la forma real: de cinco precios, entra solo el que está escrito en la página y es el insumo; el inventado se descarta con el motivo, el de una página no leída espera a una persona con el enlace y los dudosos esperan revisión. Además, el registro rechaza toda captura de método «ia» cuyo precio no esté en su texto. | Una búsqueda con una clave real y la API de verdad (secciones 12 a 18 de esta guía): las pruebas automáticas no usan clave. |
| 10 | La calculadora laboral reproduce un ejemplo hecho a mano con los parámetros de 2026 | **Probado** | Unitarias: cada línea del desglose y los totales coinciden con la cuenta a mano ($ 2,939,493.152 al mes, $ 13,997.586 la hora, $ 97,983.105 el jornal). La pantalla da las mismas cifras. | La revisión del contador de la empresa. |
