import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://poligrafo-29n.pages.dev',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
