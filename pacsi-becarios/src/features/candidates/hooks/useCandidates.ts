import { useCallback, useEffect, useState } from 'react';
import type { Candidate } from '../../../domain/types';
import { RepositoryError, type CandidatePatch, type CandidateRepository } from '../../../services';

type LoadState =
  | { status: 'loading'; data: Candidate[] | null }
  | { status: 'success'; data: Candidate[] }
  | { status: 'error'; data: Candidate[] | null; message: string };

function messageOf(error: unknown, fallback: string): string {
  return error instanceof RepositoryError ? error.message : fallback;
}

/**
 * Carga con cancelación y reintento, y mutaciones optimistas:
 * el cambio se ve al instante y se revierte si el servidor lo rechaza.
 */
export function useCandidates(repository: CandidateRepository, onError: (message: string) => void) {
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
        setState((prev) => ({ status: 'error', data: prev.data, message: messageOf(error, 'Ocurrió un error inesperado al cargar los postulantes.') }));
      });
    return () => controller.abort();
  }, [repository, attempt]);

  const replaceOne = (id: string, fn: (c: Candidate) => Candidate) =>
    setState((prev) => (prev.data ? { ...prev, data: prev.data.map((c) => (c.id === id ? fn(c) : c)) } as LoadState : prev));

  const update = useCallback(
    async (id: string, patch: CandidatePatch) => {
      const previous = state.data?.find((c) => c.id === id);
      replaceOne(id, (c) => ({ ...c, ...patch }));
      try {
        await repository.update(id, patch);
      } catch (error) {
        if (previous) replaceOne(id, () => previous);
        onError(messageOf(error, 'No se pudo guardar el cambio.'));
      }
    },
    [repository, state.data, onError],
  );

  const importMany = useCallback(
    async (candidates: Candidate[]) => {
      const saved = await repository.importMany(candidates);
      setState((prev) => ({ status: 'success', data: [...(prev.data ?? []), ...saved] }));
      return saved.length;
    },
    [repository],
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload, update, importMany };
}
