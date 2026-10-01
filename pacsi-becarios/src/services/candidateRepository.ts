import type { Candidate } from '../domain/types';

export type CandidatePatch = Partial<Omit<Candidate, 'id'>>;

/**
 * Contrato de acceso a datos. La UI depende solo de esta interfaz:
 * hoy guarda en la computadora; mañana puede apuntar a un servidor sin tocar la UI.
 */
export interface CandidateRepository {
  list(signal?: AbortSignal): Promise<Candidate[]>;
  create(candidate: Candidate): Promise<Candidate>;
  update(id: string, patch: CandidatePatch): Promise<Candidate>;
  remove(id: string): Promise<void>;
  importMany(candidates: Candidate[]): Promise<Candidate[]>;
  /** Reemplaza todos los datos (restaurar copia de seguridad, datos de ejemplo, borrar todo). */
  replaceAll(candidates: Candidate[]): Promise<Candidate[]>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}
