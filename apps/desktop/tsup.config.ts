import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { main: 'src/main.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  // Electron gives the module at run time. tsup bundles a devDependency
  // unless it is named here.
  external: ['electron'],
  clean: true,
  sourcemap: false,
})
