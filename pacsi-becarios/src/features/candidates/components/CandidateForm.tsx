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

type Values = Omit<Candidate, 'id' | 'code' | 'stage' | 'notes' | 'softSkills'>;

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
  if (!/^\d{8}$/.test(v.dni)) errors.dni = 'El DNI debe tener 8 dígitos';
  else if (existing.some((c) => c.dni === v.dni && c.id !== editingId)) errors.dni = 'Ya hay un postulante con este DNI';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Correo inválido';
  if (v.career === 'OTRA' && !v.careerName.trim()) errors.careerName = 'Escriba la carrera';
  if (!Number.isFinite(v.experienceMonths) || v.experienceMonths < 0) errors.experienceMonths = 'Número inválido';
  if (!v.submittedAt) errors.submittedAt = 'Ingrese la fecha';
  return errors;
}

export function CandidateForm({ initial, existing, today, onSave, onClose }: CandidateFormProps) {
  const [values, setValues] = useState<Values>(() => (initial ? { ...initial } : emptyValues(today)));
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
    const candidate: Candidate = initial
      ? { ...initial, ...values, careerName }
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
    <label className="field">
      <span className="field__label">{label}</span>
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
    <label className="check">
      <input type="checkbox" checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <Dialog title={initial ? 'Editar postulante' : 'Nuevo postulante'} eyebrow={initial?.code ?? 'Datos del CV'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
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
            <label className="field">
              <span className="field__label">Carrera *</span>
              <select value={values.career} onChange={(e) => set('career', e.target.value as Career)}>
                {CAREERS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {values.career === 'OTRA' ? text('careerName', '¿Cuál carrera?') : <span />}
            {text('university', 'Universidad')}
            <label className="field">
              <span className="field__label">Año que cursa</span>
              <select value={values.studyYear} onChange={(e) => set('studyYear', Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>{y}° año</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Tipo de prácticas</span>
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
            <label className="field">
              <span className="field__label">Brevete</span>
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
