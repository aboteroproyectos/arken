// ARKEN PAY · pruebas del almacén local (la carpeta de datos de la app de escritorio).
// Uso: node --test pruebas/almacen.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fsp = require('node:fs/promises');
const N = require('../nucleo/arken-pay-nucleo.js');
const { crearLocal } = require('../electron/almacen.cjs');

async function eventos(n) {
  const e = N.crearEstado();
  const out = [];
  for (let i = 0; i < n; i++) {
    const ev = i === 0 ? await N.sellarEvento(e, { tipo: 'sistema.iniciado', datos: { nombre: 'x' }, usuario: '' }) : await N.sellarEvento(e, { tipo: 'prueba', datos: { i }, usuario: '' });
    e.seq = ev.seq;
    e.ultimoHash = ev.hash;
    out.push(ev);
  }
  return out;
}

test('escrituras seguidas: ninguna choca con la copia diaria', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arken-pay-alm-'));
  try {
    const a = crearLocal({ carpeta: dir });
    const evs = await eventos(40);
    // Sin esperar entre una y otra, como al crear el administrador (varios eventos seguidos)
    const r = await Promise.all(evs.map((ev) => a.agregar(ev)));
    assert.ok(r.every((x) => x.ok));
    assert.equal(readFileSync(join(dir, 'eventos.jsonl'), 'utf8').trim().split('\n').length, 40);
    await a.leer(0); // espera que la cola termine (incluida la copia)
    const copias = readdirSync(join(dir, 'copias-diarias'));
    assert.equal(copias.length, 1);
    assert.ok(!copias[0].endsWith('.tmp'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('archivo ocupado por Windows (EBUSY) un momento: se reintenta y guarda', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arken-pay-alm-'));
  const original = fsp.open;
  let fallos = 3;
  fsp.open = async (...args) => {
    if (fallos-- > 0) throw Object.assign(new Error("EBUSY: resource busy or locked, open 'eventos.jsonl'"), { code: 'EBUSY' });
    return original(...args);
  };
  try {
    const a = crearLocal({ carpeta: dir });
    const [ev] = await eventos(1);
    assert.deepEqual(await a.agregar(ev), { ok: true, seq: 1 });
  } finally {
    fsp.open = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('archivo ocupado de forma permanente: mensaje claro, sin guardar a medias', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'arken-pay-alm-'));
  const original = fsp.open;
  fsp.open = async () => {
    throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  };
  try {
    const a = crearLocal({ carpeta: dir });
    const [ev] = await eventos(1);
    await assert.rejects(a.agregar(ev), /Windows tiene ocupado el archivo de datos/);
    fsp.open = original;
    assert.deepEqual(await a.agregar(ev), { ok: true, seq: 1 }, 'después se puede volver a intentar');
  } finally {
    fsp.open = original;
    rmSync(dir, { recursive: true, force: true });
  }
});
