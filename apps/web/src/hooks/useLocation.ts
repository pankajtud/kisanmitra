/**
 * A one-tap GPS fix, taken standing in the plot.
 *
 * The phone's receiver needs no network — a fix works in a field with no signal
 * — so this stays inside the offline-first rule (CLAUDE.md §2.1) and costs
 * nothing in bundle. Drawing the plot on a map is a different matter: map tiles
 * come over the network and a map library is 40 KB+ against a 200 KB budget, so
 * that is deliberately not here. See docs/open-questions.md Q23.
 */
import { useCallback, useState } from 'react';

export interface Fix {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

export type LocationState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'failed';

export const locationSupported = (): boolean => 'geolocation' in navigator;

export function useLocation() {
  const [state, setState] = useState<LocationState>('idle');

  const capture = useCallback((): Promise<Fix | null> => {
    if (!locationSupported()) {
      setState('unavailable');
      return Promise.resolve(null);
    }

    setState('locating');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState('idle');
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: Number.isFinite(position.coords.accuracy)
              ? Math.round(position.coords.accuracy)
              : null,
          });
        },
        (error) => {
          // Told apart because the fixes differ: permission is a settings
          // problem, a timeout is "walk into the open and try again".
          setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed');
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          // A field boundary is worth waiting for, but not forever.
          timeout: 20_000,
          // A fix from a few minutes ago is fine; the plot has not moved.
          maximumAge: 300_000,
        },
      );
    });
  }, []);

  return { state, capture, locating: state === 'locating' };
}
