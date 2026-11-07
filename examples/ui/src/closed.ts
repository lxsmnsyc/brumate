/** The shop is closed on Sundays. The calendars of the page pass it as `isDateUnavailable`. */
export function closed(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}
