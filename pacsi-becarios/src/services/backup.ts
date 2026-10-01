import type { Candidate } from '../domain/types';

const FORMAT = 'pacsi-becarios-backup';

/** Copia de seguridad en JSON: para guardar, enviar o pasar los datos a otra computadora. */
export function toBackup(candidates: Candidate[], now = new Date()): string {
  return JSON.stringify({ format: FORMAT, version: 1, createdAt: now.toISOString(), candidates }, null, 2);
}

export function fromBackup(text: string): Candidate[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida.');
  }
  const backup = data as { format?: string; candidates?: unknown };
  if (backup.format !== FORMAT || !Array.isArray(backup.candidates)) {
    throw new Error('El archivo no es una copia de seguridad de este programa.');
  }
  const valid = backup.candidates.every(
    (c) => c && typeof c === 'object' && typeof (c as Candidate).id === 'string' && typeof (c as Candidate).dni === 'string',
  );
  if (!valid) throw new Error('La copia de seguridad está dañada.');
  return backup.candidates as Candidate[];
}
