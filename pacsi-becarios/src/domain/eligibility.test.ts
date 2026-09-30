import { describe, expect, it } from 'vitest';
import { makeCandidate } from '../test/factory';
import { evaluateCandidate } from './eligibility';
import type { Candidate, RequirementId } from './types';

const statusOf = (c: Candidate, id: RequirementId) => evaluateCandidate(c).checks.find((r) => r.id === id)!.status;

describe('evaluateCandidate · requisitos excluyentes del aviso', () => {
  it('un postulante que cumple todo es APTO y sin observaciones', () => {
    const e = evaluateCandidate(makeCandidate());
    expect(e.eligibility).toBe('APTO');
    expect(e.warnings).toEqual([]);
  });

  it.each<[string, Partial<Candidate>, RequirementId]>([
    ['carrera no convocada', { career: 'OTRA', careerName: 'Ing. Civil' }, 'CARRERA'],
    ['cursa 2° año', { studyYear: 2 }, 'ANIO_ESTUDIO'],
    ['cursa 6° año', { studyYear: 6 }, 'ANIO_ESTUDIO'],
    ['sin brevete', { license: 'NINGUNA' }, 'BREVETE'],
    ['sin ofimática certificada', { officeCertified: false }, 'OFIMATICA'],
    ['habilidades blandas < 3', { softSkills: 2 }, 'HABILIDADES_BLANDAS'],
    ['vive fuera de Arequipa', { city: 'Lima' }, 'SEDE_AREQUIPA'],
    ['busca prácticas profesionales', { practiceType: 'PROFESIONAL' }, 'SEDE_AREQUIPA'],
    ['menos de 6 meses de experiencia', { experienceMonths: 5 }, 'EXPERIENCIA'],
    ['experiencia sin certificar', { experienceMonths: 12, experienceCertified: false }, 'EXPERIENCIA'],
    ['CV fuera de plazo', { submittedAt: '2026-11-01' }, 'PLAZO'],
  ])('%s → NO APTO', (_, overrides, requirement) => {
    const c = makeCandidate(overrides);
    expect(statusOf(c, requirement)).toBe('NO_CUMPLE');
    expect(evaluateCandidate(c).eligibility).toBe('NO_APTO');
  });

  it('el brevete no se exige para Administración', () => {
    const c = makeCandidate({ career: 'ADMINISTRACION', license: 'NINGUNA' });
    expect(statusOf(c, 'BREVETE')).toBe('NO_APLICA');
    expect(evaluateCandidate(c).eligibility).toBe('APTO');
  });

  it('acepta A-I, A-IIb y categorías superiores', () => {
    for (const license of ['A_I', 'A_IIA', 'A_IIB', 'A_III'] as const) {
      expect(statusOf(makeCandidate({ license }), 'BREVETE')).toBe('CUMPLE');
    }
  });

  it('la carrera técnica es opcional: no excluye, pero suma 15 puntos', () => {
    const without = evaluateCandidate(makeCandidate({ technicalCareerCertified: false }));
    const withIt = evaluateCandidate(makeCandidate({ technicalCareerCertified: true }));
    expect(without.eligibility).toBe('APTO');
    expect(withIt.score - without.score).toBe(15);
  });

  it('habilidades blandas sin evaluar → POR EVALUAR (no descarta)', () => {
    expect(evaluateCandidate(makeCandidate({ softSkills: null })).eligibility).toBe('POR_EVALUAR');
  });

  it('un incumplimiento excluyente pesa más que una evaluación pendiente', () => {
    expect(evaluateCandidate(makeCandidate({ softSkills: null, license: 'NINGUNA' })).eligibility).toBe('NO_APTO');
  });

  it('el día límite (31/10) todavía está en plazo', () => {
    expect(statusOf(makeCandidate({ submittedAt: '2026-10-31' }), 'PLAZO')).toBe('CUMPLE');
  });

  it('el puntaje va de 0 a 100', () => {
    const max = evaluateCandidate(makeCandidate({ experienceMonths: 30, softSkills: 5, studyYear: 5, technicalCareerCertified: true }));
    expect(max.score).toBe(100);
  });
});

describe('observaciones (no excluyentes)', () => {
  it('asunto del correo con formato incorrecto', () => {
    const e = evaluateCandidate(makeCandidate({ emailSubject: 'Postulación prácticas' }));
    expect(e.eligibility).toBe('APTO');
    expect(e.warnings[0]).toMatch(/formato/);
  });
  it('asunto con el nombre antes que el apellido', () => {
    const e = evaluateCandidate(makeCandidate({ emailSubject: 'BECARIOS 2027 - ANA QUISPE - INGENIERIA INDUSTRIAL' }));
    expect(e.warnings).toContain('En el asunto debe ir primero el apellido');
  });
  it('acepta el asunto sin importar mayúsculas ni tildes', () => {
    const e = evaluateCandidate(makeCandidate({ emailSubject: 'Becarios 2027 - Quispe Zegarra Ana Lucía - Ingeniería Industrial' }));
    expect(e.warnings).toEqual([]);
  });
  it('DNI y correo inválidos', () => {
    const e = evaluateCandidate(makeCandidate({ dni: '1234', email: 'ana' }));
    expect(e.warnings).toEqual(expect.arrayContaining(['DNI con formato inválido', 'Correo electrónico inválido']));
  });
});
