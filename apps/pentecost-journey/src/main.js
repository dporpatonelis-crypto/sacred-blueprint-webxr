import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeJerusalem } from './jerusalem.js';
import { HymnAssembly } from './hymn-assembly.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.jerusalem.skybox,
  makeLandscape: makeJerusalem,
  makeFinalActivity: options => new HymnAssembly(options),
  readingLanding: [0, -1.64],
  xrMenuPosition: [.95, .88, -1.55],
  loadError: 'Η Ιερουσαλήμ δεν φορτώθηκε. Δοκίμασε ξανά σε browser με WebGL.'
});
