'use strict';

const { src, dest, series, parallel, watch } = require('gulp');
const postcss = require('gulp-postcss');
const postcssImport = require('postcss-import');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const htmlmin = require('gulp-htmlmin');
const terser = require('gulp-terser');
const sharp = require('sharp');
const fsp = require('fs/promises');
const path = require('path');
const { Transform } = require('stream');
const plumber = require('gulp-plumber');
const del = require('del');
const browserSync = require('browser-sync').create();
const isDev = process.env.NODE_ENV !== 'production';
const paths = {
  html: {
    src: 'src/*.html',
    dest: 'dist/',
  },
  php: {
    src: 'src/*.php',
    dest: 'dist/',
  },
  root: {
    src: 'src/*.webmanifest',
    dest: 'dist/',
  },
  styles: {
    src: 'src/styles/main.css',
    watch: 'src/styles/**/*.css',
    dest: 'dist/styles/',
  },
  scripts: {
    src: 'src/scripts/**/*.js',
    dest: 'dist/scripts/',
  },
  images: {
    src: 'src/images/**/*.{png,jpg,jpeg,gif,svg,webp,ico}',
    dest: 'dist/images/',
  },
  fonts: {
    src: ['src/fonts/**/*', '!src/fonts/**/.gitkeep'],
    dest: 'dist/fonts/',
  },
  data: {
    src: ['src/data/**/*', '!src/data/**/.gitkeep'],
    dest: 'dist/data/',
  },
};

function clean() {
  return del(['dist']);
}

function styles() {
  const plugins = [postcssImport(), autoprefixer()];
  if (!isDev) {
    plugins.push(cssnano());
  }

  return src(paths.styles.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(postcss(plugins))
    .pipe(dest(paths.styles.dest))
    .pipe(browserSync.stream());
}

function html() {
  return src(paths.html.src)
    .pipe(plumber())
    .pipe(imgToPicture())
    .pipe(isDev ? through() : htmlmin({ collapseWhitespace: true, removeComments: true }))
    .pipe(dest(paths.html.dest));
}

// Копируем PHP-бэкенд как есть (без обработки) в корень сборки.
function php() {
  return src(paths.php.src, { allowEmpty: true }).pipe(dest(paths.php.dest));
}

// Корневые статичные файлы (site.webmanifest и т.п.)
function root() {
  return src(paths.root.src, { allowEmpty: true }).pipe(dest(paths.root.dest));
}

function imgToPicture() {
  return new Transform({
    objectMode: true,
    transform(file, _enc, cb) {
      if (!file.isBuffer()) {
        return cb(null, file);
      }

      let html = file.contents.toString();

      html = html.replace(/<img\b[^>]*>/gi, (imgTag) => {
        if (/\bdata-no-picture\b/i.test(imgTag)) {
          return imgTag.replace(/\s*data-no-picture(="[^"]*")?/i, '');
        }

        const srcMatch = imgTag.match(/\bsrc\s*=\s*"([^"]+)"/i);
        if (!srcMatch) {
          return imgTag;
        }
        const src = srcMatch[1];

        const extMatch = src.match(/\.(jpe?g|png)$/i);
        if (!extMatch) {
          return imgTag;
        }

        const base = src.slice(0, src.length - extMatch[0].length);
        const avif = `${base}.avif`;
        const webp = `${base}.webp`;

        return (
          '<picture>' +
          `<source srcset="${avif}" type="image/avif">` +
          `<source srcset="${webp}" type="image/webp">` +
          imgTag +
          '</picture>'
        );
      });

      file.contents = Buffer.from(html);
      cb(null, file);
    },
  });
}

function through() {
  return new Transform({
    objectMode: true,
    transform(file, _enc, cb) {
      cb(null, file);
    },
  });
}

function scripts() {
  return src(paths.scripts.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(isDev ? through() : terser())
    .pipe(dest(paths.scripts.dest));
}

const IMAGES_SRC_DIR = 'src/images';
const IMAGES_DEST_DIR = 'dist/images';

async function listFiles(dir) {
  const result = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFiles(full)));
    } else if (entry.name !== '.gitkeep') {
      result.push(full);
    }
  }
  return result;
}

async function images() {
  const files = await listFiles(IMAGES_SRC_DIR);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const relative = path.relative(IMAGES_SRC_DIR, file);
    const destPath = path.join(IMAGES_DEST_DIR, relative);
    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      await fsp.copyFile(file, destPath);
      continue;
    }

    const withoutExt = destPath.slice(0, -ext.length);
    const input = sharp(file);

    await Promise.all([
      input.clone()[ext === '.png' ? 'png' : 'jpeg']({ quality: 80 }).toFile(destPath),
      input.clone().webp({ quality: 80 }).toFile(`${withoutExt}.webp`),
      input.clone().avif({ quality: 60 }).toFile(`${withoutExt}.avif`),
    ]);
  }
}

function fonts() {
  return src(paths.fonts.src, { encoding: false, allowEmpty: true }).pipe(dest(paths.fonts.dest));
}

function data() {
  return src(paths.data.src, { allowEmpty: true })
    .pipe(plumber())
    .pipe(isDev ? through() : minifyJson())
    .pipe(dest(paths.data.dest));
}

function minifyJson() {
  return new Transform({
    objectMode: true,
    transform(file, _enc, cb) {
      if (file.isBuffer() && path.extname(file.path).toLowerCase() === '.json') {
        try {
          const parsed = JSON.parse(file.contents.toString());
          file.contents = Buffer.from(JSON.stringify(parsed));
        } catch {}
      }
      cb(null, file);
    },
  });
}

function server() {
  browserSync.init({
    server: {
      baseDir: 'dist',
    },
    notify: false,
    open: false,
  });

  watch(paths.styles.watch, styles);
  watch(paths.html.src, series(html, reload));
  watch(paths.php.src, series(php, reload));
  watch(paths.root.src, series(root, reload));
  watch(paths.scripts.src, series(scripts, reload));
  watch(paths.images.src, series(images, reload));
  watch(paths.data.src, series(data, reload));
}

function reload(done) {
  browserSync.reload();
  done();
}

const build = series(
  clean,
  parallel(styles, scripts, fonts, data, php, root, series(images, html))
);
const dev = series(build, server);

exports.clean = clean;
exports.styles = styles;
exports.html = html;
exports.php = php;
exports.root = root;
exports.scripts = scripts;
exports.images = images;
exports.fonts = fonts;
exports.data = data;
exports.build = build;
exports.dev = dev;
exports.default = dev;
