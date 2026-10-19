# ARKEN ANALYTICA · Decisiones

Decisiones tomadas donde el documento maestro deja lugar a criterio. Numeradas y sin renumerar: una decisión que cambie se marca como reemplazada y la nueva lleva el número siguiente.

## Arquitectura

1. **Un solo HTML armado desde `fuente/`.** `herramientas/construir.mjs` une estilos, cuerpo, librerías y módulos (`fuente/nucleo/*.js` y luego `fuente/app/*.js`, en orden de nombre) en `programa/ARKEN_ANALYTICA.html`. `npm run comprobar` falla si el HTML del repositorio no es exactamente el que sale de `fuente/`, para que nadie lo edite a mano.
2. **Librerías dentro del HTML, con versión fija.** jsPDF 2.5.1, jspdf-autotable 3.8.2, SheetJS 0.18.5, pdf.js 3.11.174 y JSZip 3.10.1 se toman de `node_modules` y el compilador comprueba la versión. A diferencia de ARKEN CONTROL, que las pide a cdnjs, ANALYTICA funciona sin internet. El HTML pesa unos 3,5 MB por eso.
3. **Política de seguridad de contenido sin red.** Una etiqueta CSP en el HTML impide cualquier petición a internet. La prueba de humo comprueba que no sale ninguna.
4. **El trabajador de pdf.js viaja dentro del HTML** en base64 (`<script id="pdfjs-worker" type="text/plain">`) y se carga como blob, porque un archivo abierto con doble clic no puede pedir otro archivo.
5. **El núcleo no toca la pantalla.** `fuente/nucleo/` corre igual en el navegador y en Node (`node:vm`), así las pruebas unitarias prueban el mismo código que corre en el programa, sin copias.
6. **Los almacenes de las fases 2 a 4 se crean ya vacíos** en el esquema 1 de IndexedDB, con sus índices, para no migrar datos después.
7. **Huellas SHA-256 de archivos en un Web Worker**, para no congelar la pantalla con archivos grandes.

## Intercambio con ARKEN CONTROL y ARKEN PRECIOS

8. **Las funciones de lectura de ARKEN se copian al pie de la letra** (`leerHojaExcel`, `ubicarColumnas`, `validarPresupuestoExcel` y las columnas `COLS_*_IMP`). Una prueba unitaria compara el texto de cada función con el de `programa/ARKEN_CONTROL.html`: si ARKEN cambia, la prueba avisa.
9. **No se exportan APU ni insumos que ninguna actividad use.** ARKEN los importaría al proyecto sin que nada los use.
10. **La fila «Generado» del título usa dos celdas** (`Generado` y el sello), para que ninguna fila de título tenga tres celdas no vacías con la palabra clave antes del encabezado (regla de `ubicarColumnas`).
11. **El Excel de ARKEN PRECIOS se lee por el texto de sus encabezados**, igual que ARKEN, y sus precios pasan a la base de precios con fuente y fecha. Al presupuesto pasan solo después de una vista previa con antes y después, y el usuario marca cuáles.

## Condiciones de la oferta

12. **SG-02 del Anexo B se divide en dos:** ISO 14001 queda en SG-02 y la ISO 45001 pasa a un requisito nuevo, SG-05, cada uno con sus 20 puntos. Son certificados distintos y un proponente puede tener uno sin el otro.
13. **Un requisito puede ser ponderable y también habilitante** (`tambienHabilitante`): por ejemplo, el personal mínimo habilita y el adicional puntúa. Así lo pide el pliego tipo.
14. **Los evaluadores se asignan por grupo** (jurídico, financiero, técnico), y el requisito económico va al evaluador financiero.
15. **Los rangos de puntaje se escriben en texto** («0 a 2 = 20», «5 o más = 60»), que el usuario entiende sin un editor aparte.

## Confidencialidad

16. **Solo el rol Jurídico registra «Aprobado por abogado»**, ni siquiera el administrador. Queda con nombre, tarjeta profesional, fecha y la huella SHA-256 del texto aprobado; si el texto cambia, vuelve a borrador.
17. **La cláusula penal propone el 2 % del presupuesto oficial**, con un rango permitido del 1 % al 5 %.
18. **El valor en pesos de la cláusula penal solo aparece si el presupuesto oficial es visible.** Si está oculto, el acuerdo diría el total por una regla de tres; se escribe solo el porcentaje (criterio 2).
19. **El acuerdo sin aprobar sale marcado BORRADOR** en cada página, y en la demostración, «DEMOSTRACIÓN · BORRADOR».

