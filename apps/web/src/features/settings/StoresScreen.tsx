import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { SuggestField } from '../../components/SuggestField.js';
import {
  addColdStore,
  archiveColdStore,
  coldStoreUsage,
  listColdStores,
  makeDefaultColdStore,
  renameColdStore,
  restoreColdStore,
} from '../../db/coldStores.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Cold stores. The household starts with the one it uses, and can add more —
 * whether the family deals with one store or several is genuinely unknown
 * (CLAUDE.md §15.3), so neither is assumed.
 *
 * One store is the default and everything new goes there unless told otherwise.
 * Removing a store archives it: consignments point at it, and deleting one
 * would orphan the record of where produce actually sits (§2.7).
 */
export function StoresScreen({ ctx, onBack }: { ctx: AppContext; onBack: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const stores = useLiveQuery(() => listColdStores(ctx.householdId, true), [ctx.householdId], []);
  const usage = useLiveQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(stores.map(async (s) => [s.id, await coldStoreUsage(s.id)] as const)),
      ),
    [stores],
    {} as Record<string, number>,
  );

  const live = stores.filter((s) => s.archivedAt === null);
  const archived = stores.filter((s) => s.archivedAt !== null);

  return (
    <Screen
      title={t('stores.title')}
      onBack={onBack}
      action={
        <button
          type="button"
          disabled={draft.trim() === ''}
          onClick={() => {
            void addColdStore(ctx.householdId, draft);
            setDraft('');
          }}
          className="btn-primary w-full text-xl"
        >
          {t('stores.add')}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <SuggestField
          label={t('stores.add')}
          value={draft}
          onChange={setDraft}
          suggestions={[]}
          placeholder={t('stores.namePlaceholder')}
          required
        />

        {live.length === 0 ? (
          <p className="card px-4 py-6 text-center text-lg text-ink-soft">{t('stores.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {live.map((store) => (
              <li key={store.id} className="card px-4 py-3">
                {editing === store.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="input"
                      aria-label={t('stores.rename')}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void renameColdStore(store.id, editName);
                          setEditing(null);
                        }}
                        className="btn-primary flex-1"
                      >
                        {t('stores.rename')}
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-quiet flex-1">
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-bold">
                          {store.name}
                          {store.isDefault ? (
                            <span className="badge-open ml-2">{t('stores.default')}</span>
                          ) : null}
                        </span>
                        {usage[store.id] ? (
                          <span className="tabular block text-sm text-ink-soft">
                            {t('stores.inUse', { count: usage[store.id] })}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(store.id);
                          setEditName(store.name);
                        }}
                        className="btn-quiet btn-sm"
                      >
                        {t('stores.rename')}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
                      {!store.isDefault ? (
                        <button
                          type="button"
                          onClick={() => void makeDefaultColdStore(ctx.householdId, store.id)}
                          className="btn-quiet btn-sm text-brand-ink"
                        >
                          {t('stores.makeDefault')}
                        </button>
                      ) : null}
                      {live.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setConfirming(store.id)}
                          className="btn-quiet btn-sm text-danger"
                        >
                          {t('stores.archive')}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}

                {confirming === store.id ? (
                  <div className="mt-3 rounded-2xl bg-danger-tint px-3 py-3">
                    <p className="error-text mb-2">{t('stores.archiveQuestion')}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void archiveColdStore(store.id);
                          setConfirming(null);
                        }}
                        className="btn-danger flex-1"
                      >
                        {t('stores.archive')}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="btn-quiet flex-1">
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 ? (
          <section>
            <h2 className="mb-2 text-lg font-bold text-ink-soft">{t('stores.archived')}</h2>
            <ul className="flex flex-col gap-2">
              {archived.map((store) => (
                <li key={store.id} className="card flex items-center gap-2 px-4 py-3 opacity-70">
                  <span className="flex-1 text-lg font-semibold">{store.name}</span>
                  <button
                    type="button"
                    onClick={() => void restoreColdStore(store.id)}
                    className="btn-secondary btn-sm"
                  >
                    {t('stores.restore')}
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
