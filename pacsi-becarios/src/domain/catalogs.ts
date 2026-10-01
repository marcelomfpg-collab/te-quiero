import type { Career, Eligibility, License, PracticeType, RequirementId, Shift, Stage } from './types';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const CAREERS: Option<Career>[] = [
  { value: 'MECANICA_MECATRONICA', label: 'Ing. Mecánica / Mecatrónica' },
  { value: 'ELECTRICA', label: 'Ing. Eléctrica' },
  { value: 'INDUSTRIAL', label: 'Ing. Industrial' },
  { value: 'COMERCIAL', label: 'Ing. Comercial' },
  { value: 'ADMINISTRACION', label: 'Administración' },
  { value: 'OTRA', label: 'Otra carrera (fuera de perfil)' },
];

export const LICENSES: Option<License>[] = [
  { value: 'NINGUNA', label: 'Sin brevete' },
  { value: 'A_I', label: 'A-I' },
  { value: 'A_IIA', label: 'A-IIa' },
  { value: 'A_IIB', label: 'A-IIb' },
  { value: 'A_III', label: 'A-III' },
];

export const SHIFTS: Option<Shift>[] = [
  { value: 'DIA', label: 'Turno día' },
  { value: 'TARDE', label: 'Turno tarde' },
  { value: 'MIXTO', label: 'Mixto' },
];

export const PRACTICE_TYPES: Option<PracticeType>[] = [
  { value: 'PREPROFESIONAL', label: 'Preprofesional' },
  { value: 'PROFESIONAL', label: 'Profesional' },
];

export const STAGES: Option<Stage>[] = [
  { value: 'RECIBIDO', label: 'Recibido' },
  { value: 'EN_EVALUACION', label: 'En evaluación' },
  { value: 'ENTREVISTA', label: 'Entrevista' },
  { value: 'SELECCIONADO', label: 'Seleccionado' },
  { value: 'DESCARTADO', label: 'Descartado' },
];

export const ELIGIBILITIES: Option<Eligibility>[] = [
  { value: 'APTO', label: 'Apto' },
  { value: 'POR_EVALUAR', label: 'Por revisar' },
  { value: 'NO_APTO', label: 'No apto' },
];

export const REQUIREMENTS: Option<RequirementId>[] = [
  { value: 'PLAZO', label: 'Postuló dentro del plazo' },
  { value: 'CARRERA', label: 'Carrera convocada' },
  { value: 'ANIO_ESTUDIO', label: 'Cursa 3er, 4to o 5to año' },
  { value: 'BREVETE', label: 'Brevete A-I / A-IIb' },
  { value: 'CARRERA_TECNICA', label: 'Carrera técnica certificada (opcional)' },
  { value: 'OFIMATICA', label: 'Ofimática / Excel certificado' },
  { value: 'HABILIDADES_BLANDAS', label: 'Habilidades blandas' },
  { value: 'SEDE_AREQUIPA', label: 'Prácticas preprofesionales en Arequipa' },
  { value: 'EXPERIENCIA', label: 'Experiencia ≥ 6 meses certificada' },
];

export const STUDY_YEARS: Option<string>[] = [1, 2, 3, 4, 5, 6].map((y) => ({ value: String(y), label: `${y}° año` }));

function toLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;
}

export const CAREER_LABEL = toLabelMap(CAREERS);
export const LICENSE_LABEL = toLabelMap(LICENSES);
export const SHIFT_LABEL = toLabelMap(SHIFTS);
export const PRACTICE_TYPE_LABEL = toLabelMap(PRACTICE_TYPES);
export const STAGE_LABEL = toLabelMap(STAGES);
export const ELIGIBILITY_LABEL = toLabelMap(ELIGIBILITIES);
export const REQUIREMENT_LABEL = toLabelMap(REQUIREMENTS);

/** Etiqueta corta para los indicadores compactos de la tabla. */
export const REQUIREMENT_SHORT: Record<RequirementId, string> = {
  PLAZO: 'Plazo',
  CARRERA: 'Carrera',
  ANIO_ESTUDIO: 'Año',
  BREVETE: 'Brevete',
  CARRERA_TECNICA: 'Técnica',
  OFIMATICA: 'Ofimática',
  HABILIDADES_BLANDAS: 'H. blandas',
  SEDE_AREQUIPA: 'Arequipa',
  EXPERIENCIA: 'Experiencia',
};
