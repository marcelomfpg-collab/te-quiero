import { maxCodeNumber } from '../domain/codes';
import type { Candidate } from '../domain/types';
import { candidateFromCv } from './candidateFromCv';
import { duplicateOf, readFiles, type ImportSummary, type IncomingFile } from './importCvs';
import { fileKind } from './textExtract';

const PROCESSED_KEY = 'pacsi-becarios-2027a:carpeta-procesados';
const CERTIFICATE = /\b(certificado|constancia)\s+de\s+(trabajo|practicas|prestacion de servicios|servicios|experiencia|labores)\b|\bcertifica(mos)?\s+que\b|\bhace constar\b/i;

/**
 * Power Automate guarda cada adjunto como "remitente@correo.com__archivo.pdf".
 * Así se juntan el CV y los certificados del mismo postulante.
 */
export function parseFolderName(name: string): { sender?: string; original: string } {
  const m = name.match(/^([^\s_/\\]+@[^\s_/\\]+?\.[a-z]{2,})_{1,2}(.+)$/i);
  return m ? { sender: m[1]!.toLowerCase(), original: m[2]! } : { original: name };
}

export interface FolderGroup {
  sender?: string;
  files: FolderFile[];
}

/** Agrupa por remitente; los archivos sin remitente en el nombre van cada uno por su cuenta. */
export function groupFolderFiles(files: FolderFile[]): FolderGroup[] {
  const bySender = new Map<string, FolderFile[]>();
  const loose: FolderGroup[] = [];
  for (const f of files) {
    const { sender } = parseFolderName(f.name);
    if (!sender) loose.push({ files: [f] });
    else bySender.set(sender, [...(bySender.get(sender) ?? []), f]);
  }
  return [...[...bySender].map(([sender, fs]) => ({ sender, files: fs })), ...loose];
}

export const fileKey = (f: FolderFile) => `${f.rel}|${f.size}|${f.mtimeMs}`;

export function readProcessedFolderKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveProcessed(keys: Set<string>) {
  try {
    localStorage.setItem(PROCESSED_KEY, JSON.stringify([...keys]));
  } catch {
    /* sin persistencia: los duplicados se detectan igual por DNI y correo */
  }
}

export function clearProcessedFolderKeys() {
  try {
    localStorage.removeItem(PROCESSED_KEY);
  } catch {
    /* nada */
  }
}

export interface FolderSyncSummary extends ImportSummary {
  checked: number;
  /** Archivos nuevos que se agregaron a un postulante que ya existía (p. ej. un certificado que llegó después). */
  updated: { candidate: Candidate; patch: Partial<Candidate>; files: string[] }[];
}

/**
 * Revisa la carpeta vigilada: lee solo los archivos nuevos, junta los de un mismo remitente
 * y crea los postulantes. Un archivo que llega después para alguien ya registrado se le agrega.
 */
export async function syncFolder(existing: Candidate[], today: string, onProgress: (m: string) => void): Promise<FolderSyncSummary> {
  const folder = window.pacsiDesktop?.folder;
  if (!folder) throw new Error('Vigilar una carpeta solo está disponible en el programa de escritorio.');
  const summary: FolderSyncSummary = { created: [], skipped: [], ocrUsed: 0, checked: 0, updated: [] };
  const processed = readProcessedFolderKeys();
  let code = maxCodeNumber(existing);

  onProgress('Revisando la carpeta…');
  const pending = (await folder.list()).filter((f) => !processed.has(fileKey(f)) && fileKind(f.name, '') !== 'otro');
  summary.checked = pending.length;
  const groups = groupFolderFiles(pending);

  for (const [i, group] of groups.entries()) {
    const label = group.sender ?? parseFolderName(group.files[0]!.name).original;
    onProgress(`Leyendo ${i + 1} de ${groups.length}: ${label}`);
    try {
      const incoming: IncomingFile[] = [];
      for (const f of group.files) {
        const bytes = await folder.read(f.rel);
        incoming.push({ name: parseFolderName(f.name).original, type: '', data: bytes.slice().buffer as ArrayBuffer });
      }
      const { text, stored } = await readFiles(incoming, onProgress, summary);
      const all = [...existing, ...summary.created];
      const sameSender = group.sender ? all.find((c) => c.email.toLowerCase() === group.sender) : undefined;

      if (sameSender) {
        // Llegó algo más de un postulante ya registrado (p. ej. el certificado de trabajo).
        const patch: Partial<Candidate> = { files: [...(sameSender.files ?? []), ...stored] };
        if (CERTIFICATE.test(text)) {
          patch.experienceCertified = true;
          patch.missing = sameSender.missing?.filter((f) => f !== 'experienceCertified');
          patch.uncertain = sameSender.uncertain?.filter((f) => f !== 'experienceCertified');
        }
        const inBatch = summary.created.findIndex((c) => c.id === sameSender.id);
        if (inBatch >= 0) summary.created[inBatch] = { ...sameSender, ...patch };
        else summary.updated.push({ candidate: sameSender, patch, files: incoming.map((f) => f.name) });
      } else {
        const subject = incoming.map((f) => f.name).find((n) => /becari/i.test(n))?.replace(/\.[^.]+$/, '');
        const { candidate } = candidateFromCv({
          text,
          today,
          subject,
          senderEmail: group.sender,
          fileName: incoming[0]!.name,
          files: stored,
          source: 'carpeta',
          submittedAt: new Date(Math.min(...group.files.map((f) => f.mtimeMs))).toISOString().slice(0, 10),
          codeNumber: code + 1,
        });
        const dup = duplicateOf(candidate, all);
        if (dup) summary.skipped.push({ name: label, reason: `Ya registrado: ${dup.lastNames}, ${dup.firstNames}` });
        else {
          code++;
          summary.created.push(candidate);
        }
      }
      for (const f of group.files) processed.add(fileKey(f));
    } catch (error) {
      summary.skipped.push({ name: label, reason: `No se pudo leer: ${(error as Error)?.message ?? error}` });
    }
    saveProcessed(processed);
  }
  return summary;
}
