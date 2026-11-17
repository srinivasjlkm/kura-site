// Reads a Google Drive folder that is shared as "Anyone with the link can view",
// using the Drive API with an API key. No sign-in to Google is involved.
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const GDOC = 'application/vnd.google-apps.document';

async function get(fetchFn, url, tries = 4) {
  for (let t = 1; ; t++) {
    const r = await fetchFn(url);
    if (r.ok) return r;
    const retry = r.status === 429 || r.status >= 500 || r.status === 403;
    if (!retry || t >= tries) {
      let why = '';
      try { why = (await r.json()).error?.message || ''; } catch {}
      throw new Error(`Google Drive answered ${r.status} for ${url.split('?')[0]}${why ? `: ${why.replace(/key=[\w-]+/g, 'key=…')}` : ''}.`);
    }
    await new Promise((s) => setTimeout(s, 800 * t * t));
  }
}

// Lists the direct children of one folder. (Google refuses a key-only request that names several folders at once.)
export async function children(fetchFn, key, parentId) {
  const out = [];
  let pageToken = '';
  do {
    const u = `${API}?${new URLSearchParams({ q: `'${parentId}' in parents and trashed = false`, key, pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime)', ...(pageToken && { pageToken }) })}`;
    const j = await (await get(fetchFn, u)).json();
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

export const isFolder = (f) => f.mimeType === FOLDER;
export const usable = (f) => !f.name.startsWith('.') && (f.mimeType === GDOC || /^(image\/|text\/plain)/.test(f.mimeType));
const byName = (a, b) => a.name.localeCompare(b.name);
const named = (list, name) => list.find((f) => isFolder(f) && f.name.trim().toLowerCase() === name);
export const files = (list) => list.filter((f) => !isFolder(f) && usable(f)).sort(byName);

/** The folders that make up the site: { projectDirs, site (files), peopleDir }. Three requests. */
export async function outline(fetchFn, key, rootId) {
  const top = await children(fetchFn, key, rootId);
  const projectsDir = named(top, 'projects'), siteDir = named(top, 'site');
  const [inProjects, inSite] = await Promise.all([projectsDir, siteDir].map((d) => (d ? children(fetchFn, key, d.id) : [])));
  return { projectDirs: inProjects.filter(isFolder).sort(byName), site: files(inSite), peopleDir: named(inSite, 'people') || null };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { for (let i; (i = next++) < items.length; ) out[i] = await fn(items[i]); }));
  return out;
}

/** Returns { projects: [{name, files}], site: [files], people: [files] } for the website folder. */
export async function manifest(fetchFn, key, rootId) {
  const o = await outline(fetchFn, key, rootId);
  const lists = await mapLimit([...o.projectDirs, ...(o.peopleDir ? [o.peopleDir] : [])], 8, (d) => children(fetchFn, key, d.id));
  return {
    projects: o.projectDirs.map((d, i) => ({ name: d.name, files: files(lists[i]) })),
    site: o.site,
    people: o.peopleDir ? files(lists.at(-1)) : [],
  };
}

/** A Google Doc is saved as plain text, so the client can edit text in the browser. */
export const localName = (f) => (f.mimeType === GDOC ? `${f.name.replace(/\.txt$/i, '')}.txt` : f.name);

export async function download(fetchFn, key, f) {
  const u = f.mimeType === GDOC
    ? `${API}/${f.id}/export?${new URLSearchParams({ mimeType: 'text/plain', key })}`
    : `${API}/${f.id}?${new URLSearchParams({ alt: 'media', key })}`;
  return Buffer.from(await (await get(fetchFn, u)).arrayBuffer());
}

/** One line per file; changes whenever a file is added, removed, renamed or edited. */
export const describe = (list) => files(list).map((f) => `${f.name}|${f.id}|${f.md5Checksum || f.modifiedTime}`).join('\n');
