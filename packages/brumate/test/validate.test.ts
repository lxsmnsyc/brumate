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
  ])('refuses names that need an object where a value is (%j)', async (...entries) => {
    const result = await parseForm(anything, formOf(entries));
    expect(result.issues).toHaveLength(1);
    expect(result.issues![0]!.message).toMatch(/conflicts with another field/);
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
