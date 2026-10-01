import type { CandidateRepository } from './candidateRepository';
import { createHttpRepository } from './httpRepository';
import { createLocalRepository } from './localRepository';

export type { CandidatePatch, CandidateRepository } from './candidateRepository';
export { RepositoryError } from './candidateRepository';

/** Servidor central si se define VITE_API_URL; si no, datos guardados en esta computadora. */
export function createCandidateRepository(): CandidateRepository {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  return apiUrl ? createHttpRepository(apiUrl) : createLocalRepository();
}
