# ARKEN PRECIOS · Registro de cambios

## 0.4.1 · Corrección del Investigador IA · 6 de octubre de 2026

**Programa**

- **El Investigador IA se detenía en su primera búsqueda.** La API de Claude rechazaba cada solicitud con «Country code CO is not supported»: la búsqueda pedía resultados de Colombia y el buscador de la API no acepta ese país. Ahora la búsqueda va sin ubicación, y la ciudad, su departamento y el país siguen en el mensaje de cada búsqueda (decisión 36). Una solicitud rechazada no gasta del tope del mes.

**Pruebas**

- `pruebas/investigador.mjs`: la búsqueda no lleva `user_location` con ningún modelo, y el mensaje lleva la ciudad con su departamento y el país.

## 0.4.0 · Fase 4, analítica completa · 6 de octubre de 2026

El programa muestra cómo se mueven los precios y avisa cuando algo cambia: un tablero completo con el índice de costo de obra, canastas, pesos constantes y proyecciones rotuladas; alertas; un comparador de ciudades, fechas, cortes y fuentes, y el precio puesto en obra, también en el Excel para ARKEN. El catálogo llega a 1.052 insumos, ninguno con un precio inventado.

**Programa**

- **00 · Tablero** (§13): los filtros valen para todo el tablero (periodo, ciudades, categoría ARKEN, grupos y categorías, insumos, fuentes, tipo de precio, estadístico, vista en valores, índice o variación, pesos corrientes o constantes, canasta y umbral de alza). Seis indicadores y las nueve gráficas: evolución de precios, índices por categoría frente al ICOCED y al IPC, mapas de calor categoría × ciudad y ciudad × mes, comparación entre ciudades, mayores alzas y bajas, dispersión por fuente, composición de la canasta con la contribución a la variación y mapa de ciudades. Además, la proyección y la comparación de dos fechas o dos cortes. Un clic en una ciudad, una categoría o un insumo filtra todo y deja una miga para volver; arrastrar sobre la gráfica del periodo lo elige. Cada gráfica sale en PNG, SVG o PDF y se abre en pantalla completa, las vistas se guardan con nombre y el tablero entero sale en PDF. Todo se calcula en un Web Worker.
- **Índice de costo de obra:** Jevons encadenado por categoría y Laspeyres con los pesos fijos de una canasta. Canastas tipo de vivienda campestre de alto estándar, VIS y edificación comercial (pesos supuestos, rotulados así), de pesos iguales, del presupuesto real de ARKEN (la última lista maestra importada) y propias.
- **Pesos constantes:** el IPC del DANE se carga en **03 · Fuentes › Índices (ICOCED e IPC)** desde el archivo que publica el DANE (Excel o CSV) o a mano, con vista previa antes de guardar. El tablero lleva los precios a pesos de un mes base.
- **Proyección** a 3 o 6 meses con el método de Holt y su banda del 95 %, siempre con el rótulo «Proyección: no es un precio de mercado». No entra a la base, a los cortes ni a las exportaciones.
- **07 · Alertas** (§12): siete reglas de partida y un editor para crear otras, con destinatarios y canal (correo o WhatsApp). La revisión corre sola después de cada cambio y cada media hora, sin repetir lo ya avisado. Bandeja con nueva, vista y resuelta (con nota), insignia en el menú y bandeja de salida, que abre el correo o WhatsApp con el texto listo, como en ARKEN. **Administración › Usuarios** pide ahora el correo y el celular de quien recibe alertas.
- **06 · Comparador** (§12): ciudades y fechas (hasta 12 columnas, con una columna base y la diferencia en pesos y en porcentaje), corte contra corte, y fuente contra fuente (un insumo en todas sus fuentes, o dos fuentes en todos sus insumos). Todo sale en Excel y en PDF.
- **04 · Cotizaciones › Fletes** (§5 y §8.7): la tabla de fletes hasta cada obra (municipio y, si se quiere, vereda) en volqueta, doble troque, camión, camioneta, tractomula o acarreo en mula, por viaje, m³·km, bulto o tonelada. **Precio puesto en obra** muestra cada voluminoso con su precio de almacén y su flete, deja quitar fletes y sale en Excel. **Pesos y ajustes** recibe el peso de lo que se compra por unidad y la lista de grupos voluminosos.
- **08 · Excel para ARKEN CONTROL:** la opción «Precio puesto en obra» del paso 4. El archivo lo declara en su encabezado, en su nombre, en tres columnas más de la hoja «Detalle» y en la hoja «Notas», y ARKEN lo importa como cualquier otro.
- **Catálogo de 1.052 insumos:** los 336 de ARKEN y 716 nuevos (168 más que en la Fase 3). Una base que ya existe los recibe desde **10 · Configuración › Empresa › Catálogo de la semilla**, sin cambiar nada de lo que ya tiene.
- **Roles:** el analista de costos también arma canastas, configura alertas y registra fletes.
- **Ayuda:** tablero, índices y canastas; pesos constantes; alertas; comparador; fletes y precio puesto en obra.

