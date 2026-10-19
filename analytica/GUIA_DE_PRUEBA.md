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

## Pruebas automáticas

En la carpeta `analytica/`:

```
npm ci --omit=optional
npm run prueba
```

`npm run prueba` corre, en orden:

- el verificador de datos;
- la comprobación de que el HTML es el armado desde `fuente/`;
- las pruebas unitarias (85), de criptografía (23), de ida y vuelta con el `programa/ARKEN_CONTROL.html` real (18) y de humo en Chromium (53).

Resultado de esta entrega: **179 de 179 comprobaciones pasaron**.

Para Chromium, las pruebas buscan `/opt/pw-browsers` o la variable `CHROME_PATH`.

## Criterios de aceptación (§27): estado real

| # | Criterio | Estado |
|---|---|---|
| 1 | Presupuesto de ida y vuelta con ARKEN CONTROL | **Probado.** Va de ANALYTICA a ARKEN real y vuelve, y también parte de la plantilla de ARKEN: idéntico, con el mismo costo directo (`pruebas/ida-y-vuelta.mjs`). |
| 2 | Ningún paquete trae precios, APU ni valores del presupuesto base | **Probado en lo que existe:** el pliego en PDF no trae ningún precio, y el acuerdo no deja deducir el total oculto. Los paquetes llegan en la Fase 2 y ahí se probará. |
| 3 | ARKEN OFERTA abre con doble clic en los cuatro navegadores y rechaza un paquete alterado | No probado: Fase 2. |
| 4 | Cada sobre queda con su invitado, en su carpeta | No probado: Fase 2. |
| 5 | Un sobre no se abre antes del cierre, sin la frase ni sin dos del comité; un byte alterado se detecta | **Probada la base:** llaves, frase equivocada, byte alterado y firma (`pruebas/cripto.mjs`). Los sobres, el cierre y el comité llegan en la Fase 2. |
| 6 | Totales recalculados y diferencias por renglón | No probado: Fase 3. |
| 7 | A dos clics del dato, del documento y de la regla | No probado: fases 3 y 4. |
| 8 | Alertas de la prueba punta a punta | No probado: Fase 3. |
| 9 | Orden de elegibilidad calculado a mano | No probado: Fase 3. |
| 10 | Requisitos creados por el usuario en todos los módulos | **Parcial:** aparecen en el pliego. La oferta, la evaluación, el comparativo, el concepto y el informe llegan en sus fases. |
| 11 | Informe en PDF carta con índice, encabezado, pie y «Página x de y» | **Probado en el motor de PDF** con el presupuesto, el pliego y el acuerdo. El informe llega en la Fase 4. |
| 12 | No se emite sin acuerdo aprobado por abogado ni sin respaldo de llaves | **Probado:** en la interfaz y llamando a la lógica directamente (`pruebas/humo.mjs`, `pruebas/unitarias.mjs`). |
| 13 | Sistema visual de ARKEN en claro y oscuro, tres densidades, 360 px | **Probado en Chromium.** No se probó en Firefox ni en Safari. |
| 14 | Textos escapados; ninguna clave ni llave privada en claro | **Probado en lo que existe:** una razón social con HTML se pinta escapada; el HTML, el respaldo y el respaldo de llaves no traen llaves en claro, y el verificador lo bloquea en el repositorio. Los paquetes y los sobres llegan en la Fase 2. |
| 15 | La IA no crea datos ni puntajes | No probado: Fase 4. |

## Supuestos de esta entrega

- **Fórmulas de Colombia Compra Eficiente.** Se transcribieron de memoria y hay que verificarlas contra el documento tipo vigente antes de puntuar (Fase 3).
- **SMMLV de 2000 a 2009.** Quedan marcados «por verificar»; los de 2010 a 2026 son los del documento maestro.
- **Textos legales.** El acuerdo de confidencialidad y el pliego son una redacción de partida. No se emiten sin la aprobación de un abogado.
- **Navegadores.** Probado en Chromium (Chrome y Edge). Firefox y Safari no se probaron.
- **Demostración.** Usa NIT de la serie 999, que la DIAN no asigna, y nombres que empiezan por «DEMO».
