# ARKEN PAY

Control de la facturación electrónica que la empresa emite, de su recaudo y de la cartera, por cliente y por proyecto. App de la familia [ARKEN](../README.md).

ARKEN PAY **no emite facturas ni las envía a la DIAN**: eso lo hace el proveedor tecnológico. Aquí se **registran** las facturas ya emitidas (leyendo su XML o digitándolas) y se lleva todo lo que pasa después: notas crédito y débito, eventos RADIAN, pagos y abonos, retenciones practicadas por el cliente y sus certificados, anticipos, garantías, conciliación con el banco y cartera por edades.

**Estado:** Fase 1. Las decisiones de diseño, con su fundamento legal y técnico, están en [DECISIONES.md](DECISIONES.md).

## Qué hace

| Pantalla | Para qué |
|---|---|
| Tablero | Facturado y recaudado del mes, cartera total y vencida, días promedio de cobro, vencimientos de los próximos 15 días, alertas de numeración y del plazo de 60 días de la Ley 2024 de 2020. |
| Facturas | Registro desde el XML de la DIAN (AttachedDocument, Invoice, CreditNote, DebitNote) o a mano; cada factura pertenece a un proyecto. Detalle con ítems, movimientos, soportes, eventos RADIAN y reclasificaciones. |
| Recaudos | Pagos con su cuenta y referencia, aplicados a una o varias facturas (sugiere las más antiguas primero), con la retención en la fuente, ReteIVA y ReteICA que descontó el cliente. Excedentes como anticipo del proyecto o saldo a favor. Reversión con doble control. |
| Cartera | Edades al corte (por vencer, 1–30, 31–60, 61–90, 91–180, 181–360, más de 360 días) por cliente y proyecto, y estado de cuenta del cliente. |
| Proyectos | Contratado, facturado, recaudado, retenido, por cobrar, garantía retenida, anticipo sin amortizar y por facturar. |
| Clientes | Datos tributarios (NIT con su dígito de verificación, si retiene renta, IVA o ICA, gran empresa) y plazo de pago. |
| Retenciones | Lo retenido por año y tipo, y las retenciones que aún no tienen certificado. |
| Conciliación | Importa el extracto bancario en CSV y cruza cada recaudo con su crédito en el banco. |
| Reportes | Libro de facturación, recaudos y resumen por proyecto en CSV para Excel; control de numeración con los números faltantes. |
| Bitácora | Todo lo que ha pasado, quién y cuándo, encadenado con SHA-256; verificación de integridad con un clic. |
| Configuración | Empresas emisoras, resoluciones de numeración, UVT, conceptos y tarifas de retención, períodos cerrados, usuarios y roles. |

Nada se borra ni se edita: una factura se corrige con una nota crédito o débito (como exige la DIAN), un pago con una reversión, y todo queda en la bitácora.

## Instalarlo (Windows)

1. En GitHub, pestaña **Actions**, abra la última ejecución de «Compilar ARKEN PAY» con marca verde.
2. Al final, en **Artifacts**, descargue `ARKEN-PAY-x.y.z-Windows.exe` (hay que haber iniciado sesión en GitHub).
3. Ejecútelo. La primera vez, SmartScreen avisa porque la app no está firmada: «Más información» › «Ejecutar de todas formas».

Las versiones nuevas se instalan encima y conservan los datos. Con una etiqueta `pay-vX.Y.Z` el instalador también queda en **Releases**.

## Base de datos en la nube (varios usuarios)

Para que varias personas trabajen sobre la misma información, los datos van en un proyecto de [Supabase](https://supabase.com) (PostgreSQL). Se configura una sola vez:

1. Cree una cuenta en supabase.com y un proyecto nuevo (región **São Paulo**, la más cercana a Colombia). Guarde la contraseña de la base de datos en un lugar seguro.
2. En el proyecto, abra **SQL Editor**, pegue todo el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y pulse **Run**. Crea las tablas, la función de escritura y la seguridad. Se puede volver a ejecutar sin perder datos.
3. **Authentication › Sign In / Providers**: desactive **Allow new users to sign up**. Así nadie más puede crear cuentas en su proyecto.
4. **Authentication › Users › Add user › Create new user**: cree el usuario de la conexión (por ejemplo `pay@suempresa.com`) con una contraseña larga, y marque **Auto Confirm User**.
5. **Project Settings › API** (o **Data API**): copie la **Project URL** (`https://xxxx.supabase.co`) y la clave **anon public**.
6. En cada computador, al abrir ARKEN PAY por primera vez, elija **Base de datos en la nube** y escriba esos cuatro datos (dirección, clave anon, correo y contraseña de la conexión). La contraseña queda cifrada por Windows en ese equipo.

Luego el primer usuario crea al **administrador** de ARKEN PAY, y el administrador crea a los demás con sus roles. Cada persona entra con su propio usuario y contraseña de ARKEN PAY; la conexión a la nube es la misma para todos los equipos de la empresa.

Si el computador pierde internet, ARKEN PAY muestra los datos guardados en ese equipo y no deja registrar nada hasta reconectar.

**Copias:** el plan gratuito de Supabase no guarda copias automáticas. Cada equipo conserva una copia local de toda la bitácora (Configuración › Conexión › «Abrir carpeta de copias»), y desde **Database › Backups** de Supabase se puede activar la copia diaria en un plan pago.

**Solo este equipo:** para probar, se puede elegir «Solo este equipo». Los datos quedan en `%APPDATA%\ARKEN PAY\datos\eventos.jsonl`, con una copia diaria (las últimas 10).

## Roles

| Rol | Puede |
|---|---|
| Administrador | Configurar empresas, resoluciones, parámetros y usuarios. No registra facturas ni pagos. |
| Facturación | Registrar facturas, notas, clientes, proyectos y eventos RADIAN. |
| Tesorería | Registrar recaudos, aplicar anticipos, certificados de retención y conciliar con el banco. |
| Aprobador | Reversar recaudos, reclasificar facturas de proyecto, cerrar y reabrir períodos, ajustar parámetros. Quien registró algo no puede aprobar su propia reversión o reclasificación. |
| Consulta | Ver todo y exportar. |

## Para desarrollar

```bash
cd pay
npm ci
npm run prueba               # núcleo, nube simulada e interfaz en Chromium
xvfb-run -a npm run prueba:escritorio   # app de Electron (en Windows o macOS, sin xvfb-run)
npm run escritorio           # abre la app
npm run dist:windows         # instalador .exe (en Windows)
```

| Carpeta | Contenido |
|---|---|
| `nucleo/` | Reglas de negocio y cálculos (`arken-pay-nucleo.js`) y lectura del XML DIAN (`arken-pay-xml.js`). Sin dependencias; los usa la interfaz y las pruebas. |
| `programa/` | La interfaz: `index.html`, `app.css`, `app.js`. |
| `electron/` | La app de escritorio y el almacén de la bitácora, local o en Supabase. |
| `supabase/` | El esquema de la base de datos en la nube. |
| `pruebas/` | Pruebas automáticas. |
