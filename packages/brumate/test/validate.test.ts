import { toJSON } from 'seroval';
import * as v from 'valibot';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ServerError } from '../src/runtime/request.ts';
import {
  ValidationError,
  fieldErrors,
  handleRequest,
  handleRoute,
  actionResult,
  parse,
  parseForm,
  parseSubmission,
  safeParse,
} from '../src/runtime/server.ts';
import type { Context, RouteNode, StandardSchemaV1 } from '../src/runtime/server.ts';
import { fromChunkStream } from '../src/runtime/stream.ts';

const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
afterAll(() => errors.mockRestore());

type Person = { name: string; age?: number };

/** Checks a name of at least two letters, and an optional age. */
function checkPerson(value: unknown): StandardSchemaV1.Result<Person> {
  const input = value as { name?: unknown; age?: unknown } | null;
  const issues: StandardSchemaV1.Issue[] = [];
  if (typeof input?.name !== 'string' || input.name.length < 2) {
    issues.push({ message: 'Enter a name', path: ['name'] });
  }
  if (input?.age !== undefined && !/^\d+$/.test(String(input.age))) {
    issues.push({ message: 'Enter a number', path: [{ key: 'age' }] });
  }
  if (issues.length > 0) {
    return { issues };
  }
  const output: Person = { name: input!.name as string };
  if (input?.age !== undefined) {
    output.age = Number(input.age);
  }
  return { value: output };
}

/** A schema written by hand, with a sync or an async `validate`. */
function person(async = false): StandardSchemaV1<unknown, Person> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: async ? async (value) => checkPerson(value) : checkPerson,
    },
  };
}

/** A schema that passes any value through, to see what a form becomes. */
const anything: StandardSchemaV1<unknown, unknown> = {
  '~standard': { version: 1, vendor: 'test', validate: (value) => ({ value }) },
};

/** A schema whose issues have the paths and fields that some libraries give. */
const odd: StandardSchemaV1<unknown, never> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: () => ({
      issues: [
        { message: 'Bad id', path: [Symbol('id')] },
        { message: 'Bad item', path: ['items', { key: 2 }, 'name'], input: { secret: 1 } },
        { message: 'Bad form' },
        { message: 'Bad proto', path: ['__proto__'] },
      ] as StandardSchemaV1.Issue[],
    }),
  },
};

describe('parse', () => {
  it.each([false, true])('returns the output of the schema (async %s)', async (async) => {
    await expect(parse(person(async), { name: 'Ada', age: '36' })).resolves.toEqual({
      name: 'Ada',
      age: 36,
    });
  });

  it.each([false, true])(
    'throws a 400 ServerError with a short message (async %s)',
    async (async) => {
      const error = await parse(person(async), { name: 'A', age: 'x' }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(ServerError);
      expect((error as ServerError).status).toBe(400);
      expect((error as Error).message).toBe('name: Enter a name (1 more issue)');
      expect((error as ValidationError).issues).toEqual([
        { message: 'Enter a name', path: ['name'] },
        { message: 'Enter a number', path: ['age'] },
      ]);
    },
  );

  it('keeps the message short', async () => {
    const long: StandardSchemaV1 = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'x'.repeat(10_000) }] }),
      },
    };
    const error = (await parse(long, 1).catch((e: unknown) => e)) as Error;
    expect(error.message.length).toBeLessThan(310);
  });

  it('refuses a value that is not a Standard Schema', async () => {
    await expect(parse({} as StandardSchemaV1, 1)).rejects.toThrow(TypeError);
  });
});

describe('safeParse', () => {
  it('returns the value or the issues without throwing', async () => {
    expect(await safeParse(person(), { name: 'Ada' })).toEqual({ value: { name: 'Ada' } });
    expect(await safeParse(person(true), {})).toEqual({
      issues: [{ message: 'Enter a name', path: ['name'] }],
    });
  });

  it('turns issues into plain data that seroval writes', async () => {
    const result = await safeParse(odd, {});
    expect(result.issues).toEqual([
      { message: 'Bad id', path: ['Symbol(id)'] },
      { message: 'Bad item', path: ['items', 2, 'name'] },
      { message: 'Bad form' },
      { message: 'Bad proto', path: ['__proto__'] },
    ]);
    expect(() => toJSON(result)).not.toThrow();
  });
});

describe('fieldErrors', () => {
  it('groups messages by dotted path, with form-level ones under ""', async () => {
    const grouped = fieldErrors((await safeParse(odd, {})).issues!);
    expect(grouped).toEqual({
      'Symbol(id)': ['Bad id'],
      'items.2.name': ['Bad item'],
      '': ['Bad form', 'Bad proto'],
    });
    expect(Object.getPrototypeOf(grouped)).toBe(Object.prototype);
    expect(() => toJSON(grouped)).not.toThrow();
  });

  it('reads the raw issues of a schema too', () => {
    expect(
      fieldErrors([
        { message: 'One', path: ['a', { key: 'b' }] },
        { message: 'Two', path: ['a', 'b'] },
      ]),
    ).toEqual({ 'a.b': ['One', 'Two'] });
  });
});

