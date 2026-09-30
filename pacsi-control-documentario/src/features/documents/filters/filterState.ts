import { COMPANIES, DOCUMENT_TYPES, STATUSES } from '../../../domain/catalogs';
import type { Company, DocumentStatus, DocumentType } from '../../../domain/types';
import { isIsoDate } from '../../../lib/dates';

export type SortKey = 'code' | 'plate' | 'company' | 'type' | 'expiryDate' | 'status';
export type SortDir = 'asc' | 'desc';
export type DateField = 'expiryDate' | 'issueDate';

export interface FilterState {
  query: string;
  statuses: DocumentStatus[];
  companies: Company[];
  types: DocumentType[];
  dateField: DateField;
  from: string | null;
  to: string | null;
  sortKey: SortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [25, 50, 100] as const;
const SORT_KEYS: SortKey[] = ['code', 'plate', 'company', 'type', 'expiryDate', 'status'];

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  statuses: [],
  companies: [],
  types: [],
  dateField: 'expiryDate',
  from: null,
  to: null,
  sortKey: 'expiryDate',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
};

// ---------- Serialización a URL (filtros compartibles y persistentes al recargar) ----------

function parseList<T extends string>(raw: string | null, allowed: { value: T }[]): T[] {
  if (!raw) return [];
  const valid = new Set(allowed.map((o) => o.value));
  return raw.split(',').filter((v): v is T => valid.has(v as T));
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parseFilters(search: string): FilterState {
  const p = new URLSearchParams(search);
  const d = DEFAULT_FILTERS;
  const sortKey = p.get('orden') as SortKey | null;
  const pageSize = parsePositiveInt(p.get('tam'), d.pageSize);
  return {
    query: p.get('q') ?? d.query,
    statuses: parseList(p.get('estado'), STATUSES),
    companies: parseList(p.get('empresa'), COMPANIES),
    types: parseList(p.get('tipo'), DOCUMENT_TYPES),
    dateField: p.get('campoFecha') === 'issueDate' ? 'issueDate' : d.dateField,
    from: isIsoDate(p.get('desde')) ? p.get('desde') : null,
    to: isIsoDate(p.get('hasta')) ? p.get('hasta') : null,
    sortKey: sortKey && SORT_KEYS.includes(sortKey) ? sortKey : d.sortKey,
    sortDir: p.get('dir') === 'desc' ? 'desc' : 'asc',
    page: parsePositiveInt(p.get('pag'), d.page),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : d.pageSize,
  };
}

/** Solo escribe en la URL los valores que difieren del estado por defecto. */
export function serializeFilters(s: FilterState): string {
  const d = DEFAULT_FILTERS;
  const p = new URLSearchParams();
  if (s.query.trim()) p.set('q', s.query.trim());
  if (s.statuses.length) p.set('estado', s.statuses.join(','));
  if (s.companies.length) p.set('empresa', s.companies.join(','));
  if (s.types.length) p.set('tipo', s.types.join(','));
  if (s.dateField !== d.dateField) p.set('campoFecha', s.dateField);
  if (s.from) p.set('desde', s.from);
  if (s.to) p.set('hasta', s.to);
  if (s.sortKey !== d.sortKey) p.set('orden', s.sortKey);
  if (s.sortDir !== d.sortDir) p.set('dir', s.sortDir);
  if (s.page !== d.page) p.set('pag', String(s.page));
  if (s.pageSize !== d.pageSize) p.set('tam', String(s.pageSize));
  return p.toString();
}

// ---------- Reducer ----------

export type FilterAction =
  | { type: 'setQuery'; query: string }
  | { type: 'toggleStatus'; value: DocumentStatus }
  | { type: 'setStatuses'; values: DocumentStatus[] }
  | { type: 'setCompanies'; values: Company[] }
  | { type: 'setTypes'; values: DocumentType[] }
  | { type: 'setDateRange'; field: DateField; from: string | null; to: string | null }
  | { type: 'sortBy'; key: SortKey }
  | { type: 'setPage'; page: number }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'reset' }
  | { type: 'replace'; state: FilterState };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Cualquier cambio de criterio vuelve a la página 1 para no mostrar páginas vacías. */
export function filtersReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'setQuery':
      return { ...state, query: action.query, page: 1 };
    case 'toggleStatus':
      return { ...state, statuses: toggle(state.statuses, action.value), page: 1 };
    case 'setStatuses':
      return { ...state, statuses: action.values, page: 1 };
    case 'setCompanies':
      return { ...state, companies: action.values, page: 1 };
    case 'setTypes':
      return { ...state, types: action.values, page: 1 };
    case 'setDateRange': {
      // Si el usuario invierte el rango, lo corregimos en lugar de devolver cero resultados.
      const swap = action.from && action.to && action.from > action.to;
      return {
        ...state,
        dateField: action.field,
        from: swap ? action.to : action.from,
        to: swap ? action.from : action.to,
        page: 1,
      };
    }
    case 'sortBy':
      return state.sortKey === action.key
        ? { ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...state, sortKey: action.key, sortDir: 'asc', page: 1 };
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
  return (
    (s.query.trim() ? 1 : 0) +
    s.statuses.length +
    s.companies.length +
    s.types.length +
    (s.from || s.to ? 1 : 0)
  );
}
