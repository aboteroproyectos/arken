# ARKEN PAY · decisiones

Cada decisión con su porqué. Las normas citadas son las vigentes al 13 de noviembre de 2026; el contador debe revisar cada año los parámetros (UVT, tarifas y bases), que están en **Configuración** y no en el código.

## 1. Alcance: registrar, no emitir

ARKEN PAY no transmite a la DIAN. La factura electrónica la expide el proveedor tecnológico (Res. DIAN 000165 de 2023, Anexo técnico 1.9). Duplicar esa función obligaría a habilitarse como facturador o proveedor ante la DIAN, y el riesgo de emitir dos veces la misma venta sería alto. ARKEN PAY toma lo que el proveedor ya emitió: el XML (AttachedDocument, que trae la factura y la respuesta de validación de la DIAN) o los datos a mano.

## 2. Nada se borra: bitácora de eventos encadenada

Todo cambio es un evento (`factura.registrada`, `recaudo.registrado`, `nota.registrada`…) que se agrega al final de una bitácora; el estado se reconstruye aplicando los eventos en orden. Cada evento lleva el hash SHA-256 del anterior, así que alterar o quitar uno rompe la cadena y se detecta (Bitácora › Verificar integridad).

- Es lo que exige la contabilidad: los documentos soporte se conservan (art. 46 Ley 962 de 2005; art. 632 E.T.), una factura solo se corrige con nota crédito o débito referida a su CUFE, y los registros no se tachan ni se borran.
- Da auditoría completa: quién hizo qué y cuándo.
- En la nube, la tabla tiene disparadores que impiden `UPDATE`, `DELETE` y `TRUNCATE`, y solo se escribe con la función `arken_pay_agregar_evento`.

## 3. Varios usuarios sin perder registros

Dos personas pueden registrar al mismo tiempo. La función de la base toma un candado, comprueba que el evento sea el número siguiente y que enlace con el hash del último; si otro escribió primero, responde `ARKEN_PAY_CONFLICTO` y la app relee y reintenta, validando otra vez las reglas sobre el estado actualizado. Así no se puede, por ejemplo, aplicar dos pagos que juntos superen el saldo de una factura.

La conexión a la nube es una sola cuenta de Supabase por empresa; los usuarios, roles y contraseñas de ARKEN PAY viven en la propia bitácora (PBKDF2-SHA256, 210.000 iteraciones). **Límite conocido de la fase 1:** las reglas de negocio se validan en la app. Alguien con la contraseña de la conexión y conocimientos técnicos podría escribir eventos directamente; quedarían en la bitácora a su nombre, pero no serían rechazados por la base. La fase 2 puede mover la validación a una función del servidor (Supabase Edge Function) que ejecute el mismo núcleo.

## 4. Dinero en centavos enteros

Todos los valores se guardan como enteros en centavos y las tarifas en partes por millón; los redondeos usan aritmética entera (mitad hacia arriba). Las retenciones se redondean al peso, como en los formularios de la DIAN. Ningún cálculo usa decimales de punto flotante.

## 5. Impuestos y retenciones

| Concepto | Regla | Fuente |
|---|---|---|
| IVA | Por ítem: 19 %, 5 %, exento o excluido. En contratos de construcción con AIU, la base del IVA es la utilidad (Decreto 1372 de 1992, art. 3, compilado en el DUR 1625 de 2016); se digita en «Base IVA» del ítem. | E.T. arts. 420, 468, 468-1 |
| Retención en la fuente | Según el concepto del proyecto o de la empresa, si el cliente es agente de retención y la base supera el mínimo en UVT. Servicios en general 4 % (declarante) y 6 % (no declarante) con base de 2 UVT; compras y construcción con base de 10 UVT. | Decreto 572 de 2025; DUR 1625 de 2016 |
| ReteIVA | 15 % del IVA, si el cliente es agente retenedor de IVA. | E.T. art. 437-1 |
| ReteICA | Tarifa de la actividad (CIIU) en el municipio, en por mil, si el cliente es agente retenedor de ICA. Bogotá: Acuerdo 65 de 2002 y siguientes. | Acuerdos municipales |
| UVT | 2025: $49.799 (Res. DIAN 000193 de 2024). 2026: $52.374 (Res. DIAN 000238 de 2025). | E.T. art. 868 |

Las retenciones que se calculan al registrar la factura son **esperadas**; las que cuentan son las que el cliente realmente practica, registradas con el pago. Cada retención queda pendiente hasta recibir su certificado, porque sin él no se puede descontar en la declaración (art. 381 E.T.).

## 6. Saldos y estados

Saldo = total + notas débito − notas crédito − pagos − retenciones − anticipos aplicados. La **retención de garantía** de un proyecto se descuenta del saldo exigible y se cuenta en cartera desde su fecha de liberación; una factura cuyo saldo es solo la garantía aparece como «Solo garantía pendiente». Una nota crédito con concepto 2 anula la factura. Los eventos RADIAN (030 acuse, 031 reclamo, 032 recibo, 033 aceptación expresa, 034 aceptación tácita) se registran porque la aceptación convierte la factura en título valor (Ley 1231 de 2008; Decreto 1154 de 2020).

## 7. Control interno

- Roles separados: quien registra facturas no registra pagos, y el administrador no registra ninguno de los dos.
- Doble control: quien registró una factura o un pago no puede aprobar su reclasificación o reversión.
- Períodos cerrados: con un mes cerrado no se registran ni reversan movimientos con fecha de ese mes.
- Control de numeración: compara lo registrado con el rango de cada resolución y muestra los números que faltan.

## 8. Recuperación de la contraseña

El administrador recibe un código de recuperación de unos 124 bits al crear la instalación; la bitácora guarda solo su huella PBKDF2. Con él restablece su contraseña (evento `usuario.clave_recuperada`), y el código se reemplaza por uno nuevo en el mismo evento. Como en el resto de la fase 1, el programa verifica el código antes de escribir (ver §3). En «Solo este equipo» se puede además archivar la bitácora y empezar de cero: es equivalente a renombrar el archivo a mano, así que no abre un acceso nuevo, y no se pierde nada.

## 9. Datos personales

Los contactos de los clientes son datos personales (Ley 1581 de 2012). La ficha del cliente tiene la casilla de autorización; la base en la nube solo la leen los usuarios autenticados del proyecto y el registro público de cuentas queda desactivado (paso 3 de la guía).

## 10. Tecnología

La misma de ARKEN PRECIOS: Electron, con la interfaz aislada (`contextIsolation`, `sandbox`, sin Node en la página, política de seguridad de contenido) y un puente mínimo (`window.arkenPay`). La contraseña de la conexión se cifra con el sistema operativo (`safeStorage`, DPAPI en Windows). El núcleo no tiene dependencias y se prueba solo, en la interfaz y en la app de escritorio.
