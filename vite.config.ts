/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  watch: {
    ignored: ['**/.gradle-home/**', '**/android/build/**', '**/android/app/build/**'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