## Emisión y llaves

20. **Las llaves del proceso se crean en el módulo 07, no al crear el proceso**, porque exigen la frase del proceso y su respaldo, y quien crea el proceso puede no ser quien la custodia.
21. **Llaves ECDSA y ECDH P-384 de WebCrypto.** Las privadas se guardan cifradas con AES-GCM bajo una llave derivada de la frase (PBKDF2, 600.000 iteraciones). La frase tiene al menos 16 caracteres. Nunca se guardan en claro, ni en IndexedDB ni en los respaldos.
22. **Emitir congela la versión del pliego**: presupuesto, condiciones y pliego dejan de editarse, también desde la lógica (no solo se ocultan los botones). Los cambios posteriores serán adendas (Fase 2). Hay que escribir EMITIR para confirmar.
23. **Los paquetes de invitación se generan en la Fase 2.** En la Fase 1 el botón existe y lo dice.
24. **El pliego no lleva ningún precio**: el formulario de cantidades tiene código, descripción, unidad, cantidad y si el APU es obligatorio. La prueba de humo busca cada precio unitario y el total en el texto del PDF.

## Documentos

25. **Un documento por enlace exige https** y su huella SHA-256: el usuario elige el archivo para calcularla, y el archivo no se guarda. Sin verificar, la revisión queda en rojo.
26. **La vista previa de PDF muestra hasta 40 páginas**, para no congelar la pantalla con un plano de cientos de hojas; el archivo se descarga completo.
27. **Un archivo repetido (misma huella) se avisa antes de agregarlo**, y la versión nueva de un documento reemplaza a la anterior sin borrarla.

## Datos, seguridad y apariencia

28. **Contraseñas con PBKDF2-SHA-256 de 310.000 iteraciones** y sal propia. El primer ingreso (`admin` / `arken`) obliga a cambiarla, como ARKEN.
29. **Restaurar un respaldo desde la pantalla de ingreso pide un usuario administrador del respaldo**, y escribir REEMPLAZAR. Si no, cualquiera con el archivo podría reemplazar los datos de otro equipo.
30. **Los colores propios de la empresa solo se aplican en el tema claro.** En el oscuro se conserva la paleta de ARKEN, para no romper el contraste.
31. **Los NIT de la demostración son de la serie 999** (999.000.001, 999.100.001…), que la DIAN no asigna, con su dígito de verificación correcto. Ninguna empresa de demostración usa un nombre real; todas empiezan por «DEMO».
32. **SMMLV de 2000 a 2009 quedan «por verificar».** Los de 2010 a 2026 vienen del documento maestro; los anteriores, de memoria, y el programa los marca hasta que alguien los confirme en el decreto.
33. **Las fórmulas de Colombia Compra Eficiente se transcribieron de memoria** y se deben verificar contra el documento tipo vigente antes de usarlas para puntuar (Fase 3). El proceso registra la versión del documento tipo.
34. **Los textos de los PDF se traducen a lo que Helvetica conoce** («≥» como «>=», «≤» como «<=», «→» como «->»). jsPDF solo trae WinAnsi, y sin esto «≥» salía como «"e».
35. **Los módulos 08 a 16 se ven en el menú, atenuados, con la fase en que llegan**, para que el usuario conozca el recorrido completo desde el primer día.

# Fase 2

## Paquetes y ARKEN OFERTA

