import talanta from './data/talanta-hymn.json' with { type: 'json' };
import loukas from './data/loukas-manuscript.json' with { type: 'json' };

const profiles = [
  { ...talanta, heading: 'ΥΜΝΟΣ ΤΗΣ ΜΕΓΑΛΗΣ ΤΡΙΤΗΣ', instruction: 'Επίλεξε στίχους · σύνδεσε με τον σταθμό', readLabel: 'Πλήρης ύμνος', choicesLabel: 'Χωρία ύμνου', readingTitle: 'Πλήρης ανάγνωση ύμνου' },
  loukas,
].map(profile => ({
  ...profile,
  readingPages: profile.readingPages.map(page => typeof page === 'string'
    ? { text: page, title: 'Ύμνος', attribution: profile.source.reference.title, sourceUrl: profile.source.reference.url }
    : page),
}));

export const manuscriptForWorld = worldId => profiles.find(profile => profile.worldId === worldId) || null;
export const manuscriptEntry = stationId => profiles.flatMap(profile => profile.entries).find(entry => entry.stationId === stationId);
