# ARKEN ANALYTICA · Guía de prueba de la Fase 1

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
- la de sobres maliciosos contra la recepción y la apertura reales (22);
- la de ida y vuelta con el `programa/ARKEN_CONTROL.html` real (18);
- la de humo del principal (53);
- la de humo de ARKEN OFERTA (16): autenticidad, dieciséis módulos, temas, 360 px, borrador en archivo, sesión y cierre;
- la de punta a punta (50), con cinco ARKEN OFERTA en su propio navegador. Recorre los paquetes, el camino de la confidencialidad, las preguntas, la adenda, los sobres, la recepción, el cierre con el reloj adelantado, la apertura con el comité y la carpeta de cada proponente.

Resultado de esta entrega: **341 de 341 comprobaciones pasaron**.

Para Chromium, las pruebas buscan `/opt/pw-browsers` o la variable `CHROME_PATH`.

## Criterios de aceptación (§27): estado real

| # | Criterio | Estado |
|---|---|---|
| 1 | Presupuesto de ida y vuelta con ARKEN CONTROL | **Probado.** Va de ANALYTICA a ARKEN real y vuelve, y también parte de la plantilla de ARKEN: idéntico, con el mismo costo directo (`pruebas/ida-y-vuelta.mjs`). |
| 2 | Ningún paquete trae precios, APU ni valores del presupuesto base | **Probado.** Se buscó en cada paquete generado, en la adenda y en el documento de respuestas (`pruebas/punta-a-punta.mjs`), y en el pliego de cada etapa (`pruebas/nucleo-fase-2.mjs`). El pliego en PDF, desde la Fase 1. |
| 3 | ARKEN OFERTA abre con doble clic en los cuatro navegadores y rechaza un paquete alterado | **Probado en Chromium:** abre desde `file://`, rechaza un paquete con un byte cambiado y nombra el archivo, y rechaza un ARKEN OFERTA con el pliego editado. **No se probó en Edge, Firefox ni Safari.** |
| 4 | Cada sobre queda con su invitado, en su carpeta | **Probado:** cinco sobres a la vez, asignados por el código de invitación aunque el archivo esté renombrado; el repetido, el ajeno y el reemplazado; una carpeta por proponente. |
| 5 | Un sobre no se abre antes del cierre, sin la frase ni sin dos del comité; un byte alterado se detecta | **Probado:** antes del cierre se rechaza, también llamando a la lógica; exige dos miembros distintos del rol Comité; un byte alterado se detecta al recibir y al abrir (`pruebas/cripto.mjs`, `pruebas/sobres-maliciosos.mjs`, `pruebas/punta-a-punta.mjs`). |
| 6 | Totales recalculados y diferencias por renglón | **Parcial:** en la apertura cada oferta se recalcula con las cantidades del pliego y se listan sus diferencias de precio por actividad. El análisis presupuestal completo es de la Fase 3. |
| 7 | A dos clics del dato, del documento y de la regla | **Parcial:** el documento de cada requisito está a dos clics en el módulo 10. El dato y la regla, en las fases 3 y 4. |
| 8 | Alertas de la prueba punta a punta | No probado: Fase 3. |
| 9 | Orden de elegibilidad calculado a mano | No probado: Fase 3. |
| 10 | Requisitos creados por el usuario en todos los módulos | **Parcial:** aparecen en el pliego, en ARKEN OFERTA y en la carpeta del proponente. La evaluación, el comparativo, el concepto y el informe llegan en sus fases. |
| 11 | Informe en PDF carta con índice, encabezado, pie y «Página x de y» | **Probado en el motor de PDF** con el presupuesto, el pliego, el acuerdo y las actas. El informe llega en la Fase 4. |
| 12 | No se emite sin acuerdo aprobado por abogado ni sin respaldo de llaves | **Probado** desde la Fase 1 (`pruebas/humo.mjs`, `pruebas/unitarias.mjs`). |
| 13 | Sistema visual de ARKEN en claro y oscuro, tres densidades, 360 px | **Probado en Chromium**, en el principal y en los dieciséis módulos de ARKEN OFERTA. No se probó en Firefox ni en Safari. |
| 14 | Textos escapados; ninguna clave ni llave privada en claro | **Probado:** una razón social con HTML no rompe el pliego incrustado; un nombre de archivo con HTML en un sobre se rechaza sin pintarse; ningún paquete ni sobre trae una llave privada, y el verificador bloquea en el repositorio los paquetes, sobres y pliegos incrustados. |
| 15 | La IA no crea datos ni puntajes | No probado: Fase 4. |

## Supuestos de esta entrega

- **Fórmulas de Colombia Compra Eficiente.** Se transcribieron de memoria y hay que verificarlas contra el documento tipo vigente antes de puntuar (Fase 3).
- **SMMLV de 2000 a 2009.** Quedan marcados «por verificar»; los de 2010 a 2026 son los del documento maestro.
- **Textos legales.** El acuerdo de confidencialidad y el pliego son una redacción de partida. No se emiten sin la aprobación de un abogado.
- **Navegadores.** Probado en Chromium. Edge usa el mismo motor, pero no se probó por separado; Firefox y Safari tampoco se probaron, ni el principal ni ARKEN OFERTA.
- **Reloj.** El cierre lo marca el reloj de cada equipo. ARKEN OFERTA no genera sobres después del cierre según su reloj, y el principal rechaza los que digan haberse generado después según la hora del sobre. Un reloj del proponente atrasado a propósito podría poner una hora falsa en el sobre; el principal avisa si la hora va adelantada, y el acta registra la hora de recepción de cada sobre.
- **Sobre sin cifrar.** En un proceso de sobre cerrado se recibe con aviso y no se rechaza (decisión 58).
- **Búsqueda en los PDF.** Solo encuentra texto en los PDF que lo tienen; los escaneados sin capa de texto no se buscan.
- **Demostración.** Usa NIT de la serie 999, que la DIAN no asigna, y nombres que empiezan por «DEMO».
