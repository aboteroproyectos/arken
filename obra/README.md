# ARKEN OBRA

Un solo programa para Windows con las apps de la familia ARKEN 360:

| App | Para qué sirve |
|---|---|
| **ARKEN CONTROL** | Control de obra (módulos 00 a 16). |
| **ARKEN PRECIOS** | Observatorio de precios de insumos de obra en Colombia. |
| **ARKEN ANALYTICA** | Evaluación de propuestas y licitaciones, con ARKEN OFERTA. |
| **ARKEN BANK** | Análisis de créditos bancarios. Entra en cuanto ARKEN BANK esté en `main` (PR #18). Mientras tanto aparece como «Próximamente». |

Al abrir ARKEN OBRA aparece una pantalla de inicio con una tarjeta por app. Cada app se abre en su propia ventana, y se pueden tener varias abiertas a la vez. También se abren desde el menú «Aplicaciones» o con Ctrl+1, Ctrl+2, Ctrl+3 y Ctrl+4. Con Alt+Inicio se vuelve a la pantalla de inicio.

Los programas son los mismos de cada app. ARKEN OBRA no los cambia: cada versión nueva de CONTROL, PRECIOS, ANALYTICA o BANK que entra a `main` arma un instalador nuevo de ARKEN OBRA.

## Descargar e instalar

1. Abra la pestaña **Actions** y elija la última ejecución de «Compilar ARKEN OBRA» con marca verde.
2. Al final de la página, en **Artifacts**, descargue `ARKEN-OBRA-x.y.z-Windows.exe` (hay que haber iniciado sesión en GitHub).
3. Ejecútelo. La primera vez, SmartScreen avisa porque la app no está firmada: elija «Más información» y luego «Ejecutar de todas formas».

Para que el instalador quede en **Releases** y se pueda bajar sin iniciar sesión, cree una etiqueta `obra-vX.Y.Z` (por ejemplo `obra-v1.0.0`) y cambie también `"version"` en `obra/package.json`.

## Los datos

- Cada app guarda sus datos aparte, en el equipo, igual que su app propia. Todo funciona sin internet, salvo el motor de ARKEN PRECIOS, que lee las fuentes de precios.
- Carpeta de datos: `%APPDATA%\ARKEN OBRA`. Las copias diarias de cada app se abren desde **Ayuda** en el menú.
- **Si ya tenía instalada ARKEN CONTROL, ARKEN PRECIOS o ARKEN ANALYTICA en ese equipo**, la primera vez que abre esa app dentro de ARKEN OBRA se traen sus datos. Se copian: la app anterior queda igual, con sus datos. Si la app anterior está abierta, ARKEN OBRA pide cerrarla y reintentar.
- Después de comprobar que todo está en ARKEN OBRA, puede desinstalar las apps anteriores. Si sigue usando las dos, cada una guarda por su lado y los cambios no pasan de una a otra.
- La clave de API de ARKEN PRECIOS se trae en Windows. En macOS hay que volver a escribirla.

## Para quien desarrolla

```
# 1. Preparar cada app (su carpeta www/)
npm ci && npm run preparar
(cd analytica && npm ci && npm run preparar)
(cd precios && npm ci && npm run preparar)

# 2. ARKEN OBRA
cd obra
npm ci
npm run escritorio                 # abrirla sin empaquetar
npm run dist:windows               # instalador (en Windows)
npm run dist:linux && xvfb-run -a npm run prueba:escritorio   # prueba de la app empaquetada
```

- `herramientas/armar.mjs` copia a `obra/apps/` el `www/` de cada app, su puente con el computador (`electron/preload.cjs`) y, para PRECIOS, la bóveda, las copias y el motor. BANK entra si existe `bank/programa/ARKEN_BANK.html`, y se rechaza si trae datos.
- `electron/main.cjs` sirve cada app en su origen de siempre (`app://arken`, `app://precios`, `app://analytica`, `app://bank`), cada una en su propia sesión (`persist:<id>`), con sus permisos, su bloqueo de red y los mismos canales de su app propia. Así el programa no nota la diferencia, y los datos de la app anterior sirven tal cual.
- La compilación es `.github/workflows/compilar-obra.yml`.
