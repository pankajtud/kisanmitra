import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/**
 * `navigator.onLine` only tells us the device thinks it has a link, not that
 * anything is reachable. It is good enough for the one thing we use it for:
 * deciding whether to offer voice input, which needs a server (see useSpeech).
 * Nothing in the app is ever blocked on this being true.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
