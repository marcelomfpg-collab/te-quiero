import { CAREER_LABEL } from '../domain/catalogs';
import type { Candidate, Career, License, PracticeType, Shift } from '../domain/types';
import { parseCsv, toCsv } from '../lib/csv';
import { parseDate } from '../lib/dates';
import { compact, normalize } from '../lib/text';

/** Columnas de la plantilla. `aliases` permite importar planillas con encabezados parecidos. */
const COLUMNS = {
  nombres: ['nombres', 'nombre'],
  apellidos: ['apellidos', 'apellido'],
  dni: ['dni', 'documento'],
  correo: ['correo', 'email', 'correo electronico'],
  celular: ['celular', 'telefono'],
  carrera: ['carrera', 'carrera profesional'],
  universidad: ['universidad', 'institucion'],
  anio: ['anio', 'año', 'ano', 'año de estudio', 'año de carrera'],
  ciudad: ['ciudad', 'residencia'],
  tipo_practica: ['tipo practica', 'tipo de practica', 'practicas'],
  brevete: ['brevete', 'licencia'],
  carrera_tecnica: ['carrera tecnica', 'carrera tecnica certificada'],
  ofimatica: ['ofimatica', 'excel', 'ofimatica certificada'],
  experiencia_meses: ['experiencia meses', 'experiencia', 'meses experiencia'],
  experiencia_certificada: ['experiencia certificada', 'certificado experiencia'],
  turno: ['turno', 'horario', 'disponibilidad'],
  fecha_postulacion: ['fecha postulacion', 'fecha', 'fecha de envio'],
  asunto: ['asunto', 'asunto correo', 'subject'],
} as const;

type ColumnKey = keyof typeof COLUMNS;
const REQUIRED: ColumnKey[] = ['nombres', 'apellidos', 'dni', 'carrera', 'anio'];

export const TEMPLATE_EXAMPLE: Record<ColumnKey, string> = {
  nombres: 'Ana Lucía',
  apellidos: 'Quispe Zegarra',
  dni: '72345678',
  correo: 'ana.quispe@gmail.com',
  celular: '987654321',
  carrera: 'Ingeniería Industrial',
  universidad: 'UNSA',
  anio: '4',
  ciudad: 'Arequipa',
  tipo_practica: 'Preprofesional',
  brevete: 'A-I',
  carrera_tecnica: 'No',
  ofimatica: 'Sí',
  experiencia_meses: '8',
  experiencia_certificada: 'Sí',
  turno: 'Mixto',
  fecha_postulacion: '15/10/2026',
  asunto: 'BECARIOS 2027 - QUISPE ZEGARRA ANA LUCIA - INGENIERIA INDUSTRIAL',
};

export function templateCsv(): string {
  const keys = Object.keys(COLUMNS) as ColumnKey[];
  return toCsv([TEMPLATE_EXAMPLE], keys.map((k) => ({ header: k, value: (r: Record<ColumnKey, string>) => r[k] })));
}

// ---------- Normalizadores de valores libres ----------

export function parseCareer(value: string): Career {
  const v = normalize(value);
  if (v.includes('mecanic') || v.includes('mecatronic')) return 'MECANICA_MECATRONICA';
  if (/\belectrica\b/.test(v)) return 'ELECTRICA';
  if (v.includes('industrial')) return 'INDUSTRIAL';
  if (v.includes('comercial')) return 'COMERCIAL';
  if (v.includes('administracion')) return 'ADMINISTRACION';
  return 'OTRA';
}

export function parseLicense(value: string): License | null {
  const v = compact(value).replace(/1/g, 'i').replace(/2/g, 'ii').replace(/3/g, 'iii');
  if (!v || ['no', 'ninguno', 'ninguna', 'sinbrevete', 'na'].includes(v)) return 'NINGUNA';
  if (v.startsWith('aiii')) return 'A_III';
  if (v === 'aiia') return 'A_IIA';
  if (v === 'aiib') return 'A_IIB';
  if (v === 'ai') return 'A_I';
  return null;
}

function parseBool(value: string): boolean | null {
  const v = normalize(value.trim());
  if (['si', 's', 'x', '1', 'true', 'yes'].includes(v)) return true;
  if (['no', 'n', '0', 'false', ''].includes(v)) return false;
  return null;
}

