import { startPuzzleLesson } from '../../../shared/journey/puzzle-lesson/main.js';
import { makeLandscape } from './landscape.js';
import lesson from './data/source-lesson.json';
import worlds from './data/worlds.json';

startPuzzleLesson(lesson, {
  skybox: worlds.jordan.skybox,
  makeLandscape,
  loadError: 'Ο Ιορδάνης δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.'
});
