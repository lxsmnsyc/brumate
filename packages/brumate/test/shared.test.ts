import {
  crossSerialize,
  fromCrossJSON,
  fromJSON,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from 'seroval';
import type { SerovalNode } from 'seroval';
import { describe, expect, it } from 'vitest';
import { raw, rawHTML } from '../src/runtime/html.ts';
import { disabledFeatures, plugins } from '../src/runtime/serial.ts';
import { stateScript, streamState } from '../src/runtime/server.ts';
import {
  ElementReference,
  FunctionReference,
  Upload,
  functionReferences,
  stateValues,
} from '../src/runtime/shared.ts';

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
    upload: new Upload(3),
    url: new URL('https://example.com/a?b=c'),
    params: new URLSearchParams('x=1&y=2'),
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
      onParse: (node) => nodes.push(node),
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
    upload: result.upload,
    url: String(result.url),
    params: String(result.params),
  };
}

const expected = {
  element: new ElementReference(1, 2),
  handler: new FunctionReference('Card_x1#h2', 4),
  html: '<b>bold</b>',
  component: 'Card_x1',
  upload: new Upload(3),
  url: 'https://example.com/a?b=c',
  params: 'x=1&y=2',
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

describe('state records', () => {
  it('make the values of the plugins with the functions that the core passes', () => {
    const { upload: _, ...value } = sample() as Record<string, unknown>;
    const code = crossSerialize(value, { ...options, refs: new Map() });
    expect(code).toMatchSnapshot('cross code');
    const { upload: __, ...rest } = expected;
    expect(summary({ ...(runRecord(code) as object), upload: undefined })).toEqual({
      ...rest,
      upload: undefined,
    });
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
