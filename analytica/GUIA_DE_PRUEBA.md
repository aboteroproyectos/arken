# ARKEN ANALYTICA · Guía de prueba (fases 1 a 4)

## Cómo abrirlo

1. Descargue `analytica/programa/ARKEN_ANALYTICA.html` y ábralo con doble clic en Chrome o Edge. No necesita internet ni instalar nada.
2. Ingrese con usuario `admin` y contraseña `arken`. El programa le pide cambiarla en el primer ingreso.

Los datos quedan en el navegador de ese computador (IndexedDB). Para llevarlos a otro equipo use **Administración › Respaldos**.

## Recorrido paso a paso

### 1. Demostración

1. En **01 · Procesos**, pulse **Cargar demostración**.
   - Debe ver el proceso «DEMO-2026-001 · Casa campestre en El Retiro».
   - La cinta superior dice DEMOSTRACIÓN y la cinta de totales muestra un presupuesto base de $ 969,008,207 y 5 invitados.
2. Recorra los módulos 00 a 07. La cinta de DEMOSTRACIÓN aparece en todos.

### 2. Presupuesto base y ARKEN CONTROL (módulo 02)

1. En **02**, recorra las pestañas: capítulos y actividades, APU, insumos, AIU e IVA.
2. Elija un nivel en la lista del PDF y pulse **PDF**. Sale en tamaño carta, con el encabezado de ARKEN, «Página x de y» y el rótulo DEMOSTRACIÓN.
3. Pulse **Exportar para ARKEN CONTROL** e importe el archivo en ARKEN CONTROL: módulo 03 › Importar desde Excel › Reemplazar. Debe quedar el mismo costo directo.
4. En ARKEN CONTROL, exporte con «Excel editable» e impórtelo aquí con **Importar Excel de ARKEN CONTROL**. Debe quedar idéntico.

### 3. Base de precios (módulo 03)

1. Pulse **Actualizar desde Excel de ARKEN PRECIOS** y elija la lista exportada por ARKEN PRECIOS («Lista para ARKEN CONTROL»).
2. Marque los insumos y pulse **Aplicar lo marcado**. Quedan con su fuente y fecha.
3. Vuelva a **02 › Insumos** y pulse **Actualizar precios desde la base de precios**. Verá antes y después de cada precio, y decide cuáles cambian.

### 4. Condiciones de la oferta (módulo 04)

1. Desactive un requisito ponderable, por ejemplo EXP-02. Aparece un aviso rojo, porque los puntajes ya no suman 1.000.
2. Actívelo otra vez. El aviso pasa a verde.
3. Edite un requisito y revise el evaluador, la regla de verificación y la regla de puntaje.

### 5. Documentos del proceso (módulo 05)

1. Pulse **Cargar archivos** y elija dos archivos. Cada uno queda con su huella SHA-256.
2. Suba uno de ellos otra vez. El programa avisa que es un archivo repetido.
3. Use **Nueva versión** en un documento. La anterior queda como reemplazada, sin borrarse.
4. Pulse **Agregar documento por enlace** y escriba una dirección https. La revisión del módulo 07 queda en rojo hasta que lo verifique eligiendo el archivo.

### 6. Invitados y acuerdo de confidencialidad (módulo 06)

1. Agregue un invitado con NIT 890903938 y dígito 7. El programa lo rechaza, porque el dígito correcto es 8.
2. Escriba una razón social con HTML, por ejemplo `<b>Prueba</b>`. Se ve tal cual, como texto.
3. En la pestaña **Acuerdo de confidencialidad**, revise el texto y descargue el PDF. Sale marcado BORRADOR.

### 7. Aprobación por abogado

1. En **Administración › Usuarios**, cree un usuario con el rol **Jurídico**.
2. Salga e ingrese con ese usuario.
3. En **06 › Acuerdo**, pulse **Registrar «Aprobado por abogado»** y escriba la tarjeta profesional. Queda el nombre, la fecha y la huella del texto aprobado.
   - El administrador no ve ese botón.

