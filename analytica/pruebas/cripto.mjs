// ARKEN ANALYTICA · pruebas de criptografía (§14 y §25).
//
//   · contraseñas con PBKDF2: la correcta entra, la equivocada no, y el hash coincide con Node
//   · llaves del proceso: se crean, la frase correcta las abre y la equivocada no
//   · firma ECDSA P-384: verifica, y un byte alterado en el texto o en la firma se detecta
//   · respaldo de llaves: no trae nada en claro que abra una oferta y se puede restaurar
//   · el ECDH de la llave de cifrado deriva el mismo secreto en los dos lados (base del sobre de la Fase 2)
//   · sobre cerrado: solo lo abre la llave del proceso; un byte cambiado en el contenido o en la llave envuelta se detecta
//   · requisitos de la frase y huellas SHA-256 frente a Node
//
// Para que corra rápido, las llaves de prueba usan 1.000 iteraciones; el programa usa 600.000
// (se comprueba que ese es el valor por defecto).
//
// Uso: npm run prueba:cripto

import { createHash, pbkdf2Sync, webcrypto } from 'node:crypto';
import { nucleo, marcador } from './comun.mjs';

const { Cripto } = nucleo();
const m = marcador('Criptografía de ARKEN ANALYTICA');
const subtle = webcrypto.subtle;

m.seccion('Huellas y contraseñas');
m.ok(await Cripto.sha256('ARKEN') === createHash('sha256').update('ARKEN').digest('hex'), 'SHA-256 igual al de Node');
const bin = new Uint8Array([0, 1, 2, 250, 255]);
m.ok(await Cripto.sha256(bin) === createHash('sha256').update(bin).digest('hex'), 'SHA-256 de bytes igual al de Node');
const h = await Cripto.hashContrasena('Clave segura 2026', undefined, 1000);
const esperado = pbkdf2Sync('Clave segura 2026', Buffer.from(h.sal, 'base64'), 1000, 32, 'sha256').toString('base64');
m.ok(h.hash === esperado, 'PBKDF2-SHA-256 igual al de Node');
m.ok(await Cripto.verificarContrasena('Clave segura 2026', h) && !(await Cripto.verificarContrasena('Clave segura 2027', h)), 'La contraseña correcta entra y la equivocada no');
m.ok((await Cripto.hashContrasena('x')).iter === 310000, 'Las contraseñas usan 310.000 iteraciones');
m.ok(Cripto.ITER_FRASE === 600000, 'La frase del proceso usa 600.000 iteraciones (§14)');

m.seccion('Frase del proceso');
m.ok(Cripto.fraseValida('corta') !== '' && Cripto.fraseValida('unasolapalabramuylarga') !== '', 'Rechaza frases cortas o de una sola palabra');
m.ok(Cripto.fraseValida('el comité abre las ofertas') === '', 'Acepta una frase de 16 caracteres y tres palabras');

m.seccion('Llaves del proceso');
const frase = 'el comité abre las ofertas';
const r = await Cripto.crearLlaves(frase, 'LIC-2026-014', 1000);
m.ok(r.formato === 'ARKEN-LLAVES' && r.publicaFirma.crv === 'P-384' && r.publicaCifrado.crv === 'P-384', 'Dos pares P-384: firma (ECDSA) y cifrado (ECDH)');
const enClaro = JSON.stringify(r);
m.ok(!/"d":/.test(enClaro), 'El registro guardado no trae ninguna llave privada en claro (sin el campo «d» de JWK)');
m.ok(r.privadasCifradas.alg === 'AES-GCM-256' && r.privadasCifradas.kdf === 'PBKDF2-SHA-256', 'Las privadas van cifradas con AES-GCM de 256 bits y PBKDF2-SHA-256');
m.ok(await Cripto.verificarFrase(r, frase), 'La frase correcta abre las llaves');
m.ok(!(await Cripto.verificarFrase(r, 'el comité abre las ofertaS')), 'Una frase con una letra distinta no las abre');
let error = '';
try { await Cripto.abrirLlaves(r, 'otra frase cualquiera aquí'); } catch (e) { error = e.message; }
m.ok(/frase del proceso no es correcta/.test(error), 'Abrir con la frase equivocada da un mensaje claro');
const alterado = JSON.parse(enClaro);
const datos = Buffer.from(alterado.privadasCifradas.datos, 'base64'); datos[10] ^= 1; alterado.privadasCifradas.datos = datos.toString('base64');
m.ok(!(await Cripto.verificarFrase(alterado, frase)), 'Un byte alterado en las privadas cifradas se detecta (AES-GCM autentica)');