36. **ARKEN OFERTA viaja dentro del principal, comprimida.** El HTML de ARKEN OFERTA (núcleo, interfaz y librerías) se arma en el mismo `construir.mjs`, se comprime con fecha fija y va en base64 en `<script id="plantilla-oferta">`. Así el principal genera paquetes sin internet, el armado sale igual cada vez y `--comprobar` sigue sirviendo. El principal pesa 4,2 MB.
37. **Un ARKEN OFERTA por invitado, con su pliego adentro.** El pliego del invitado (ARKEN-PLIEGO) va en `<script id="arken-pliego">`, con `</` y `<!--` escritos de modo que una razón social con HTML no abra ni cierre un bloque de script. La plantilla sola, sin pliego, no deja ofertar.
38. **El pliego del invitado no lleva ningún precio.** Lleva las cantidades, el APU obligatorio y los insumos sugeridos con descripción, unidad y categoría, sin su precio. Los requisitos van sin evaluador ni notas internas. Solo si el proceso hace visible el presupuesto oficial, va su valor total.
39. **El proponente elige el ZIP para verificarlo.** Un HTML abierto con doble clic no puede leer su propia carpeta, así que ARKEN OFERTA le pide el mismo ZIP. Comprueba la firma ECDSA del manifiesto, que el pliego incrustado tenga la huella del manifiesto y cada archivo, y nombra el primero que falle. Un ARKEN OFERTA con el pliego editado no pasa, aunque el ZIP esté intacto.
40. **La huella de la llave de firma se confirma por otro medio.** ARKEN OFERTA y `LEAME_PRIMERO.pdf` la muestran, para que el invitado la compare por teléfono. Un paquete con todo cambiado, incluida la llave, verificaría contra sí mismo: esa confirmación es la defensa.
41. **Dos envíos por defecto.** El primer paquete solo trae el acuerdo y un ARKEN OFERTA de cinco módulos que genera el sobre de confidencialidad. Al recibirlo, el acuerdo queda «firmado». Le toca el paquete completo cuando un usuario verifica las facultades del firmante («verificado»). En el modo de un envío, ARKEN OFERTA exige aceptar el acuerdo antes de mostrar los documentos y adjuntarlo firmado antes del sobre.
42. **El correo lo envía el usuario.** El programa prepara el asunto y el cuerpo (`mailto:`), como ARKEN; no hay servidor de correo ni red. El envío se registra con un clic.
43. **No se generan paquetes con una adenda en preparación**, para que nadie reciba una versión a medio editar.
44. **Las llaves privadas se abren una vez por sesión.** La frase se pide al primer paquete, respuesta o adenda que se firma; las llaves abiertas quedan solo en memoria y se borran al salir.

## ARKEN OFERTA por dentro

45. **Un usuario local por código de invitación**, con contraseña de 8 caracteres o más (PBKDF2), y cierre de sesión a los 20 minutos sin uso. El borrador vive en IndexedDB y se puede guardar en un ZIP para llevarlo a otro equipo.
46. **El precio de una actividad con APU es la suma del APU.** Si el proponente escribe otro precio, el programa lo avisa y vale la suma. Así el principal recalcula lo mismo que vio el proponente.
47. **La plantilla de precios es un Excel con hoja de control oculta.** También se acepta el Excel de ARKEN CONTROL. Antes de escribir, el programa muestra qué coincide, qué falta y qué sobra.
48. **Las respuestas económicas (ECO-01 a ECO-05) se calculan solas** del presupuesto: si todo tiene precio, si están los APU, si el desglose cuadra con A, el valor total y si cabe en el presupuesto oficial.
49. **El desglose de la administración cuadra con A** si la diferencia no pasa del 0,1 % de A o de 1.000 pesos.
50. **Una adenda importada no borra nada.** Lo que cambió (cantidades, unidades, descripciones, requisitos) queda marcado para revisar, y el sobre no se genera hasta revisarlo. El borrador sigue con el pliego de la adenda aunque se abra el HTML original.
51. **Después del cierre, ARKEN OFERTA no genera el sobre de oferta**, con el reloj del equipo del proponente. El principal vuelve a comprobarlo con la hora que trae el sobre.

## Sobre cerrado

52. **El sobre es un ZIP con `sobre.json` en claro y la oferta cifrada.** `sobre.json` solo dice de quién es, de qué proceso y versión, cuándo se generó y la huella del contenido. La oferta y sus adjuntos van en `oferta.cifrada` (AES-GCM de 256 bits con llave aleatoria). Esa llave va en `llave.envuelta`, cifrada con ECDH efímero contra la pública del proceso y HKDF-SHA-256. Solo la privada del proceso, con la frase, la abre.
53. **La huella del contenido** es el SHA-256 de la lista «ruta, huella» de cada archivo del sobre, ordenada. Un byte cambiado en cualquier archivo se detecta al recibir, sin abrir nada.

