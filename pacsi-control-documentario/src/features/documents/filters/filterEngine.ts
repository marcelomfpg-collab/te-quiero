import { COMPANIES, DOCUMENT_TYPES, STATUSES, COMPANY_LABEL, DOCUMENT_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '../../../domain/catalogs';
import { computeStatus, daysToExpiry } from '../../../domain/status';
import type { Company, DocumentStatus, DocumentType, FleetDocument } from '../../../domain/types';
import { compact, normalize, tokenize } from '../../../lib/text';
import type { FilterState, SortDir, SortKey } from './filterState';

/**
 * Documento enriquecido con los campos derivados que la UI necesita.
 * Se calcula UNA vez al cargar los datos, no en cada pulsación de tecla.
 */
export interface IndexedDocument {
  doc: FleetDocument;
  status: DocumentStatus;
  daysToExpiry: number;
  /** Texto normalizado de todos los campos buscables. */
  searchText: string;
  /** Igual que searchText pero sin separadores ("abc123" encuentra "ABC-123"). */
  searchCompact: string;
}

export function buildIndex(docs: readonly FleetDocument[], today: string): IndexedDocument[] {
  return docs.map((doc) => {
    const text = [
      doc.code,
      doc.plate,
      doc.number,
      doc.issuer,
      doc.responsible,
      COMPANY_LABEL[doc.company],
      DOCUMENT_TYPE_LABEL[doc.type],
      VEHICLE_TYPE_LABEL[doc.vehicleType],
    ].join(' ');
    return {
      doc,
      status: computeStatus(doc, today),
      daysToExpiry: daysToExpiry(doc, today),
      searchText: normalize(text),
      searchCompact: compact(text),
    };
  });
}

export type Criteria = Pick<FilterState, 'query' | 'statuses' | 'companies' | 'types' | 'dateField' | 'from' | 'to'>;

export interface FacetCounts {
  status: Record<DocumentStatus, number>;
  company: Record<Company, number>;
  type: Record<DocumentType, number>;
}

export interface QueryResult {
  rows: IndexedDocument[];
  facets: FacetCounts;
}

function zeroCounts<T extends string>(options: { value: T }[]): Record<T, number> {
  return Object.fromEntries(options.map((o) => [o.value, 0])) as Record<T, number>;
}

function matchesText(row: IndexedDocument, tokens: string[]): boolean {
  return tokens.every((t) => row.searchText.includes(t) || row.searchCompact.includes(compact(t)));
}

/**
 * Filtra en una sola pasada O(n) y calcula a la vez los conteos por faceta.
 * Cada conteo aplica todos los filtros EXCEPTO el de su propia faceta, así el
 * usuario ve cuántos resultados obtendría al marcar otra opción.
 */
export function runQuery(rows: readonly IndexedDocument[], c: Criteria): QueryResult {
  const tokens = tokenize(c.query);
  const statusSet = new Set(c.statuses);
  const companySet = new Set(c.companies);
  const typeSet = new Set(c.types);

  const facets: FacetCounts = {
    status: zeroCounts(STATUSES),
    company: zeroCounts(COMPANIES),
    type: zeroCounts(DOCUMENT_TYPES),
  };
  const result: IndexedDocument[] = [];

  for (const row of rows) {
    const date = row.doc[c.dateField];
    // Filtros "base" que afectan a todas las facetas.
    if (c.from && date < c.from) continue;
    if (c.to && date > c.to) continue;
    if (tokens.length && !matchesText(row, tokens)) continue;

    const okStatus = statusSet.size === 0 || statusSet.has(row.status);
    const okCompany = companySet.size === 0 || companySet.has(row.doc.company);
    const okType = typeSet.size === 0 || typeSet.has(row.doc.type);

    if (okCompany && okType) facets.status[row.status]++;
    if (okStatus && okType) facets.company[row.doc.company]++;
    if (okStatus && okCompany) facets.type[row.doc.type]++;
    if (okStatus && okCompany && okType) result.push(row);
  }
  return { rows: result, facets };
}

// ---------- Ordenamiento ----------

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Orden por severidad: lo más urgente primero. */
const STATUS_WEIGHT: Record<DocumentStatus, number> = { VENCIDO: 0, POR_VENCER: 1, EN_TRAMITE: 2, VIGENTE: 3 };

const comparators: Record<SortKey, (a: IndexedDocument, b: IndexedDocument) => number> = {
  code: (a, b) => collator.compare(a.doc.code, b.doc.code),
  plate: (a, b) => collator.compare(a.doc.plate, b.doc.plate),
  company: (a, b) => collator.compare(COMPANY_LABEL[a.doc.company], COMPANY_LABEL[b.doc.company]),
  type: (a, b) => collator.compare(DOCUMENT_TYPE_LABEL[a.doc.type], DOCUMENT_TYPE_LABEL[b.doc.type]),
  expiryDate: (a, b) => a.daysToExpiry - b.daysToExpiry,
  status: (a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status],
};

export function sortRows(rows: readonly IndexedDocument[], key: SortKey, dir: SortDir): IndexedDocument[] {
  const factor = dir === 'asc' ? 1 : -1;
  const primary = comparators[key];
  return [...rows].sort(
    (a, b) =>
      primary(a, b) * factor ||
      a.daysToExpiry - b.daysToExpiry ||
      collator.compare(a.doc.code, b.doc.code),
  );
}

// ---------- Paginación ----------

export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  start: number;
  end: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = rows.slice(start, start + pageSize);
  return { items, page: safePage, totalPages, start: rows.length ? start + 1 : 0, end: start + items.length };
}