function parseShift(value: string): Shift {
  const v = normalize(value);
  if (v.includes('tarde')) return 'TARDE';
  if (v.includes('mixto')) return 'MIXTO';
  return 'DIA';
}

function parsePractice(value: string): PracticeType {
  const v = normalize(value);
  return v.includes('profesional') && !v.includes('pre') ? 'PROFESIONAL' : 'PREPROFESIONAL';
}

// ---------- Importación ----------

export interface ImportResult {
  candidates: Candidate[];
  errors: { row: number; messages: string[] }[];
  duplicates: number;
  missingColumns: string[];
}

interface ImportContext {
  existingDnis: Set<string>;
  today: string;
  nextIndex: number;
}

export function importCandidatesCsv(text: string, ctx: ImportContext): ImportResult {
  const [header = [], ...rows] = parseCsv(text);
  const normalizedHeader = header.map((h) => normalize(h.trim()).replace(/[_\s]+/g, ' '));
  const indexOf = Object.fromEntries(
    (Object.keys(COLUMNS) as ColumnKey[]).map((key) => [
      key,
      normalizedHeader.findIndex((h) => (COLUMNS[key] as readonly string[]).some((alias) => normalize(alias) === h)),
    ]),
  ) as Record<ColumnKey, number>;

  const missingColumns = REQUIRED.filter((k) => indexOf[k] === -1);
  const result: ImportResult = { candidates: [], errors: [], duplicates: 0, missingColumns };
  if (missingColumns.length) return result;

  const seen = new Set(ctx.existingDnis);
  let next = ctx.nextIndex;

  rows.forEach((cells, i) => {
    const rowNumber = i + 2; // +1 por encabezado, +1 porque Excel numera desde 1
    const get = (k: ColumnKey) => (indexOf[k] >= 0 ? (cells[indexOf[k]] ?? '').trim() : '');
    const messages: string[] = [];

    const dni = get('dni').replace(/\D/g, '');
    if (!/^\d{8}$/.test(dni)) messages.push('DNI debe tener 8 dígitos');
    if (!get('nombres') || !get('apellidos')) messages.push('Faltan nombres o apellidos');

    const studyYear = Number(get('anio').match(/\d/)?.[0]);
    if (!studyYear || studyYear > 7) messages.push('Año de carrera inválido');

    const license = parseLicense(get('brevete'));
    if (license === null) messages.push(`Brevete no reconocido: "${get('brevete')}"`);

    const bools = {
      technicalCareerCertified: parseBool(get('carrera_tecnica')),
      officeCertified: parseBool(get('ofimatica')),
      experienceCertified: parseBool(get('experiencia_certificada')),
    };
    for (const [key, value] of Object.entries(bools)) if (value === null) messages.push(`Valor Sí/No inválido en ${key}`);

    const experienceMonths = Number(get('experiencia_meses').replace(',', '.') || 0);
    if (!Number.isFinite(experienceMonths) || experienceMonths < 0) messages.push('Meses de experiencia inválidos');

    const rawDate = get('fecha_postulacion');
    const submittedAt = rawDate ? parseDate(rawDate) : ctx.today;
    if (!submittedAt) messages.push(`Fecha inválida: "${rawDate}" (use DD/MM/AAAA)`);

    if (messages.length) {
      result.errors.push({ row: rowNumber, messages });
      return;
    }
    if (seen.has(dni)) {
      result.duplicates++;
      return;
    }
    seen.add(dni);
    next++;

    const career = parseCareer(get('carrera'));
    result.candidates.push({
      id: `imp-${dni}`,
      code: `POS-${String(next).padStart(4, '0')}`,
      firstNames: get('nombres'),
      lastNames: get('apellidos'),
      dni,
      email: get('correo'),
      phone: get('celular'),
      career,
      careerName: career === 'OTRA' ? get('carrera') : CAREER_LABEL[career],
      university: get('universidad'),
      studyYear,
      city: get('ciudad') || 'Arequipa',
      practiceType: parsePractice(get('tipo_practica')),
      license: license!,
      technicalCareerCertified: bools.technicalCareerCertified!,
      officeCertified: bools.officeCertified!,
      experienceMonths: Math.floor(experienceMonths),
      experienceCertified: bools.experienceCertified!,
      softSkills: null,
      shift: parseShift(get('turno')),
      submittedAt: submittedAt!,
      emailSubject: get('asunto'),
      stage: 'RECIBIDO',
      notes: '',
    });
  });
  return result;
}
