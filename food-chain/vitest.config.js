import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // ESM is handled natively since package.json has "type": "module"
    globals: false,
    include: ['**/*.test.js'],
    exclude: ['node_modules/**']
  }
});
