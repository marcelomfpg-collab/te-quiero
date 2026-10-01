import { describe, expect, it } from 'vitest';
import { evaluateCandidate } from '../domain/eligibility';
import { candidateFromCv } from './candidateFromCv';
import { parseCv, parseSubject } from './cvParser';
import { sumExperience } from './experience';
import { CERTIFICADO_TRABAJO, CV_CLASICO, CV_DOS_COLUMNAS_SIN_BREVETE, CV_EGRESADO_LIMA, CV_SIN_DATOS } from './fixtures/cvs';

const today = '2026-10-01';
const fromCv = (text: string, extra: Partial<Parameters<typeof candidateFromCv>[0]> = {}) =>
  candidateFromCv({ text, today, files: [], source: 'cv', submittedAt: '2026-10-01', codeNumber: 1, ...extra }).candidate;

describe('sumExperience', () => {
  it('suma rangos con meses en texto y numéricos, y une los que se superponen', () => {
    expect(sumExperience('Enero 2025 – Junio 2025\nAgo. 2024 – Dic. 2024', today).months).toBe(11);
    expect(sumExperience('01/2024 - 06/2024 y 03/2024 - 08/2024', today).months).toBe(8);
  });
  it('entiende "Presente" y no cuenta más allá de hoy', () => {
    expect(sumExperience('03/2026 - Presente', today).months).toBe(8);
    expect(sumExperience('setiembre de 2026 a la fecha', today).months).toBe(2);
  });
  it('marca como aproximado cuando solo hay años', () => {
    const r = sumExperience('2021 - 2023', today);
    expect(r.approximate).toBe(true);
    expect(r.months).toBe(36);
  });
});

describe('parseSubject', () => {
  it('separa apellidos, nombres y carrera', () => {
    expect(parseSubject('BECARIOS 2027 - QUISPE ZEGARRA ANA LUCIA - INGENIERIA INDUSTRIAL')).toEqual({
      lastNames: 'Quispe Zegarra',
      firstNames: 'Ana Lucia',
      career: 'INGENIERIA INDUSTRIAL',
    });
  });
  it('tolera guiones largos y mayúsculas mezcladas', () => {
    expect(parseSubject('Becarios 2027 – Mamani Luis – Ing. Eléctrica')).toMatchObject({ lastNames: 'Mamani', firstNames: 'Luis' });
  });
  it('ignora asuntos que no son de la convocatoria', () => {
    expect(parseSubject('Envío mi CV')).toEqual({});
  });
});

describe('parseCv · CV clásico de una columna', () => {
  const ext = parseCv(CV_CLASICO, { today });
  it('datos personales', () => {
    expect(ext.firstNames?.value).toBe('Ana Lucía');
    expect(ext.lastNames?.value).toBe('Quispe Zegarra');
    expect(ext.dni).toMatchObject({ value: '72345678', confidence: 'alta' });
    expect(ext.phone?.value).toBe('987654321');
    expect(ext.email?.value).toBe('ana.quispe@gmail.com');
  });
  it('estudios: VIII ciclo = 4° año, carrera y universidad', () => {
    expect(ext.studyYear).toMatchObject({ value: 4, confidence: 'alta' });
    expect(ext.career?.value.career).toBe('INDUSTRIAL');
    expect(ext.university?.value).toBe('UNSA');
  });
  it('requisitos: Arequipa, brevete, Excel certificado y 11 meses (sin contar los estudios)', () => {
    expect(ext.city).toMatchObject({ value: 'Arequipa', confidence: 'alta' });
    expect(ext.license).toMatchObject({ value: 'A_I', confidence: 'alta' });
    expect(ext.officeCertified).toMatchObject({ value: true, confidence: 'alta' });
    expect(ext.experienceMonths).toMatchObject({ value: 11, confidence: 'alta' });
  });
  it('sin certificado de trabajo adjunto queda por revisar; con el certificado se confirma', () => {
    expect(ext.experienceCertified).toBeUndefined();
    expect(parseCv(`${CV_CLASICO}\n${CERTIFICADO_TRABAJO}`, { today }).experienceCertified?.value).toBe(true);
  });
});

