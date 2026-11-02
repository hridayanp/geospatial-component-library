import { useEffect, useState } from 'react';

/**
 * Resolution state for a sample dataset.
 *
 * The stories fetch and decode their data asynchronously, exactly as a
 * consuming application would. Every layer in the library accepts `null` as a
 * supported value for its `data` prop, so the pending state needs no
 * placeholder — the layer simply renders nothing until the value arrives.
 */
export interface AssetState<T> {
  value: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to one of the memoised loaders in `./assets`.
 *
 * `load` must be a stable reference — the module-scope loaders are, and each
 * memoises its own promise, so mounting several stories against the same
 * dataset decodes it once.
 */
export function useAsset<T>(load: () => Promise<T>): AssetState<T> {
  const [state, setState] = useState<AssetState<T>>({
    value: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) =>
      current.value ? current : { value: null, loading: true, error: null },
    );

    load().then(
      (value) => {
        if (!cancelled) setState({ value, loading: false, error: null });
      },
      (cause: unknown) => {
        if (cancelled) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        // Surfaced rather than swallowed: a layer renders nothing for both a
        // pending load and a failed one, so a silent rejection would be
        // indistinguishable from an empty dataset.
        console.error('[stories] sample dataset failed to load:', error);
        setState({ value: null, loading: false, error });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [load]);

  return state;
}
