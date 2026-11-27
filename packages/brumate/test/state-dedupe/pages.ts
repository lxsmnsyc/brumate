// Long raw HTML, as the docs of the website hold: the page prints it, and its state holds it.
import { raw } from 'brumate/server';
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

function section(name: string): string {
  return `<h2 id="${name}">${name} &amp; more</h2>\n<p>Text of <code>${name}</code>, with <a href="#${name}">a link</a>&nbsp;and <em>stress</em> &lt;tag&gt;.</p>\n`.repeat(
    8,
  );
}

export const pages: Record<string, { body: unknown; title: string }> = {
  a: { body: raw(section('alpha')), title: 'Alpha' },
  b: { body: raw(section('beta')), title: 'Beta' },
  c: { body: raw(section('gamma')), title: 'Gamma' },
};

/** Raw HTML whose read-back would differ from it, which the page keeps in the state. */
export const refused: Record<'pre' | 'textarea' | 'listing' | 'shadow', unknown> = {
  pre: raw(`<pre>\n${section('pre')}</pre>`),
  textarea: raw(`<textarea>\n${'text '.repeat(60)}</textarea>`),
  listing: raw(`<listing>\n${section('listing')}</listing>`),
  shadow: raw(`<div><template shadowrootmode="open">${section('shadow')}</template></div>`),
};

/** Raw HTML that does not close its element: the page keeps it in the state. */
export const unclosed: unknown = raw(`<section>${'open '.repeat(80)}`);

export const Doc: Context<unknown> = createContext<unknown>('dedupe-doc');
export const Level: Context<Store<number>> = createContext<Store<number>>('dedupe-level');
