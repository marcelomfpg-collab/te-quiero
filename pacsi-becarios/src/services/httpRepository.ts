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
  return (await response.json()) as T;
}

export function createHttpRepository(baseUrl: string): CandidateRepository {
  const api = `${baseUrl.replace(/\/$/, '')}/postulantes`;
  return {
    list: (signal) => request<Candidate[]>(api, { signal }),
    update: (id, patch) => request<Candidate>(`${api}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    importMany: (candidates) => request<Candidate[]>(`${api}/importar`, { method: 'POST', body: JSON.stringify(candidates) }),
  };
}
