# ARKEN PRECIOS · Registro de cambios

## 0.2.0 · Fase 2, Investigador IA · 4 de octubre de 2026

El programa busca precios publicados en internet con la API de Claude y solo deja entrar los que están escritos en la página que leyó. Es opcional: se enciende con la clave de API de Anthropic del usuario.

**Programa**

- **Investigador IA** (§7.3): por cada insumo y ciudad, Claude busca con la búsqueda web, lee cada página y registra cada precio con su texto literal, su enlace, la unidad, la presentación, el IVA y la ciudad. El SDK oficial de Anthropic va dentro del archivo. Modelos Claude Opus 5.5 (por defecto), Sonnet 5.5 y Haiku 4.5, con esfuerzo configurable y respaldo de modelo.
- **Verificación literal obligatoria** (criterio 9): un precio entra solo si está en el texto literal y el texto literal está en la página leída en esa misma búsqueda. Lo que no se pudo leer queda pendiente hasta que una persona lo vea en la página. La IA nunca escribe en la base: todo pasa por el registro, que vuelve a exigirlo.
- **Revisar hallazgos** (Módulo 02): Por revisar, Pendientes de verificar, Productos nuevos, Registrados y Descartados. Confirmar (también varios a la vez), elegir otro insumo, rechazar, descartar, verificar con el enlace a la vista, retirar un precio ya registrado y volver a revisar.
- **Vínculos de producto** (ficha del insumo): las páginas de cada producto, automáticas, confirmadas, rechazadas o rotas. La siguiente búsqueda lee primero las confirmadas, y lo que venga de una página rechazada se descarta.
- **Centro de actualización** (Módulo 02): la búsqueda con IA dentro del alcance elegido; vista previa con las búsquedas, las solicitudes, el costo estimado y el gasto del mes; avance por categoría y por sitio, con el registro en vivo de cada búsqueda, página y precio; pausar, reanudar y cancelar; resultado por fuente, «Revisar hallazgos», «Revisar cambios en la base» y «Crear corte».
- **Ficha:** «Actualizar este insumo ahora» ofrece «Solo recalcular» o «Buscar con IA y recalcular», con el costo estimado. Las observaciones del Investigador dicen cómo se verificaron y llevan la huella de la página. Las observaciones de alcance nacional se ven en todas las ciudades.
- **Fuentes propuestas** (Módulo 03) con las páginas leídas, y **bandeja de nuevos** (Módulo 09) con el enlace y el precio visto. Nada se activa solo; decidir una propuesta resuelve los hallazgos que la originaron.
- **Configuración › Investigador IA:** aviso antes de escribir la clave, autorización, clave cifrada en el equipo o solo para la sesión, probar la conexión (sin costo), activar y apagar; modelo, esfuerzo, respaldo, tope de gasto del mes, TRM, precios, búsquedas y páginas por insumo, texto por página, búsquedas a la vez, reutilizar lo buscado en la semana, sitios permitidos o bloqueados y tabla de tarifas con su fecha.
- **Control de costo:** estimación antes de ejecutar, costo real de cada búsqueda, tope del mes, caché semanal por insumo y ciudad, caché de instrucciones de Anthropic y prioridad por clase ABC.
- **Base de datos versión 2:** almacenes de hallazgos, búsquedas y secretos. Una base de la Fase 1 se actualiza sola, sin perder nada.
- **Ayuda:** Investigador IA, Revisar hallazgos y Costo de la IA.

**Pruebas y herramientas**

- `pruebas/investigador.mjs`: 125 comprobaciones del núcleo del Investigador con respuestas de la API simuladas.
- `pruebas/investigador-navegador.mjs`: 59 comprobaciones de punta a punta en Chromium con la API simulada, sin clave real.
- `herramientas/armar-sdk.mjs` y `herramientas/sdk/`: rehacen el SDK incrustado desde versiones fijas; `npm run sdk:comprobar` lo compara en la CI.
- El flujo `.github/workflows/precios.yml` corre los pasos nuevos.

**Correcciones antes de entregar**