## Recepción, cierre y apertura

54. **Cada sobre se asigna por el código de invitación, nunca por el nombre del archivo.** El NIT tiene que coincidir. Un archivo renombrado se recibe con un aviso.
55. **Vale el último sobre generado antes del cierre**, por la hora de generación que trae el sobre, no por la hora en que llegó. Los anteriores quedan «reemplazado», y un sobre generado después del cierre se rechaza. Una hora más de 5 minutos adelante del reloj del principal se avisa.
56. **Al recibir solo se revisa lo que está en claro.** Se revisan el ZIP, la cabecera y la huella. El contenido (adjuntos, PDF con scripts, precios) se verifica en la apertura, porque antes está cifrado.
57. **Una oferta sobre una versión anterior del pliego se recibe con aviso** y queda en el acta: decide el comité. Una versión que no existe se rechaza.
58. **Un sobre sin cifrar en un proceso de sobre cerrado se recibe con aviso** y no se rechaza: la oferta es válida, pero viajó a la vista y el comité debe saberlo.
59. **La apertura pide cuatro cosas a la vez:** que haya pasado la hora de cierre, el acta de cierre, la frase del proceso y dos miembros distintos del rol Comité, autenticados con su usuario y contraseña en ese momento. Puede pedirla un usuario de la sesión distinto de ellos.
60. **Se abren todos los sobres a la vez, y uno que falla no detiene a los demás.** Queda en el acta como «no se pudo abrir», con su motivo: llave de otro proceso, contenido alterado o ZIP interno peligroso.
61. **El recálculo usa las cantidades del pliego de la versión de cada sobre.** Las cantidades que escriba el proponente no cuentan. Las diferencias de precio unitario y de totales quedan por renglón para la Fase 3.
62. **Lo que no está declarado en `oferta.json` no se tiene en cuenta** y queda anotado. Un adjunto cuya huella no coincide, o un PDF con JavaScript o `/Launch`, no se guarda y queda en las novedades.
63. **Las actas de cierre y de apertura son inmutables.** Se guardan en PDF con su huella, y el proceso pasa a «cerrado para ofertas» y luego a «abierto». Después de la apertura no se recibe ningún sobre.

## Preguntas y adendas

64. **Las preguntas fuera de plazo se registran y se marcan**, no se rechazan: el principal decide si las responde.
65. **El documento de respuestas no dice quién preguntó** y es el mismo para todos. Va firmado; ARKEN OFERTA rechaza uno alterado o de otro proceso.
66. **Una adenda es la versión siguiente del pliego, preparada como antes de emitir.** Se edita en los módulos de siempre, se puede descartar sin dejar rastro en el pliego, y al emitirla exige el pliego nuevo generado y revisado, un motivo y al menos un cambio. Después del plazo de adendas solo se admite la que únicamente mueve hacia adelante el cierre y los hitos que lo siguen.

## Documentos de proponentes y seguridad

67. **El color de cada proponente** sale de su orden en la lista de invitados, así no cambia entre pantallas.
68. **La búsqueda de texto usa la capa de texto de los PDF** (pdf.js). Un escaneado sin texto no se puede buscar, y el programa lo dice. No hay reconocimiento de texto (OCR).
69. **Límites contra ZIP maliciosos:**
    - 2.000 archivos como máximo;
    - 4 GB descomprimido como máximo;
    - se rechaza un archivo de más de 20 MB que crezca más de 200 veces;
    - las rutas tienen 240 caracteres como máximo, sin `..`, sin ruta absoluta, sin unidad de Windows, sin barra invertida, sin HTML y sin caracteres de control.
    Como JSZip limpia los `../` al leer, se revisa el nombre original de cada entrada.
70. **El verificador del repositorio busca el pliego incrustado** en cualquier HTML, incluso en la plantilla comprimida dentro del principal. También busca los archivos que solo existen en un proceso real (paquetes, ARKEN OFERTA de un invitado, borradores, sobres, preguntas, respuestas, adendas, plantillas de precios y actas).
71. **Los módulos 08, 09 y 10 dejan de estar atenuados**; los 11 a 16 siguen con la fase en que llegan.

