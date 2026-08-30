/**
 * Voice input via the Web Speech API, with graceful fallback (CLAUDE.md §4).
 *
 * Worth knowing: on Android Chrome this is *server-side* recognition, so it
 * needs a network. That collides with offline-first, and the resolution is that
 * voice is an accelerator, never a requirement — every field it fills can also
 * be tapped. When it is unavailable the microphone says why instead of
 * disappearing, so the user learns it comes back rather than thinking it broke.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechState = 'idle' | 'listening' | 'error';

export type SpeechAvailability = 'ready' | 'offline' | 'unsupported';

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = (): boolean => getRecognitionCtor() !== null;

export interface UseSpeechOptions {
  /** Hindi first, matching the rest of the app. */
  lang?: string;
  onResult: (transcript: string) => void;
}

export function useSpeech({ lang = 'hi-IN', onResult }: UseSpeechOptions) {
  const [state, setState] = useState<SpeechState>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const stop = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setState('idle');
  }, []);

  // Never leave the microphone open when the field goes away.
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setState('error');
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResultRef.current(transcript.trim());
    };
    recognition.onerror = () => setState('error');
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === 'listening' ? 'idle' : current));
    };

    recognitionRef.current = recognition;
    setState('listening');
    try {
      recognition.start();
    } catch {
      // Already started, or the permission prompt was dismissed.
      setState('error');
    }
  }, [lang]);

  return { state, start, stop, listening: state === 'listening' };
}
