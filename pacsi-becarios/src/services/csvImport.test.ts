import { describe, expect, it } from 'vitest';
import { importCandidatesCsv, parseCareer, parseLicense, templateCsv } from './csvImport';

const ctx = { existingDnis: new Set<string>(), today: '2026-10-01', nextIndex: 0 };

describe('importCandidatesCsv', () => {
  it('la plantilla oficial se importa sin errores', () => {
    const r = importCandidatesCsv(templateCsv(), ctx);
    expect(r.errors).toEqual([]);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]).toMatchObject({ career: 'INDUSTRIAL', license: 'A_I', studyYear: 4, submittedAt: '2026-10-15', officeCertified: true });
  });

  it('acepta separador coma, encabezados con alias y valores en texto libre', () => {
    const csv = [
      'Nombre,Apellido,DNI,Carrera profesional,Año de carrera,Licencia,Excel,Experiencia,Certificado experiencia',
      'Luis,"Mamani Ccama",45678912,Ing. Mecatrónica,5to año,AIIb,x,10,si',
    ].join('\n');
    const r = importCandidatesCsv(csv, ctx);
    expect(r.errors).toEqual([]);
    expect(r.candidates[0]).toMatchObject({ career: 'MECANICA_MECATRONICA', studyYear: 5, license: 'A_IIB', officeCertified: true, experienceMonths: 10 });
  });

  it('reporta errores por fila con número de fila de Excel', () => {
    const csv = 'nombres;apellidos;dni;carrera;anio;brevete\nAna;Quispe;123;Industrial;4;Z9\n';
    const r = importCandidatesCsv(csv, ctx);
    expect(r.candidates).toHaveLength(0);
    expect(r.errors[0]!.row).toBe(2);
    expect(r.errors[0]!.messages.join(' ')).toMatch(/DNI.*Brevete/);
  });

  it('omite DNIs ya registrados o repetidos en el archivo', () => {
    const csv = 'nombres;apellidos;dni;carrera;anio\nA;B;11111111;Industrial;4\nC;D;22222222;Industrial;4\nE;F;22222222;Industrial;4\n';
    const r = importCandidatesCsv(csv, { ...ctx, existingDnis: new Set(['11111111']) });
    expect(r.candidates.map((c) => c.dni)).toEqual(['22222222']);
    expect(r.duplicates).toBe(2);
  });

  it('avisa si faltan columnas obligatorias', () => {
    expect(importCandidatesCsv('nombres;dni\nAna;12345678', ctx).missingColumns).toEqual(['apellidos', 'carrera', 'anio']);
  });
});

describe('normalizadores', () => {
  it('reconoce carreras escritas de distintas formas', () => {
    expect(parseCareer('INGENIERÍA MECÁNICA ELÉCTRICA')).toBe('MECANICA_MECATRONICA');
    expect(parseCareer('Ing. Eléctrica')).toBe('ELECTRICA');
    expect(parseCareer('Ingeniería Electrónica')).toBe('OTRA');
    expect(parseCareer('Administración de Empresas')).toBe('ADMINISTRACION');
  });
  it('reconoce categorías de brevete', () => {
    expect(parseLicense('A-I')).toBe('A_I');
    expect(parseLicense('a1')).toBe('A_I');
    expect(parseLicense('A-IIb')).toBe('A_IIB');
    expect(parseLicense('A2A')).toBe('A_IIA');
    expect(parseLicense('')).toBe('NINGUNA');
    expect(parseLicense('B-IIc')).toBeNull();
  });
});
