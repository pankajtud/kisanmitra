import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExpenseDetail } from './features/expenses/ExpenseDetail.js';
import { ExpenseForm } from './features/expenses/ExpenseForm.js';
import { ExpenseList } from './features/expenses/ExpenseList.js';
import { HomeScreen } from './features/expenses/HomeScreen.js';
import { saveReceiptDraft } from './db/expenses.js';
import { useAppContext } from './hooks/useAppData.js';
import { processPhoto } from './lib/image.js';

/**
 * One task per screen, no tabs, no nested navigation, no hamburger menu
 * (CLAUDE.md §10) — so navigation is a single piece of state rather than a
 * router. That also keeps ~10 KB of routing out of the bundle (§2.5).
 */
type Screen =
  | { name: 'home' }
  | { name: 'list' }
  | { name: 'form'; expenseId: string | null }
  | { name: 'detail'; expenseId: string };

export function App() {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [captureError, setCaptureError] = useState<string | null>(null);

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
        setScreen({ name: 'form', expenseId });
      } catch {
        setCaptureError(t('error.photoFailed'));
      }
    },
    [ctx, t],
  );

  if (!ctx) return null;

  switch (screen.name) {
    case 'home':
      return (
        <HomeScreen
          ctx={ctx}
          onCapture={capture}
          onManualEntry={() => setScreen({ name: 'form', expenseId: null })}
          onSeeAll={() => setScreen({ name: 'list' })}
          error={captureError}
        />
      );

    case 'list':
      return (
        <ExpenseList
          ctx={ctx}
          onOpen={(expenseId) => setScreen({ name: 'detail', expenseId })}
          onCapture={capture}
          onBack={() => setScreen({ name: 'home' })}
        />
      );

    case 'form':
      return (
        <ExpenseForm
          ctx={ctx}
          expenseId={screen.expenseId}
          onDone={() => setScreen({ name: 'list' })}
          onBack={() => setScreen({ name: 'home' })}
        />
      );

    case 'detail':
      return (
        <ExpenseDetail
          ctx={ctx}
          expenseId={screen.expenseId}
          onEdit={() => setScreen({ name: 'form', expenseId: screen.expenseId })}
          onDeleted={() => setScreen({ name: 'list' })}
          onBack={() => setScreen({ name: 'list' })}
        />
      );
  }
}
