import { PuzzleActivity } from '../../shared/puzzles/puzzle-activity.js';
import { mountPuzzle } from '../../shared/puzzles/puzzle-dom.js';

let trialActive = new URLSearchParams(location.search).get('activity') === 'old-sliding-puzzle';
export function isTrial() { return trialActive; }

export function setup({ groups, image, beforeOpen, onToggle }) {
  let storage = null;
  try { storage = window.localStorage; } catch { /* File URLs can deny storage. */ }
  const activity = new PuzzleActivity({ key: 'theia-oikonomia.puzzle.old.classroom.v1', storage });
  const dialog = document.createElement('dialog'); dialog.className = 'classroom-puzzle-dialog'; dialog.setAttribute('aria-label', 'Παλαιά Διαθήκη · Puzzle εικόνας');
  dialog.innerHTML = '<div class="classroom-puzzle-toolbar"><button type="button" class="puzzle-exit">← Στο κανονικό μάθημα</button><a class="puzzle-download" download="theia-oikonomia-mindmap-puzzle.html">Λήψη HTML για την τάξη</a></div><div class="classroom-puzzle-mount"></div>';
  document.body.append(dialog);
  const download = dialog.querySelector('.puzzle-download');
  download.hidden = location.protocol === 'file:';
  download.href = new URL('../../downloads/theia-oikonomia-mindmap-puzzle.html', location.href).href;
  mountPuzzle(dialog.querySelector('.classroom-puzzle-mount'), activity, { image, explanations: groups.find(group => group.id === 'old').children });
  const open = () => { if (dialog.open) return; trialActive = true; beforeOpen(); document.body.classList.add('puzzle-dialog-open'); dialog.showModal(); onToggle(); dialog.querySelector('.puzzle-grid').focus({ preventScroll: true }); dialog.scrollTop = 0; };
  const close = () => { dialog.close(); };
  dialog.querySelector('.puzzle-exit').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    trialActive = false;
    document.body.classList.remove('puzzle-dialog-open');
    if (location.protocol !== 'file:') {
      const url = new URL(location.href); url.searchParams.delete('activity'); history.replaceState(null, '', url);
    }
    onToggle(); document.getElementById('puzzle-trial-button').focus();
  });
  document.getElementById('puzzle-trial-button').addEventListener('click', open);
  if (new URLSearchParams(location.search).get('activity') === 'old-sliding-puzzle') open();
}