### 8. Emisión (módulo 07)

1. Con el administrador, abra **07 › Revisión y emisión**. Mientras falte algo, **Emitir** está deshabilitado y cada punto en rojo lleva al módulo que lo resuelve.
2. En **Llaves del proceso**:
   - escriba una frase de al menos 16 caracteres y cree las llaves;
   - descargue el respaldo y guárdelo fuera del computador;
   - confirme que lo guardó.
3. En **Cronograma**, revise los hitos. El programa cuenta días hábiles con los festivos de Colombia.
4. En **Pliego**, genere el PDF y márquelo como revisado.
   - Verifique que no trae ningún precio: el formulario de cantidades solo lleva código, descripción, unidad y cantidad.
5. Vuelva a **Revisión y emisión**: todo está en verde. Pulse **Emitir** y escriba EMITIR.
   - El presupuesto, las condiciones y el pliego quedan congelados.

### 9. Respaldo y restauración

1. En **Administración › Respaldos**, pulse **Descargar respaldo completo** (.zip).
2. Abra el programa en otro navegador o en una ventana privada y pulse **Restaurar respaldo** en la pantalla de ingreso.
3. Escriba un administrador del respaldo, elija el .zip y escriba REEMPLAZAR. Todo vuelve, incluido el proceso emitido.

### 10. Apariencia y pantalla pequeña

1. En **Configuración › Apariencia**, pruebe el tema oscuro y las densidades compacta, normal y amplia.
2. Abra el programa en un teléfono o reduzca la ventana a 360 px. La página no se desplaza de lado; solo las tablas se desplazan por dentro.

### 11. Borrar la demostración

En **Administración › Demostración**, pulse **Borrar datos de demostración**. Se va todo lo de la demostración, y sus procesos reales quedan intactos.

### 12. Fase 2: paquetes por invitado (módulo 07 › Paquetes y envío)

Parta del proceso de demostración ya emitido (pasos 1 a 8).

1. En el módulo 06, registre como verificado el acuerdo de uno o más invitados («Acuerdo firmado», marcando la verificación de facultades). Deje al menos uno sin acuerdo.
2. En el módulo 07, abra la pestaña «Paquetes y envío» y pulse «Generar y descargar» en cada invitado. La primera vez el programa pide la frase del proceso.
3. Revise lo que debe ver:
   - al invitado sin acuerdo le toca «solo acuerdo» y su ZIP termina en `_confidencialidad.zip`;
   - a los demás les toca el paquete completo;
   - dentro de cada ZIP vienen `ARKEN_OFERTA_….html`, `LEAME_PRIMERO.pdf`, el acuerdo, el `manifiesto.json` y su `.firma` y, en el completo, el pliego y la carpeta `Documentos_del_proceso`;
   - «Correo» abre su programa de correo con el asunto y el texto listos.

### 13. ARKEN OFERTA, del lado del invitado

1. Descomprima un paquete completo y abra `ARKEN_OFERTA_….html` con doble clic. Cuando lo pida, elija el mismo ZIP.
2. Revise lo que debe ver:
   - «Pliego auténtico» y la huella de la llave de firma;
   - si cambia un byte de cualquier archivo del ZIP, el programa dice cuál falló.
3. Cree el usuario local y recorra los módulos:
   - en el 03, descargue la plantilla de precios, llénela en Excel (columna I o la hoja APU) e impórtela;
   - en el 04, ponga el AIU y el desglose de la administración;
   - en los módulos 05 a 12, adjunte un documento por requisito.
4. En el 13, escriba una pregunta y genere el archivo de preguntas.
5. En el 14, la lista debe quedar en verde. Genere el sobre: sale un ZIP `…_OFERTA_v1_….zip`.
6. Con el paquete de solo acuerdo, ARKEN OFERTA muestra cinco módulos. Adjunte el acuerdo firmado en el 02 y genere el sobre de confidencialidad.

