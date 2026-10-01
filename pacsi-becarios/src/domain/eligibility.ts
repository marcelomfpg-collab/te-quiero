import { CAREER_LABEL, LICENSE_LABEL } from './catalogs';
import { CONVOCATORIA } from './convocatoria';
import { checkSubject } from './subject';
import type { Candidate, Eligibility, Evaluation, RequirementCheck, RequirementId, RequirementStatus, VerifiableField } from './types';

type Config = typeof CONVOCATORIA;

function check(id: RequirementId, status: RequirementStatus, detail: string, mandatory = true): RequirementCheck {
  return { id, status, detail, mandatory };
}

/** Qué datos del CV necesita cada requisito. */
export const REQUIREMENT_FIELDS: Partial<Record<RequirementId, VerifiableField[]>> = {
  CARRERA: ['career'],
  ANIO_ESTUDIO: ['studyYear'],
  BREVETE: ['license'],
  CARRERA_TECNICA: ['technicalCareerCertified'],
  OFIMATICA: ['officeCertified'],
  SEDE_AREQUIPA: ['city', 'practiceType'],
  EXPERIENCIA: ['experienceMonths', 'experienceCertified'],
};

const FIELD_LABEL: Record<VerifiableField, string> = {
  career: 'la carrera',
  studyYear: 'el año o ciclo',
  license: 'el brevete',
  officeCertified: 'el certificado de ofimática',
  city: 'la ciudad',
  practiceType: 'el tipo de prácticas',
  experienceMonths: 'los meses de experiencia',
  experienceCertified: 'el certificado de experiencia',
  technicalCareerCertified: 'la carrera técnica',
  dni: 'el DNI',
};

/**
 * Un dato que el lector no encontró nunca descarta al postulante:
 * su requisito queda PENDIENTE hasta que una persona lo confirme.
 */
function markMissing(checks: RequirementCheck[], c: Candidate): RequirementCheck[] {
  if (!c.missing?.length) return checks;
  const missing = new Set(c.missing);
  return checks.map((check) => {
    const fields = (REQUIREMENT_FIELDS[check.id] ?? []).filter((f) => missing.has(f));
    if (!fields.length || check.status === 'NO_APLICA') return check;
    // Si con los datos conocidos ya se incumple (p. ej. 3 meses de experiencia), se mantiene el NO_CUMPLE.
    if (check.status === 'NO_CUMPLE' && check.id === 'EXPERIENCIA' && !missing.has('experienceMonths')) {
      return c.experienceMonths < CONVOCATORIA.minExperienceMonths ? check : { ...check, status: 'PENDIENTE', detail: `${c.experienceMonths} meses · revisar ${FIELD_LABEL.experienceCertified}` };
    }
    return { ...check, status: 'PENDIENTE', detail: `No se encontró ${fields.map((f) => FIELD_LABEL[f]).join(' ni ')} en el CV: revisar` };
  });
}

/** Evalúa un requisito por cada punto del aviso, en el mismo orden. */
export function evaluateRequirements(c: Candidate, cfg: Config = CONVOCATORIA): RequirementCheck[] {
  return markMissing(baseRequirements(c, cfg), c);
}

