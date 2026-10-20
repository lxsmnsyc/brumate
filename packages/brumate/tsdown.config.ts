import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/runtime/server.ts',
    'src/runtime/client.ts',
    'src/runtime/loader.ts',
    'src/runtime/context.ts',
    'src/runtime/html.ts',
    'src/vite.ts',
    'src/cli.ts',
  ],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  fixedExtension: false,
});
