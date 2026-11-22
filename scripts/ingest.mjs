// Turns the content folder (the same layout as the Google Drive folder) into
// resized images in public/media and one data file the pages read.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { sections, parseInfo, normalizeSize, isYes, slugify, isImage, orderImages } from './parse.mjs';

const CONTENT = path.resolve(process.env.CONTENT_DIR || 'content');
const MEDIA = path.resolve('public/media');
const WIDTHS = [480, 800, 1200, 1600, 2000]; // the browser picks the smallest that fills the space
const warnings = [];
const warn = (m) => { warnings.push(m); console.warn('WARN ' + m); };

const exists = (p) => fs.stat(p).then(() => true, () => false);
const readText = (p) => fs.readFile(p, 'utf8').catch(() => '');
async function dirs(p) {
  const e = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
  return e.filter((d) => d.isDirectory() && !/^[._]/.test(d.name)).map((d) => d.name).sort((a, b) => a.localeCompare(b));
}
// Finds a folder or file whatever its capitalisation ("projects", "Projects").
async function find(parent, name) {
  const e = await fs.readdir(parent).catch(() => []);
  const hit = e.find((n) => n.toLowerCase() === name.toLowerCase());
  return hit ? path.join(parent, hit) : path.join(parent, name);
}

async function resize(src, outDir, n) {
  const st = await fs.stat(src);
  const meta = await sharp(src).metadata();
  const rotated = (meta.orientation || 1) >= 5;
  const w = rotated ? meta.height : meta.width, h = rotated ? meta.width : meta.height;
  const widths = WIDTHS.filter((x) => x < w);
  if (widths.length < WIDTHS.length) widths.push(Math.min(w, WIDTHS.at(-1)));
  // The name carries a short fingerprint of the original, so a replaced picture gets a new name.
  // That lets browsers keep pictures for a year without ever showing an old one.
  const tag = crypto.createHash('sha1').update(await fs.readFile(src)).update('q72').digest('hex').slice(0, 8);
  const list = [...new Set(widths)].map((width) => ({ width, name: `${String(n).padStart(2, '0')}-${width}-${tag}.webp` }));
  const todo = [];
  for (const f of list) {
    const old = await fs.stat(path.join(outDir, f.name)).catch(() => null);
    if (!old || old.mtimeMs < st.mtimeMs) todo.push(f);
  }
  if (todo.length) {
    // Decode the original once at the largest size needed, then cut the smaller sizes from that.
    const top = Math.max(...todo.map((f) => f.width));
    const { data, info } = await sharp(src).rotate().resize({ width: top, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
    const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };
    await Promise.all(todo.map((f) => sharp(data, raw).resize({ width: f.width, withoutEnlargement: true }).webp({ quality: 72, effort: 4 }).toFile(path.join(outDir, f.name))));
  }
  const files = list;
  const { dominant: d } = await sharp(src).resize(64).stats();
  const bg = '#' + [d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return { w, h, bg, files };
}

async function project(root, folder, taken) {
  const dir = path.join(root, folder);
  const names = await fs.readdir(dir);
  const infoName = names.find((n) => /^info\.txt$/i.test(n)) || names.find((n) => /\.txt$/i.test(n));
  const { fields, paragraphs } = parseInfo(infoName ? await readText(path.join(dir, infoName)) : '');
  const title = fields.title || folder;
  let slug = slugify(title);
  if (slug === 'project') slug = slugify(folder);
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(title)}-${i}`;
  const imageNames = orderImages(names.filter(isImage));
  if (!imageNames.length) { warn(`"${folder}" has no images and was left off the site.`); return null; }
  taken.add(slug);
  const outDir = path.join(MEDIA, slug);
  await fs.mkdir(outDir, { recursive: true });
  // Three images at a time; each keeps its place in the folder's order.
  const results = new Array(imageNames.length);
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let i; (i = next++) < imageNames.length; ) {
      try {
        const r = await resize(path.join(dir, imageNames[i]), outDir, i + 1);
        results[i] = { w: r.w, h: r.h, bg: r.bg, files: r.files.map((f) => ({ width: f.width, src: `media/${slug}/${f.name}` })) };
      } catch (e) { warn(`"${folder}/${imageNames[i]}" could not be read as an image and was skipped.`); }
    }
  }));
  const images = results.filter(Boolean);
  console.log(`  ${folder}: ${images.length} images`);
  if (!images.length) { warn(`"${folder}" has no usable images and was left off the site.`); return null; }
  const size = normalizeSize(fields.size || fields.category || '');
  if ((fields.size || fields.category) && !size) warn(`"${folder}": size "${fields.size || fields.category}" is not Small, Medium, Large or X Large.`);
  return {
    slug, title, size, type: fields.type || '', location: fields.location || '', year: fields.year || '',
    status: fields.status || '', client: fields.client || '', area: fields.area || '',
    featured: isYes(fields.featured), order: Number(fields.order) || 0, paragraphs, images,
  };
}

async function main() {
  if (!(await exists(CONTENT))) throw new Error(`Content folder not found: ${CONTENT}`);
  const projectsDir = await find(CONTENT, 'Projects');
  const siteDir = await find(CONTENT, 'Site');
  const taken = new Set(), projects = [];
  for (const folder of await dirs(projectsDir)) {
    try { const p = await project(projectsDir, folder, taken); if (p) projects.push(p); }
    catch (e) { warn(`"${folder}" was skipped: ${e.message}`); }
  }
  if (!projects.length) throw new Error('No projects with images were found. The live site is left unchanged.');
  projects.sort((a, b) => (b.order - a.order) || a.title.localeCompare(b.title));

  // Remove images of projects that no longer exist.
  for (const d of await dirs(MEDIA)) if (!taken.has(d)) await fs.rm(path.join(MEDIA, d), { recursive: true, force: true });

  const studio = parseInfo(await readText(await find(siteDir, 'studio.txt')));
  const contact = parseInfo(await readText(await find(siteDir, 'contact.txt')));
  const home = parseInfo(await readText(await find(siteDir, 'home.txt')));
  const peopleDir = await find(siteDir, 'people');
  const people = [];
  for (const n of (await fs.readdir(peopleDir).catch(() => [])).filter((n) => /\.txt$/i.test(n)).sort()) {
    const p = parseInfo(await readText(path.join(peopleDir, n)));
    people.push({ name: p.fields.name || n.replace(/^\d+\s*/, '').replace(/\.txt$/i, ''), role: p.fields.role || '', country: p.fields.country || '', qualifications: (p.fields.qualifications || '').split(',').map((x) => x.trim()).filter(Boolean), paragraphs: p.paragraphs });
  }
  studio.sections = sections(studio.paragraphs);
  const data = { projects, studio, contact, home, people, warnings, built: new Date().toISOString() };
  await fs.mkdir('src/data', { recursive: true });
  await fs.writeFile('src/data/site.json', JSON.stringify(data));
  console.log(`Ingested ${projects.length} projects, ${projects.reduce((n, p) => n + p.images.length, 0)} images, ${warnings.length} warnings.`);
}
main().catch((e) => { console.error('BUILD STOPPED: ' + e.message); process.exit(1); });
