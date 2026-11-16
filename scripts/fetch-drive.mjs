// Downloads the website folder from Google Drive into ./content before a build.
// Does nothing when GOOGLE_API_KEY is not set, so local builds keep using a local folder.
import fs from 'node:fs/promises';
import path from 'node:path';
import { manifest, download, localName } from './drive.mjs';

const KEY = process.env.GOOGLE_API_KEY, ROOT = process.env.DRIVE_FOLDER_ID;
if (!KEY || !ROOT) { console.log('GOOGLE_API_KEY or DRIVE_FOLDER_ID not set: using the local content folder.'); process.exit(0); }
const OUT = path.resolve(process.env.CONTENT_DIR || 'content');
const safe = (n) => n.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_');

try {
  const m = await manifest(fetch, KEY, ROOT);
  if (!m.projects.length) throw new Error('the Projects folder in Google Drive is empty, missing, or not shared as "Anyone with the link".');
  const jobs = [];
  for (const p of m.projects) for (const f of p.files) jobs.push([path.join(OUT, 'Projects', safe(p.name)), f]);
  for (const f of m.site) jobs.push([path.join(OUT, 'Site'), f]);
  for (const f of m.people) jobs.push([path.join(OUT, 'Site', 'people'), f]);
  await fs.rm(OUT, { recursive: true, force: true });
  for (const p of m.projects) await fs.mkdir(path.join(OUT, 'Projects', safe(p.name)), { recursive: true });
  await fs.mkdir(path.join(OUT, 'Site', 'people'), { recursive: true });
  const total = jobs.length;
  let done = 0, bytes = 0;
  async function worker() {
    for (let job; (job = jobs.pop()); ) {
      const [dir, f] = job;
      const buf = await download(fetch, KEY, f);
      await fs.writeFile(path.join(dir, safe(localName(f))), buf);
      bytes += buf.length;
      if (++done % 50 === 0) console.log(`  ${done} of ${total} files`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Downloaded ${total} files (${(bytes / 1048576).toFixed(0)} MB) from Google Drive for ${m.projects.length} projects.`);
} catch (e) {
  console.error(`BUILD STOPPED: ${e.message} The live site is left unchanged.`);
  process.exit(1);
}
