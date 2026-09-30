import { useCallback, useEffect, useState } from 'react';
import type { FleetDocument } from '../../../domain/types';
import { RepositoryError, type DocumentRepository } from '../../../services';

export type LoadState =
  | { status: 'loading'; data: FleetDocument[] | null }
  | { status: 'success'; data: FleetDocument[] }
  | { status: 'error'; data: FleetDocument[] | null; message: string };

/**
 * Carga los documentos con cancelación (AbortController) y reintento manual.
 * En una recarga conserva los datos previos para no vaciar la tabla mientras llega la respuesta.
 */
export function useDocuments(repository: DocumentRepository) {
  const [state, setState] = useState<LoadState>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ status: 'loading', data: prev.data }));

    repository
      .list(controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof RepositoryError ? error.message : 'Ocurrió un error inesperado al cargar los documentos.';
        setState((prev) => ({ status: 'error', data: prev.data, message }));
      });

    return () => controller.abort();
  }, [repository, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
