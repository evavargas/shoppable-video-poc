import { defineConfig } from 'vite';

// Second bundle: only the Firebase SDK. IIFE bundles can't code-split, so "lazy" means a separate file
// that the widget injects with a <script> tag when a live video opens.
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    emptyOutDir: false, // keep widget.js from the first build
    lib: { entry: 'src/live/live.ts', name: 'PocLive', formats: ['iife'], fileName: () => 'live.js' },
  },
});
