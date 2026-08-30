import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * `<input capture="environment">` rather than getUserMedia: it hands off to the
 * phone's own camera app, which is the one piece of software our user already
 * knows, needs no permission dance, and works with no network.
 */
export function CameraButton({
  onPhoto,
  onError,
  className,
  children,
}: {
  onPhoto: (file: File) => Promise<void> | void;
  onError: (error: unknown) => void;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          // Reset first: picking the same file twice must still fire.
          event.target.value = '';
          if (!file) return;

          setBusy(true);
          try {
            await onPhoto(file);
          } catch (error) {
            onError(error);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
