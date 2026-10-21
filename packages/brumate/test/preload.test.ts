// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoaderOptions } from '../src/runtime/loader.ts';

/** An IntersectionObserver that the test drives: it records what is observed. */
class FakeObserver {
  static all: FakeObserver[] = [];
  readonly observed = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  readonly options?: IntersectionObserverInit;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeObserver.all.push(this);
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  unobserve(element: Element): void {
    this.observed.delete(element);
  }

  disconnect(): void {
    this.observed.clear();
  }

  /** Reports the observed elements as in view. */
  show(): void {
    const records = [...this.observed].map(
      (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
    );
    this.callback(records, this as unknown as IntersectionObserver);
  }
}

/** The loader's observer of elements near the viewport. */
function observer(): FakeObserver {
  return FakeObserver.all[0]!;
}

let idle: (() => void)[] = [];
let stop: (() => void) | undefined;
const load = vi.fn<LoaderOptions['load']>();

beforeEach(() => {
  FakeObserver.all = [];
  idle = [];
  load.mockReset();
  load.mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => idle.push(callback));
  document.body.innerHTML = [
    '<button class="near" b-on="click=Near_1#h0">Near</button>',
    '<button class="none" data-prefetch="none" b-on="click=None_1#h0">None</button>',
  ].join('');
});

afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function startLoader(options: Partial<LoaderOptions> = {}): Promise<void> {
  vi.resetModules();
  const { start } = await import('../src/runtime/loader.ts');
  stop = start({ load, navigate: false, ...options });
}

/** Runs the idle callbacks that the loader asked for. */
function runIdle(): void {
  for (const callback of idle.splice(0)) {
    callback();
  }
}

describe('idle preload', () => {
  it('loads the code of handlers near the viewport once the page is idle after load', async () => {
    await startLoader();
    // Nothing loads, or waits for idle, before `load`.
    expect(idle).toHaveLength(0);
    expect(observer().observed.size).toBe(0);
    expect(load).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveLength(1);
    expect(load).not.toHaveBeenCalled();
    runIdle();
    // The element with `prefetch="none"` is left out.
    expect([...observer().observed].map((element) => element.className)).toEqual(['near']);
    expect(observer().options?.rootMargin).toBeTruthy();
    expect(load).not.toHaveBeenCalled();

    observer().show();
    expect(load.mock.calls).toEqual([['Near_1']]);
  });

  it('observes handlers that stream in after the page is idle', async () => {
    await startLoader();
    window.dispatchEvent(new Event('load'));
    runIdle();
    const late = document.createElement('button');
    late.setAttribute('b-on', 'click=Late_1#h0');
    document.body.append(late);
    await vi.waitFor(() => expect(observer().observed.has(late)).toBe(true));
  });

  it.each([
    ['the browser asks to save data', { saveData: true }],
    ['the connection is 2G', { effectiveType: '2g' }],
    ['the connection is slow 2G', { effectiveType: 'slow-2g' }],
  ])('loads nothing when %s', async (_, connection) => {
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { connection }));
    await startLoader();
    window.dispatchEvent(new Event('load'));
    runIdle();
    expect(idle).toHaveLength(0);
    expect(observer().observed.size).toBe(0);
  });

  it('loads nothing with `preload: false`', async () => {
    await startLoader({ preload: false });
    window.dispatchEvent(new Event('load'));
    runIdle();
    expect(observer().observed.size).toBe(0);
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the parts of the handlers, and a merged module as it is', async () => {
    const part = vi.fn<(name: string) => Promise<Record<string, unknown>>>((name) =>
      Promise.resolve({ name }),
    );
    load.mockImplementation((id) =>
      Promise.resolve(
        id === 'Split_1' ? { id, props: {}, g: {}, load: part } : { id, props: {}, g: {} },
      ),
    );
    document.body.innerHTML = [
      '<button class="split" b-on="click=Split_1#h0 input=Split_1#h3">Split</button>',
      '<template b-client="visible=Split_1#c5"></template><p>Client</p>',
      '<button class="merged" b-on="click=Merged_1#h0">Merged</button>',
    ].join('');
    await startLoader();
    window.dispatchEvent(new Event('load'));
    runIdle();
    observer().show();
    await vi.waitFor(() => expect(part).toHaveBeenCalledTimes(2));
    // The handler parts only: a `$client` part waits for its own trigger.
    expect(part.mock.calls).toEqual([['h0'], ['h3']]);
    expect(load.mock.calls.map(([id]) => id).toSorted()).toEqual([
      'Merged_1',
      'Split_1',
      'Split_1',
    ]);
  });

  it('still loads on hover with the default strategy', async () => {
    await startLoader({ preload: false });
    document.querySelector('.near')!.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(load.mock.calls).toEqual([['Near_1']]);
  });
});
