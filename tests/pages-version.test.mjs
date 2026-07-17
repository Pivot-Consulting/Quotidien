import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la page publique annonce V7.1', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /Quotidien V7\.1/);
  assert.doesNotMatch(html, /Quotidien V6\.1/);
  assert.match(html, /main\.js\?v=7\.1\.1/);
});

test('le correctif de marque remplace le libellé historique', async () => {
  const branding = await readFile('src/version-brand.ts', 'utf8');
  assert.match(branding, /V7\.1/);
  assert.match(branding, /MutationObserver/);
});
