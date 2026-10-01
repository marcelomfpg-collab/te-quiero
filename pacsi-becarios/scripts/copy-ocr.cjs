// Copia los archivos del OCR (lectura de CVs escaneados) a build/ocr para incluirlos en el programa.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'build', 'ocr');
const nm = (...p) => path.join(root, 'node_modules', ...p);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'core'), { recursive: true });
fs.mkdirSync(path.join(out, 'lang'), { recursive: true });
fs.copyFileSync(nm('tesseract.js', 'dist', 'worker.min.js'), path.join(out, 'worker.min.js'));
for (const f of fs.readdirSync(nm('tesseract.js-core'))) {
  // Con OEM 1 (LSTM) tesseract.js solo usa las variantes *-lstm.wasm.js.
  if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) fs.copyFileSync(nm('tesseract.js-core', f), path.join(out, 'core', f));
}
fs.copyFileSync(nm('@tesseract.js-data', 'spa', '4.0.0', 'spa.traineddata.gz'), path.join(out, 'lang', 'spa.traineddata.gz'));
console.log('OCR copiado a', out);
