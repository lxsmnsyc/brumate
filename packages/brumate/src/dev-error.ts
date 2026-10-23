// An error while the dev server renders a page, shown in Vite's error overlay.

import { resolve } from 'node:path';
import { version as viteVersion } from 'vite';
import type { ViteDevServer } from 'vite';
import { BRUMATE_VERSION } from './version.ts';
import type { Location } from './error.ts';

/** The error that Vite's overlay shows. */
export interface ErrorPayload {
  message: string;
  stack: string;
  id?: string;
  frame?: string;
  plugin?: string;
  loc?: { file: string; line: number; column: number };
}

/** The overlay payload of an error, with the file, line and lines around it for compile errors. */
export function errorPayload(error: unknown, root: string = process.cwd()): ErrorPayload {
  const value = error instanceof Error ? error : new Error(String(error));
  const located = value as Error & {
    filename?: string;
    location?: Location;
    frame?: string;
    // Vite adds these to errors of plugins, such as a compile error that `ssrLoadModule` throws.
    loc?: { file?: string; line: number; column: number };
    id?: string;
    plugin?: string;
  };
  const payload: ErrorPayload = {
    message: value.message,
    // A compile error has no useful stack: the message names the file and line.
    stack: located.frame ? '' : (value.stack ?? ''),
  };
  if (located.loc && located.frame) {
    const file = located.loc.file ?? located.id ?? '';
    payload.stack = '';
    payload.id = file;
    payload.plugin = located.plugin;
    payload.frame = located.frame;
    payload.loc = { file, line: located.loc.line, column: located.loc.column };
  } else if (located.filename && located.location) {
    const file = resolve(root, located.filename);
    payload.id = file;
    payload.plugin = 'brumate';
    payload.frame = located.frame;
    payload.loc = { file, line: located.location.line, column: located.location.column };
  }
  return payload;
}

/**
 * A page that shows an error in Vite's error overlay, for a dev server to
 * answer with when a page fails to render. It loads again when a file changes.
 *
 * ```ts
 * } catch (error) {
 *   response.statusCode = 500;
 *   response.setHeader('content-type', 'text/html');
 *   response.end(errorPage(error, vite));
 * }
 * ```
 */
export function errorPage(error: unknown, server?: ViteDevServer): string {
  if (server && error instanceof Error) {
    server.ssrFixStacktrace(error);
  }
  const payload = errorPayload(error, server?.config.root);
  server?.config.logger.error(
    payload.loc ? `${payload.message}\n${payload.frame}` : String((error as Error)?.stack ?? error),
  );
  // `<` is escaped, so the error cannot end the script.
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const base = server?.config.base ?? '/';
  const meta = JSON.stringify({ version: BRUMATE_VERSION, vite: viteVersion });
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Error</title>
<script type="module" src="${base}@vite/client"></script>
</head>
<body>
<pre id="brumate-error" style="white-space: pre-wrap; font: 14px monospace; padding: 16px"></pre>
<script type="module">
import { createHotContext } from '${base}@vite/client';
const error = ${json};
// The Errors tab of the devtools shows the error with its code. Vite's overlay is the fallback.
try {
  const devtools = await import('${base}@id/brumate/devtools');
  devtools.reportError(devtools.installDevtools(undefined, undefined, ${meta}), error, 'server');
} catch {
  const Overlay = customElements.get('vite-error-overlay');
  if (Overlay) {
    document.body.append(new Overlay(error));
  } else {
    document.getElementById('brumate-error').textContent = [error.message, error.frame, error.stack].filter(Boolean).join('\\n\\n');
  }
}
// A component that updates in place, after a fix, loads the page again.
const hot = createHotContext('/@brumate/error');
hot.on('brumate:update', () => location.reload());
hot.on('vite:beforeUpdate', () => location.reload());
</script>
</body>
</html>
`;
}
