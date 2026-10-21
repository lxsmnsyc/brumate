import { createBrumateLanguagePlugin } from '@brumate/language-core';
import { createConnection, createServer, createSimpleProject } from '@volar/language-server/node';
import type { URI } from 'vscode-uri';
import { create as createCssPlugin } from 'volar-service-css';
import { createDiagnosticsPlugin } from './diagnostics.ts';

export { diagnose } from './diagnostics.ts';

/**
 * Starts the language server on the connection of the process. TypeScript
 * features come from `@brumate/typescript-plugin` in the TypeScript server,
 * so this server gives the rest: styles, and the diagnostics of the compiler.
 */
export function start(): void {
  const connection = createConnection();
  const server = createServer(connection);
  connection.listen();
  connection.onInitialize((params) =>
    server.initialize(
      params,
      createSimpleProject([createBrumateLanguagePlugin<URI>({}, (uri) => uri.fsPath)]),
      [createCssPlugin(), createDiagnosticsPlugin()],
    ),
  );
  connection.onInitialized(server.initialized);
  connection.onShutdown(server.shutdown);
}
