# ARKEN ANALYTICA

Evaluación de propuestas de obra, app hermana de [ARKEN CONTROL](../README.md) y [ARKEN PRECIOS](../precios/README.md). Con ella la empresa principal arma el proceso de invitación:

- el presupuesto base, que va y vuelve de ARKEN CONTROL en Excel;
- las condiciones de la oferta;
- los documentos y los invitados con su acuerdo de confidencialidad;
- el cronograma y el pliego en PDF.

Antes de emitir, una revisión bloquea la emisión mientras falte algo.

**Estado:** Fase 1 de 4, el núcleo del programa principal. Los paquetes de invitación, ARKEN OFERTA (el programa del proponente) y los sobres llegan en la Fase 2; la verificación y los puntajes, en la 3; el comparativo, el informe y las apps, en la 4.

Más información:

- [PLAN.md](PLAN.md): el plan;
- [DECISIONES.md](DECISIONES.md): las decisiones;
- [CAMBIOS.md](CAMBIOS.md): lo que cambió;
- [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md): cómo probarlo paso a paso.

## Abrirlo

1. Descargue [`programa/ARKEN_ANALYTICA.html`](programa/ARKEN_ANALYTICA.html). En GitHub, abra el archivo y pulse «Download raw file».
2. Ábralo con doble clic en Chrome o Edge. Funciona sin internet: las librerías de Excel, PDF y ZIP van dentro del archivo.
3. Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.

Los datos se guardan en ese navegador, en ese equipo, y no se sincronizan solos. Para llevarlos a otro equipo o guardarlos aparte use **Administración › Respaldos**.

El archivo del repositorio está siempre vacío de datos. **No suba al repositorio un HTML, un respaldo, un respaldo de llaves, un paquete ni un sobre de un proceso real: el repositorio es público.** `npm run verificar-sin-datos` lo comprueba, y también corre en GitHub Actions.

## Para quien desarrolla

- **Código fuente:**
  - `fuente/nucleo/`: cálculo, Excel, NIT, festivos, condiciones, acuerdo, cronograma, revisión, criptografía, pliego y demostración. No toca la pantalla.
  - `fuente/app/`: almacén, sesión, interfaz, PDF y vistas de cada módulo.
  - `fuente/estilos.css` y `fuente/cuerpo.html`.
- **Armar el programa:**
  - `npm run construir` arma `programa/ARKEN_ANALYTICA.html`;
  - `npm run comprobar` falla si el del repositorio no es el armado.
  - No edite el HTML a mano.
- **Pruebas:**
  - `npm ci --omit=optional` y luego `npm run prueba`;
  - Chromium se busca en `/opt/pw-browsers` o en la variable `CHROME_PATH`;
  - lo que cubre cada prueba está en [GUIA_DE_PRUEBA.md](GUIA_DE_PRUEBA.md#pruebas-automáticas).
- **GitHub Actions:** `.github/workflows/compilar-analytica.yml` corre todo en cada cambio de `analytica/` o de `programa/ARKEN_CONTROL.html` y deja el HTML como artefacto de la ejecución.
- **Versiones:** las etiquetas son `analytica-vX.Y.Z`. La versión vive en `package.json` y el compilador la escribe en el programa.