### 14. Preguntas, respuestas y adendas (módulo 08)

1. Importe el archivo de preguntas, escriba la respuesta y pulse «Publicar las marcadas». Descargue los dos archivos. El documento de respuestas no dice quién preguntó.
2. En la pestaña «Adendas», pulse «Preparar la adenda N.º 1» y cambie una cantidad en el módulo 02. En el módulo 07, genere el pliego y márquelo revisado. Vuelva al 08 y pulse «Emitir la adenda».
3. En ARKEN OFERTA, módulo 13, importe las respuestas y la adenda. Lo diligenciado se conserva, y la actividad que cambió queda marcada para revisar.

### 15. Recepción, cierre y apertura (módulo 09)

1. Suelte todos los sobres a la vez en la zona de recepción. Agregue un sobre repetido y un ZIP que no sea un sobre. Revise lo que debe ver:
   - cada sobre queda con su invitado;
   - el repetido y el ajeno se rechazan con su motivo;
   - si un invitado envió dos sobres, el anterior queda «reemplazado».
2. Antes de la hora de cierre, el botón de apertura está deshabilitado y el acta de cierre no se genera.
3. Después del cierre:
   - genere el acta de cierre;
   - pulse «Abrir los N sobres» y escriba la frase y dos usuarios del rol Comité (créelos antes en Administración);
   - se descarga el acta de apertura;
   - la pestaña «Ofertas abiertas» muestra el valor declarado y el recalculado de cada una.
4. Para probarlo sin esperar el cierre real, cree un proceso de prueba con el cierre dentro de unos minutos.

### 16. Documentos de proponentes (módulo 10)

1. Tiene una pestaña por proponente, con su color. Cada documento va con su requisito, su fecha y su vigencia; la vigencia vencida al cierre sale en rojo.
2. En «Buscar en los PDF», escriba una palabra: la lista lleva a la página y resalta el hallazgo.
3. «Descargar la carpeta» baja un ZIP cuyo nombre empieza por la razón social del proponente.

### 17. Fase 3: ofertas de demostración (módulo 09)

1. Cargue la demostración, emita el proceso y entre al módulo 09.
2. Pulse **Ofertas de demostración**. Llegan cinco sobres cerrados, uno por invitado, marcados DEMOSTRACIÓN. Cada uno trae un rasgo:
   - Beta, desbalanceada y cargada al inicio;
   - Gamma, valor bajo y un residente con menos años de los exigidos;
   - Delta, el certificado de existencia vencido;
   - Delta y Épsilon, el mismo director de obra;
   - Épsilon, aritmética errada y endeudamiento por encima del límite;
   - Alfa, ninguno.
3. Pulse **Adelantar el cierre (demostración)**, genere el acta de cierre y abra los sobres con la frase y dos miembros del comité.

### 18. Bandeja de alertas

1. Pulse el botón de alertas de la barra superior. El contador dice cuántas hay abiertas.
2. Compruebe que cada rasgo del paso 17 aparece como alerta, con su nivel, qué encontró, por qué importa, la regla y qué hacer, y que Alfa no tiene ninguna.
3. Pulse un enlace de la evidencia:
   - el de un renglón lleva al módulo 12 con el renglón resaltado;
   - el de un documento lo abre en el visor.
4. Descarte una alerta con un motivo. Cambie una verificación y vuelva a abrir la bandeja: la alerta sigue descartada.

### 19. Verificación y subsanaciones (módulo 11)

1. Cree un usuario con el rol Evaluador jurídico (Administración › Usuarios) y entre con él.
2. En la matriz, pulse una celda de un requisito jurídico. Elija el cumplimiento, el documento, la página y copie el texto que lo acredita. Guarde.
3. Intente verificar un requisito técnico: el programa no lo deja.
4. Intente «No cumple» sin observación: no se guarda.
5. Como administrador, en **Subsanaciones**, pida a Delta subsanar el certificado de existencia con 3 días hábiles. Sale el PDF de la solicitud.
6. Registre la respuesta con un PDF: queda en la carpeta de Delta del módulo 10, marcada como subsanación.
7. Pida a Gamma la justificación del valor. Regístrela y decídala con un usuario del comité.

