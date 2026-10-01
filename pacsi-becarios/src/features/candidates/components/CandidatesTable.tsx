import { CAREER_LABEL } from '../../../domain/catalogs';
import { formatShortDate } from '../../../lib/dates';
import type { IndexedCandidate } from '../filters/filterEngine';
import type { SortDir, SortKey } from '../filters/filterState';
import { EligibilityBadge, StageBadge } from './Badges';
import { RequirementDots } from './RequirementDots';

interface Column {
  label: string;
  sortKey?: SortKey;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: 'Postulante', sortKey: 'name' },
  { label: 'Carrera', sortKey: 'career' },
  { label: 'Año', sortKey: 'studyYear', className: 'col--num' },
  { label: 'Requisitos' },
  { label: 'Puntaje', sortKey: 'score', className: 'col--num' },
  { label: 'Resultado', sortKey: 'eligibility' },
  { label: 'Etapa', sortKey: 'stage' },
  { label: 'Recibido', sortKey: 'submittedAt', className: 'col--date' },
];

interface CandidatesTableProps {
  rows: IndexedCandidate[];
  sortKey: SortKey;
  sortDir: SortDir;
  busy: boolean;
  selectedId: string | null;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
}

export function CandidatesTable({ rows, sortKey, sortDir, busy, selectedId, onSort, onSelect }: CandidatesTableProps) {
  return (
    <div className={`table-wrap ${busy ? 'is-busy' : ''}`} aria-busy={busy}>
      <table className="table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = col.sortKey === sortKey;
              return (
                <th key={col.label} scope="col" className={col.className} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {col.sortKey ? (
                    <button type="button" className={`th-sort ${active ? 'is-active' : ''}`} onClick={() => onSort(col.sortKey!)}>
                      {col.label}
                      <span className="th-sort__icon" aria-hidden="true">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : (
                    <span className="th-plain">{col.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { candidate: c, evaluation: e } = row;
            return (
              <tr
                key={c.id}
                className={`row row--${e.eligibility.toLowerCase()} ${c.id === selectedId ? 'is-selected' : ''}`}
                tabIndex={0}
                onClick={() => onSelect(c.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(c.id);
                  }
                }}
                aria-label={`${row.fullName}, ver evaluación`}
              >
                <td data-label="Postulante">
                  <div>
                    <span className="name">
                      {row.fullName}
                      {e.warnings.length > 0 && (
                        <span className="warn-flag" title={e.warnings.join('\n')} aria-label={`${e.warnings.length} observaciones`}>
                          !
                        </span>
                      )}
                    </span>
                    <span className="muted">{[c.university, c.dni && `DNI ${c.dni}`].filter(Boolean).join(' · ') || 'Datos por revisar'}</span>
                  </div>
                </td>
                <td data-label="Carrera">
                  <div>
                    <span>{c.career === 'OTRA' ? c.careerName : CAREER_LABEL[c.career]}</span>
                    {c.career === 'OTRA' && <span className="muted">Fuera de perfil</span>}
                  </div>
                </td>
                <td data-label="Año" className="col--num">{c.studyYear ? `${c.studyYear}°` : '—'}</td>
                <td data-label="Requisitos">
                  <RequirementDots checks={e.checks} />
                </td>
                <td data-label="Puntaje" className="col--num">
                  <span className="score">
                    <span className="score__track" aria-hidden="true">
                      <span style={{ width: `${e.score}%` }} />
                    </span>
                    <span className="score__value">{e.score}</span>
                  </span>
                </td>
                <td data-label="Resultado">
                  <EligibilityBadge value={e.eligibility} />
                </td>
                <td data-label="Etapa">
                  <StageBadge value={c.stage} />
                </td>
                <td data-label="Recibido" className="col--date">{formatShortDate(c.submittedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
