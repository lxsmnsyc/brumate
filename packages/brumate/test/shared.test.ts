import {
  crossSerialize,
  fromCrossJSON,
  fromJSON,
  getPlainObjectPlugins,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from 'seroval';
import type { SerovalNode } from 'seroval';
import { describe, expect, it } from 'vitest';
import { raw, rawHTML, spread } from '../src/runtime/html.ts';
import { callPlugins, disabledFeatures, plugins, syncPlugins } from '../src/runtime/serial.ts';
import { stateScript, streamState } from '../src/runtime/server.ts';
import { dedupe, withEvent } from '../src/runtime/request.ts';
import { functionReferences } from '../src/runtime/calls.ts';
import { ElementReference, FunctionReference, stateValues } from '../src/runtime/shared.ts';

const handler = (): void => {};
functionReferences.set(handler, new FunctionReference('Card_x1#h2', 4));

const component = Object.assign(() => '', { brumateId: 'Card_x1' });

/** A value with each plugin's type, in the shapes that the runtime sends. */
function sample(): unknown {
  return {
    element: new ElementReference(1, 2),
    handler,
    html: raw('<b>bold</b>'),
    component,
    url: new URL('https://example.com/a?b=c'),
    params: new URLSearchParams('x=1&y=2'),
    headers: new Headers({ 'x-a': '1' }),
    exception: new DOMException('Gone', 'AbortError'),
    list: [new ElementReference(5, 6), raw('<i>one</i>')],
  };
}

const options = { plugins, disabledFeatures };

function stream(value: unknown): Promise<SerovalNode[]> {
  return new Promise((resolve, reject) => {
    const nodes: SerovalNode[] = [];
    toCrossJSONStream(value, {
      ...options,
      refs: new Map(),
      onParse: (node) => {
        nodes.push(node);
      },
      onError: reject,
      onDone: () => resolve(nodes),
    });
  });
}

/** The parts of a value that came back, to compare with `sample()`. */
function summary(value: unknown): unknown {
  const result = value as Record<string, unknown>;
  return {
    element: result.element,
    handler: result.handler,
    html: rawHTML(result.html as ReturnType<typeof raw>),
    component: (result.component as { brumateId: string }).brumateId,
    url: String(result.url),
    params: String(result.params),
    headers: Object.fromEntries(result.headers as Headers),
    exception: [
      (result.exception as DOMException).name,
      (result.exception as DOMException).message,
    ],
  };
}

const expected = {
  element: new ElementReference(1, 2),
  handler: new FunctionReference('Card_x1#h2', 4),
  html: '<b>bold</b>',
  component: 'Card_x1',
  url: 'https://example.com/a?b=c',
  params: 'x=1&y=2',
  headers: { 'x-a': '1' },
  exception: ['AbortError', 'Gone'],
};

// The server, the stream of a call and the browser read each other's output, so the nodes stay the same.
describe('seroval plugins', () => {
  it('make the same nodes in each mode', async () => {
    const sync = toJSON(sample(), options);
    const cross = toCrossJSON(sample(), { ...options, refs: new Map() });
    expect(await toJSONAsync(sample(), options)).toEqual(sync);
    expect(await toCrossJSONAsync(sample(), { ...options, refs: new Map() })).toEqual(cross);
    expect(await stream(sample())).toEqual([cross]);
    expect(JSON.stringify(sync)).toMatchSnapshot('vanilla');
    expect(JSON.stringify(cross)).toMatchSnapshot('cross');
  });

  it('read back what they wrote', async () => {
    expect(summary(fromJSON(toJSON(sample(), options), options))).toEqual(expected);
    expect(summary(fromJSON(await toJSONAsync(sample(), options), options))).toEqual(expected);
    const [node] = await stream(sample());
    expect(summary(fromCrossJSON(node!, { ...options, refs: new Map() }))).toEqual(expected);
  });
});

/** Runs the code of a state record, as the core does, with the references of its render. */
function runRecord(code: string, refs: unknown[] = []): unknown {
  // oxlint-disable-next-line no-new-func -- The code is a state record from the server.
  const read = new Function(`return ($R,$b)=>(${code})`)() as (
    refs: unknown[],
    values: typeof stateValues,
  ) => unknown;
  return read(refs, stateValues);
}

describe('plain objects', () => {
  it('skips every plugin test for object literals', () => {
    // seroval tests no plugin on a plain object when every plugin opts out.
    expect(getPlainObjectPlugins(plugins) ?? []).toEqual([]);
    expect(Object.getPrototypeOf(raw('<b>x</b>'))).not.toBe(Object.prototype);
    const parsed = fromCrossJSON(
      toCrossJSON({ html: raw('<b>x</b>') }, { ...options, refs: new Map() }),
      {
        ...options,
        refs: new Map(),
      },
    ) as { html: Parameters<typeof rawHTML>[0] };
    expect(rawHTML(parsed.html)).toBe('<b>x</b>');
  });
});

describe('state records', () => {
  it('make the values of the plugins with the functions that the core passes', () => {
    const code = crossSerialize(sample(), { ...options, refs: new Map() });
    expect(code).toMatchSnapshot('cross code');
    expect(summary(runRecord(code))).toEqual(expected);
  });

  it('refer to values of earlier records, and settle their promises', async () => {
    const shared = { name: 'Ada' };
    let settle!: (value: unknown) => void;
    const later = new Promise((done) => {
      settle = done;
    });
    const codes: string[] = [];
    const done = streamState({ 0: { s: [shared, later] } }, (code) => codes.push(code));
    settle({ again: shared });
    await done;
    expect(codes).toHaveLength(2);
    const refs: unknown[] = [];
    const state = runRecord(codes[0]!, refs) as Record<number, { s: unknown[] }>;
    runRecord(codes[1]!, refs);
    const [first, promise] = state[0]!.s as [object, Promise<{ again: object }>];
    expect((await promise).again).toBe(first);
  });

  it('cannot end their script or open a comment, whatever the strings hold', async () => {
    const strings = [
      '</script><script>alert(1)</script>',
      '</SCRIPT >',
      '<!--<script>',
      'line\u2028separator\u2029paragraph',
      '\u0000 \\ " \' `${x}`',
    ];
    const value = {
      strings,
      [strings[0]!]: strings[2],
      html: raw(strings[0]!),
      error: new TypeError(strings[0]),
      map: new Map([[strings[1]!, strings[3]!]]),
      url: new URL(`https://example.com/?q=${encodeURIComponent(strings[0]!)}`),
    };
    const codes: string[] = [];
    await streamState({ 0: { s: [value] } }, (code) => codes.push(code));
    const script = stateScript(codes[0]!, true, { next: 1, define: true });
    // The only end tag is the script's own, and no comment opens in it.
    expect(script.toLowerCase().indexOf('</script')).toBe(script.length - '</script>'.length);
    expect(script).not.toContain('<!--');
    expect(script).not.toContain('\u2028');
    expect(script).not.toContain('\u2029');
    const read = (runRecord(codes[0]!) as Record<number, { s: [typeof value] }>)[0]!.s[0];
    expect(read.strings).toEqual(strings);
    expect((read as Record<string, unknown>)[strings[0]!]).toBe(strings[2]);
    expect(rawHTML(read.html)).toBe(strings[0]);
    expect(read.error).toBeInstanceOf(TypeError);
    expect(read.error.message).toBe(strings[0]);
    // The stack trace stays on the server.
    expect(codes[0]).not.toContain('stack');
    expect([...read.map]).toEqual([[strings[1], strings[3]]]);
    expect(String(read.url)).toBe(String(value.url));
  });

  it('refuse code that would end the script', () => {
    expect(() => stateScript('"</script>"')).toThrow('would end its script');
    expect(() => stateScript('"<!--"')).toThrow('would end its script');
  });

  it('do not write regular expressions', async () => {
    await expect(streamState({ 0: { s: [/a+$/] } }, () => {})).rejects.toThrow(
      /Seroval Error|cannot be parsed/,
    );
  });
});

describe('spread attributes', () => {
  it('leaves out names that are not one attribute', () => {
    expect(
      spread({
        title: 'a',
        'data-x': 'b',
        'x onclick="alert(1)"': 'c',
        'a>b': 'd',
        'a/b': 'e',
        'a=b': 'f',
        '': 'g',
      }),
    ).toBe(' title="a" data-x="b"');
  });
});

/** A stream of the given chunks. */
function chunks(...values: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      values.forEach((value) => controller.enqueue(value));
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<string>): Promise<string[]> {
  const read: string[] = [];
  for await (const chunk of stream) {
    read.push(chunk);
  }
  return read;
}

describe('streams', () => {
  it('are left out of the sync modes, which would write an empty stream', () => {
    expect(() => toJSON(chunks('a'), { plugins: syncPlugins, disabledFeatures })).toThrow(
      'A stream needs the async or stream mode',
    );
  });

  it('are left out of the sync modes as plain objects too', () => {
    const iterable = { [Symbol.asyncIterator]: async function* () {} };
    expect(() => toJSON(iterable, { plugins: syncPlugins, disabledFeatures })).toThrow(
      'A stream needs the async or stream mode',
    );
  });

  it('stream their chunks in the page state', async () => {
    const codes: string[] = [];
    await streamState({ 0: { s: [chunks('a', 'b')] } }, (code) => codes.push(code));
    const refs: unknown[] = [];
    const state = runRecord(codes[0]!, refs) as Record<number, { s: [ReadableStream<string>] }>;
    for (const code of codes.slice(1)) {
      runRecord(code, refs);
    }
    expect(await readAll(state[0]!.s[0])).toEqual(['a', 'b']);
  });

  it('keep calls with a stream in their arguments apart', () => {
    let count = 0;
    const read = dedupe((_stream: ReadableStream<string>) => ++count, 'read');
    const results = withEvent(undefined, () => [read(chunks('a')), read(chunks('b'))], new Map());
    expect(results).toEqual([1, 2]);
  });
});

/** A request with a body. */
function postRequest(): Request {
  return new Request('https://example.com/', { method: 'POST', body: 'hi' });
}

describe('web values', () => {
  it('send a live signal as it is now, without waiting for it to abort', async () => {
    const signal = new AbortController().signal;
    const json = await toJSONAsync(signal, options);
    expect((fromJSON(json, options) as AbortSignal).aborted).toBe(false);
    const [node] = await stream(signal);
    expect((fromCrossJSON(node!, { ...options, refs: new Map() }) as AbortSignal).aborted).toBe(
      false,
    );
  });

  it('send a request with its body in the page state and in answers', async () => {
    const codes: string[] = [];
    await streamState({ 0: { s: [postRequest()] } }, (code) => codes.push(code));
    const refs: unknown[] = [];
    const state = runRecord(codes[0]!, refs) as Record<number, { s: [Request] }>;
    for (const code of codes.slice(1)) {
      runRecord(code, refs);
    }
    expect(await state[0]!.s[0].text()).toBe('hi');
    const read = new Map();
    let answer: Request | undefined;
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(postRequest(), {
        ...options,
        refs: new Map(),
        onParse: (node, initial) => {
          if (initial) {
            answer = fromCrossJSON(node, { ...options, refs: read });
          } else {
            fromCrossJSON(node, { ...options, refs: read });
          }
        },
        onError: reject,
        onDone: resolve,
      });
    });
    expect(await answer!.text()).toBe('hi');
  });
});

