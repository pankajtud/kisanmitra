import { useLiveQuery } from 'dexie-react-hooks';
import { formatRegisterDate, formatRupees } from '@kisanmitra/shared';
import { useTranslation } from 'react-i18next';
import { Money } from '../../components/Money.js';
import { Screen } from '../../components/Screen.js';
import type { NavTab } from '../../components/BottomNav.js';
import { EmptyState, Rows } from '../../components/ui.js';
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
  onNavigate,
}: {
  ctx: AppContext;
  onOpen: (khataId: string) => void;
  onNew: () => void;
  onNavigate: (tab: NavTab) => void;
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
      tab="khatas"
      onNavigate={onNavigate}
      action={
        <button type="button" onClick={onNew} className="btn-primary w-full text-xl">
          {t('khata.new')}
        </button>
      }
    >
      {khatas === undefined ? null : khatas.length === 0 ? (
        <EmptyState title={t('khata.empty')} action={t('khata.emptyAction')} />
      ) : (
        <Rows>
          {khatas.map(({ khata, balance, partners }) => {
            const settled = khata.status === 'settled';
            return (
              <li key={khata.id}>
                <button
                  type="button"
                  onClick={() => onOpen(khata.id)}
                  className={`card-tap w-full px-4 py-4 ${settled ? 'opacity-65' : ''}`}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xl font-bold">{khata.name}</span>
                    <span className={settled ? 'badge-done' : 'badge-open'}>
                      {settled ? t('khata.settled') : t('khata.open')}
                    </span>
                  </span>

                  <Money amount={balance.balance} tone="auto" size="lg" className="mt-1" />

                  <span className="tabular mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span className="text-debit">
                      {t('khata.expenses')} {formatRupees(balance.expenses)}
                    </span>
                    <span className="text-credit">
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
        </Rows>
      )}
    </Screen>
  );
}
