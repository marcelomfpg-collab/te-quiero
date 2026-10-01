import type { Candidate } from '../domain/types';
import { RepositoryError, type CandidateRepository } from './candidateRepository';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json' } });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new RepositoryError('No se pudo conectar con el servidor. Verifique su conexión.');
  }
  if (!response.ok) throw new RepositoryError(`El servidor respondió con un error (${response.status}).`, response.status);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Implementación para cuando exista un servidor central (varios reclutadores a la vez). */
export function createHttpRepository(baseUrl: string): CandidateRepository {
  const api = `${baseUrl.replace(/\/$/, '')}/postulantes`;
  const one = (id: string) => `${api}/${encodeURIComponent(id)}`;
  return {
    list: (signal) => request<Candidate[]>(api, { signal }),
    create: (c) => request<Candidate>(api, { method: 'POST', body: JSON.stringify(c) }),
    update: (id, patch) => request<Candidate>(one(id), { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id) => request<void>(one(id), { method: 'DELETE' }),
    importMany: (cs) => request<Candidate[]>(`${api}/importar`, { method: 'POST', body: JSON.stringify(cs) }),
    replaceAll: (cs) => request<Candidate[]>(api, { method: 'PUT', body: JSON.stringify(cs) }),
  };
}
