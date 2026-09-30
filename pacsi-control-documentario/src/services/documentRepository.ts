import type { FleetDocument } from '../domain/types';

/**
 * Contrato de acceso a datos. La UI depende solo de esta interfaz,
 * así que cambiar el mock por la API real no toca ningún componente.
 */
export interface DocumentRepository {
  list(signal?: AbortSignal): Promise<FleetDocument[]>;
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
