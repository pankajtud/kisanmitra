import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { balanceOf, khataPartners, listKhatas } from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';

/**
 * Every venture the household is running. Open ones first; a settled khata is
 * history and sorts below.
 *
 * The figure on each row is the household's own share of the balance, which is
 * the number they care about — not what the venture as a whole made.
 */
export function KhataList({
  ctx,
  onOpen,
  onNew,
  onBack,
}: {
  ctx: AppContext;
  onOpen: (khataId: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();

  const khatas = useLiveQuery(async () => {
    const rows = await listKhatas(ctx.householdId);
    return Promise.all(
      rows.map(async (khata) => ({
        khata,
        balance: await balanceOf(khata.id),
        partners: await khataPartners(khata.id),
      })),
    );
  }, [ctx.householdId]);

  return (
    <Screen
      title={t('khata.all')}
      onBack={onBack}
      action={
        <button type="button" onClick={onNew} className="btn-primary w-full text-xl">
          {t('khata.new')}
        </button>
      }
    >
      {khatas === undefined ? null : khatas.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-xl font-semibold">{t('khata.empty')}</p>
          <p className="mt-2 text-lg text-ink-soft">{t('khata.emptyAction')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {khatas.map(({ khata, balance, partners }) => {
            const settled = khata.status === 'settled';
            return (
              <li key={khata.id}>
                <button
                  type="button"
                  onClick={() => onOpen(khata.id)}
                  className={`card w-full px-4 py-4 text-left active:bg-brand-tint ${
                    settled ? 'opacity-70' : ''
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xl font-bold">{khata.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-0.5 text-sm font-semibold ${
                        settled ? 'bg-rule text-ink' : 'bg-brand-tint text-brand-dark'
                      }`}
                    >
                      {settled ? t('khata.settled') : t('khata.open')}
                    </span>
                  </span>

                  <span
                    className={`tabular mt-1 block text-3xl font-bold ${
                      balance.balance < 0 ? 'text-danger' : 'text-brand-dark'
                    }`}
                  >
                    {formatRupees(balance.balance)}
                  </span>

                  <span className="tabular mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span>
                      {t('khata.expenses')} {formatRupees(balance.expenses)}
                    </span>
                    <span>
                      {t('khata.earnings')} {formatRupees(balance.earnings)}
                    </span>
                    {partners.length > 0 ? (
                      <span>
                        · {partners.filter((p) => !p.isSelf).map((p) => p.name).join(', ')}
                      </span>
                    ) : null}
                    {settled && khata.settledOn ? (
                      <span>
                        · {t('khata.settledOn')} {formatRegisterDate(khata.settledOn)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
