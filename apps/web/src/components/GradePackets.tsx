import { formatLotBreakdown, type GradePackets as GradeCount } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import type { LocalGrade } from '../db/types.js';
import { GradeMark } from './GradeMark.js';
import { Stepper } from './Stepper.js';

/**
 * The packets-per-grade editor: one row per grade, each a picture, the Hindi
 * word and a stepper (CLAUDE.md §5, §10).
 *
 * The running composite total sits at the top in the register's own notation,
 * so the user can check it against the paper as they go rather than after
 * saving.
 */
export function GradePacketsField({
  legend,
  grades,
  value,
  onChange,
  /** Per-grade ceiling, e.g. what is still unsold. */
  maxByGrade,
  error,
}: {
  legend: string;
  grades: LocalGrade[];
  value: GradeCount[];
  onChange: (next: GradeCount[]) => void;
  maxByGrade?: Record<string, number>;
  error?: string | null;
}) {
  const { t } = useTranslation();

  const packetsFor = (gradeId: string) => value.find((v) => v.gradeId === gradeId)?.packets ?? 0;

  const setPackets = (gradeId: string, packets: number) => {
    const rest = value.filter((v) => v.gradeId !== gradeId);
    onChange(packets > 0 ? [...rest, { gradeId, packets }] : rest);
  };

  const breakdown = grades
    .map((grade) => ({
      code: grade.code,
      packets: packetsFor(grade.id),
      sortOrder: grade.sortOrder,
    }))
    .filter((entry) => entry.packets > 0);

  const total = breakdown.reduce((sum, entry) => sum + entry.packets, 0);

  return (
    <fieldset>
      <legend className="label">{legend}</legend>

      {/* The register's composite format, live. This is the number the user
          recognises from the paper (§5). */}
      <output
        className={`tabular mb-3 block rounded-2xl border-2 px-4 py-3 text-center text-2xl font-bold ${
          error ? 'border-danger bg-danger-tint text-danger' : 'border-rule bg-paper-raised text-ink'
        }`}
      >
        {total > 0 ? formatLotBreakdown(breakdown) : t('stock.totalPackets', { count: 0 })}
      </output>

      {error ? (
        <p className="mb-2 text-base font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {grades.map((grade) => {
          const max = maxByGrade?.[grade.id];
          return (
            <li
              key={grade.id}
              className="card flex items-center gap-3 px-3 py-2"
              // A grade with nothing left to sell is dimmed but still visible,
              // so the list does not reshuffle as a lot empties.
              style={max === 0 ? { opacity: 0.5 } : undefined}
            >
              <GradeMark grade={grade} />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold leading-tight">{grade.labelHi}</span>
                {max !== undefined ? (
                  <span className="tabular text-sm font-medium text-ink-soft">
                    {t('stock.remaining')}: {max}
                  </span>
                ) : null}
              </span>
              <Stepper
                value={packetsFor(grade.id)}
                onChange={(next) => setPackets(grade.id, next)}
                max={max}
                label={grade.labelHi}
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
