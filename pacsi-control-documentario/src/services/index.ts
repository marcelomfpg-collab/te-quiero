import type { DocumentRepository } from './documentRepository';
import { createHttpRepository } from './httpRepository';
import { createMockRepository } from './mockRepository';

export type { DocumentRepository } from './documentRepository';
export { RepositoryError } from './documentRepository';

/** Punto único de composición: API real si hay VITE_API_URL, si no, datos simulados. */
export function createDocumentRepository(): DocumentRepository {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) return createHttpRepository(apiUrl);
  const params = new URLSearchParams(window.location.search);
  return createMockRepository({ fail: params.has('simularError') });
}
