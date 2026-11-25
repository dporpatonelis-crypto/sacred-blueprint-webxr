import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeAlexandria } from './alexandria.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.alexandria.skybox,
  makeLandscape: makeAlexandria,
  readingLanding: [0, -1.72],
  xrMenuPosition: [1.18, 1.17, -1.68],
  loadError: 'Η Αλεξάνδρεια δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
