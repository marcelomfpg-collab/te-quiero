import type { Career, License } from './types';

/**
 * Parámetros de la convocatoria "Becarios PACSI 2027-A" tomados del aviso oficial.
 * Para una nueva convocatoria basta con cambiar este objeto.
 */
export const CONVOCATORIA = {
  name: 'Becarios PACSI 2027-A',
  email: 'reclutamiento@pacsiingenieros.com',
  subjectFormat: 'BECARIOS 2027 - APELLIDO Y NOMBRE - CARRERA PROFESIONAL',
  subjectPrefix: 'BECARIOS 2027',
  deadline: '2026-10-31',
  phases: [
    { id: 'RECEPCION', label: 'Recepción de CVs', from: null, to: '2026-10-31' },
    { id: 'EVALUACION', label: 'Evaluación de CVs', from: '2026-11-02', to: '2026-11-20' },
    { id: 'ENTREVISTAS', label: 'Entrevistas', from: '2026-11-23', to: '2026-12-11' },
    { id: 'RESULTADOS', label: 'Resultados', from: '2026-12-15', to: '2026-12-15' },
  ],
  careers: ['MECANICA_MECATRONICA', 'ELECTRICA', 'INDUSTRIAL', 'COMERCIAL', 'ADMINISTRACION'] as Career[],
  studyYears: [3, 4, 5] as number[],
  /**
   * El aviso pide "Brevete AI o AIIB". Las categorías superiores (AIIa, AIII) exigen haber
   * tenido la A-I, así que también se aceptan. Ajustable aquí si RR. HH. decide otra cosa.
   */
  licenses: ['A_I', 'A_IIA', 'A_IIB', 'A_III'] as License[],
  licenseExemptCareers: ['ADMINISTRACION'] as Career[],
  city: 'Arequipa',
  minExperienceMonths: 6,
  minSoftSkills: 3,
} as const;

export type Phase = (typeof CONVOCATORIA.phases)[number];

/** Fase vigente para una fecha (la última cuyo inicio ya pasó). */
export function currentPhase(today: string): Phase['id'] {
  let current: Phase['id'] = 'RECEPCION';
  for (const phase of CONVOCATORIA.phases) {
    if (phase.from && today >= phase.from) current = phase.id;
  }
  return current;
}
