import { fileURLToPath, URL } from 'node:url';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // TODO: Configurar una vez creados los tokens, LDS-31 (https://hipstha.atlassian.net/browse/LDS-31)
        // additionalData: `@use "@/styles/tokens" as *;`,
      },
    },
  },
  test: {
    environment: 'jsdom', // alternativa evaluada: happy-dom
    globals: true,
    setupFiles: ['/vitest.setup.ts'],
    css: true,
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
