# ARKEN ANALYTICA

Evaluación de propuestas de obra, app hermana de [ARKEN CONTROL](../README.md) y [ARKEN PRECIOS](../precios/README.md). Con ella la empresa principal arma el proceso de invitación:

- el presupuesto base, que va y vuelve de ARKEN CONTROL en Excel;
- las condiciones de la oferta;
- los documentos y los invitados con su acuerdo de confidencialidad;
- el cronograma y el pliego en PDF.

Antes de emitir, una revisión bloquea la emisión mientras falte algo. Después genera un paquete por invitado con **ARKEN OFERTA**, el programa con el que cada proponente prepara su oferta y la devuelve en un sobre cerrado. Responde preguntas, emite adendas, recibe los sobres y los abre después del cierre con la frase del proceso y dos miembros del comité.

Después verifica cada oferta, la analiza contra el presupuesto base, emite alertas con su porqué y su evidencia, y la puntúa hasta el orden de elegibilidad. Al final arma el cuadro comparativo, el cuadro gerencial y quince gráficas; el concepto de adjudicación, que firman dos miembros del comité; el informe final en PDF y Excel, y el presupuesto adjudicado para ARKEN CONTROL. Un asistente de IA opcional lee documentos y propone redacción, sin dar puntajes ni decidir.

**Estado:** las cuatro fases están. Falta probarlo con un proceso real y verificar lo que dice [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md#supuestos-de-esta-entrega).

Más información:

- [PLAN.md](PLAN.md): el plan;
- [DECISIONES.md](DECISIONES.md): las decisiones;
- [CAMBIOS.md](CAMBIOS.md): lo que cambió;
- [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md): cómo probarlo paso a paso.

## Abrirlo

1. Descargue [`programa/ARKEN_ANALYTICA.html`](programa/ARKEN_ANALYTICA.html). En GitHub, abra el archivo y pulse «Download raw file».
2. Ábralo con doble clic en Chrome o Edge. Funciona sin internet: las librerías de Excel, PDF y ZIP van dentro del archivo.
3. Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.

Los datos se guardan en ese navegador, en ese equipo, y no se sincronizan solos.

### Las apps

- **Computador (recomendada para la empresa):** Windows, macOS y Linux. Es el mismo programa en una ventana propia, con la clave del asistente de IA en la bóveda del sistema operativo y una copia de los datos por día (los últimos 10). Los instaladores salen de GitHub Actions (`compilar-apps-analytica.yml`, sección «Artifacts») y, con una etiqueta `analytica-vX.Y.Z`, en «Releases».
- **Celular y tableta, solo consulta:** Android e iOS. Muestran el tablero, los procesos, el comparativo, el informe y la ayuda. Los datos llegan restaurando un respaldo hecho en el computador (Administración › Respaldos).
- **Firma de Android:** el APK se firma con la misma clave de ARKEN CONTROL, en el secreto `ARKEN_FIRMA_CLAVE` del repositorio (*Settings › Secrets and variables › Actions*). Sin él, Android se compila para verificar pero no se entrega el APK, y las versiones se publican sin Android. El `.ipa` de iOS sale sin firma: para instalarlo hay que firmarlo con una cuenta de Apple Developer. Para llevarlos a otro equipo o guardarlos aparte use **Administración › Respaldos**.

El archivo del repositorio está siempre vacío de datos. **No suba al repositorio un HTML, un respaldo, un respaldo de llaves, un paquete, un sobre, un informe, un concepto ni una copia diaria de un proceso real: el repositorio es público.** `npm run verificar-sin-datos` lo comprueba, y también corre en GitHub Actions.

## Para quien desarrolla

- **Código fuente:**
  - `fuente/nucleo/`: cálculo, Excel, NIT, festivos, condiciones, acuerdo, cronograma, revisión, criptografía, pliego y demostración. No toca la pantalla.
  - `fuente/evaluacion/`: estadística, análisis presupuestal, técnico y financiero, puntajes, alertas, el motor que lo junta y las ofertas de demostración. No toca la pantalla y no va en ARKEN OFERTA.
  - `fuente/evaluacion/` también trae el comparativo, las gráficas, el concepto, el informe y la parte pura del asistente de IA (lo que se le pide y cómo se valida lo que responde).
  - `fuente/app/`: almacén, sesión, interfaz, PDF, paquetes, preguntas y adendas, recepción y apertura, evaluación, bandeja de alertas, decisión, asistente y las vistas de cada módulo.
  - `fuente/sdk/anthropic-sdk.js`: el SDK oficial de Anthropic, armado con `npm run sdk:instalar && npm run sdk:armar`; `npm run sdk:comprobar` falla si cambió.
  - `app/`, `electron/` y `capacitor.config.json`: las apps. `npm run preparar` arma `www/` (el programa con la capa de la app); `npm run escritorio` la abre en Electron; `npm run dist:windows`, `dist:mac` y `dist:linux` hacen los instaladores.
  - `fuente/oferta/`: ARKEN OFERTA (verificación del paquete, borrador, intercambio de archivos y sus dieciséis módulos). Se arma con el mismo núcleo y viaja comprimido dentro del principal.
  - `fuente/estilos.css` y `fuente/cuerpo.html`.
- **Armar el programa:**
  - `npm run construir` arma `programa/ARKEN_ANALYTICA.html`;
  - `npm run comprobar` falla si el del repositorio no es el armado.
  - No edite el HTML a mano.
- **Pruebas:**
  - `npm ci --omit=optional` y luego `npm run prueba`;
  - Chromium se busca en `/opt/pw-browsers` o en la variable `CHROME_PATH`;
  - lo que cubre cada prueba está en [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md#pruebas-automáticas).
- **GitHub Actions:** `.github/workflows/compilar-analytica.yml` corre todas las pruebas en cada cambio de `analytica/` o de `programa/ARKEN_CONTROL.html` y deja el HTML como artefacto de la ejecución. `.github/workflows/compilar-apps-analytica.yml` compila las cinco apps.
- **Versiones:** las etiquetas son `analytica-vX.Y.Z`. La versión vive en `package.json` y el compilador la escribe en el programa.
