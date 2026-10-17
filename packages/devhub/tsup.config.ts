import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  dts: { entry: { index: 'src/index.ts' } },
  clean: true,
  sourcemap: false,
})
