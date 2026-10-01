import { formatCode, newId } from '../domain/codes';
import type { Candidate, CandidateFile, CandidateSource, VerifiableField } from '../domain/types';
import { parseCv, reviewFlags, type CvContext, type CvExtraction } from './cvParser';

export interface CvInput extends CvContext {
  text: string;
  files: CandidateFile[];
  source: CandidateSource;
  submittedAt: string;
  codeNumber: number;
  emailMessageId?: string;
}

/** Crea el postulante a partir del CV leído; lo no encontrado queda marcado para revisar. */
export function candidateFromCv(input: CvInput): { candidate: Candidate; extraction: CvExtraction } {
  const ext = parseCv(input.text, input);
  const { missing, uncertain } = reviewFlags(ext);
  const evidence: Partial<Record<VerifiableField, string>> = {};
  for (const f of ['career', 'studyYear', 'license', 'officeCertified', 'city', 'practiceType', 'experienceMonths', 'experienceCertified', 'technicalCareerCertified', 'dni'] as const) {
    const e = ext[f]?.evidence;
    if (e) evidence[f] = e;
  }
  const fallbackName = input.fileName?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(cv|curriculum|vitae)\b/gi, '').trim();

  const candidate: Candidate = {
    id: newId(),
    code: formatCode(input.codeNumber),
    firstNames: ext.firstNames?.value ?? '',
    lastNames: ext.lastNames?.value ?? (fallbackName || 'Sin nombre'),
    dni: ext.dni?.value ?? '',
    email: ext.email?.value ?? '',
    phone: ext.phone?.value ?? '',
    career: ext.career?.value.career ?? 'OTRA',
    careerName: ext.career?.value.name ?? '',
    university: ext.university?.value ?? '',
    studyYear: ext.studyYear?.value ?? 0,
    city: ext.city?.value ?? '',
    practiceType: ext.practiceType?.value ?? 'PREPROFESIONAL',
    license: ext.license?.value ?? 'NINGUNA',
    technicalCareerCertified: ext.technicalCareerCertified?.value ?? false,
    officeCertified: ext.officeCertified?.value ?? false,
    experienceMonths: ext.experienceMonths?.value ?? 0,
    experienceCertified: ext.experienceCertified?.value ?? false,
    softSkills: null,
    shift: ext.shift?.value ?? 'DIA',
    submittedAt: input.submittedAt,
    emailSubject: input.subject ?? '',
    stage: 'RECIBIDO',
    notes: '',
    missing,
    uncertain,
    evidence,
    files: input.files,
    source: input.source,
    emailMessageId: input.emailMessageId,
  };
  return { candidate, extraction: ext };
}
