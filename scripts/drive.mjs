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
    if (!retry || t >= tries) throw new Error(`Google Drive answered ${r.status} for ${url.split('?')[0]}`);
    await new Promise((s) => setTimeout(s, 800 * t * t));
  }
}

// Lists the direct children of several folders in one request (25 folders per request).
export async function children(fetchFn, key, parentIds) {
  const out = [];
  for (let i = 0; i < parentIds.length; i += 25) {
    const q = `(${parentIds.slice(i, i + 25).map((p) => `'${p}' in parents`).join(' or ')}) and trashed = false`;
    let pageToken = '';
    do {
      const u = `${API}?${new URLSearchParams({ q, key, pageSize: '1000', fields: 'nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime,parents)', ...(pageToken && { pageToken }) })}`;
      const j = await (await get(fetchFn, u)).json();
      out.push(...(j.files || []));
      pageToken = j.nextPageToken || '';
    } while (pageToken);
  }
  return out;
}

const isFolder = (f) => f.mimeType === FOLDER;
const usable = (f) => !f.name.startsWith('.') && (f.mimeType === GDOC || /^(image\/|text\/plain)/.test(f.mimeType));
const byName = (a, b) => a.name.localeCompare(b.name);
const named = (list, name) => list.find((f) => isFolder(f) && f.name.trim().toLowerCase() === name);

/** Returns { projects: [{name, files}], site: [files], people: [files] } for the website folder. */
export async function manifest(fetchFn, key, rootId) {
  const top = await children(fetchFn, key, [rootId]);
  const projectsDir = named(top, 'projects'), siteDir = named(top, 'site');
  const second = await children(fetchFn, key, [projectsDir, siteDir].filter(Boolean).map((f) => f.id));
  const projectDirs = second.filter((f) => isFolder(f) && projectsDir && f.parents?.includes(projectsDir.id)).sort(byName);
  const site = second.filter((f) => !isFolder(f) && siteDir && f.parents?.includes(siteDir.id) && usable(f)).sort(byName);
  const peopleDir = siteDir && second.find((f) => isFolder(f) && f.parents?.includes(siteDir.id) && f.name.trim().toLowerCase() === 'people');
  const third = await children(fetchFn, key, [...projectDirs, peopleDir].filter(Boolean).map((f) => f.id));
  const inDir = (d) => third.filter((f) => !isFolder(f) && f.parents?.includes(d.id) && usable(f)).sort(byName);
  return {
    projects: projectDirs.map((d) => ({ name: d.name, files: inDir(d) })),
    site,
    people: peopleDir ? inDir(peopleDir) : [],
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

/** One line per file; changes whenever anything is added, removed, renamed or edited. */
export function fingerprintSource(m) {
  const line = (dir, f) => `${dir}/${f.name}|${f.id}|${f.md5Checksum || f.modifiedTime}`;
  return [
    ...m.projects.flatMap((p) => [`P:${p.name}`, ...p.files.map((f) => line(p.name, f))]),
    ...m.site.map((f) => line('site', f)), ...m.people.map((f) => line('people', f)),
  ].join('\n');
}