## Verificación (Fase 3)

72. **Cada verificación es una fila nueva**, con el evaluador, la fecha, la observación y la evidencia (documento, página y texto literal). Vale la última por fecha; las anteriores quedan como historia y no se borran.
73. **Los valores de cumplimiento son cinco:** sí, no, subsanable, pendiente y **no aplica**. El documento maestro nombra los cuatro primeros; «no aplica» se agregó para los requisitos condicionales (por ejemplo, el acuerdo de consorcio de un proponente individual). Cuenta como cumplido.
74. **Cada requisito lo verifica el rol de su grupo:** el técnico, el jurídico o el financiero, además del administrador. «No cumple» y «Subsanable» exigen observación.
75. **La respuesta a una subsanación se carga directamente** en el principal y va a la carpeta del proponente como ronda 2. No pasa por ARKEN OFERTA ni por un sobre: la subsanación es un intercambio abierto, no una oferta. Se anota si llegó después del plazo.
76. **El plazo de la subsanación es en días hábiles** con los festivos de Colombia, y la solicitud sale en PDF con el nombre del proponente.
77. **La justificación de un valor artificialmente bajo la decide solo el comité.** Mientras no se acepte, la oferta queda pendiente.

## Análisis presupuestal

78. **El desbalance usa el z robusto (mediana y MAD) sobre el precio relativo al nivel de cada oferta:** el precio unitario dividido por el costo directo de esa misma oferta. Así, una oferta pareja que es más barata en todo no sale desbalanceada; la que es cara en unas actividades y barata en otras, sí. Con pocas ofertas el MAD es muy pequeño, así que el z (3,5) solo marca si además se aparta al menos un 10 % de la mediana relativa. La regla de ±30 % frente a la base se mide sobre el precio tal cual.
79. **Solo se revisan los APU desglosados.** Un APU de un solo renglón («precio unitario de…») no se compara con el de la base ni cuenta para los APU idénticos entre ofertas.
80. **Los insumos se emparejan con la base solos** cuando coinciden la descripción normalizada y la unidad. Los parecidos (Jaccard ≥ 0,5, misma unidad) se sugieren, y lo que confirma una persona manda.
81. **El costo empresa mínimo de un jornal** sale del SMMLV y el factor prestacional de los parámetros, con 210 horas al mes desde julio de 2026 y 220 antes (reducción gradual de la jornada).
82. **El análisis corre en el hilo de la pantalla**, con caché, y se recalcula al cambiar una verificación, una subsanación o la configuración. No se midió con el proceso grande de §25 (3.000 actividades y 12 proponentes); si congela la pantalla, se lleva a un Web Worker.

## Técnico, legal y financiero

83. **La experiencia cuenta los primeros N contratos en el orden en que el proponente los declaró**, cuando el pliego limita el número. Cada valor se convierte a SMMLV del año de terminación.
84. **Los indicadores financieros de un consorcio o una unión temporal** se calculan con las cifras que declara la figura. Las participaciones de los integrantes quedan a la vista para que el evaluador las revise.
85. **El programa sugiere y el evaluador decide.** Indicadores, experiencia, personal, programación y documentos traen una sugerencia con su cálculo, pero nada se da por cumplido sin una verificación registrada.

## Puntajes

86. **Los puntajes se redondean a dos decimales** en cada componente y en el total.
87. **La cercanía al presupuesto oficial** resta a partir de la oferta más cercana (Dmín), con el doble de pendiente por encima del presupuesto que por debajo (k = 1 por debajo y 2 por encima, ajustables por proceso). Las fórmulas siguen las del documento tipo y deben verificarse contra la versión vigente antes de un proceso real.
88. **La media geométrica incluye el presupuesto oficial** tantas veces como dice el documento tipo según el número de ofertas (dos veces con cuatro ofertas).

## Alertas

