// Stacks: the frames of an error, their sources and the highlighted code around a place.

import type * as Highlight from '../../highlight.ts';
import { element } from './dom.ts';

/** A place in a file that a stack names. */
export interface Frame {
  fn: string;
  file: string;
  line: number;
  column: number;
  /** True for code of a dependency, of the runtime of brumate, or of Node. */
  library: boolean;
  /** True for code that the browser ran, whose lines are of the compiled code. */
  compiled: boolean;
  /** The URL of the module that the browser ran, for a frame that no source map maps. */
  url?: string;
}

/** The places of a stack, with their files as the dev server can read them. */
export function parseFrames(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const match = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (!match) {
      continue;
    }
    let file = match[2]!;
    let compiled = false;
    // Code of a browser extension, or code without a file, is not code of the app.
    if (/^[a-z-]+-extension:/.test(file) || file.startsWith('<')) {
      continue;
    }
    if (/^https?:/.test(file)) {
      const url = new URL(file);
      if (url.origin !== location.origin) {
        continue;
      }
      compiled = true;
      file = url.pathname.startsWith('/@fs/') ? url.pathname.slice(4) : url.pathname;
    } else if (file.startsWith('file://')) {
      file = decodeURIComponent(new URL(file).pathname);
    }
    frames.push({
      fn: match[1] ?? '(anonymous)',
      file,
      line: Number(match[3]),
      column: Number(match[4]),
      library:
        file.startsWith('node:') ||
        file.includes('/node_modules/') ||
        /\/brumate\/(?:src|dist)\/runtime\//.test(file) ||
        file.includes('/@vite/'),
      compiled,
    });
  }
  return frames;
}

/** The places in the sources of frames that the browser ran, by their compiled place. */
const mapped = new Map<string, Promise<Frame>>();

/**
 * Maps the frames that the browser ran to their sources, by the source maps
 * of the dev server, so a frame of a component or a module function names
 * its own file and line. A frame that the dev server cannot map stays as it is.
 */
export function mapFrames(frames: Frame[], urls: string[]): Promise<Frame[]> {
  const results: (Frame | Promise<Frame>)[] = [];
  for (const [index, frame] of frames.entries()) {
    const url = urls[index];
    if (!frame.compiled || frame.library || !url) {
      results.push(frame);
      continue;
    }
    // A frame that the source map does not map shows the code that the browser ran.
    const unmapped = { ...frame, url };
    const key = `${url}:${frame.line}:${frame.column}`;
    let result = mapped.get(key);
    if (!result) {
      const query = new URLSearchParams({
        url,
        line: String(frame.line),
        column: String(frame.column),
      });
      result = fetch(`/__brumate/position?${query}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((place: { file: string; line: number; column: number } | null) =>
          place ? { ...frame, ...place, compiled: false } : unmapped,
        )
        .catch(() => unmapped);
      mapped.set(key, result);
    }
    results.push(result);
  }
  return Promise.all(results);
}

/** The URLs that the frames of a stack name, as the dev server knows the modules. */
export function frameUrls(stack: string | undefined): string[] {
  const urls: string[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const match = /^\s*at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    const file = match?.[2];
    if (!file || /^[a-z-]+-extension:/.test(file) || file.startsWith('<')) {
      continue;
    }
    if (/^https?:/.test(file)) {
      const url = new URL(file);
      urls.push(url.origin === location.origin ? url.pathname + url.search : '');
      if (url.origin !== location.origin) {
        urls.pop();
      }
    } else {
      urls.push('');
    }
  }
  return urls;
}

/** The highlighter, which loads with the first code that the Errors tab shows. */
let highlighter: Promise<typeof Highlight> | undefined;
/** The sources of files, by path. */
const sources = new Map<string, Promise<string | undefined>>();

/** The code of a module as the dev server sent it to the browser. */
export function fetchCompiled(url: string): Promise<string | undefined> {
  let text = sources.get(url);
  if (!text) {
    text = fetch(url)
      .then((response) => (response.ok ? response.text() : undefined))
      .catch(() => undefined);
    sources.set(url, text);
  }
  return text;
}

export function fetchSource(file: string): Promise<string | undefined> {
  let text = sources.get(file);
  if (!text) {
    text = fetch(`/__brumate/source?file=${encodeURIComponent(file)}`)
      .then((response) => (response.ok ? response.text() : undefined))
      .catch(() => undefined);
    sources.set(file, text);
  }
  return text;
}

/**
 * The lines around a place of a file, highlighted by twinkleplop, with the
 * line of the place and the word at its column marked. Without the source,
 * the frame of the error is shown as it is.
 */
export async function codeView(
  place: { file: string; line: number; column: number; url?: string },
  fallback?: string,
): Promise<HTMLElement> {
  const box = element('div', { class: 'code' });
  const [text, module] = await Promise.all([
    place.url ? fetchCompiled(place.url) : fetchSource(place.file),
    (highlighter ??= import('../../highlight.ts')),
  ]);
  if (text === undefined) {
    box.append(
      element('pre', { class: 'plain' }, fallback ?? 'The dev server cannot read this file.'),
    );
    return box;
  }
  const lines = text.split('\n');
  const start = Math.max(1, place.line - 6);
  const end = Math.min(lines.length, place.line + 6);
  const target = place.line;
  const word = /^[\w$.]*/.exec(lines[place.line - 1]?.slice(place.column - 1) ?? '')?.[0] ?? '';
  // The colours of the theme, in the box, since the styles of the page do not reach the panel.
  box.append(element('style', {}, module.themeCSS('dark')));
  // The whole file is highlighted, so lines inside a script or a comment have their context. Then
  // only the lines around the place stay, each line one `.l` element.
  box.insertAdjacentHTML(
    'beforeend',
    module.highlightFile(place.url ? 'compiled.ts' : place.file, text, {
      line_numbers: { start: 1 },
      line: (index) => (index === target ? { class: 'error-line' } : undefined),
      overlays:
        word.length > 0
          ? [
              {
                start: { line: target, character: place.column - 1 },
                end: { line: target, character: place.column - 1 + word.length },
                class: 'error-mark',
              },
            ]
          : [],
    }),
  );
  const shown = [...box.querySelectorAll('code > .l')];
  for (const [index, line] of shown.entries()) {
    if (index + 1 < start || index + 1 > end) {
      // The line break after a line goes with it.
      if (line.nextSibling?.nodeType === Node.TEXT_NODE) {
        line.nextSibling.remove();
      }
      line.remove();
    }
  }
  return box;
}
