import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'tsdown';

const require = createRequire(import.meta.url);
const oxc = path.dirname(
  require.resolve('oxc-parser/package.json', { paths: [require.resolve('brumate')] }),
);

// Each file bundles its dependencies, so the extension needs no node_modules.
export default defineConfig({
  entry: {
    extension: 'src/extension.ts',
    server: 'src/server.ts',
    // The TypeScript server loads it by package name: see scripts/after-build.ts.
    'typescript-plugin': '../typescript-plugin/src/index.ts',
  },
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  external: ['vscode', 'typescript'],
  noExternal: [/.*/],
  // The parser of the compiler uses its WebAssembly build, instead of a native
  // module for each platform. scripts/after-build.ts copies the .wasm file.
  alias: {
    'oxc-parser': path.join(oxc, 'src-js/wasm.js'),
    '@oxc-parser/binding-wasm32-wasip1': require.resolve('@oxc-parser/binding-wasm32-wasi'),
  },
  // Some language services ship a UMD build as `main`, which loads its files at
  // run time. Their ES module build bundles.
  inputOptions: { resolve: { mainFields: ['module', 'main'] } },
  dts: false,
  fixedExtension: true,
});
