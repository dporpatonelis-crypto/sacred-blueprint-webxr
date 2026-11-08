import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readCatalog, renderCards } from './catalog.mjs';
import { validateWorldMedia } from './media-catalog.mjs';
import { buildClassroom } from './build-classroom.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessons = await readCatalog(root), output = path.join(root, 'dist');
await fs.rm(output, { recursive: true, force: true });
await fs.cp(path.join(root, 'site'), output, { recursive: true });
const template = await fs.readFile(path.join(root, 'site/index.html'), 'utf8');
await fs.writeFile(path.join(output, 'index.html'), template.replace('{{WORLD_COUNT}}', String(lessons.length).padStart(2, '0')).replace('{{WORLD_CARDS}}', renderCards(lessons)));
await fs.writeFile(path.join(output, 'lessons.json'), JSON.stringify({ schemaVersion: 1, lessons: lessons.map(({directory, ...lesson}) => ({...lesson, href: './lessons/' + lesson.id + '/'})) }, null, 2) + '\n');
await fs.writeFile(path.join(output, '.nojekyll'), '');
for (const lesson of lessons) {
  await validateWorldMedia(path.join(root,lesson.directory));
  const result = spawnSync('npm', ['run', 'build', '--workspace=' + lesson.directory, '--', '--outDir', path.join(output, 'lessons', lesson.id), '--emptyOutDir'], { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_COLLECTION_URL: '../../' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Build failed for ' + lesson.id);
  await fs.access(path.join(output, 'lessons', lesson.id, 'index.html'));
}
await buildClassroom(root, output);
console.log(`Published build: ${lessons.length} world(s) → dist/`);
