// The value of a Meter or a ProgressBar, as useMeter and useProgressBar of React Aria count it.

export interface ProgressState {
  /** From 0 to 100. */
  percentage: number;
  /** The value as the locale writes it, such as "40%". */
  valueText: string;
  /** The value inside the range, which aria-valuenow gives, as useProgressBar of React Aria. */
  value: number;
}

/** The state that the `content` of a ProgressBar gets. An indeterminate bar has no value. */
export interface ProgressBarState {
  percentage: number | undefined;
  valueText: string | undefined;
  isIndeterminate: boolean;
}

/** The share of the range that the value fills, and its text in the locale. */
export function progressOf(
  value: number,
  minValue: number,
  maxValue: number,
  locale: string,
  formatOptions: Intl.NumberFormatOptions = { style: 'percent' },
): ProgressState {
  const clamped = Math.min(Math.max(value, minValue), maxValue);
  const share = maxValue === minValue ? 0 : (clamped - minValue) / (maxValue - minValue);
  const format = new Intl.NumberFormat(locale, formatOptions);
  return {
    percentage: share * 100,
    valueText: format.format(formatOptions.style === 'percent' ? share : clamped),
    value: clamped,
  };
}
