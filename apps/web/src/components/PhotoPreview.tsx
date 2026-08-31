import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPhoto } from '../db/expenses.js';

/**
 * The photo is the record (CLAUDE.md §2.2), so on the confirmation screen it
 * sits on top and the fields go below it (§8.5) — the user checks the number
 * against the paper, not against their memory.
 */
export function PhotoPreview({ receiptId }: { receiptId: string }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    void getPhoto(receiptId).then((photo) => {
      if (cancelled || !photo) return;
      objectUrl = URL.createObjectURL(photo.blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [receiptId]);

  if (!url) return null;

  return (
    <figure className="mb-5">
      <img
        src={url}
        alt={t('expense.photoAlt')}
        className="max-h-72 w-full rounded-2xl border-2 border-line bg-surface object-contain"
      />
      <figcaption className="mt-1 text-center text-sm font-medium text-ink-soft">
        {t('expense.photoSaved')}
      </figcaption>
    </figure>
  );
}
