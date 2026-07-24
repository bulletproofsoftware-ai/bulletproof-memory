import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: false,
    environment: 'node',
    testTimeout: 10_000,
    // Stage-final / Sub-task A: integration tests against the live memgraph
    // container via docker-exec shell-out can run 15-20s for the graphStore
    // sequence. Loosen the worker-RPC heartbeat so per-test timeout overrides
    // (via `it(..., {timeout}, ...)`) aren't shadowed by RPC-update timeouts.
    teardownTimeout: 30_000,
  },
});
