import { defineConfig } from 'astro/config';
export default defineConfig({ site: process.env.SITE_URL || 'https://example.pages.dev', build: { format: 'directory' },
  // Start fetching a page when the pointer rests on its link (or it is touched), so the click opens it at once.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' } });
