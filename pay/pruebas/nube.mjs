// ARKEN PAY · prueba del almacén en la nube contra un servidor simulado con las mismas reglas de
// Supabase: inicio de sesión, lectura paginada, la función arken_pay_agregar_evento (número
// siguiente y hash previo, si no ARKEN_PAY_CONFLICTO) y documentos verificados por hash.
// El simulador reordena las llaves de «datos» como hace jsonb, para comprobar que el hash no depende
// del orden. Dos «equipos» escriben a la vez y ninguno pierde ni duplica eventos.
// Uso: node --test pruebas/nube.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const N = require('../nucleo/arken-pay-nucleo.js');
const { crearNube } = require('../electron/almacen.cjs');

const dir = mkdtempSync(join(tmpdir(), 'arken-pay-nube-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', join(dir, 'k.pem'), '-out', join(dir, 'c.pem')], { stdio: 'ignore' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const filas = [];
const docs = new Map();
const reordenar = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().reverse().map((k) => [k, reordenar(o[k])])) : Array.isArray(o) ? o.map(reordenar) : o);
const servidor = createServer({ key: readFileSync(join(dir, 'k.pem')), cert: readFileSync(join(dir, 'c.pem')) }, async (req, res) => {
  let cuerpo = '';
  for await (const c of req) cuerpo += c;
  const json = (st, o) => res.writeHead(st, { 'content-type': 'application/json' }).end(JSON.stringify(o));
  const u = new URL(req.url, 'https://x');
  if (req.headers.apikey !== 'anon') return json(401, { message: 'sin apikey' });
  if (u.pathname === '/auth/v1/token') {
    const b = JSON.parse(cuerpo);
    if (u.searchParams.get('grant_type') === 'password' && b.password !== 'clave-nube') return json(400, { error_description: 'Invalid login credentials' });
    return json(200, { access_token: 'tok', refresh_token: 'ref', expires_in: 3600 });
  }
  if (req.headers.authorization !== 'Bearer tok') return json(401, { message: 'JWT' });
  if (u.pathname === '/rest/v1/arken_pay_eventos') {
    const gt = Number((u.searchParams.get('seq') || 'gt.0').slice(3));
    const lim = Number(u.searchParams.get('limit') || 1000);
    let out = filas.filter((f) => f.seq > gt);
    if (u.searchParams.get('order') === 'seq.desc') out = [...out].reverse();
    return json(200, out.slice(0, lim));
  }
  if (u.pathname === '/rest/v1/rpc/arken_pay_agregar_evento') {
    const p = JSON.parse(cuerpo);
    const ult = filas[filas.length - 1];
    if (p.p_seq !== filas.length + 1 || p.p_hash_previo !== (ult ? ult.hash : '')) return json(400, { code: '40001', message: `ARKEN_PAY_CONFLICTO: otro usuario registró algo primero (último ${filas.length}).` });
    filas.push({ seq: p.p_seq, id: p.p_id, tipo: p.p_tipo, fecha: p.p_fecha, usuario: p.p_usuario, datos: reordenar(p.p_datos), hash_previo: p.p_hash_previo, hash: p.p_hash });
    return json(200, p.p_seq);
  }
  if (u.pathname === '/rest/v1/arken_pay_documentos') {
    if (req.method === 'POST') {
      const b = JSON.parse(cuerpo);
      if (createHash('sha256').update(Buffer.from(b.contenido, 'base64')).digest('hex') !== b.hash) return json(400, { message: 'El documento no corresponde a su hash.' });
      if (docs.has(b.hash)) return json(409, { message: 'duplicate key value' });
      docs.set(b.hash, b.contenido);
      return res.writeHead(201).end();
    }
    const h = (u.searchParams.get('hash') || '').slice(3);
    return json(200, docs.has(h) ? [{ contenido: docs.get(h) }] : []);
  }
  json(404, { message: 'no' });
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const URL_NUBE = `https://localhost:${servidor.address().port}`;
const equipo = (n, clave = 'clave-nube') => crearNube({ url: URL_NUBE, claveAnonima: 'anon', correo: 'pay@arken.co', clave, carpeta: join(dir, 'equipo' + n) });

/** Lo que hace la interfaz: sincroniza, sella, valida y agrega; ante conflicto, reintenta. */
async function emitir(almacen, estado, tipo, datos, usuario) {
  for (let i = 0; i < 10; i++) {
    for (const ev of await almacen.leer(estado.seq)) N.aplicar(estado, ev);
    const ev = await N.sellarEvento(estado, { tipo, datos, usuario });
    N.probar(estado, ev);
    const r = await almacen.agregar(ev);
    if (r.conflicto) continue;
    N.aplicar(estado, ev);
    return ev;
  }
  throw new Error('demasiados conflictos');
}

test('credenciales inválidas se informan claro', async () => {
  await assert.rejects(equipo(9, 'mala').probar(), /correo o la contraseña/);
});

test('dos equipos escriben a la vez sin perder ni duplicar eventos', async () => {
  const a = equipo(1);
  const b = equipo(2);
  assert.deepEqual(await a.probar(), { ok: true, eventos: 0 });
  const ea = N.crearEstado();
  const eb = N.crearEstado();
  const admin = 'u_admin';
  await emitir(a, ea, 'sistema.iniciado', { nombre: 'ARKEN PAY' }, '');
  await emitir(a, ea, 'usuario.creado', { id: admin, usuario: 'adolfo', nombre: 'Adolfo', roles: ['administrador'], claveHash: await N.derivarClave('ArkenPay2026') }, '');
  // Cada equipo registra 5 clientes al mismo tiempo
  const nits = ['860034313', '900123456', '830077655', '800197268', '890903938', '860002964', '811036609', '900156264', '830025638', '860069804'];
  await Promise.all([
    (async () => {
      for (const n of nits.slice(0, 5)) await emitir(a, ea, 'cliente.registrado', { id: 'c' + n, tipoDocumento: 'NIT', documento: n, dv: N.digitoVerificacion(n), razonSocial: 'Cliente ' + n, plazoDias: 30 }, admin);
    })(),
    (async () => {
      for (const n of nits.slice(5)) await emitir(b, eb, 'cliente.registrado', { id: 'c' + n, tipoDocumento: 'NIT', documento: n, dv: N.digitoVerificacion(n), razonSocial: 'Cliente ' + n, plazoDias: 30 }, admin);
    })(),
  ]);
  assert.equal(filas.length, 12);
  const todos = await equipo(3).leer(0);
  assert.equal(todos.length, 12);
  const v = await N.verificarCadena(todos);
  assert.equal(v.ok, true, v.motivo);
  assert.equal(Object.keys(N.reconstruir(todos).clientes).length, 10);
  // El equipo A, al releer, ve lo de B
  for (const ev of await a.leer(ea.seq)) N.aplicar(ea, ev);
  assert.equal(ea.seq, 12);
});

test('documentos: se guardan por hash y se rechaza uno alterado', async () => {
  const a = equipo(1);
  const contenido = Buffer.from('<Invoice>FE1</Invoice>').toString('base64');
  const hash = createHash('sha256').update('<Invoice>FE1</Invoice>').digest('hex');
  await a.documentos.guardar(hash, contenido, 'FE1.xml');
  await a.documentos.guardar(hash, contenido, 'FE1.xml'); // repetido: no falla
  assert.equal(await equipo(4).documentos.leer(hash), contenido);
  await assert.rejects(a.documentos.guardar('0'.repeat(64), contenido, 'x'));
});

test.after(() => {
  servidor.close();
  rmSync(dir, { recursive: true, force: true });
});
