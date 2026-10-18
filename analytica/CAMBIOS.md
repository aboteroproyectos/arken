# ARKEN ANALYTICA · Registro de cambios

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
