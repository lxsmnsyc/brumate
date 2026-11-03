// @vitest-environment happy-dom
// client-audit: renders every page of DIVERGENCES both ways and prints how the two differ, by
// treating each as a page that must match. Run one cause at a time with -t:
// npx vitest run test/audit/divergences.test.ts -t 'setterRefPage|refLoop'
import { DIVERGENCES } from '../differential/data.ts';
import { differential } from '../differential/run.ts';

for (const name of Object.keys(DIVERGENCES)) {
  delete DIVERGENCES[name];
}
differential(0, 1);
