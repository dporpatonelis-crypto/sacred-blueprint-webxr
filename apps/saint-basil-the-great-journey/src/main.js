import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeCaesarea } from './caesarea.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.caesarea.skybox,
  makeLandscape: makeCaesarea,
  readingLanding: [0, -1.72],
  xrMenuPosition: [1.18, 1.17, -1.68],
  loadError: 'Η Καισάρεια δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
