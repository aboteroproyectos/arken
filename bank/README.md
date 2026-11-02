# ARKEN BANK

Análisis de créditos bancarios, de la familia ARKEN 360 (hermana de [ARKEN CONTROL](../README.md) y [ARKEN ANALYTICA](../analytica/README.md)). Sirve para estudiar a un cliente, saber a qué créditos y bancos puede aplicar, reunir y leer sus documentos y emitir un concepto de viabilidad por banco.

## Qué hace

- **Tipos de crédito según el cliente.** Cubre hipotecario de vivienda, leasing habitacional, crédito constructor, compra de lote, remodelación, compra de cartera, libre inversión con garantía hipotecaria, leasing inmobiliario y capital de trabajo. Según el tipo de cliente (asalariado, independiente, rentista, pensionado, colombiano en el exterior, empresa o constructora) muestra qué créditos aplican y qué documentos pide cada uno (módulo 06).
- **Documentos.** Lleva la lista de documentos del crédito, recibe PDF e imágenes, los guarda en el equipo y los lee. Los PDF se leen con pdf.js y las fotos o escaneos con OCR en español (Tesseract), sin internet. Lo leído se propone para la ficha del cliente con la evidencia, y la persona confirma qué pasa al perfil. El programa controla vigencias (por ejemplo, 30 días para certificados) y cruza datos entre documentos (módulo 03).
- **Bancos y opciones.** Para el cliente abierto muestra qué bancos le prestan, con qué monto, cuota, tasa y plazo. Tiene también la matriz de lo que ofrece cada banco y la edición de sus condiciones (módulo 04).
- **Análisis y concepto.** Por banco y producto da un dictamen (viable, viable con condiciones, viable con monto ajustado, información incompleta o no viable) con las condiciones evaluadas y un concepto escrito en PDF, numerado y guardado (módulo 05).
- **Filtros de la cartera.** Filtra por tipo de cliente, crédito, estado, dictamen, ingreso, monto, documentos y «viable en el banco X». Incluye una matriz clientes × bancos y exporta a CSV o PDF (módulo 01).
- **Simulador.** Calcula la tabla de amortización con los topes de la Ley 546 de 1999 (módulo 07).
- **Centro de ayuda.** Es el mismo módulo 16 de ARKEN CONTROL: guías por módulo, rutas de trabajo, preguntas frecuentes, glosario, buscador, manual en PDF e información del software.
- **Administración.** Incluye usuarios con roles, auditoría, respaldos, registro técnico y una demostración con 6 clientes ficticios.

> **Las condiciones de los bancos son valores de referencia.** Tasas, plazos, porcentajes de financiación y topes de cuota/ingreso vienen precargados para que el programa funcione desde el primer día. Antes de presentar un concepto, confírmelos con cada banco y ajústelos en *Bancos y opciones › Condiciones por banco*. El concepto lo recuerda.

## Abrirlo

1. Descargue [`programa/ARKEN_BANK.html`](programa/ARKEN_BANK.html). En GitHub, abra el archivo y pulse «Download raw file».
2. Ábralo con doble clic en Chrome o Edge. Funciona sin internet, porque las librerías de PDF, Excel, ZIP y OCR van dentro del archivo (unos 10,6 MB).
3. Primer ingreso: usuario `admin`, contraseña `arken`. El programa obliga a cambiarla.
4. Para ver el programa con datos, use *Administración › Demostración*. Los datos de la demostración son ficticios y se borran desde ahí mismo.

Los datos (clientes, documentos y conceptos) se guardan en ese navegador, en ese equipo, y no se sincronizan solos. Para llevarlos a otro equipo o guardarlos aparte use **Administración › Respaldos**.

El archivo del repositorio está siempre vacío de datos. **No suba al repositorio un HTML con datos, un respaldo, un concepto ni un documento de un cliente: el repositorio es público.** `npm run verificar-sin-datos` lo comprueba, y también corre en GitHub Actions.

## Para quien desarrolla

```
cd bank
npm ci --omit=optional
npm run construir      # arma programa/ARKEN_BANK.html desde fuente/
npm run prueba         # sin datos, programa al día, núcleo, lector y prueba de humo en Chromium
```

- `fuente/nucleo/` guarda el cálculo, sin interfaz: catálogo de créditos y documentos, bancos, lector de documentos, motor de viabilidad, coherencia y concepto. También corre en Node para las pruebas.
- `fuente/app/` guarda la interfaz, con las vistas por módulo y el centro de ayuda (`20-ayuda.js`).
- `herramientas/construir.mjs` une todo en un solo HTML, con las librerías incrustadas y una CSP que no deja salir nada a la red.
- Versiones fijas: jsPDF 2.5.1, jspdf-autotable 3.8.2, JSZip 3.10.1, pdf.js 3.11.174, Tesseract.js 5.1.1 y el modelo `spa` 4.0.0_best_int.
- El modelo del español se entrega al worker de Tesseract con `langPath: 'arken-ocr://spa'`, y un parche de `fetch` en el worker lo sirve desde un blob. Así se evita el error de Tesseract 5.1.1 con los idiomas pasados como objeto `{code, data}`.
- La compilación en GitHub Actions es `.github/workflows/compilar-bank.yml`. Corre las pruebas y deja el HTML en «Artifacts».