/** Makes a form from entries. */
function formOf(entries: [string, string | File][]): FormData {
  const form = new FormData();
  for (const [name, value] of entries) {
    form.append(name, value);
  }
  return form;
}

describe('parseForm', () => {
  it('validates the fields of a form', async () => {
    expect(
      await parseForm(
        person(),
        formOf([
          ['name', 'Ada'],
          ['age', '36'],
        ]),
      ),
    ).toEqual({
      value: { name: 'Ada', age: 36 },
    });
    expect(await parseForm(person(true), formOf([['name', 'A']]))).toEqual({
      issues: [{ message: 'Enter a name', path: ['name'] }],
    });
  });

  it('turns repeated names, [] names, files and dotted names into values', async () => {
    const file = new File(['hi'], 'hi.txt');
    const result = await parseForm(
      anything,
      formOf([
        ['name', 'Ada'],
        ['tag', 'a'],
        ['tag', 'b'],
        ['only[]', 'x'],
        ['mixed', 'x'],
        ['mixed[]', 'y'],
        ['avatar', file],
        ['address.city', 'Paris'],
        ['address.zip', '75001'],
        ['address.geo.lat', '48.8'],
        ['items.0', 'first'],
        ['toString', 'kept'],
      ]),
    );
    expect(result.value).toEqual({
      name: 'Ada',
      tag: ['a', 'b'],
      only: ['x'],
      mixed: ['x', 'y'],
      avatar: file,
      address: { city: 'Paris', zip: '75001', geo: { lat: '48.8' } },
      items: { 0: 'first' },
      toString: 'kept',
    });
    expect((result.value as { avatar: unknown }).avatar).toBeInstanceOf(File);
  });

  it.each(['__proto__', '__proto__[]', 'a.__proto__.b', 'constructor.prototype.x', 'a..b', '.a'])(
    'refuses the name %s without running the schema',
    async (name) => {
      const validate = vi.fn<StandardSchemaV1['~standard']['validate']>(() => ({ value: {} }));
      const result = await parseForm(
        { '~standard': { version: 1, vendor: 'test', validate } },
        formOf([[name, 'polluted']]),
      );
      expect(result.issues).toEqual([{ message: 'The form has a field name that is not allowed' }]);
      expect(validate).not.toHaveBeenCalled();
      expect(({} as Record<string, unknown>).x).toBeUndefined();
      expect(({} as Record<string, unknown>).b).toBeUndefined();
      expect(Object.prototype).not.toHaveProperty('x');
      expect(Object.prototype).not.toHaveProperty('b');
    },
  );

  it.each<[string, string | File][]>([
    [
      ['a', '1'],
      ['a.b', '2'],
    ],
    [
      ['a.b', '1'],
      ['a', '2'],
    ],
    [
      ['a[]', '1'],
      ['a.b', '2'],
    ],
    [
      ['a', new File([], 'f')],
      ['a.b', '2'],
    ],
    [
      ['a[0]', '1'],
      ['a.b', '2'],
    ],
    [
      ['a.b', '1'],
      ['a[0]', '2'],
    ],
  ])('refuses names that need an object where a value is (%j)', async (...entries) => {
    const result = await parseForm(anything, formOf(entries));
    expect(result.issues).toHaveLength(1);
    expect(result.issues![0]!.message).toMatch(/conflicts with another field/);
  });

  it('makes lists of indexes in brackets', async () => {
    const result = await parseForm(
      anything,
      formOf([
        ['items[0].name', 'Tea'],
        ['items[0].tags[]', 'hot'],
        ['items[1].name', 'Milk'],
        ['grid[0][1]', 'x'],
      ]),
    );
    expect(result.value).toEqual({
      items: [{ name: 'Tea', tags: ['hot'] }, { name: 'Milk' }],
      grid: [[undefined, 'x']],
    });
  });

  it.each(['items[1000]', 'items[01]', '[0]', 'items[x]', 'items[0]extra'])(
    'refuses the index of %s',
    async (name) => {
      const result = await parseForm(anything, formOf([[name, 'x']]));
      expect(result.issues).toEqual([{ message: 'The form has a field name that is not allowed' }]);
    },
  );
});