**Pruebas**

- `pruebas/analitica.mjs` (nueva): 43 comprobaciones en Chromium del catálogo, el tablero con 14 meses de demostración, el IPC cargado desde un archivo, las canastas (también la del presupuesto real, con una lista maestra como la que exporta ARKEN), las alertas, el comparador, los fletes y el Excel con precio puesto en obra, también a 360 px.
- `pruebas/unitarias.mjs`: 35 más, 110 en total: registro por cambios, índices Jevons y Laspeyres, canastas, lectura del IPC, pesos constantes, proyección, fletes y el libro para ARKEN con precio puesto en obra.
- `pruebas/ida-y-vuelta.mjs`: 5 más, 34 en total: el Excel con precio puesto en obra entra al ARKEN CONTROL real con todos sus insumos como «Ya existe» y los precios con el flete.
- `pruebas/investigador-navegador.mjs`: una más, 60 en total: la semilla nueva se ofrece en Configuración y entra a una base anterior sin tocar lo que tiene.
- `pruebas/comun.mjs`: antes de escribir la contraseña nueva, las pruebas esperan el foco de su casilla, como las de ARKEN CONTROL desde su PR #4. Si escribían antes, el foco tardío podía llevarse lo de la segunda casilla.
- `pruebas/escritorio.mjs`: una más, 47 en total: un correo de la bandeja de salida de las alertas se abre en el programa de correo del sistema y la ventana se queda en la app.
- El flujo `precios.yml` corre la prueba nueva.

**Correcciones antes de entregar**

- Con el registro por cambios (Fase 3), un precio que una fuente repetía cada semana envejecía y salía de la ventana de 45 días aunque siguiera publicado. Ahora vale hasta la última vez que se vio (decisión 100).
- Los conectores dejaban la disponibilidad («agotado») en las condiciones del precio y no llegaba a la observación. Ahora llega, y la regla de agotados la ve.
- La tabla de **03 · Fuentes › Índices** (Fase 3) mostraba cien veces más grande toda variación menor que 1 %: un 0,35 % mensual del ICOCED salía como 35 %. Ahora muestra cada variación como la publica el DANE, y el IPC se guarda en porcentaje, igual que el ICOCED (decisión 96).
- Cerrar el administrador de canastas con la ✕, con Escape o con un clic afuera no refrescaba el tablero; ahora sí. Y después de cerrar una ventana hija, Escape ya no cerraba la de abajo; ahora cierra siempre la de encima.

## 0.3.0 · Fase 3, motor y escritorio · 5 de octubre de 2026

El programa lee por su cuenta las fuentes que la empresa certifique, desde la app de escritorio o desde un servidor, y sigue sin dejar entrar un precio que no esté escrito en lo que se leyó. ARKEN PRECIOS llega como app para Windows, macOS, Android e iOS.

**Motor de recolección** (`motor/`)

- **Red respetuosa** (§4.4): agente identificado con un correo de contacto (sin él no lee nada), robots.txt según la norma, una solicitud a la vez por sitio con pausa mínima y límite por minuto, reintentos solo ante fallas pasajeras y respetando `Retry-After`, caché con revalidación y cada redirección revisada antes de seguirla. Un CAPTCHA, un inicio de sesión o un acceso negado bloquean la fuente: nada se evade.
- **Salud de fuentes:** activa, degradada, caída (con enfriamiento y un solo intento después), bloqueada hasta que una persona la revise, y suspendida.
- **Seis conectores certificados:** Easy, La Casita Roja y Aldia (tiendas en línea), la base de precios del IDU (entidad pública, en Excel), la Tienda Virtual del Estado (datos abiertos) y el ICOCED del DANE. **Cinco genéricos**, configurables en la ficha: HTML, API JSON, Socrata, Excel y PDF.
- Los archivos de internet se leen encerrados: SheetJS en un contexto aparte y pdf.js sin evaluar código.

