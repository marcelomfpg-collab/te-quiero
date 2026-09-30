import { CAREERS, ELIGIBILITIES, REQUIREMENTS, SHIFTS, STAGES, STUDY_YEARS } from '../../../domain/catalogs';
import type { Career, Eligibility, RequirementId, Shift, Stage } from '../../../domain/types';

export type SortKey = 'score' | 'name' | 'career' | 'studyYear' | 'submittedAt' | 'eligibility' | 'stage';
export type SortDir = 'asc' | 'desc';

export interface FilterState {
  query: string;
  eligibility: Eligibility[];
  careers: Career[];
  stages: Stage[];
  years: string[];
  shifts: Shift[];
  /** Postulantes que NO cumplen alguno de estos requisitos (para revisar descartes). */
  failing: RequirementId[];
  onlyWarnings: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [25, 50, 100] as const;
const SORT_KEYS: SortKey[] = ['score', 'name', 'career', 'studyYear', 'submittedAt', 'eligibility', 'stage'];
/** Columnas que por defecto conviene ver de mayor a menor. */
const DESC_BY_DEFAULT: SortKey[] = ['score', 'submittedAt'];

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  eligibility: [],
  careers: [],
  stages: [],
  years: [],
  shifts: [],
  failing: [],
  onlyWarnings: false,
  /** Por defecto: aptos primero y, dentro de cada grupo, mayor puntaje. */
  sortKey: 'eligibility',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
};

// ---------- URL (vistas compartibles, persistentes al recargar) ----------

type ListKey = 'eligibility' | 'careers' | 'stages' | 'years' | 'shifts' | 'failing';

const LIST_PARAMS: { key: ListKey; param: string; options: { value: string }[] }[] = [
  { key: 'eligibility', param: 'elegibilidad', options: ELIGIBILITIES },
  { key: 'careers', param: 'carrera', options: CAREERS },
  { key: 'stages', param: 'etapa', options: STAGES },
  { key: 'years', param: 'anio', options: STUDY_YEARS },
  { key: 'shifts', param: 'turno', options: SHIFTS },
  { key: 'failing', param: 'noCumple', options: REQUIREMENTS },
];

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parseFilters(search: string): FilterState {
  const p = new URLSearchParams(search);
  const d = DEFAULT_FILTERS;
  const state: FilterState = { ...d, query: p.get('q') ?? '', onlyWarnings: p.get('observados') === '1' };
  for (const { key, param, options } of LIST_PARAMS) {
    const valid = new Set(options.map((o) => o.value));
    (state[key] as string[]) = (p.get(param) ?? '').split(',').filter((v) => valid.has(v));
  }
  const sortKey = p.get('orden') as SortKey | null;
  if (sortKey && SORT_KEYS.includes(sortKey)) state.sortKey = sortKey;
  const dir = p.get('dir');
  state.sortDir = dir === 'asc' || dir === 'desc' ? dir : DESC_BY_DEFAULT.includes(state.sortKey) ? 'desc' : 'asc';
  state.page = parsePositiveInt(p.get('pag'), d.page);
  const size = parsePositiveInt(p.get('tam'), d.pageSize);
  state.pageSize = (PAGE_SIZES as readonly number[]).includes(size) ? size : d.pageSize;
  return state;
}

/** Solo escribe en la URL lo que difiere del estado por defecto. */
export function serializeFilters(s: FilterState): string {
  const d = DEFAULT_FILTERS;
  const p = new URLSearchParams();
  if (s.query.trim()) p.set('q', s.query.trim());
  for (const { key, param } of LIST_PARAMS) if (s[key].length) p.set(param, s[key].join(','));
  if (s.onlyWarnings) p.set('observados', '1');
  if (s.sortKey !== d.sortKey) p.set('orden', s.sortKey);
  if (s.sortDir !== (DESC_BY_DEFAULT.includes(s.sortKey) ? 'desc' : 'asc')) p.set('dir', s.sortDir);
  if (s.page !== d.page) p.set('pag', String(s.page));
  if (s.pageSize !== d.pageSize) p.set('tam', String(s.pageSize));
  return p.toString();
}

// ---------- Reducer ----------

export type FilterAction =
  | { type: 'setQuery'; query: string }
  | { type: 'setList'; key: ListKey; values: string[] }
  | { type: 'toggle'; key: ListKey; value: string }
  | { type: 'setOnlyWarnings'; value: boolean }
  | { type: 'sortBy'; key: SortKey }
  | { type: 'setPage'; page: number }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'reset' }
  | { type: 'replace'; state: FilterState };

export type { ListKey };

/** Cualquier cambio de criterio vuelve a la página 1 para no mostrar páginas vacías. */
export function filtersReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'setQuery':
      return { ...state, query: action.query, page: 1 };
    case 'setList':
      return { ...state, [action.key]: action.values, page: 1 };
    case 'toggle': {
      const list = state[action.key] as string[];
      const values = list.includes(action.value) ? list.filter((v) => v !== action.value) : [...list, action.value];
      return { ...state, [action.key]: values, page: 1 };
    }
    case 'setOnlyWarnings':
      return { ...state, onlyWarnings: action.value, page: 1 };
    case 'sortBy':
      return state.sortKey === action.key
        ? { ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...state, sortKey: action.key, sortDir: DESC_BY_DEFAULT.includes(action.key) ? 'desc' : 'asc', page: 1 };
    case 'setPage':
      return { ...state, page: Math.max(1, action.page) };
    case 'setPageSize':
      return { ...state, pageSize: action.pageSize, page: 1 };
    case 'reset':
      return { ...DEFAULT_FILTERS, pageSize: state.pageSize };
    case 'replace':
      return action.state;
  }
}

export function countActiveFilters(s: FilterState): number {
  return (s.query.trim() ? 1 : 0) + LIST_PARAMS.reduce((n, { key }) => n + s[key].length, 0) + (s.onlyWarnings ? 1 : 0);
}
