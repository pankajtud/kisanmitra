import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What the user sees when something breaks.
 *
 * A React error, or a database that will not open, previously rendered nothing
 * at all — a white screen with no message, no way to retry, and nothing the
 * user could tell anyone. Errors say what went wrong and what to do, and never
 * apologise (CLAUDE.md §10).
 *
 * The technical detail is shown deliberately: it is the only thing a farmer can
 * read down a phone line to whoever supports them.
 */
export function ErrorScreen({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper px-6 py-10 text-center">
      <h1 className="text-2xl font-bold">{t('error.brokenTitle')}</h1>
      <p className="max-w-sm text-lg text-ink-soft">{t('error.brokenHelp')}</p>

      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-primary w-full max-w-xs text-xl">
          {t('error.tryAgain')}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-secondary w-full max-w-xs"
      >
        {t('error.reopen')}
      </button>

      {/* Not hidden behind a "details" toggle: the whole point is that it can be
          read out to someone who can act on it. */}
      <pre className="mt-2 max-w-full overflow-x-auto rounded-2xl bg-sunk px-4 py-3 text-left text-xs text-ink-soft">
        {error.name}: {error.message}
      </pre>

      <p className="max-w-sm text-base text-ink-soft">{t('error.dataSafe')}</p>
    </div>
  );
}

/**
 * Catches a throw during render anywhere below it. Without this, one bad render
 * takes the whole app down to a blank page.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept for a debugger attached over USB; there is no server to send it to.
    console.error('render failed', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />
      );
    }
    return this.props.children;
  }
}
