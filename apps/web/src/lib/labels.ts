import { useTranslation } from 'react-i18next';

/**
 * Reference-data rows carry their own Hindi and English labels, so they do not
 * go through `t()` — they are data, not strings in a component (CLAUDE.md §11).
 *
 * Grades are the exception and always render `label_hi`: मोटा stays मोटा in the
 * English UI too (§11), alongside its photograph.
 */
export function useRefLabel() {
  const { i18n } = useTranslation();
  const english = i18n.language.startsWith('en');
  return (row: { labelHi: string; labelEn: string }) => (english ? row.labelEn : row.labelHi);
}
