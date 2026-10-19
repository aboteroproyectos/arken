# ARKEN ANALYTICA · Registro de cambios

## 0.4.0 · Fase 4 · Decisión, informe y apps (19 de octubre de 2026)

Con esta entrega, la evaluación termina en un concepto firmado por el comité y un informe en PDF y Excel. El presupuesto adjudicado pasa a ARKEN CONTROL, y el programa llega como app de escritorio y como app de consulta para el celular.

### Comparativo y cuadro gerencial (módulo 15)

- **Cuadro comparativo** por capítulo, subcapítulo o actividad, con el presupuesto base, cada oferta, su desviación frente a la base y frente a la mediana, coloreado por tamaño. Se filtra por capítulo, por peso mínimo y por «solo con alertas»; las actividades con alerta llevan un punto.
- **Cuadro gerencial** en una página: valor, diferencia frente a la base, plazo, AIU, habilitación con su causal, puntaje por grupo, total, experiencia, indicadores financieros, alertas críticas y un semáforo por proponente. Dice «En evaluación» hasta que el concepto esté firmado y entonces «Recomendado: …». Un clic en el puntaje lleva a su cálculo en el módulo 14.
- **Matriz de requisitos** con el cumplimiento y los puntos de cada proponente, también los requisitos que usted creó. Cada celda abre la verificación.
- Los tres se exportan a Excel y a PDF.

### Las 15 gráficas

Valor total frente a la base, cascada por capítulo, mapa de calor, caja y bigotes, Pareto de la base, composición por insumo, AIU, radar de puntajes, técnico frente a valor, curvas S, Gantt comparativo, indicadores financieros, experiencia en SMMLV, desbalance en el tiempo y sensibilidad (tornado).

- Pasar el cursor por un proponente lo resalta en la gráfica; un clic en un capítulo baja a sus subcapítulos.
- Cada una se ve en pantalla completa, se exporta en PNG, SVG o PDF y se marca para el informe.
- Los colores de cada proponente son los mismos en todas.

### Concepto e informe (módulo 16)

- **Concepto de adjudicación** generado a partir de la evaluación: resumen, análisis por grupo de requisitos, fortalezas y debilidades de cada proponente con su evidencia, orden de elegibilidad, recomendación, condiciones y riesgos del primero y el segundo. El comité edita cada texto.
- **Firmas:** se firma con dos miembros del comité y su contraseña. El PDF lleva las firmas y la huella. Si algo cambia después de firmar (una verificación, un texto), el concepto vuelve a borrador con un aviso y hay que firmarlo de nuevo.
- **Informe final** con las 23 secciones de §20 en casillas, reordenables arrastrando o con flechas, más una sección por cada requisito que usted creó. Se eligen las gráficas que entran. Sale en PDF carta (portada, índice, encabezado, pie y «Página x de y») y en Excel, una hoja por tabla.
- Mientras el concepto no esté firmado, el informe lleva la marca de agua «BORRADOR: NO ES UNA DECISIÓN».
- **Versiones:** cada informe generado queda guardado con su fecha, su huella y quién lo generó, y se puede volver a bajar.
- **Presupuesto adjudicado para ARKEN CONTROL:** con el concepto firmado, el presupuesto del proponente recomendado sale en el Excel de importación de ARKEN CONTROL, con sus APU e insumos. Los APU repetidos y los insumos con la misma descripción y otro precio se renombran para que ARKEN CONTROL no los junte.
- El tablero del proceso muestra el cuadro gerencial corto y tres gráficas después de la apertura.

### Asistente de IA (opcional, §18.13)

- **Apagado por defecto.** Lo enciende el administrador en el módulo 16 › Asistente, con su clave de API de Anthropic, el modelo y un tope de gasto por mes. Se puede apagar en un proceso.
- **Antes de cada llamada** una ventana dice qué se envía, a quién, el costo estimado y lo que va del tope. Nada sale sin «Enviar a la API».
- **Lectura de documentos** desde la ventana de verificación: la IA propone el valor de cada campo con el texto literal y la página. El programa lo descarta si ese texto no está en el documento, y nada se escribe solo: el evaluador decide qué usar.
- **Redacción del concepto:** la IA propone el resumen, la recomendación, las condiciones y los riesgos a partir de los hechos de la evaluación. Cada parte se acepta o se descarta, y una parte con una cifra o un proponente que no estén en la evaluación no se puede aceptar.
- **La IA no da puntajes ni decide** el cumplimiento: no tiene cómo.
- **La clave** se cifra en el equipo: con la bóveda del sistema operativo en la app de escritorio, o con una llave del navegador que no se puede exportar. No va en los respaldos ni en el HTML.
- Cada llamada queda en la auditoría con el modelo, los tokens y el costo.

