// Writes the pages of a site as static HTML files after the server build.
import { createHash } from 'node:crypto';
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

/** A page that the build wrote, in the prerender manifest. */
export interface PrerenderedPage {
  /** The file of the page, relative to the client build. */
  file: string;
  /**
   * The hashes of the page's inline scripts, as `sha256-<base64>`, for a
   * Content Security Policy: a prerendered page has no nonce.
   */
  scripts: string[];
}

/** The prerender manifest, `.brumate/prerender.json` in the client build. */
export interface PrerenderManifest {
  /** The pages by path. The error page of a missing path is `404`. */
  pages: Record<string, PrerenderedPage>;
  /** The hashes of the inline scripts of every page, once each. */
  scripts: string[];
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
 * Returns the hashes of the inline scripts of a page, as `sha256-<base64>`,
 * in the order of the page. A browser hashes the text between the tags.
 */
export function scriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([^]*?)<\/script>/gi)) {
    if (/\ssrc\s*=/i.test(match[1]!)) {
      continue;
    }
    hashes.push(`sha256-${createHash('sha256').update(match[2]!, 'utf8').digest('base64')}`);
  }
  return hashes;
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
    // Every page renders from one place, with no client, so rate limits do not count.
    prerender: true,
  };
  const queue = [...(options.paths ?? ['/'])];
  const seen = new Set<string>(queue);
  const written: string[] = [];
  const pages: Record<string, PrerenderedPage> = {};
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
    pages[pathname] = { file: fileOf(pathname), scripts: scriptHashes(html) };
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
    const html = await missing.text();
    await writeFile(path.join(client, '404.html'), html);
    written.push('404');
    pages['404'] = { file: '404.html', scripts: scriptHashes(html) };
  }
  const result: PrerenderManifest = {
    pages,
    scripts: [...new Set(Object.values(pages).flatMap((page) => page.scripts))],
  };
  await mkdir(path.join(client, '.brumate'), { recursive: true });
  await writeFile(
    path.join(client, '.brumate/prerender.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return written;
}
