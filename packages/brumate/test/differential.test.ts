import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAUSES, DIVERGENCES, OPT_OUTS } from './differential/data.ts';

const pages = new Set(
  readdirSync(resolve(import.meta.dirname, 'render'))
    .filter((name) => name.endsWith('.brm'))
    .map((name) => name.slice(0, -4)),
);

describe('differential data', () => {
  it('names pages that exist, once', () => {
    for (const name of [...Object.keys(OPT_OUTS), ...Object.keys(DIVERGENCES)]) {
      expect(pages.has(name), `${name} is not a page of test/render`).toBe(true);
    }
    for (const name of Object.keys(DIVERGENCES)) {
      expect(OPT_OUTS[name], `${name} is an opt-out and a divergence`).toBeUndefined();
    }
  });

  it('uses every cause, and names only causes that exist', () => {
    const used = new Set(Object.values(DIVERGENCES));
    for (const cause of used) {
      expect(CAUSES[cause], `${cause} is not in CAUSES`).toBeDefined();
    }
    for (const cause of Object.keys(CAUSES)) {
      expect(used.has(cause), `${cause} has no page`).toBe(true);
    }
  });
});
