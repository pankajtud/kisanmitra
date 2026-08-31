import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import { addField, archiveField, fieldUsage, listFields, renameField, restoreField } from '../../db/fields.js';
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
