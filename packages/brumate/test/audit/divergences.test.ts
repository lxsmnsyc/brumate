// @vitest-environment happy-dom
// client-audit: renders every page of DIVERGENCES both ways and prints how the two differ, by
// treating each as a page that must match. Run one cause at a time with -t:
// AUDIT=1 npx vitest run test/audit/divergences.test.ts -t ' (setterRefPage|refLoop)$'
// Without AUDIT the file skips, so `pnpm test` stays green.
import { describe } from 'vitest';
import { DIVERGENCES } from '../differential/data.ts';
import { differential } from '../differential/run.ts';

describe.runIf(Boolean(process.env.AUDIT))('audit', () => {
  for (const name of Object.keys(DIVERGENCES)) {
    delete DIVERGENCES[name];
  }
  differential(0, 1);
});
