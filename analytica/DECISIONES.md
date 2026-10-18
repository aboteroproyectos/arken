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
