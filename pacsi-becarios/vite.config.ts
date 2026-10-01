import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Todo (JS + CSS) queda dentro de un único index.html: funciona con doble clic,
  // sin servidor y sin internet, y es lo que carga el programa de escritorio.
  plugins: [react(), viteSingleFile()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
