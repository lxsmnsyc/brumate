import type { StandardSchemaV1 } from 'brumate/server';
import { LABELS } from './labels.ts';

// Small Standard Schemas written by hand, so the example needs no library.
// A schema of Valibot, Zod or ArkType is the same kind of object.

type Issues = StandardSchemaV1.Issue[];

/** A schema from a function that pushes an issue for each problem it finds. */
function schema<T>(check: (input: unknown, issues: Issues) => T) {
  const result: StandardSchemaV1<unknown, T> = {
    '~standard': {
      version: 1,
      vendor: 'tracker',
      validate(input) {
        const issues: Issues = [];
        const value = check(input, issues);
        return issues.length > 0 ? { issues } : { value };
      },
    },
  };
  return result;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const fields = (input: unknown) => (input ?? {}) as Record<string, unknown>;

/** The fields of the new issue form. `labels[]` checkboxes arrive as `labels`. */
export const NewIssue = schema((form, issues) => {
  const input = fields(form);
  const title = text(input.title);
  if (title.length < 3) {
    issues.push({ message: 'Write a title of at least 3 characters', path: ['title'] });
  } else if (title.length > 80) {
    issues.push({ message: 'Keep the title under 80 characters', path: ['title'] });
  }
  const labels = Array.isArray(input.labels) ? (input.labels as string[]) : [];
  if (labels.some((label) => !LABELS.includes(label))) {
    issues.push({ message: 'Pick labels from the list', path: ['labels'] });
  }
  return { title, body: text(input.body), labels };
});

/** The sign-in form: a name, and the page to go back to. */
export const SignInForm = schema((form, issues) => {
  const input = fields(form);
  const name = text(input.name);
  if (!/^[\p{L} '-]{2,30}$/u.test(name)) {
    issues.push({ message: 'Use 2 to 30 letters', path: ['name'] });
  }
  // Only a path of this site, so the form cannot send the user elsewhere.
  const next = text(input.next);
  return { name, next: next.startsWith('/') && !next.startsWith('//') ? next : '/' };
});

/** The ID of an issue, as a number from a handler or a string from a form. */
export const IssueId = schema((input, issues) => {
  const id = Number(input);
  if (!Number.isInteger(id) || id < 1) {
    issues.push({ message: 'Not an issue ID' });
  }
  return id;
});
