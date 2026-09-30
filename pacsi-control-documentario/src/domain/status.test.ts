import { describe, expect, it } from 'vitest';
import { computeStatus } from './status';

const today = '2026-09-30';

describe('computeStatus', () => {
  it('marca vencido cuando la fecha ya pasó', () => {
    expect(computeStatus({ expiryDate: '2026-09-29', inRenewal: false }, today)).toBe('VENCIDO');
  });
  it('marca por vencer dentro de la ventana de 30 días (incluye hoy y el día 30)', () => {
    expect(computeStatus({ expiryDate: today, inRenewal: false }, today)).toBe('POR_VENCER');
    expect(computeStatus({ expiryDate: '2026-10-30', inRenewal: false }, today)).toBe('POR_VENCER');
  });
  it('marca vigente fuera de la ventana', () => {
    expect(computeStatus({ expiryDate: '2026-10-31', inRenewal: false }, today)).toBe('VIGENTE');
  });
  it('en trámite tiene prioridad sobre el vencimiento', () => {
    expect(computeStatus({ expiryDate: '2025-01-01', inRenewal: true }, today)).toBe('EN_TRAMITE');
  });
});
