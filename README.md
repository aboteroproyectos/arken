# ARKEN CONTROL

Sistema integral para el control de obra, empaquetado como app para **Android, iOS, Windows y macOS**.

Las cuatro apps usan el mismo programa: [`programa/ARKEN_CONTROL.html`](programa/ARKEN_CONTROL.html). Solo cambia lo que el programa hace distinto dentro de una app: guardado, descargas, impresión y enlaces. Todo funciona sin internet.

## Descargar las apps

Cada cambio en `main` compila las apps en GitHub Actions:

1. Abra la pestaña **Actions** y elija la última ejecución de «Compilar ARKEN CONTROL» con marca verde.
2. Al final de la página, en **Artifacts**, descargue la de su plataforma (hay que haber iniciado sesión en GitHub).

Cuando se publica una versión con etiqueta (por ejemplo `v1.0.0`), los instaladores también quedan en **Releases**, sin necesidad de iniciar sesión.

| Plataforma | Archivo | Cómo se instala |
|---|---|---|
| Android | `ARKEN-CONTROL-x.y.z-Android.apk` | Ábralo en el teléfono y permita «Instalar apps desconocidas» cuando lo pida. |
| Windows | `ARKEN-CONTROL-x.y.z-Windows.exe` | Ejecútelo. La primera vez, SmartScreen avisa porque la app no está firmada: «Más información» › «Ejecutar de todas formas». |
| macOS | `ARKEN-CONTROL-x.y.z-macOS.dmg` | Arrastre la app a Aplicaciones. La primera vez macOS la bloquea: autorícela en Configuración del Sistema › Privacidad y seguridad › «Abrir igualmente». Sirve para Mac con Apple Silicon e Intel. |
| iOS | `ARKEN-CONTROL-x.y.z-iOS-sin-firma.ipa` | Debe firmarse antes de instalarse. Vea [iPhone y iPad](#iphone-y-ipad). |

Las versiones nuevas se instalan encima de las anteriores y conservan los datos.

## Primer uso: cargar los datos de la empresa

La app arranca vacía, con datos de demostración y el usuario `admin` / `arken`, que obliga a cambiar la contraseña.

Para cargar la información real, use **Restaurar respaldo** en la pantalla de ingreso o **Administración › Datos › Importar respaldo**. Sirven dos tipos de archivo:

- un respaldo `.json` exportado desde ARKEN CONTROL;
- el `ARKEN_CONTROL.html` que usa hoy, con los datos embebidos.

En el celular, pase primero el archivo al teléfono (por ejemplo, por Google Drive, WhatsApp o correo) y luego elíjalo al restaurar.

## Cómo se guardan los datos

- Cada cambio se guarda solo, en el equipo. El botón de la barra superior («Guardar copia») ya no es necesario para guardar: crea un `ARKEN_CONTROL.html` con todos los datos, que se abre en cualquier navegador o se restaura en otro equipo.
- La app guarda además una **copia interna** en un archivo del equipo. Si el sistema llegara a borrar el almacenamiento interno de la app, al abrirla se recupera desde esa copia.
- En Windows y macOS queda también una **copia por día de los últimos 10 días**. Se abren desde **Ayuda › Abrir la carpeta de copias diarias** o desde **Administración › Datos**.
- **Cada equipo guarda sus propios datos: no se sincronizan solos.** Para pasar la información de un equipo a otro, exporte un respaldo y restáurelo en el otro equipo.

## Diferencias con el navegador

| En el navegador | En la app |
|---|---|
| Descargar un PDF, Excel o respaldo | **Celular:** los PDF y las imágenes se abren en un visor con «Compartir»; los demás archivos van al menú Compartir (Drive, WhatsApp, correo, Archivos). **Computador:** se guardan donde usted elija. |
| Imprimir | **Celular:** se muestra el PDF del documento; se imprime desde Compartir (en iPhone y iPad, «Imprimir»). **Computador:** el cuadro de impresión de siempre. |
| Vistas previas en ventana nueva | **Celular:** se muestran dentro de la app. **Computador:** en una ventana aparte. |
| Correo y WhatsApp | Se abren en la app de correo y en WhatsApp. |
| «Enlazar el archivo» para guardar sobre el HTML | No hace falta: la app guarda sola. |

La barra de totales se reacomoda en pantallas angostas, porque en el HTML quedaba escondida bajo la barra superior.

## Actualizar el programa

1. Reemplace `programa/ARKEN_CONTROL.html` por la versión nueva **sin datos**: el contenido de `<script id="arken-datos" type="application/json">` debe ser `null`.
2. Súbalo a `main`. GitHub Actions compila y prueba las cuatro apps.

> **Importante: este repositorio es público.** Nunca suba un `ARKEN_CONTROL.html` que tenga datos de la empresa. La compilación falla si lo detecta, pero para entonces el archivo ya quedó publicado. Si la versión nueva la genera Claude, pídale que le quite los datos antes de subirla.

Para publicar una versión con instaladores descargables sin iniciar sesión, cree una etiqueta `vX.Y.Z` (por ejemplo `v1.0.1`). Cambie también `"version"` en `package.json`.

## Firma de Android

El APK se firma siempre con la misma clave. Si la firma cambiara, Android obligaría a desinstalar la app, y con ella se borrarían los datos del teléfono.

- La clave está cifrada en [`android/firma/arken.jks.enc`](android/firma/arken.jks.enc).
- Su contraseña va en el secreto **`ARKEN_FIRMA_CLAVE`**: *Settings › Secrets and variables › Actions › New repository secret*. Sin ese secreto, Android se compila para verificarlo, pero no se entrega el APK.
- Guarde esa contraseña también en un lugar seguro, fuera de GitHub. GitHub no deja volver a leer un secreto.

## iPhone y iPad

Apple no permite instalar apps sin firma. Hay tres caminos:

- **Cuenta de Apple Developer** (de pago, anual): permite instalar por TestFlight o publicar en el App Store. Con la cuenta se agrega la firma a la compilación.
- **Un Mac con Xcode:** abra `ios/App/App.xcodeproj`, elija su equipo en «Signing & Capabilities» e instale la app en su propio iPhone. Con un Apple ID gratuito la instalación deja de abrir a los 7 días.
- **El `.ipa` sin firma** que genera la compilación puede firmarse con herramientas de terceros y un Apple ID. Tiene el mismo límite de 7 días.

## Logo

El logo que trae el programa mide 160 × 160 px y los íconos se generan ampliándolo. Para íconos nítidos, guarde el logo en alta resolución (1024 px o más, fondo transparente) como `recursos/logo-original.png` y ejecute `npm run iconos`.

## Estructura

```
programa/ARKEN_CONTROL.html   El programa, sin datos
app/                          Capa de la app: guardado, descargas, visor, impresión, enlaces
herramientas/                 Genera www/ (lo que empaquetan las apps), verifica que no haya datos, íconos
electron/                     App de Windows y macOS
android/  ios/                Proyectos nativos (Capacitor)
recursos/                     Logo, íconos y pantallas de inicio
pruebas/                      Pruebas automáticas (Chromium y app de escritorio)
.github/workflows/            Compilación de las cuatro apps
```

## Para desarrollar

Requisitos: Node.js 22. Para Android se necesita Android Studio, y para iOS, un Mac con Xcode.

```bash
npm ci
npm run preparar           # genera www/ desde programa/ARKEN_CONTROL.html
npm run prueba             # prueba de humo en Chromium
npm run escritorio         # abre la app de escritorio
npm run android            # prepara el proyecto de Android (luego: npx cap open android)
npm run ios                # prepara el proyecto de iOS (luego: npx cap open ios)
npm run dist:windows       # instalador de Windows (en Windows)
npm run dist:mac           # instalador de macOS (en un Mac)
```