89. **El estado de una alerta se conserva al volver a analizar.** Cada alerta tiene una clave estable (tipo, ofertas y objeto); si deja de presentarse, queda como «ya no se presenta» con su historia.
90. **Los precios que se mueven juntos se miden con la correlación de los logaritmos de la desviación frente a la base** (precio de la oferta ÷ precio base), y se marca por encima de 0,98. Así no cuenta que todas las ofertas sigan la escala de la base.
91. **Las mismas cifras** son al menos tres actividades con el mismo precio unitario al centavo que no es múltiplo de 100: un redondeo inusual repetido.
92. **Los indicios de acuerdo entre proponentes no van en ARKEN OFERTA**, y cada alerta de este tipo recuerda que es un indicio que hay que verificar, no una prueba.

## Demostración

93. **Las ofertas de demostración se generan en el principal** como sobres cerrados de verdad, cifrados con la llave del proceso, y entran por la recepción y la apertura de siempre. Se generan con una hora tres minutos antes de ahora, así son anteriores al cierre adelantado.
94. **Solo en un proceso de demostración se puede adelantar el cierre**, a un minuto antes de ahora en hora de Colombia, para seguir con el acta de cierre y la apertura sin esperar.
95. **Los módulos 11 a 14 dejan de estar atenuados**; el 15 y el 16 siguen con la Fase 4.

## Comparativo y gráficas (Fase 4)

96. **El comparativo sigue la estructura del presupuesto base.** Cada renglón es un capítulo, subcapítulo o actividad de la base, y cada oferta se lee con su recálculo (las cantidades del pliego), no con lo que declaró. Una actividad que una oferta no trae queda vacía, no en cero.
97. **La desviación se muestra frente a la base y frente a la mediana** de las ofertas. Los colores van por tamaño de la desviación frente a la base (±5 %, ±15 %, ±30 %), los mismos del módulo 12.
98. **El cuadro gerencial no dice «Recomendado» hasta que el concepto esté firmado.** Antes dice «En evaluación», aunque el orden de elegibilidad ya tenga un primero.
99. **Las gráficas son SVG hechos por el programa, sin librería.** Así funcionan sin internet, se exportan a PNG, SVG y PDF iguales a lo que se ve, y el informe usa las mismas. Al exportar, los colores del tema quedan fijos en el tema claro.
100. **Cada proponente tiene un color en todas las gráficas**, el mismo de su carpeta en el módulo 10, para que se reconozca de una a otra.
101. **La sensibilidad (tornado)** sube y baja un 10 % el peso de cada grupo y dice si cambia el primero del orden; es la misma tabla del módulo 14, en gráfica.

## Concepto e informe

102. **El concepto se genera, el comité lo edita y lo firma.** Lo generado queda guardado; lo que edita el comité reemplaza cada campo, y el PDF muestra el texto final.
103. **Se firma con dos miembros distintos del rol Comité**, con su contraseña, como la apertura. La huella SHA-256 del contenido firmado queda en el concepto y en el PDF.
104. **Un cambio después de firmar devuelve el concepto a borrador.** El programa compara el contenido de hoy (textos, recomendado, orden con sus totales, condiciones, riesgos) con el firmado. Si difiere, avisa y pide firmar de nuevo.
105. **El informe tiene las 23 secciones de §20, cada una en una casilla**, en el orden que el usuario arrastre. Cada requisito creado por el usuario tiene su sección después de la programación (§27.10). La configuración se guarda por proceso; si aparecen secciones nuevas, entran marcadas.
106. **Mientras el concepto no esté firmado, el informe lleva la marca de agua «BORRADOR: NO ES UNA DECISIÓN»** en cada página.
107. **Cada informe generado se guarda** (PDF y Excel, con su huella), y entra en los respaldos. Generar otro no borra el anterior.
108. **El Excel del informe tiene una hoja por tabla**, con los números como números. Los nombres de hoja se recortan a 31 caracteres y se numeran si se repiten.

## Presupuesto adjudicado

109. **El presupuesto adjudicado sale en el Excel de importación de ARKEN CONTROL**, el mismo del módulo 02, solo con el concepto firmado y para el recomendado.
110. **ARKEN CONTROL junta los insumos por descripción y los APU por código.** Una oferta puede cotizar el mismo insumo a precios distintos en APU distintos, o repetir un código de APU. Por eso, al exportar, el segundo insumo con la misma descripción y otro precio se llama «… · precio 2», y un código de APU repetido se numera (`-2`). Así, el costo directo que lee ARKEN CONTROL es el de la oferta.
111. **El AIU no viaja en ese libro** (ARKEN CONTROL no lo lee de allí): el libro lo dice en su hoja de instrucciones, con los porcentajes para digitarlos.

