import type { Candidate } from '../domain/types';

export type CandidatePatch = Partial<Pick<Candidate, 'stage' | 'softSkills' | 'notes'>>;

/**
 * Contrato de acceso a datos. La UI depende solo de esta interfaz:
 * cambiar el mock por la API real no toca ningún componente.
 */
export interface CandidateRepository {
  list(signal?: AbortSignal): Promise<Candidate[]>;
  update(id: string, patch: CandidatePatch): Promise<Candidate>;
  importMany(candidates: Candidate[]): Promise<Candidate[]>;
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
