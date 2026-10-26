import type { StandardSchemaV1 } from 'brumate/server';

// A small Standard Schema written by hand, so the example needs no library.

type Issues = StandardSchemaV1.Issue[];

export const Order = {
  '~standard': {
    version: 1,
    vendor: 'example-ui',
    validate(input: unknown) {
      const form = (input ?? {}) as Record<string, unknown>;
      const email = typeof form.email === 'string' ? form.email.trim() : '';
      const issues: Issues = [];
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        issues.push({ message: 'Write a whole email address', path: ['email'] });
      }
      return issues.length > 0 ? { issues } : { value: { email } };
    },
  },
} satisfies StandardSchemaV1<unknown, { email: string }>;