function baseRequirements(c: Candidate, cfg: Config): RequirementCheck[] {
  const inProfile = cfg.careers.includes(c.career);
  const licenseExempt = cfg.licenseExemptCareers.includes(c.career);
  const inCity = c.city.trim().toLowerCase() === cfg.city.toLowerCase();
  const isPre = c.practiceType === 'PREPROFESIONAL';
  const expOk = c.experienceMonths >= cfg.minExperienceMonths;

  return [
    c.submittedAt <= cfg.deadline
      ? check('PLAZO', 'CUMPLE', 'CV recibido dentro del plazo')
      : check('PLAZO', 'NO_CUMPLE', `CV recibido fuera de plazo (límite ${cfg.deadline})`),

    inProfile
      ? check('CARRERA', 'CUMPLE', CAREER_LABEL[c.career])
      : check('CARRERA', 'NO_CUMPLE', `${c.careerName || 'Carrera'} no está convocada`),

    cfg.studyYears.includes(c.studyYear)
      ? check('ANIO_ESTUDIO', 'CUMPLE', `Cursa ${c.studyYear}° año`)
      : check('ANIO_ESTUDIO', 'NO_CUMPLE', `Cursa ${c.studyYear}° año (se requiere 3° a 5°)`),

    licenseExempt
      ? check('BREVETE', 'NO_APLICA', 'No se exige para Administración')
      : cfg.licenses.includes(c.license)
        ? check('BREVETE', 'CUMPLE', `Licencia ${LICENSE_LABEL[c.license]}`)
        : check('BREVETE', 'NO_CUMPLE', 'No cuenta con brevete A-I o A-IIb'),

    c.technicalCareerCertified
      ? check('CARRERA_TECNICA', 'CUMPLE', 'Tiene carrera técnica certificada', false)
      : check('CARRERA_TECNICA', 'NO_CUMPLE', 'Sin carrera técnica (opcional, suma puntaje)', false),

    c.officeCertified
      ? check('OFIMATICA', 'CUMPLE', 'Curso certificado')
      : check('OFIMATICA', 'NO_CUMPLE', 'Sin certificado de ofimática / Excel'),

    c.softSkills === null
      ? check('HABILIDADES_BLANDAS', 'PENDIENTE', 'Se califica en la entrevista')
      : c.softSkills >= cfg.minSoftSkills
        ? check('HABILIDADES_BLANDAS', 'CUMPLE', `Evaluación ${c.softSkills}/5`)
        : check('HABILIDADES_BLANDAS', 'NO_CUMPLE', `Evaluación ${c.softSkills}/5 (mínimo ${cfg.minSoftSkills})`),

    inCity && isPre
      ? check('SEDE_AREQUIPA', 'CUMPLE', `Preprofesional en ${cfg.city}`)
      : check(
          'SEDE_AREQUIPA',
          'NO_CUMPLE',
          [!isPre && 'Busca prácticas profesionales', !inCity && `Reside en ${c.city || 'otra ciudad'}`].filter(Boolean).join(' · '),
        ),

    expOk && c.experienceCertified
      ? check('EXPERIENCIA', 'CUMPLE', `${c.experienceMonths} meses certificados`)
      : check(
          'EXPERIENCIA',
          'NO_CUMPLE',
          expOk ? `${c.experienceMonths} meses, pero sin certificado` : `${c.experienceMonths} meses (mínimo ${cfg.minExperienceMonths})`,
        ),
  ];
}

/**
 * Las habilidades blandas se califican en la entrevista: mientras no se califiquen
 * no impiden ser "Apto" en el filtro de CVs (una nota menor a 3 sí descarta).
 */
export function eligibilityOf(checks: RequirementCheck[]): Eligibility {
  const mandatory = checks.filter((c) => c.mandatory);
  if (mandatory.some((c) => c.status === 'NO_CUMPLE')) return 'NO_APTO';
  if (mandatory.some((c) => c.status === 'PENDIENTE' && c.id !== 'HABILIDADES_BLANDAS')) return 'POR_EVALUAR';
  return 'APTO';
}

/**
 * Puntaje 0–100 para ORDENAR a los postulantes; no decide la aptitud.
 * Pesos transparentes y visibles en el detalle.
 */
export function scoreCandidate(c: Candidate): Evaluation['scoreBreakdown'] {
  const yearPoints: Record<number, number> = { 3: 10, 4: 15, 5: 20 };
  return [
    { label: 'Experiencia (tope 24 meses)', points: Math.round((Math.min(c.experienceMonths, 24) / 24) * 35), max: 35 },
    { label: 'Habilidades blandas', points: c.softSkills === null ? 0 : c.softSkills * 6, max: 30 },
    { label: 'Año de carrera', points: yearPoints[c.studyYear] ?? 0, max: 20 },
    { label: 'Carrera técnica certificada', points: c.technicalCareerCertified ? 15 : 0, max: 15 },
  ];
}

export function evaluateCandidate(c: Candidate, cfg: Config = CONVOCATORIA): Evaluation {
  const checks = evaluateRequirements(c, cfg);
  const scoreBreakdown = scoreCandidate(c);
  const warnings: string[] = [];
  // Solo se revisa el asunto cuando el CV llegó por correo (o se registró el asunto).
  const subjectIssue = c.emailSubject || c.source === 'correo' ? checkSubject(c) : null;
  if (subjectIssue) warnings.push(subjectIssue);
  if (c.missing?.includes('dni')) warnings.push('No se encontró el DNI en el CV');
  else if (!/^\d{8}$/.test(c.dni)) warnings.push('DNI con formato inválido');
  if (c.uncertain?.length) warnings.push(`Verificar: ${c.uncertain.map((f) => FIELD_LABEL[f]).join(', ')}`);
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) warnings.push('Correo electrónico inválido');
  return {
    checks,
    eligibility: eligibilityOf(checks),
    score: scoreBreakdown.reduce((sum, s) => sum + s.points, 0),
    scoreBreakdown,
    warnings,
  };
}