### 20. Análisis presupuestal y técnico (módulos 12 y 13)

1. En el módulo 12, recorra las ocho subpestañas con cada oferta:
   - en Aritmética, Épsilon muestra las diferencias por renglón;
   - en Desbalance, Beta muestra sus capítulos caros y baratos;
   - en AIU, el desglose de la administración frente al personal.
2. En **Configuración**, cambie un umbral: el análisis se recalcula.
3. En el módulo 13 revise los indicadores financieros (Épsilon no cumple el endeudamiento), la experiencia en SMMLV, el personal y la programación.

### 21. Puntajes y orden de elegibilidad (módulo 14)

1. Con todas las verificaciones hechas, el puntaje deja de ser provisional.
2. Revise el orden con el método económico del pliego y la tabla de sensibilidad, que dice si el orden cambia cuando cada grupo pesa un 10 % más o menos. Épsilon aparece al final, no habilitada, con su causal.
3. Borre la demostración en Administración › Demostración: también se borran las verificaciones, las subsanaciones y las alertas.

### 22. Fase 4: comparativo y cuadro gerencial (módulo 15)

1. Con el proceso de demostración evaluado (pasos 17 a 21), entre al módulo 15.
2. En **Comparativo**, cambie el nivel a subcapítulo y a actividad, filtre por un capítulo y marque «solo con alertas». Compruebe que los totales del pie son los del módulo 14.
3. En **Gerencial**, compruebe que dice «En evaluación», que Épsilon sale en rojo con su causal y que un clic en un puntaje lleva a su cálculo en el módulo 14.
4. En **Requisitos**, pulse una celda: abre la verificación de ese requisito y ese proponente.
5. Exporte el comparativo y el gerencial a Excel y a PDF.

### 23. Las 15 gráficas

1. En la pestaña **Gráficas**, pase el cursor por un proponente: queda resaltado. Pulse un capítulo del mapa de calor: baja a sus subcapítulos.
2. Cambie la oferta de la cascada y la del desbalance.
3. Abra una en pantalla completa, expórtela en PNG, SVG y PDF, y márquela para el informe.

### 24. Concepto y firmas (módulo 16)

1. En **Concepto**, revise lo generado y edite el resumen. Guarde.
2. Firme con dos miembros del comité (`comite1` y `comite2`). Baje el PDF del concepto: trae las firmas y la huella.
3. Vuelva al módulo 15: el gerencial dice «Recomendado: …».
4. Cambie un puntaje en el módulo 11 y vuelva al concepto: avisa que cambió después de firmar y queda en borrador.
5. Firme de nuevo.

### 25. Informe final

1. En **Informe**, desmarque una sección, arrastre otra a otro lugar y elija las gráficas.
2. Genere el informe: sale el PDF (portada, índice, encabezado, pie y «Página x de y») y el Excel con una hoja por tabla.
3. En un proceso con un requisito creado por usted (módulo 04), ese requisito tiene su sección en el informe y su hoja en el Excel.
4. Con el concepto en borrador, el informe trae la marca de agua «BORRADOR: NO ES UNA DECISIÓN».
5. En **Versiones**, baje un informe anterior.
6. Con el concepto firmado, pulse **Presupuesto adjudicado para ARKEN CONTROL** e impórtelo en ARKEN CONTROL (módulo 02 › Importar Excel). El costo directo es el de la oferta adjudicada; el AIU se digita con los porcentajes de la hoja de instrucciones.

### 26. Asistente de IA (opcional)

Necesita una clave de API de Anthropic. Sin ella, el programa hace todo lo demás igual.

