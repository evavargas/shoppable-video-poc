import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Library mode doesn't replace process.env.NODE_ENV, but React reads it at runtime.
  // In a browser <script> there is no `process`, so we bake it in. (Not in tests: React needs dev mode for act().)
  define: mode === 'test' ? {} : { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'PocWidget',
      // IIFE = one self-executing file with no import/export: what a plain <script src> needs.
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
}));
