import { normalize } from '../lib/text';
import { CONVOCATORIA } from './convocatoria';
import type { Candidate } from './types';

/**
 * Valida el asunto del correo: "BECARIOS 2027 - APELLIDO Y NOMBRE - CARRERA PROFESIONAL".
 * Devuelve null si es correcto o el motivo del problema. No es excluyente: es una observación.
 */
export function checkSubject(c: Pick<Candidate, 'emailSubject' | 'lastNames'>): string | null {
  const parts = c.emailSubject.split(/\s+-\s+/).map((p) => p.trim());
  if (parts.length !== 3) return `El asunto no sigue el formato "${CONVOCATORIA.subjectFormat}"`;
  const [prefix = '', name = ''] = parts;
  if (normalize(prefix).replace(/\s+/g, ' ') !== normalize(CONVOCATORIA.subjectPrefix)) {
    return `El asunto debe empezar con "${CONVOCATORIA.subjectPrefix}"`;
  }
  const firstLastName = normalize(c.lastNames).split(/\s+/)[0] ?? '';
  if (firstLastName && !normalize(name).startsWith(firstLastName)) {
    return 'En el asunto debe ir primero el apellido';
  }
  return null;
}
