# ARKEN PRECIOS · Plan de una página

App hermana de ARKEN CONTROL: investiga, guarda con su historia y consolida los precios de los insumos de obra en Colombia, y los entrega a ARKEN en un Excel que se importa sin tocarlo.

## Arquitectura

Dos piezas, porque una página web no puede leer otros sitios (CORS):

1. **El programa**, `precios/programa/ARKEN_PRECIOS.html`. Un solo archivo, como ARKEN CONTROL, que funciona sin internet. Lleva cuatro bloques de código: el **SDK oficial de Anthropic** (`@anthropic-ai/sdk`, empaquetado desde versiones fijas); el **núcleo** (cálculo puro: lector de precios, unidades, IVA y AIU, estadística, consolidación, emparejamiento, calculadora laboral, validador del Excel para ARKEN y el Investigador IA sin red: solicitud, lectura de la respuesta, verificación literal, destino de cada hallazgo y costo), que corre igual en la página, en un Web Worker y en las pruebas de Node; la **semilla** (taxonomía, catálogo, ciudades, fuentes y parámetros); y la **interfaz** (IndexedDB, clave cifrada, llamadas a la API, módulos 00 a 11, documentos).
2. **El motor de recolección**, `precios/motor/` (Node 22, Fase 3): red respetuosa (robots.txt, agente con contacto, pausas por sitio, caché), salud de fuentes y conectores certificados. Corre en el proceso principal de la app de escritorio (Electron) y en el servidor opcional `precios/servidor/`, que deja paquetes de precios. No escribe en la base: el programa vuelve a verificar cada precio con su núcleo, que el motor carga del mismo HTML. El Investigador IA (Fase 2) corre desde el programa porque la búsqueda y la lectura de páginas ocurren en los servidores de Anthropic.

## Estructura de archivos

```
precios/
  programa/ARKEN_PRECIOS.html   el programa, sin datos
  motor/                        motor de recolección: red, robots.txt, caché, salud, lectores de HTML, Excel y PDF
  motor/conectores/             seis certificados (Easy, La Casita Roja, Aldia, IDU, Tienda Virtual, DANE) y cinco genéricos
  servidor/                     servidor de recolección opcional (LEAME.md)
  app/                          capa de la app: copia interna, archivos y enlaces en el celular
  electron/                     app de escritorio: ventana, motor, bóveda de secretos, copias
  android/  ios/                proyectos nativos (Capacitor)
  recursos/                     ícono (el de ARKEN CONTROL)
  herramientas/                 preparar-web.mjs (arma www/ para las apps), verificar-sin-datos.mjs, armar-sdk.mjs
  herramientas/sdk/             versiones fijas del SDK de Anthropic y de esbuild
  pruebas/                      unitarias, Investigador IA, motor, recolección, motor en el programa, servidor,
                                ida y vuelta con ARKEN CONTROL, humo, analítica, capa de la app y app de escritorio empacada
  pruebas/fixtures/motor/       páginas de prueba con la forma de los sitios reales y datos inventados
  PLAN.md  DECISIONES.md  CAMBIOS.md  GUIA_DE_PRUEBA.md  README.md
.github/workflows/precios.yml            pruebas de ARKEN PRECIOS en cada cambio
.github/workflows/compilar-precios.yml   compila y prueba las apps (Windows, macOS, Linux, Android, iOS)
```

## Modelo de datos (IndexedDB `arken_precios`, esquema versionado)

`insumos` · `taxonomia` · `equivalenciasArken` · `ciudades` · `fuentes` · `vinculosProducto` · **`observaciones`** (el corazón: nunca se borran ni se sobrescriben; registro por cambios) · `consolidados` · `cortes` (un corte cerrado es inmutable) · `preciosAdoptados` · `ejecuciones` · `cotizaciones` · `fletes` · `parametros` (por vigencia) · `alertas` · `vistasGuardadas` · `propuestas` (bandejas de nuevos insumos y fuentes) · `usuarios` (PBKDF2) · `auditoria` · `configuracion`. Índices: observaciones por `[insumoId, ciudad, fechaCaptura]`, `fuenteId`, `ejecucionId`; consolidados por `[insumoId, ciudad, fecha]`.

