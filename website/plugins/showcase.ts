/**
 * Describes what a component ships, at build time: `import x from
 * './Counter.brm?inspect'` gives its highlighted source, the report of
 * `brumate inspect`, its client code and CSS, and the HTML and state that the
 * server renders for it, from the same compiler and runtime that build the site.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, inspect } from 'brumate';
import type { Plugin } from 'vite';
import { language as css } from '@twinkleplop/css';
import { language as typescript } from '@twinkleplop/typescript';
import { language as brm } from '../src/highlight/brm.ts';

const QUERY = '?inspect';

export default function showcase(): Plugin {
  const highlight = brm();
  const highlightTs = typescript();
  const highlightCss = css();
  let root = process.cwd();
  return {
    name: 'website:showcase',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async load(id) {
      if (!id.endsWith(QUERY)) {
        return null;
      }
      const file = id.slice(0, -QUERY.length);
      const source = await readFile(file, 'utf8');
      // The same merge size as the Vite plugin, so the report matches what the site ships.
      const { report, text } = inspect(source, {
        filename: path.relative(root, file),
        merge: 2048,
      });
      // The client parts and the CSS that the compiler emits for the same file.
      const compiled = compile(source, { filename: path.relative(root, file), merge: 2048 });
      const parts = [compiled.client.trim()];
      for (const [name, code] of Object.entries(compiled.parts)) {
        parts.push(`// part ${name}\n${code.trim()}`);
      }
      const scope = /\[(b-c-\w+)\]/.exec(compiled.css)?.[1] ?? null;
      const rendered = await renderOnServer(compiled.server);
      if (!rendered) {
        this.warn(
          `${path.relative(root, file)} imports a file of its own, so its server HTML and state are not shown.`,
        );
      }
      const empty = '<div class="code"></div>';
      const summary = {
        name: report.name,
        roots: report.roots.map((entry) => ({ label: entry.label, reason: entry.reason })),
        changes: report.changes.map((entry) => ({ label: entry.label, reason: entry.reason })),
        state: report.state,
        staticMarkup: report.staticMarkup,
        sizes: report.sizes,
        scope,
      };
      return [
        "import { raw } from 'brumate/html';",
        `export const source = raw(${JSON.stringify(`<div class="code">${highlight(source.trim())}</div>`)});`,
        `export const client = raw(${JSON.stringify(`<div class="code">${highlightTs(parts.join('\n\n'))}</div>`)});`,
        `export const css = raw(${JSON.stringify(`<div class="code">${highlightCss(compiled.css.trim())}</div>`)});`,
        `export const html = raw(${JSON.stringify(rendered ? `<div class="code">${highlight(rendered.html)}</div>` : empty)});`,
        `export const state = raw(${JSON.stringify(rendered ? `<div class="code">${highlight(rendered.state)}</div>` : empty)});`,
        `export const text = raw(${JSON.stringify(`<div class="code"><pre class="twinkleplop">${highlightReport(text.trim())}</pre></div>`)});`,
        `export const report = ${JSON.stringify(summary)};`,
      ].join('\n');
    },
  };
}

/**
 * Renders a component on the server with the runtime of brumate, as a page would, and returns
 * its markup and the script of its state, one tag on a line. Node runs the compiled TypeScript
 * from a temporary file, with `brumate/server` pointed at the package the site uses. A component
 * that imports a file of its own, such as another component, is not rendered: it gives `null`.
 */
async function renderOnServer(code: string): Promise<{ html: string; state: string } | null> {
  if (/from '\.{1,2}\//.test(code)) {
    return null;
  }
  const runtime = import.meta.resolve('brumate/server');
  const directory = await mkdtemp(path.join(tmpdir(), 'brumate-showcase-'));
  const file = path.join(directory, 'component.ts');
  await writeFile(file, code.replaceAll("'brumate/server'", JSON.stringify(runtime)));
  try {
    const component = await import(pathToFileURL(file).href);
    const server = await import(runtime);
    const result = await server.render(component.default, {});
    // Styles are shown in their own tab, so the markup leaves them out.
    const html = result.html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
    return { html: html.replace(/></g, '>\n<'), state: result.state };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Colors the text report of `brumate inspect` with the classes of the highlighter: section
 * titles as keywords, the kind of each entry as a name, places and sizes as numbers.
 */
function highlightReport(text: string): string {
  const lines: string[] = [];
  for (const line of escape(text).split('\n')) {
    if (line && !line.startsWith(' ')) {
      lines.push(`<span class="tok keyword">${line}</span>`);
      continue;
    }
    lines.push(
      line
        .replace(/^(\s+)([\w-]+)/, '$1<span class="tok function">$2</span>')
        .replace(/\((\d+:\d+)\)/g, '(<span class="tok number">$1</span>)')
        .replace(/(\d+) B\b/g, '<span class="tok number">$1 B</span>'),
    );
  }
  return lines.join('\n');
}

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