**Programa**

- **03 · Fuentes:** certificación de cada fuente (revisión legal con lo que dicen su robots.txt y sus términos, la fecha y el responsable; conector; prueba técnica con la configuración actual), **Probar ahora**, activar, suspender y reactivar, salud, últimas lecturas y errores. Las nueve fuentes candidatas traen la evidencia de su revisión y una recomendación, para que la empresa firme. Pestaña nueva **Índices (ICOCED)**.
- **02 · Actualizar precios:** «Leer las fuentes certificadas antes de recalcular», con vista previa (fuentes, solicitudes y tiempo estimado), avance y resultado por fuente. Lo dudoso va a **Revisar hallazgos** (a lo sumo 3 por insumo y fuente). Pestaña nueva **Programación**: actualización diaria, semanal o mensual, sin el Investigador IA, y los paquetes del servidor (enviar el plan, descargar e importar).
- **10 · Configuración › Motor y servidor:** correo de contacto, topes de lectura, dirección y token del servidor, y descargar los paquetes al abrir.
- Base de datos versión 3: almacén de índices. Una base anterior se actualiza sola.
- **Ayuda:** fuentes automáticas y conectores, y app de escritorio y celular.

**Apps**

- **Escritorio** (Windows, macOS y Linux, con Electron): el motor corre en el equipo; la clave de API y el token del servidor quedan cifrados por el sistema operativo; copia interna de los datos y una copia por día de los últimos 10 días; una sola ventana; los enlaces se abren en el navegador del sistema; menú **Ayuda** con la carpeta de copias diarias y la bitácora de la última lectura.
- **Celular** (Android e iOS, con Capacitor): los PDF y los archivos se abren en un visor o en Compartir, imprimir entrega el PDF, los enlaces se abren en la app del teléfono, copia interna de los datos y descarga de los paquetes del servidor.
- Las librerías van dentro de las apps, que funcionan sin internet desde la primera vez, y una política de seguridad de contenido (CSP) solo deja correr los scripts del programa.
- Compilación en GitHub Actions (`compilar-precios.yml`) y versiones publicables con la etiqueta `precios-vX.Y.Z`.

**Servidor de recolección** (`servidor/`, opcional): lee las fuentes certificadas a su hora, con el mismo motor, y deja paquetes de precios con su hash que el programa descarga y vuelve a verificar. Pide un token; instrucciones en `servidor/LEAME.md`.

**Pruebas**

- `pruebas/motor.mjs`: 155 comprobaciones del motor con sitios de prueba (un servidor local y páginas guardadas con la forma de los sitios reales).
- `pruebas/recoleccion.mjs`: 92 del plan, la programación, el reparto de lo leído, los índices y los paquetes.
- `pruebas/motor-navegador.mjs`: 63 del motor dentro del programa en Chromium (certificar, probar, activar y leer las seis fuentes, y revisar lo que traen).
- `pruebas/servidor.mjs`: 69 del servidor de verdad en un puerto local.
- `pruebas/app.mjs`: 65 de la capa de la app (copia interna, bóveda, Android simulado y CSP) en Chromium.
- `pruebas/escritorio.mjs`: 46 de la app de escritorio empacada, con Electron de verdad.
- `pruebas/humo.mjs`: una comprobación más, 38 en total: a 360 px tampoco se desplaza de lado ninguna otra pestaña de los módulos ni la ficha de una fuente.
- Los flujos `precios.yml` y `compilar-precios.yml` corren los pasos nuevos.

**Correcciones antes de entregar**

- Una segunda lectura igual de una fuente repetía sus precios. Ahora el registro reconoce el duplicado y suma una vista al precio que ya estaba (decisión 74).
- En Linux sin llavero, el programa decía que la clave quedaría cifrada, pero Electron la guardaba con una clave fija. Ahora sabe de entrada que ese equipo no cifra y ofrece usarla solo en la sesión (decisión 82).
- En la app de escritorio, un PDF que el programa abre en otra ventana se abría en blanco. Ahora se ofrece para guardar (decisión 84).
- Faltaba la política de seguridad de contenido que el prompt pide para las apps (§16). Se agregó y se probó en Chromium y en la app empacada (decisión 81).

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
