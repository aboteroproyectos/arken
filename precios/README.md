# ARKEN PRECIOS

Observatorio de precios de insumos de obra en Colombia, app hermana de [ARKEN CONTROL](../README.md). Guarda cada precio con su fuente, su fecha, su ciudad y el texto donde apareció; calcula por insumo y ciudad un precio recomendado con su nivel de confianza, y entrega un Excel que ARKEN CONTROL importa sin tocarlo (**Módulo 04 › Exportar / importar… › Importar desde Excel**).

**Estado:** Fase 3. Sobre el núcleo de la Fase 1, que funciona sin internet (cotizaciones, listas de precios en Excel, CSV o PDF y registros a mano), y el **Investigador IA** de la Fase 2, que busca precios publicados con la API de Claude, llegan el **motor de recolección**, que lee las fuentes que la empresa certifique, y las **apps** para Windows, macOS, Android e iOS, con un **servidor de recolección** opcional. En todos los casos, un precio entra solo si está escrito en lo que se leyó. El plan está en [PLAN.md](PLAN.md), las decisiones en [DECISIONES.md](DECISIONES.md) y lo que cambió en [CAMBIOS.md](CAMBIOS.md).

## Abrirlo

Hay dos maneras, y las dos usan el mismo programa:

- **La app** (recomendada en el computador, porque trae el motor de recolección): vea [Descargar las apps](#descargar-las-apps).
- **El archivo HTML**, sin instalar nada: descargue [`programa/ARKEN_PRECIOS.html`](programa/ARKEN_PRECIOS.html) (en GitHub, abra el archivo y pulse «Download raw file») y ábralo con Chrome o Edge. Así funciona todo menos la lectura automática de fuentes, que necesita la app de escritorio o el servidor de recolección.

Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.

Abierto como archivo, las librerías de Excel y PDF (SheetJS, jsPDF y pdf.js) se cargan de internet al abrir el programa, como en ARKEN CONTROL: sin conexión, el Excel avisa que no está disponible y el PDF sale por la impresión del navegador. Las apps las traen adentro y funcionan sin internet desde la primera vez. El SDK de Anthropic que usa el Investigador IA va dentro del archivo; el Investigador sí necesita internet.

## Descargar las apps

Cada cambio en `precios/` compila las apps en GitHub Actions:

1. Abra la pestaña **Actions** y elija la última ejecución de «Compilar ARKEN PRECIOS» con marca verde (en un PR, también aparece al pie del PR, en los «checks»).
2. Al final de la página, en **Artifacts**, descargue la de su plataforma (hay que haber iniciado sesión en GitHub).

Cuando se publica una versión con la etiqueta `precios-vX.Y.Z` (por ejemplo `precios-v0.3.0`), los instaladores también quedan en **Releases**, sin necesidad de iniciar sesión. Las etiquetas `vX.Y.Z` siguen siendo de ARKEN CONTROL.

| Plataforma | Archivo | Cómo se instala |
|---|---|---|
| Windows | `ARKEN-PRECIOS-x.y.z-Windows.exe` | Ejecútelo. La primera vez, SmartScreen avisa porque la app no está firmada: «Más información» › «Ejecutar de todas formas». |
| macOS | `ARKEN-PRECIOS-x.y.z-macOS.dmg` | Arrastre la app a Aplicaciones. La primera vez macOS la bloquea: autorícela en Configuración del Sistema › Privacidad y seguridad › «Abrir igualmente». Sirve para Mac con Apple Silicon e Intel. |
| Android | `ARKEN-PRECIOS-x.y.z-Android.apk` | Ábralo en el teléfono y permita «Instalar apps desconocidas» cuando lo pida. Solo aparece si existe el secreto de la firma (vea [Firma de Android](#firma-de-android)). |
| iOS | `ARKEN-PRECIOS-x.y.z-iOS-sin-firma.ipa` | Debe firmarse antes de instalarse, igual que ARKEN CONTROL: vea [iPhone y iPad](../README.md#iphone-y-ipad). |

ARKEN PRECIOS y ARKEN CONTROL se instalan lado a lado, cada uno con sus datos. Las versiones nuevas se instalan encima de las anteriores y conservan los datos.

La app de escritorio es la que lee las fuentes. La del celular sirve para consultar, registrar cotizaciones y descargar los paquetes del servidor de recolección; no lee fuentes por su cuenta.

## Cómo se guardan los datos

- Todo se guarda solo, en ese equipo (en el navegador o dentro de la app). Otro navegador u otro equipo no ve esos datos: **no se sincronizan solos.**
- **Administración › Respaldos › Descargar respaldo** crea un archivo `ARKEN_PRECIOS_respaldo_<fecha>.json.gz` con todo; **Restaurar…** lo carga en este equipo o en otro, también desde la pantalla de ingreso. Descárguelo con frecuencia: es la manera de pasar los datos a otro equipo.
- **En las apps**, cada cambio se copia además en un archivo del equipo (la **copia interna**): si el sistema llegara a borrar el almacenamiento interno de la app, al abrirla se recuperan los datos. En el computador queda también **una copia por día de los últimos 10 días**, que se restaura con «Restaurar…»; la carpeta se abre desde **Ayuda › Abrir la carpeta de copias diarias** o desde **Administración › Respaldos**.
- **Guardar copia…** crea un `ARKEN_PRECIOS_copia_<fecha>.html` con el catálogo, las equivalencias, los parámetros y el corte activo adentro, para consultar esos precios en otro equipo. No lleva las observaciones ni los usuarios: no reemplaza el respaldo.
- La clave de API del Investigador IA y el token del servidor nunca viajan en respaldos, copias ni paquetes. En la app de escritorio quedan cifrados por el sistema operativo; en el navegador y en el celular, cifrados con una llave que no sale del equipo, o se usan solo durante la sesión. En otro equipo hay que escribirlos de nuevo.

> **El repositorio es público.** Nunca suba un respaldo ni una copia con datos de la empresa. El `programa/ARKEN_PRECIOS.html` de esta carpeta va siempre vacío, y `npm run verificar-sin-datos` lo comprueba en cada cambio.

## Llevar los precios a ARKEN CONTROL

1. En ARKEN PRECIOS: **08 · Exportar e imprimir › Excel para ARKEN CONTROL**. Elija el alcance, la ciudad y el corte (o los precios vigentes).
2. El validador lee el archivo ya escrito como lo lee ARKEN: categorías válidas, precios mayores que cero, descripciones sin repetir, y cuántos renglones saldrán como «Ya existe». Si algo falla, no deja guardar.
3. En ARKEN CONTROL: abra el proyecto y vaya a **Módulo 04 › Exportar / importar… › Importar desde Excel › Seleccionar archivo…**.
4. Revise la lista: los insumos que ya existen salen como «Ya existe». Pulse **Sobrescribir todos los que coinciden**, luego **Importar** y confirme.

Al sobrescribir, ARKEN cambia solo el precio: la unidad y la categoría quedan iguales. Para que los códigos coincidan con los de un proyecto, exporte en ARKEN la lista maestra (**Módulo 04 › Excel — Lista maestra**) e impórtela en **09 · Catálogo y equivalencias › Lista maestra de ARKEN**.

## Fuentes automáticas (motor de recolección)

El motor lee por su cuenta las fuentes de internet que la empresa **certifique**, desde la app de escritorio o desde el servidor de recolección. Hay conectores para seis fuentes: tres tiendas en línea (Easy, La Casita Roja en Cartagena y Aldia en Bucaramanga), la base de precios unitarios del IDU (Bogotá), la Tienda Virtual del Estado (las compras de las entidades públicas, en datos abiertos) y el ICOCED del DANE. Otras fuentes se pueden configurar con los conectores genéricos (HTML, API JSON, Socrata, Excel y PDF).

**Para leer una fuente** (administrador), en la app de escritorio:

1. **10 · Configuración › Motor y servidor:** escriba el correo de contacto que verán los sitios. Sin él, el motor no lee nada.
2. **03 · Fuentes**, ficha de la fuente:
   - **Firmar la revisión legal.** La ficha trae lo que dicen el robots.txt y los términos del sitio, leídos el 5 de octubre de 2026, con una recomendación. Léalos en sus enlaces, elija el resultado y firme como responsable. Esa decisión es de la empresa: el programa no la toma por usted.
   - **Configurar el conector** (las seis fuentes ya lo traen) y **Probar ahora**: una lectura corta que debe traer precios verificados.
   - **Activar.**
3. **02 · Actualizar precios:** marque «Leer las fuentes certificadas antes de recalcular», revise la vista previa y ejecute. Lo dudoso espera en **Revisar hallazgos**.

El motor se identifica con el agente `ARKEN-PRECIOS` y su correo, respeta el robots.txt de cada sitio, hace pausas por sitio, guarda en caché lo que no cambió y nunca intenta pasar un CAPTCHA ni un inicio de sesión: una fuente que lo pida queda **bloqueada** hasta que una persona la revise. Homecenter, Corona e INVÍAS no se leen de forma automática porque sus términos no lo permiten; sus precios se registran a mano o por cotización. Cada precio que trae un conector lo vuelve a verificar el programa contra el texto leído, igual que con el Investigador IA.

**Actualización programada:** **02 · Actualizar precios › Programación** (diaria, semanal o mensual). Corre mientras el programa esté abierto y nunca usa el Investigador IA. Para que corra aunque nadie abra el programa, use el servidor.

**Servidor de recolección (opcional):** un equipo de la empresa que queda encendido corre el mismo motor a su hora y deja **paquetes de precios** que el programa descarga y vuelve a verificar. Cómo instalarlo: [`servidor/LEAME.md`](servidor/LEAME.md).

**Por qué htmlparser2:** el motor lee las páginas con [htmlparser2](https://github.com/fb55/htmlparser2) y [css-select](https://github.com/fb55/css-select), el analizador y el selector sobre los que está hecho cheerio: son maduros, rápidos y no ejecutan el código de las páginas. Es la única librería que el motor agrega a las de ARKEN, y se usa en el servidor y en la app de escritorio, porque el motor es uno solo. Una página que arma sus precios con JavaScript no se puede leer así; para esas tiendas sirve su API pública, si sus términos lo permiten, o el registro a mano (decisión 59).

## Investigador IA

Es opcional y se paga con su propia cuenta de Anthropic. Por cada insumo y ciudad, Claude busca en internet precios publicados, lee cada página y le entrega al programa el texto donde aparece el precio. El programa compara ese texto con la página leída:

- **Si el precio no está escrito en la página, se descarta.** La IA nunca escribe un precio en la base: lo que entra lo registra el programa, con la misma revisión que un precio a mano.
- Lo que es claramente el insumo buscado entra como observación, con el enlace, el texto literal y la huella de la página.
- Lo dudoso (otro producto parecido, la unidad, la ciudad) espera en **02 · Actualizar precios › Revisar hallazgos**, donde una persona lo confirma con la página a la vista. Lo que no se pudo leer (un PDF escaneado) queda pendiente hasta que alguien abra el enlace.
- Los productos que no están en el catálogo llegan a la bandeja de nuevos del Módulo 09, y los sitios nuevos a **03 · Fuentes › Fuentes propuestas**. Nada se activa solo.

**Para encenderlo** (administrador): **10 · Configuración › Investigador IA**. Lea el aviso, marque la autorización, escriba la clave de API (se crea en la consola de Claude, console.anthropic.com), elija si la guarda cifrada en el equipo o la usa solo en la sesión, pruebe la conexión y pulse **Activar el Investigador IA**. Ahí mismo están el modelo (Claude Opus 5.5 por defecto; Sonnet 5.5 y Haiku 4.5 cuestan menos), el esfuerzo, el tope de gasto del mes (US$ 10 por defecto) y los sitios permitidos o bloqueados.

**Costo:** antes de ejecutar, la vista previa muestra cuántas búsquedas hará, el costo estimado en dólares y lo gastado en el mes; después, el costo real. Al llegar al tope, se detiene. Lo buscado en la semana se reutiliza, y va primero lo que más pesa en el presupuesto. La actualización programada nunca lo usa.

> **Sobre la clave:** el programa la usa para llamar a la API de Claude, así que quien entre al programa en ese equipo puede lanzar búsquedas con ella. Abierto como archivo, Chrome y Edge comparten lo guardado con cualquier otro HTML que se abra desde el disco en ese navegador; en las apps no pasa, y en la de escritorio la clave queda cifrada por el sistema operativo. Use una clave solo para este programa, con un límite de gasto en la consola de Claude.

## Módulos

| | Módulo | Para qué |
|---|---|---|
| 00 | Tablero | Índice de la canasta, evolución, comparación entre ciudades, mayores alzas y bajas, con filtros de fechas, ciudades y categorías. |
| 01 | Base de precios | Precio recomendado por insumo y ciudad, con su confianza; un clic lleva a las observaciones que lo sostienen. Cortes con fecha. La ficha de cada insumo tiene sus vínculos de producto y «Actualizar este insumo ahora», también con el Investigador IA. |
| 02 | Actualizar precios | Recalcula un alcance (todo, categorías o insumos) y muestra el antes y el después. Antes puede leer las fuentes certificadas con sus conectores y buscar con el Investigador IA: vista previa, avance por fuente, pausa y cancelación, y la bandeja **Revisar hallazgos**. **Programación** de las actualizaciones y paquetes del servidor. |
| 03 | Fuentes | Fuentes con su tipo, confiabilidad, salud y revisión legal; certificación, prueba técnica y activación de las que se leen solas; **fuentes propuestas** por el Investigador IA, que nunca se activan solas, e **Índices (ICOCED)**. |
| 04 | Cotizaciones | Cotizaciones, precios a mano, listas de precios (Excel, CSV o PDF) y solicitudes de cotización, siempre con revisión antes de guardar. |
| 05 | Mano de obra | Oficios por ciudad, calculadora del costo empresa con el desglose a la vista, cuadrillas y parámetros laborales con vigencia. |
| 06 | Comparador | Entre ciudades, entre cortes y entre fuentes. |
| 07 | Alertas | Llegan en la Fase 4. |
| 08 | Exportar e imprimir | Excel para ARKEN, Excel de análisis, PDF e impresión (completos o por categorías), paquete de precios, archivo de intercambio y respaldo. |
| 09 | Catálogo y equivalencias | 884 insumos (los 336 de ARKEN y 548 nuevos), grupos y categorías, equivalencias con ARKEN, lista maestra y bandeja de nuevos insumos (también los que encuentra el Investigador IA). |
| 10 | Configuración | Empresa, ciudades, consolidación, IVA, parámetros laborales, apariencia (tema y densidad), Investigador IA (clave, modelo, tope de gasto y sitios) y **Motor y servidor** (correo de contacto, topes de lectura y servidor de recolección). |
| 11 | Ayuda | Cómo funciona cada parte. |

## Demostración

**Administración › Demostración › Cargar la demostración** genera precios sintéticos para los insumos que tienen precio de referencia de ARKEN, en varias ciudades y meses, para ver el tablero y los informes con datos. Todo queda rotulado DEMO, una banda al pie de cada pantalla lo recuerda, no se exporta salvo que se marque y **Borrar la demostración** lo quita sin tocar los precios reales.

## Pruebas

Requieren Node 22 y Chrome o Chromium. Desde esta carpeta:

```sh
npm ci --omit=optional
npm run prueba
```

Ninguna prueba lee sitios reales ni usa una clave real: los sitios se simulan con páginas que tienen su misma forma y datos inventados (`pruebas/fixtures/motor`), y la API de Claude se simula.

| Prueba | Qué comprueba |
|---|---|
| `verificar-sin-datos` | El HTML del programa no trae datos de la empresa ni claves. |
| `prueba:unitarias` | Lector de precios (60 formatos), unidades, IVA y AIU, estadísticos y confianza, emparejamiento, calculadora laboral contra el ejemplo hecho a mano, validador del Excel para ARKEN, escape de textos y claves, y el tablero con 50.000 observaciones. |
| `prueba:investigador` | El Investigador IA con la API de Claude simulada: la verificación literal, la solicitud, las pausas, los errores, el costo, el tope y el destino de cada hallazgo; y, en Chromium, la configuración y la clave cifrada, una búsqueda desde el Módulo 02, las bandejas, la ficha y que una base anterior se actualice sin perder nada. |
| `prueba:motor` | El motor con sitios de prueba: robots.txt, agente con contacto, pausas, reintentos, caché, bloqueos que no se evaden, salud de fuentes, lectores de HTML, Excel y PDF, los seis conectores certificados y los cinco genéricos. |
| `prueba:recoleccion` | El plan del motor, la programación en hora de Colombia, el reparto de lo leído (el programa vuelve a verificar cada precio), los índices y los paquetes del servidor. |
| `prueba:motor-navegador` | El motor dentro del programa, en Chromium: certificar, probar, activar y leer las seis fuentes desde los módulos 02, 03 y 10, revisar lo que traen, una segunda lectura sin duplicados, un motor alterado que no logra meter un precio inventado y un paquete alterado que no entra. |
| `prueba:servidor` | El servidor de recolección de verdad en un puerto local: token, lecturas, programación, paquetes con su hash y el programa conectado a él. |
| `prueba:ida-y-vuelta` | El Excel generado se importa en el `programa/ARKEN_CONTROL.html` real de este repositorio: todos los de la semilla salen «Ya existe» y al sobrescribir solo cambia el precio. |
| `prueba:humo` | Recorre todos los módulos en Chromium: captura de precios por la interfaz, demostración, tablero, exportaciones, impresión, sin conexión, temas, densidades y 360 px. |
| `prueba:app` | La capa de las apps en Chromium (`npm run preparar` antes): copia interna, bóveda, Android simulado y la política de seguridad de contenido. |

El SDK de Anthropic que va dentro del programa se rehace desde versiones fijas y se compara con el del programa:

```sh
npm run sdk:instalar
npm run sdk:comprobar
```

La app de escritorio empacada se prueba con Electron de verdad, en Linux, con un llavero de prueba para la bóveda:

```sh
npm run dist:linux
xvfb-run -a dbus-run-session -- sh pruebas/con-llavero.sh npm run prueba:escritorio
```

Si Chrome no está en la ruta habitual, indíquela con `CHROME_PATH`. En GitHub, el flujo [`precios.yml`](../.github/workflows/precios.yml) corre las pruebas con cada cambio en `precios/` o en `programa/ARKEN_CONTROL.html`, y [`compilar-precios.yml`](../.github/workflows/compilar-precios.yml) prueba y compila las apps.

La guía para probarlo a mano, paso a paso, está en [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md).

## Firma de Android

El APK se firma con la misma clave de ARKEN CONTROL (`android/firma/arken.jks.enc` en la raíz del repositorio) y su contraseña va en el mismo secreto **`ARKEN_FIRMA_CLAVE`** (*Settings › Secrets and variables › Actions*). Sin ese secreto, Android se compila para verificarlo, pero no se entrega el APK. La firma no debe cambiar nunca: si cambiara, Android obligaría a desinstalar la app, y con ella se borrarían los datos del teléfono.

## Para desarrollar

Requisitos: Node.js 22. Para Android se necesita Android Studio, y para iOS, un Mac con Xcode. Desde esta carpeta:

```sh
npm ci
npm run preparar           # genera www/ desde programa/ARKEN_PRECIOS.html
npm run escritorio         # abre la app de escritorio
npm run android            # prepara el proyecto de Android (luego: npx cap open android)
npm run ios                # prepara el proyecto de iOS (luego: npx cap open ios)
npm run dist:windows       # instalador de Windows (en Windows)
npm run dist:mac           # instalador de macOS (en un Mac)
npm run servidor           # servidor de recolección (vea servidor/LEAME.md)
```