describe('parseCv · CV de dos columnas sin brevete', () => {
  const ext = parseCv(CV_DOS_COLUMNAS_SIN_BREVETE, { today });
  it('lee carrera, año, experiencia actual y carrera técnica', () => {
    expect(ext.career?.value.career).toBe('MECANICA_MECATRONICA');
    expect(ext.studyYear?.value).toBe(5);
    expect(ext.experienceMonths?.value).toBe(32); // 03/2024 a hoy (oct 2026)
    expect(ext.technicalCareerCertified?.value).toBe(true);
    expect(ext.phone?.value).toBe('912345678');
  });
  it('Mollendo es provincia de Arequipa; Office sin certificado se marca para verificar', () => {
    expect(ext.city?.value).toBe('Arequipa');
    expect(ext.officeCertified).toMatchObject({ value: true, confidence: 'baja' });
    expect(ext.license).toMatchObject({ value: 'NINGUNA' });
  });
});

describe('parseCv · egresado que vive en Lima', () => {
  const ext = parseCv(CV_EGRESADO_LIMA, { today });
  it('detecta egresado, Lima (aunque la calle se llame Av. Arequipa) y DNI con otra etiqueta', () => {
    expect(ext.practiceType?.value).toBe('PROFESIONAL');
    expect(ext.city?.value).toBe('Lima');
    expect(ext.dni?.value).toBe('45678912');
    expect(ext.career?.value.career).toBe('ADMINISTRACION');
  });
});

describe('candidateFromCv · resultado en el filtro', () => {
  it('CV completo + certificado → APTO, con la evidencia de cada dato', () => {
    const c = fromCv(`${CV_CLASICO}\n${CERTIFICADO_TRABAJO}`, {
      subject: 'BECARIOS 2027 - QUISPE ZEGARRA ANA LUCIA - INGENIERIA INDUSTRIAL',
    });
    expect(evaluateCandidate(c).eligibility).toBe('APTO');
    expect(c.evidence?.license).toMatch(/A-I/);
    expect(c.missing).toEqual([]);
  });

  it('CV sin certificado de trabajo → POR REVISAR (no se descarta)', () => {
    const e = evaluateCandidate(fromCv(CV_CLASICO));
    expect(e.eligibility).toBe('POR_EVALUAR');
    expect(e.checks.find((c) => c.id === 'EXPERIENCIA')).toMatchObject({ status: 'PENDIENTE' });
  });

  it('un incumplimiento claro descarta aunque falten otros datos (sin brevete)', () => {
    const e = evaluateCandidate(fromCv(CV_DOS_COLUMNAS_SIN_BREVETE));
    expect(e.eligibility).toBe('NO_APTO');
    expect(e.checks.find((c) => c.id === 'BREVETE')?.status).toBe('NO_CUMPLE');
  });

  it('CV casi vacío → nada se inventa: todo queda por revisar y el nombre sale del CV', () => {
    const c = fromCv(CV_SIN_DATOS, { fileName: 'CV_Juan_Perez.pdf' });
    expect(c.missing).toEqual(expect.arrayContaining(['career', 'studyYear', 'city', 'experienceMonths', 'dni']));
    expect(evaluateCandidate(c).checks.find((x) => x.id === 'CARRERA')?.status).toBe('PENDIENTE');
    expect(`${c.firstNames} ${c.lastNames}`).toBe('Juan Pérez');
  });

  it('usa el correo del remitente si el CV no trae correo', () => {
    expect(fromCv(CV_SIN_DATOS, { senderEmail: 'Juan@Gmail.com' }).email).toBe('juan@gmail.com');
  });
});