### Apps (§6)

- **Escritorio (Windows, macOS y Linux),** recomendada para la empresa: una ventana propia, la clave de API en la bóveda del sistema operativo y una copia de los datos por día, de los últimos 10 días (Ayuda › Abrir la carpeta de copias diarias). Fuera de la app, solo sale a internet el asistente, hacia la API de Anthropic.
- **Celular y tableta (Android e iOS), solo consulta:** el tablero, los procesos, el comparativo, el informe y la ayuda. Los datos llegan restaurando un respaldo hecho en el computador. Lo que se descarga se abre en el menú Compartir.
- En la app, la política de seguridad permite cada script del programa por su huella: un script inyectado en la página no corre.
- GitHub Actions compila las cinco (`compilar-apps-analytica.yml`); una etiqueta `analytica-vX.Y.Z` publica los instaladores.

### Seguridad

- `herramientas/verificar-sin-datos.mjs` bloquea también los informes, conceptos, cuadros, gráficas y presupuestos de un proceso, las copias diarias y la bóveda de la app de escritorio.
- Borrar la demostración también borra sus conceptos, informes, lecturas y uso de la IA.

### Pruebas

- **`pruebas/nucleo-fase-4.mjs` (47):** el comparativo suma lo mismo que el cálculo en cada nivel, el gerencial, las 15 gráficas sin NaN, el concepto, el informe con un requisito creado por el usuario, la validación de la IA (lectura y redacción), el costo y el tope, y el presupuesto adjudicado leído como lo lee ARKEN CONTROL.
- **`pruebas/punta-a-punta-fase-4.mjs` (51), en Chromium:** módulos 15 y 16 sobre el proceso evaluado, la evidencia a dos clics, las exportaciones, la firma con dos del comité y el cambio después de firmar, el informe en PDF y Excel, el asistente con la API simulada y la importación del presupuesto adjudicado en el `programa/ARKEN_CONTROL.html` real.
- **`pruebas/app.mjs` (16):** la capa de las apps con escritorio y Android simulados.
- La de humo ya no deja ningún módulo atenuado.

## 0.3.0 · Fase 3 · Verificación y análisis (19 de octubre de 2026)

Con esta entrega, las ofertas abiertas se verifican, se analizan y se ordenan. Cada hallazgo llega a una bandeja de alertas con su porqué y su evidencia.

### Verificación (módulo 11)

- **Matriz requisito por proponente.** Cada celda se verifica en una ventana con el documento, la página y el texto literal que lo acredita. Cada verificación queda como una fila nueva con el evaluador, la fecha y la observación; la anterior no se borra.
- **Cada evaluador, lo suyo.** El evaluador técnico, el jurídico y el financiero verifican solo los requisitos de su grupo. «No cumple» y «Subsanable» exigen observación. Hay cinco valores: sí, no, subsanable, pendiente y no aplica.
- **Subsanaciones:**
  - la solicitud sale en PDF, con el plazo en días hábiles con festivos de Colombia;
  - la respuesta del proponente queda en su carpeta del módulo 10, marcada como subsanación, y se anota si llegó fuera de plazo;
  - la justificación de un valor artificialmente bajo se pide igual y la decide solo el comité.
- **Habilitación** por proponente: habilitada, no habilitada (con su causal) o pendiente. Mientras alguna esté pendiente, el puntaje es provisional.
- Una oferta sobre una versión anterior del pliego espera la decisión del comité.

### Análisis presupuestal (módulo 12)

Ocho subpestañas, cada una con el presupuesto base al lado:

- **Aritmética:** cada renglón recalculado, con la diferencia frente a lo declarado y si el APU suma.
- **Capítulos, subcapítulos y actividades:** valor y desviación frente a la base, coloreados por tamaño.
- **Insumos:** el precio de cada insumo frente a la base. Se emparejan solos cuando coinciden la descripción y la unidad; los parecidos se sugieren y una persona los confirma o los empareja a mano.
- **AIU:** porcentajes, desglose de la administración frente al personal ofrecido y el costo empresa mínimo, y el IVA con la base y la tarifa del pliego.
- **Desbalance:** z robusto (mediana y MAD) sobre el precio relativo al nivel de cada oferta, la regla de ±30 % frente a la base y el cargue al inicio con la programación.
- **APU:** rendimientos, insumos faltantes, desperdicios y jornales por debajo del costo empresa mínimo.
- **Configuración:** los umbrales de cada regla, ajustables por proceso.

