import { useState, type FormEvent } from 'react';
import { CAREER_LABEL, CAREERS, LICENSES, PRACTICE_TYPES, SHIFTS } from '../../../domain/catalogs';
import { formatCode, maxCodeNumber, newId } from '../../../domain/codes';
import { CONVOCATORIA } from '../../../domain/convocatoria';
import type { Candidate, Career, License, PracticeType, Shift } from '../../../domain/types';
import { messageOf } from '../hooks/useCandidates';
import { Dialog } from './Dialog';

interface CandidateFormProps {
  /** Si se pasa, el formulario edita; si no, crea uno nuevo. */
  initial?: Candidate;
  existing: Candidate[];
  today: string;
  onSave: (candidate: Candidate) => Promise<void>;
  onClose: () => void;
}

type Values = Omit<Candidate, 'id' | 'code' | 'stage' | 'notes' | 'softSkills' | 'missing' | 'uncertain' | 'evidence' | 'files' | 'source' | 'emailMessageId'>;

function emptyValues(today: string): Values {
  return {
    firstNames: '',
    lastNames: '',
    dni: '',
    email: '',
    phone: '',
    career: 'MECANICA_MECATRONICA',
    careerName: '',
    university: '',
    studyYear: 4,
    city: CONVOCATORIA.city,
    practiceType: 'PREPROFESIONAL',
    license: 'NINGUNA',
    technicalCareerCertified: false,
    officeCertified: false,
    experienceMonths: 0,
    experienceCertified: false,
    shift: 'DIA',
    submittedAt: today,
    emailSubject: '',
  };
}

export function validateValues(v: Values, existing: Candidate[], editingId?: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.firstNames.trim()) errors.firstNames = 'Ingrese los nombres';
  if (!v.lastNames.trim()) errors.lastNames = 'Ingrese los apellidos';
  if (v.studyYear < 1) errors.studyYear = 'Indique el año que cursa';
  if (!/^\d{8}$/.test(v.dni)) errors.dni = 'El DNI debe tener 8 dígitos';
  else if (existing.some((c) => c.dni === v.dni && c.id !== editingId)) errors.dni = 'Ya hay un postulante con este DNI';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Correo inválido';
  if (v.career === 'OTRA' && !v.careerName.trim()) errors.careerName = 'Escriba la carrera';
  if (!Number.isFinite(v.experienceMonths) || v.experienceMonths < 0) errors.experienceMonths = 'Número inválido';
  if (!v.submittedAt) errors.submittedAt = 'Ingrese la fecha';
  return errors;
}

