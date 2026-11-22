import lessonData from './data/source-lesson.json';
import worlds from './data/worlds.json';
import meaning from './data/meaning-regions.json';
import hymn from './data/hymn-regions.json';
import music from './data/audio.json';

export const lesson = lessonData;
export const phrases = lesson.phrases;
export const ids = phrases.map(phrase => phrase.id);
export const byId = Object.fromEntries(phrases.map(phrase => [phrase.id, phrase]));
export const tiles = Object.freeze([0, 1, 2, 3, 4, 5]);
export const ringNames = ['Εξωτερικός', 'Μεσαίος', 'Εσωτερικός'];
export const stages = {
  gate: { place: 'Προς τη Βηθλεέμ', name: 'Το παζλ της εισόδου', action: 'Άνοιξε το παζλ' },
  meaning: { place: 'Αναλόγιο', name: 'Ανακαλύπτω το νόημα', action: 'Άνοιξε τα χειρόγραφα' },
  hymn: { place: 'Αυλή του ύμνου', name: 'Συνθέτω τον ύμνο', action: 'Άνοιξε τους δακτυλίους' }
};
export const pictures = { meaning, hymn };
export const gatePicture = 'media/illustrations/bethlehem-gate.webp';
export const picturePath = key => 'media/illustrations/' + pictures[key].image.split('/').at(-1);
export const assetUrl = path => import.meta.env.BASE_URL + path;
export const originalLesson = 'https://dporpatonelis-crypto.github.io/digital-library-core/lessons/christos-gennatai.html';
export const excerpt = phrases.map(phrase => phrase.full).join('· ') + '·';
export const fullHymn = excerpt.slice(0, -1) + '. ᾌσατε τῷ Κυρίῳ πᾶσα ἡ γῆ· καὶ ἐν εὐφροσύνῃ, ἀνυμνήσατε λαοί, ὅτι δεδόξασται.';
export { worlds, music };