m.seccion('Firma');
const llaves = await Cripto.abrirLlaves(r, frase);
const manifiesto = JSON.stringify({ proceso: 'LIC-2026-014', archivos: [{ ruta: 'pliego.pdf', sha256: 'a'.repeat(64) }] });
const firma = await Cripto.firmar(llaves.firma, manifiesto);
m.ok(await Cripto.verificar(r.publicaFirma, manifiesto, firma), 'La firma del manifiesto verifica con la llave pública');
m.ok(!(await Cripto.verificar(r.publicaFirma, manifiesto.replace('a', 'b'), firma)), 'Un byte alterado en el manifiesto se detecta');
const f2 = Buffer.from(firma, 'base64'); f2[5] ^= 1;
m.ok(!(await Cripto.verificar(r.publicaFirma, manifiesto, f2.toString('base64'))), 'Un byte alterado en la firma se detecta');
const otro = await Cripto.crearLlaves('otra frase del comité aquí', 'LIC-X', 1000);
m.ok(!(await Cripto.verificar(otro.publicaFirma, manifiesto, firma)), 'La llave pública de otro proceso no verifica la firma');

m.seccion('Cifrado ECDH (base del sobre cerrado)');
const efimera = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-384' }, true, ['deriveBits']);
const publicaProceso = await subtle.importKey('jwk', r.publicaCifrado, { name: 'ECDH', namedCurve: 'P-384' }, false, []);
const ladoOferta = Buffer.from(await subtle.deriveBits({ name: 'ECDH', public: publicaProceso }, efimera.privateKey, 384)).toString('hex');
const ladoPrincipal = Buffer.from(await subtle.deriveBits({ name: 'ECDH', public: efimera.publicKey }, llaves.cifrado, 384)).toString('hex');
m.ok(ladoOferta === ladoPrincipal, 'El secreto que deriva el proponente con la pública es el mismo que deriva el principal con la privada');

m.seccion('Sobre cerrado (§14)');
const contenido = new TextEncoder().encode(JSON.stringify({ formato: 'ARKEN-OFERTA', total: 123456789 }));
const sobre = await Cripto.cifrarSobre(r.publicaCifrado, contenido);
m.ok(!Buffer.from(sobre.cifrado).toString('latin1').includes('123456789') && sobre.envuelta.formato === 'ARKEN-LLAVE-ENVUELTA', 'El contenido cifrado no deja ver nada y la llave viaja envuelta (ECDH efímero + HKDF + AES-GCM)');
const abierto = await Cripto.abrirSobre(llaves.cifrado, sobre.envuelta, sobre.cifrado);
m.ok(Buffer.from(abierto).equals(Buffer.from(contenido)), 'La privada del proceso abre el sobre y devuelve el contenido exacto');
const ajenas = await Cripto.abrirLlaves(otro, 'otra frase del comité aquí');
let e3 = '';
try { await Cripto.abrirSobre(ajenas.cifrado, sobre.envuelta, sobre.cifrado); } catch (e) { e3 = e.message; }
m.ok(/no corresponde a este proceso/.test(e3), 'La llave de otro proceso no abre el sobre');
const cambiado = Uint8Array.from(sobre.cifrado); cambiado[3] ^= 1;
let e4 = '';
try { await Cripto.abrirSobre(llaves.cifrado, sobre.envuelta, cambiado); } catch (e) { e4 = e.message; }
m.ok(/fue alterado/.test(e4), 'Un byte cambiado en el contenido cifrado se detecta');
const env2 = JSON.parse(JSON.stringify(sobre.envuelta)); const ll2 = Buffer.from(env2.llave, 'base64'); ll2[0] ^= 1; env2.llave = ll2.toString('base64');
let e5 = '';
try { await Cripto.abrirSobre(llaves.cifrado, env2, sobre.cifrado); } catch (e) { e5 = e.message; }
m.ok(e5 !== '', 'Un byte cambiado en la llave envuelta se detecta');
const sobre2 = await Cripto.cifrarSobre(r.publicaCifrado, contenido);
m.ok(Buffer.from(sobre2.cifrado).toString('hex') !== Buffer.from(sobre.cifrado).toString('hex'), 'Dos sobres del mismo contenido no se parecen (llave e IV nuevos cada vez)');

m.seccion('Respaldo de llaves');
const texto = Cripto.respaldoLlaves(r);
m.ok(!/"d":/.test(texto) && /Si se pierden la llave y su respaldo/.test(texto), 'El respaldo no trae privadas en claro y advierte con todas sus letras');
const leido = Cripto.leerRespaldoLlaves(texto);
m.ok(await Cripto.verificarFrase(leido, frase), 'El respaldo leído se abre con la frase');
let e2 = '';
try { Cripto.leerRespaldoLlaves(JSON.stringify({ formato: 'OTRO' })); } catch (e) { e2 = e.message; }
m.ok(/no es un respaldo de llaves/.test(e2), 'Un archivo que no es ARKEN-LLAVES se rechaza');

m.terminar();
