#!/usr/bin/env node
// ARKEN PRECIOS · servidor de recolección: arranque desde la línea de comandos.
//
//   ARKEN_PRECIOS_TOKEN=<token largo> ARKEN_PRECIOS_PROGRAMACION="diaria 06:00" node servidor/iniciar.mjs
//
// Variables de entorno (las claves nunca van en archivos del repositorio):
//   ARKEN_PRECIOS_TOKEN         obligatorio: el mismo que se escribe en Configuración › Motor y servidor
//                               (al menos 32 caracteres; por ejemplo, la salida de
//                               node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
//   ARKEN_PRECIOS_PUERTO        8787
//   ARKEN_PRECIOS_HOST          127.0.0.1 (solo este equipo). Para otros equipos, detrás de un proxy con https.
//   ARKEN_PRECIOS_DATOS         carpeta del plan, los paquetes y la caché (por defecto ~/.arken-precios/servidor)
//   ARKEN_PRECIOS_CONTACTO      correo de contacto que ven los sitios (por defecto, el del plan del programa)
//   ARKEN_PRECIOS_PROGRAMACION  «diaria 06:00», «semanal lunes 06:00», «mensual 5 06:00» o vacío (hora de Colombia)
//   ARKEN_PRECIOS_ORIGENES      páginas que pueden consultarlo desde el navegador, separadas por comas
//                               (por defecto «*»: el límite es el token). «null» es el programa abierto como archivo.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { crearServidor, NOMBRE, VERSION, LARGO_MINIMO_TOKEN } from './servidor.mjs';

const env = process.env;
const args = process.argv.slice(2);
if (args.includes('--ayuda') || args.includes('-h') || args.includes('--help')) {
  console.log(NOMBRE + ' ' + VERSION + '\n\nVariables de entorno: ARKEN_PRECIOS_TOKEN (obligatorio), ARKEN_PRECIOS_PUERTO, ARKEN_PRECIOS_HOST,\n' +
    'ARKEN_PRECIOS_DATOS, ARKEN_PRECIOS_CONTACTO, ARKEN_PRECIOS_PROGRAMACION y ARKEN_PRECIOS_ORIGENES.\nVea servidor/LEAME.md.');
  process.exit(0);
}
if (args.includes('--version')) {
  console.log(VERSION);
  process.exit(0);
}

const token = String(env.ARKEN_PRECIOS_TOKEN || '');
if (token.length < LARGO_MINIMO_TOKEN) {
  console.error('Falta ARKEN_PRECIOS_TOKEN (al menos ' + LARGO_MINIMO_TOKEN + ' caracteres). Genere uno con:\n' +
    '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"');
  process.exit(1);
}

let servidor;
try {
  servidor = await crearServidor({
    token,
    datos: env.ARKEN_PRECIOS_DATOS || join(homedir(), '.arken-precios', 'servidor'),
    contacto: env.ARKEN_PRECIOS_CONTACTO || '',
    programacion: env.ARKEN_PRECIOS_PROGRAMACION || '',
    origenes: env.ARKEN_PRECIOS_ORIGENES || '*',
    registro: console,
  });
} catch (e) {
  console.error('No se pudo iniciar el servidor: ' + e.message);
  process.exit(1);
}
const puerto = env.ARKEN_PRECIOS_PUERTO ? Number(env.ARKEN_PRECIOS_PUERTO) : 8787;
if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) {
  console.error('ARKEN_PRECIOS_PUERTO no es un puerto válido: ' + env.ARKEN_PRECIOS_PUERTO);
  process.exit(1);
}
const host = env.ARKEN_PRECIOS_HOST || '127.0.0.1';
const { url } = await servidor.escuchar(puerto, host);
const pr = servidor.programacion();
console.log(NOMBRE + ' ' + VERSION + ' en ' + url);
console.log(pr.activa ? 'Programación: ' + pr.descripcion + '; la próxima, ' + pr.siguiente + '.' : 'Sin programación: lee solo cuando el programa lo pide.');

let cerrando = false;
async function cerrar(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log('Cerrando (' + senal + '): se cancela la lectura en curso, si hay una.');
  await servidor.cerrar();
  process.exit(0);
}
process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
