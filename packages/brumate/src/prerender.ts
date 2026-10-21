// Writes the pages of a site as static HTML files after the server build.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface PrerenderOptions {
  /** The paths to render first. Defaults to `['/']`. */
  paths?: string[];
  /** Follows links to other pages of the site, and renders them too. Defaults to true. */
  crawl?: boolean;
  /** The output directory of the client build, with its manifest, relative to the root. Defaults to `dist/client`. */
  client?: string;
  /** Markup for the head of every page, from the manifest of the client build. */
  head?: (manifest: Record<string, ManifestChunk>) => string;
}

export interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
}

type Handle = (request: Request, options: object) => Promise<Response | undefined>;

/** The file of a page: `index.html` in a folder of its path. */
function fileOf(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/index.html` : 'index.html';
}

/** The paths of the links in a page that stay on the site, without their query and hash. */
function links(html: string, base: string): string[] {
  const result: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
    const href = match[1]!.replace(/&amp;/g, '&');
    if (!href.startsWith(base) || href.startsWith('//')) {
      continue;
    }
    const pathname = href.split(/[?#]/)[0]!.slice(base.length - 1) || '/';
    if (!/\.[a-z0-9]+$/i.test(pathname)) {
      result.push(pathname);
    }
  }
  return result;
}

/**
 * Renders pages with the route handler of the server build, and writes them
 * into the client build. Returns the paths that it wrote.
 */
export async function prerender(
  routes: string,
  root: string,
  base: string,
  options: PrerenderOptions,
): Promise<string[]> {
  const client = path.resolve(root, options.client ?? 'dist/client');
  const manifest = JSON.parse(
    await readFile(path.join(client, '.vite/manifest.json'), 'utf8'),
  ) as Record<string, ManifestChunk>;
  const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
  if (!entry) {
    throw new Error('The client build has no entry. Build the client before the server.');
  }
  const { handle } = (await import(pathToFileURL(routes).href)) as { handle: Handle };
  const document = {
    head: options.head?.(manifest) ?? '',
    scripts: `<script type="module" async src="${base}${entry.file}"></script>`,
  };
  const queue = [...(options.paths ?? ['/'])];
  const seen = new Set<string>(queue);
  const written: string[] = [];
  while (queue.length > 0) {
    const pathname = queue.shift()!;
    // oxlint-disable-next-line no-await-in-loop -- Pages render one by one, and each can add links.
    const response = await handle(new Request(`http://localhost${pathname}`), document);
    if (!response?.headers.get('content-type')?.includes('text/html') || response.status !== 200) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- Pages render one by one, and each can add links.
    const html = await response.text();
    const file = path.join(client, fileOf(pathname));
    // oxlint-disable-next-line no-await-in-loop -- Pages render one by one, and each can add links.
    await mkdir(path.dirname(file), { recursive: true });
    // oxlint-disable-next-line no-await-in-loop -- Pages render one by one, and each can add links.
    await writeFile(file, html);
    written.push(pathname);
    if (options.crawl !== false) {
      for (const link of links(html, base)) {
        if (!seen.has(link)) {
          seen.add(link);
          queue.push(link);
        }
      }
    }
  }
  // A static host answers a missing path with 404.html: the error file of the root.
  const missing = await handle(new Request('http://localhost/__brumate_not_found__'), document);
  if (missing?.status === 404 && missing.headers.get('content-type')?.includes('text/html')) {
    await writeFile(path.join(client, '404.html'), await missing.text());
    written.push('404');
  }
  return written;
}
