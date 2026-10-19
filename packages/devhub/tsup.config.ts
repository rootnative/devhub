import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
    'cache-provider': 'src/cache-provider/index.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  dts: {
    entry: {
      index: 'src/index.ts',
      'cache-provider': 'src/cache-provider/index.ts',
    },
  },
  clean: true,
  sourcemap: false,
})
