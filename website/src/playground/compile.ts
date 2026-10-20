// Compiles a component in the browser for the playground, with the same
// compiler that builds this site.
import { compile } from 'brumate';

export interface Output {
  ok: boolean;
  error: string;
  /** The modules that the compiler wrote, by tab name. */
  modules: { name: string; code: string; language: 'ts' | 'css' }[];
  warnings: string[];
}

export function run(source: string): Output {
  try {
    const result = compile(source, { filename: 'Playground.brm', merge: 2048 });
    const parts = Object.entries(result.parts).map(([name, code]) => ({
      name: `part ${name}`,
      code,
      language: 'ts' as const,
    }));
    return {
      ok: true,
      error: '',
      modules: [
        { name: 'server', code: result.server, language: 'ts' },
        { name: 'client entry', code: result.client, language: 'ts' },
        ...parts,
        { name: 'render', code: result.render, language: 'ts' },
        ...(result.css ? [{ name: 'css', code: result.css, language: 'css' as const }] : []),
      ],
      warnings: result.warnings.map((warning) => warning.message),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      modules: [],
      warnings: [],
    };
  }
}

/** The size of each client module, in bytes and gzipped. */
export async function measure(
  output: Output,
): Promise<{ name: string; bytes: number; gzip: number }[]> {
  const client = output.modules.filter(
    (module) => module.name === 'client entry' || module.name.startsWith('part '),
  );
  return Promise.all(
    client.map(async (module) => {
      const bytes = new TextEncoder().encode(module.code);
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      const gzip = (await new Response(stream).arrayBuffer()).byteLength;
      return { name: module.name, bytes: bytes.length, gzip };
    }),
  );
}

/** The source in the address, so a link shares it. */
export function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

export function decode(hash: string): string | undefined {
  try {
    return hash
      ? new TextDecoder().decode(Uint8Array.from(atob(hash), (char) => char.charCodeAt(0)))
      : undefined;
  } catch {
    return undefined;
  }
}
