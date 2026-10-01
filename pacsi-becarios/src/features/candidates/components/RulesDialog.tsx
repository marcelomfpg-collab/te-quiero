import { useState } from 'react';
import {
  CONFIGURABLE_REQUIREMENTS,
  defaultCareerRules,
  sameRules,
  type CareerRules,
  type ConfigurableRequirement,
  type ConvokedCareer,
  type RuleLevel,
} from '../../../domain/careerRules';
import { CAREER_LABEL } from '../../../domain/catalogs';
import { Dialog } from './Dialog';

const CAREERS = Object.keys(defaultCareerRules()) as ConvokedCareer[];

const ROW_LABEL: Record<ConfigurableRequirement, string> = {
  ANIO_ESTUDIO: 'Año de carrera',
  BREVETE: 'Brevete A-I / A-IIb',
  OFIMATICA: 'Ofimática / Excel certificado',
  EXPERIENCIA: 'Experiencia certificada',
  SEDE_AREQUIPA: 'Vive en Arequipa y es preprofesional',
  HABILIDADES_BLANDAS: 'Habilidades blandas (≥ 3)',
  CARRERA_TECNICA: 'Carrera técnica certificada',
};

const LEVELS: { value: RuleLevel; label: string }[] = [
  { value: 'EXCLUYENTE', label: 'Excluyente' },
  { value: 'OPCIONAL', label: 'Opcional' },
  { value: 'NO_APLICA', label: 'No aplica' },
];

const SHORT_CAREER: Record<ConvokedCareer, string> = {
  MECANICA_MECATRONICA: 'Mecánica / Mecatrónica',
  ELECTRICA: 'Eléctrica',
  INDUSTRIAL: 'Industrial',
  COMERCIAL: 'Comercial',
  ADMINISTRACION: 'Administración',
};

interface RulesDialogProps {
  rules: CareerRules;
  onSave: (rules: CareerRules) => void;
  onClose: () => void;
}

/** Tabla carrera × requisito: RR. HH. decide qué tan estricto es cada requisito para cada carrera. */
export function RulesDialog({ rules, onSave, onClose }: RulesDialogProps) {
  const [draft, setDraft] = useState<CareerRules>(() => structuredClone(rules));
  const isDefault = sameRules(draft, defaultCareerRules());
  const changed = !sameRules(draft, rules);

  const update = (career: ConvokedCareer, fn: (r: CareerRules[ConvokedCareer]) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next[career]);
      return next;
    });

  const toggleYear = (career: ConvokedCareer, year: number) =>
    update(career, (r) => {
      r.studyYears = r.studyYears.includes(year) ? r.studyYears.filter((y) => y !== year) : [...r.studyYears, year].sort((a, b) => a - b);
    });

  return (
    <Dialog title="Requisitos por carrera" eyebrow="Qué tan estricto es cada requisito" variant="wide" onClose={onClose}>
      <p className="dialog__lead">
        <strong>Excluyente:</strong> si no lo cumple, queda "No apto". <strong>Opcional:</strong> se muestra pero no descarta.{' '}
        <strong>No aplica:</strong> no se pide a esa carrera. El plazo y la carrera convocada siempre son excluyentes. Los cambios
        se aplican al instante a todos los postulantes.
      </p>

      <div className="rules-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th scope="col">Requisito</th>
              {CAREERS.map((c) => (
                <th key={c} scope="col" title={CAREER_LABEL[c]}>
                  {SHORT_CAREER[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONFIGURABLE_REQUIREMENTS.map((req) => (
              <tr key={req}>
                <th scope="row">{ROW_LABEL[req]}</th>
                {CAREERS.map((career) => {
                  const level = draft[career].levels[req];
                  return (
                    <td key={career}>
                      <select
                        id={`rule-${career}-${req}`}
                        className={`level level--${level.toLowerCase()}`}
                        value={level}
                        aria-label={`${ROW_LABEL[req]} para ${CAREER_LABEL[career]}`}
                        onChange={(e) => update(career, (r) => void (r.levels[req] = e.target.value as RuleLevel))}
                      >
                        {LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="rules__param">
              <th scope="row">Años aceptados</th>
              {CAREERS.map((career) => (
                <td key={career}>
                  <div className="years" role="group" aria-label={`Años aceptados para ${CAREER_LABEL[career]}`}>
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={`year ${draft[career].studyYears.includes(y) ? 'is-on' : ''}`}
                        aria-pressed={draft[career].studyYears.includes(y)}
                        onClick={() => toggleYear(career, y)}
                      >
                        {y}°
                      </button>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr className="rules__param">
              <th scope="row">Experiencia mínima (meses)</th>
              {CAREERS.map((career) => (
                <td key={career}>
                  <input
                    id={`months-${career}`}
                    type="number"
                    min={0}
                    max={60}
                    className="months"
                    value={draft[career].minExperienceMonths}
                    aria-label={`Experiencia mínima en meses para ${CAREER_LABEL[career]}`}
                    onChange={(e) => update(career, (r) => void (r.minExperienceMonths = Math.max(0, Number(e.target.value) || 0)))}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="dialog__actions dialog__actions--split">
        <button type="button" className="btn btn--link" disabled={isDefault} onClick={() => setDraft(defaultCareerRules())}>
          Volver a los requisitos del aviso
        </button>
        <div className="dialog__actions-group">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!changed}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Guardar y aplicar
          </button>
        </div>
      </div>
    </Dialog>
  );
}
