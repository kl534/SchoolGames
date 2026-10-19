import { defineConfig } from 'vitest/config';

// Node 25+ prints a warning per worker about its experimental localStorage. Node 22 has no
// webstorage to disable, so only pass the flag on newer Node.
const execArgv =
  Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-experimental-webstorage'] : [];

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], execArgv },
});
