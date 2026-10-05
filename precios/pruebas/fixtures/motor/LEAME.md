# Páginas guardadas para las pruebas del motor

Estas páginas tienen la **misma forma** que las de cada sitio el 5 de octubre de 2026 (las mismas
etiquetas, clases, campos de las API y columnas de los archivos), pero **los datos son de prueba**:
los nombres llevan «Prueba» y los precios e índices son inventados. No son precios de las tiendas,
del IDU, de Colombia Compra Eficiente ni del DANE, y nunca entran a la base del programa.

- `easy/`: respuesta de la API del catálogo (VTEX) para una búsqueda y para un producto.
- `casitaroja/`: respuesta de la API de la tienda (WooCommerce Store API).
- `aldia/`: dos páginas de una categoría (PrestaShop) con su paginación y la página de un producto.
- `idu/`: la página del portafolio que enlaza el Excel; el Excel se arma en la prueba con la forma
  de la hoja de insumos del IDU (`pruebas/motor.mjs`).
- `dane/`: la página del ICOCED que enlaza los anexos; el Excel de anexos se arma en la prueba.
- `tvec/`: filas de los conjuntos 3hdv-smhz (renglones) y rgxm-mmea (órdenes) de datos.gov.co.
- `*/robots.txt`: las reglas que importan de cada sitio (las que cierran la búsqueda, los filtros
  o las cuentas), escritas para la prueba.

Si un sitio cambia de forma, el conector falla con «formato» y la fuente queda bloqueada hasta que
una persona la revise: estas páginas se actualizan junto con el conector.