## Asistente de IA

112. **El asistente está apagado por defecto** y lo enciende solo el administrador. Sin la clave, el programa hace todo igual.
113. **Cada llamada se confirma** en una ventana con lo que se envía, a dónde, el modelo, el costo estimado por lo alto y lo que va del tope del mes. Si la llamada pasaría el tope, no se hace.
114. **La lectura de documentos solo propone.** Cada dato trae el texto literal y la página. El programa busca ese texto en el documento: si no está, o si el valor no está dentro de él, lo descarta. Si está en otra página, la corrige. Nada se escribe en la verificación sin que el evaluador lo use.
115. **La redacción solo usa los hechos de la evaluación.** Se le envía lo que generó el programa (orden, totales, fortalezas, debilidades, alertas confirmadas). Una parte con una cifra que no esté en esos hechos, o con un proponente que no esté en el orden, no se puede aceptar.
116. **La IA no puntúa ni decide el cumplimiento:** no tiene herramienta para hacerlo, y el puntaje se calcula igual con o sin ella (§27.15).
117. **Las respuestas se piden por herramientas estrictas** (`registrar_dato`, `proponer_redaccion`), no como texto libre, para leerlas sin adivinar.
118. **El modelo por defecto es Claude Opus 5.5**, con Sonnet 5.5 y Haiku 4.5 como opciones más baratas. El costo se calcula con los precios por millón de tokens que trae el programa; conviene revisarlos con la lista vigente de Anthropic.
119. **El SDK oficial de Anthropic va dentro del HTML**, con versión fija (`@anthropic-ai/sdk` 0.131.0, armado con esbuild). `npm run sdk:comprobar` falla si el bloque incrustado no es el que sale de esa versión.
120. **La clave de API no va en el HTML, en los respaldos ni en la base de datos en claro.** En la app de escritorio la cifra el sistema operativo (safeStorage). En el navegador se cifra con AES-GCM y una llave que el navegador no deja exportar, en un almacén que no entra en los respaldos. «Recordar en este equipo» es opcional; si no se marca, la clave dura hasta salir.
121. **Se puede apagar el asistente en un proceso** aunque esté encendido en el programa, para un proceso cuyo pliego no permita enviar documentos a terceros.

## Apps

122. **La app de escritorio es la recomendada para la empresa.** Es el mismo HTML servido desde la app (`app://analytica`), con la bóveda del sistema operativo y una copia diaria. Fuera de la app solo deja salir las llamadas a `api.anthropic.com`.
123. **La copia diaria es el mismo respaldo de Administración › Respaldos**, sin la bóveda de secretos. Se guarda al entrar si hoy no hay una, y se conservan las últimas 10. No llena la auditoría. Si llegara a traer algo con forma de clave de API, no se guarda.
124. **El celular y la tableta solo consultan** (tablero, procesos, comparativo, informe y ayuda). Evaluar con el teléfono es poco práctico, y así la evaluación queda en un solo equipo. Los datos llegan restaurando un respaldo. La lógica también lo exige: una acción que cambia datos se rechaza aunque se llame directo.
125. **En las apps, la política de seguridad permite cada script del programa por su huella SHA-256**, no `unsafe-inline`. Un script o un atributo `on…` que se colara en la página no corre. El HTML para el navegador conserva su política, porque se abre desde `file://`.
126. **Los proyectos de Android e iOS se generan en GitHub Actions** con Capacitor, no viven en el repositorio. El APK se firma con la misma clave de ARKEN CONTROL (secreto `ARKEN_FIRMA_CLAVE`). El de iOS sale sin firma.
127. **Pendiente: archivos muy grandes en la app de escritorio.** §6 pide leer en trozos los documentos de varios cientos de MB. La app usa el mismo almacenamiento del navegador que el HTML; no se probó con documentos de ese tamaño.
128. **Los módulos 15 y 16 dejan de estar atenuados.** Ningún módulo queda atenuado.
