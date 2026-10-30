const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * UTC time label in the operational style: `Wed 16 12Z`, or `Wed 16 12:30Z`
 * when the minutes are not zero.
 *
 * Forecast products are issued and read in UTC; formatting in the viewer's
 * local zone is a common, quiet source of off-by-hours errors.
 */
export function formatUtcShort(time: number | Date): string {
  const date = new Date(time);
  const minutes = date.getUTCMinutes();
  return `${WEEKDAYS[date.getUTCDay()]} ${pad(date.getUTCDate())} ${pad(date.getUTCHours())}${minutes ? `:${pad(minutes)}` : ''}Z`;
}

/** Full UTC timestamp: `16 Sep 2026 · 06:20Z`. */
export function formatUtcLong(time: number | Date): string {
  const date = new Date(time);
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}Z`;
}

/** Round a number for a readout without trailing noise. */
export function formatValue(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.parseFloat(value.toFixed(decimals)).toLocaleString();
}