- La prueba de punta a punta fallaba a veces: revisaba un dato antes de que el programa terminara de guardar la acción. Ahora espera el aviso con que termina cada acción.
- El aviso de la clave no decía que, abierto como archivo, Chrome y Edge comparten lo guardado con otros HTML abiertos desde el disco. Ahora lo dice (decisión 53).

## 0.1.0 · Fase 1, núcleo sin internet · 2 de octubre de 2026

Primera versión. Un solo HTML (`programa/ARKEN_PRECIOS.html`) con el sistema visual de ARKEN CONTROL, que guarda todo en el navegador y funciona sin conexión.

**Programa**

- Ingreso con usuarios y roles, cambio obligatorio de la contraseña inicial, contraseñas con PBKDF2 y auditoría de cada cambio.
- Catálogo de 884 insumos: los 336 de ARKEN CONTROL con su descripción, unidad y categoría exactas, y 548 nuevos, en una taxonomía de 60 grupos con sus categorías. Equivalencias con ARKEN confirmadas e importación de la lista maestra que exporta ARKEN (Módulo 09).
- Ciudades con su región y subregión, y la ciudad de referencia de la empresa.
- Registro de precios con su soporte: a mano, cotizaciones y listas de precios en Excel, CSV o PDF, siempre con revisión antes de guardar. El lector de precios se probó con 60 formatos reales colombianos y entiende el IVA y las presentaciones (un bulto de 42,5 kg se lleva al bulto de 50 kg; una varilla de 6 m publicada por unidad, a kilos).
- Consolidación por insumo y ciudad: mediana ponderada sin atípicos, nivel de confianza, ampliación a la subregión, la región y el país cuando faltan datos, y precio de referencia de ARKEN rotulado como tal.
- Base de precios con cortes fechados (un corte cerrado no cambia), precios adoptados con su justificación y la ficha de cada insumo a un clic, con sus observaciones, su texto literal y su enlace.
- Actualizar precios por alcance (todo, categorías, insumos, desactualizados, pendientes o fuentes), con vista previa, avance, antes y después, e historial de ejecuciones.
- Mano de obra: calculadora del costo empresa con los parámetros laborales de 2026 y su norma, oficios por ciudad, cuadrillas y conversión a HC, JOR, DIA y MES.
- Exportaciones: Excel para ARKEN CONTROL con su validador (lee el archivo como lo lee ARKEN), Excel de análisis, PDF e impresión de la base completa o por categorías en carta con «Página x de y», paquete de precios, archivo de intercambio y respaldo completo.
- Tablero básico: índice de la canasta, variación mensual y anual, evolución, comparación entre ciudades y mayores alzas y bajas, con filtros de fechas, ciudades, categorías, fuentes y tipo de precio, calculado en un Web Worker.
- Comparador entre ciudades, entre cortes y entre fuentes.
- Modo demostración rotulado DEMO, que se carga y se borra con un botón.
- Tema claro y oscuro, tres densidades y uso desde 360 px de ancho.

**Pruebas**

- `pruebas/unitarias.mjs`: 72 comprobaciones del núcleo.
- `pruebas/ida-y-vuelta.mjs`: 29 comprobaciones con el `programa/ARKEN_CONTROL.html` real.
- `pruebas/humo.mjs`: 37 comprobaciones en Chromium.
- `herramientas/verificar-sin-datos.mjs` y el flujo `.github/workflows/precios.yml`, que corre todo con cada cambio.

**Correcciones antes de entregar**

- Los redondeos de 3 decimales daban un milésimo de menos en algunos valores por el ruido binario (73.012,7385 salía 73.012,738).
- El índice de la canasta quedaba vacío cuando el primer mes del periodo no tenía datos.
- Las cotizaciones con una columna «Ítem» antes de «Descripción» tomaban el número del renglón como descripción.
- Las listas de precios en PDF no se podían importar: pdf.js dejaba inservible el archivo antes de calcular su huella.
- A 360 px, la barra superior tapaba la franja de indicadores (el mismo detalle está en ARKEN CONTROL; vea DECISIONES.md).
