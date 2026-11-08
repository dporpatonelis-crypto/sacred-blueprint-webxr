import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

export async function buildClassroom(root, output) {
  const directory = path.join(root, 'classroom/theia-oikonomia');
  const bundle = await build({ configFile: false, root, logLevel: 'warn', build: {
    write: false, minify: true, lib: { entry: path.join(directory, 'puzzle-entry.js'), name: 'SacredBlueprintClassroomPuzzle', formats: ['iife'] },
  } });
  const javascript = (Array.isArray(bundle) ? bundle : [bundle]).flatMap(result => result.output).find(chunk => chunk.type === 'chunk').code;
  const image = 'data:image/webp;base64,' + (await fs.readFile(path.join(root, 'apps/theia-oikonomia/public/media/focus-old.webp'))).toString('base64');
  const css = (await fs.readFile(path.join(root, 'shared/puzzles/puzzle.css'), 'utf8')) + '\n' + await fs.readFile(path.join(directory, 'puzzle.css'), 'utf8');
  let html = await fs.readFile(path.join(directory, 'source.html'), 'utf8');
  const toolbar = '<button id="puzzle-trial-button" class="tool-button" type="button">Puzzle εικόνας · Παλαιά Διαθήκη</button>\n        ';
  const anchor = '<button id="reset-button"';
  if (!html.includes(anchor) || !html.includes('})();') || !html.includes('function persist() {')) throw new Error('Classroom source structure changed; review the puzzle insertion points.');
  html = html.replace(anchor, toolbar + anchor);
  html = html.replace('function persist() {', 'function persist() {\n    if(SacredBlueprintClassroomPuzzle.isTrial())return;');
  // A callback preserves literal $& / $' sequences in minified JavaScript.
  html = html.replace('</head>', () => `<style>${css}</style><script>${javascript.replaceAll('</script', '<\\/script')}</script></head>`);
  const hook = `\nSacredBlueprintClassroomPuzzle.setup({groups:GROUPS,image:${JSON.stringify(image)},beforeOpen:()=>{cancelDrag();state.selected=null;renderWords();},onToggle:syncPaused});\n`;
  const closing = html.lastIndexOf('})();');
  html = html.slice(0, closing) + hook + html.slice(closing);
  await fs.mkdir(path.join(output, 'classroom/theia-oikonomia'), { recursive: true });
  await fs.mkdir(path.join(output, 'downloads'), { recursive: true });
  await fs.writeFile(path.join(output, 'classroom/theia-oikonomia/index.html'), html);
  await fs.writeFile(path.join(output, 'downloads/theia-oikonomia-mindmap-puzzle.html'), html);
  console.log('Classroom HTML with embedded puzzle → dist/classroom/theia-oikonomia/');
}