/** Sends arguments as a call does, and reads them as the server does, with the files of the form. */
async function sendArgs(args: unknown[]): Promise<{ files: Blob[]; read: unknown[] }> {
  const files: Blob[] = [];
  const json = await toJSONAsync(args, { plugins: callPlugins(files), disabledFeatures });
  const form = new FormData();
  files.forEach((file, index) => form.set(`file${index}`, file));
  const read = fromJSON<unknown[]>(JSON.parse(JSON.stringify(json)), {
    plugins: callPlugins(undefined, form),
    disabledFeatures,
  });
  return { files, read };
}

describe('uploads', () => {
  it('send files and blobs from anywhere in the arguments as parts of the form', async () => {
    const file = new File(['hi'], 'hi.txt', { type: 'text/plain' });
    const blob = new Blob(['b']);
    const data = new FormData();
    data.set('title', 'Notes');
    data.set('attachment', file);
    const { files, read } = await sendArgs([
      file,
      { nested: [blob] },
      new Map([['key', file]]),
      new Set([blob]),
      data,
    ]);
    // A file that comes twice is sent once, and both places get the same file.
    expect(files).toEqual([file, blob]);
    const [first, object, map, set, form] = read as [
      File,
      { nested: Blob[] },
      Map<string, File>,
      Set<Blob>,
      FormData,
    ];
    expect(first.name).toBe('hi.txt');
    expect(await first.text()).toBe('hi');
    expect(await object.nested[0]!.text()).toBe('b');
    expect(map.get('key')).toBe(first);
    expect([...set][0]).toBe(object.nested[0]);
    expect(form.get('title')).toBe('Notes');
    expect(await (form.get('attachment') as File).text()).toBe('hi');
  });

  it('refuse a file outside the arguments of a call', async () => {
    const codes: string[] = [];
    await expect(
      streamState({ 0: { s: [new Blob(['x'])] } }, (code) => codes.push(code)),
    ).rejects.toThrow('A file or a blob can only be sent in the arguments of a server function');
    expect(() =>
      fromJSON(
        JSON.parse(
          JSON.stringify(toJSON([0], { plugins, disabledFeatures })).replace(
            '{"t":0,"s":0}',
            '{"t":25,"i":1,"s":{"i":{"t":0,"s":0}},"c":"brumate/upload"}',
          ),
        ),
        { plugins, disabledFeatures },
      ),
    ).toThrow('A file of the call is missing');
  });
});
