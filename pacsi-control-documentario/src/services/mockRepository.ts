import { todayIso } from '../lib/dates';
import { RepositoryError, type DocumentRepository } from './documentRepository';
import { generateMockDocuments } from './mockData';

interface MockOptions {
  latencyMs?: number;
  /** Fuerza un error para probar la UI de fallo (activable con `?simularError=1`). */
  fail?: boolean;
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

export function createMockRepository({ latencyMs = 700, fail = false }: MockOptions = {}): DocumentRepository {
  const data = generateMockDocuments(todayIso());
  return {
    async list(signal) {
      await wait(latencyMs, signal);
      if (fail) throw new RepositoryError('Error simulado al cargar los documentos.', 503);
      return structuredClone(data);
    },
  };
}