Versión 2 (Fase 2): `hallazgos` (lo que encontró el Investigador IA, con su verificación y su destino), `investigaciones` (cada búsqueda de un insumo en una ciudad, con su costo) y `secretos` (la clave de API cifrada, que no sale del equipo ni entra en los respaldos).

Versión 3 (Fase 3): `indices` (el ICOCED del DANE: número índice y variaciones por dominio geográfico y grupo de costos, con su cita). Lo que traen los conectores entra a `observaciones`, `hallazgos` y `vinculosProducto`, y cada lectura queda en `ejecuciones`.

Fase 4, sin cambiar de versión: `indices` guarda también el IPC (cargado de un archivo o a mano); `fletes` guarda la tabla de fletes; `alertas`, las reglas y las alertas con su bandeja de salida; `configuracion`, las canastas propias y los ajustes del flete, y cada insumo puede llevar su peso por unidad (`pesoKg`) para el flete.

## Fuentes candidatas (todas por certificar)

Las que tienen conector certificado en la Fase 3 son Easy, La Casita Roja, Aldia, el IDU, la Tienda Virtual del Estado y el DANE (ICOCED); Homecenter, Corona e INVÍAS quedan solo a mano por sus términos (DECISIONES.md, decisiones 70 a 72).

| Tipo | Ejemplos | Método | Riesgo principal |
|---|---|---|---|
| Comercio electrónico | Homecenter, Easy, tiendas de fabricantes | `html` / `api-json` con ciudad fijada | Términos que prohíban la lectura automática (entonces solo a mano); precio por tienda |
| Fabricantes | Pavco Wavin, Gerfor, Centelsa, Procables, Corona, Pintuco, Gerdau Diaco, Paz del Río, Argos, Cemex/Holcim, Acesco, Eternit, Ajover | `html` / `pdf` | Muchos no publican precio al público; venta Cemex→Holcim en curso |
| Entidades públicas | INVÍAS, IDU, Alcaldía de Cali, Gob. de Risaralda, Gob. de Antioquia, EPM | `pdf` / `excel` por documento | El formato cambia cada vigencia; precios con o sin IVA y AIU |
| Datos abiertos | datos.gov.co, SECOP II | `socrata` | Descripciones libres, difíciles de emparejar |
| Índices | DANE ICOCED e IPC | `excel` | No son precios: validan tendencia y deflactan |
| Regulados | Combustibles (CREG, MinEnergía), tarifas EPM, escombreras | `pdf` / `html` | Publicación irregular |
| Gremios | Camacol; Construdata solo con la suscripción del usuario | `manual` | Licencia |
| Cotizaciones | Proveedores del usuario | `manual` / `excel` / `pdf` | Digitación: se revisa antes de guardar |
| Búsqueda con IA | Claude con `web_search` y `web_fetch` | `ia` | Costo; verificación literal obligatoria |

## Fases

1. **Núcleo sin internet** (hecha): sistema visual de ARKEN, ingreso y roles, catálogo (336 de ARKEN + más de 300 nuevos), ciudades, equivalencias e importación de la lista maestra de ARKEN, cotizaciones y precios manuales, listas históricas, consolidación y cortes, Base de precios, mano de obra, Excel para ARKEN con su validador, Excel de análisis, PDF e impresión, respaldos, tablero básico y modo demostración rotulado.
2. **Investigador IA** (hecha): búsqueda abierta con verificación literal, bandejas de revisión, vínculos de producto, centro de actualización completo (alcances, progreso y resultados) y control de costo.
3. **Motor y escritorio** (hecha): motor de recolección con conectores certificados (tienda en línea, entidad pública en Excel, datos abiertos e ICOCED), certificación de fuentes con revisión legal y prueba técnica, salud de fuentes, actualizaciones programadas, app de escritorio (Windows, macOS y Linux) y del celular (Android e iOS), servidor opcional y paquetes de precios.
4. **Analítica completa** (hecha): tablero completo del §13 con sus nueve gráficas, índices Jevons y Laspeyres, canastas (tipo, del presupuesto de ARKEN y propias), pesos constantes con el IPC y proyección de Holt rotulada; alertas con reglas, bandeja y bandeja de salida; comparador de ciudades y fechas, cortes y fuentes; tabla de fletes y precio puesto en obra, también en el Excel para ARKEN; catálogo de 1.052 insumos.
