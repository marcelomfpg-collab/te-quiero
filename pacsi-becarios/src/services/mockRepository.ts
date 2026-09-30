import type { Candidate } from '../domain/types';
import { todayIso } from '../lib/dates';
import { RepositoryError, type CandidatePatch, type CandidateRepository } from './candidateRepository';
import { generateMockCandidates } from './mockData';

const STORAGE_KEY = 'pacsi-becarios-2027a';

interface Stored {
  patches: Record<string, CandidatePatch>;
  imported: Candidate[];
}

/** localStorage puede no estar disponible (modo privado, bloqueado): nunca debe romper la app. */
function readStore(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* sin persistencia */
  }
  return { patches: {}, imported: [] };
}

function writeStore(store: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* sin persistencia */
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** Repositorio de demostración: datos generados + cambios del usuario guardados en el navegador. */
export function createMockRepository({ latencyMs = 600, fail = false } = {}): CandidateRepository {
  const seed = generateMockCandidates(todayIso());
  const store = readStore();

  const all = (): Candidate[] => [...seed, ...store.imported].map((c) => ({ ...c, ...store.patches[c.id] }));

  return {
    async list(signal) {
      await wait(latencyMs, signal);
      if (fail) throw new RepositoryError('Error simulado al cargar los postulantes.', 503);
      return all();
    },
    async update(id, patch) {
      await wait(150);
      const current = all().find((c) => c.id === id);
      if (!current) throw new RepositoryError('El postulante ya no existe.', 404);
      store.patches[id] = { ...store.patches[id], ...patch };
      writeStore(store);
      return { ...current, ...patch };
    },
    async importMany(candidates) {
      await wait(300);
      store.imported.push(...candidates);
      writeStore(store);
      return candidates;
    },
  };
}

export function clearMockStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada que limpiar */
  }
}
