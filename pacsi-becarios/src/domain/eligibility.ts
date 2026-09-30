import { CAREER_LABEL, LICENSE_LABEL } from './catalogs';
import { CONVOCATORIA } from './convocatoria';
import { checkSubject } from './subject';
import type { Candidate, Eligibility, Evaluation, RequirementCheck, RequirementId, RequirementStatus } from './types';

type Config = typeof CONVOCATORIA;

function check(id: RequirementId, status: RequirementStatus, detail: string, mandatory = true): RequirementCheck {
  return { id, status, detail, mandatory };
}

/** Evalúa un requisito por cada punto del aviso, en el mismo orden. */
export function evaluateRequirements(c: Candidate, cfg: Config = CONVOCATORIA): RequirementCheck[] {
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
      ? check('HABILIDADES_BLANDAS', 'PENDIENTE', 'Falta evaluar (CV o entrevista)')
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

export function eligibilityOf(checks: RequirementCheck[]): Eligibility {
  const mandatory = checks.filter((c) => c.mandatory);
  if (mandatory.some((c) => c.status === 'NO_CUMPLE')) return 'NO_APTO';
  if (mandatory.some((c) => c.status === 'PENDIENTE')) return 'POR_EVALUAR';
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
  const subjectIssue = checkSubject(c);
  if (subjectIssue) warnings.push(subjectIssue);
  if (!/^\d{8}$/.test(c.dni)) warnings.push('DNI con formato inválido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) warnings.push('Correo electrónico inválido');
  return {
    checks,
    eligibility: eligibilityOf(checks),
    score: scoreBreakdown.reduce((sum, s) => sum + s.points, 0),
    scoreBreakdown,
    warnings,
  };
}
