// Cloudflare Worker: checks the Google Drive website folder every 5 minutes and asks
// Cloudflare Pages to rebuild when the folder has changed and then stopped changing.
// Settings: secrets GOOGLE_API_KEY and DEPLOY_HOOK, variable DRIVE_FOLDER_ID, KV binding STATE,
// cron trigger "*/5 * * * *".
// A free Worker may make 50 outside requests per run, so each run looks inside up to PER_RUN project
// folders: first the ones that look recently touched, then the rest in rotation. A rebuild is asked
// for on the first run that finds nothing new, so it never starts in the middle of an upload.
import { children, outline, describe } from '../scripts/drive.mjs';

const PER_RUN = 40;

export async function check(env, fetchFn = fetch) {
  const key = env.GOOGLE_API_KEY;
  const st = JSON.parse((await env.STATE.get('state')) || '{}');
  st.seen ||= {}; st.stamp ||= {}; st.hot ||= []; st.cursor ||= 0;
  const o = await outline(fetchFn, key, env.DRIVE_FOLDER_ID);
  if (!o.projectDirs.length) return 'skipped: folder empty or not readable';
  const n = o.projectDirs.length;

  const now = { '/layout': o.projectDirs.map((d) => `${d.id}|${d.name}`).join('\n'), '/site': describe(o.site) };
  if (o.peopleDir) now['/people'] = describe(await children(fetchFn, key, o.peopleDir.id));

  // Folders to open first: new ones, ones Drive says were modified, and ones that changed last run.
  const touched = o.projectDirs.filter((d) => !(d.id in st.seen) || st.stamp[d.id] !== d.modifiedTime);
  const urgent = [...touched, ...o.projectDirs.filter((d) => st.hot.includes(d.id) && !touched.includes(d))];
  const picked = urgent.slice(0, PER_RUN);
  for (let i = 0; i < n && picked.length < Math.min(PER_RUN, n); i++) {
    const d = o.projectDirs[(st.cursor + i) % n];
    if (!picked.includes(d)) picked.push(d);
  }
  st.cursor = (st.cursor + PER_RUN) % n;
  for (const d of picked) { now[d.id] = describe(await children(fetchFn, key, d.id)); st.stamp[d.id] = d.modifiedTime; }
  const waiting = urgent.length - Math.min(urgent.length, PER_RUN);

  // Until every folder has been looked at once, this is still the first look, not a change.
  const first = !st.ready;
  const changedIds = [];
  for (const [k, v] of Object.entries(now)) if (st.seen[k] !== v) { st.seen[k] = v; changedIds.push(k); }
  const live = new Set(['/layout', '/site', '/people', ...o.projectDirs.map((d) => d.id)]);
  for (const k of Object.keys(st.seen)) if (!live.has(k)) { delete st.seen[k]; delete st.stamp[k]; }
  if (o.projectDirs.every((d) => d.id in st.seen)) st.ready = true;
  st.hot = first ? [] : changedIds.filter((k) => !k.startsWith('/'));

  let result = 'unchanged';
  if (changedIds.length) {
    if (!first) st.dirty = true;
    result = first ? 'first look: recording the folder' : 'changed: waiting for uploads to finish';
  } else if (st.dirty && waiting > 0) result = 'changed: checking the remaining folders';
  else if (st.dirty) {
    const r = await fetchFn(env.DEPLOY_HOOK, { method: 'POST' });
    if (r.ok) { st.dirty = false; result = 'rebuild requested'; } else result = `rebuild request failed: ${r.status}`;
  }
  await env.STATE.put('state', JSON.stringify(st));
  return result;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(check(env).then((s) => console.log(s))); },
  async fetch() { return new Response('Kura folder watcher is running.'); },
};
