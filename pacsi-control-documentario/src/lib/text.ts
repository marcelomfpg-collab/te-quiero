/** Minúsculas y sin tildes: "Revisión" -> "revision". */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Normalizado y sin separadores: "ABC-123" -> "abc123". Permite buscar placas sin guion. */
export function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

/** Divide la búsqueda en términos; todos deben coincidir (AND). */
export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}
