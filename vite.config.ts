import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const gamesDir = resolve(root, 'src/games');

// Every folder under src/games with an index.html becomes its own page.
const gameInputs = Object.fromEntries(
  readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(gamesDir, d.name, 'index.html')))
    .map((d) => [`games/${d.name}`, resolve(gamesDir, d.name, 'index.html')]),
);

// BASE_PATH is set by the deploy workflow, e.g. "/schoolgames/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: resolve(root, 'index.html'), ...gameInputs },
    },
  },
});
