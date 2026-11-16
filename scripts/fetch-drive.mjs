// Downloads the content folder from Google Drive (through apps-script/Code.gs) into ./content.
// Does nothing when CONTENT_URL is not set, so local builds keep using a local folder.
import fs from 'node:fs/promises';
import path from 'node:path';

const URL_ = process.env.CONTENT_URL, KEY = process.env.CONTENT_KEY;
if (!URL_ || !KEY) { console.log('CONTENT_URL not set: using the local content folder.'); process.exit(0); }
const OUT = path.resolve(process.env.CONTENT_DIR || 'content');
const safe = (n) => n.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_');

async function call(params, tries = 4) {
  const u = `${URL_}?${new URLSearchParams({ key: KEY, ...params })}`;
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(u, { redirect: 'follow' });
      const text = await r.text();
      const j = JSON.parse(text); // Google answers errors with an HTML page, which fails here and is retried
      if (j.error) throw new Error(j.error);
      return j;
    } catch (e) {
      if (t >= tries) throw new Error(`Google Drive did not answer (${params.action} ${params.id || ''}): ${e.message}`);
      await new Promise((s) => setTimeout(s, 1500 * t));
    }
  }
}

const m = await call({ action: 'manifest' });
if (!m.projects?.length) { console.error('BUILD STOPPED: the Projects folder in Google Drive is empty or missing. The live site is left unchanged.'); process.exit(1); }
const jobs = [];
for (const p of m.projects) for (const f of p.files) jobs.push([path.join(OUT, 'Projects', safe(p.name)), f]);
for (const f of m.site) jobs.push([path.join(OUT, 'Site'), f]);
for (const f of m.people) jobs.push([path.join(OUT, 'Site', 'people'), f]);
await fs.rm(OUT, { recursive: true, force: true });
for (const p of m.projects) await fs.mkdir(path.join(OUT, 'Projects', safe(p.name)), { recursive: true });
await fs.mkdir(path.join(OUT, 'Site', 'people'), { recursive: true });

let done = 0, bytes = 0;
async function worker() {
  for (let job; (job = jobs.pop()); ) {
    const [dir, f] = job;
    const j = await call({ action: 'file', id: f.id });
    const buf = Buffer.from(j.data, 'base64');
    await fs.writeFile(path.join(dir, safe(f.name)), buf);
    bytes += buf.length;
    if (++done % 25 === 0) console.log(`  ${done} files`);
  }
}
const total = jobs.length;
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`Downloaded ${total} files (${(bytes / 1048576).toFixed(0)} MB) from Google Drive for ${m.projects.length} projects.`);