export function CandidateForm({ initial, existing, today, onSave, onClose }: CandidateFormProps) {
  const [values, setValues] = useState<Values>(() => {
    if (!initial) return emptyValues(today);
    const { id: _id, code: _c, stage: _s, notes: _n, softSkills: _ss, missing: _m, uncertain: _u, evidence: _e, files: _f, source: _src, emailMessageId: _mid, ...rest } = initial;
    return rest;
  });
  /** Datos que el lector de CVs no encontró o no está seguro: se resaltan para revisarlos. */
  const flagged = new Set<string>([...(initial?.missing ?? []), ...(initial?.uncertain ?? [])]);
  const flag = (key: string) => (flagged.has(key) ? ' 🔍' : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateValues(values, existing, initial?.id);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setSaveError(null);
    const careerName = values.career === 'OTRA' ? values.careerName.trim() : CAREER_LABEL[values.career];
    // Al guardar, la persona confirma los datos: dejan de estar "por revisar".
    const candidate: Candidate = initial
      ? { ...initial, ...values, careerName, missing: [], uncertain: [] }
      : { ...values, careerName, id: newId(), code: formatCode(maxCodeNumber(existing) + 1), stage: 'RECIBIDO', notes: '', softSkills: null };
    try {
      await onSave(candidate);
      onClose();
    } catch (error) {
      setSaveError(messageOf(error, 'No se pudo guardar.'));
      setSaving(false);
    }
  };

  const text = (key: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`field ${flagged.has(key) ? 'is-flagged' : ''}`}>
      <span className="field__label">{label}{flag(key)}</span>
      <input
        value={String(values[key] ?? '')}
        aria-invalid={!!errors[key]}
        onChange={(e) => set(key, (props.type === 'number' ? Number(e.target.value) : e.target.value) as never)}
        {...props}
      />
      {errors[key] && <span className="field__error">{errors[key]}</span>}
    </label>
  );

  const check = (key: 'technicalCareerCertified' | 'officeCertified' | 'experienceCertified', label: string) => (
    <label className={`check ${flagged.has(key) ? 'is-flagged' : ''}`}>
      <input type="checkbox" checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}{flag(key)}
    </label>
  );

  return (
    <Dialog title={initial ? 'Editar postulante' : 'Nuevo postulante'} eyebrow={initial?.code ?? 'Datos del CV'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {flagged.size > 0 && (
          <p className="banner banner--info">
            Los campos con 🔍 no se encontraron en el CV o no son seguros. Revíselos con el CV abierto; al guardar quedan confirmados.
          </p>
        )}
        <fieldset className="form__group">
          <legend>Datos personales</legend>
          <div className="form__grid">
            {text('firstNames', 'Nombres *', { autoFocus: true })}
            {text('lastNames', 'Apellidos *')}
            {text('dni', 'DNI *', { inputMode: 'numeric', maxLength: 8 })}
            {text('phone', 'Celular', { inputMode: 'tel' })}
            {text('email', 'Correo', { type: 'email' })}
            {text('city', 'Ciudad de residencia')}
          </div>
        </fieldset>

        <fieldset className="form__group">
          <legend>Estudios</legend>
          <div className="form__grid">
            <label className={`field ${flagged.has('career') ? 'is-flagged' : ''}`}>
              <span className="field__label">Carrera *{flag('career')}</span>
              <select value={values.career} onChange={(e) => set('career', e.target.value as Career)}>
                {CAREERS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {values.career === 'OTRA' ? text('careerName', '¿Cuál carrera?') : <span />}
            {text('university', 'Universidad')}
            <label className={`field ${flagged.has('studyYear') ? 'is-flagged' : ''}`}>
              <span className="field__label">Año que cursa{flag('studyYear')}</span>
              <select value={values.studyYear} onChange={(e) => set('studyYear', Number(e.target.value))}>
                {values.studyYear === 0 && <option value={0}>No indicado</option>}
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>{y}° año</option>
                ))}
              </select>
              {errors.studyYear && <span className="field__error">{errors.studyYear}</span>}
            </label>
            <label className={`field ${flagged.has('practiceType') ? 'is-flagged' : ''}`}>
              <span className="field__label">Tipo de prácticas{flag('practiceType')}</span>
              <select value={values.practiceType} onChange={(e) => set('practiceType', e.target.value as PracticeType)}>
                {PRACTICE_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Disponibilidad</span>
              <select value={values.shift} onChange={(e) => set('shift', e.target.value as Shift)}>
                {SHIFTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="form__group">
          <legend>Requisitos</legend>
          <div className="form__grid">
            <label className={`field ${flagged.has('license') ? 'is-flagged' : ''}`}>
              <span className="field__label">Brevete{flag('license')}</span>
              <select value={values.license} onChange={(e) => set('license', e.target.value as License)}>
                {LICENSES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {text('experienceMonths', 'Meses de experiencia', { type: 'number', min: 0, max: 120 })}
          </div>
          <div className="form__checks">
            {check('officeCertified', 'Tiene certificado de ofimática / Excel')}
            {check('experienceCertified', 'La experiencia está certificada')}
            {check('technicalCareerCertified', 'Tiene carrera técnica certificada (opcional)')}
          </div>
        </fieldset>

        <fieldset className="form__group">
          <legend>Correo recibido</legend>
          <div className="form__grid">
            {text('submittedAt', 'Fecha de envío *', { type: 'date' })}
            <span />
          </div>
          {text('emailSubject', 'Asunto del correo', { placeholder: CONVOCATORIA.subjectFormat })}
        </fieldset>

        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar postulante'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
