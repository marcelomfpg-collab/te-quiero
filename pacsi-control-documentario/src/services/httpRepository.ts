import type { FleetDocument } from '../domain/types';
import { RepositoryError, type DocumentRepository } from './documentRepository';

export function createHttpRepository(baseUrl: string): DocumentRepository {
  return {
    async list(signal) {
      let response: Response;
      try {
        response = await fetch(`${baseUrl.replace(/\/$/, '')}/documentos`, {
          signal,
          headers: { Accept: 'application/json' },
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        throw new RepositoryError('No se pudo conectar con el servidor. Verifique su conexión.');
      }
      if (!response.ok) {
        throw new RepositoryError(`El servidor respondió con un error (${response.status}).`, response.status);
      }
      return (await response.json()) as FleetDocument[];
    },
  };
}
