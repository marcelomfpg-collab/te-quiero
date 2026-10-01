import { useEffect, useState } from 'react';
import { CAREER_LABEL, LICENSE_LABEL, PRACTICE_TYPE_LABEL, REQUIREMENT_LABEL, SHIFT_LABEL, STAGES } from '../../../domain/catalogs';
import type { Stage } from '../../../domain/types';
import { formatDate } from '../../../lib/dates';
import type { CandidatePatch } from '../../../services';
import type { IndexedCandidate } from '../filters/filterEngine';
import { EligibilityBadge } from './Badges';
import { Dialog } from './Dialog';

const STATUS_ICON = { CUMPLE: '✓', NO_CUMPLE: '✕', PENDIENTE: '?', NO_APLICA: '–' } as const;
/** Etapas a las que un postulante "No apto" no puede avanzar. */
const BLOCKED_IF_NOT_ELIGIBLE: Stage[] = ['ENTREVISTA', 'SELECCIONADO'];

interface CandidateDrawerProps {
  row: IndexedCandidate;
  onClose: () => void;
  onUpdate: (id: string, patch: CandidatePatch) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CandidateDrawer({ row, onClose, onUpdate, onEdit, onDelete }: CandidateDrawerProps) {
  const { candidate: c, evaluation: e } = row;
  const [notes, setNotes] = useState(c.notes);
  useEffect(() => setNotes(c.notes), [c.id, c.notes]);

  const data: [string, string][] = [
    ['DNI', c.dni],
    ['Correo', c.email || '—'],
    ['Celular', c.phone || '—'],
    ['Carrera', c.career === 'OTRA' ? `${c.careerName} (fuera de perfil)` : CAREER_LABEL[c.career]],
    ['Universidad', `${c.university} · ${c.studyYear}° año`],
    ['Ciudad', c.city],
    ['Prácticas', PRACTICE_TYPE_LABEL[c.practiceType]],
    ['Brevete', LICENSE_LABEL[c.license]],
    ['Experiencia', `${c.experienceMonths} meses${c.experienceCertified ? ' (certificada)' : ''}`],
    ['Disponibilidad', SHIFT_LABEL[c.shift]],
    ['CV recibido', formatDate(c.submittedAt)],
    ['Asunto del correo', c.emailSubject || '—'],
  ];

  return (
    <Dialog
      variant="drawer"
      eyebrow={`${c.code} · ${c.university}`}
      title={row.fullName}
      onClose={onClose}
      header={
        <div className="drawer__status">
          <EligibilityBadge value={e.eligibility} />
          <span className="drawer__score">
            Puntaje <strong>{e.score}</strong>/100
          </span>
        </div>
      }
    >
      {e.warnings.length > 0 && (
        <div className="banner banner--warning" role="note">
          <ul className="plain-list">
            {e.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="drawer__section">
        <h3 className="drawer__heading">Etapa del proceso</h3>
        <div className="segmented" role="radiogroup" aria-label="Etapa del proceso">
          {STAGES.map((s) => {
            const blocked = e.eligibility === 'NO_APTO' && BLOCKED_IF_NOT_ELIGIBLE.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={c.stage === s.value}
                className={`segmented__item ${c.stage === s.value ? 'is-active' : ''}`}
                disabled={blocked}
                title={blocked ? 'No cumple los requisitos excluyentes' : undefined}
                onClick={() => onUpdate(c.id, { stage: s.value })}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="drawer__section">
        <h3 className="drawer__heading">Habilidades blandas</h3>
        <div className="rating" role="radiogroup" aria-label="Calificación de habilidades blandas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={c.softSkills === n}
              className={`rating__item ${c.softSkills !== null && n <= c.softSkills ? 'is-on' : ''}`}
              onClick={() => onUpdate(c.id, { softSkills: n })}
            >
              {n}
            </button>
          ))}
          {c.softSkills !== null && (
            <button type="button" className="btn btn--link" onClick={() => onUpdate(c.id, { softSkills: null })}>
              Quitar
            </button>
          )}
        </div>
        <p className="hint">Mínimo 3 para ser apto. Se califica al revisar el CV o en la entrevista.</p>
      </section>

      <section className="drawer__section">
        <h3 className="drawer__heading">Requisitos de la convocatoria</h3>
        <ul className="checklist-result">
          {e.checks.map((check) => (
            <li key={check.id} className={`checklist-result__item is-${check.status.toLowerCase()} ${check.mandatory ? '' : 'is-optional'}`}>
              <span className="checklist-result__icon" aria-hidden="true">{STATUS_ICON[check.status]}</span>
              <div>
                <span className="checklist-result__label">
                  {REQUIREMENT_LABEL[check.id]}
                  {!check.mandatory && <span className="tag">Opcional</span>}
                </span>
                <span className="muted">{check.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="drawer__section">
        <h3 className="drawer__heading">Desglose del puntaje</h3>
        <div className="breakdown">
          {e.scoreBreakdown.map((s) => (
            <div key={s.label} className="breakdown__row">
              <span>{s.label}</span>
              <span className="breakdown__bar" aria-hidden="true">
                <span style={{ width: `${(s.points / s.max) * 100}%` }} />
              </span>
              <span className="breakdown__pts">
                {s.points}/{s.max}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="drawer__section">
        <h3 className="drawer__heading">Datos del postulante</h3>
        <dl className="fields">
          {data.map(([label, value]) => (
            <div key={label} className="fields__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="drawer__section">
        <label className="drawer__heading" htmlFor="notes">
          Notas del reclutador
        </label>
        <textarea
          id="notes"
          className="textarea"
          rows={3}
          value={notes}
          placeholder="Observaciones de la entrevista, referencias…"
          onChange={(ev) => setNotes(ev.target.value)}
          onBlur={() => notes !== c.notes && onUpdate(c.id, { notes })}
        />
      </section>

      <div className="drawer__footer">
        <button type="button" className="btn btn--secondary" onClick={onEdit}>
          Editar datos
        </button>
        <button type="button" className="btn btn--danger" onClick={onDelete}>
          Eliminar postulante
        </button>
      </div>
    </Dialog>
  );
}
