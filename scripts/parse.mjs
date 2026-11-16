// Reads the plain-text files the client writes. Forgiving by design:
// "Key: value" lines at the top, a blank line, then free text.
const KEY = /^([A-Za-z][A-Za-z ]{0,30}):\s*(.*)$/;

export function parseInfo(text = '') {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const fields = {};
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  for (; i < lines.length; i++) {
    const m = lines[i].match(KEY);
    if (!m) break;
    fields[m[1].trim().toLowerCase()] = m[2].trim();
  }
  const body = lines.slice(i).join('\n').trim();
  const paragraphs = body ? body.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean) : [];
  return { fields, paragraphs };
}

const SIZES = { s: 'S', small: 'S', m: 'M', medium: 'M', l: 'L', large: 'L', xl: 'XL', 'x large': 'XL', 'x-large': 'XL', 'extra large': 'XL' };
export const SIZE_NAMES = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' };
export function normalizeSize(v = '') { return SIZES[v.trim().toLowerCase()] || ''; }

export function isYes(v = '') { return /^(y|yes|true|1)$/i.test(v.trim()); }

export function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

const IMG = /\.(jpe?g|png|webp|avif|gif|tiff?)$/i;
export function isImage(name) { return IMG.test(name) && !name.startsWith('.'); }

// File-name order with numbers compared as numbers (2.jpg before 10.jpg); a file named "cover" goes first.
export function orderImages(names) {
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
  const c = sorted.findIndex((n) => /^cover\./i.test(n));
  if (c > 0) sorted.unshift(sorted.splice(c, 1)[0]);
  return sorted;
}
