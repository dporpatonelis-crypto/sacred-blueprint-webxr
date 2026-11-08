export function mountPuzzle(container, activity, { image, title = 'Παλαιά Διαθήκη', kicker = 'Δοκιμή · ξεχωριστή πρόοδος', solvedMessage = 'Η εικόνα ολοκληρώθηκε · 4 / 4 έννοιες αποκαλύφθηκαν.', onReset = () => activity.restart(), onSolved = () => {}, explanations = [] } = {}) {
  container.innerHTML = `<section class="sliding-puzzle" aria-label="Puzzle εικόνας ${title}">
    <p class="puzzle-kicker">${kicker}</p><h2>${title} · Puzzle εικόνας</h2>
    <p class="puzzle-instructions">Σύρε ένα διπλανό πλακίδιο προς το κενό με ποντίκι ή δάχτυλο, ή πάτησέ το. Με εστίαση στον πίνακα, τα βέλη μετακινούν το κενό.</p>
    <div class="puzzle-grid" tabindex="0" role="group" aria-label="Πίνακας puzzle. Τα βέλη μετακινούν το κενό."><span class="puzzle-blank" aria-label="Κενή θέση"></span><img class="puzzle-reference" alt="Η ολοκληρωμένη εικόνα της Παλαιάς Διαθήκης" hidden></div>
    <div class="puzzle-actions"><button type="button" class="puzzle-preview" aria-pressed="false">Δες την εικόνα</button><button type="button" class="puzzle-restart">Νέο ανακάτεμα</button><output class="puzzle-moves" aria-label="Κινήσεις">Κινήσεις: 0</output></div>
    <p class="puzzle-status" role="status" aria-live="polite"></p><div class="puzzle-explanations" hidden></div></section>`;
  const root = container.firstElementChild, grid = root.querySelector('.puzzle-grid'), reference = root.querySelector('.puzzle-reference');
  const status = root.querySelector('.puzzle-status'), previewButton = root.querySelector('.puzzle-preview');
  const buttons = [], { rows, columns, size } = activity.puzzle;
  let preview = false, loaded = false, wasSolved = activity.puzzle.solved;
  let gesture = null, suppressClick = false;
  const place = (element, index) => {
    element.style.width = `${100 / columns}%`; element.style.height = `${100 / rows}%`;
    element.style.left = `${index % columns * 100 / columns}%`; element.style.top = `${Math.floor(index / columns) * 100 / rows}%`;
  };
  const moveGesture = event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    const along = dx * gesture.axisX + dy * gesture.axisY;
    // Keep forward progress even if the finger slips backwards before release.
    gesture.offset = Math.max(gesture.offset, Math.min(gesture.distance, along));
    gesture.button.style.transform = `translate3d(${gesture.axisX * gesture.offset}px, ${gesture.axisY * gesture.offset}px, 0)`;
  };
  const finishGesture = (event = null, cancelled = false) => {
    if (!gesture || event && event.pointerId !== gesture.pointerId) return;
    if (event && !cancelled) moveGesture(event);
    const current = gesture; gesture = null;
    // Preserve the actual dragged position as the start of the release animation.
    current.button.getBoundingClientRect();
    current.button.classList.remove('is-dragging'); current.button.style.transform = '';
    grid.classList.remove('is-dragging');
    suppressClick = true;
    if (current.button.hasPointerCapture(current.pointerId)) current.button.releasePointerCapture(current.pointerId);
    if (cancelled) return;
    // There is only one legal destination. Every normal release completes it,
    // regardless of drag distance, direction or the timing of the final event.
    activity.move(current.tile);
  };
  const cancelGesture = () => finishGesture(null, true);
  const beginGesture = (event, tile, button) => {
    if (gesture || event.button !== 0 || event.isPrimary === false) return;
    suppressClick = false;
    if (!loaded || preview || !activity.puzzle.canMove(tile)) return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    const puzzle = activity.puzzle, index = puzzle.tiles.indexOf(tile), blank = puzzle.blank;
    const axisX = blank % columns - index % columns;
    const axisY = Math.floor(blank / columns) - Math.floor(index / columns);
    const rect = button.getBoundingClientRect();
    gesture = { tile, button, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      axisX, axisY, distance: axisX ? rect.width : rect.height, offset: 0 };
    button.classList.add('is-dragging'); grid.classList.add('is-dragging');
    button.setPointerCapture(event.pointerId);
  };
  for (let id = 0; id < size; id++) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'puzzle-tile'; button.dataset.tile = String(id);
    button.draggable = false;
    button.setAttribute('aria-label', `Πλακίδιο ${id + 1}`);
    button.style.backgroundImage = `url("${image}")`; button.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
    button.style.backgroundPosition = `${id % columns * 100 / (columns - 1)}% ${Math.floor(id / columns) * 100 / (rows - 1)}%`;
    button.addEventListener('pointerdown', event => beginGesture(event, id, button));
    button.addEventListener('click', event => {
      if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
      if (loaded && !preview && !gesture) activity.move(id);
    });
    grid.insertBefore(button, reference); buttons.push(button);
  }
  const explanationsNode = root.querySelector('.puzzle-explanations');
  for (const item of explanations) {
    const article = document.createElement('article'), heading = document.createElement('h3'), text = document.createElement('p');
    heading.textContent = item.word; text.textContent = item.explanation; article.append(heading, text); explanationsNode.append(article);
  }
  const render = () => {
    cancelGesture();
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
    status.textContent = !loaded ? 'Ετοιμάζεται η εικόνα…' : puzzle.solved ? solvedMessage : preview ? 'Εικόνα αναφοράς · το puzzle συνεχίζεται όταν επιστρέψεις.' : 'Άφησε το πλακίδιο και η κίνηση ολοκληρώνεται προς το κενό.';
    if (!activity.canStore) status.textContent += ' Η πρόοδος διατηρείται όσο μένει ανοιχτή η σελίδα.';
    if (puzzle.solved && !wasSolved) onSolved(); wasSolved = puzzle.solved;
  };
  reference.addEventListener('load', () => { loaded = true; grid.style.aspectRatio = `${reference.naturalWidth} / ${reference.naturalHeight}`; render(); });
  reference.addEventListener('error', () => { loaded = false; render(); status.textContent = 'Δεν φορτώθηκε η εικόνα. Επαναφόρτωσε τη σελίδα για νέα προσπάθεια.'; });
  reference.src = image;
  reference.draggable = false;
  grid.addEventListener('pointermove', moveGesture);
  grid.addEventListener('pointerup', event => finishGesture(event));
  grid.addEventListener('pointercancel', event => finishGesture(event, true));
  grid.addEventListener('lostpointercapture', event => finishGesture(event, true));
  grid.addEventListener('dragstart', event => event.preventDefault());
  grid.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    cancelGesture(); suppressClick = false;
    event.preventDefault(); event.stopPropagation(); if (loaded && !preview) activity.puzzle.moveBlank(event.key);
  });
  root.addEventListener('keydown', () => { cancelGesture(); suppressClick = false; });
  root.addEventListener('pointerdown', event => event.stopPropagation());
  previewButton.addEventListener('click', () => { preview = !preview; render(); });
  root.querySelector('.puzzle-restart').addEventListener('click', () => { preview = false; onReset(); render(); grid.focus({ preventScroll: true }); });
  const onVisibility = () => { if (document.hidden) cancelGesture(); };
  const dialog = container.closest('dialog');
  window.addEventListener('blur', cancelGesture);
  window.addEventListener('pagehide', cancelGesture);
  window.addEventListener('resize', cancelGesture);
  document.addEventListener('visibilitychange', onVisibility);
  dialog?.addEventListener('close', cancelGesture);
  const unsubscribe = activity.subscribe(render); render();
  return { render, dispose() {
    cancelGesture(); unsubscribe();
    window.removeEventListener('blur', cancelGesture);
    window.removeEventListener('pagehide', cancelGesture);
    window.removeEventListener('resize', cancelGesture);
    document.removeEventListener('visibilitychange', onVisibility);
    dialog?.removeEventListener('close', cancelGesture);
  } };
}
