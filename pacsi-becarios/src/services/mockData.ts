import { CAREER_LABEL } from '../domain/catalogs';
import { evaluateCandidate } from '../domain/eligibility';
import type { Candidate, Career, License, Shift, Stage } from '../domain/types';
import { addDays } from '../lib/dates';
import { createRandom } from '../lib/random';

const FIRST = ['Luis', 'María', 'José', 'Ana', 'Carlos', 'Lucía', 'Jorge', 'Valeria', 'Diego', 'Camila', 'Renzo', 'Fiorella', 'Miguel', 'Andrea', 'Kevin', 'Milagros', 'Brayan', 'Daniela', 'Álvaro', 'Rosa', 'Sebastián', 'Gabriela', 'Joel', 'Ximena'];
const LAST = ['Quispe', 'Mamani', 'Huamán', 'Flores', 'Condori', 'Rodríguez', 'Paredes', 'Chávez', 'Torres', 'Apaza', 'Salas', 'Zegarra', 'Delgado', 'Vargas', 'Ccama', 'Rivera', 'Cáceres', 'Linares', 'Medina', 'Núñez'];
const UNIVERSITIES = ['UNSA', 'UCSM', 'UCSP', 'UTP Arequipa', 'Universidad Continental', 'UAP Arequipa', 'Universidad La Salle'];
const CITIES = ['Arequipa', 'Arequipa', 'Arequipa', 'Arequipa', 'Arequipa', 'Arequipa', 'Moquegua', 'Cusco', 'Lima', 'Puno'];
const CAREERS: Career[] = ['MECANICA_MECATRONICA', 'MECANICA_MECATRONICA', 'ELECTRICA', 'INDUSTRIAL', 'INDUSTRIAL', 'COMERCIAL', 'ADMINISTRACION', 'ADMINISTRACION', 'OTRA'];
const OTHER_CAREERS = ['Ing. Civil', 'Ing. de Sistemas', 'Contabilidad', 'Ing. Electrónica', 'Ing. de Minas'];
const LICENSES: License[] = ['NINGUNA', 'A_I', 'A_I', 'A_I', 'A_I', 'A_IIA', 'A_IIB'];
const SHIFTS: Shift[] = ['DIA', 'TARDE', 'MIXTO'];
const YEARS = [2, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6];

/** Postulantes verosímiles para la demo; incluye perfiles aptos, observados y fuera de perfil. */
export function generateMockCandidates(today: string, count = 180, seed = 2027): Candidate[] {
  const rnd = createRandom(seed);
  const candidates = Array.from({ length: count }, (_, i): Candidate => {
    const firstNames = rnd.pick(FIRST);
    const lastNames = `${rnd.pick(LAST)} ${rnd.pick(LAST)}`;
    const career = rnd.pick(CAREERS);
    const careerName = career === 'OTRA' ? rnd.pick(OTHER_CAREERS) : CAREER_LABEL[career];
    const experienceMonths = rnd.pick([0, 3, 4, 6, 6, 7, 8, 10, 12, 12, 18, 24]);
    const softSkills = rnd.chance(0.45) ? rnd.int(2, 5) : null;
    const stage: Stage = softSkills === null ? rnd.pick(['RECIBIDO', 'RECIBIDO', 'EN_EVALUACION'] as const) : rnd.pick(['EN_EVALUACION', 'ENTREVISTA'] as const);
    const subjectCareer = careerName.replace(/^Ing\. /, 'Ingeniería ').toUpperCase();
    const goodSubject = rnd.chance(0.85);
    return {
      id: `pos-${i + 1}`,
      code: `POS-${String(i + 1).padStart(4, '0')}`,
      firstNames,
      lastNames,
      dni: String(rnd.int(40_000_000, 79_999_999)),
      email: `${firstNames[0]}${lastNames.split(' ')[0]}${rnd.int(1, 99)}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '@gmail.com',
      phone: `9${rnd.int(10_000_000, 99_999_999)}`,
      career,
      careerName,
      university: rnd.pick(UNIVERSITIES),
      studyYear: rnd.pick(YEARS),
      city: rnd.pick(CITIES),
      practiceType: rnd.chance(0.92) ? 'PREPROFESIONAL' : 'PROFESIONAL',
      license: rnd.pick(LICENSES),
      technicalCareerCertified: rnd.chance(0.3),
      officeCertified: rnd.chance(0.88),
      experienceMonths,
      experienceCertified: experienceMonths > 0 && rnd.chance(0.9),
      softSkills,
      shift: rnd.pick(SHIFTS),
      submittedAt: addDays(today, -rnd.int(0, 25)),
      emailSubject: goodSubject
        ? `BECARIOS 2027 - ${lastNames.toUpperCase()} ${firstNames.toUpperCase()} - ${subjectCareer}`
        : `Postulación prácticas ${firstNames} ${lastNames}`,
      stage,
      notes: '',
    };
  });
  // Coherencia con la regla de la UI: un "No apto" nunca llega a entrevista.
  return candidates.map((c) =>
    c.stage === 'ENTREVISTA' && evaluateCandidate(c).eligibility === 'NO_APTO' ? { ...c, stage: rnd.pick(['EN_EVALUACION', 'DESCARTADO'] as const) } : c,
  );
}
