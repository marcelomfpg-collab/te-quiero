import type { CandidateRepository } from './candidateRepository';
import { createHttpRepository } from './httpRepository';
import { clearMockStorage, createMockRepository } from './mockRepository';

export type { CandidatePatch, CandidateRepository } from './candidateRepository';
export { RepositoryError } from './candidateRepository';

/** Punto único de composición: API real si hay VITE_API_URL; si no, datos de demostración. */
export function createCandidateRepository(): CandidateRepository {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) return createHttpRepository(apiUrl);
  const params = new URLSearchParams(window.location.search);
  if (params.has('reiniciar')) clearMockStorage();
  return createMockRepository({ fail: params.has('simularError') });
}