### Técnico, legal y financiero (módulo 13)

- **Indicadores financieros:** liquidez, endeudamiento, cobertura de intereses, capital de trabajo, rentabilidades. Para consorcios y uniones temporales se usa lo declarado por la figura, con su participación.
- **Experiencia** convertida a SMMLV del año de terminación, el área y el número de contratos.
- **Personal:** formación y años frente al cargo, la misma persona en dos cargos de dedicación completa y el organigrama.
- **Sistemas de gestión, programación** (ruta crítica, plazo y precedencias) y los requisitos que usted creó.
- Cada uno muestra la sugerencia del programa, el cálculo y la decisión del evaluador.

### Evaluación y puntajes (módulo 14)

- **Cinco métodos económicos:** menor valor, cercanía al presupuesto, media aritmética, media aritmética alta y media geométrica con el presupuesto, con la TRM cuando aplica.
- Ponderables automáticos (por rangos o proporcionales a lo verificado) y manuales.
- Desempate en el orden del pliego, con sorteo registrado en acta.
- Orden de elegibilidad, la sensibilidad (si el orden cambia cuando cada grupo pesa un 10 % más o menos) y las no habilitadas al final, con su causal.

### Bandeja de alertas (§18.11)

- **Botón en la barra superior**, con un contador de alertas abiertas.
- **Lo que trae cada alerta:** el nivel (crítica, importante u observación), qué encontró, por qué importa, la regla aplicada, qué hacer y su evidencia. Desde la bandeja, un clic en la evidencia lleva al renglón resaltado, al requisito o al documento en su página.
- **Estados:** nueva, en revisión, confirmada y descartada (con motivo). El estado se conserva al volver a analizar. Una alerta que deja de presentarse queda como «ya no se presenta».
- **Posibles acuerdos entre proponentes:**
  - APU idénticos;
  - precios que se mueven juntos;
  - las mismas cifras;
  - el mismo contacto;
  - la misma persona en dos ofertas.
  Cada uno trae un recordatorio de que es un indicio, no una prueba.
- El tablero del proceso cuenta las alertas abiertas por nivel.

### Demostración

- En el módulo 09 de un proceso de demostración:
  - «Ofertas de demostración» genera cinco sobres cerrados de proponentes ficticios, cada uno con un rasgo que el análisis debe encontrar, y los recibe como cualquier sobre;
  - «Adelantar el cierre (demostración)» lleva el cierre a un minuto antes de ahora, para seguir con el acta y la apertura.
- Borrar la demostración también borra sus verificaciones, subsanaciones y alertas.

### Pruebas

- **`pruebas/nucleo-fase-3.mjs` (85):**
  - estadística, costo empresa mínimo y cada método económico contra un ejemplo a mano;
  - TRM, desempate, habilitación, indicadores financieros, consorcio, experiencia en SMMLV, personal, días hábiles y ruta crítica;
  - las alertas de las cinco ofertas de demostración y una evaluación completa con el orden calculado a mano.
- **`pruebas/punta-a-punta-fase-3.mjs` (42), en Chromium:** sobres de demostración, cierre, apertura con el comité, la bandeja con cada alerta y su evidencia a un clic, los roles, la verificación desde la matriz, la subsanación con su PDF, la justificación decidida por el comité, el orden de elegibilidad con cada método frente al calculado a mano, el estado de una alerta descartada y el borrado de la demostración.
- La de humo deja atenuados solo los módulos 15 y 16.

## 0.2.0 · Fase 2 · Invitación, ARKEN OFERTA, sobres y apertura (18 de octubre de 2026)

Con esta entrega el ciclo llega de la emisión a la apertura: el principal arma un paquete por invitado, cada invitado prepara su oferta en ARKEN OFERTA y la devuelve en un sobre cerrado, y el comité la abre después del cierre.

### En el principal (`programa/ARKEN_ANALYTICA.html`)

- **Paquetes y envío (módulo 07, pestaña nueva):**
  - un ZIP por invitado con ARKEN OFERTA (con el pliego de ese invitado adentro), `LEAME_PRIMERO.pdf`, el acuerdo de confidencialidad, el pliego en PDF y los documentos vigentes;
  - todo va en un manifiesto con la huella de cada archivo, firmado con la llave del proceso;
  - en el modo de dos envíos, el primer paquete solo trae el acuerdo; el completo sale cuando el acuerdo firmado está verificado;
  - «Generar todos», el correo preparado para cada invitado y el registro del envío.