describe('parseSubmission', () => {
  type Order = { email: string; items: { name: string }[] };
  const Order: StandardSchemaV1<unknown, Order> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate(value) {
        const { email, items = [] } = value as { email?: string; items?: { name?: string }[] };
        const issues: StandardSchemaV1.Issue[] = [];
        if (!email?.includes('@')) {
          issues.push({ message: 'Enter an email address', path: ['email'] });
        }
        items.forEach((item, index) => {
          if (!item?.name) {
            issues.push({ message: 'Name the item', path: ['items', index, 'name'] });
          }
        });
        if (items.length > 2) {
          issues.push({ message: 'Two items at most' });
        }
        return issues.length > 0
          ? { issues }
          : { value: { email: email!, items: items as { name: string }[] } };
      },
    },
  };
  const intent = (value: object): [string, string] => ['__intent', JSON.stringify(value)];

  it('gives the output of the schema, and a reply that resets', async () => {
    const submission = await parseSubmission(
      Order,
      formOf([
        ['email', 'ada@example.com'],
        ['items[0].name', 'Tea'],
      ]),
    );
    expect(submission.status).toBe('success');
    expect(submission.value).toEqual({ email: 'ada@example.com', items: [{ name: 'Tea' }] });
    const reply = submission.reply({ reset: true });
    expect(reply).toEqual({
      status: 'success',
      value: undefined,
      errors: {},
      formErrors: [],
      keys: {},
      reset: true,
      id: expect.any(String),
    });
    expect(toJSON(reply)).toBeTruthy();
  });

  it('answers the errors by field name, with the posted values', async () => {
    const submission = await parseSubmission(
      Order,
      formOf([
        ['email', 'nope'],
        ['items[0].name', ''],
        ['items[1].name', 'Milk'],
        ['items[2].name', 'Tea'],
      ]),
    );
    expect(submission.status).toBe('error');
    expect(submission.reply({ fieldErrors: { email: ['Taken'] } })).toMatchObject({
      status: 'error',
      value: { email: 'nope', items: [{ name: '' }, { name: 'Milk' }, { name: 'Tea' }] },
      errors: { email: ['Enter an email address', 'Taken'], 'items[0].name': ['Name the item'] },
      formErrors: ['Two items at most'],
    });
  });

  it('leaves files and hidden fields out of the values it sends back', async () => {
    const submission = await parseSubmission(
      Order,
      formOf([
        ['email', 'nope'],
        ['password', 'secret'],
        ['avatar', new File(['x'], 'x.txt')],
      ]),
      { hide: ['password'] },
    );
    expect(submission.reply().value).toEqual({ email: 'nope' });
  });

  it('applies an intent, with no errors and new keys for the list', async () => {
    const submission = await parseSubmission(
      Order,
      formOf([
        ['email', ''],
        ['items[0].name', 'Tea'],
        ['items[1].name', 'Milk'],
        intent({ type: 'remove', name: 'items', index: 0 }),
      ]),
    );
    expect(submission.status).toBe('intent');
    const reply = submission.reply();
    expect(reply).toMatchObject({
      status: 'intent',
      value: { email: '', items: [{ name: 'Milk' }] },
      errors: {},
      keys: { items: [`${reply.id}-0`] },
    });

    const inserted = await parseSubmission(
      Order,
      formOf([['items[0].name', 'Tea'], intent({ type: 'insert', name: 'items', index: 0 })]),
    );
    expect(inserted.reply().value).toEqual({ items: [undefined, { name: 'Tea' }] });

    const moved = await parseSubmission(
      Order,
      formOf([
        ['items[0].name', 'Tea'],
        ['items[1].name', 'Milk'],
        intent({ type: 'reorder', name: 'items', from: 1, to: 0 }),
      ]),
    );
    expect(moved.reply().value).toEqual({ items: [{ name: 'Milk' }, { name: 'Tea' }] });

    // An insert into a list that has no items yet.
    const first = await parseSubmission(Order, formOf([intent({ type: 'insert', name: 'items' })]));
    expect(first.reply().value).toEqual({ items: [undefined] });
  });

  it('answers the errors of one field for validate, and resets a field', async () => {
    const validated = await parseSubmission(
      Order,
      formOf([
        ['email', 'nope'],
        ['items[0].name', ''],
        intent({ type: 'validate', name: 'items' }),
      ]),
    );
    expect(validated.reply().errors).toEqual({ 'items[0].name': ['Name the item'] });

    const reset = await parseSubmission(
      Order,
      formOf([
        ['email', 'nope'],
        ['items[0].name', 'Tea'],
        intent({ type: 'reset', name: 'items' }),
      ]),
    );
    expect(reset.reply().value).toEqual({ email: 'nope' });
  });

  it.each([
    'not json',
    '{"type":"drop","name":"items"}',
    '{"type":"remove","name":"items","index":5}',
    '{"type":"remove","name":"email","index":0}',
    '{"type":"remove","name":"__proto__","index":0}',
    '{"type":"insert","name":"items","index":-1}',
    '{"type":"reorder","name":"items","from":0,"to":9}',
  ])('refuses the intent %s', async (value) => {
    const submission = await parseSubmission(
      Order,
      formOf([
        ['email', 'x'],
        ['items[0].name', 'Tea'],
        ['__intent', value],
      ]),
    );
    expect(submission.status).toBe('error');
    expect(submission.reply().formErrors).toEqual([
      'The form asked for a change that it cannot make',
    ]);
    expect(Object.prototype).not.toHaveProperty('0');
  });

  it('refuses a list that grows past the largest index', async () => {
    const entries: [string, string][] = Array.from({ length: 1000 }, (_, index) => [
      `items[${index}].name`,
      'x',
    ]);
    const submission = await parseSubmission(
      Order,
      formOf([...entries, intent({ type: 'insert', name: 'items' })]),
    );
    expect(submission.status).toBe('error');
  });
});

