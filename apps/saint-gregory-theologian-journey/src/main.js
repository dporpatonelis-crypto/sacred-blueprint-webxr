import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeConstantinople } from './constantinople.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.constantinople.skybox,
  makeLandscape: makeConstantinople,
  readingLanding: [0, -1.72],
  xrMenuPosition: [1.18, 1.17, -1.68],
  loadError: 'Η Κωνσταντινούπολη δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
