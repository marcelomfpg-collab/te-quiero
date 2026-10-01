import { CAREER_LABEL } from '../domain/catalogs';
import type { Career, License, PracticeType, Shift, VerifiableField } from '../domain/types';
import { normalize } from '../lib/text';
import { parseCareer, parseLicense } from '../services/csvImport';
import { sumExperience } from './experience';

/**
 * Lector de CVs SIN inteligencia artificial: reglas pensadas para CVs peruanos.
 * Cada dato devuelve su valor, qué tan seguro está y la frase de donde salió,
 * para que una persona pueda verificarlo de un vistazo.
 */

export type Confidence = 'alta' | 'media' | 'baja';

export interface Finding<T> {
  value: T;
  confidence: Confidence;
  evidence: string;
}

export interface CvContext {
  /** Asunto del correo: "BECARIOS 2027 - APELLIDO NOMBRE - CARRERA". */
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  fileName?: string;
  today: string;
}

export interface CvExtraction {
  firstNames?: Finding<string>;
  lastNames?: Finding<string>;
  dni?: Finding<string>;
  email?: Finding<string>;
  phone?: Finding<string>;
  career?: Finding<{ career: Career; name: string }>;
  university?: Finding<string>;
  studyYear?: Finding<number>;
  city?: Finding<string>;
  practiceType?: Finding<PracticeType>;
  license?: Finding<License>;
  officeCertified?: Finding<boolean>;
  technicalCareerCertified?: Finding<boolean>;
  experienceMonths?: Finding<number>;
  experienceCertified?: Finding<boolean>;
  shift?: Finding<Shift>;
}

// ---------- Utilidades ----------

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

/** Recorta la evidencia alrededor de la coincidencia para mostrarla al reclutador. */
function snippet(line: string, index = 0, length = 0, max = 90): string {
  if (line.length <= max) return line;
  const start = Math.max(0, index - 30);
  const out = line.slice(start, Math.min(line.length, Math.max(index + length + 30, start + max)));
  return `${start > 0 ? '…' : ''}${out}${start + out.length < line.length ? '…' : ''}`;
}

