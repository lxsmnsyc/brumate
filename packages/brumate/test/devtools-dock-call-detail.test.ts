// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CallRecord,
  CallTiming,
  DevtoolsEntry,
  DevtoolsState,
} from '../src/runtime/devtools.ts';
import { installDevtools } from '../src/runtime/devtools.ts';
import {
  cutLong,
  drawCallDetail,
  printValue,
  writeFetch,
  writeForAgent,
} from '../src/runtime/devtools-panel/call-detail.ts';
import type { DockContext } from '../src/runtime/devtools-panel/workspace.ts';

function fakeRecord(extra: Partial<CallRecord> = {}): CallRecord {
  return {
    name: 'saveTodos',
    args: [[{ text: 'Write the docs', done: true }]],
    result: { saved: true },
    timing: { module: 2, network: 5, server: 13, decode: 1 },
    server: {
      reads: ['session'],
      calls: ['countEntries'],
      logs: [{ level: 'warn', text: 'guestbook: 1000 of 1000 entries' }],
    },
    ...extra,
  };
}

function fakeCall(record?: CallRecord): CallTiming {
  return {
    name: 'saveTodos',
    start: 100,
    end: 121,
    status: 200,
    request: {
      url: '/_brumate/saveTodos',
      headers: { 'content-type': 'application/json' },
      body: '[[{"text":"Write the docs"}]]',
    },
    ...(record ? { record } : {}),
  };
}

function open(call: CallTiming, state: Partial<DevtoolsState> = {}): HTMLElement {
  const entry: DevtoolsEntry = { time: 122, kind: 'call', text: 'saveTodos: 200 in 21 ms', call };
  const ctx = { state: { log: [], timeline: [], ...state } } as unknown as DockContext;
  return drawCallDetail(ctx, entry);
}

function headings(root: HTMLElement): string[] {
  const names: string[] = [];
  for (const node of root.querySelectorAll('.sec')) {
    names.push(node.firstChild!.textContent!);
  }
  return names;
}

