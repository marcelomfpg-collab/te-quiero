/**
 * Texto de un Word antiguo (.doc, formato 97-2003). No hace falta un lector completo:
 * el texto va guardado como UTF-16 o como Windows-1252, así que se recuperan las
 * secuencias legibles. Suficiente para encontrar DNI, carrera, fechas, brevete, etc.
 */
const CP1252_EXTRA: Record<number, string> = { 0x91: "'", 0x92: "'", 0x93: '"', 0x94: '"', 0x96: '-', 0x97: '-', 0x95: '•' };

function isTextCode(c: number): boolean {
  return c === 9 || c === 10 || c === 13 || (c >= 0x20 && c < 0x7f) || (c >= 0xa0 && c <= 0xff) || c in CP1252_EXTRA;
}

function decode(c: number): string {
  if (c === 13) return '\n';
  return CP1252_EXTRA[c] ?? String.fromCharCode(c);
}

const MIN_RUN = 4;
/** Una secuencia vale si tiene letras (descarta basura binaria como "@@@@" o "ÿÿÿÿ"). */
const looksLikeText = (s: string) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}/.test(s) && !/(.)\1{5,}/.test(s);

export function extractLegacyDocText(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const runs: { at: number; text: string }[] = [];

  // 1) UTF-16LE: carácter + byte alto 0.
  let cur = '';
  let start = 0;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i]!;
    const hi = bytes[i + 1]!;
    if (hi === 0 && isTextCode(lo)) {
      if (!cur) start = i;
      cur += decode(lo);
    } else {
      if (cur.length >= MIN_RUN && looksLikeText(cur)) runs.push({ at: start, text: cur });
      cur = '';
    }
  }
  if (cur.length >= MIN_RUN && looksLikeText(cur)) runs.push({ at: start, text: cur });

  // 2) Windows-1252 (texto "comprimido" de Word): solo si UTF-16 no dio casi nada.
  const utf16Chars = runs.reduce((n, r) => n + r.text.length, 0);
  if (utf16Chars < 200) {
    cur = '';
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i]!;
      if (isTextCode(c)) {
        if (!cur) start = i;
        cur += decode(c);
      } else {
        if (cur.length >= MIN_RUN + 2 && looksLikeText(cur)) runs.push({ at: start, text: cur });
        cur = '';
      }
    }
    if (cur.length >= MIN_RUN + 2 && looksLikeText(cur)) runs.push({ at: start, text: cur });
  }

  // Quita repeticiones (Word guarda el texto más de una vez) conservando el orden.
  const seen = new Set<string>();
  return runs
    .sort((a, b) => a.at - b.at)
    .map((r) => r.text.trim())
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .join('\n');
}
