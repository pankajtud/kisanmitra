import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavTab } from './components/BottomNav.js';
import { PinLock, useAutoLock } from './components/PinLock.js';
import { ExpenseDetail } from './features/expenses/ExpenseDetail.js';
import { ExpenseForm } from './features/expenses/ExpenseForm.js';
import { ExpenseList } from './features/expenses/ExpenseList.js';
import { HomeScreen } from './features/expenses/HomeScreen.js';
import { EntryDetail } from './features/inventory/EntryDetail.js';
import { EntryForm } from './features/inventory/EntryForm.js';
import { InventoryList } from './features/inventory/InventoryList.js';
import { KhataDetail } from './features/khata/KhataDetail.js';
import { KhataForm } from './features/khata/KhataForm.js';
import { KhataList } from './features/khata/KhataList.js';
import { SettingsScreen } from './features/settings/SettingsScreen.js';
import { FieldsScreen } from './features/settings/FieldsScreen.js';
import { SaleForm } from './features/stock/SaleForm.js';
import { SalesList } from './features/stock/SalesList.js';
import { saveReceiptDraft } from './db/expenses.js';
import { useAppContext } from './hooks/useAppData.js';
import { processPhoto } from './lib/image.js';

/**
 * One task per screen, no tabs, no nested navigation, no hamburger menu
 * (CLAUDE.md §10) — so navigation is a stack rather than a router, which also
 * keeps routing out of the bundle (§2.5).
 *
 * The stack exists so "back" returns where the user came from: a sale reached
 * from a lot must go back to that lot, and one reached from the season list
 * back to the list.
 */
type Screen =
  | { name: 'home' }
  | { name: 'expenses' }
  | { name: 'expenseForm'; expenseId: string | null; khataId?: string | null }
  | { name: 'expenseDetail'; expenseId: string }
  | { name: 'khatas' }
  | { name: 'khataForm'; khataId: string | null }
  | { name: 'khataDetail'; khataId: string }
  | { name: 'inventory' }
  | { name: 'entryForm'; entryId: string | null }
  | { name: 'entryDetail'; entryId: string }
  | { name: 'sales' }
  | { name: 'saleForm'; lotId: string | null; saleId: string | null }
  | { name: 'settings' }
  | { name: 'fields' };

export function App() {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [locked, setLocked] = useState(true);
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const lock = useCallback(() => setLocked(true), []);
  useAutoLock(lock, !locked);

  const screen = stack[stack.length - 1]!;

  /**
   * The bottom navigation resets the stack: a tab is a destination, not
   * somewhere you push onto what you were already doing.
   */
  const navigate = useCallback((tab: NavTab) => {
    setStack([{ name: tab === 'home' ? 'home' : tab }]);
  }, []);
  const push = useCallback((next: Screen) => setStack((s) => [...s, next]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  /** Replace the top screen, so a form does not sit in the back stack after saving. */
  const replace = useCallback((next: Screen) => setStack((s) => [...s.slice(0, -1), next]), []);

  /**
   * The capture path from §8.1–8.2: downscale, write the photo and a draft
   * expense locally, *then* move to the confirmation screen. Nothing here
   * touches the network, so it behaves identically inside a cold store.
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

  // The gate goes in front of everything, including the seeded reference data.
  if (locked) return <PinLock onUnlocked={() => setLocked(false)} />;
  if (!ctx) return null;

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          ctx={ctx}
          onCapture={capture}
          onManualEntry={() => push({ name: 'expenseForm', expenseId: null })}
          onSeeExpenses={() => push({ name: 'expenses' })}
          onSeeStock={() => push({ name: 'inventory' })}
          onAddLot={() => push({ name: 'entryForm', entryId: null })}
          onSeeSales={() => push({ name: 'sales' })}
          onSettings={() => push({ name: 'settings' })}
          onNavigate={navigate}
          error={captureError}
        />
      );

    case 'expenses':
      return (
        <ExpenseList
          ctx={ctx}
          onOpen={(expenseId) => push({ name: 'expenseDetail', expenseId })}
          onCapture={capture}
          onNavigate={navigate}
        />
      );

    case 'expenseForm':
      return (
        <ExpenseForm
          ctx={ctx}
          expenseId={screen.expenseId}
          onDone={back}
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

    case 'khatas':
      return (
        <KhataList
          ctx={ctx}
          onOpen={(khataId) => push({ name: 'khataDetail', khataId })}
          onNew={() => push({ name: 'khataForm', khataId: null })}
          onNavigate={navigate}
        />
      );

    case 'khataForm':
      return (
        <KhataForm
          ctx={ctx}
          khataId={screen.khataId}
          onDone={(khataId) => replace({ name: 'khataDetail', khataId })}
          onBack={back}
        />
      );

    case 'khataDetail':
      return (
        <KhataDetail
          ctx={ctx}
          khataId={screen.khataId}
          onEdit={() => push({ name: 'khataForm', khataId: screen.khataId })}
          onAddExpense={() => push({ name: 'expenseForm', expenseId: null })}
          onAddEarning={() => push({ name: 'saleForm', lotId: null, saleId: null })}
          onOpenExpense={(expenseId) => push({ name: 'expenseDetail', expenseId })}
          onOpenEarning={(saleId, lotId) => push({ name: 'saleForm', lotId, saleId })}
          onBack={back}
        />
      );

    case 'inventory':
      return (
        <InventoryList
          ctx={ctx}
          onOpen={(entryId) => push({ name: 'entryDetail', entryId })}
          onNew={() => push({ name: 'entryForm', entryId: null })}
          onNavigate={navigate}
        />
      );

    case 'entryForm':
      return (
        <EntryForm
          ctx={ctx}
          entryId={screen.entryId}
          onDone={(entryId) => replace({ name: 'entryDetail', entryId })}
          onBack={back}
        />
      );

    case 'entryDetail':
      return (
        <EntryDetail
          ctx={ctx}
          entryId={screen.entryId}
          onEdit={() => push({ name: 'entryForm', entryId: screen.entryId })}
          onSellFromLot={(lotId) => push({ name: 'saleForm', lotId, saleId: null })}
          onOpenSale={(saleId, lotId) => push({ name: 'saleForm', lotId, saleId })}
          onDeleted={() => replace({ name: 'inventory' })}
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
        <SaleForm ctx={ctx} lotId={screen.lotId} saleId={screen.saleId} onDone={back} onBack={back} />
      );

    case 'settings':
      return (
        <SettingsScreen
          onFields={() => push({ name: 'fields' })}
          onLock={lock}
          onBack={back}
        />
      );

    case 'fields':
      return <FieldsScreen ctx={ctx} onBack={back} />;
  }
}
