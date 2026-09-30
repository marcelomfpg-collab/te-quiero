import { describe, expect, it } from 'vitest';
import { makeCandidate } from '../../../test/factory';
import { buildIndex, paginate, runQuery, sortRows } from './filterEngine';
import { DEFAULT_FILTERS, type FilterState } from './filterState';

const index = buildIndex([
  makeCandidate({ id: 'a', firstNames: 'Ana', lastNames: 'Quispe', dni: '11111111', career: 'INDUSTRIAL', experienceMonths: 24 }), // apto, alto puntaje
  makeCandidate({ id: 'b', firstNames: 'Luis', lastNames: 'Mamani', dni: '22222222', career: 'ELECTRICA', license: 'NINGUNA', emailSubject: 'BECARIOS 2027 - MAMANI LUIS - INGENIERIA ELECTRICA' }), // no apto (brevete)
  makeCandidate({ id: 'c', firstNames: 'José', lastNames: 'Huamán', dni: '33333333', career: 'ADMINISTRACION', softSkills: null, university: 'UCSM' }), // por evaluar
  makeCandidate({ id: 'd', firstNames: 'Rosa', lastNames: 'Apaza', dni: '33333333', career: 'OTRA', careerName: 'Ing. Civil', city: 'Lima' }), // no apto x2, DNI duplicado
]);

const q = (over: Partial<FilterState> = {}) => runQuery(index, { ...DEFAULT_FILTERS, ...over });
const ids = (rows: { candidate: { id: string } }[]) => rows.map((r) => r.candidate.id);

describe('runQuery', () => {
  it('busca sin tildes, por DNI y por universidad', () => {
    expect(ids(q({ query: 'huaman' }).rows)).toEqual(['c']);
    expect(ids(q({ query: '2222' }).rows)).toEqual(['b']);
    expect(ids(q({ query: 'ucsm' }).rows)).toEqual(['c']);
  });

  it('filtra por elegibilidad y carrera', () => {
    expect(ids(q({ eligibility: ['NO_APTO'] }).rows)).toEqual(['b', 'd']);
    expect(ids(q({ eligibility: ['NO_APTO'], careers: ['OTRA'] }).rows)).toEqual(['d']);
  });

  it('filtra por requisito incumplido', () => {
    expect(ids(q({ failing: ['BREVETE'] }).rows)).toEqual(['b']);
    expect(ids(q({ failing: ['CARRERA', 'SEDE_AREQUIPA'] }).rows)).toEqual(['d']);
  });

  it('marca DNI duplicado como observación y permite filtrar por ello', () => {
    expect(ids(q({ onlyWarnings: true }).rows)).toEqual(['c', 'd']);
  });

  it('los conteos de faceta ignoran su propio filtro', () => {
    const { facets } = q({ eligibility: ['APTO'], careers: ['ELECTRICA'] });
    expect(facets.eligibility).toMatchObject({ APTO: 0, NO_APTO: 1, POR_EVALUAR: 0 }); // aplica carrera=ELECTRICA
    expect(facets.careers).toMatchObject({ INDUSTRIAL: 1, ELECTRICA: 0 }); // aplica elegibilidad=APTO
  });

  it('un postulante cuenta en cada requisito que incumple', () => {
    expect(q().facets.failing).toMatchObject({ BREVETE: 1, CARRERA: 1, SEDE_AREQUIPA: 1, OFIMATICA: 0 });
  });
});

describe('sortRows / paginate', () => {
  it('por puntaje descendente, con aptos primero en empates', () => {
    expect(ids(sortRows(index, 'score', 'desc'))[0]).toBe('a');
  });
  it('por resultado: aptos, por evaluar, no aptos', () => {
    expect(ids(sortRows(index, 'eligibility', 'asc')).slice(0, 2)).toEqual(['a', 'c']);
  });
  it('ajusta una página fuera de rango', () => {
    expect(paginate([1, 2, 3], 5, 2)).toMatchObject({ page: 2, items: [3], start: 3, end: 3 });
  });
});
