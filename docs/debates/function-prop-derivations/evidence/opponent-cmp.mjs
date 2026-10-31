import { readFileSync, readdirSync, statSync } from 'node:fs';
function pick(r) { return JSON.stringify([r.client, r.parts, r.table, r.server, r.clientCode]); }
import { join } from 'node:path';
const [,, distA, distB, ...roots] = process.argv;
const A = await import(distA + '/index.js');
const B = await import(distB + '/index.js');
const files = [];
function walk(d) { for (const n of readdirSync(d)) { if (n === 'node_modules' || n === 'dist' || n.startsWith('.')) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (n.endsWith('.brm')) files.push(p); } }
for (const r of roots) walk(r);
let n = 0, diff = 0, err = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let a, b;
  try { a = pick(A.compile(src, { filename: f, path: f })); } catch (e) { a = 'ERR ' + e.message; console.log('E', f, e.message.slice(0,100)); }
  try { b = pick(B.compile(src, { filename: f, path: f })); } catch (e) { b = 'ERR ' + e.message; }
  n++;
  if (a.startsWith('ERR')) err++;
  if (a !== b) { diff++; console.log('DIFF', f); }
}
console.log({ n, diff, err });
