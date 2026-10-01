/** Carreras convocadas. OTRA = postulante fuera del perfil (se conserva el nombre original). */
export type Career = 'MECANICA_MECATRONICA' | 'ELECTRICA' | 'INDUSTRIAL' | 'COMERCIAL' | 'ADMINISTRACION' | 'OTRA';

/** Categorías de licencia de conducir (MTC Perú). */
export type License = 'NINGUNA' | 'A_I' | 'A_IIA' | 'A_IIB' | 'A_III';

export type Shift = 'DIA' | 'TARDE' | 'MIXTO';
export type PracticeType = 'PREPROFESIONAL' | 'PROFESIONAL';

/** Etapa del proceso, la mueve el reclutador. */
export type Stage = 'RECIBIDO' | 'EN_EVALUACION' | 'ENTREVISTA' | 'SELECCIONADO' | 'DESCARTADO';

/** Datos que el lector de CVs intenta encontrar y que pueden quedar "por revisar". */
export type VerifiableField =
  | 'career'
  | 'studyYear'
  | 'license'
  | 'officeCertified'
  | 'city'
  | 'practiceType'
  | 'experienceMonths'
  | 'experienceCertified'
  | 'technicalCareerCertified'
  | 'dni';

export type CandidateSource = 'manual' | 'excel' | 'cv' | 'correo';

/** Archivo adjunto (CV, certificados) guardado en la computadora. */
export interface CandidateFile {
  id: string;
  name: string;
  type: string;
}

export interface Candidate {
  id: string;
  code: string;
  firstNames: string;
  lastNames: string;
  dni: string;
  email: string;
  phone: string;
  career: Career;
  /** Nombre de la carrera tal como lo escribió el postulante. */
  careerName: string;
  university: string;
  /** Año de carrera que cursa (1–6). */
  studyYear: number;
  city: string;
  practiceType: PracticeType;
  license: License;
  technicalCareerCertified: boolean;
  officeCertified: boolean;
  experienceMonths: number;
  experienceCertified: boolean;
  /** Evaluación de habilidades blandas 1–5 (null = aún no evaluado). */
  softSkills: number | null;
  shift: Shift;
  /** Fecha de envío del CV, ISO `YYYY-MM-DD`. */
  submittedAt: string;
  emailSubject: string;
  stage: Stage;
  notes: string;
  /** Datos que el lector no encontró en el CV: sus requisitos quedan "por revisar". */
  missing?: VerifiableField[];
  /** Datos encontrados con poca seguridad: se muestran para verificar. */
  uncertain?: VerifiableField[];
  /** Frase del CV de donde salió cada dato. */
  evidence?: Partial<Record<VerifiableField, string>>;
  files?: CandidateFile[];
  source?: CandidateSource;
  emailMessageId?: string;
}

export type RequirementId =
  | 'PLAZO'
  | 'CARRERA'
  | 'ANIO_ESTUDIO'
  | 'BREVETE'
  | 'CARRERA_TECNICA'
  | 'OFIMATICA'
  | 'HABILIDADES_BLANDAS'
  | 'SEDE_AREQUIPA'
  | 'EXPERIENCIA';

export type RequirementStatus = 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA' | 'PENDIENTE';

export interface RequirementCheck {
  id: RequirementId;
  status: RequirementStatus;
  /** Excluyente: si no se cumple, el postulante queda "No apto". */
  mandatory: boolean;
  /** Motivo legible, se muestra al reclutador y se exporta. */
  detail: string;
}

/** APTO: cumple los requisitos. POR_EVALUAR: falta confirmar algún dato del CV. NO_APTO: incumple algo. */
export type Eligibility = 'APTO' | 'POR_EVALUAR' | 'NO_APTO';

export interface Evaluation {
  checks: RequirementCheck[];
  eligibility: Eligibility;
  score: number;
  scoreBreakdown: { label: string; points: number; max: number }[];
  warnings: string[];
}
