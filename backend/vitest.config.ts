import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@fast-travel/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
});
