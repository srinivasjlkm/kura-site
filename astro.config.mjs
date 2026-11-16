import { defineConfig } from 'astro/config';
export default defineConfig({ site: process.env.SITE_URL || 'https://example.pages.dev', build: { format: 'directory' } });
