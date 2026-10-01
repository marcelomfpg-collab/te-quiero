// Versión "legacy": funciona también en Chrome/Edge antiguos de las PCs de oficina.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline';

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
import { DEMO } from '../demo';

export type ExtractMethod = 'texto' | 'ocr' | 'word' | 'sin-soporte';

export interface ExtractResult {
  text: string;
  method: ExtractMethod;
  pages?: number;
}

/** Mismo módulo de PDF para el visor. */
export { pdfjs };

export type ProgressFn = (message: string) => void;

const MIN_TEXT = 80;
const MAX_OCR_PAGES = 4;

export function fileKind(name: string, type: string): 'pdf' | 'word' | 'imagen' | 'otro' {
  const n = name.toLowerCase();
  if (type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx') || type.includes('wordprocessingml')) return 'word';
  if (/^image\/(png|jpe?g|webp|bmp)$/.test(type) || /\.(png|jpe?g|webp|bmp)$/.test(n)) return 'imagen';
  return 'otro';
}

/** Saca el texto de un CV en PDF, Word o imagen. Los PDF escaneados pasan por OCR. */
export async function extractText(data: ArrayBuffer, name: string, type: string, onProgress?: ProgressFn): Promise<ExtractResult> {
  const kind = fileKind(name, type);
  if (kind === 'pdf') return extractPdf(data, onProgress);
  if (kind === 'word') {
    const mammoth = (await import('mammoth')).default;
    const { value } = await mammoth.extractRawText({ arrayBuffer: data });
    return { text: value, method: 'word' };
  }
  if (kind === 'imagen') {
    if (DEMO) throw new Error('es una foto; la versión de prueba no lee imágenes, el programa de escritorio sí');
    onProgress?.('Leyendo imagen escaneada (OCR)…');
    return { text: await ocr(new Blob([data], { type })), method: 'ocr' };
  }
  return { text: '', method: 'sin-soporte' };
}

async function extractPdf(data: ArrayBuffer, onProgress?: ProgressFn): Promise<ExtractResult> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const width = page.getViewport({ scale: 1 }).width;
      pages.push(layoutText(content.items.filter((it): it is TextItem => 'str' in it), width));
    }
    const text = pages.join('\n\n');
    if (text.replace(/\s/g, '').length >= MIN_TEXT) return { text, method: 'texto', pages: doc.numPages };

    // Sin texto seleccionable: es un escaneo o una foto. Se lee con OCR.
    if (DEMO) throw new Error('es un CV escaneado; la versión de prueba no lee escaneados, el programa de escritorio sí');
    const ocrPages: string[] = [];
    const n = Math.min(doc.numPages, MAX_OCR_PAGES);
    for (let i = 1; i <= n; i++) {
      onProgress?.(`CV escaneado: leyendo página ${i} de ${n} con OCR…`);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      ocrPages.push(await ocr(blob));
    }
    return { text: ocrPages.join('\n\n'), method: 'ocr', pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

interface Positioned {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Reconstruye las líneas del PDF. Si la página tiene dos columnas (CVs modernos),
 * lee primero la columna izquierda completa y luego la derecha, para no mezclar secciones.
 */
export function layoutText(items: TextItem[], pageWidth: number): string {
  const pos: Positioned[] = items
    .filter((it) => it.str.trim())
    .map((it) => ({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, w: it.width, h: Math.abs(it.transform[3] as number) || it.height || 10 }));
  if (!pos.length) return '';

  const split = findColumnSplit(pos, pageWidth);
  const columns = split === null ? [pos] : [pos.filter((p) => p.x < split), pos.filter((p) => p.x >= split)];
  return columns.map(toLines).filter(Boolean).join('\n');
}

function findColumnSplit(pos: Positioned[], pageWidth: number): number | null {
  const bins = 200;
  const cover = new Array<number>(bins).fill(0);
  for (const p of pos) {
    if (p.w > pageWidth * 0.4) continue; // títulos a todo lo ancho no cuentan
    const a = Math.max(0, Math.floor((p.x / pageWidth) * bins));
    const b = Math.min(bins - 1, Math.floor(((p.x + p.w) / pageWidth) * bins));
    for (let i = a; i <= b; i++) cover[i]!++;
  }
  let best: [number, number] | null = null;
  let runStart = -1;
  for (let i = Math.floor(bins * 0.2); i <= Math.floor(bins * 0.8); i++) {
    if (cover[i] === 0) {
      if (runStart === -1) runStart = i;
      if (!best || i - runStart > best[1] - best[0]) best = [runStart, i];
    } else runStart = -1;
  }
  if (!best || best[1] - best[0] < 3) return null;
  const split = ((best[0] + best[1]) / 2 / bins) * pageWidth;
  const left = pos.filter((p) => p.x < split).length;
  const right = pos.length - left;
  return left >= pos.length * 0.15 && right >= pos.length * 0.15 ? split : null;
}

function toLines(pos: Positioned[]): string {
  const sorted = [...pos].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Positioned[][] = [];
  for (const p of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0]!.y - p.y) < Math.max(3, p.h * 0.5)) line.push(p);
    else lines.push([p]);
  }
  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .reduce((acc, p, i, arr) => {
          if (i === 0) return p.str;
          const prev = arr[i - 1]!;
          const gap = p.x - (prev.x + prev.w);
          return acc + (gap > p.h * 0.15 && !acc.endsWith(' ') && !p.str.startsWith(' ') ? ' ' : '') + p.str;
        }, ''),
    )
    .join('\n');
}

// ---------- OCR (gratis, en la propia computadora) ----------

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  workerPromise ??= import('tesseract.js').then(({ createWorker }) => {
    // En el programa de escritorio los archivos del OCR van incluidos (funciona sin internet).
    const paths = window.pacsiDesktop?.ocrPaths;
    return createWorker('spa', 1, paths ? { ...paths, gzip: true } : { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa/4.0.0' });
  });
  return workerPromise;
}

async function ocr(image: Blob): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text;
}
