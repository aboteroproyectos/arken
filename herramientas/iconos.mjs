// ARKEN CONTROL · íconos y pantallas de inicio a partir de recursos/logo-original.png.
//
// El logo tiene las líneas blancas transparentes: el programa lo muestra siempre sobre un
// fondo gris claro (#E9EAEA, igual que en la barra superior), y así se usa aquí.
//
// Genera en recursos/:
//   icon-only.png, icon-foreground.png, icon-background.png   íconos de Android e iOS
//   splash.png, splash-dark.png                                pantalla de inicio (color de la app)
//   icono.png                                                  ícono de Windows y macOS
//
// El logo que trae el programa mide 160×160 px y aquí se amplía. Si tiene el logo en alta
// resolución (1024 px o más, fondo transparente), guárdelo como recursos/logo-original.png y
// ejecute:  npm run iconos

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RECURSOS = join(RAIZ, 'recursos');
const ORIGINAL = join(RECURSOS, 'logo-original.png');
const CLARO = '#E9EAEA';
const OSCURO = '#16181A';
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

async function logo(lado) {
  const { width } = await sharp(ORIGINAL).metadata();
  let img = sharp(ORIGINAL).resize(lado, lado, { kernel: 'lanczos3', fit: 'contain', background: TRANSPARENTE });
  if (width < lado) img = img.median(3).sharpen({ sigma: 0.8 }); // suaviza el ruido de la ampliación
  return img.png().toBuffer();
}

async function sobre(lado, fondoSvg, proporcion) {
  const tam = Math.round(lado * proporcion);
  const pos = Math.round((lado - tam) / 2);
  return sharp(Buffer.from(fondoSvg))
    .composite([{ input: await logo(tam), left: pos, top: pos }])
    .png()
    .toBuffer();
}

const cuadrado = (lado, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
const vacio = (lado) => `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"></svg>`;

// Android e iOS
await sharp(await sobre(1024, cuadrado(1024, CLARO), 0.8)).toFile(join(RECURSOS, 'icon-only.png'));
await sharp(await sobre(1024, vacio(1024), 0.56)).toFile(join(RECURSOS, 'icon-foreground.png'));
await sharp(Buffer.from(cuadrado(1024, CLARO))).png().toFile(join(RECURSOS, 'icon-background.png'));
await sharp(Buffer.from(cuadrado(2732, OSCURO))).png().toFile(join(RECURSOS, 'splash.png'));
await sharp(Buffer.from(cuadrado(2732, OSCURO))).png().toFile(join(RECURSOS, 'splash-dark.png'));

// Windows y macOS: cuadrado redondeado de 824 px (retícula de macOS) con el logo al 80 %
const redondeado =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">' +
  `<rect x="100" y="100" width="824" height="824" rx="185" ry="185" fill="${CLARO}"/></svg>`;
const escritorio = await sharp(Buffer.from(redondeado))
  .composite([{ input: await logo(Math.round(824 * 0.8)), left: Math.round((1024 - 824 * 0.8) / 2), top: Math.round((1024 - 824 * 0.8) / 2) }])
  .png()
  .toBuffer();
await sharp(escritorio).toFile(join(RECURSOS, 'icono.png'));
console.log('✔ Imágenes de recursos/ listas.');

// Íconos y pantallas de inicio nativos (Android e iOS)
if (!process.argv.includes('--sin-nativos')) {
  execFileSync(
    'npx',
    ['capacitor-assets', 'generate', '--android', '--ios', '--assetPath', 'recursos',
      '--iconBackgroundColor', CLARO, '--iconBackgroundColorDark', CLARO,
      '--splashBackgroundColor', OSCURO, '--splashBackgroundColorDark', OSCURO],
    { cwd: RAIZ, stdio: 'inherit' },
  );
}
