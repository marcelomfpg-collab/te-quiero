import { maxCodeNumber, newId } from '../domain/codes';
import type { Candidate, CandidateFile } from '../domain/types';
import { fileStore } from '../lib/fileStore';
import { candidateFromCv } from './candidateFromCv';
import { extractText, fileKind, type ProgressFn } from './textExtract';

export interface ImportSummary {
  created: Candidate[];
  skipped: { name: string; reason: string }[];
  ocrUsed: number;
}

interface IncomingFile {
  name: string;
  type: string;
  data: ArrayBuffer;
}

const PROCESSED_KEY = 'pacsi-becarios-2027a:correos-procesados';

/** Guarda los archivos y devuelve su texto unido (CV + certificados del mismo postulante). */
async function readFiles(files: IncomingFile[], onProgress: ProgressFn, summary: ImportSummary): Promise<{ text: string; stored: CandidateFile[] }> {
  const texts: string[] = [];
  const stored: CandidateFile[] = [];
  for (const f of files) {
    if (fileKind(f.name, f.type) === 'otro') continue;
    const result = await extractText(f.data, f.name, f.type, onProgress);
    if (result.method === 'ocr') summary.ocrUsed++;
    texts.push(result.text);
    const id = newId();
    try {
      await fileStore.put(id, new Blob([f.data], { type: f.type || 'application/octet-stream' }));
      stored.push({ id, name: f.name, type: f.type });
    } catch {
      /* sin almacenamiento disponible: el postulante se crea igual, sin el archivo adjunto */
    }
  }
  return { text: texts.join('\n\n'), stored };
}

function duplicateOf(candidate: Candidate, existing: Candidate[]): Candidate | undefined {
  if (candidate.emailMessageId && existing.some((c) => c.emailMessageId === candidate.emailMessageId)) {
    return existing.find((c) => c.emailMessageId === candidate.emailMessageId);
  }
  return candidate.dni ? existing.find((c) => c.dni === candidate.dni) : undefined;
}

/** Sube CVs sueltos (PDF, Word o imagen): cada archivo es un postulante. */
export async function importCvFiles(files: File[], existing: Candidate[], today: string, onProgress: ProgressFn): Promise<ImportSummary> {
  const summary: ImportSummary = { created: [], skipped: [], ocrUsed: 0 };
  let code = maxCodeNumber(existing);
  for (const [i, file] of files.entries()) {
    onProgress(`Leyendo ${i + 1} de ${files.length}: ${file.name}`);
    if (fileKind(file.name, file.type) === 'otro') {
      summary.skipped.push({ name: file.name, reason: 'Formato no soportado: use PDF, Word (.doc o .docx) o foto (JPG/PNG)' });
      continue;
    }
    try {
      const { text, stored } = await readFiles([{ name: file.name, type: file.type, data: await file.arrayBuffer() }], onProgress, summary);
      const { candidate } = candidateFromCv({ text, today, fileName: file.name, files: stored, source: 'cv', submittedAt: today, codeNumber: code + 1 });
      const dup = duplicateOf(candidate, [...existing, ...summary.created]);
      if (dup) {
        await Promise.all(stored.map((s) => fileStore.remove(s.id)));
        summary.skipped.push({ name: file.name, reason: `Ya registrado: ${dup.lastNames}, ${dup.firstNames} (DNI ${dup.dni})` });
        continue;
      }
      code++;
      summary.created.push(candidate);
    } catch (error) {
      const msg = (error as Error)?.message || String(error);
      summary.skipped.push({ name: file.name, reason: `No se pudo leer: ${msg}` });
    }
  }
  return summary;
}

export function readProcessedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveProcessedIds(ids: Set<string>) {
  try {
    localStorage.setItem(PROCESSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* sin persistencia: se volverán a revisar, y los duplicados se detectan igual */
  }
}

export function clearProcessedIds() {
  try {
    localStorage.removeItem(PROCESSED_KEY);
  } catch {
    /* nada */
  }
}

export interface MailSyncSummary extends ImportSummary {
  checked: number;
  withoutCv: string[];
}

/**
 * Revisa el correo de reclutamiento (solo en el programa de escritorio):
 * baja los correos nuevos, lee sus CVs adjuntos y crea los postulantes.
 */
export async function syncMailbox(existing: Candidate[], today: string, onProgress: ProgressFn): Promise<MailSyncSummary> {
  const mail = window.pacsiDesktop?.mail;
  if (!mail) throw new Error('La conexión al correo solo está disponible en el programa de escritorio.');
  const summary: MailSyncSummary = { created: [], skipped: [], ocrUsed: 0, checked: 0, withoutCv: [] };
  const processed = readProcessedIds();
  let code = maxCodeNumber(existing);

  onProgress('Conectando con el correo…');
  await mail.open();
  try {
    const messages = (await mail.list()).filter((m) => !processed.has(m.messageId));
    summary.checked = messages.length;
    for (const [i, summaryMsg] of messages.entries()) {
      onProgress(`Correo ${i + 1} de ${messages.length}: ${summaryMsg.fromName || summaryMsg.fromAddress}`);
      try {
        const msg = await mail.get(summaryMsg.uid);
        const files = msg.attachments
          .filter((a) => fileKind(a.filename, a.contentType) !== 'otro')
          .map((a) => ({ name: a.filename, type: a.contentType, data: a.content.slice().buffer as ArrayBuffer }));
        if (!files.length) {
          summary.withoutCv.push(`${msg.fromName || msg.fromAddress}: "${msg.subject}"`);
          processed.add(msg.messageId);
          continue;
        }
        const { text, stored } = await readFiles(files, onProgress, summary);
        const { candidate } = candidateFromCv({
          text: `${text}\n\n${msg.text ?? ''}`,
          today,
          subject: msg.subject,
          senderName: msg.fromName,
          senderEmail: msg.fromAddress,
          fileName: files[0]!.name,
          files: stored,
          source: 'correo',
          submittedAt: msg.date.slice(0, 10),
          codeNumber: code + 1,
          emailMessageId: msg.messageId,
        });
        const dup = duplicateOf(candidate, [...existing, ...summary.created]);
        if (dup) {
          await Promise.all(stored.map((s) => fileStore.remove(s.id)));
          summary.skipped.push({ name: msg.subject || msg.fromAddress, reason: `Ya registrado: ${dup.lastNames}, ${dup.firstNames}` });
        } else {
          code++;
          summary.created.push(candidate);
        }
        processed.add(msg.messageId);
      } catch (error) {
        summary.skipped.push({ name: summaryMsg.subject, reason: `No se pudo procesar (${(error as Error).message})` });
      }
      saveProcessedIds(processed);
    }
  } finally {
    await mail.close().catch(() => undefined);
  }
  return summary;
}
