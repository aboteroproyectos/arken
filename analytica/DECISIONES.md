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
