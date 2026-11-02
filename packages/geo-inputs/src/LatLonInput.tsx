import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import type { LngLat } from '@hridayanp/geo-utils';
import { cx } from '@hridayanp/ui';
import {
  formatLatLon,
  parseLatLon,
  type CoordinateFormat,
  type ParseLatLonOptions,
} from './coordinates';

export interface LatLonInputProps extends ParseLatLonOptions {
  /** Current position, `[longitude, latitude]`, or `null` when empty. */
  value: LngLat | null;
  /** Fired with a valid position, or `null` when the field is cleared. */
  onChange: (value: LngLat | null) => void;
  /** Notation the committed value is displayed in. Default `'decimal'`. */
  format?: CoordinateFormat;
  /** Decimal places for the display notation. */
  precision?: number;
  /** Visible label. Omit and pass `aria-label` when the label lives elsewhere. */
  label?: string;
  'aria-label'?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Message shown when the text cannot be read. Default explains the accepted forms. */
  invalidMessage?: string;
  id?: string;
  className?: string;
}

/**
 * A single text field for a latitude/longitude pair.
 *
 * People paste coordinates in whatever notation their source uses — decimal,
 * degrees-minutes-seconds, hemisphere letters before or after, latitude first
 * or not. This field accepts all of them (see `parseLatLon`), commits on Enter
 * or blur, and redisplays the result in one consistent notation, so what the
 * user sees after committing is exactly what the application received.
 *
 * ```tsx
 * <LatLonInput label="Location" value={point} onChange={setPoint} format="ddm" />
 * ```
 */
export function LatLonInput({
  value,
  onChange,
  format = 'decimal',
  precision,
  order,
  label,
  placeholder = '9.80°N 75.90°E',
  disabled,
  invalidMessage = 'Enter a position such as 9.80°N 75.90°E, 9°48′N 75°54′E or 9.8, 75.9.',
  id,
  className,
  ...rest
}: LatLonInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const display = (position: LngLat | null) =>
    position ? formatLatLon(position, { format, ...(precision != null ? { precision } : {}) }) : '';

  const [draft, setDraft] = useState(() => display(value));
  const [invalid, setInvalid] = useState(false);

  // An external change to the value replaces whatever is being typed.
  useEffect(() => {
    setDraft(display(value));
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.[0], value?.[1], format, precision]);

  const commit = () => {
    const text = draft.trim();
    if (text === '') {
      setInvalid(false);
      if (value !== null) onChange(null);
      return;
    }
    const parsed = parseLatLon(text, order ? { order } : {});
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(display(parsed));
    if (!value || parsed[0] !== value[0] || parsed[1] !== value[1]) onChange(parsed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      setDraft(display(value));
      setInvalid(false);
    }
  };

  return (
    <div className={cx('gcl-field', invalid && 'gcl-field--invalid', className)}>
      {label && (
        <label className="gcl-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className="gcl-input gcl-input--mono"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        {...(rest['aria-label'] ? { 'aria-label': rest['aria-label'] } : {})}
      />
      {invalid && (
        <p className="gcl-field__error" id={errorId} role="alert">
          {invalidMessage}
        </p>
      )}
    </div>
  );
}
