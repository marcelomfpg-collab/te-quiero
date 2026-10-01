import type { Candidate } from './types';

/** Mayor número de código usado (POS-0042 → 42), para no repetir códigos tras eliminar. */
export function maxCodeNumber(candidates: readonly Pick<Candidate, 'code'>[]): number {
  return candidates.reduce((max, c) => Math.max(max, Number(c.code.match(/(\d+)$/)?.[1] ?? 0)), 0);
}

export function formatCode(n: number): string {
  return `POS-${String(n).padStart(4, '0')}`;
}

export function newId(): string {
  return `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
