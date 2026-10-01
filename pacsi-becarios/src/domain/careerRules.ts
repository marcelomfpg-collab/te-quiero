import { CONVOCATORIA } from './convocatoria';
import type { Career, RequirementId } from './types';

/**
 * Qué tan estricto es un requisito para una carrera.
 * REVISAR: si no lo cumple no se descarta; queda "Por revisar" con el comentario de lo que le falta.
 */
export type RuleLevel = 'EXCLUYENTE' | 'REVISAR' | 'OPCIONAL' | 'NO_APLICA';

/** Requisitos que RR. HH. puede ajustar por carrera (plazo y carrera convocada siempre son excluyentes). */
export const CONFIGURABLE_REQUIREMENTS = [
  'ANIO_ESTUDIO',
  'BREVETE',
  'OFIMATICA',
  'EXPERIENCIA',
  'SEDE_AREQUIPA',
  'HABILIDADES_BLANDAS',
  'CARRERA_TECNICA',
] as const satisfies readonly RequirementId[];

export type ConfigurableRequirement = (typeof CONFIGURABLE_REQUIREMENTS)[number];

export interface CareerRule {
  levels: Record<ConfigurableRequirement, RuleLevel>;
  /** Años de carrera aceptados (p. ej. [3, 4, 5]). */
  studyYears: number[];
  minExperienceMonths: number;
}

/** Carreras convocadas con reglas propias. "Otra carrera" nunca es apta. */
export type ConvokedCareer = Exclude<Career, 'OTRA'>;
export type CareerRules = Record<ConvokedCareer, CareerRule>;

function rule(overrides: Partial<Record<ConfigurableRequirement, RuleLevel>> = {}): CareerRule {
  return {
    levels: {
      ANIO_ESTUDIO: 'EXCLUYENTE',
      BREVETE: 'EXCLUYENTE',
      OFIMATICA: 'EXCLUYENTE',
      EXPERIENCIA: 'EXCLUYENTE',
      SEDE_AREQUIPA: 'EXCLUYENTE',
      HABILIDADES_BLANDAS: 'EXCLUYENTE',
      CARRERA_TECNICA: 'OPCIONAL',
      ...overrides,
    },
    studyYears: [...CONVOCATORIA.studyYears],
    minExperienceMonths: CONVOCATORIA.minExperienceMonths,
  };
}

/**
 * Requisitos por defecto. Ingenierías técnicas: como el aviso (todo excluyente, carrera técnica opcional).
 * Administración y Comercial: más flexibles por decisión de RR. HH.: si les falta brevete o experiencia
 * no se descartan, quedan "Por revisar" con el comentario de lo que les falta.
 */
export function defaultCareerRules(): CareerRules {
  return {
    MECANICA_MECATRONICA: rule(),
    ELECTRICA: rule(),
    INDUSTRIAL: rule(),
    COMERCIAL: rule({ BREVETE: 'REVISAR', EXPERIENCIA: 'REVISAR' }),
    ADMINISTRACION: rule({ BREVETE: 'NO_APLICA', EXPERIENCIA: 'REVISAR' }),
  };
}

export function ruleFor(rules: CareerRules, career: Career): CareerRule {
  return career === 'OTRA' ? rule() : rules[career];
}

/** Completa reglas guardadas antiguas o incompletas con los valores del aviso. */
export function normalizeRules(input: unknown): CareerRules {
  const base = defaultCareerRules();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<Record<ConvokedCareer, Partial<CareerRule>>>;
  for (const career of Object.keys(base) as ConvokedCareer[]) {
    const r = raw[career];
    if (!r) continue;
    const levels = { ...base[career].levels };
    for (const id of CONFIGURABLE_REQUIREMENTS) {
      const v = r.levels?.[id];
      if (v === 'EXCLUYENTE' || v === 'REVISAR' || v === 'OPCIONAL' || v === 'NO_APLICA') levels[id] = v;
    }
    const years = Array.isArray(r.studyYears) ? r.studyYears.filter((y) => Number.isInteger(y) && y >= 1 && y <= 7) : null;
    const months = Number(r.minExperienceMonths);
    base[career] = {
      levels,
      studyYears: years?.length ? years.sort((a, b) => a - b) : base[career].studyYears,
      minExperienceMonths: Number.isFinite(months) && months >= 0 ? Math.round(months) : base[career].minExperienceMonths,
    };
  }
  return base;
}

export function sameRules(a: CareerRules, b: CareerRules): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "3° a 5°", "4° y 5°" o "3°, 5°". */
export function formatYears(years: number[]): string {
  if (!years.length) return 'ninguno';
  const consecutive = years.every((y, i) => i === 0 || y === years[i - 1]! + 1);
  if (years.length === 1) return `${years[0]}°`;
  if (consecutive && years.length > 2) return `${years[0]}° a ${years[years.length - 1]}°`;
  return `${years.slice(0, -1).map((y) => `${y}°`).join(', ')} y ${years[years.length - 1]}°`;
}
