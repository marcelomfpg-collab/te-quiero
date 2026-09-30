import { describe, expect, it } from 'vitest';
import type { FleetDocument } from '../../../domain/types';
import { buildIndex, paginate, runQuery, sortRows } from './filterEngine';
import { DEFAULT_FILTERS } from './filterState';

const today = '2026-09-30';

function doc(overrides: Partial<FleetDocument>): FleetDocument {
  return {
    id: overrides.code ?? 'x',
    code: 'DOC-00001',
    plate: 'ABC-123',
    vehicleType: 'TRACTO',
    company: 'HAGEMSA',
    type: 'SOAT',
    number: 'SOA-111111',
    issuer: 'Rímac Seguros',
    issueDate: '2025-10-01',
    expiryDate: '2026-12-31',
    inRenewal: false,
    responsible: 'M. Paredes',
    updatedAt: today,
    ...overrides,
  };
}

const index = buildIndex(
  [
    doc({ code: 'DOC-1', plate: 'ABC-123', company: 'HAGEMSA', type: 'SOAT', expiryDate: '2026-09-01' }), // vencido
    doc({ code: 'DOC-2', plate: 'XYZ-987', company: 'SERVOSA', type: 'REVISION_TECNICA', expiryDate: '2026-10-10', issuer: 'Farenet' }), // por vencer
    doc({ code: 'DOC-3', plate: 'XYZ-987', company: 'SERVOSA', type: 'SOAT', expiryDate: '2027-05-01' }), // vigente
    doc({ code: 'DOC-4', plate: 'KLM-555', company: 'PACSI', type: 'CERTIFICADO_MTC', expiryDate: '2026-08-01', inRenewal: true }), // en trámite
  ],
  today,
);

const criteria = (over: Partial<typeof DEFAULT_FILTERS> = {}) => ({ ...DEFAULT_FILTERS, ...over });
const codes = (rows: { doc: FleetDocument }[]) => rows.map((r) => r.doc.code);

describe('runQuery · búsqueda', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(codes(runQuery(index, criteria({ query: 'REVISION tecnica' })).rows)).toEqual(['DOC-2']);
    expect(codes(runQuery(index, criteria({ query: 'rimac' })).rows)).toHaveLength(3);
  });
  it('encuentra placas sin guion', () => {
    expect(codes(runQuery(index, criteria({ query: 'xyz987' })).rows)).toEqual(['DOC-2', 'DOC-3']);
  });
  it('combina términos con AND', () => {
    expect(codes(runQuery(index, criteria({ query: 'xyz soat' })).rows)).toEqual(['DOC-3']);
  });
});

describe('runQuery · filtros', () => {
  it('filtra por estado, empresa y tipo combinados', () => {
    const { rows } = runQuery(index, criteria({ companies: ['SERVOSA'], types: ['SOAT'] }));
    expect(codes(rows)).toEqual(['DOC-3']);
    expect(codes(runQuery(index, criteria({ statuses: ['VENCIDO', 'EN_TRAMITE'] })).rows)).toEqual(['DOC-1', 'DOC-4']);
  });
  it('filtra por rango de fechas inclusivo', () => {
    const { rows } = runQuery(index, criteria({ from: '2026-09-01', to: '2026-10-10' }));
    expect(codes(rows)).toEqual(['DOC-1', 'DOC-2']);
  });
  it('los conteos de una faceta ignoran su propio filtro pero respetan los demás', () => {
    const { facets } = runQuery(index, criteria({ statuses: ['VENCIDO'], companies: ['SERVOSA'] }));
    // Conteo de estado: aplica empresa=SERVOSA pero no el filtro de estado.
    expect(facets.status).toEqual({ VENCIDO: 0, POR_VENCER: 1, EN_TRAMITE: 0, VIGENTE: 1 });
    // Conteo de empresa: aplica estado=VENCIDO pero no el filtro de empresa.
    expect(facets.company).toEqual({ HAGEMSA: 1, SERVOSA: 0, PACSI: 0 });
  });
});

describe('sortRows / paginate', () => {
  it('ordena por severidad de estado', () => {
    expect(codes(sortRows(index, 'status', 'asc'))).toEqual(['DOC-1', 'DOC-2', 'DOC-4', 'DOC-3']);
  });
  it('ordena por vencimiento descendente', () => {
    expect(codes(sortRows(index, 'expiryDate', 'desc'))[0]).toBe('DOC-3');
  });
  it('ajusta la página fuera de rango', () => {
    const page = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(page).toMatchObject({ page: 3, totalPages: 3, items: [5], start: 5, end: 5 });
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, totalPages: 1, start: 0, end: 0 });
  });
});
