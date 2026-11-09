import { ManuscriptConnections } from '../../../shared/journey/manuscript-connections.js';
import { lesson } from './session.js';
export function readingPages() {
  const readingPages=[];
  for(const source of Object.values(lesson.sources)) {
    let text='';for(const word of source.text.split(/\s+/u)){if(text && (text+' '+word).length>330){readingPages.push({title:source.title,text,attribution:source.url?'Πηγή: '+source.title:'Υλικό των αρχικών μαθημάτων',sourceUrl:source.url});text='';}text+=(text?' ':'')+word;}
    if(text)readingPages.push({title:source.title,text,attribution:source.url?'Πηγή: '+source.title:'Υλικό των αρχικών μαθημάτων',sourceUrl:source.url});
  }
  return readingPages;
}
export function manuscriptProfile(city) {
  const i=lesson.cities.indexOf(city);
  const labels={damascus:'Γαλ. 2:19–20',philippi:'Γαλ. 3:27–28',athens:'Σοφία και Σταυρός',ephesus:'Συμπαράσταση',rome:'Ένα σώμα, πολλά χαρίσματα'};
  const choices=[city,lesson.cities[(i+1)%5],lesson.cities[(i+2)%5]];
  const entries=[0,1,2].map(n=>choices[(n+3-i%3)%3]).map(c=>({stationId:c.id,text:c.teaching.text,keywords:c.teaching.keywords,interpretation:c.teaching.interpretation,sourceLabel:labels[c.id]}));
  return {worldId:city.id,title:city.title+' · Το νόημα',heading:'Η ΠΟΡΕΙΑ ΤΟΥ ΠΑΥΛΟΥ',instruction:'Διάλεξε χωρίο · σύνδεσε με την εικόνα',readLabel:'Κείμενα και πηγές',entryPosition:null,bookPositions:{[city.id]:[-2.25,1.6,-3.3]},labelHeights:[1.14,.74],entries,readingPages:readingPages()};
}
export function presentationSession(session,city,getSelected,getBusy) {
  return {get selected(){return getSelected();},reviewId:null,get busy(){return getBusy();},get localCount(){return Number(session.city(city.id).teaching);},get complete(){return session.complete;},sceneData:{id:city.id},get current(){return {id:city.id};},solved:id=>id===city.id && session.city(city.id).teaching};
}
export { ManuscriptConnections };
