import type { Candidate } from '../domain/types';

/** Postulante que cumple TODOS los requisitos; cada prueba cambia solo lo que evalúa. */
export function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    code: 'POS-0001',
    firstNames: 'Ana Lucía',
    lastNames: 'Quispe Zegarra',
    dni: '72345678',
    email: 'ana@gmail.com',
    phone: '987654321',
    career: 'INDUSTRIAL',
    careerName: 'Ing. Industrial',
    university: 'UNSA',
    studyYear: 4,
    city: 'Arequipa',
    practiceType: 'PREPROFESIONAL',
    license: 'A_I',
    technicalCareerCertified: false,
    officeCertified: true,
    experienceMonths: 6,
    experienceCertified: true,
    softSkills: 4,
    shift: 'MIXTO',
    submittedAt: '2026-10-15',
    emailSubject: 'BECARIOS 2027 - QUISPE ZEGARRA ANA LUCIA - INGENIERIA INDUSTRIAL',
    stage: 'RECIBIDO',
    notes: '',
    ...overrides,
  };
}
