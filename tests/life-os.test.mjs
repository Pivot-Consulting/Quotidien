import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXPECTED_IDS = [
  'finances','projets-vie','apprentissage','documents','maison','nutrition','sante-avancee','relations','voyages','carriere',
  'decisions','journal','automatisations','assistant','vie-numerique','securite','impact','foyer','gamification','equilibre',
];

test('le catalogue V7 lance exactement les 20 thématiques', async () => {
  const catalog = await readFile('src/life-os/catalog.ts', 'utf8');
  for (const id of EXPECTED_IDS) assert.match(catalog, new RegExp(`id:'${id}'`), `thématique absente : ${id}`);
  assert.equal(new Set(EXPECTED_IDS).size, 20);
});

test('le point d’entrée charge le hub Life OS', async () => {
  const main = await readFile('src/main.ts', 'utf8');
  assert.match(main, /life-os\/hub\.js/);
});

test('la PWA précharge les modules Life OS', async () => {
  const worker = await readFile('public/sw.js', 'utf8');
  assert.match(worker, /v7\.0\.0-alpha\.1/);
  assert.match(worker, /life-os\/catalog\.js/);
  assert.match(worker, /life-os\/store\.js/);
  assert.match(worker, /life-os\/hub\.js/);
});

test('le manifeste expose le raccourci vers les 20 espaces', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'Quotidien Life OS');
  assert.ok(manifest.shortcuts.some(shortcut => shortcut.url === './?lifeos=1'));
});