/** Busca la primera línea que cumpla el patrón (sobre texto normalizado) y devuelve la línea original. */
function findLine(all: string[], pattern: RegExp): { line: string; match: RegExpMatchArray } | null {
  for (const line of all) {
    const match = normalize(line).match(pattern);
    if (match) return { line, match };
  }
  return null;
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();

// ---------- Secciones del CV ----------

type Section = 'experiencia' | 'educacion' | 'cursos' | 'otros';

const HEADINGS: Record<Section, RegExp> = {
  experiencia: /^(experiencia( laboral| profesional| pre ?profesional)?|practicas( pre ?profesionales| profesionales)?|historial laboral|trayectoria( laboral)?)\b/,
  educacion: /^(educacion|formacion( academica| profesional)?|estudios( realizados)?|grado academico)\b/,
  cursos: /^(cursos( y certificaciones| complementarios| realizados)?|certificaciones|capacitaciones?|formacion complementaria|seminarios)\b/,
  otros: /^(habilidades|aptitudes|competencias|idiomas|referencias|datos personales|perfil( profesional)?|resumen|sobre mi|logros|conocimientos|informacion (adicional|personal)|herramientas|software|objetivo|contacto|voluntariado|intereses)\b/,
};

function isHeading(line: string): Section | null {
  const n = normalize(line).replace(/[:•\-–|]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.length > 45) return null;
  for (const name of Object.keys(HEADINGS) as Section[]) if (HEADINGS[name].test(n)) return name;
  return null;
}

/** Agrupa las líneas del CV por sección (texto antes del primer título = "otros"). */
export function splitSections(all: string[]): Record<Section, string[]> {
  const out: Record<Section, string[]> = { experiencia: [], educacion: [], cursos: [], otros: [] };
  let current: Section = 'otros';
  for (const line of all) {
    const heading = isHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    out[current].push(line);
  }
  return out;
}

// ---------- Datos personales ----------

/** Asunto "BECARIOS 2027 - QUISPE ZEGARRA ANA LUCIA - INGENIERIA INDUSTRIAL". */
export function parseSubject(subject: string): { lastNames?: string; firstNames?: string; career?: string } {
  const parts = subject.split(/\s+[-–—]\s+|\s*[-–—]{2,}\s*/).map((p) => p.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => /becari/i.test(p));
  if (idx === -1 || parts.length < idx + 2) return {};
  const name = parts[idx + 1]!.split(/\s+/);
  const career = parts[idx + 2];
  // Formato pedido: APELLIDO(S) NOMBRE(S). Con 3+ palabras se asumen dos apellidos.
  const nLast = name.length >= 3 ? 2 : 1;
  return {
    lastNames: titleCase(name.slice(0, nLast).join(' ')),
    firstNames: titleCase(name.slice(nLast).join(' ')) || undefined,
    career,
  };
}

/** "Ana Lucía Quispe Zegarra" (nombre y apellidos, orden habitual en firmas y CVs). */
function splitNaturalName(full: string): { firstNames: string; lastNames: string } | null {
  const words = full.replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return null;
  const nLast = words.length >= 3 ? 2 : 1;
  return { firstNames: titleCase(words.slice(0, -nLast).join(' ')), lastNames: titleCase(words.slice(-nLast).join(' ')) };
}

const NOT_A_NAME = /curriculum|vitae|\bcv\b|hoja de vida|perfil|datos|ingenier|estudiante|universidad|direccion|telefono|correo|email|celular|dni|@|\d/;

function nameFromCvTop(all: string[]): string | null {
  for (const line of all.slice(0, 8)) {
    const n = normalize(line);
    if (NOT_A_NAME.test(n) || isHeading(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 6 && words.every((w) => /^\p{Lu}/u.test(w) || /^(de|del|la|y)$/i.test(w))) return line;
  }
  return null;
}

// ---------- Catálogos peruanos ----------

const UNIVERSITIES: [RegExp, string][] = [
  [/\bunsa\b|nacional de san agustin/, 'UNSA'],
  [/\bucsm\b|catolica de santa maria|santa maria/, 'UCSM'],
  [/\bucsp\b|catolica san pablo|universidad san pablo/, 'UCSP'],
  [/\butp\b|tecnologica del peru/, 'UTP'],
  [/continental/, 'Universidad Continental'],
  [/\buap\b|alas peruanas/, 'UAP'],
  [/la salle/, 'Universidad La Salle'],
  [/\bucv\b|cesar vallejo/, 'UCV'],
  [/\bupn\b|privada del norte/, 'UPN'],
  [/\buni\b|nacional de ingenieria/, 'UNI'],
  [/\bunjbg\b|jorge basadre/, 'UNJBG'],
  [/\bunam\b|nacional de moquegua/, 'UNAM'],
  [/\bunsaac\b|san antonio abad/, 'UNSAAC'],
  [/\buna\b|nacional del altiplano/, 'UNA Puno'],
];

const AREQUIPA_PLACES =
  /\barequipa\b|cayma|yanahuara|cerro colorado|bustamante y rivero|jlbyr|paucarpata|miraflores|sachaca|socabaya|mariano melgar|hunter|tiabaya|characato|sabandia|alto selva alegre|selva alegre|mollebaya|yura|uchumayo|cercado de arequipa|la joya|majes|camana|mollendo/;
const OTHER_CITIES: [RegExp, string][] = [
  [/\blima\b|\blince\b|san isidro|surco|san borja|los olivos|la molina|jesus maria|pueblo libre|magdalena del mar|barranco|chorrillos|san juan de lurigancho|\bate\b|\bcomas\b|callao/, 'Lima'],
  [/\bcusco\b|\bcuzco\b/, 'Cusco'],
  [/\bpuno\b/, 'Puno'],
  [/\bjuliaca\b/, 'Juliaca'],
  [/\bmoquegua\b/, 'Moquegua'],
  [/\bilo\b/, 'Ilo'],
  [/\btacna\b/, 'Tacna'],
  [/\btrujillo\b/, 'Trujillo'],
  [/\bchiclayo\b/, 'Chiclayo'],
  [/\bpiura\b/, 'Piura'],
  [/\bhuancayo\b/, 'Huancayo'],
  [/\bica\b/, 'Ica'],
];

const ORDINAL_WORDS: Record<string, number> = {
  primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4, quinto: 5, sexto: 6,
  septimo: 7, setimo: 7, octavo: 8, noveno: 9, decimo: 10,
};
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };

// ---------- Extractores ----------

function extractStudyYear(all: string[]): Finding<number> | undefined {
  // Ciclo o semestre: "VIII ciclo", "8vo ciclo", "octavo semestre" → año = ciclo / 2 (redondeo hacia arriba).
  const cycle = findLine(all, /\b(\d{1,2})\s*(?:er|ero|do|to|vo|mo|no|ro|°|º)?\s*(?:ciclo|semestre)\b|\b(i{1,3}|iv|v|vi{1,3}|ix|x)\s+(?:ciclo|semestre)\b|\b(primer|segundo|tercer|cuarto|quinto|sexto|septimo|setimo|octavo|noveno|decimo)\s+(?:ciclo|semestre)\b|(?:ciclo|semestre)\s*:?\s*(\d{1,2}|i{1,3}|iv|v|vi{1,3}|ix|x)\b/);
  if (cycle) {
    const [, num, roman, word, after] = cycle.match;
    const raw = num ?? after;
    const n = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? ROMAN[raw] : roman ? ROMAN[roman] : ORDINAL_WORDS[word!];
    if (n && n >= 1 && n <= 12) return { value: Math.ceil(n / 2), confidence: 'alta', evidence: snippet(cycle.line, cycle.match.index, cycle.match[0].length) };
  }
  // Año de carrera: "4to año", "cuarto año" (no "4 años de experiencia").
  const year = findLine(all, /\b(\d)\s*(?:er|ero|do|to|ro|°|º)\s*ano\b(?!s)|\b(primer|segundo|tercer|cuarto|quinto|sexto)\s+ano\b(?!s)/);
  if (year) {
    const n = year.match[1] ? Number(year.match[1]) : ORDINAL_WORDS[year.match[2]!];
    if (n && n >= 1 && n <= 7) return { value: n, confidence: 'alta', evidence: snippet(year.line, year.match.index, year.match[0].length) };
  }
  return undefined;
}

function extractCareer(all: string[], subjectCareer?: string): Finding<{ career: Career; name: string }> | undefined {
  if (subjectCareer) {
    const career = parseCareer(subjectCareer);
    if (career !== 'OTRA') return { value: { career, name: CAREER_LABEL[career] }, confidence: 'alta', evidence: `Asunto del correo: ${subjectCareer}` };
  }
  const found = findLine(
    all,
    /\b(ingenieria|ing\.?)\s+(mecanica( electrica)?|mecatronica|electrica|electronica|industrial|comercial|civil|de sistemas|sistemas|de minas|minas|metalurgica|quimica|ambiental|de software|geologica|agronoma)\b|\badministracion( de empresas| y negocios| de negocios)?\b|\bcontabilidad\b|\beconomia\b/,
  );
  if (!found) return undefined;
  const career = parseCareer(found.match[0]);
  const name = career === 'OTRA' ? titleCase(found.match[0].replace(/^ing\.?\s/, 'ingenieria ')) : CAREER_LABEL[career];
  return { value: { career, name }, confidence: 'alta', evidence: snippet(found.line, found.match.index, found.match[0].length) };
}

function extractLicense(all: string[]): Finding<License> {
  const found = findLine(all, /(brevete|licencia(?:\s+de\s+conducir)?|categoria)[^a-z0-9]{0,6}(?:[a-z\s]{0,25}?)\b(a\s*[-–]?\s*(?:iii|ii|i|1|2|3)\s*[-–]?\s*[abc]?)\b/);
  if (found) {
    const license = parseLicense(found.match[2]!.replace(/\s|[-–]/g, ''));
    if (license && license !== 'NINGUNA') return { value: license, confidence: 'alta', evidence: snippet(found.line, found.match.index, found.match[0].length) };
  }
  const generic = findLine(all, /\b(brevete|licencia de conducir|licencia de manejo)\b/);
  if (generic) {
    if (/\b(no|sin)\b/.test(normalize(generic.line))) return { value: 'NINGUNA', confidence: 'media', evidence: snippet(generic.line) };
    return { value: 'A_I', confidence: 'baja', evidence: `${snippet(generic.line)} (sin categoría: verificar)` };
  }
  return { value: 'NINGUNA', confidence: 'media', evidence: 'El CV no menciona brevete ni licencia de conducir' };
}

const OFFICE = /\b(excel|ofimatica|microsoft office|ms office|office 365|office 2016|office 2019|paquete office)\b/;
const CERT_WORDS = /\b(certificad[oa]|certificacion|curso|capacitacion|diplomado|especializacion|taller|programa)\b/;

function extractOffice(sections: Record<Section, string[]>, all: string[]): Finding<boolean> {
  const inCourses = findLine(sections.cursos, OFFICE);
  if (inCourses) return { value: true, confidence: 'alta', evidence: snippet(inCourses.line, inCourses.match.index, inCourses.match[0].length) };
  for (const line of all) {
    const n = normalize(line);
    const m = n.match(OFFICE);
    if (m && CERT_WORDS.test(n)) return { value: true, confidence: 'alta', evidence: snippet(line, m.index, m[0].length) };
  }
  const mention = findLine(all, OFFICE);
  if (mention) return { value: true, confidence: 'baja', evidence: `${snippet(mention.line, mention.match.index, mention.match[0].length)} (no dice "certificado": verificar)` };
  return { value: false, confidence: 'media', evidence: 'El CV no menciona Excel ni ofimática' };
}

function extractTechnical(all: string[]): Finding<boolean> {
  const found = findLine(all, /\b(carrera tecnica|tecnico (profesional )?en|tecnico (mecanico|electricista|electrico|industrial|automotriz)|senati|tecsup|cetemin|instituto (superior )?(tecnologico|tecnico)|iestp)\b/);
  if (found) return { value: true, confidence: 'media', evidence: snippet(found.line, found.match.index, found.match[0].length) };
  return { value: false, confidence: 'media', evidence: 'No se encontró carrera técnica' };
}

function extractCity(all: string[]): Finding<string> | undefined {
  const address = all.filter((l) => /\b(direccion|domicilio|vivo en|residencia|reside|ubicacion|distrito)\b/.test(normalize(l)));
  for (const line of address) {
    // "Av. Arequipa 1450, Lince, Lima" es una calle de Lima: se quitan los nombres de vías antes de buscar.
    const n = normalize(line).replace(/\b(av|avda|avenida|calle|jr|jiron|psje|pasaje|prolongacion|urb|urbanizacion|mz)\.?\s+\p{L}+/gu, ' ');
    const m = n.match(AREQUIPA_PLACES);
    if (m) return { value: 'Arequipa', confidence: 'alta', evidence: snippet(line, m.index, m[0].length) };
    for (const [re, city] of OTHER_CITIES) {
      const o = n.match(re);
      if (o) return { value: city, confidence: 'media', evidence: snippet(line, o.index, o[0].length) };
    }
  }
  const anyAqp = findLine(all.slice(0, 15), AREQUIPA_PLACES) ?? findLine(all, AREQUIPA_PLACES);
  if (anyAqp) return { value: 'Arequipa', confidence: 'media', evidence: snippet(anyAqp.line, anyAqp.match.index, anyAqp.match[0].length) };
  return undefined;
}

function extractExperience(sections: Record<Section, string[]>, today: string): Finding<number> | undefined {
  if (!sections.experiencia.length) {
    return { value: 0, confidence: 'media', evidence: 'El CV no tiene sección de experiencia laboral' };
  }
  const result = sumExperience(sections.experiencia.join('\n'), today);
  if (!result.ranges.length) return undefined; // Hay experiencia pero sin fechas legibles: revisar.
  return {
    value: result.months,
    confidence: result.approximate ? 'baja' : 'alta',
    evidence: `${result.ranges.slice(0, 3).join(' · ')}${result.ranges.length > 3 ? ' …' : ''}${result.approximate ? ' (solo años: aproximado)' : ''}`,
  };
}

function extractExperienceCertificate(all: string[]): Finding<boolean> | undefined {
  const found = findLine(all, /\b(certificado|constancia)\s+de\s+(trabajo|practicas|prestacion de servicios|servicios|experiencia|labores)\b|\bcertifica(mos)?\s+que\b|\bse expide (el presente|la presente)\b|\bhace constar\b/);
  if (found) return { value: true, confidence: 'alta', evidence: snippet(found.line, found.match.index, found.match[0].length) };
  return undefined; // No se puede afirmar que no lo tenga: queda por revisar.
}

/** Extrae todos los datos posibles del texto del CV (y del correo, si lo hay). */
export function parseCv(text: string, ctx: CvContext): CvExtraction {
  const all = lines(text);
  const sections = splitSections(all);
  const out: CvExtraction = {};

  // Nombre: asunto del correo > remitente > encabezado del CV.
  const subj = ctx.subject ? parseSubject(ctx.subject) : {};
  if (subj.lastNames) {
    out.lastNames = { value: subj.lastNames, confidence: 'alta', evidence: `Asunto del correo` };
    if (subj.firstNames) out.firstNames = { value: subj.firstNames, confidence: 'alta', evidence: `Asunto del correo` };
  }
  if (!out.firstNames) {
    const source = ctx.senderName && !/reclutamiento|noreply|no-reply/i.test(ctx.senderName) ? ctx.senderName : nameFromCvTop(all);
    const split = source ? splitNaturalName(source) : null;
    if (split) {
      out.firstNames = { value: split.firstNames, confidence: 'media', evidence: source! };
      out.lastNames ??= { value: split.lastNames, confidence: 'media', evidence: source! };
    }
  }

  const dni = findLine(all, /\b(?:dni|d\.n\.i\.?|documento de identidad|doc\.? identidad)\b\D{0,12}(\d{8})\b/);
  if (dni) out.dni = { value: dni.match[1]!, confidence: 'alta', evidence: snippet(dni.line, dni.match.index, dni.match[0].length) };
  else {
    const bare = findLine(all, /(?<![\d+])(\d{8})(?!\d)/);
    if (bare) out.dni = { value: bare.match[1]!, confidence: 'baja', evidence: `${snippet(bare.line, bare.match.index, 8)} (sin la palabra DNI)` };
  }

  const emailMatch = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)?.find((e) => !/pacsiingenieros/i.test(e));
  if (emailMatch) out.email = { value: emailMatch.toLowerCase(), confidence: 'alta', evidence: emailMatch };
  else if (ctx.senderEmail) out.email = { value: ctx.senderEmail.toLowerCase(), confidence: 'alta', evidence: 'Remitente del correo' };

  const phone = findLine(all, /(?:\+?51[\s-]?)?(9\d{2})[\s-]?(\d{3})[\s-]?(\d{3})\b/);
  if (phone) out.phone = { value: phone.match.slice(1, 4).join(''), confidence: 'alta', evidence: snippet(phone.line, phone.match.index, phone.match[0].length) };

  out.career = extractCareer(all, subj.career);

  for (const [re, name] of UNIVERSITIES) {
    const u = findLine(sections.educacion.length ? sections.educacion : all, re) ?? findLine(all, re);
    if (u) {
      out.university = { value: name, confidence: 'alta', evidence: snippet(u.line, u.match.index, u.match[0].length) };
      break;
    }
  }

  out.studyYear = extractStudyYear(all);
  out.city = extractCity(all);

  const graduate = findLine(all, /\b(egresad[oa]|bachiller|titulad[oa]|practicas profesionales)\b/);
  const student = findLine(all, /\b(estudiante|cursando|ciclo|semestre|practicas pre ?profesionales|practicante)\b/);
  if (student) out.practiceType = { value: 'PREPROFESIONAL', confidence: 'alta', evidence: snippet(student.line, student.match.index, student.match[0].length) };
  else if (graduate) out.practiceType = { value: 'PROFESIONAL', confidence: 'media', evidence: snippet(graduate.line, graduate.match.index, graduate.match[0].length) };
  else out.practiceType = { value: 'PREPROFESIONAL', confidence: 'media', evidence: 'No indica si es egresado' };

  out.license = extractLicense(all);
  out.officeCertified = extractOffice(sections, all);
  out.technicalCareerCertified = extractTechnical(all);
  out.experienceMonths = extractExperience(sections, ctx.today);
  out.experienceCertified = extractExperienceCertificate(all);

  const shift = findLine(all, /\b(turno|horario|disponibilidad)\b[^.]{0,30}\b(manana|dia|tarde|mixto|completo)\b/);
  if (shift) {
    const v = shift.match[2];
    out.shift = { value: v === 'tarde' ? 'TARDE' : v === 'mixto' || v === 'completo' ? 'MIXTO' : 'DIA', confidence: 'media', evidence: snippet(shift.line) };
  }
  return out;
}

/** Qué datos del CV quedaron sin encontrar o con poca seguridad. */
export function reviewFlags(ext: CvExtraction): { missing: VerifiableField[]; uncertain: VerifiableField[] } {
  const fields: VerifiableField[] = ['career', 'studyYear', 'license', 'officeCertified', 'city', 'practiceType', 'experienceMonths', 'experienceCertified', 'technicalCareerCertified', 'dni'];
  const missing: VerifiableField[] = [];
  const uncertain: VerifiableField[] = [];
  for (const f of fields) {
    const finding = ext[f];
    if (!finding) missing.push(f);
    else if (finding.confidence === 'baja') uncertain.push(f);
  }
  return { missing, uncertain };
}
