import { activateAutoInsertion, createLabsInfo } from '@volar/vscode';
import { LanguageClient, TransportKind } from '@volar/vscode/node';
import type { ExtensionContext } from 'vscode';

let client: LanguageClient | undefined;

/**
 * Starts the language server for `.brm` files. TypeScript features come from
 * the TypeScript server, through the plugin that this extension contributes.
 */
export async function activate(context: ExtensionContext): Promise<unknown> {
  const module = context.asAbsolutePath('dist/server.cjs');
  client = new LanguageClient(
    'brumate',
    'brumate',
    {
      run: { module, transport: TransportKind.ipc },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: { execArgv: ['--nolazy', '--inspect=6009'] },
      },
    },
    { documentSelector: [{ language: 'brumate' }] },
  );
  await client.start();
  activateAutoInsertion('brumate', client);
  // Volar Labs reads the virtual code of a file from this.
  const labs = createLabsInfo();
  labs.addLanguageClient(client);
  return labs.extensionExports;
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop();
}
