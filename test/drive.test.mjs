import test from 'node:test';
import assert from 'node:assert/strict';
import { manifest, localName, fingerprintSource, download } from '../scripts/drive.mjs';
import { check } from '../worker/watcher.js';

const F = 'application/vnd.google-apps.folder';
const tree = {
  root: [{ id: 'P', name: 'Projects', mimeType: F }, { id: 'S', name: 'site', mimeType: F }, { id: 'x', name: 'notes.pdf', mimeType: 'application/pdf' }],
  P: [{ id: 'p1', name: 'EK Loft', mimeType: F }, { id: 'p2', name: 'Villa', mimeType: F }],
  S: [{ id: 's1', name: 'home.txt', mimeType: 'text/plain', md5Checksum: 'a' }, { id: 'pe', name: 'People', mimeType: F }],
  p1: [{ id: 'i2', name: '02.jpg', mimeType: 'image/jpeg', md5Checksum: 'b' }, { id: 'i1', name: '01.jpg', mimeType: 'image/jpeg', md5Checksum: 'c' },
       { id: 'd1', name: 'info', mimeType: 'application/vnd.google-apps.document', modifiedTime: 't1' }, { id: 'z', name: 'plan.dwg', mimeType: 'application/acad' }],
  p2: [],
  pe: [{ id: 'h1', name: '1 A.txt', mimeType: 'text/plain', md5Checksum: 'd' }],
};
function fakeFetch(calls = []) {
  return async (url, opt) => {
    calls.push(url);
    if (opt?.method === 'POST') return { ok: true, status: 200 };
    const u = new URL(url);
    if (u.pathname.endsWith('/export')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode('Title: X').buffer };
    const q = u.searchParams.get('q');
    if (!q) return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    const parents = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
    return { ok: true, json: async () => ({ files: parents.flatMap((p) => (tree[p] || []).map((f) => ({ ...f, parents: [p] }))) }) };
  };
}

test('manifest walks the folder in three requests and keeps only images and text', async () => {
  const calls = [];
  const m = await manifest(fakeFetch(calls), 'k', 'root');
  assert.equal(calls.length, 3);
  assert.deepEqual(m.projects.map((p) => p.name), ['EK Loft', 'Villa']);
  assert.deepEqual(m.projects[0].files.map((f) => f.name), ['01.jpg', '02.jpg', 'info']);
  assert.deepEqual(m.site.map((f) => f.name), ['home.txt']);
  assert.deepEqual(m.people.map((f) => f.name), ['1 A.txt']);
});
test('a Google Doc becomes a .txt file', async () => {
  assert.equal(localName({ name: 'info', mimeType: 'application/vnd.google-apps.document' }), 'info.txt');
  assert.equal(localName({ name: '01.jpg', mimeType: 'image/jpeg' }), '01.jpg');
  const b = await download(fakeFetch(), 'k', { id: 'd1', name: 'info', mimeType: 'application/vnd.google-apps.document' });
  assert.equal(b.toString(), 'Title: X');
});
test('fingerprint changes when a file changes', async () => {
  const m = await manifest(fakeFetch(), 'k', 'root');
  const a = fingerprintSource(m);
  m.projects[0].files[0].md5Checksum = 'changed';
  assert.notEqual(a, fingerprintSource(m));
});
test('watcher waits one round after a change, then rebuilds once', async () => {
  const kv = new Map();
  const env = { GOOGLE_API_KEY: 'k', DRIVE_FOLDER_ID: 'root', DEPLOY_HOOK: 'https://hook', STATE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) } };
  const f = fakeFetch();
  assert.match(await check(env, f), /waiting/);
  assert.equal(await check(env, f), 'rebuild requested');
  assert.equal(await check(env, f), 'unchanged');
});
