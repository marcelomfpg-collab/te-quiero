// Genera src/cv/samples/samples.ts con los CVs de ejemplo en base64 (para la versión de prueba).
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'src', 'cv', 'samples');
const files = fs.readdirSync(dir).filter((f) => /\.(pdf|docx)$/i.test(f)).sort();
const entries = files.map((f) => `  { name: ${JSON.stringify(f)}, base64: ${JSON.stringify(fs.readFileSync(path.join(dir, f)).toString('base64'))} },`);
fs.writeFileSync(
  path.join(dir, 'samples.ts'),
  `// Archivo generado por scripts/embed-samples.cjs: CVs ficticios para la versión de prueba.\nexport const SAMPLE_CVS: { name: string; base64: string }[] = [\n${entries.join('\n')}\n];\n`,
);
console.log(`${files.length} CVs de ejemplo embebidos`);
