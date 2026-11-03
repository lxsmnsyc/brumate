/**
 * Writes the pages of the site for agents: `/llms.txt` (the list of pages), `/llms-full.txt` (every
 * page in one file) and the Markdown of each page at its path with `.md`, such as `/docs/markup.md`.
 * They come from the same files as the search index. The Markdown of a page is its source, with
 * the demos, props tables and live samples written out as plain Markdown.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { readProps } from './props-table.ts';
import type { PropRow } from './props-table.ts';

export type Section = 'docs' | 'ui';

export interface LlmsPage {
  section: Section;
  /** The name after the section, `index` for the first page of the docs. */
  slug: string;
  title: string;
  description: string;
  markdown: string;
}

const SECTION_TITLES: Record<Section, string> = {
  docs: 'Documentation',
  ui: 'Parts of @brumate/ui',
};

/** The path of a page without the base, such as `docs/markup.md`. */
export function pagePath(page: Pick<LlmsPage, 'section' | 'slug'>): string {
  return `${page.section}/${page.slug}.md`;
}

function plain(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The first paragraph of prose after the title. */
function describe(markdown: string): string {
  let paragraph = '';
  let fence = '';
  for (const line of markdown.split('\n').slice(1)) {
    const mark = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) {
        fence = '';
      }
      continue;
    }
    if (mark) {
      fence = mark;
      continue;
    }
    if (!line.trim()) {
      if (paragraph) {
        break;
      }
      continue;
    }
    if (/^(#|[-*>|]|\d+\.)/.test(line) && !paragraph) {
      continue;
    }
    paragraph += ` ${line}`;
  }
  return plain(paragraph);
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replace(/\s+/g, ' ');
}

function propsTable(rows: PropRow[]): string {
  const lines = ['| Prop | Type | Default | Description |', '| --- | --- | --- | --- |'];
  for (const row of rows) {
    const fallback = row.required ? 'required' : '';
    const value = row.default ? `\`${cell(row.default)}\`` : fallback;
    lines.push(
      `| \`${cell(row.name)}\` | \`${cell(row.type)}\` | ${value} | ${cell(row.description)} |`,
    );
  }
  return lines.join('\n');
}

