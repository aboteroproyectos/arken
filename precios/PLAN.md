# ARKEN PRECIOS · Plan de una página

App hermana de ARKEN CONTROL: investiga, guarda con su historia y consolida los precios de los insumos de obra en Colombia, y los entrega a ARKEN en un Excel que se importa sin tocarlo.

## Arquitectura

Dos piezas, porque una página web no puede leer otros sitios (CORS):

1. **El programa**, `precios/programa/ARKEN_PRECIOS.html`. Un solo archivo, como ARKEN CONTROL, que funciona sin internet. Lleva tres bloques de código: el **núcleo** (cálculo puro: lector de precios, unidades, IVA y AIU, estadística, consolidación, emparejamiento, calculadora laboral y validador del Excel para ARKEN), que corre igual en la página, en un Web Worker y en las pruebas de Node; la **semilla** (taxonomía, catálogo, ciudades, fuentes y parámetros); y la **interfaz** (IndexedDB, módulos 00 a 11, documentos).
2. **El motor de actualización**, `precios/motor/` (Node 22, Fase 3), dentro de Electron o como servidor opcional `precios/servidor/`. El Investigador IA (Fase 2) puede correr desde el programa porque la búsqueda ocurre en los servidores de Anthropic.

## Estructura de archivos

```
precios/
  programa/ARKEN_PRECIOS.html   el programa, sin datos
  herramientas/                 verificar-sin-datos.mjs
  pruebas/                      unitarias, ida y vuelta con ARKEN CONTROL, humo en Chromium
  PLAN.md  DECISIONES.md  CAMBIOS.md  GUIA_DE_PRUEBA.md  README.md
  (Fase 3) motor/  servidor/  app/  electron/  android/  ios/  recursos/
.github/workflows/precios.yml   pruebas de ARKEN PRECIOS en cada cambio
```

## Modelo de datos (IndexedDB `arken_precios`, esquema versionado)

`insumos` · `taxonomia` · `equivalenciasArken` · `ciudades` · `fuentes` · `vinculosProducto` · **`observaciones`** (el corazón: nunca se borran ni se sobrescriben; registro por cambios) · `consolidados` · `cortes` (un corte cerrado es inmutable) · `preciosAdoptados` · `ejecuciones` · `cotizaciones` · `fletes` · `parametros` (por vigencia) · `alertas` · `vistasGuardadas` · `propuestas` (bandejas de nuevos insumos y fuentes) · `usuarios` (PBKDF2) · `auditoria` · `configuracion`. Índices: observaciones por `[insumoId, ciudad, fechaCaptura]`, `fuenteId`, `ejecucionId`; consolidados por `[insumoId, ciudad, fecha]`.

## Fuentes candidatas (todas por certificar)

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

1. **Núcleo sin internet** (este PR): sistema visual de ARKEN, ingreso y roles, catálogo (336 de ARKEN + más de 300 nuevos), ciudades, equivalencias e importación de la lista maestra de ARKEN, cotizaciones y precios manuales, listas históricas, consolidación y cortes, Base de precios, mano de obra, Excel para ARKEN con su validador, Excel de análisis, PDF e impresión, respaldos, tablero básico y modo demostración rotulado.
2. Investigador IA con verificación, bandejas de revisión, vínculos y centro de actualización completo.
3. Motor, conectores certificados, escritorio y celular, servidor y paquetes de precios.
4. Analítica completa, alertas, comparador avanzado, precio puesto en obra y catálogo de más de 1.000 insumos.