1. Como administrador, en **Asistente**, enciéndalo, elija el modelo y el tope del mes, y guarde la clave con **Escribir la clave**. Pulse **Probar**.
2. En la verificación (módulo 11) de un requisito con documento, pulse **Leer con el asistente de IA**. La ventana dice qué se envía, a dónde y cuánto cuesta. Envíe.
3. Revise lo propuesto: cada dato trae el texto literal y la página. Use uno: llena el documento, la página y el texto, y usted decide el cumplimiento.
4. En **Asistente**, pida la redacción del concepto. Acepte o descarte cada parte.
5. Ponga un tope de US$ 0,01 e intente otra llamada: no se hace.
6. Apague el asistente en el proceso: los botones desaparecen.

### 27. Apps

1. **Escritorio:** instale la de su sistema desde GitHub Actions, o en la carpeta `analytica/` ejecute `npm ci` y `npm run escritorio`. Entre: a los pocos segundos se guarda la copia del día (Ayuda › Abrir la carpeta de copias diarias).
2. **Android:** instale el APK, restaure un respaldo del computador y compruebe que solo se consulta: los módulos de trabajo están atenuados y un PDF se abre en el menú Compartir.

## Pruebas automáticas

En la carpeta `analytica/`:

```
npm ci --omit=optional
npm run prueba
```

`npm run prueba` corre, en orden:

- el verificador de datos;
- la comprobación de que el HTML es el armado desde `fuente/`;
- las pruebas unitarias (85);
- la de criptografía, con el sobre cerrado (29);
- la del núcleo de la Fase 2 (68): pliego sin precios, manifiesto, ZIP y PDF maliciosos, cabecera del sobre, recálculo, adendas y actas;
- la del núcleo de la Fase 3 (85): estadística, costo empresa mínimo, cada método económico contra un ejemplo a mano, TRM, desempate, habilitación, indicadores financieros, consorcio, experiencia, personal, días hábiles, ruta crítica, las alertas de las ofertas de demostración y una evaluación completa;
- la del núcleo de la Fase 4 (47): el comparativo suma lo mismo que el cálculo en cada nivel, el gerencial, las 15 gráficas sin NaN, el concepto, el informe con un requisito creado por el usuario, la validación de la IA, el costo y el tope, y el presupuesto adjudicado leído como lo lee ARKEN CONTROL;
- la de sobres maliciosos contra la recepción y la apertura reales (22);
- la de ida y vuelta con el `programa/ARKEN_CONTROL.html` real (18);
- la de humo del principal (53);
- la de humo de ARKEN OFERTA (16): autenticidad, dieciséis módulos, temas, 360 px, borrador en archivo, sesión y cierre;
- la de punta a punta (50), con cinco ARKEN OFERTA en su propio navegador. Recorre los paquetes, el camino de la confidencialidad, las preguntas, la adenda, los sobres, la recepción, el cierre con el reloj adelantado, la apertura con el comité y la carpeta de cada proponente;
- la de punta a punta de la Fase 3 (42): cinco sobres de demostración, cierre y apertura, la bandeja con cada alerta y su evidencia, los roles, la verificación desde la matriz, la subsanación, la justificación decidida por el comité, el orden de elegibilidad con cada método frente al calculado a mano y el borrado de la demostración;
- la de punta a punta de la Fase 4 (51): módulos 15 y 16 sobre el proceso evaluado, la evidencia a dos clics, las exportaciones, las firmas y el cambio después de firmar, el informe en PDF y Excel, el asistente con la API simulada (nunca con una clave real) y el presupuesto adjudicado importado en el `programa/ARKEN_CONTROL.html` real;
- la de la capa de las apps (16): `www/` con la política por huellas, un script inyectado que no corre, la copia diaria y la bóveda en el escritorio simulado, y el modo de consulta y el menú Compartir en Android simulado.

Resultado de esta entrega: **582 de 582 comprobaciones pasaron**.

