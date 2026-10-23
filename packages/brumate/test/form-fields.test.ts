import { describe, expect, it } from 'vitest';
import { formFields, formatPath, parsePath, setAt } from '../src/runtime/forms.ts';
import type { SubmissionResult } from '../src/runtime/forms.ts';

const reply = (result: Partial<SubmissionResult>): SubmissionResult => ({
  status: 'error',
  errors: {},
  formErrors: [],
  keys: {},
  id: 'r1',
  ...result,
});

describe('paths', () => {
  it('reads and writes field names', () => {
    expect(parsePath('items[0].tags[2]')).toEqual(['items', 0, 'tags', 2]);
    expect(formatPath(['items', 0, 'tags', 2])).toBe('items[0].tags[2]');
    expect(parsePath('a.0')).toEqual(['a', '0']);
    expect(setAt({ a: 1 }, ['b', 0, 'c'], 2)).toEqual({ a: 1, b: [{ c: 2 }] });
  });
});

describe('formFields', () => {
  const defaults = { email: '', subscribe: true, items: [{ name: '' }] };

  it('shows the default values before a submit', () => {
    const fields = formFields('f', defaults, undefined);
    expect(fields.email.attrs).toEqual({ name: 'email', id: 'f-email', value: '' });
    expect(fields.subscribe.attrs).toEqual({ name: 'subscribe', id: 'f-subscribe', checked: true });
    expect(fields.email.errorAttrs).toEqual({ id: 'f-email-error' });
    const [item] = fields.items.list;
    expect(item!.key).toBe('0');
    expect(item!.fields.name.attrs.name).toBe('items[0].name');
    expect(JSON.parse(item!.remove.value)).toEqual({ type: 'remove', name: 'items', index: 0 });
    expect(JSON.parse(fields.items.insert.value)).toEqual({ type: 'insert', name: 'items' });
  });

  it('shows the posted values and errors after a submit', () => {
    const fields = formFields(
      'f',
      defaults,
      reply({
        value: { email: 'nope', items: [{ name: 'Tea' }, {}] },
        errors: { email: ['Enter an email address'] },
        keys: { items: ['r1-0', 'r1-1'] },
      }),
    );
    expect(fields.email.attrs).toEqual({
      name: 'email',
      id: 'f-email',
      value: 'nope',
      'aria-invalid': 'true',
      'aria-describedby': 'f-email-error',
    });
    expect(fields.email.errorAttrs).toEqual({ id: 'f-email-error', role: 'alert' });
    // A checkbox that was not checked is not posted.
    expect(fields.subscribe.attrs.checked).toBeUndefined();
    expect(fields.items.list.map((item) => [item.key, item.fields.name.value])).toEqual([
      ['r1-0', 'Tea'],
      ['r1-1', undefined],
    ]);
  });

  it('keeps a list when none of its items were posted, and goes back to the defaults on reset', () => {
    expect(formFields('f', defaults, reply({ value: { email: 'x' } })).items.list).toEqual([]);
    const reset = formFields('f', defaults, reply({ status: 'success', reset: true }));
    expect(reset.email.attrs.value).toBe('');
    expect(reset.items.list).toHaveLength(1);
  });
});
