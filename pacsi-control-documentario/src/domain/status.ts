import { daysBetween } from '../lib/dates';
import type { DocumentStatus, FleetDocument } from './types';

/** Días de anticipación con los que un documento pasa a "por vencer". */
export const EXPIRY_WARNING_DAYS = 30;

export function daysToExpiry(doc: Pick<FleetDocument, 'expiryDate'>, today: string): number {
  return daysBetween(today, doc.expiryDate);
}

/**
 * Regla de negocio única para el estado de un documento.
 * "En trámite" tiene prioridad: la renovación ya está gestionada.
 */
export function computeStatus(
  doc: Pick<FleetDocument, 'expiryDate' | 'inRenewal'>,
  today: string,
  warningDays = EXPIRY_WARNING_DAYS,
): DocumentStatus {
  if (doc.inRenewal) return 'EN_TRAMITE';
  const days = daysToExpiry(doc, today);
  if (days < 0) return 'VENCIDO';
  if (days <= warningDays) return 'POR_VENCER';
  return 'VIGENTE';
}
