import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog, validateCatalog, renderCards } from '../scripts/catalog.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('published worlds have a project, preview and unique stable route', async () => {
  const lessons = await readCatalog(root);
  assert.ok(lessons.length >= 1);
  const cards = renderCards(lessons);
  for (const lesson of lessons) assert.ok(cards.includes('./lessons/' + lesson.id + '/'));
});

test('drafts are excluded; duplicate IDs and paths outside apps are rejected', () => {
  const base = { id:'first-world', directory:'apps/first-world', status:'published', title:'One', description:'One', topics:[], preview:'previews/one.png', connections:3 };
  assert.equal(validateCatalog({schemaVersion:1,lessons:[{...base,status:'draft'}]}).length,0);
  assert.throws(()=>validateCatalog({schemaVersion:1,lessons:[base,base]}));
  assert.throws(()=>validateCatalog({schemaVersion:1,lessons:[{...base,directory:'../outside'}]}));
});

test('catalog text is escaped before becoming HTML', () => {
  const html = renderCards([{id:'world',title:'<script>bad</script>',description:'"<>&',topics:['<img>'],preview:'previews/world.png',connections:3}]);
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&lt;img&gt;'));
});
