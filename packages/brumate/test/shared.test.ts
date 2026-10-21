import {
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
import {
  ElementReference,
  FunctionReference,
  Upload,
  disabledFeatures,
  functionReferences,
  plugins,
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