Para Chromium, las pruebas buscan `/opt/pw-browsers` o la variable `CHROME_PATH`.

## Criterios de aceptación (§27): estado real

| # | Criterio | Estado |
|---|---|---|
| 1 | Presupuesto de ida y vuelta con ARKEN CONTROL | **Probado.** Va de ANALYTICA a ARKEN real y vuelve, y también parte de la plantilla de ARKEN: idéntico, con el mismo costo directo (`pruebas/ida-y-vuelta.mjs`). |
| 2 | Ningún paquete trae precios, APU ni valores del presupuesto base | **Probado.** Se buscó en cada paquete generado, en la adenda y en el documento de respuestas (`pruebas/punta-a-punta.mjs`), y en el pliego de cada etapa (`pruebas/nucleo-fase-2.mjs`). El pliego en PDF, desde la Fase 1. |
| 3 | ARKEN OFERTA abre con doble clic en los cuatro navegadores y rechaza un paquete alterado | **Probado en Chromium:** abre desde `file://`, rechaza un paquete con un byte cambiado y nombra el archivo, y rechaza un ARKEN OFERTA con el pliego editado. **No se probó en Edge, Firefox ni Safari.** |
| 4 | Cada sobre queda con su invitado, en su carpeta | **Probado:** cinco sobres a la vez, asignados por el código de invitación aunque el archivo esté renombrado; el repetido, el ajeno y el reemplazado; una carpeta por proponente. |
| 5 | Un sobre no se abre antes del cierre, sin la frase ni sin dos del comité; un byte alterado se detecta | **Probado:** antes del cierre se rechaza, también llamando a la lógica; exige dos miembros distintos del rol Comité; un byte alterado se detecta al recibir y al abrir (`pruebas/cripto.mjs`, `pruebas/sobres-maliciosos.mjs`, `pruebas/punta-a-punta.mjs`). |
| 6 | Totales recalculados y diferencias por renglón | **Probado:** cada oferta se recalcula con las cantidades del pliego y el módulo 12 muestra cada diferencia por renglón, con la de Épsilon detectada en la prueba (`pruebas/nucleo-fase-3.mjs`, `pruebas/punta-a-punta-fase-3.mjs`). |
| 7 | A dos clics del dato, del documento y de la regla | **Probado:** desde la bandeja, un clic en la evidencia lleva al renglón resaltado o abre el documento; desde el gerencial, un clic en el puntaje lleva a su cálculo; desde la matriz de requisitos del módulo 15, un clic abre la verificación con el documento declarado, las reglas de verificación y la vigente (`pruebas/punta-a-punta-fase-4.mjs`). |
| 8 | Alertas de la prueba punta a punta | **Probado:** las nueve alertas esperadas aparecen, todas con evidencia, porqué, regla y qué hacer, y Alfa no tiene ninguna. Ver el supuesto sobre las ofertas de demostración. |
| 9 | Orden de elegibilidad calculado a mano | **Probado** con los cinco métodos económicos, en el núcleo y en el navegador. |
| 10 | Requisitos creados por el usuario en todos los módulos | **Probado:** aparecen en el pliego, en ARKEN OFERTA, en la carpeta del proponente, en la evaluación, en la matriz del módulo 15, en el concepto y con su sección y su hoja en el informe (`pruebas/nucleo-fase-4.mjs`). En el navegador se probó la matriz del módulo 15 con los requisitos del Anexo B, no con uno creado por el usuario. |
| 11 | Informe en PDF carta con índice, encabezado, pie y «Página x de y» | **Probado:** el PDF del informe trae la portada, el índice con cada sección, el encabezado, el pie y «Página x de y» en cada página después de la portada, y la marca de agua mientras no esté firmado (`pruebas/punta-a-punta-fase-4.mjs`). |
| 12 | No se emite sin acuerdo aprobado por abogado ni sin respaldo de llaves | **Probado** desde la Fase 1 (`pruebas/humo.mjs`, `pruebas/unitarias.mjs`). |
| 13 | Sistema visual de ARKEN en claro y oscuro, tres densidades, 360 px | **Probado en Chromium**, en el principal y en los dieciséis módulos de ARKEN OFERTA. No se probó en Firefox ni en Safari. |
| 14 | Textos escapados; ninguna clave ni llave privada en claro | **Probado:** una razón social con HTML no rompe el pliego incrustado; un nombre de archivo con HTML en un sobre se rechaza sin pintarse; ningún paquete ni sobre trae una llave privada; la clave de API no queda en la base del navegador en claro, ni en los respaldos, ni en la solicitud a la API; en las apps, un script inyectado no corre. El verificador bloquea en el repositorio los paquetes, sobres, informes, conceptos y copias. |
| 15 | La IA no crea datos ni puntajes | **Probado con la API simulada:** una lectura cuyo texto no está en el documento se descarta, lo que se usa lo decide el evaluador y la lectura no escribe ninguna verificación; una redacción con una cifra o un proponente que no estén en la evaluación no se puede aceptar; la herramienta de lectura no tiene campos de cumplimiento ni de puntaje. **No se probó con la API real** (no hay clave en las pruebas). |

