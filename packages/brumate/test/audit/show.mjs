// client-audit: prints the server module, render module and client parts of a test/render page.
// Usage, after `pnpm build`: node test/audit/show.mjs <name> [server|render|parts]
import { readFileSync } from 'node:fs';
import { compile } from '../../dist/index.js';

const [name, which] = process.argv.slice(2);
const path = new URL(`../render/${name}.brm`, import.meta.url).pathname;
const result = compile(readFileSync(path, 'utf8'), { filename: `${name}.brm`, path });
if (!which || which === 'source') console.log(`// ---- source\n${readFileSync(path, 'utf8')}`);
if (!which || which === 'server') console.log(`// ---- server\n${result.code ?? result.server}`);
if (!which || which === 'render') console.log(`// ---- render\n${result.render}`);
if (!which || which === 'parts') {
  for (const [part, code] of Object.entries(result.parts ?? {})) console.log(`// ---- part ${part}\n${code}`);
}
