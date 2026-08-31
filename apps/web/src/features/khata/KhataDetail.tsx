import { useLiveQuery } from 'dexie-react-hooks';
import {
  entryShare,
  formatRegisterDate,
  formatRupees,
  settlement,
  type Partner,
  type SharingMode,
} from '@kisanmitra/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/Screen.js';
import { balanceOf, khataLedger, khataPartners, reopenKhata, settleKhata } from '../../db/khata.js';
import { getKhata } from '../../db/khata.js';
import type { AppContext } from '../../db/seed.js';
import { useCategories, useCrops } from '../../hooks/useAppData.js';
import { useRefLabel } from '../../lib/labels.js';

/**
 * One khata opened up: everything spent, everything earned, and the balance.
 *
 * Both figures are shown — the household's own share, which is what its books
 * say, and the whole venture, which is what the partners settle against. A
 * settled khata is read-only; the partners have squared up against these
 * numbers and nothing may move behind their backs.
 */
export function KhataDetail({
  ctx,
  khataId,
  onEdit,
  onAddExpense,
  onAddEarning,
  onOpenExpense,
  onOpenEarning,
  onBack,
}: {
  ctx: AppContext;
  khataId: string;
  onEdit: () => void;
  onAddExpense: () => void;
  onAddEarning: () => void;
  onOpenExpense: (id: string) => void;
  onOpenEarning: (id: string, lotId: string | null) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const refLabel = useRefLabel();
  const categories = useCategories(ctx.householdId);
  const crops = useCrops(ctx.householdId);
  const [confirming, setConfirming] = useState(false);

  const khata = useLiveQuery(() => getKhata(khataId), [khataId]);
  const ledger = useLiveQuery(() => khataLedger(khataId), [khataId]);
  const balance = useLiveQuery(() => balanceOf(khataId), [khataId]);
  const partners = useLiveQuery(() => khataPartners(khataId), [khataId], []);

  if (khata === undefined || ledger === undefined || balance === undefined) {
    return (
      <Screen title={t('khata.title')} onBack={onBack}>
        <p className="text-lg text-ink-soft">{t('common.loading')}</p>
      </Screen>
    );
  }

  if (!khata) {
    return (
      <Screen title={t('khata.title')} onBack={onBack}>
        <p className="text-lg font-semibold text-danger" role="alert">
          {t('error.notFound')}
        </p>
      </Screen>
    );
  }

  const settled = khata.status === 'settled';
  const asPartners: Partner[] = partners.map((p) => ({
    name: p.name,
    sharePercent: p.sharePercent,
    isSelf: p.isSelf,
  }));
  const rows = settlement(asPartners, balance.grossBalance);
  const shared = partners.length > 0;

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.labelHi ?? t('list.noCategory');
  const cropName = (id: string | null) => {
    const crop = crops.find((c) => c.id === id);
    return crop ? refLabel({ labelHi: crop.nameHi, labelEn: crop.nameEn }) : null;
  };

  return (
    <Screen
      title={khata.name}
      onBack={onBack}
      action={
        settled ? (
          <button type="button" onClick={() => void reopenKhata(khata.id)} className="btn-secondary w-full text-lg">
            {t('khata.reopen')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onAddExpense} className="btn-secondary text-lg">
              {t('khata.addExpense')}
            </button>
            <button type="button" onClick={onAddEarning} className="btn-primary text-lg">
              {t('khata.addEarning')}
            </button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {settled ? (
          <p className="rounded-2xl bg-rule/50 px-4 py-3 text-center text-base font-semibold" role="status">
            {t('khata.locked')}
            {khata.settledOn ? ` · ${formatRegisterDate(khata.settledOn)}` : ''}
          </p>
        ) : null}

        <div className="card px-5 py-4">
          <span className="block text-lg font-semibold text-ink-soft">
            {shared ? t('khata.myBalance') : t('khata.balance')}
          </span>
          <span
            className={`tabular block text-5xl font-bold ${
              balance.balance < 0 ? 'text-danger' : 'text-brand-dark'
            }`}
          >
            {formatRupees(balance.balance)}
          </span>

          <dl className="tabular mt-3 flex justify-between border-t-2 border-rule pt-3 text-base">
            <div>
              <dt className="text-ink-soft">{t('khata.expenses')}</dt>
              <dd className="text-xl font-bold text-rupee">{formatRupees(balance.expenses)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-ink-soft">{t('khata.earnings')}</dt>
              <dd className="text-xl font-bold text-brand-dark">{formatRupees(balance.earnings)}</dd>
            </div>
          </dl>

          {shared ? (
            <p className="tabular mt-3 border-t-2 border-rule pt-3 text-base text-ink-soft">
              {t('khata.grossBalance')}: {formatRupees(balance.grossBalance)}
            </p>
          ) : null}
        </div>

        {/* Who gets what, once the venture is squared up. */}
        {shared ? (
          <section className="card px-4 py-4">
            <h2 className="mb-2 text-lg font-bold">{t('khata.settlementTitle')}</h2>
            <ul className="divide-y-2 divide-rule">
              {rows.map((row) => (
                <li key={row.name + String(row.isSelf)} className="flex items-baseline justify-between py-2">
                  <span className="text-lg font-semibold">
                    {row.isSelf ? t('khata.you') : row.name}
                    <span className="tabular ml-2 text-sm text-ink-soft">{row.sharePercent}%</span>
                  </span>
                  <span
                    className={`tabular text-xl font-bold ${
                      row.amount < 0 ? 'text-danger' : 'text-brand-dark'
                    }`}
                  >
                    {formatRupees(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-xl font-bold">{t('khata.ledger')}</h2>

          {ledger.expenses.length === 0 && ledger.earnings.length === 0 ? (
            <p className="card px-4 py-6 text-center text-lg text-ink-soft">{t('khata.noEntries')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ledger.earnings.map((sale) => (
                <li key={sale.id}>
                  <LedgerRow
                    onClick={() => onOpenEarning(sale.id, sale.lotId)}
                    title={cropName(sale.cropId) ?? t('sale.title')}
                    subtitle={`${formatRegisterDate(sale.soldOn)}${sale.buyer ? ` · ${sale.buyer}` : ''}`}
                    amount={entryShare(
                      {
                        amount: sale.totalAmount,
                        sharingMode: sale.sharingMode as SharingMode,
                        partnerShare: sale.partnerShare,
                      },
                      asPartners,
                    )}
                    gross={sale.totalAmount}
                    positive
                  />
                </li>
              ))}
              {ledger.expenses.map((expense) => (
                <li key={expense.id}>
                  <LedgerRow
                    onClick={() => onOpenExpense(expense.id)}
                    title={categoryName(expense.categoryId)}
                    subtitle={`${formatRegisterDate(expense.spentOn)}${
                      expense.product ? ` · ${expense.product}` : ''
                    }`}
                    amount={entryShare(
                      {
                        amount: expense.amount,
                        sharingMode: expense.sharingMode as SharingMode,
                        partnerShare: expense.partnerShare,
                      },
                      asPartners,
                    )}
                    gross={expense.amount}
                    positive={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {!settled ? (
          <>
            <button type="button" onClick={onEdit} className="btn-secondary self-start px-6">
              {t('khata.edit')}
            </button>

            {confirming ? (
              <div className="card border-brand bg-brand-tint px-4 py-4">
                <p className="mb-1 text-lg font-semibold">{t('khata.settleQuestion')}</p>
                <p className="mb-3 text-base text-ink-soft">{t('khata.settleHelp')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void settleKhata(khata.id).then(() => setConfirming(false))}
                    className="btn-primary flex-1"
                  >
                    {t('khata.settle')}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="btn-quiet flex-1">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="btn-secondary w-full">
                {t('khata.settle')}
              </button>
            )}
          </>
        ) : null}
      </div>
    </Screen>
  );
}

function LedgerRow({
  onClick,
  title,
  subtitle,
  amount,
  gross,
  positive,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
  /** The household's own share — what the balance above is built from. */
  amount: number;
  /** Face value, shown only when a split makes it differ. */
  gross: number | null;
  positive: boolean;
}) {
  const shows = gross !== null && Math.abs(gross - amount) > 0.005;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex w-full items-center gap-3 px-4 py-3 text-left active:bg-brand-tint"
    >
      <span
        aria-hidden="true"
        className={`tabular w-6 shrink-0 text-center text-2xl font-bold ${
          positive ? 'text-brand-dark' : 'text-rupee'
        }`}
      >
        {positive ? '+' : '−'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold">{title}</span>
        <span className="tabular block text-sm text-ink-soft">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={`tabular block text-xl font-bold ${positive ? 'text-brand-dark' : 'text-rupee'}`}
        >
          {formatRupees(amount)}
        </span>
        {shows ? (
          <span className="tabular block text-xs text-ink-soft">{formatRupees(gross)}</span>
        ) : null}
      </span>
    </button>
  );
}
