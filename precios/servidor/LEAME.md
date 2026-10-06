# Servidor de recolección de ARKEN PRECIOS (opcional)

Un equipo que queda encendido (un computador de la oficina o un servidor) lee las fuentes
certificadas a la hora programada y deja cada lectura en un **paquete de precios** con su hash.
El programa descarga los paquetes y vuelve a verificar cada precio con su propio núcleo, como si
los hubiera leído él: el servidor no escribe en la base de nadie y no ve precios, usuarios,
cotizaciones ni claves.

Usa el mismo motor que la app de escritorio (`precios/motor`): respeta el robots.txt de cada
sitio, se identifica con el agente `ARKEN-PRECIOS` y el correo de contacto, hace pausas por sitio,
guarda en caché lo que no cambió y nunca intenta pasar un CAPTCHA ni un inicio de sesión. Una
fuente que pide un CAPTCHA queda bloqueada en el servidor hasta que una persona la revise en el
programa y envíe el plan de nuevo.

No hace falta si la app de escritorio basta: ella lee las fuentes mientras está abierta y corre
las actualizaciones programadas que se perdieron al abrirla.

## Requisitos

- Node.js 22 o más reciente.
- Esta carpeta `precios/` del repositorio, con sus dependencias: `npm ci --omit=optional`.

## Arranque

1. Genere un token largo y guárdelo donde guarda las contraseñas de la empresa:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Arranque el servidor desde la carpeta `precios/`:

   ```
   ARKEN_PRECIOS_TOKEN=<el token> ARKEN_PRECIOS_PROGRAMACION="diaria 06:00" npm run servidor
   ```

| Variable | Para qué | Por defecto |
|---|---|---|
| `ARKEN_PRECIOS_TOKEN` | Obligatorio. El mismo que se escribe en el programa. Al menos 32 caracteres. | — |
| `ARKEN_PRECIOS_PUERTO` | Puerto. | `8787` |
| `ARKEN_PRECIOS_HOST` | Dirección en la que escucha. `127.0.0.1` es solo este equipo. | `127.0.0.1` |
| `ARKEN_PRECIOS_DATOS` | Carpeta del plan, los paquetes y la caché. | `~/.arken-precios/servidor` |
| `ARKEN_PRECIOS_CONTACTO` | Correo de contacto que ven los sitios. | el del plan del programa |
| `ARKEN_PRECIOS_PROGRAMACION` | `diaria 06:00`, `semanal lunes 06:00`, `mensual 5 06:00`, o vacío para leer solo cuando el programa lo pide. Hora de Colombia. | vacío |
| `ARKEN_PRECIOS_ORIGENES` | Páginas que pueden consultarlo desde el navegador, separadas por comas. `null` es el programa abierto como archivo. | `*` (el límite es el token) |

El token nunca va en un archivo del repositorio ni en la línea de órdenes que otros usuarios del
equipo puedan ver: use un archivo de entorno con permisos `600` (vea «Dejarlo corriendo»).

## En el programa

1. **Configuración › Motor y servidor**: el correo de contacto del motor, la dirección del
   servidor y el token. En la app de escritorio el token queda en la bóveda del sistema; en el
   navegador, cifrado con una llave que no sale de él. Nunca viaja en un respaldo.
2. **Actualizar precios › Programación**: «Probar la conexión» muestra la versión, el horario y
   el plan que tiene el servidor. «Enviar el plan al servidor» le entrega las fuentes certificadas,
   el catálogo (código, descripción, unidad y sinónimos) y los vínculos confirmados.
3. Cada lectura deja un paquete. «Descargar paquetes ahora» (o «Descargar al abrir») los importa:
   cada uno entra como una ejecución, con lo que leyó cada fuente, y el programa recalcula los
   insumos que trae. Un paquete alterado no entra (el hash no coincide) y un precio que no está
   escrito en el texto leído tampoco, aunque alguien rehaga el hash.

Desde una página web sin la app de escritorio, el programa también puede pedirle al servidor la
prueba técnica de una fuente y una lectura en el momento (Actualizar precios).

## Publicarlo para otros equipos

Por defecto solo responde en el mismo equipo. Para usarlo desde otros, póngalo detrás de un
proxy con https (el programa abierto con https no puede hablar con un servidor sin https), por
ejemplo con Caddy:

```
precios.suempresa.com {
  reverse_proxy 127.0.0.1:8787
}
```

No lo publique en internet con http simple: el token viajaría sin cifrar.

## Dejarlo corriendo (Linux con systemd)

`/etc/arken-precios.env` (permisos `600`, dueño el usuario del servicio):

```
ARKEN_PRECIOS_TOKEN=<el token>
ARKEN_PRECIOS_PROGRAMACION=diaria 06:00
ARKEN_PRECIOS_CONTACTO=compras@suempresa.com
```

`/etc/systemd/system/arken-precios.service`:

```
[Unit]
Description=ARKEN PRECIOS, servidor de recolección
After=network-online.target

[Service]
User=arken
WorkingDirectory=/opt/arken/precios
EnvironmentFile=/etc/arken-precios.env
ExecStart=/usr/bin/node servidor/iniciar.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Al detenerse (`systemctl stop`), cancela la lectura en curso y guarda su estado. Si el equipo
estuvo apagado a la hora programada, lee en la primera oportunidad, una sola vez.

## Lo que guarda

En la carpeta de datos: `plan.json` (el último plan que envió el programa, con la salud de cada
fuente después de cada lectura), `estado.json`, `paquetes/` (los últimos 30) y `cache/` (las
respuestas de los sitios, para no volver a pedir lo que no cambió).

## API

Todas las rutas piden `Authorization: Bearer <token>` y responden JSON.

| Ruta | Qué hace |
|---|---|
| `GET /salud` | Versión, horario y próxima lectura, plan guardado, último paquete y última lectura. |
| `POST /plan` | Guarda el plan de las lecturas programadas. |
| `POST /ejecutar` | Lee ahora con el plan que llega. Responde `202 { id }`. |
| `GET /ejecuciones/:id?desde=n` | Estado, eventos desde el número `n`, paquete o error. |
| `POST /ejecuciones/:id/cancelar` | Cancela la lectura. |
| `POST /probar` | Prueba técnica de una ficha: `{ fuente, contacto }` → `{ prueba }`. |
| `GET /paquetes?desde=<id>` | Los paquetes posteriores a `<id>`. |
| `GET /paquetes/ultimo` y `GET /paquetes/:id` | Un paquete, con su formato y su hash. |

Mientras lee, otra lectura o una prueba responden `409`: un sitio nunca se lee dos veces a la vez.
