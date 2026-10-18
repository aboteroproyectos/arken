# ARKEN ANALYTICA · Registro de cambios

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
