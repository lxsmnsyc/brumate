import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repo = fileURLToPath(new URL('..', import.meta.url));

/** A port that no server listens on. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Runs a command, and keeps its output to show when it fails. */
export function exec(command, args, { cwd = repo, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(
          new Error(`${command} ${args.join(' ')} exited with ${code}:\n${output.slice(-4000)}`),
        );
      }
    });
  });
}

/**
 * Starts a server as a child process and waits until `url` answers.
 * Returns a function that stops it.
 */
export async function startProcess(command, args, { cwd, env, url, timeout = 30_000 }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  let exited = false;
  const closed = new Promise((resolve) => child.on('close', resolve));
  child.on('close', () => (exited = true));
  const stop = async () => {
    if (!exited) {
      child.kill();
      await closed;
    }
  };
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`${command} ${args.join(' ')} exited before it served ${url}:\n${output}`);
    }
    try {
      await fetch(url);
      return stop;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await stop();
  throw new Error(`${command} ${args.join(' ')} did not serve ${url} in ${timeout} ms:\n${output}`);
}

function headersOf(answer) {
  const headers = {};
  for (const [name, value] of answer.headers) {
    if (name !== 'set-cookie') {
      headers[name] = value;
    }
  }
  const cookies = answer.headers.getSetCookie();
  if (cookies.length > 0) {
    headers['set-cookie'] = cookies;
  }
  return headers;
}

/**
 * Serves the production build of an example in `root` (its dist/client and
 * dist/server/server.js), as its server.prod.ts does, under a strict content
 * security policy: each page allows only scripts with its own nonce, and the
 * scripts they load. A page that the build prerendered is served as a file.
 * Its scripts have no nonce, so it gets no policy.
 */
export async function serveBuild(root) {
  const client = path.join(root, 'dist/client');
  assert(
    existsSync(path.join(root, 'dist/server/server.js')),
    `${path.relative(repo, root)}/dist is missing. Run without --no-build.`,
  );
  const server = await import(pathToFileURL(path.join(root, 'dist/server/server.js')).href);
  const manifest = JSON.parse(readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
  const entry = `/${manifest['src/client.ts'].file}`;
  let pages = 0;

  const http = createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const webRequest = new Request(`http://${request.headers.host}${request.url}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      let answer;
      if (request.method === 'POST') {
        answer = await server.handle(webRequest);
      }
      if (!answer && url.pathname.startsWith('/assets/')) {
        const file = path.join(client, path.normalize(url.pathname));
        assert(file.startsWith(client), 'outside the build');
        response.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(await readFile(file));
        return;
      }
      const page = path.join(client, path.normalize(url.pathname), 'index.html');
      // The request for a `#defer` body goes to the routes, also for a prerendered page.
      if (
        !answer &&
        request.method === 'GET' &&
        !request.headers['x-brumate-defer'] &&
        page.startsWith(client) &&
        existsSync(page)
      ) {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(await readFile(page));
        return;
      }
      const nonce = `e2e${++pages}${Math.random().toString(36).slice(2)}`;
      answer ??= await server.route(webRequest, {
        nonce,
        scripts: `<script type="module" async nonce="${nonce}" src="${entry}"></script>`,
      });
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      const headers = headersOf(answer);
      if ((headers['content-type'] ?? '').includes('html')) {
        headers['content-security-policy'] = `script-src 'nonce-${nonce}' 'strict-dynamic'`;
      }
      response.writeHead(answer.status, headers);
      if (answer.body) {
        Readable.fromWeb(answer.body).pipe(response);
      } else {
        response.end();
      }
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error?.stack ?? error));
    }
  });
  await new Promise((resolve) => http.listen(0, resolve));
  return {
    url: `http://localhost:${http.address().port}`,
    stop: () =>
      new Promise((resolve) => {
        http.closeAllConnections();
        http.close(resolve);
      }),
  };
}

const IGNORED = [/\/favicon\.ico$/];

/**
 * Collects the uncaught errors and console errors of a page.
 * A 404 of the favicon is the only error that is left out.
 */
