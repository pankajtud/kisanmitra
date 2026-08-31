import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import {
  addField,
  archiveField,
  fieldUsage,
  listFields,
  renameField,
  restoreField,
  setFieldLocation,
} from '../../db/fields.js';
import { locationSupported, useLocation } from '../../hooks/useLocation.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Field (खेत) names are informal and per-household — "3 Bigha", "Gadhi" — so
 * they have to be editable from the phone, not only from a seed script.
 *
 * Removing a field archives it. Expenses, lots and sales point at it, and
 * deleting it outright would orphan the record of what was spent where
 * (CLAUDE.md §2.7).
 */
export function FieldsScreen({ ctx, onBack }: { ctx: AppContext; onBack: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const { capture, state: locationState } = useLocation();

  /**
   * A fix is taken where the user is standing, so this is only useful in the
   * plot itself. It needs no network — the GPS receiver works with no signal.
   */
  const markLocation = async (fieldId: string) => {
    setLocatingId(fieldId);
    try {
      const fix = await capture();
      if (fix) await setFieldLocation(fieldId, fix);
    } finally {
      setLocatingId(null);
    }
  };

  const fields = useLiveQuery(() => listFields(ctx.householdId, true), [ctx.householdId], []);
  const usage = useLiveQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(fields.map(async (f) => [f.id, await fieldUsage(f.id)] as const)),
      ),
    [fields],
    {} as Record<string, { expenses: number; lots: number }>,
  );

  const live = fields.filter((f) => f.archivedAt === null);
  const archived = fields.filter((f) => f.archivedAt !== null);

  return (
    <Screen
      title={t('fields.title')}
      onBack={onBack}
      action={
        <button
          type="button"
          disabled={draft.trim() === ''}
          onClick={() => {
            void addField(ctx.householdId, draft);
            setDraft('');
          }}
          className="btn-primary w-full text-xl disabled:opacity-40"
        >
          {t('fields.add')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <SuggestField
          label={t('fields.add')}
          value={draft}
          onChange={setDraft}
          suggestions={[]}
          placeholder={t('fields.namePlaceholder')}
          required
        />

        {live.length === 0 ? (
          <p className="card px-4 py-6 text-center text-lg text-ink-soft">{t('fields.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {live.map((field) => {
              const used = usage[field.id];
              return (
                <li key={field.id} className="card px-4 py-3">
                  {editing === field.id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="min-h-touch w-full rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg"
                        aria-label={t('fields.rename')}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void renameField(field.id, editName);
                            setEditing(null);
                          }}
                          className="btn-primary flex-1"
                        >
                          {t('fields.rename')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="btn-quiet flex-1"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xl font-bold">{field.name}</span>
                        {used && (used.expenses > 0 || used.lots > 0) ? (
                          <span className="tabular block text-sm text-ink-soft">
                            {t('fields.inUse', { expenses: used.expenses, lots: used.lots })}
                          </span>
                        ) : null}
                        {field.latitude && field.longitude ? (
                          <span className="tabular block text-sm text-credit">
                            {t('fields.marked')}
                            {field.locationAccuracyM
                              ? ` · ${t('fields.accuracy', { m: field.locationAccuracyM })}`
                              : ''}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(field.id);
                          setEditName(field.name);
                        }}
                        className="btn-quiet min-h-[2.75rem] px-3 text-base"
                      >
                        {t('fields.rename')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(field.id)}
                        className="btn-quiet min-h-[2.75rem] px-3 text-base text-danger"
                      >
                        {t('fields.archive')}
                      </button>
                    </div>
                  )}

                  {/* Where the plot is. One tap, standing in it. */}
                  {editing === field.id ? null : (
                    <div className="mt-2 border-t border-line pt-2">
                      {!locationSupported() ? (
                        <p className="text-sm text-ink-soft">{t('fields.noGps')}</p>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void markLocation(field.id)}
                            disabled={locatingId === field.id}
                            className="btn-quiet btn-sm px-2 text-brand-ink"
                          >
                            <PinIcon />
                            {locatingId === field.id
                              ? t('fields.locating')
                              : field.latitude
                                ? t('fields.location')
                                : t('fields.markHere')}
                          </button>
                          {field.latitude ? (
                            <button
                              type="button"
                              onClick={() => void setFieldLocation(field.id, null)}
                              className="btn-quiet btn-sm px-2 text-danger"
                            >
                              {t('fields.clearLocation')}
                            </button>
                          ) : null}
                          {locatingId === field.id && locationState === 'denied' ? (
                            <p className="error-text mt-1" role="alert">
                              {t('fields.denied')}
                            </p>
                          ) : null}
                          {locationState === 'failed' && locatingId === null ? (
                            <p className="error-text mt-1" role="alert">
                              {t('fields.locateFailed')}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  {confirming === field.id ? (
                    <div className="mt-3 rounded-2xl bg-danger-tint px-3 py-3">
                      <p className="mb-2 text-base font-semibold text-danger">
                        {t('fields.archiveQuestion')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void archiveField(field.id);
                            setConfirming(null);
                          }}
                          className="btn-danger flex-1"
                        >
                          {t('fields.archive')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="btn-quiet flex-1"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {archived.length > 0 ? (
          <section>
            <h2 className="mb-2 text-lg font-bold text-ink-soft">{t('fields.archived')}</h2>
            <ul className="flex flex-col gap-2">
              {archived.map((field) => (
                <li key={field.id} className="card flex items-center gap-2 px-4 py-3 opacity-70">
                  <span className="flex-1 text-lg font-semibold">{field.name}</span>
                  <button
                    type="button"
                    onClick={() => void restoreField(field.id)}
                    className="btn-secondary min-h-[2.75rem] px-4 text-base"
                  >
                    {t('fields.restore')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
