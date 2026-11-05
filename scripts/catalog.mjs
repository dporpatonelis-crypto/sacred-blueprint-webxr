import fs from 'node:fs/promises';
import path from 'node:path';

export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.lessons)) throw Error('Invalid lessons.json schema.');
  const ids = new Set();
  for (const lesson of catalog.lessons) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.id) || ids.has(lesson.id)) throw Error('Duplicate or invalid lesson ID: ' + lesson.id);
    ids.add(lesson.id);
    if (lesson.directory !== 'apps/' + lesson.id) throw Error('Lesson directory must be apps/<id>: ' + lesson.id);
    if (!['published', 'draft'].includes(lesson.status) || typeof lesson.title !== 'string' || !lesson.title.trim() || typeof lesson.description !== 'string') throw Error('Incomplete lesson: ' + lesson.id);
    if (!/^previews\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(lesson.preview)) throw Error('Invalid preview: ' + lesson.id);
    if (!Array.isArray(lesson.topics) || !lesson.topics.every(t => typeof t === 'string')) throw Error('Invalid topics: ' + lesson.id);
    if (!Number.isInteger(lesson.connections) || lesson.connections < 1) throw Error('Invalid connection count: ' + lesson.id);
  }
  return catalog.lessons.filter(lesson => lesson.status === 'published');
}

export async function readCatalog(root) {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'lessons.json'), 'utf8'));
  const lessons = validateCatalog(catalog);
  for (const lesson of lessons) {
    await fs.access(path.join(root, lesson.directory, 'package.json'));
    await fs.access(path.join(root, 'site', lesson.preview));
  }
  return lessons;
}

const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function renderCards(lessons) {
  return lessons.map((lesson, index) => `<article class="world-card">
    <a class="world-art" href="./lessons/${lesson.id}/" aria-label="Άνοιγμα: ${escape(lesson.title)}">
      <img src="./${lesson.preview}" alt="Εικονογραφημένος τρισδιάστατος κόσμος: ${escape(lesson.title)}" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} width="1440" height="900">
      <span class="world-badge">WebXR · ${lesson.connections} συνδέσεις</span>
    </a>
    <div class="world-copy"><p class="eyebrow">Κόσμος ${String(index + 1).padStart(2, '0')}</p>
      <h3>${escape(lesson.title)}</h3><p>${escape(lesson.description)}</p>
      <ul class="topics">${lesson.topics.map(t => '<li>' + escape(t) + '</li>').join('')}</ul>
      <a class="enter" href="./lessons/${lesson.id}/">Μπες στον κόσμο <span aria-hidden="true">↗</span></a>
    </div></article>`).join('\n');
}
