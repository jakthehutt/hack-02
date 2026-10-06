import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { reportPlugin } from './scripts/vite-report-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// The bundle is the only data the presentation layer reads (see ../bundles/README.md).
// FORESHOCK_BUNDLE points the build at another one.
const BUNDLE = process.env.FORESHOCK_BUNDLE
  ? path.resolve(process.env.FORESHOCK_BUNDLE)
  : path.resolve(here, '../bundles/latest.json');

export default defineConfig({
  plugins: [react(), reportPlugin({ root: here })],
  resolve: { alias: { '@bundle': BUNDLE } },
  // fs.allow replaces Vite's default, so the project itself has to be listed too.
  server: { fs: { allow: [searchForWorkspaceRoot(here), path.dirname(BUNDLE)] } },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(here, 'index.html'),
        studio: path.resolve(here, 'studio.html'),
        sheet: path.resolve(here, 'sheet.html'),
      },
    },
  },
});
