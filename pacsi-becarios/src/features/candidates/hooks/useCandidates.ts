import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candidate } from '../../../domain/types';
import { RepositoryError, type CandidatePatch, type CandidateRepository } from '../../../services';

type LoadState =
  | { status: 'loading'; data: Candidate[] | null }
  | { status: 'success'; data: Candidate[] }
  | { status: 'error'; data: Candidate[] | null; message: string };

export function messageOf(error: unknown, fallback: string): string {
  return error instanceof RepositoryError || error instanceof Error ? error.message : fallback;
}

/**
 * Carga con cancelación y reintento. Las ediciones son optimistas: el cambio se ve
 * al instante y se revierte si no se pudo guardar.
 */
export function useCandidates(repository: CandidateRepository, onError: (message: string) => void) {
  const [state, setState] = useState<LoadState>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);
  const dataRef = useRef<Candidate[] | null>(null);
  dataRef.current = state.data;

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

  const setData = (fn: (data: Candidate[]) => Candidate[]) =>
    setState((prev) => ({ status: 'success', data: fn(prev.data ?? []) }));

  const update = useCallback(
    async (id: string, patch: CandidatePatch) => {
      const previous = dataRef.current?.find((c) => c.id === id);
      setData((data) => data.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      try {
        await repository.update(id, patch);
      } catch (error) {
        if (previous) setData((data) => data.map((c) => (c.id === id ? previous : c)));
        onError(messageOf(error, 'No se pudo guardar el cambio.'));
      }
    },
    [repository, onError],
  );

  /** Lanza el error para que el formulario lo muestre. */
  const create = useCallback(
    async (candidate: Candidate) => {
      const saved = await repository.create(candidate);
      setData((data) => [...data, saved]);
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await repository.remove(id);
        setData((data) => data.filter((c) => c.id !== id));
      } catch (error) {
        onError(messageOf(error, 'No se pudo eliminar.'));
      }
    },
    [repository, onError],
  );

  const importMany = useCallback(
    async (candidates: Candidate[]) => {
      const saved = await repository.importMany(candidates);
      setData((data) => [...data, ...saved]);
      return saved.length;
    },
    [repository],
  );

  const replaceAll = useCallback(
    async (candidates: Candidate[]) => {
      const saved = await repository.replaceAll(candidates);
      setData(() => saved);
    },
    [repository],
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload, update, create, remove, importMany, replaceAll };
}