describe('a real Standard Schema library', () => {
  const SignUp = v.object({
    email: v.pipe(v.string(), v.email('Enter an email address')),
    age: v.pipe(v.string(), v.transform(Number), v.number(), v.minValue(18, 'Too young')),
    tags: v.optional(v.array(v.string()), []),
  });

  it('works with valibot', async () => {
    const ok = await parseForm(
      SignUp,
      formOf([
        ['email', 'ada@example.com'],
        ['age', '36'],
      ]),
    );
    expect(ok).toEqual({ value: { email: 'ada@example.com', age: 36, tags: [] } });
    const bad = await parseForm(
      SignUp,
      formOf([
        ['email', 'nope'],
        ['age', '3'],
      ]),
    );
    expect(fieldErrors(bad.issues!)).toEqual({
      email: ['Enter an email address'],
      age: ['Too young'],
    });
    expect(() => toJSON(bad)).not.toThrow();
    await expect(parse(SignUp, { email: 'x', age: '20' })).rejects.toThrow(
      'email: Enter an email address',
    );
  });
});

/** Server functions that validate their arguments. */
const functions = {
  save: async (input: unknown) => {
    const todo = await parse(person(true), input);
    return `saved ${todo.name}`;
  },
  signUp: async (form: FormData) => {
    const result = await parseForm(person(), form);
    if (result.issues) {
      return { errors: fieldErrors(result.issues) };
    }
    return { errors: {}, name: result.value.name };
  },
  strict: async (form: FormData) => `hi ${(await parse(person(), Object.fromEntries(form))).name}`,
};

function call(id: string, args: unknown[]): Promise<Response | undefined> {
  return handleRequest(
    functions,
    new Request(`http://localhost/_brumate/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toJSON(args)),
    }),
  );
}

function postForm(
  url: string,
  data: Record<string, string>,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { method: 'POST', headers, body: new URLSearchParams(data) });
}

describe('validation through handleRequest', () => {
  it('answers a call with bad arguments with 400 and the message', async () => {
    const response = await call('save', [{ name: 'A' }]);
    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: 'name: Enter a name' });
    expect(errors).not.toHaveBeenCalled();
  });

  it('answers a call with good arguments', async () => {
    const response = await call('save', [{ name: 'Ada' }]);
    expect(response?.status).toBe(200);
    expect(await fromChunkStream(response!.body!)).toBe('saved Ada');
  });

  it('answers a form post without scripts with 400 and text', async () => {
    const response = await handleRequest(
      functions,
      postForm('http://localhost/_brumate/strict', { name: 'A' }),
    );
    expect(response?.status).toBe(400);
    expect(response?.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response?.text()).toBe('name: Enter a name');
  });

  it('answers a form of $action from the loader with the field errors', async () => {
    const response = await handleRequest(
      functions,
      postForm('http://localhost/_brumate/signUp', { name: 'A' }, { 'x-brumate-result': '1' }),
    );
    expect(response?.status).toBe(200);
    expect(await fromChunkStream(response!.body!)).toEqual({ errors: { name: ['Enter a name'] } });
  });

  it('answers a page post with 400 and text when parse throws', async () => {
    const page: RouteNode = { page: async () => ({ default: async () => '<p>page</p>' }) };
    const response = await handleRoute(
      page,
      postForm('http://localhost/?__action=strict', { name: 'A' }),
      { functions },
    );
    expect(response?.status).toBe(400);
    expect(await response?.text()).toBe('name: Enter a name');
  });

  it('renders a page post with the field errors of parseForm', async () => {
    const page: RouteNode = {
      page: async () => ({
        default: async (_props: unknown, ctx: Context) =>
          `<p>${JSON.stringify(actionResult(ctx, functions.signUp))}</p>`,
      }),
    };
    const response = await handleRoute(
      page,
      postForm('http://localhost/?__action=signUp', { name: 'A' }),
      { functions },
    );
    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain('<p>{"errors":{"name":["Enter a name"]}}</p>');
  });
});
