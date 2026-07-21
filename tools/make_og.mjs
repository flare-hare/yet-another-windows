/* Генератор OG-превью (1200×630) из SVG. Запуск: node tools/make_og.mjs */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'images', 'og-image.png');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#77abb6"/>
      <stop offset="1" stop-color="#528d98"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" transform="translate(150,215)">
    <rect x="0" y="0" width="200" height="200" rx="16"/>
    <line x1="100" y1="0" x2="100" y2="200"/>
    <line x1="0" y1="100" x2="200" y2="100"/>
  </g>
  <text x="430" y="300" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="800" fill="#ffffff">Оконика</text>
  <text x="432" y="370" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#eaf6f8">Конструктор пластиковых окон</text>
  <text x="432" y="420" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#eaf6f8">Соберите окно и узнайте цену сразу</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log('✓ og-image.png (1200×630)');
