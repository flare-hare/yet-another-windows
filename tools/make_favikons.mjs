/* =============================================================================
   Генератор favicon-набора. Два источника:
     • favicon.svg        — «чистый» без фона, адаптивный к теме (для вкладки браузера).
     • favicon-master.svg — с градиентным фоном (для apple-touch / maskable / png-fallback).
   Запуск: node tools/make_favicons.mjs
   Создаёт PNG-размеры, apple-touch-icon, maskable и favicon.ico.
   ============================================================================= */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'src', 'images', 'favicons');
const MASTER = path.join(DIR, 'favicon-master.svg'); // градиентный (фон)

// PNG-иконки для вкладки/раскладок. Делаем из ГРАДИЕНТНОГО мастера —
// так png-fallback (старые браузеры) остаётся видимым на любом фоне.
// Современные браузеры возьмут адаптивный favicon.svg из <head>.
const sizes = [16, 32, 48, 180, 192, 512];

// SVG для maskable (PWA): градиент на ВЕСЬ холст + окно по центру с safe-zone.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
     <defs>
       <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
         <stop offset="0" stop-color="#88bfbf"/>
         <stop offset="1" stop-color="#60a9a9"/>
       </linearGradient>
     </defs>
     <rect width="512" height="512" fill="url(#g)"/>
     <g fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round">
       <rect x="176" y="176" width="160" height="160" rx="16"/>
       <line x1="256" y1="176" x2="256" y2="336"/>
       <line x1="176" y1="256" x2="336" y2="256"/>
     </g>
   </svg>`;

async function run() {
  const master = fs.readFileSync(MASTER);

  for (const size of sizes) {
    const out = path.join(DIR, `favicon-${size}.png`);
    await sharp(master, { density: 384 }).resize(size, size).png().toFile(out);
    console.log('✓', path.basename(out));
  }

  // apple-touch-icon: градиентная иконка (iOS не любит прозрачность).
  await sharp(master, { density: 384 })
    .resize(180, 180)
    .png()
    .toFile(path.join(DIR, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // maskable (PWA): градиент на весь холст + окно с запасом по краям.
  await sharp(Buffer.from(MASKABLE_SVG), { density: 384 })
    .png()
    .toFile(path.join(DIR, 'maskable-512.png'));
  console.log('✓ maskable-512.png');

  // favicon.ico (многоразмерный 16/32/48). Пытаемся собрать через imagemagick.
  // Если его нет — не страшно: браузеры используют SVG/PNG-иконки из <head>.
  const ico = path.join(DIR, 'favicon.ico');
  const src16 = path.join(DIR, 'favicon-16.png');
  const src32 = path.join(DIR, 'favicon-32.png');
  const src48 = path.join(DIR, 'favicon-48.png');
  try {
    execFileSync('magick', [src16, src32, src48, ico], { stdio: 'ignore' });
    console.log('✓ favicon.ico');
  } catch {
    try {
      execFileSync('convert', [src16, src32, src48, ico], { stdio: 'ignore' });
      console.log('✓ favicon.ico');
    } catch {
      console.log(
        '\n⚠ favicon.ico не создан (нет imagemagick). Это НЕ критично —\n' +
          '  браузеры берут favicon.svg / favicon-32.png из <head>.\n' +
          '  Если ico нужен: sudo apt install imagemagick, затем запусти скрипт снова.'
      );
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