- **Preguntas y adendas (módulo 08):**
  - importa el archivo de preguntas de ARKEN OFERTA, asignado por el código de invitación, o registra las que llegan por correo;
  - el documento de respuestas sale numerado, firmado y sin decir quién preguntó, en PDF y en un archivo para ARKEN OFERTA;
  - una adenda crea la versión siguiente del pliego: se edita como antes de emitir, muestra la lista de cambios, se puede descartar y, al emitirla, se firma. Después del plazo de adendas solo se admite prorrogar el cierre.
- **Recepción y apertura (módulo 09):**
  - se sueltan todos los sobres a la vez; cada uno se asigna a su invitado por el código de invitación y queda sellado, sin abrir;
  - de cada invitado vale el último sobre generado antes del cierre; los demás quedan «reemplazado»;
  - los repetidos, los ajenos y los alterados se rechazan con su motivo;
  - a la hora de cierre, el acta de cierre;
  - la apertura exige la hora de cierre, el acta de cierre, la frase del proceso y dos miembros del comité autenticados en el momento. Descifra todo a la vez, verifica cada adjunto, recalcula los totales con las cantidades del pliego y deja el acta de apertura, que no se puede modificar.
- **Documentos de proponentes (módulo 10):**
  - una carpeta por proponente, con su color, y cada documento contra el requisito que responde;
  - la vigencia comparada con la fecha de cierre;
  - búsqueda de texto en los PDF, con la página y el hallazgo resaltado;
  - la carpeta se descarga en un ZIP cuyo nombre empieza por la razón social.
- La cinta de totales muestra los sobres vigentes, las ofertas abiertas y la oferta más baja recalculada. El botón «Cargar ofertas» lleva a la recepción.
- Borrar la demostración también borra sus preguntas, adendas, sobres, ofertas, documentos y actas.

### ARKEN OFERTA (el programa del proponente, dentro de cada paquete)

- Se abre con doble clic y funciona sin internet. Antes de empezar comprueba la firma del paquete y la huella de cada archivo; si algo cambió, dice qué archivo falló. Muestra la huella de la llave de firma para confirmarla por teléfono.
- Tiene un usuario local con contraseña por invitado, se cierra a los 20 minutos sin uso y guarda el borrador en el equipo y, si se pide, en un archivo.
- Tiene dieciséis módulos:
  - proponente, con consorcios y uniones temporales;
  - documentos del proceso;
  - presupuesto con APU, con la plantilla de precios en Excel o el Excel de ARKEN CONTROL;
  - AIU con el desglose de la administración;
  - los requisitos de cada grupo, incluidos la programación (MS Project o Excel), el organigrama y los indicadores financieros;
  - preguntas, respuestas y adendas;
  - revisión y sobre.
- Importa la adenda sin perder lo diligenciado y marca para revisar lo que cambió.
- El sobre sale cerrado: el contenido va cifrado con la llave pública del proceso. Después del cierre ya no se genera.
- En el modo de un envío exige aceptar el acuerdo antes de ver los documentos. En el de dos, el primer ARKEN OFERTA solo genera el sobre de confidencialidad.

### Seguridad

- Ningún paquete, adenda ni documento de respuestas lleva precios del presupuesto base. La prueba de punta a punta lo comprueba en cada archivo generado.
- Al recibir se rechazan los ZIP con rutas que salen de su carpeta, nombres con HTML, bombas de compresión o demasiados archivos. Al abrir, los PDF con JavaScript o con acciones que abren programas no se guardan.
- `../herramientas/verificar-sin-datos.mjs` ahora también rechaza:
  - un pliego incrustado, incluso dentro de la plantilla comprimida;
  - los archivos ARKEN OFERTA de un invitado;
  - borradores y sobres de confidencialidad;
  - archivos de preguntas, respuestas y adendas;
  - plantillas de precios y actas.

### Pruebas

Se agregan:

- núcleo de la Fase 2 (68);
- sobres maliciosos contra la recepción real (22);
- humo de ARKEN OFERTA (16);
- prueba de punta a punta con cinco ofertas (50).

La de criptografía suma el sobre cerrado (29). Todas corren en GitHub Actions.

### Lo que todavía no está

