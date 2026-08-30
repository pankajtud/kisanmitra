import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExpenseDetail } from './features/expenses/ExpenseDetail.js';
import { ExpenseForm } from './features/expenses/ExpenseForm.js';
import { ExpenseList } from './features/expenses/ExpenseList.js';
import { HomeScreen } from './features/expenses/HomeScreen.js';
import { FieldsScreen } from './features/settings/FieldsScreen.js';
import { LotDetail } from './features/stock/LotDetail.js';
import { LotForm } from './features/stock/LotForm.js';
import { SaleForm } from './features/stock/SaleForm.js';
import { SalesList } from './features/stock/SalesList.js';
import { StockList } from './features/stock/StockList.js';
import { saveReceiptDraft } from './db/expenses.js';
import { useAppContext } from './hooks/useAppData.js';
import { processPhoto } from './lib/image.js';

/**
 * One task per screen, no tabs, no nested navigation, no hamburger menu
 * (CLAUDE.md §10) — so navigation is a stack of screens rather than a router.
 * That also keeps routing out of the bundle (§2.5).
 *
 * The stack exists so "back" returns where the user came from: a sale can be
 * reached from a lot or from the season sales list, and it must go back to
 * whichever it was.
 */
type Screen =
  | { name: 'home' }
  | { name: 'expenses' }
  | { name: 'expenseForm'; expenseId: string | null }
  | { name: 'expenseDetail'; expenseId: string }
  | { name: 'stock' }
  | { name: 'lotForm'; lotId: string | null }
  | { name: 'lotDetail'; lotId: string }
  | { name: 'sales' }
  | { name: 'saleForm'; lotId: string | null; saleId: string | null }
  | { name: 'fields' };

export function App() {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const screen = stack[stack.length - 1]!;
  const push = useCallback((next: Screen) => setStack((s) => [...s, next]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  /** Replace the current screen, so a form does not sit in the back stack after saving. */
  const replace = useCallback((next: Screen) => setStack((s) => [...s.slice(0, -1), next]), []);
  const home = useCallback(() => setStack([{ name: 'home' }]), []);

  /**
   * The capture path from §8.1–8.2: downscale, write the photo and a draft
   * expense to the local database, *then* move to the confirmation screen.
   * Nothing here touches the network, so it behaves identically inside a cold
   * store with no signal.
   */
  const capture = useCallback(
    async (file: File) => {
      if (!ctx) return;
      setCaptureError(null);
      try {
        const photo = await processPhoto(file);
        const { expenseId } = await saveReceiptDraft(ctx, photo);
        push({ name: 'expenseForm', expenseId });
      } catch {
        setCaptureError(t('error.photoFailed'));
      }
    },
    [ctx, push, t],
  );

  if (!ctx) return null;

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          ctx={ctx}
          onCapture={capture}
          onManualEntry={() => push({ name: 'expenseForm', expenseId: null })}
          onSeeExpenses={() => push({ name: 'expenses' })}
          onSeeStock={() => push({ name: 'stock' })}
          onAddLot={() => push({ name: 'lotForm', lotId: null })}
          onSeeSales={() => push({ name: 'sales' })}
          onSettings={() => push({ name: 'fields' })}
          error={captureError}
        />
      );

    case 'expenses':
      return (
        <ExpenseList
          ctx={ctx}
          onOpen={(expenseId) => push({ name: 'expenseDetail', expenseId })}
          onCapture={capture}
          onBack={back}
        />
      );

    case 'expenseForm':
      return (
        <ExpenseForm
          ctx={ctx}
          expenseId={screen.expenseId}
          onDone={() => replace({ name: 'expenses' })}
          onBack={back}
        />
      );

    case 'expenseDetail':
      return (
        <ExpenseDetail
          ctx={ctx}
          expenseId={screen.expenseId}
          onEdit={() => push({ name: 'expenseForm', expenseId: screen.expenseId })}
          onDeleted={() => replace({ name: 'expenses' })}
          onBack={back}
        />
      );

    case 'stock':
      return (
        <StockList
          ctx={ctx}
          onOpen={(lotId) => push({ name: 'lotDetail', lotId })}
          onAddLot={() => push({ name: 'lotForm', lotId: null })}
          onBack={back}
        />
      );

    case 'lotForm':
      return (
        <LotForm
          ctx={ctx}
          lotId={screen.lotId}
          onDone={(lotId) => replace({ name: 'lotDetail', lotId })}
          onBack={back}
        />
      );

    case 'lotDetail':
      return (
        <LotDetail
          ctx={ctx}
          lotId={screen.lotId}
          onEdit={() => push({ name: 'lotForm', lotId: screen.lotId })}
          onAddSale={() => push({ name: 'saleForm', lotId: screen.lotId, saleId: null })}
          onOpenSale={(saleId) => push({ name: 'saleForm', lotId: screen.lotId, saleId })}
          onDeleted={() => replace({ name: 'stock' })}
          onBack={back}
        />
      );

    case 'sales':
      return (
        <SalesList
          ctx={ctx}
          onOpen={(saleId, lotId) => push({ name: 'saleForm', lotId, saleId })}
          // A sale started from the season list is produce sold off the field;
          // a lot sale is started from the lot it comes out of.
          onAddSale={() => push({ name: 'saleForm', lotId: null, saleId: null })}
          onBack={back}
        />
      );

    case 'saleForm':
      return (
        <SaleForm
          ctx={ctx}
          lotId={screen.lotId}
          saleId={screen.saleId}
          onDone={back}
          onBack={back}
        />
      );

    case 'fields':
      return <FieldsScreen ctx={ctx} onBack={back} />;
  }

  // Unreachable: every screen is handled above. Returning home beats a blank
  // page if a future screen is ever added without a case.
  home();
  return null;
}
