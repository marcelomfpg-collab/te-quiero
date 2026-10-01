import { CAREER_LABEL, CAREERS, ELIGIBILITIES, REQUIREMENTS, SHIFTS, STAGES, STUDY_YEARS } from '../../../domain/catalogs';
import { defaultCareerRules, type CareerRules } from '../../../domain/careerRules';
import { evaluateCandidate } from '../../../domain/eligibility';
import type { Candidate, Eligibility, Evaluation, RequirementId, Stage } from '../../../domain/types';
import { compact, normalize, tokenize } from '../../../lib/text';
import type { FilterState, SortDir, SortKey } from './filterState';

/**
 * Postulante + evaluación precalculada. Se construye UNA vez por cambio de datos,
 * no en cada pulsación de tecla.
 */
export interface IndexedCandidate {
  candidate: Candidate;
  evaluation: Evaluation;
  fullName: string;
  failing: RequirementId[];
  searchText: string;
  searchCompact: string;
}

export function buildIndex(candidates: readonly Candidate[], rules: CareerRules = defaultCareerRules()): IndexedCandidate[] {
  const dniCount = new Map<string, number>();
  for (const c of candidates) dniCount.set(c.dni, (dniCount.get(c.dni) ?? 0) + 1);

  return candidates.map((candidate) => {
    const evaluation = evaluateCandidate(candidate, rules);
    if ((dniCount.get(candidate.dni) ?? 0) > 1) evaluation.warnings.push('DNI duplicado: postuló más de una vez');
    const fullName = `${candidate.lastNames}, ${candidate.firstNames}`;
    const text = [candidate.code, fullName, candidate.firstNames, candidate.dni, candidate.email, candidate.phone, candidate.university, candidate.careerName, candidate.city].join(' ');
    return {
      candidate,
      evaluation,
      fullName,
      failing: evaluation.checks.filter((c) => c.status === 'NO_CUMPLE').map((c) => c.id),
      searchText: normalize(text),
      searchCompact: compact(text),
    };
  });
}

// ---------- Facetas ----------

type FacetKey = 'eligibility' | 'careers' | 'stages' | 'years' | 'shifts' | 'failing';

/** Qué valores aporta cada postulante a cada faceta. */
const FACET_VALUES: Record<FacetKey, (r: IndexedCandidate) => readonly string[]> = {
  eligibility: (r) => [r.evaluation.eligibility],
  careers: (r) => [r.candidate.career],
  stages: (r) => [r.candidate.stage],
  years: (r) => [String(r.candidate.studyYear)],
  shifts: (r) => [r.candidate.shift],
  failing: (r) => r.failing,
};
const FACET_KEYS = Object.keys(FACET_VALUES) as FacetKey[];
const FACET_OPTIONS: Record<FacetKey, { value: string }[]> = {
  eligibility: ELIGIBILITIES,
  careers: CAREERS,
  stages: STAGES,
  years: STUDY_YEARS,
  shifts: SHIFTS,
  failing: REQUIREMENTS,
};

export type FacetCounts = Record<FacetKey, Record<string, number>>;
export type Criteria = Pick<FilterState, 'query' | 'onlyWarnings' | FacetKey>;

export interface QueryResult {
  rows: IndexedCandidate[];
  facets: FacetCounts;
}

function matchesText(row: IndexedCandidate, tokens: string[]): boolean {
  return tokens.every((t) => row.searchText.includes(t) || row.searchCompact.includes(compact(t)));
}

/**
 * Filtra en una sola pasada y calcula a la vez los conteos de cada faceta.
 * Cada conteo aplica todos los filtros EXCEPTO el de su propia faceta: así cada
 * opción muestra cuántos resultados daría al marcarla.
 */
export function runQuery(rows: readonly IndexedCandidate[], c: Criteria): QueryResult {
  const tokens = tokenize(c.query);
  const selected = FACET_KEYS.map((k) => [k, new Set<string>(c[k])] as const);
  const facets = Object.fromEntries(
    FACET_KEYS.map((k) => [k, Object.fromEntries(FACET_OPTIONS[k].map((o) => [o.value, 0]))]),
  ) as FacetCounts;
  const result: IndexedCandidate[] = [];

  for (const row of rows) {
    if (c.onlyWarnings && row.evaluation.warnings.length === 0) continue;
    if (tokens.length && !matchesText(row, tokens)) continue;

    let failedFacet: FacetKey | null = null;
    let failures = 0;
    for (const [key, set] of selected) {
      if (set.size && !FACET_VALUES[key](row).some((v) => set.has(v))) {
        failedFacet = key;
        if (++failures > 1) break;
      }
    }
    if (failures > 1) continue;

    // 0 fallos: suma en todas las facetas. 1 fallo: solo en la faceta que falló.
    for (const key of failures === 0 ? FACET_KEYS : [failedFacet!]) {
      for (const v of FACET_VALUES[key](row)) facets[key][v] = (facets[key][v] ?? 0) + 1;
    }
    if (failures === 0) result.push(row);
  }
  return { rows: result, facets };
}

// ---------- Ordenamiento ----------

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const ELIGIBILITY_WEIGHT: Record<Eligibility, number> = { APTO: 0, POR_EVALUAR: 1, NO_APTO: 2 };
const STAGE_WEIGHT: Record<Stage, number> = { SELECCIONADO: 0, ENTREVISTA: 1, EN_EVALUACION: 2, RECIBIDO: 3, DESCARTADO: 4 };

const comparators: Record<SortKey, (a: IndexedCandidate, b: IndexedCandidate) => number> = {
  score: (a, b) => a.evaluation.score - b.evaluation.score,
  name: (a, b) => collator.compare(a.fullName, b.fullName),
  career: (a, b) => collator.compare(CAREER_LABEL[a.candidate.career], CAREER_LABEL[b.candidate.career]),
  studyYear: (a, b) => a.candidate.studyYear - b.candidate.studyYear,
  submittedAt: (a, b) => a.candidate.submittedAt.localeCompare(b.candidate.submittedAt),
  eligibility: (a, b) => ELIGIBILITY_WEIGHT[a.evaluation.eligibility] - ELIGIBILITY_WEIGHT[b.evaluation.eligibility],
  stage: (a, b) => STAGE_WEIGHT[a.candidate.stage] - STAGE_WEIGHT[b.candidate.stage],
};

/** Desempate estable: primero los aptos, luego mayor puntaje, luego nombre. */
export function sortRows(rows: readonly IndexedCandidate[], key: SortKey, dir: SortDir): IndexedCandidate[] {
  const factor = dir === 'asc' ? 1 : -1;
  const primary = comparators[key];
  return [...rows].sort(
    (a, b) =>
      primary(a, b) * factor ||
      comparators.eligibility(a, b) ||
      b.evaluation.score - a.evaluation.score ||
      comparators.name(a, b),
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
