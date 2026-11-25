import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeBosporusIslet } from './islet.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.bosporusIslet.skybox,
  makeLandscape: makeBosporusIslet,
  walkable: { circles: [{ x: 0, z: 0, radius: 8.15 }], paths: [] },
  readingLanding: [0, -1.72],
  xrMenuPosition: [1.18, 1.17, -1.68],
  loadError: 'Η νησίδα δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
