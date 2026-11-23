import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeGalilee } from './galilee.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.galilee.skybox,
  makeLandscape: makeGalilee,
  readingLanding: [0, -1.36],
  xrMenuPosition: [1.18, 1.17, -1.68],
  loadError: 'Η Γαλιλαία δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
