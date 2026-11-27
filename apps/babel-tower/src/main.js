import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeShinar } from './shinar.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.shinar.skybox,
  makeLandscape: makeShinar,
  readingLanding: [0, -1.72],
  xrMenuPosition: [1.12, 1.1, -1.7],
  loadError: 'Η Σεναάρ δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
