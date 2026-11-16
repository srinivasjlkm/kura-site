/**
 * Kura website: Google Drive side.
 * Lives in the Google account that owns the "Kura Project Site" folder.
 *  1. Serves the folder's file list and files to the website build (doGet).
 *  2. Checks the folder every 5 minutes and asks the host to rebuild when something changed (checkForChanges).
 *
 * Script properties (Project Settings > Script properties):
 *   ROOT_ID      id of the "Kura Project Site" folder
 *   KEY          long random text; the website build sends the same value
 *   DEPLOY_HOOK  Cloudflare Pages deploy hook URL
 */
const P = PropertiesService.getScriptProperties();
const OK_TYPES = /^(image\/|text\/plain)/;

function listFolder_(folder) {
  const out = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (!OK_TYPES.test(f.getMimeType()) || f.getName().charAt(0) === '.') continue;
    out.push({ id: f.getId(), name: f.getName(), size: f.getSize(), modified: f.getLastUpdated().getTime() });
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1));
}
function child_(folder, name) {
  const it = folder.getFolders();
  while (it.hasNext()) { const f = it.next(); if (f.getName().toLowerCase() === name) return f; }
  return null;
}
function subfolders_(folder) {
  const out = [];
  if (!folder) return out;
  const it = folder.getFolders();
  while (it.hasNext()) out.push(it.next());
  return out.sort((a, b) => (a.getName() < b.getName() ? -1 : 1));
}

function manifest_() {
  const root = DriveApp.getFolderById(P.getProperty('ROOT_ID'));
  const site = child_(root, 'site');
  return {
    projects: subfolders_(child_(root, 'projects')).map((d) => ({ name: d.getName(), files: listFolder_(d) })),
    site: site ? listFolder_(site) : [],
    people: site && child_(site, 'people') ? listFolder_(child_(site, 'people')) : [],
  };
}

// Only files inside the website folder may be served.
function inside_(file, rootId) {
  let parents = file.getParents();
  for (let depth = 0; depth < 5 && parents.hasNext(); depth++) {
    const p = parents.next();
    if (p.getId() === rootId) return true;
    parents = p.getParents();
  }
  return false;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (!P.getProperty('KEY') || q.key !== P.getProperty('KEY')) return json_({ error: 'not allowed' });
  if (q.action === 'manifest') return json_(manifest_());
  if (q.action === 'file') {
    const f = DriveApp.getFileById(q.id);
    if (!inside_(f, P.getProperty('ROOT_ID'))) return json_({ error: 'not allowed' });
    return json_({ name: f.getName(), data: Utilities.base64Encode(f.getBlob().getBytes()) });
  }
  return json_({ error: 'unknown action' });
}

function fingerprint_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(manifest_()));
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/**
 * Runs every 5 minutes. Rebuilds only when the folder differs from the last build AND has stopped
 * changing since the previous check, so a rebuild never starts in the middle of an upload.
 */
function checkForChanges() {
  const now = fingerprint_();
  const seen = P.getProperty('LAST_SEEN');
  P.setProperty('LAST_SEEN', now);
  if (now === P.getProperty('LAST_BUILT') || now !== seen) return;
  const hook = P.getProperty('DEPLOY_HOOK');
  if (!hook) return;
  const r = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
  if (r.getResponseCode() < 300) P.setProperty('LAST_BUILT', now);
  else console.error('Deploy hook failed: ' + r.getResponseCode());
}

/** Run once by hand: creates the key and the 5-minute timer. */
function setup() {
  if (!P.getProperty('ROOT_ID')) P.setProperty('ROOT_ID', '1me4_HIVENtpHoSu7e5qNMN0ogYjhXD85');
  if (!P.getProperty('KEY')) P.setProperty('KEY', Utilities.getUuid() + Utilities.getUuid());
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkForChanges').timeBased().everyMinutes(5).create();
  console.log('Timer created. Key is stored in Script properties.');
}
