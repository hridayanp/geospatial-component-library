import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { Bounds, LngLat } from '@hridayanp/geo-utils';
import { formatLatLon, parseLatLon } from '@hridayanp/geo-inputs';
import { useMapOptional } from '@hridayanp/map-container';
import { cx, placementClass, type PanelPlacement } from '@hridayanp/ui';

/** One search hit, in whatever shape the host's geocoder returns, normalised. */
export interface LocationResult {
  /** Stable identity. */
  id: string;
  /** Primary line, e.g. `"Kochi"`. */
  label: string;
  /** Secondary line, e.g. `"Kerala, India"`. */
  description?: string;
  /** Point to fly to. */
  lngLat: LngLat;
  /** Extent to fit instead of flying to a fixed zoom, when known. */
  bounds?: Bounds;
}

export interface LocationSearchProps {
  /**
   * The geocoder. The host decides what to query — Nominatim, an internal
   * gazetteer, a list of stations — and returns normalised results. Abort the
   * request when `signal` fires; superseded queries are cancelled.
   */
  onSearch: (query: string, signal: AbortSignal) => Promise<LocationResult[]>;
  /** Fired when the user picks a result. */
  onSelect?: (result: LocationResult) => void;
  /** Move the map to the chosen result. Default `true`. */
  flyTo?: boolean;
  /** Zoom used for results without `bounds`. Default `10`. */
  flyToZoom?: number;
  /**
   * Recognise typed coordinates (`9.8, 75.9`, `9°48′N 75°54′E`, …) and offer
   * them as the first result without calling `onSearch`. Default `true`.
   */
  parseCoordinates?: boolean;
  /** Wait this long after typing stops before searching. Default `300` ms. */
  debounceMs?: number;
  /** Shortest query sent to `onSearch`. Default `2`. */
  minLength?: number;
  placeholder?: string;
  /** Corner of the map to dock to. Omit to lay it out yourself. Default `'top-left'`. */
  placement?: PanelPlacement;
  /** Width in pixels. Default `280`. */
  width?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * A place search box: type, pick a result, and the map moves there.
 *
 * Owns the interaction — debouncing, cancelling stale requests, keyboard
 * navigation, the ARIA combobox pattern — and none of the data: results come
 * from `onSearch`, so the same box searches a public geocoder, an internal
 * station list or both.
 *
 * ```tsx
 * <LocationSearch
 *   onSearch={async (q, signal) => (await geocode(q, { signal })).map(toResult)}
 *   onSelect={(place) => setSelected(place)}
 * />
 * ```
 */
export function LocationSearch({
  onSearch,
  onSelect,
  flyTo = true,
  flyToZoom = 10,
  parseCoordinates = true,
  debounceMs = 300,
  minLength = 2,
  placeholder = 'Search places or coordinates',
  placement = 'top-left',
  width = 280,
  className,
  style,
}: LocationSearchProps) {
  const context = useMapOptional();
  const map = context?.map ?? null;
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;

  useEffect(() => {
    const text = query.trim();
    const coordinate = parseCoordinates ? parseLatLon(text) : null;
    const coordinateResult: LocationResult[] = coordinate
      ? [
          {
            id: `coordinate:${coordinate.join(',')}`,
            label: formatLatLon(coordinate),
            description: 'Go to coordinate',
            lngLat: coordinate,
          },
        ]
      : [];

    if (coordinate || text.length < minLength) {
      setResults(coordinateResult);
      setLoading(false);
      setFailed(false);
      setActive(coordinateResult.length ? 0 : -1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      searchRef
        .current(text, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setActive(found.length ? 0 : -1);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults([]);
            setFailed(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, minLength, debounceMs, parseCoordinates]);

  const choose = (result: LocationResult) => {
    setQuery(result.label);
    setOpen(false);
    onSelect?.(result);
    if (!flyTo || !map) return;
    if (result.bounds) {
      const [w, s, e, n] = result.bounds;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, duration: 800, maxZoom: 14 },
      );
    } else {
      map.flyTo({ center: result.lngLat, zoom: flyToZoom, duration: 800 });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      const result = results[active];
      if (result) {
        event.preventDefault();
        choose(result);
      }
    } else if (event.key === 'Escape') {
      if (open) setOpen(false);
      else setQuery('');
    }
  };

  const showList = open && query.trim().length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div
      className={cx('gcl-panel', 'gcl-search', placementClass(placement), className)}
      style={{ width, ...style }}
    >
      <div className="gcl-search__field">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="gcl-search__icon">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className="gcl-search__input"
          type="search"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          {...(showList && active >= 0 ? { 'aria-activedescendant': optionId(active) } : {})}
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="gcl-search__spinner" aria-label="Searching" />}
      </div>
      {showList && (
        <ul className="gcl-search__results" id={listId} role="listbox">
          {results.map((result, index) => (
            <li
              key={result.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className={cx('gcl-search__result', index === active && 'is-active')}
              onMouseDown={(event) => {
                // Keep focus in the input so blur does not close the list first.
                event.preventDefault();
                choose(result);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="gcl-search__label">{result.label}</span>
              {result.description && (
                <span className="gcl-search__description">{result.description}</span>
              )}
            </li>
          ))}
          {!loading && results.length === 0 && query.trim().length >= minLength && (
            <li className="gcl-search__empty" role="presentation">
              {failed ? 'Search failed. Try again.' : 'No matches.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
