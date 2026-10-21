// Adds the files that the bundles load at run time, so the packaged
// extension needs no dependencies.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = new URL('../dist/', import.meta.url);

// The parser of the compiler runs on WebAssembly, which works on every
// platform. Its loader reads these files from its own folder.
const binding = path.dirname(require.resolve('@oxc-parser/binding-wasm32-wasi/package.json'));
for (const file of ['parser.wasm32-wasi.wasm', 'wasi-worker.mjs']) {
  copyFileSync(path.join(binding, file), new URL(file, dist));
}

// The TypeScript server loads a plugin by package name, from the
// node_modules folder of the extension. This package loads the bundled plugin.
const pack = new URL('../node_modules/brumate-typescript-plugin-pack/', import.meta.url);
mkdirSync(pack, { recursive: true });
writeFileSync(
  new URL('package.json', pack),
  `${JSON.stringify({ name: 'brumate-typescript-plugin-pack', main: 'index.js' }, null, 2)}\n`,
);
writeFileSync(
  new URL('index.js', pack),
  "module.exports = require('../../dist/typescript-plugin.cjs');\n",
);
