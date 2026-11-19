// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTransition } from '../../src/runtime/view-transitions.ts';

type Callback = () => unknown;

interface Fake {
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
}

/** Makes `document.startViewTransition` run the callback and settle as the test says. */
function fakeTransitions(settle: 'finish' | 'skip'): { calls: number; seen: string[][] } {
  const state = { calls: 0, seen: [] as string[][] };
  (document as unknown as { startViewTransition: unknown }).startViewTransition = (
    callback: Callback | { update: Callback },
  ): Fake => {
    state.calls++;
    const update = typeof callback === 'function' ? callback : callback.update;
    state.seen.push(names());
    const done = Promise.resolve()
      .then(update)
      .then(() => {});
    const finished = done.then(
      () => {
        if (settle === 'skip') {
          throw new Error('skipped');
        }
      },
      (error) => {
        throw error;
      },
    );
    finished.catch(() => {});
    return { updateCallbackDone: done, finished };
  };
  return state;
}

function names(): string[] {
  const found: string[] = [];
  for (const element of document.querySelectorAll<HTMLElement>('[b-vt],[b-vtn]')) {
    const name = element.style.viewTransitionName;
    if (name) {
      found.push(name);
    }
  }
  return found;
}

/** Puts the elements in view or out of it, since the DOM here has no layout. */
function place(selector: string, visible: boolean): void {
  for (const element of document.querySelectorAll(selector)) {
    element.getBoundingClientRect = () =>
      ({
        width: 10,
        height: 10,
        top: visible ? 0 : 99999,
        bottom: visible ? 10 : 100009,
        left: 0,
        right: 10,
      }) as DOMRect;
  }
}

beforeEach(() => {
  document.body.innerHTML = `
    <ul>
      <li class="a" b-vt="card"></li>
      <li class="b" b-vt="card"></li>
    </ul>
    <div class="hero" b-vtn="hero"></div>
    <p class="far" b-vt="far"></p>`;
  place('.a,.b,.hero', true);
  place('.far', false);
});

afterEach(() => {
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
});

describe('startTransition', () => {
  it('names the marked elements in view while the transition runs, and only those', async () => {
    const state = fakeTransitions('finish');
    expect(names()).toEqual([]);
    const started = startTransition(() => {}, []);
    expect(state.seen[0]).toHaveLength(3);
    expect(state.seen[0]).toContain('hero');
    expect(state.seen[0]!.filter((name) => name.startsWith('card-'))).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>('.a')!.style.getPropertyValue('view-transition-class'),
    ).toBe('card');
    expect(document.querySelector<HTMLElement>('.far')!.style.viewTransitionName).toBe('');
    await started.finished;
    await Promise.resolve();
    expect(names()).toEqual([]);
    expect(document.querySelector('.a')!.getAttribute('style')).toBeNull();
  });

  it('keeps the name of an element, and names one that the update adds', async () => {
    fakeTransitions('finish');
    const first = document.querySelector<HTMLElement>('.a')!;
    let seen = '';
    const started = startTransition(() => {
      seen = first.style.viewTransitionName;
      const added = document.createElement('li');
      added.setAttribute('b-vt', 'card');
      added.getBoundingClientRect = document.querySelector('.a')!.getBoundingClientRect;
      document.querySelector('ul')!.append(added);
    }, []);
    const before = first.style.viewTransitionName;
    await started.updateCallbackDone;
    const after = names().filter((name) => name.startsWith('card-'));
    expect(after).toHaveLength(3);
    expect(new Set(after).size).toBe(3);
    expect(seen).toBe(before);
    await started.finished;
  });

  it('removes the names when the update throws', async () => {
    fakeTransitions('finish');
    const started = startTransition(() => {
      throw new Error('update');
    }, []);
    expect(names().length).toBeGreaterThan(0);
    await expect(started.updateCallbackDone).rejects.toThrow('update');
    await started.finished.catch(() => {});
    await Promise.resolve();
    expect(names()).toEqual([]);
  });

  it('removes the names when the transition is skipped', async () => {
    fakeTransitions('skip');
    const started = startTransition(() => {}, []);
    await started.finished.catch(() => {});
    await Promise.resolve();
    expect(names()).toEqual([]);
  });

  it('names the first of two elements that share a name, and warns', async () => {
    fakeTransitions('finish');
    document.body.insertAdjacentHTML('beforeend', '<div class="twin" b-vtn="hero"></div>');
    place('.twin', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = startTransition(() => {}, []);
    expect(names().filter((name) => name === 'hero')).toHaveLength(1);
    expect(document.querySelector<HTMLElement>('.twin')!.style.viewTransitionName).toBe('');
    await started.finished;
    warn.mockRestore();
  });

  it('passes the types, and the callback alone where types are unknown', () => {
    const state = fakeTransitions('finish');
    startTransition(() => {}, ['push']);
    expect(state.calls).toBe(1);
  });

  it('leaves the names of a newer transition when an older one ends', async () => {
    let finishFirst: () => void = () => {};
    const state = { calls: 0 };
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (
      callback: Callback,
    ): Fake => {
      state.calls++;
      const update = Promise.resolve()
        .then(callback)
        .then(() => {});
      const finished =
        state.calls === 1
          ? new Promise<void>((resolve) => {
              finishFirst = resolve;
            })
          : new Promise<void>(() => {});
      return { updateCallbackDone: update, finished };
    };
    startTransition(() => {}, []);
    const before = names();
    expect(before.length).toBe(3);
    // A second transition starts while the first one runs, and shares the names.
    const second = startTransition(() => {}, []);
    expect(names()).toEqual(before);
    finishFirst();
    await Promise.resolve();
    await Promise.resolve();
    expect(names()).toEqual(before);
    expect(second).toBeDefined();
  });

  it('names an element again for a transition that comes after the first ended', async () => {
    fakeTransitions('finish');
    const first = startTransition(() => {}, []);
    await first.finished;
    await Promise.resolve();
    expect(names()).toEqual([]);
    const second = startTransition(() => {}, []);
    expect(names().length).toBe(3);
    await second.finished;
  });

  it('escapes a name to an identifier, so an ID such as 5 or a spaced name holds', async () => {
    fakeTransitions('finish');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="num" b-vtn="5"></div><div class="space" b-vtn="my photo"></div>',
    );
    place('.num,.space', true);
    const started = startTransition(() => {}, []);
    expect(document.querySelector<HTMLElement>('.num')!.style.viewTransitionName).toBe(
      CSS.escape('5').trimEnd(),
    );
    expect(CSS.escape('5')).not.toBe('5');
    expect(document.querySelector<HTMLElement>('.space')!.style.viewTransitionName).toBe(
      CSS.escape('my photo').trimEnd(),
    );
    await started.finished;
  });

  it('gives no name that CSS keeps, and warns with the element', async () => {
    fakeTransitions('finish');
    document.body.insertAdjacentHTML('beforeend', '<div class="none card" b-vtn="none"></div>');
    place('.none', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = startTransition(() => {}, []);
    expect(document.querySelector<HTMLElement>('.none')!.style.viewTransitionName).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<div.none.card>'));
    await started.finished;
    warn.mockRestore();
  });
});
