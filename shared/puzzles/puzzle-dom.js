export function mountPuzzle(container, activity, { image, title = 'Παλαιά Διαθήκη', onReset = () => activity.restart(), onSolved = () => {}, explanations = [] } = {}) {
  container.innerHTML = `<section class="sliding-puzzle" aria-label="Puzzle εικόνας ${title}">
    <p class="puzzle-kicker">Δοκιμή · ξεχωριστή πρόοδος</p><h2>${title} · Puzzle εικόνας</h2>
    <p class="puzzle-instructions">Πάτησε ένα πλακίδιο δίπλα στο κενό για να το μετακινήσεις. Με εστίαση στον πίνακα, τα βέλη μετακινούν το κενό.</p>
    <div class="puzzle-grid" tabindex="0" role="group" aria-label="Πίνακας puzzle. Τα βέλη μετακινούν το κενό."><span class="puzzle-blank" aria-label="Κενή θέση"></span><img class="puzzle-reference" alt="Η ολοκληρωμένη εικόνα της Παλαιάς Διαθήκης" hidden></div>
    <div class="puzzle-actions"><button type="button" class="puzzle-preview" aria-pressed="false">Δες την εικόνα</button><button type="button" class="puzzle-restart">Νέο ανακάτεμα</button><output class="puzzle-moves" aria-label="Κινήσεις">Κινήσεις: 0</output></div>
    <p class="puzzle-status" role="status" aria-live="polite"></p><div class="puzzle-explanations" hidden></div></section>`;
  const root = container.firstElementChild, grid = root.querySelector('.puzzle-grid'), reference = root.querySelector('.puzzle-reference');
  const status = root.querySelector('.puzzle-status'), previewButton = root.querySelector('.puzzle-preview');
  const buttons = [], { rows, columns, size } = activity.puzzle;
  let preview = false, loaded = false, wasSolved = activity.puzzle.solved;
  const place = (element, index) => {
    element.style.width = `${100 / columns}%`; element.style.height = `${100 / rows}%`;
    element.style.left = `${index % columns * 100 / columns}%`; element.style.top = `${Math.floor(index / columns) * 100 / rows}%`;
  };
  for (let id = 0; id < size; id++) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'puzzle-tile'; button.dataset.tile = String(id);
    button.setAttribute('aria-label', `Πλακίδιο ${id + 1}`);
    button.style.backgroundImage = `url("${image}")`; button.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
    button.style.backgroundPosition = `${id % columns * 100 / (columns - 1)}% ${Math.floor(id / columns) * 100 / (rows - 1)}%`;
    button.addEventListener('click', () => { if (loaded && !preview) activity.move(id); });
    grid.insertBefore(button, reference); buttons.push(button);
  }
  const explanationsNode = root.querySelector('.puzzle-explanations');
  for (const item of explanations) {
    const article = document.createElement('article'), heading = document.createElement('h3'), text = document.createElement('p');
    heading.textContent = item.word; text.textContent = item.explanation; article.append(heading, text); explanationsNode.append(article);
  }
  const render = () => {
    const puzzle = activity.puzzle;
    root.dataset.solved = String(puzzle.solved); grid.dataset.tiles = JSON.stringify(puzzle.tiles);
    grid.dataset.blank = String(puzzle.blank); root.querySelector('.puzzle-moves').textContent = `Κινήσεις: ${puzzle.moves}`;
    for (let id = 0; id < size; id++) {
      const button = buttons[id], final = id === size - 1, position = final ? size - 1 : puzzle.tiles.indexOf(id);
      button.hidden = final && !puzzle.solved; place(button, position);
      button.disabled = !loaded || preview || !puzzle.canMove(id);
      button.classList.toggle('is-movable', loaded && !preview && puzzle.canMove(id));
    }
    const blank = root.querySelector('.puzzle-blank'); place(blank, puzzle.blank); blank.hidden = puzzle.solved;
    reference.hidden = !preview; previewButton.setAttribute('aria-pressed', String(preview)); previewButton.textContent = preview ? 'Επιστροφή στο puzzle' : 'Δες την εικόνα';
    explanationsNode.hidden = !puzzle.solved;
    status.textContent = !loaded ? 'Ετοιμάζεται η εικόνα…' : puzzle.solved ? 'Η εικόνα ολοκληρώθηκε · 4 / 4 έννοιες αποκαλύφθηκαν.' : preview ? 'Εικόνα αναφοράς · το puzzle συνεχίζεται όταν επιστρέψεις.' : 'Σύνθεσε την εικόνα · μετακινούνται μόνο τα φωτισμένα πλακίδια.';
    if (!activity.canStore) status.textContent += ' Η πρόοδος διατηρείται όσο μένει ανοιχτή η σελίδα.';
    if (puzzle.solved && !wasSolved) onSolved(); wasSolved = puzzle.solved;
  };
  reference.addEventListener('load', () => { loaded = true; grid.style.aspectRatio = `${reference.naturalWidth} / ${reference.naturalHeight}`; render(); });
  reference.addEventListener('error', () => { loaded = false; render(); status.textContent = 'Δεν φορτώθηκε η εικόνα. Επαναφόρτωσε τη σελίδα για νέα προσπάθεια.'; });
  reference.src = image;
  grid.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); if (loaded && !preview) activity.puzzle.moveBlank(event.key);
  });
  root.addEventListener('pointerdown', event => event.stopPropagation());
  previewButton.addEventListener('click', () => { preview = !preview; render(); });
  root.querySelector('.puzzle-restart').addEventListener('click', () => { preview = false; onReset(); render(); grid.focus({ preventScroll: true }); });
  const unsubscribe = activity.subscribe(render); render();
  return { render, dispose: unsubscribe };
}
