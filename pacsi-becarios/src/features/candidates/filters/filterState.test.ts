import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, countActiveFilters, filtersReducer, parseFilters, serializeFilters, type FilterState } from './filterState';

describe('URL <-> estado', () => {
  it('ida y vuelta sin pérdida', () => {
    const state: FilterState = {
      ...DEFAULT_FILTERS,
      query: 'quispe',
      eligibility: ['APTO', 'POR_EVALUAR'],
      careers: ['INDUSTRIAL'],
      failing: ['BREVETE'],
      years: ['4'],
      onlyWarnings: true,
      sortKey: 'name',
      sortDir: 'asc',
      page: 2,
    };
    expect(parseFilters(serializeFilters(state))).toEqual(state);
  });
  it('el estado por defecto da una URL limpia', () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe('');
  });
  it('descarta valores manipulados', () => {
    const s = parseFilters('?elegibilidad=APTO,HACK&carrera=X&anio=9&orden=drop&pag=-1&tam=7');
    expect(s).toMatchObject({ eligibility: ['APTO'], careers: [], years: [], sortKey: 'eligibility', page: 1, pageSize: 25 });
  });
});

describe('filtersReducer', () => {
  it('vuelve a la página 1 al cambiar un filtro', () => {
    expect(filtersReducer({ ...DEFAULT_FILTERS, page: 3 }, { type: 'toggle', key: 'careers', value: 'ELECTRICA' }).page).toBe(1);
  });
  it('puntaje y fecha se ordenan de mayor a menor al elegirlos; el resto de A a Z', () => {
    const byName = filtersReducer(DEFAULT_FILTERS, { type: 'sortBy', key: 'name' });
    expect(byName.sortDir).toBe('asc');
    expect(filtersReducer(byName, { type: 'sortBy', key: 'submittedAt' }).sortDir).toBe('desc');
    expect(filtersReducer(byName, { type: 'sortBy', key: 'name' }).sortDir).toBe('desc');
  });
  it('reset limpia todo menos el tamaño de página', () => {
    const s = filtersReducer({ ...DEFAULT_FILTERS, pageSize: 50, careers: ['COMERCIAL'], onlyWarnings: true }, { type: 'reset' });
    expect(s).toEqual({ ...DEFAULT_FILTERS, pageSize: 50 });
    expect(countActiveFilters(s)).toBe(0);
  });
});
