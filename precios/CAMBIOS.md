# ARKEN PRECIOS · Registro de cambios

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