## Supuestos de esta entrega

- **Fórmulas de Colombia Compra Eficiente.** Los cinco métodos económicos y el desempate se transcribieron de memoria. Las pruebas comprueban que el programa aplica bien esas fórmulas, no que sean las del documento tipo vigente: hay que verificarlas antes de un proceso real.
- **Ofertas de la prueba de la Fase 3.** §25 pide llenar cinco ARKEN OFERTA en el navegador. La prueba de la Fase 2 ya lo hace con cinco ARKEN OFERTA reales; la de la Fase 3 usa sobres generados en el principal con el mismo formato y la misma llave, porque así cada oferta trae exactamente el rasgo que se busca. La parte del informe es de la Fase 4.
- **Rendimiento.** El análisis no se midió con 3.000 actividades y 12 proponentes (§25).
- **Umbrales de las alertas.** Son los de la decisión 78 y la configuración del módulo 12; conviene ajustarlos con procesos reales.
- **SMMLV de 2000 a 2009.** Quedan marcados «por verificar»; los de 2010 a 2026 son los del documento maestro.
- **Textos legales.** El acuerdo de confidencialidad y el pliego son una redacción de partida. No se emiten sin la aprobación de un abogado.
- **Navegadores.** Probado en Chromium. Edge usa el mismo motor, pero no se probó por separado; Firefox y Safari tampoco se probaron, ni el principal ni ARKEN OFERTA.
- **Reloj.** El cierre lo marca el reloj de cada equipo. ARKEN OFERTA no genera sobres después del cierre según su reloj, y el principal rechaza los que digan haberse generado después según la hora del sobre. Un reloj del proponente atrasado a propósito podría poner una hora falsa en el sobre; el principal avisa si la hora va adelantada, y el acta registra la hora de recepción de cada sobre.
- **Sobre sin cifrar.** En un proceso de sobre cerrado se recibe con aviso y no se rechaza (decisión 58).
- **Búsqueda en los PDF.** Solo encuentra texto en los PDF que lo tienen; los escaneados sin capa de texto no se buscan.
- **Asistente de IA con la API real.** Las pruebas usan una API simulada. Antes de un proceso real, conviene probar la lectura con documentos reales y revisar los precios por millón de tokens (decisión 118).
- **Apps.** La capa se probó en Chromium con el escritorio y Android simulados. La app de escritorio y las de celular se compilan en GitHub Actions, pero no se abrieron en un equipo ni en un teléfono reales. Los documentos de varios cientos de MB no se probaron en la app (decisión 127).
- **Demostración.** Usa NIT de la serie 999, que la DIAN no asigna, y nombres que empiezan por «DEMO».
