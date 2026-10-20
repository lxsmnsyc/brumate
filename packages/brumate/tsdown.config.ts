import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/runtime/server.ts',
    'src/runtime/client.ts',
    'src/runtime/loader.ts',
  ],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  fixedExtension: false,
});
