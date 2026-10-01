import { describe, expect, it } from 'vitest';
import { makeCandidate } from '../test/factory';
import { defaultCareerRules, formatYears, normalizeRules, type CareerRules } from './careerRules';
import { evaluateCandidate } from './eligibility';

const statusOf = (rules: CareerRules, over: Parameters<typeof makeCandidate>[0], id: string) =>
  evaluateCandidate(makeCandidate(over), rules).checks.find((c) => c.id === id)!;

describe('requisitos por carrera', () => {
  it('por defecto respeta el aviso: Administración no necesita brevete, las ingenierías sí', () => {
    const r = defaultCareerRules();
    expect(statusOf(r, { career: 'ADMINISTRACION', license: 'NINGUNA' }, 'BREVETE')).toMatchObject({ status: 'NO_APLICA', mandatory: false });
    expect(evaluateCandidate(makeCandidate({ career: 'INDUSTRIAL', license: 'NINGUNA' }), r).eligibility).toBe('NO_APTO');
  });

  it('un requisito marcado como OPCIONAL informa pero no descarta', () => {
    const r = defaultCareerRules();
    r.COMERCIAL.levels.EXPERIENCIA = 'OPCIONAL';
    const c = makeCandidate({ career: 'COMERCIAL', experienceMonths: 0, experienceCertified: false });
    const e = evaluateCandidate(c, r);
    expect(e.checks.find((x) => x.id === 'EXPERIENCIA')).toMatchObject({ status: 'NO_CUMPLE', mandatory: false });
    expect(e.eligibility).toBe('APTO');
  });

  it('NO APLICA hace que el requisito no se pida a esa carrera', () => {
    const r = defaultCareerRules();
    r.ADMINISTRACION.levels.SEDE_AREQUIPA = 'NO_APLICA';
    expect(evaluateCandidate(makeCandidate({ career: 'ADMINISTRACION', license: 'NINGUNA', city: 'Lima' }), r).eligibility).toBe('APTO');
  });

  it('años y experiencia mínima propios de cada carrera', () => {
    const r = defaultCareerRules();
    r.ELECTRICA.studyYears = [4, 5];
    r.ELECTRICA.minExperienceMonths = 0;
    expect(statusOf(r, { career: 'ELECTRICA', studyYear: 3 }, 'ANIO_ESTUDIO')).toMatchObject({ status: 'NO_CUMPLE', detail: expect.stringContaining('4° y 5°') });
    expect(statusOf(r, { career: 'ELECTRICA', experienceMonths: 0, experienceCertified: false }, 'EXPERIENCIA').status).toBe('CUMPLE');
    // Las demás carreras no cambian
    expect(statusOf(r, { career: 'INDUSTRIAL', studyYear: 3 }, 'ANIO_ESTUDIO').status).toBe('CUMPLE');
  });

  it('un dato no encontrado en un requisito opcional no deja al postulante "por revisar"', () => {
    const r = defaultCareerRules();
    r.MECANICA_MECATRONICA.levels.OFIMATICA = 'OPCIONAL';
    const e = evaluateCandidate(makeCandidate({ career: 'MECANICA_MECATRONICA', missing: ['officeCertified'] }), r);
    expect(e.eligibility).toBe('APTO');
  });

  it('una carrera no convocada sigue siendo no apta aunque se relajen los requisitos', () => {
    const r = defaultCareerRules();
    expect(evaluateCandidate(makeCandidate({ career: 'OTRA', careerName: 'Ing. Civil' }), r).eligibility).toBe('NO_APTO');
  });
});

describe('normalizeRules / formatYears', () => {
  it('completa reglas guardadas incompletas o manipuladas con los valores del aviso', () => {
    const r = normalizeRules({ COMERCIAL: { levels: { BREVETE: 'OPCIONAL', OFIMATICA: 'X' }, studyYears: [9, 4], minExperienceMonths: -3 } });
    expect(r.COMERCIAL.levels).toMatchObject({ BREVETE: 'OPCIONAL', OFIMATICA: 'EXCLUYENTE' });
    expect(r.COMERCIAL.studyYears).toEqual([4]);
    expect(r.COMERCIAL.minExperienceMonths).toBe(6);
    expect(normalizeRules('basura')).toEqual(defaultCareerRules());
  });
  it('describe los años en español', () => {
    expect(formatYears([3, 4, 5])).toBe('3° a 5°');
    expect(formatYears([4, 5])).toBe('4° y 5°');
    expect(formatYears([3, 5])).toBe('3° y 5°');
  });
});

describe('valores por defecto más flexibles para Administración y Comercial', () => {
  const r = defaultCareerRules();
  it('Comercial: sin brevete ni experiencia sigue siendo APTO', () => {
    const e = evaluateCandidate(makeCandidate({ career: 'COMERCIAL', license: 'NINGUNA', experienceMonths: 0, experienceCertified: false }), r);
    expect(e.eligibility).toBe('APTO');
    expect(e.checks.find((c) => c.id === 'BREVETE')).toMatchObject({ status: 'NO_CUMPLE', mandatory: false });
  });
  it('Administración: brevete no aplica y la experiencia es opcional', () => {
    const e = evaluateCandidate(makeCandidate({ career: 'ADMINISTRACION', license: 'NINGUNA', experienceMonths: 2, experienceCertified: false }), r);
    expect(e.eligibility).toBe('APTO');
  });
  it('pero Excel certificado y vivir en Arequipa siguen siendo excluyentes', () => {
    expect(evaluateCandidate(makeCandidate({ career: 'COMERCIAL', officeCertified: false }), r).eligibility).toBe('NO_APTO');
    expect(evaluateCandidate(makeCandidate({ career: 'ADMINISTRACION', city: 'Lima' }), r).eligibility).toBe('NO_APTO');
  });
  it('las ingenierías técnicas mantienen el aviso completo', () => {
    expect(evaluateCandidate(makeCandidate({ career: 'ELECTRICA', experienceMonths: 0, experienceCertified: false }), r).eligibility).toBe('NO_APTO');
  });
});
