// Versión "legacy": funciona también en Chrome/Edge antiguos de las PCs de oficina.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker&inline';

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
import { DEMO } from '../demo';

export type ExtractMethod = 'texto' | 'ocr' | 'word' | 'word-antiguo' | 'sin-soporte';

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

export function fileKind(name: string, type: string): 'pdf' | 'word' | 'word-antiguo' | 'imagen' | 'otro' {
  const n = name.toLowerCase();
  if (type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx') || type.includes('wordprocessingml')) return 'word';
  if (n.endsWith('.doc') || type === 'application/msword') return 'word-antiguo';
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
  if (kind === 'word-antiguo') {
    const { extractLegacyDocText } = await import('./docLegacy');
    return { text: extractLegacyDocText(data), method: 'word-antiguo' };
  }
  if (kind === 'imagen') {
    onProgress?.('Leyendo imagen escaneada (OCR)…');
    return { text: await ocr(new Blob([data], { type })), method: 'ocr' };
  }
  return { text: '', method: 'sin-soporte' };
}

/** Mensajes claros para los PDF que no se pueden abrir. */
function pdfOpenError(error: unknown): Error {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'PasswordException') return new Error('el PDF tiene contraseña: ábralo, guárdelo sin contraseña ("Imprimir → Guardar como PDF") y súbalo de nuevo');
  if (e?.name === 'InvalidPDFException' || /invalid pdf|corrupt/i.test(e?.message ?? '')) return new Error('el archivo está dañado o no es un PDF real (pida al postulante que lo vuelva a enviar)');
  return new Error(`no se pudo abrir el PDF (${e?.message ?? 'error desconocido'})`);
}

async function extractPdf(data: ArrayBuffer, onProgress?: ProgressFn): Promise<ExtractResult> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise.catch((error: unknown) => {
    throw pdfOpenError(error);
  });
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
  workerPromise ??= import('tesseract.js').then(async ({ createWorker }) => {
    // Programa de escritorio: archivos del OCR incluidos (sin internet).
    const desktop = window.pacsiDesktop?.ocrPaths;
    if (desktop) return createWorker('spa', 1, { ...desktop, gzip: true });
    // Versión de prueba en línea: los archivos del OCR se publican junto a la página (carpeta ocr/).
    if (DEMO) {
      const base = new URL('ocr/', document.baseURI).href;
      // El modelo en español se publica como "spa-traineddata.wasm" (contenido gzip, extensión que el servidor sí entrega)
      // y se deja en la caché del navegador, donde el lector lo busca antes de descargarlo.
      await primeOcrCache(`${base}lang/spa-traineddata.wasm`);
      return createWorker('spa', 1, { workerPath: `${base}worker.min.js`, corePath: `${base}core`, langPath: `${base}lang`, workerBlobURL: false, cacheMethod: 'readOnly' });
    }
    return createWorker('spa', 1, { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa/4.0.0' });
  });
  return workerPromise;
}

async function ocr(image: Blob): Promise<string> {
  const worker = await getWorker().catch((error: unknown) => {
    workerPromise = null; // permite reintentar
    throw new Error(`no se pudo iniciar el lector de escaneados (${(error as Error)?.message ?? error})`);
  });
  const { data } = await worker.recognize(image);
  return data.text;
}

/** Guarda el modelo del OCR en la misma caché (idb-keyval) que usa tesseract.js. */
async function primeOcrCache(url: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`no se pudo descargar el modelo de lectura (${resp.status})`);
  const data = new Uint8Array(await resp.arrayBuffer());
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('keyval-store', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keyval');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(data, './spa.traineddata');
      tx.oncomplete = () => {
        req.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}
