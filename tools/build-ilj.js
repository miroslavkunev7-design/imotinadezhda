#!/usr/bin/env node
/* Сглобява публичния сайт (mobile/ilj.html) за бързо зареждане.
   Източник: mobile/ilj-app.jsx (React/JSX).  Изход: mobile/ilj-app.js (готов, минифициран JS)
   и mobile/ilj-tw.css (статичен Tailwind вместо cdn.tailwindcss.com). В ilj.html се обновява ?v=хеш.
   Пускане:  NODE_PATH=/tmp/cdn/node_modules node tools/build-ilj.js
   (нужни пакети: @babel/standalone@7.25.6, terser@5, tailwindcss@3.4) */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const req = (m) => require(require.resolve(m, { paths: [process.env.NODE_PATH || '/tmp/cdn/node_modules', __dirname] }));
const ROOT = path.join(__dirname, '..'), M = (f) => path.join(ROOT, 'mobile', f);
const hash = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);

(async () => {
  const Babel = req('@babel/standalone'), terser = req('terser');
  const src = fs.readFileSync(M('ilj-app.jsx'), 'utf8');
  // същите настройки, с които Babel ги превеждаше в браузъра (presets react+env и плъгините по подразбиране)
  const code = Babel.transform(src, {
    filename: 'ilj-app.jsx', presets: ['react', 'env'],
    plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-flow-strip-types'],
    sourceType: 'script', comments: false
  }).code;
  const min = await terser.minify(code, { compress: { passes: 2 }, mangle: { toplevel: false }, format: { comments: false } });
  if (min.error) throw min.error;
  fs.writeFileSync(M('ilj-app.js'), '/* generated from ilj-app.jsx by tools/build-ilj.js – do not edit */\n' + min.code);

  // статичен Tailwind (preflight + използваните класове) – съдържа и самия JSX
  const tw = path.dirname(require.resolve('tailwindcss/package.json', { paths: [process.env.NODE_PATH || '/tmp/cdn/node_modules'] }));
  const tmp = fs.mkdtempSync('/tmp/ndtw-');
  fs.writeFileSync(tmp + '/in.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  fs.writeFileSync(tmp + '/tw.config.js', 'module.exports={content:' + JSON.stringify([M('ilj.html'), M('ilj-app.jsx')]) + '}');
  cp.execFileSync('node', [tw + '/lib/cli.js', '-c', tmp + '/tw.config.js', '-i', tmp + '/in.css', '-o', M('ilj-tw.css'), '--minify'], { stdio: 'pipe' });

  let html = fs.readFileSync(M('ilj.html'), 'utf8');
  const hv = { 'ilj-app.js': hash(fs.readFileSync(M('ilj-app.js'))), 'ilj-tw.css': hash(fs.readFileSync(M('ilj-tw.css'))) };
  for (const f in hv) html = html.replace(new RegExp('/mobile/' + f.replace('.', '\\.') + '(\\?v=[0-9a-f]+)?', 'g'), '/mobile/' + f + '?v=' + hv[f]);
  fs.writeFileSync(M('ilj.html'), html);
  console.log('ilj-app.js', fs.statSync(M('ilj-app.js')).size, 'B; ilj-tw.css', fs.statSync(M('ilj-tw.css')).size, 'B;', JSON.stringify(hv));
})().catch((e) => { console.error(e); process.exit(1); });
