// Temporary: finds out which kind of Drive request an API key may make.
const KEY = process.env.GOOGLE_API_KEY, ROOT = process.env.DRIVE_FOLDER_ID, API = 'https://www.googleapis.com/drive/v3/files';
const P = '1zuLIwOogff6YN1U_ww3mHRIEnOk3lhLP', S = '1YeobuXJlGy7eWRvfM6CkhXr6esu8y1Af';
const tests = {
  'get root': `${API}/${ROOT}?${new URLSearchParams({ key: KEY, fields: 'id,name' })}`,
  'list root, minimal': `${API}?${new URLSearchParams({ key: KEY, q: `'${ROOT}' in parents`, fields: 'files(id,name)' })}`,
  'list root, trashed filter': `${API}?${new URLSearchParams({ key: KEY, q: `'${ROOT}' in parents and trashed = false`, fields: 'files(id,name,mimeType,size,md5Checksum,modifiedTime)' })}`,
  'list root, parents field': `${API}?${new URLSearchParams({ key: KEY, q: `'${ROOT}' in parents`, fields: 'files(id,name,parents)' })}`,
  'list two parents': `${API}?${new URLSearchParams({ key: KEY, q: `('${P}' in parents or '${S}' in parents)`, fields: 'files(id,name)', pageSize: '1000' })}`,
  'list two parents, parents field': `${API}?${new URLSearchParams({ key: KEY, q: `('${P}' in parents or '${S}' in parents)`, fields: 'files(id,name,parents)', pageSize: '1000' })}`,
};
console.log(`PROBE key length ${KEY?.length}, starts AIza: ${KEY?.startsWith('AIza')}, has spaces: ${/\s/.test(KEY || '')}`);
for (const [name, url] of Object.entries(tests)) {
  const r = await fetch(url); const j = await r.json().catch(() => ({}));
  console.log(`PROBE ${name}: ${r.status} ${j.error?.message || `ok, ${j.files ? j.files.length + ' files' : j.name}`}`);
}