- **Fase 3:** verificación de requisitos, subsanaciones, análisis presupuestal, técnico, legal y financiero, y puntajes. Las alertas siguen vacías.
- **Fase 4:** comparativo, gráficas, concepto, informe, asistente de IA y apps de escritorio y móvil.

## 0.1.0 · Fase 1 · Núcleo del principal (18 de octubre de 2026)

Primera entrega: el programa principal, en un solo archivo, `programa/ARKEN_ANALYTICA.html`, que se abre con doble clic y funciona sin internet.

### Lo que trae

- **Sistema visual de ARKEN:** pantalla de ingreso, barra superior, menú lateral de 18 módulos, cinta de totales, temas claro y oscuro, tres densidades y diseño hasta 360 px de ancho.
- **Ingreso, usuarios y roles:** administrador, director del proceso, evaluador técnico, evaluador jurídico, evaluador financiero, comité, jurídico (aprueba el acuerdo de confidencialidad) y consulta. Hay cambio obligatorio de contraseña en el primer ingreso, bloqueo por inactividad y auditoría de cada acción.
- **Procesos (módulo 01):** crear, abrir, duplicar y archivar. Cada proceso nuevo trae la plantilla de condiciones del Anexo B.
- **Presupuesto base (módulo 02):**
  - capítulos, subcapítulos, actividades, APU, insumos, AIU e IVA, con el mismo cálculo de ARKEN CONTROL;
  - importación y exportación del Excel de ARKEN CONTROL, de ida y vuelta;
  - PDF en los cuatro niveles de ARKEN;
  - actualización de precios desde la base, con vista previa.
- **Base de precios (módulo 03):** lectura del Excel de ARKEN PRECIOS, historial de cada precio y alta desde el presupuesto.
- **Condiciones de la oferta (módulo 04):**
  - la plantilla del Anexo B, con requisitos habilitantes y ponderables, evaluador, regla de verificación y regla de puntaje;
  - plantillas propias;
  - aviso cuando los puntajes no suman 1.000.
- **Documentos del proceso (módulo 05):** archivos con huella SHA-256, versiones, aviso de repetidos, documentos por enlace verificado y vista previa de PDF e imágenes.
- **Invitados y confidencialidad (módulo 06):**
  - invitados con NIT verificado por su dígito, registro de envíos y del acuerdo firmado;
  - el acuerdo de confidencialidad personalizado por invitado, con cláusula penal y aprobación por abogado.
- **Pliego, revisión y emisión (módulo 07):**
  - cronograma con días hábiles y festivos de Colombia;
  - pliego en PDF con portada, índice, numeración y formulario de cantidades sin precios;
  - llaves del proceso con su respaldo;
  - revisión antes de emitir, que bloquea la emisión mientras haya un punto en rojo.
- **Ayuda (módulo 17), administración** (usuarios, auditoría en Excel, respaldos, restauración de llaves, registro técnico, demostración) **y configuración** (empresa con logo, apariencia, parámetros con el SMMLV, límites del programa).
- **Respaldos:** un .zip con manifiesto y huellas, sin llaves privadas en claro. Se restaura desde la administración o desde la pantalla de ingreso, con un administrador.
- **Modo demostración:** un proceso de casa campestre con presupuesto, 5 invitados ficticios y cronograma. Va rotulado en cada pantalla y en cada PDF, y se borra con un botón sin tocar los datos reales.

### Lo que todavía no está (llega en las fases siguientes)

Los módulos 08 a 16 aparecen atenuados en el menú, con la fase en que llegan:

- **Fase 2:** paquete de invitación, ARKEN OFERTA, sobres, preguntas y adendas, recepción y apertura.
- **Fase 3:** verificación, análisis y puntajes.
- **Fase 4:** comparativo, gráficas, concepto, informe, asistente de IA y apps de escritorio y móvil.

### Herramientas del repositorio

- `herramientas/construir.mjs` arma el HTML desde `fuente/`; `npm run comprobar` verifica que el del repositorio sea el armado.
- `../herramientas/verificar-sin-datos.mjs` ahora también revisa `analytica/`. Rechaza:
  - HTML con datos;
  - claves de API y llaves privadas en claro;
  - paquetes de invitación, ofertas, sobres, respaldos y respaldos de llaves.
- Pruebas: unitarias (85), criptografía (23), ida y vuelta con ARKEN CONTROL (18) y humo en Chromium (53).
- Flujo de GitHub Actions `compilar-analytica.yml`, que corre todo lo anterior en cada PR que toca `analytica/` o ARKEN CONTROL.
