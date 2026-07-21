/* =============================================================================
   Генератор favicon-набора из мастер-SVG (src/images/favicons/favicon.svg).
   Использует sharp. Запуск:  node tools/make_favicons.mjs
   Создаёт PNG-размеры, apple-touch-icon, maskable и favicon.ico.
   ============================================================================= */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'src', 'images', 'favicons');
const SRC = path.join(DIR, 'favicon.svg');

const ACCENT = '#528d98'; // фон для maskable/apple (совпадает с брендом)

// Обычные PNG (прозрачный фон)
const sizes = [16, 32, 48, 180, 192, 512];

async function run() {
  const svg = fs.readFileSync(SRC);

  for (const size of sizes) {
    const out = path.join(DIR, `favicon-${size}.png`);
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
    console.log('✓', path.basename(out));
  }

  // apple-touch-icon: непрозрачный фон (iOS не любит прозрачность)
  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .flatten({ background: ACCENT })
    .png()
    .toFile(path.join(DIR, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // maskable (PWA): иконка с запасом по краям на акцентном фоне
  const inner = 512 - 2 * 80;
  const icon = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: ACCENT },
  })
    .composite([{ input: icon, gravity: 'center' }])
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
