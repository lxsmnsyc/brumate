// What the dock copies for an agent: an error, a component, a handler run and a server call, as
// Markdown. Values are cut at a length, and nothing from cookies or headers is in a copy.

import type { Scope } from '../client.ts';
import type { CallTiming, DevtoolsMeta, ErrorEntry, Interaction } from '../devtools.ts';
import { element, svg } from './dom.ts';
import { ms } from './format.ts';
import { known } from './info.ts';
import type { ComponentInfo } from './info.ts';

/** The longest text of a value on screen, as the record cuts them. */
const TEXT_LIMIT = 1000;
/** The longest value on one line of a list. */
const INLINE_LIMIT = 300;
/** The lines of source on each side of the line of an error. */
const SOURCE_AROUND = 6;
const LEFT_OUT = '[left out]';
/** Keys that hold cookies, headers or credentials, by a word anywhere in the name. */
const SECRET_KEY = /(cookie|authorization|headers?|x-auth|api[-_]?key|csrf|token|secret|password)/i;
/** A name with a credential word in it, then `:` or `=`, such as `Cookie: a=1` or `sessionCookie = x`. */
const SECRET_LINE =
  /([\w-]*(?:cookie|authorization|token|api[-_]?key|secret|password|x-auth)[\w-]*)(["'\\\s]*[:=]\s*)[^\n]*/gi;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;

/** The text without what a cookie, an authorization or a token holds. */
export function scrub(text: string): string {
  return text.replace(SECRET_LINE, `$1$2${LEFT_OUT}`).replace(BEARER, `Bearer ${LEFT_OUT}`);
}

/** Cuts a text at a length, and marks the cut. */
export function cutLong(text: string, limit: number = TEXT_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit)}… (${text.length - limit} more)` : text;
}

/** A copy of a value that JSON can write: long texts cut, maps and sets as plain values, cycles marked. */
function toPlain(value: unknown, ancestors: Set<object>): unknown {
  if (typeof value === 'bigint') {
    return `${value}n`;
  }
  if (typeof value === 'string') {
    // Scrubbed before the cut and before JSON escapes the quotes, so the word cannot hide.
    return cutLong(scrub(value));
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  if (value instanceof Error) {
    return { name: value.name, message: cutLong(scrub(value.message)) };
  }
  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    return '[headers]';
  }
  if (typeof value === 'object' && value !== null && 'tagName' in value) {
    return `<${String((value as { tagName: unknown }).tagName).toLowerCase()}>`;
  }
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return value;
  }
  // Only an object that is its own ancestor is a cycle; the same object twice is fine.
  if (ancestors.has(value)) {
    return '[Circular]';
  }
  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value) || value instanceof Set) {
    const items: unknown[] = [];
    for (const item of value) {
      // A pair such as `['cookie', 'a=1']`, as `headers.entries()` gives them.
      if (
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === 'string' &&
        SECRET_KEY.test(item[0])
      ) {
        items.push([item[0], LEFT_OUT]);
      } else {
        items.push(toPlain(item, ancestors));
      }
    }
    result = items;
  } else {
    const copy: Record<string, unknown> = {};
    const entries = value instanceof Map ? value.entries() : Object.entries(value);
    for (const [key, item] of entries) {
      // Whatever a record carries of cookies or headers stays out of every copy.
      copy[String(key)] = SECRET_KEY.test(String(key)) ? LEFT_OUT : toPlain(item, ancestors);
    }
    result = copy;
  }
  ancestors.delete(value);
  return result;
}

/** The text of a value for a person or an agent, with long texts cut and cycles left out. */
export function printValue(value: unknown): string {
  return JSON.stringify(toPlain(value, new Set()), undefined, 2) ?? 'undefined';
}

/** A value on one line, cut at a length: for a list of values. */
function printInline(value: unknown): string {
  return cutLong(JSON.stringify(toPlain(value, new Set())) ?? 'undefined', INLINE_LIMIT);
}

/** A block of code in a fence that its content cannot close. */
function fence(text: string, language = ''): string {
  const mark = text.includes('```') ? '````' : '```';
  return `${mark}${language}\n${text}\n${mark}`;
}

/** The lines around a line of a source, numbered, with the line itself marked. */
export function cutSource(text: string, line: number): string {
  const lines = text.split('\n');
  const start = Math.max(1, line - SOURCE_AROUND);
  const end = Math.min(lines.length, line + SOURCE_AROUND);
  const width = String(end).length;
  const out: string[] = [];
  for (let number = start; number <= end; number++) {
    out.push(
      `${number === line ? '>' : ' '} ${String(number).padStart(width)} | ${cutLong(lines[number - 1]!, 200)}`,
    );
  }
  return out.join('\n');
}

/** The first lines of the text that tells the versions that the app runs on. */
function writeVersions(meta: DevtoolsMeta): string | undefined {
  const parts: string[] = [];
  if (meta.version) {
    parts.push(`brumate ${meta.version}`);
  }
  if (meta.vite) {
    parts.push(`Vite ${meta.vite}`);
  }
  return parts.length > 0 ? `Versions: ${parts.join(', ')}` : undefined;
}

/** The text of an error: the message, the place, the code around it, the stack and the versions. */
export function writeIssue(
  entry: ErrorEntry,
  label: string,
  meta: DevtoolsMeta = {},
  code?: { file: string; line: number; text: string },
): string {
  const lines = [
    `An error in the dev server of a brumate app: ${label}`,
    '',
    'Message:',
    fence(cutLong(entry.message)),
  ];
  const place = code ?? entry.loc;
  if (place) {
    lines.push(
      '',
      `Place: ${place.file}:${place.line}${'column' in place ? `:${place.column}` : ''}`,
    );
    const name = /([^/\\]+)\.brm$/.exec(place.file)?.[1];
    if (name) {
      lines.push(`Component: ${name}`);
    }
  }
  if (entry.plugin) {
    lines.push(`Plugin: ${entry.plugin}`);
  }
  if (code) {
    lines.push('', 'Source around the line:', fence(cutSource(code.text, code.line)));
  } else if (entry.frame) {
    lines.push('', 'Source around the line:', fence(cutLong(entry.frame, 2000)));
  }
  if (entry.stack) {
    lines.push('', 'Stack:', fence(cutLong(entry.stack, 2000)));
  }
  const versions = writeVersions(meta);
  if (versions) {
    lines.push('', versions);
  }
  return scrub(lines.join('\n'));
}

/** The scopes of a component instance, without the components inside it. */
function listScopes(scope: Scope, into: Scope[] = []): Scope[] {
  into.push(scope);
  for (const child of scope.children ?? []) {
    if (child.m === undefined) {
      listScopes(child, into);
    }
  }
  return into;
}

/** The components that an instance renders directly, by name. */
function listInner(scope: Scope, into: string[] = []): string[] {
  for (const child of scope.children ?? []) {
    if (child.m === undefined) {
      listInner(child, into);
    } else {
      into.push(known.get(child.m)?.name ?? child.m);
    }
  }
  return into;
}

/** The text of a component: its file, the value of each slot by name, its contexts and its report. */
export function writeComponent(
  component: Scope,
  info: ComponentInfo | undefined,
  meta: DevtoolsMeta = {},
): string {
  const name = info?.name ?? component.m ?? 'component';
  const lines = [`A component in the dev server of a brumate app: ${name}`];
  if (info?.file) {
    lines.push(`File: ${info.file}`);
  }
  for (const scope of listScopes(component)) {
    const plan = info?.scopes[scope.k];
    if (scope.s.length === 0) {
      continue;
    }
    lines.push(
      '',
      `Values of ${scope === component ? 'the component' : (plan?.label ?? 'a scope')}:`,
    );
    for (const [slot, value] of scope.s.entries()) {
      lines.push(`- ${plan?.slots[slot] ?? `slot ${slot}`}: ${printInline(value)}`);
    }
  }
  const inner = listInner(component);
  if (inner.length > 0) {
    lines.push('', `Components inside: ${inner.join(', ')}`);
  }
  // The contexts that any scope of the component provides or reads.
  const contexts: string[] = [];
  for (const scope of listScopes(component)) {
    for (const [key, value] of Object.entries(scope.v ?? {})) {
      contexts.push(`- provides ${key}: ${printInline(value)}`);
    }
    for (const key of Object.keys(scope.x ?? {})) {
      contexts.push(`- reads ${key}`);
    }
  }
  if (contexts.length > 0) {
    lines.push('', 'Contexts:', ...contexts);
  }
  if (info?.text) {
    lines.push('', 'Report of brumate inspect:', fence(cutLong(info.text, 4000)));
  }
  const versions = writeVersions(meta);
  if (versions) {
    lines.push('', versions);
  }
  return scrub(lines.join('\n'));
}

/** The text of a handler run: the event, the writes, the updates and the server calls with times. */
export function writeRun(run: Interaction, name: string, writes: string[]): string {
  const lines = [`A handler run in the dev server of a brumate app: ${name}`];
  lines.push(`Event: ${run.label}`, `Handler: ${run.ref}`);
  lines.push(
    `Times: ready after ${ms(run.ready - run.begun)}, code ran ${ms(run.end - run.ready)}` +
      (run.settled === undefined ? '' : `, settled after ${ms(run.settled - run.begun)}`),
  );
  if (run.failed) {
    lines.push('The handler failed.');
  }
  if (writes.length > 0) {
    lines.push('', 'Writes:');
    for (const text of writes) {
      lines.push(`- ${cutLong(text)}`);
    }
  }
  if (run.updates.length > 0) {
    lines.push('', 'Updates:');
    for (const update of run.updates) {
      lines.push(
        `- ${update.count} ${update.count === 1 ? 'update' : 'updates'} in ${ms(update.end - update.start)}`,
      );
    }
  }
  if (run.calls.length > 0) {
    lines.push('', 'Server calls:');
    for (const call of run.calls) {
      const took = call.end === undefined ? 'pending' : ms(call.end - call.start);
      lines.push(`- ${call.name}(): ${call.status ?? 'pending'}, ${took}`);
    }
  }
  return scrub(lines.join('\n'));
}

/** The text for a coding agent: what was called, with what, what came back and what ran on the server. */
export function writeForAgent(call: CallTiming, from?: string, writes: string[] = []): string {
  const record = call.record;
  const lines = [`A server function call in the dev server of a brumate app: ${call.name}()`];
  lines.push(`Status: ${call.status ?? 'pending'}`);
  if (from) {
    lines.push(`Called by: ${from}`);
  }
  if (record) {
    lines.push('', 'Arguments:', printValue(record.args));
    if (record.error) {
      lines.push('', 'Error on the server:', cutLong(record.error.message));
      if (record.error.stack) {
        lines.push(cutLong(record.error.stack, 2000));
      }
    } else if ('result' in record) {
      lines.push('', 'Result:', printValue(record.result));
    }
    const { module, network, server, decode } = record.timing;
    lines.push(
      '',
      `Timing: module ${module} ms, network ${network} ms, server ${server} ms, decode ${decode} ms`,
    );
    const ran = record.server;
    if (ran) {
      if (ran.reads.length > 0) {
        lines.push(`Reloads: ${ran.reads.join(', ')}`);
      }
      if (ran.calls.length > 0) {
        lines.push(`Called on the server: ${ran.calls.join(', ')}`);
      }
      for (const log of ran.logs) {
        lines.push(`console.${log.level}: ${cutLong(log.text)}`);
      }
      if (ran.truncated) {
        lines.push('Some console output was left out.');
      }
    }
  }
  if (writes.length > 0) {
    lines.push('', 'The result changed:', ...writes);
  }
  return scrub(lines.join('\n'));
}

/** Writes with a hidden text area, for a page where the clipboard API is missing or refuses. */
function copyByArea(value: string): boolean {
  // The focus goes back to where it was, which may be inside the shadow root of the dock.
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  let done = false;
  try {
    done = document.execCommand('copy');
  } catch {
    done = false;
  }
  area.remove();
  if (active instanceof HTMLElement) {
    active.focus({ preventScroll: true });
  }
  return done;
}

/** Puts a text on the clipboard without a promise of it. It tells whether the text arrived. */
async function writeClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // The fallback below tries once more.
  }
  return copyByArea(value);
}

/**
 * Starts the write inside the click with a promise of the text, which Safari needs. It gives
 * nothing when the browser has no `ClipboardItem`.
 */
function startWrite(pending: Promise<string | undefined>): Promise<void> | undefined {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return undefined;
  }
  const blob = pending.then((value) => {
    if (value === undefined) {
      throw new Error('Nothing to copy');
    }
    return new Blob([value], { type: 'text/plain' });
  });
  return navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
}

/**
 * Puts a text on the clipboard from a button. The button answers at once with "Copying", then shows
 * "Copied", or "Copy failed" when the text did not arrive, and goes back after a moment. The text
 * may be read later, such as a source that is fetched when the button is pressed.
 */
export function copyText(
  button: HTMLButtonElement,
  text: () => string | undefined | Promise<string | undefined>,
): void {
  // What the button holds when it is set up, which it gets back after the feedback.
  const original = [...button.childNodes];
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The newest click: a run that another click passed does nothing when it ends.
  let latest = 0;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const run = ++latest;
    button.replaceChildren('Copying');
    clearTimeout(timer);
    let pending: Promise<string | undefined>;
    try {
      pending = Promise.resolve(text());
    } catch (error) {
      pending = Promise.reject(error);
    }
    let started: Promise<void> | undefined;
    try {
      started = startWrite(pending);
    } catch {
      started = undefined;
    }
    void (async () => {
      let done = false;
      let nothing = false;
      try {
        const value = await pending;
        if (value === undefined) {
          nothing = true;
        } else {
          try {
            await started;
            done = started !== undefined;
          } catch {
            done = false;
          }
          done ||= await writeClipboard(value);
        }
      } catch {
        done = false;
      }
      if (run !== latest) {
        return;
      }
      if (nothing) {
        button.replaceChildren(...original);
        return;
      }
      button.replaceChildren(done ? 'Copied' : 'Copy failed');
      timer = setTimeout(() => {
        button.replaceChildren(...original);
      }, 1200);
    })();
  });
}

/** The icon of the copy button: two sheets. */
function drawCopyIcon(): SVGElement {
  const node = svg('svg', {
    class: 'icon',
    viewBox: '0 0 24 24',
    width: 14,
    height: 14,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.8,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  node.innerHTML =
    '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>';
  return node;
}

/** The Copy for an agent button of a detail header, in the style of the other tools. */
export function drawCopyTool(text: () => string | undefined): HTMLButtonElement {
  const button = element('button', { class: 'tool dock-copy', 'data-focus': 'copy' });
  button.append(drawCopyIcon(), 'Copy for an agent');
  copyText(button, text);
  return button;
}

/** The same, as an icon alone, for a row. */
export function drawCopyRowTool(text: () => string | undefined): HTMLButtonElement {
  const button = element('button', {
    class: 'tool only dock-copy dock-copy-row',
    'aria-label': 'Copy for an agent',
    title: 'Copy for an agent',
  });
  button.append(drawCopyIcon());
  copyText(button, text);
  return button;
}
