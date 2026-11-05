import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'preserved-journey-core-dev',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('/journey-core.cjs')) return null;
      // Keep the supplied engine byte-identical on disk. The dev server needs
      // an ESM facade; production uses Rollup's CommonJS conversion below.
      return { code: 'const module = { exports: {} };\n' + code + '\nexport default module.exports;', map: null };
    },
  }],
  build: {
    commonjsOptions: { include: [/node_modules/, /journey-core\.cjs$/] },
    // The locally bundled renderer is intentionally retained for offline use.
    chunkSizeWarningLimit: 650,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
