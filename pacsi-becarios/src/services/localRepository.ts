import type { Candidate } from '../domain/types';
import { RepositoryError, type CandidateRepository } from './candidateRepository';

const STORAGE_KEY = 'pacsi-becarios-2027a:postulantes';

/**
 * Guarda los postulantes en la propia computadora (localStorage).
 * En el programa de escritorio vive en la carpeta de datos de la aplicación y
 * sobrevive a cerrar y abrir. Para pasar datos a otra PC: copia de seguridad.
 */
export function createLocalRepository(storage: Storage | null = safeStorage()): CandidateRepository {
  let cache: Candidate[] | null = null;

  const load = (): Candidate[] => {
    if (cache) return cache;
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      cache = raw ? (JSON.parse(raw) as Candidate[]) : [];
    } catch {
      cache = [];
    }
    return cache;
  };

  const save = (next: Candidate[]) => {
    cache = next;
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new RepositoryError('No se pudo guardar en esta computadora (almacenamiento lleno o bloqueado).');
    }
  };

  return {
    async list() {
      return [...load()];
    },
    async create(candidate) {
      if (load().some((c) => c.dni === candidate.dni)) throw new RepositoryError(`Ya existe un postulante con DNI ${candidate.dni}.`);
      save([...load(), candidate]);
      return candidate;
    },
    async update(id, patch) {
      const current = load().find((c) => c.id === id);
      if (!current) throw new RepositoryError('El postulante ya no existe.', 404);
      const updated = { ...current, ...patch };
      save(load().map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    async remove(id) {
      save(load().filter((c) => c.id !== id));
    },
    async importMany(candidates) {
      save([...load(), ...candidates]);
      return candidates;
    },
    async replaceAll(candidates) {
      save([...candidates]);
      return candidates;
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
