import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, countActiveFilters, filtersReducer, parseFilters, serializeFilters } from './filterState';

describe('URL <-> estado', () => {
  it('ida y vuelta sin pérdida', () => {
    const state = {
      ...DEFAULT_FILTERS,
      query: 'abc 123',
      statuses: ['VENCIDO' as const],
      companies: ['HAGEMSA' as const, 'SERVOSA' as const],
      from: '2026-01-01',
      sortKey: 'plate' as const,
      sortDir: 'desc' as const,
      page: 3,
    };
    expect(parseFilters(serializeFilters(state))).toEqual(state);
  });
  it('el estado por defecto produce una URL limpia', () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe('');
  });
  it('descarta valores inválidos o manipulados', () => {
    const s = parseFilters('?estado=VENCIDO,HACKEO&empresa=OTRA&desde=ayer&pag=-2&tam=9999&orden=drop');
    expect(s.statuses).toEqual(['VENCIDO']);
    expect(s.companies).toEqual([]);
    expect(s.from).toBeNull();
    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(25);
    expect(s.sortKey).toBe('expiryDate');
  });
});

describe('filtersReducer', () => {
  it('vuelve a la página 1 al cambiar un criterio', () => {
    const s = filtersReducer({ ...DEFAULT_FILTERS, page: 4 }, { type: 'setQuery', query: 'x' });
    expect(s.page).toBe(1);
  });
  it('alterna la dirección al ordenar por la misma columna', () => {
    const asc = filtersReducer(DEFAULT_FILTERS, { type: 'sortBy', key: 'plate' });
    expect(asc).toMatchObject({ sortKey: 'plate', sortDir: 'asc' });
    expect(filtersReducer(asc, { type: 'sortBy', key: 'plate' }).sortDir).toBe('desc');
  });
  it('corrige un rango de fechas invertido', () => {
    const s = filtersReducer(DEFAULT_FILTERS, { type: 'setDateRange', field: 'expiryDate', from: '2026-12-01', to: '2026-01-01' });
    expect(s).toMatchObject({ from: '2026-01-01', to: '2026-12-01' });
  });
  it('reset conserva el tamaño de página elegido', () => {
    const s = filtersReducer({ ...DEFAULT_FILTERS, pageSize: 100, query: 'x' }, { type: 'reset' });
    expect(s).toEqual({ ...DEFAULT_FILTERS, pageSize: 100 });
    expect(countActiveFilters(s)).toBe(0);
  });
});