/** Points a link to another document of the site at its Markdown, and the rest at GitHub. */
function rewriteLinks(
  markdown: string,
  base: string,
  section: Section,
  known: Set<string>,
): string {
  return markdown.replace(
    /\]\((\.{1,2}\/(?:(docs|ui)\/)?([\w-]+)\.md)(#[^)]*)?\)/g,
    (whole, href: string, folder: Section | undefined, name: string, hash = '') => {
      const target = folder ?? section;
      if (href.startsWith('./') || folder) {
        if (known.has(`${target}/${name}`)) {
          return `](${base}${target}/${name}.md${hash})`;
        }
        return `](https://github.com/lxsmnsyc/brumate/blob/main/docs/${name}.md${hash})`;
      }
      return whole;
    },
  );
}

/**
 * The Markdown of a page: code blocks keep their text, and the special blocks of the site
 * become plain ones. A demo is its source, a props block is a table, and a gallery is dropped.
 */
export function toMarkdown(
  source: string,
  directory: string,
  base: string,
  section: Section,
  known: Set<string>,
): string {
  const out: string[] = [];
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const open = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (!open) {
      out.push(line);
      continue;
    }
    // The block runs to the next fence of the same kind.
    const fence = open[1]!;
    const info = open[2]!.trim();
    const body: string[] = [];
    let close = index + 1;
    while (close < lines.length) {
      const text = lines[close]!;
      if (text.startsWith(fence[0]!.repeat(fence.length)) && !text.replace(/[`~]/g, '').trim()) {
        break;
      }
      body.push(text);
      close++;
    }
    index = close;
    const demo = /^(?:brm|html)\s+(demo|styled)\s+(\w+)/.exec(info);
    const anatomy = /^(?:brm|html)\s+anatomy\s+(\w+)/.exec(info);
    const props = /^props\s+(\w+)$/.exec(info);
    const live = /^(brm|html|ts)\s+live\b\s*(\S+)?/.exec(info);
    if (demo) {
      const file = path.join(directory, 'demos', `${demo[2]}.brm`);
      out.push('```brm', readFileSync(file, 'utf8').trim(), '```');
    } else if (anatomy) {
      const pieces = body.filter((text) => text.trim());
      for (const [number, text] of pieces.entries()) {
        out.push(`${number + 1}. ${text}`);
      }
    } else if (props) {
      out.push(propsTable(readProps(props[1]!)));
    } else if (/^(?:brm|html)\s+gallery\b/.test(info)) {
      // A grid of previews, which has no text.
    } else if (live) {
      if (live[2]) {
        out.push(`<!-- ${live[2]} -->`);
      }
      out.push(`${fence}${live[1]}`, ...body, fence);
    } else {
      out.push(line, ...body, fence);
    }
  }
  return rewriteLinks(out.join('\n'), base, section, known).trim();
}

/** The pages of the docs and of @brumate/ui, in the order of their file names. */
export function readPages(docs: string, ui: string, base: string): LlmsPage[] {
  const directories: [Section, string][] = [
    ['docs', docs],
    ['ui', ui],
  ];
  const files: [Section, string, string][] = [];
  const known = new Set<string>();
  for (const [section, directory] of directories) {
    const names = readdirSync(directory).filter((file) => file.endsWith('.md'));
    // The first page of a section leads.
    names.sort((a, b) => Number(b === 'index.md') - Number(a === 'index.md') || (a < b ? -1 : 1));
    for (const file of names) {
      const slug = file.slice(0, -3);
      files.push([section, directory, slug]);
      known.add(`${section}/${slug}`);
    }
  }
  const pages: LlmsPage[] = [];
  for (const [section, directory, slug] of files) {
    const source = readFileSync(path.join(directory, `${slug}.md`), 'utf8');
    const markdown = toMarkdown(source, directory, base, section, known);
    pages.push({
      section,
      slug,
      title: plain(/^# (.*)$/m.exec(markdown)?.[1] ?? slug),
      description: describe(markdown),
      markdown,
    });
  }
  return pages;
}

/** `llms.txt`: the title, a summary and a link to the Markdown of each page. */
export function llmsTxt(pages: LlmsPage[], origin: string, base: string): string {
  const intro = pages.find((page) => page.section === 'docs' && page.slug === 'index');
  const lines = ['# brumate', ''];
  if (intro?.description) {
    lines.push(`> ${intro.description}`, '');
  }
  lines.push(
    `The whole text is in [llms-full.txt](${origin}${base}llms-full.txt). Each page is Markdown at its path with \`.md\`.`,
  );
  for (const section of ['docs', 'ui'] as const) {
    lines.push('', `## ${SECTION_TITLES[section]}`, '');
    for (const page of pages) {
      if (page.section === section) {
        const text = page.description ? `: ${page.description}` : '';
        lines.push(`- [${page.title}](${origin}${base}${pagePath(page)})${text}`);
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

/** `llms-full.txt`: every page, one after the other. */
export function llmsFull(pages: LlmsPage[], origin: string, base: string): string {
  const parts: string[] = [];
  for (const page of pages) {
    parts.push(`<!-- ${origin}${base}${pagePath(page)} -->\n\n${page.markdown}`);
  }
  return `${parts.join('\n\n---\n\n')}\n`;
}

/** The files of the site for agents, written by the build and served by the dev server. */
export default function llms(origin: string): Plugin {
  const docs = fileURLToPath(new URL('../docs/', import.meta.url));
  const ui = fileURLToPath(new URL('../ui/', import.meta.url));
  let base = '/';
  let build = false;

  function files(): Map<string, string> {
    const pages = readPages(docs, ui, base);
    const result = new Map<string, string>();
    result.set('llms.txt', llmsTxt(pages, origin, base));
    result.set('llms-full.txt', llmsFull(pages, origin, base));
    for (const page of pages) {
      result.set(pagePath(page), `${page.markdown}\n`);
    }
    return result;
  }

  return {
    name: 'website:llms',
    configResolved(config) {
      base = config.base;
      // The server build writes no files of the site.
      build = config.command === 'build' && !config.build.ssr;
    },
    configureServer(server) {
      for (const directory of [docs, ui]) {
        if (existsSync(directory)) {
          server.watcher.add(directory);
        }
      }
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? '').split('?')[0]!;
        const name = url.startsWith(base) ? url.slice(base.length) : '';
        const text = /\.(?:md|txt)$/.test(name) ? files().get(name) : undefined;
        if (text === undefined) {
          next();
          return;
        }
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end(text);
      });
    },
    generateBundle() {
      if (!build) {
        return;
      }
      for (const [fileName, source] of files()) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
