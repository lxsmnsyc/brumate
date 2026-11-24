import { $memo } from 'brumate/signals';

/** The loads that started, and how many of the next loads fail. */
export const calls: { config: number; failures: number } = { config: 0, failures: 1 };

async function fetchConfig(): Promise<{ theme: string }> {
  calls.config++;
  const fails = calls.failures > 0;
  calls.failures--;
  await new Promise((done) => setTimeout(done, 10));
  if (fails) {
    throw new Error('down');
  }
  return { theme: 'dark' };
}

export const config: { theme: string } = $memo(await fetchConfig());
