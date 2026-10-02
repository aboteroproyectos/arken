# ARKEN PRECIOS · Decisiones y supuestos

Lo que el prompt maestro deja a criterio profesional quedó decidido así. Cada decisión dice por qué.

## Repositorio y estructura

1. **ARKEN PRECIOS vive en la carpeta `precios/` del repositorio `aboteroproyectos/arken`**, junto a `programa/`, en la rama `arken-precios-fase-1`, con un PR en borrador. Nada llega a `main` hasta que usted lo apruebe. *Por qué:* las pruebas de ida y vuelta abren el `programa/ARKEN_CONTROL.html` real del mismo repositorio, y la Fase 3 puede mover la carpeta a un repositorio propio sin cambiar nada del programa.
2. **El programa es un solo HTML y es la fuente de verdad**, como ARKEN CONTROL: no hay paso de compilación. Por dentro tiene tres bloques `<script>`: `arken-precios-nucleo` (cálculo puro, sin pantalla), `arken-precios-semilla` (catálogo y parámetros de partida) y la interfaz. *Por qué:* el núcleo corre igual en la página, en el Web Worker del tablero (se crea a partir del texto de ese mismo bloque) y en las pruebas de Node, que lo leen del HTML. Una sola copia del código.
3. **Las librerías se cargan de cdnjs con versión fija**, las mismas de ARKEN: jsPDF 2.5.1, jspdf-autotable 3.8.2, SheetJS 0.18.5 y pdf.js 3.11.174 (html2canvas no se usa: las gráficas son SVG). Sin ellas, el PDF sale por la impresión del navegador y el Excel avisa que no está disponible; en las apps de la Fase 3 se sirven desde la propia app, como hace `herramientas/preparar-web.mjs` en ARKEN.

## Contrato con ARKEN CONTROL

4. **Se revisó el código de `elegirArchivoInsumos` y coincide con el prompt.** Dos matices que el exportador ya respeta: ARKEN recorta los espacios de la categoría y de la descripción antes de compararlas, y cuando la empresa tiene activa la «lista maestra única», «Sobrescribir» propaga el precio, la unidad y la categoría a los demás proyectos que tengan el mismo código (`Maestro.sincronizar`).
5. **El validador del Excel reproduce, línea por línea, la lectura de ARKEN** sobre el archivo ya escrito (no sobre los datos en memoria). Si algo falla, no deja guardar.

## Datos

6. **Los 336 insumos de la semilla conservan la descripción, la unidad y la categoría de ARKEN** como unidad canónica (factor 1 en la equivalencia). Sus presentaciones permiten normalizar observaciones en otras unidades: por ejemplo, un bulto de 42,5 kg se lleva a kilos y de ahí al bulto de 50 kg.
7. **`consolidados` guarda el último cálculo por insumo y ciudad.** La historia del precio recomendado vive en los cortes, que son inmutables, y la serie de tiempo se recalcula siempre desde las observaciones, que nunca se borran. *Por qué:* guardar un consolidado diario por insumo y ciudad haría crecer la base en decenas de miles de filas por día sin agregar información.
8. **Cuando faltan datos en la ciudad, la consolidación se amplía en este orden:** la subregión (por ejemplo, Oriente antioqueño), la región amplia (por ejemplo, Antioquia o Caribe) y el país, ajustando por el factor regional de la categoría y bajando la confianza en cada paso.
9. **El precio de referencia de ARKEN (semilla) entra como una observación de la fuente «Referencia ARKEN (semilla)»**, tipo `referencia`, con la confiabilidad más baja (0,2). Solo se usa cuando no hay ninguna observación de mercado; en ese caso el precio se rotula «solo referencia» y no se exporta a ARKEN salvo que usted lo pida.
10. **IVA por defecto:** 19 % para bienes y servicios; 0 % para la mano de obra de nómina (el salario no causa IVA). Todo es parametrizable por el contador, y el aviso permanente lo dice.
11. **Los datos de demostración son opcionales** y se cargan con un botón. Cada precio que dependa de ellos lleva la etiqueta DEMO, la fuente se llama «Datos de demostración (sintéticos)» y un botón los borra todos. No se exportan a ARKEN salvo que se marque expresamente, y entonces el archivo lo declara en su encabezado y en su nombre.

## Mano de obra

12. **Parámetros 2026 verificados el 2 de octubre de 2026:** SMMLV $1.750.905 (Decreto 1469 de 2025; el Consejo de Estado levantó la suspensión provisional el 17 de julio de 2026), auxilio de transporte $249.095, 42 horas semanales desde el 15 de julio de 2026 con divisor de 210 horas, nocturno de 7:00 p. m. a 6:00 a. m. con el 35 %, dominical y festivo del 90 % desde el 1 de julio de 2026.
13. **Costo por hora = costo mensual de la empresa ÷ divisor (210); jornal = costo por hora × horas por jornal (7 por defecto); día calendario = costo mensual ÷ 30.** Con 7 horas por jornal, el jornal y el día coinciden. El divisor y las horas se pueden cambiar.
14. **El salario de cada oficio no se inventa.** Para el personal no calificado se parte del SMMLV (el piso legal) y se rotula así; para los demás oficios usted registra el salario, y mientras no lo haga el costo empresa aparece «sin salario registrado».

## Fase 1

15. **«Actualizar precios» ya funciona sin internet:** recalcula los consolidados del alcance que usted elija con las observaciones registradas (cotizaciones, precios manuales, listas importadas) y muestra el antes y el después. La búsqueda en la red llega con el Investigador IA (Fase 2) y el motor (Fase 3), y el centro lo dice.
