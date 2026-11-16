import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInfo, normalizeSize, slugify, orderImages, isYes, isImage } from '../scripts/parse.mjs';

test('fields then description', () => {
  const r = parseInfo('Title: EK Loft\r\nSize: Medium\r\n\r\nFirst para\nwrapped.\r\n\r\nSecond.');
  assert.deepEqual(r.fields, { title: 'EK Loft', size: 'Medium' });
  assert.deepEqual(r.paragraphs, ['First para wrapped.', 'Second.']);
});
test('empty and missing text', () => {
  assert.deepEqual(parseInfo(''), { fields: {}, paragraphs: [] });
  assert.deepEqual(parseInfo(undefined), { fields: {}, paragraphs: [] });
});
test('text with no fields is all description', () => {
  const r = parseInfo('A house on a hill. It has: windows.');
  assert.deepEqual(r.fields, {});
  assert.equal(r.paragraphs.length, 1);
});
test('byte order mark and odd key case', () => {
  assert.equal(parseInfo('﻿TITLE:  Hi ').fields.title, 'Hi');
});
test('sizes', () => {
  assert.equal(normalizeSize('X Large'), 'XL');
  assert.equal(normalizeSize(' small '), 'S');
  assert.equal(normalizeSize('huge'), '');
});
test('slug, yes, image names', () => {
  assert.equal(slugify('Villa for Ms. Pang'), 'villa-for-ms-pang');
  assert.equal(slugify('四幼'), 'project');
  assert.ok(isYes('Yes')); assert.ok(!isYes('no')); assert.ok(!isYes(''));
  assert.ok(isImage('a.JPG')); assert.ok(!isImage('info.txt')); assert.ok(!isImage('.hidden.jpg'));
});
test('image order: numeric, cover first', () => {
  assert.deepEqual(orderImages(['10.jpg', '2.jpg', 'cover.png', '1.jpg']), ['cover.png', '1.jpg', '2.jpg', '10.jpg']);
});
