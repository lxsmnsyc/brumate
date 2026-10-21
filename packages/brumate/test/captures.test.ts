import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { render } from '../src/runtime/server.ts';

const output = new URL('./.output/captures/', import.meta.url);

/** A component whose handler reads `db`, declared as given. */
function component(declaration: string): string {
  return `<script module>\n  export class Database {\n    save() {}\n  }\n  export function connect() {\n    return new Database();\n  }\n</script>\n<script>\n  import { $signal } from 'brumate/signals';\n  ${declaration}\n  let saved = $signal(false);\n  function save() {\n    db.save();\n    saved = true;\n  }\n</script>\n<button onClick=save>{saved}</button>\n`;
}

describe('values that cannot be sent to the browser', () => {
  it('fail to compile when the browser reads a value made with new', () => {
    expect(() =>
      compile(component('const db = new Database();'), { filename: 'Saver.brm' }),
    ).toThrow(
      '"db" holds a new Database, which cannot be sent to the browser, and code that runs in the browser reads it (function save)',
    );
  });

  it('compile when the value can be sent, such as a Map', () => {
    expect(() =>
      compile(component('const db = { save() {} } as const;\n  const cache = new Map();'), {
        filename: 'Saver.brm',
      }),
    ).not.toThrow();
  });

  it('fail the render with the name of the value, when the compiler cannot see it', async () => {
    const { server } = compile(component('const db = connect();'), { filename: 'Saver.brm' });
    mkdirSync(output, { recursive: true });
    writeFileSync(new URL('Saver.brm.ts', output), server);
    const module = await import(new URL('Saver.brm.ts', output).href);
    await expect(render(module.default, {})).rejects.toThrow('The value of "db" in Saver_');
    await expect(render(module.default, {})).rejects.toThrow(
      'holds a Database, which cannot be sent',
    );
  });
});
