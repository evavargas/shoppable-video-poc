import { defineConfig } from 'vite';

// Third bundle: the host panel (Firebase Auth + Firestore). Not loaded by the widget or the store.
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/host/host.ts', name: 'PocHost', formats: ['iife'], fileName: () => 'host.js' },
  },
});
