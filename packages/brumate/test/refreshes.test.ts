import { describe, expect, it } from 'vitest';
import { ANY, refreshedNames } from '../src/refreshes.ts';

describe('refreshedNames', () => {
  it('finds the server functions that code passes to refresh, by their exported names', () => {
    const names = refreshedNames([
      "import { listNotes } from './notes.ts';\nasync function add() { 'use server'; getEvent().refresh(listNotes); }",
      "import { listIssues as issues, star } from './issues.ts';\nevent.refresh(issues);",
      'import * as api from "./api.ts";\nevent.refresh( api.feed );',
      'export async function save() { return 1; }',
    ]);
    expect([...names].toSorted()).toEqual(['feed', 'listIssues', 'listNotes']);
  });

  it('counts every function for a call that it cannot read', () => {
    expect(refreshedNames(['event.refresh(pick())'])).toContain(ANY);
    expect(refreshedNames(['event.refresh(fns[0])'])).toContain(ANY);
    expect(refreshedNames(['event.refresh()'])).not.toContain(ANY);
  });
});
