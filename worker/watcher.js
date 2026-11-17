// Cloudflare Worker: checks the Google Drive website folder every 5 minutes and asks
// Cloudflare Pages to rebuild when the folder has changed and then stopped changing.
// Settings: secrets GOOGLE_API_KEY and DEPLOY_HOOK, variable DRIVE_FOLDER_ID, KV binding STATE,
// cron trigger "*/5 * * * *".
// A free Worker may make 50 outside requests per run, so each run looks at up to PER_RUN project
// folders and carries on from there next time. A rebuild waits until every folder has been
// looked at once more with nothing new, so it never starts in the middle of an upload.
import { children, outline, describe } from '../scripts/drive.mjs';

const PER_RUN = 40;

export async function check(env, fetchFn = fetch) {
  const key = env.GOOGLE_API_KEY;
  const st = JSON.parse((await env.STATE.get('state')) || '{}');
  st.seen ||= {}; st.cursor ||= 0; st.quiet ||= 0;
  const o = await outline(fetchFn, key, env.DRIVE_FOLDER_ID);
  if (!o.projectDirs.length) return 'skipped: folder empty or not readable';

  const now = { '/layout': o.projectDirs.map((d) => `${d.id}|${d.name}`).join('\n'), '/site': describe(o.site) };
  if (o.peopleDir) now['/people'] = describe(await children(fetchFn, key, o.peopleDir.id));
  const n = o.projectDirs.length, count = Math.min(PER_RUN, n);
  for (let i = 0; i < count; i++) {
    const d = o.projectDirs[(st.cursor + i) % n];
    now[d.id] = describe(await children(fetchFn, key, d.id));
  }
  st.cursor = (st.cursor + count) % n;

  const first = !Object.keys(st.seen).length;
  let changed = false;
  for (const [k, v] of Object.entries(now)) if (st.seen[k] !== v) { st.seen[k] = v; changed = true; }
  const live = new Set(['/layout', '/site', '/people', ...o.projectDirs.map((d) => d.id)]);
  for (const k of Object.keys(st.seen)) if (!live.has(k)) delete st.seen[k];

  let result = 'unchanged';
  if (changed) { st.dirty = !first || st.dirty; st.quiet = 0; result = first ? 'first look: recording the folder' : 'changed: waiting for uploads to finish'; }
  else if (st.dirty && ++st.quiet >= Math.ceil(n / PER_RUN)) {
    const r = await fetchFn(env.DEPLOY_HOOK, { method: 'POST' });
    if (r.ok) { st.dirty = false; st.quiet = 0; result = 'rebuild requested'; } else result = `rebuild request failed: ${r.status}`;
  } else if (st.dirty) result = 'changed: checking the remaining folders';
  await env.STATE.put('state', JSON.stringify(st));
  return result;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env).then((s) => console.log(s))); },
  async fetch() { return new Response('Kura folder watcher is running.'); },
};
