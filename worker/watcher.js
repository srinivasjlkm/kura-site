// Cloudflare Worker: checks the Google Drive website folder every 5 minutes and asks
// Cloudflare Pages to rebuild when the folder has changed and then stopped changing.
// Settings: secrets GOOGLE_API_KEY and DEPLOY_HOOK, variable DRIVE_FOLDER_ID, KV binding STATE,
// cron trigger "*/5 * * * *".
import { manifest, fingerprintSource } from '../scripts/drive.mjs';

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function check(env, fetchFn = fetch) {
  const m = await manifest(fetchFn, env.GOOGLE_API_KEY, env.DRIVE_FOLDER_ID);
  if (!m.projects.length) return 'skipped: folder empty or not readable';
  const now = await sha256(fingerprintSource(m));
  const [seen, built] = await Promise.all([env.STATE.get('seen'), env.STATE.get('built')]);
  if (now !== seen) { await env.STATE.put('seen', now); return 'changed: waiting for uploads to finish'; }
  if (now === built) return 'unchanged';
  const r = await fetchFn(env.DEPLOY_HOOK, { method: 'POST' });
  if (!r.ok) return `rebuild request failed: ${r.status}`;
  await env.STATE.put('built', now);
  return 'rebuild requested';
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env).then((s) => console.log(s))); },
  async fetch() { return new Response('Kura folder watcher is running.'); },
};