export function watch(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page error: ${error.stack ?? error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const where = message.location().url ?? '';
    if (IGNORED.some((pattern) => pattern.test(where))) {
      return;
    }
    errors.push(`console error: ${message.text()}${where ? ` (${where})` : ''}`);
  });
  page.on('requestfailed', (request) => {
    if (!IGNORED.some((pattern) => pattern.test(request.url()))) {
      const reason = request.failure()?.errorText ?? '';
      // A navigation or a newer fetch cancels a request, which is not an error.
      if (reason !== 'net::ERR_ABORTED') {
        errors.push(`request failed: ${request.url()} ${reason}`);
      }
    }
  });
  return errors;
}

/**
 * Also fails on the warning that Chrome logs when the policy blocks a script,
 * such as an inline script without the nonce of the page.
 */
export function watchPolicy(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'warning' && /Content Security Policy/i.test(message.text())) {
      errors.push(`CSP: ${message.text()}`);
    }
  });
}

/** Fails with `message` when `value` is false. */
export function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

/** The distinct errors, each with the first lines of its stack, and at most five of them. */
function summarize(errors) {
  const counts = new Map();
  for (const error of errors) {
    const short = error.split('\n').slice(0, 4).join('\n');
    counts.set(short, (counts.get(short) ?? 0) + 1);
  }
  const lines = [...counts].map(([error, count]) =>
    count > 1 ? `${error}\n  (${count} times)` : error,
  );
  const more = lines.length > 5 ? [`and ${lines.length - 5} other errors`] : [];
  return [...lines.slice(0, 5), ...more].join('\n');
}

const slug = (text) =>
  text
    .replaceAll(/[^\w-]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 80);

/** Runs named checks and keeps their results. A failure saves a screenshot and the HTML of the page. */
export class Runner {
  results = [];
  #output;

  constructor(output) {
    this.#output = output;
  }

  /**
   * A check of a suite. `errors` are the errors that `watch` collects for `page`:
   * any new error during the check fails it.
   * Returns false when it fails, so a flow can stop.
   */
  async step(suite, name, { page, errors } = {}, check) {
    const start = Date.now();
    const before = errors?.length ?? 0;
    let failure;
    try {
      await check();
      if (page && errors) {
        // Errors of the last action can arrive a moment after it.
        await page.waitForTimeout(150);
      }
      if (errors && errors.length > before) {
        throw new Error(summarize(errors.slice(before)));
      }
    } catch (error) {
      failure = error;
    }
    const result = { suite, name, ok: !failure, ms: Date.now() - start };
    if (failure) {
      result.error = failure instanceof Error ? failure.message : String(failure);
      if (page && !page.isClosed()) {
        result.files = await this.#save(`${suite}-${slug(name)}`, page);
      }
    }
    this.results.push(result);
    const mark = result.ok ? 'ok  ' : 'FAIL';
    console.log(`  ${mark} ${name} (${result.ms} ms)`);
    if (failure) {
      console.log(indent(result.error, '         '));
    }
    return result.ok;
  }

  /** Steps that stop at the first failure, for a flow where each step needs the one before. */
  flow(suite, options) {
    let failed = false;
    return async (name, check) => {
      if (failed) {
        this.results.push({ suite, name, ok: false, skipped: true, ms: 0 });
        console.log(`  skip ${name}`);
        return false;
      }
      failed = !(await this.step(suite, name, options, check));
      return !failed;
    };
  }

  async #save(name, page) {
    mkdirSync(this.#output, { recursive: true });
    const screenshot = path.join(this.#output, `${name}.png`);
    const html = path.join(this.#output, `${name}.html`);
    const files = [];
    try {
      await page.screenshot({ path: screenshot, fullPage: true, timeout: 10_000 });
      files.push(screenshot);
    } catch {
      // A page that does not answer has no screenshot.
    }
    try {
      writeFileSync(html, await page.content());
      files.push(html);
    } catch {
      // Nor HTML.
    }
    return files;
  }
}

export function indent(text, prefix) {
  return text
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}