function button(root: HTMLElement, text: string): HTMLButtonElement {
  for (const item of root.querySelectorAll('button')) {
    if (item.textContent === text) {
      return item;
    }
  }
  throw new Error(`No button ${text}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('call detail', () => {
  it('prints a repeated object twice and marks only a cycle', () => {
    const shared = { n: 1 };
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;
    expect(JSON.parse(printValue({ a: shared, b: shared }))).toEqual({
      a: { n: 1 },
      b: { n: 1 },
    });
    expect(JSON.parse(printValue(loop))).toEqual({ name: 'loop', self: '[Circular]' });
    expect(JSON.parse(printValue(new Map([['k', new Set([1])]])))).toEqual({ k: [1] });
  });

  it('shows each part of the record', () => {
    const root = open(fakeCall(fakeRecord()), {
      timeline: [{ label: 'click on <button>', ref: 'Todos_1#h0', calls: [] } as never],
    });
    expect(root.querySelector('h3')!.textContent).toBe('saveTodos()');
    expect(headings(root)).toEqual(['Arguments', 'Result', 'Timing', 'On the server']);
    expect(root.querySelector('.val')!.textContent).toContain('Write the docs');
    expect(root.querySelector('.leg')!.textContent).toContain('server 13 ms');
    const lines = root.querySelector('.lines')!.textContent!;
    expect(lines).toContain('read');
    expect(lines).toContain('countEntries');
    expect(lines).toContain('guestbook: 1000 of 1000 entries');
  });

  it('shows the owner and the writes after the answer', () => {
    const call = fakeCall(fakeRecord());
    const root = open(call, {
      timeline: [{ label: 'click on <button>', ref: 'Todos_1#h0', calls: [call] } as never],
      log: [
        { time: 90, kind: 'write', text: 'scope 0 slot 0 = 1' },
        { time: 130, kind: 'write', text: 'scope 0 slot 1 = 2' },
        { time: 900, kind: 'write', text: 'scope 0 slot 2 = 3' },
      ],
    });
    expect(root.querySelector('.from')!.textContent).toBe('Called by click on <button>');
    // Without the component on the page it is plain text.
    expect(root.querySelector('.from button')).toBeNull();
    expect(headings(root)).toContain('After the call');
    const after = [...root.querySelectorAll('.lines')].at(-1)!.textContent;
    expect(after).toBe('scope 0 slot 1 = 2');
  });

  it('links the caller to its component in Inspect', () => {
    const call = fakeCall(fakeRecord());
    const scope = { id: 7, k: 0, m: 'Todos_1', s: [] };
    const select = vi.fn<(workspace: string) => void>();
    const shell: { selectedScope?: number } = {};
    const state = {
      log: [],
      timeline: [{ label: 'click on <button>', ref: 'Todos_1#h0', calls: [call] }],
      scopes: new Map([[7, scope]]),
    };
    const entry: DevtoolsEntry = { time: 122, kind: 'call', text: 'saveTodos', call };
    const root = drawCallDetail({ state, shell, select } as unknown as DockContext, entry);
    const link = root.querySelector<HTMLButtonElement>('.from button')!;
    // A button takes Enter and Space from the browser as a click.
    expect(link.tagName).toBe('BUTTON');
    link.click();
    expect(shell.selectedScope).toBe(7);
    expect(select).toHaveBeenCalledWith('inspect');
  });

  it('hides a part that has no data', () => {
    const root = open(fakeCall());
    expect(headings(root)).toEqual([]);
    const bare = open(
      fakeCall(fakeRecord({ args: [], server: { reads: [], calls: [], logs: [] } })),
    );
    expect(headings(bare)).toEqual(['Result', 'Timing']);
  });

  it('shows the error of the server in place of the result', () => {
    const record = fakeRecord({
      error: {
        message: 'entries table is full',
        stack: 'Error: x\n    at addEntry (/app/src/a.ts:3:5)',
      },
    });
    delete record.result;
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    const root = open(fakeCall(record));
    expect(headings(root)).toContain('Error on the server');
    expect(headings(root)).not.toContain('Result');
    expect(root.querySelector('.lines .errline')!.textContent).toBe('entries table is full');
  });

  it('cuts values at a length', () => {
    const long = 'x'.repeat(5000);
    expect(cutLong(long)).toBe(`${'x'.repeat(1000)}… (4000 more)`);
    const root = open(fakeCall(fakeRecord({ args: [long], result: long })));
    for (const value of root.querySelectorAll('.val')) {
      expect(value.textContent).toContain('… (4000 more)');
      expect(value.textContent!.length).toBeLessThan(1100);
    }
    expect(writeForAgent(fakeCall(fakeRecord({ args: [long] })))).toContain('… (4000 more)');
  });

  it('asks before it runs the call again, and names the side effects', async () => {
    const send = vi.fn<typeof fetch>(async () => new Response('{}'));
    vi.stubGlobal('fetch', send);
    const root = open(fakeCall(fakeRecord()));
    const note = root.querySelector('.note') as HTMLElement;
    expect(note.hidden).toBe(true);
    button(root, 'Run again').click();
    expect(send).not.toHaveBeenCalled();
    expect(note.hidden).toBe(false);
    expect(note.textContent).toContain('side effects happen again');
    // Cancel puts it back.
    button(root, 'Cancel').click();
    expect(note.hidden).toBe(true);
    button(root, 'Run again').click();
    button(root, 'Run it again').click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('/_brumate/saveTodos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[[{"text":"Write the docs"}]]',
    });
  });

  it('copies a fetch call without cookies or headers', () => {
    const text = writeFetch(fakeCall())!;
    expect(text).toContain('await fetch("/_brumate/saveTodos"');
    expect(text).toContain("method: 'POST'");
    expect(text).toContain('application/json');
    expect(text).not.toMatch(/headers|cookie/i);
    const call = fakeCall();
    const form = new FormData();
    form.set('args', '[]');
    call.request = {
      url: '/_brumate/saveTodos',
      headers: { 'x-brumate-args': 'form', 'x-brumate-build': 'abc' },
      body: form,
    };
    const upload = writeFetch(call)!;
    expect(upload).toContain('body.set("args", "[]")');
    expect(upload).toContain('\'x-brumate-args\': "form"');
    expect(upload).not.toContain('x-brumate-build');
    expect(upload).not.toMatch(/cookie/i);
  });

  it('copies text for an agent', () => {
    const text = writeForAgent(fakeCall(fakeRecord()), 'click on <button>', ['scope 0 slot 1 = 2']);
    expect(text).toContain('saveTodos()');
    expect(text).toContain('Called by: click on <button>');
    expect(text).toContain('Write the docs');
    expect(text).toContain('Result:');
    expect(text).toContain('Timing: module 2 ms, network 5 ms, server 13 ms, decode 1 ms');
    expect(text).toContain('console.warn: guestbook: 1000 of 1000 entries');
    expect(text).toContain('scope 0 slot 1 = 2');
  });

  it('puts the texts on the clipboard from the buttons', () => {
    const write = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: write } });
    const root = open(fakeCall(fakeRecord()));
    button(root, 'Copy as fetch').click();
    button(root, 'Copy for an agent').click();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]![0]).toContain('await fetch(');
    expect(write.mock.calls[1]![0]).toContain('A server function call');
  });

  it('keeps the call on the entry of the log, with what it sent', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
    // The devtools wrap the fetch that is there when they install.
    const state = installDevtools('/inspect');
    await globalThis.fetch('/_brumate/addEntry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'secret=1', 'x-other': 'no' },
      body: '["Ada"]',
    });
    globalThis.fetch = original;
    const entry = state.log.find((item) => item.kind === 'call')!;
    expect(entry.call!.name).toBe('addEntry');
    expect(entry.call!.request!.url).toBe('/_brumate/addEntry');
    expect(entry.call!.request!.headers).toEqual({ 'content-type': 'application/json' });
    expect(entry.call!.request!.body).toBe('["Ada"]');
  });
});
