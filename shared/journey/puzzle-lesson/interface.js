export const el = id => document.getElementById(id);
export const mediaUrl = path => import.meta.env.BASE_URL + path;
const menu = el('menu-dialog'), puzzle = el('puzzle-dialog');

function make(tag, content) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  return node;
}

function strongSentence(node, before, word, after) {
  node.replaceChildren(before, make('strong', word), after);
}

function strongKeyword(node, text, word) {
  const at = word ? text.indexOf(word) : -1;
  if (at < 0) node.textContent = text;
  else node.replaceChildren(text.slice(0, at), make('strong', word), text.slice(at + word.length));
}

function markPiece(button, tile, image, grid) {
  button.style.backgroundImage = 'url("' + image + '")';
  button.style.backgroundSize = grid.columns * 100 + '% ' + grid.rows * 100 + '%';
  button.style.backgroundPosition = (grid.columns > 1 ? tile % grid.columns / (grid.columns - 1) * 100 : 0) + '% ' +
    (grid.rows > 1 ? Math.floor(tile / grid.columns) / (grid.rows - 1) * 100 : 0) + '%';
}

function link(label, url) {
  const anchor = make('a', label);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

export class LessonInterface {
  constructor(session, api) {
    this.session = session;
    this.puzzleImage = mediaUrl(session.lesson.puzzle.image);
    if (session.lesson.puzzle.aspect) puzzle.style.setProperty('--puzzle-aspect', String(session.lesson.puzzle.aspect));
    this.api = api;
    this.grid = session.grid;
    this.dialogs = [menu, puzzle];
    this.aimButtons = new Map();
    this.choiceSignature = '';
    puzzle.style.setProperty('--puzzle-cols', String(this.grid.columns));
    puzzle.style.setProperty('--puzzle-rows', String(this.grid.rows));
    this.slots = session.tiles.map(tile => {
      const button = make('button', String(tile + 1));
      button.type = 'button';
      button.className = 'slot';
      button.setAttribute('aria-label', 'Υποδοχή ' + (tile + 1));
      button.addEventListener('click', () => api.place(tile));
      button.addEventListener('dragover', event => {
        if (button.disabled || api.selectedTile() === null) return;
        event.preventDefault();
        button.classList.add('target');
      });
      button.addEventListener('dragleave', () => button.classList.remove('target'));
      button.addEventListener('drop', event => {
        event.preventDefault();
        button.classList.remove('target');
        api.place(tile);
      });
      el('slots').append(button);
      return button;
    });
    this.tiles = session.tiles.map(tile => {
      const button = make('button');
      button.type = 'button';
      button.className = 'piece';
      button.draggable = true;
      button.setAttribute('aria-label', 'Κομμάτι ' + (tile + 1));
      markPiece(button, tile, this.puzzleImage, this.grid);
      button.addEventListener('click', () => api.select(tile));
      button.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', String(tile));
        event.dataTransfer.effectAllowed = 'move';
        api.select(tile, true);
      });
      return button;
    });
    this.trayOrder = [];
    for (const dialog of this.dialogs) {
      dialog.addEventListener('close', () => {
        if (dialog === menu) el('menu-content').replaceChildren();
        el('menu').setAttribute('aria-expanded', String(menu.open));
        api.dialogChanged();
      });
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    }
    el('menu').onclick = () => this.showMenu('main');
    el('puzzle-menu').onclick = () => this.showMenu('puzzle');
    el('open-puzzle').onclick = () => this.open(puzzle);
    el('enter-river').onclick = el('puzzle-enter').onclick = api.enter;
  }

  get modal() { return this.dialogs.some(dialog => dialog.open); }

  open(dialog) {
    this.close(dialog);
    if (!dialog.open) dialog.showModal();
    el('menu').setAttribute('aria-expanded', String(menu.open));
    this.api.dialogChanged();
  }

  close(except = null) {
    for (const dialog of this.dialogs) if (dialog !== except && dialog.open) dialog.close();
  }

  notify(text, kind) {
    el('notice').textContent = text;
    el('notice').dataset.kind = kind || '';
    if (this.session.level === 'gate') {
      el('puzzle-notice').textContent = text;
      el('puzzle-notice').dataset.kind = kind || '';
    }
  }

  syncControls(playing) {
    const useWater = playing && this.session.level === 'river' && !this.session.complete && !this.session.reviewId;
    el('touch-walk').hidden = !playing;
    el('fire-button').hidden = el('reticle').hidden = !useWater;
    el('fire-button').disabled = this.session.busy;
    document.body.classList.toggle('water-mode', useWater);
  }

  render({ selected, assisting }) {
    const session = this.session, lesson = session.lesson, gate = session.level === 'gate';
    this.syncChoices();
    el('gate').hidden = !gate;
    el('river').hidden = gate;
    if (gate) {
      const complete = session.gateComplete;
      el('tiles-count').textContent = session.placed.size + ' / ' + session.tileCount;
      el('enter-river').hidden = el('puzzle-enter').hidden = !complete;
      el('open-puzzle').hidden = complete;
      el('puzzle-copy').textContent = complete ? lesson.puzzle.caption :
        assisting ? 'Τα κομμάτια μπαίνουν ένα ένα στις θέσεις τους.' : 'Διάλεξε ένα κομμάτι και μετά μία θέση.';
      const { caption, emphasis } = lesson.puzzle;
      const start = emphasis ? caption.indexOf(emphasis) : -1;
      if (complete && start >= 0) {
        strongSentence(el('gate-copy'), caption.slice(0, start), emphasis, caption.slice(start + emphasis.length));
      } else {
        el('gate-copy').textContent = complete ? caption : 'Τοποθέτησε όλα τα κομμάτια στις υποδοχές.';
      }
      if (this.trayOrder !== session.tileOrder) {
        this.trayOrder = session.tileOrder;
        el('tray').replaceChildren(...this.trayOrder.map(tile => this.tiles[tile]));
      }
      for (const tile of session.tiles) {
        const placed = session.placed.has(tile);
        const slot = this.slots[tile], piece = this.tiles[tile];
        slot.classList.toggle('placed', placed);
        slot.disabled = placed || assisting;
        if (placed) markPiece(slot, tile, this.puzzleImage, this.grid);
        else slot.style.removeProperty('background-image');
        piece.classList.toggle('empty-piece', placed);
        piece.style.visibility = placed ? 'hidden' : '';
        piece.setAttribute('aria-pressed', String(selected === tile));
        piece.disabled = placed || assisting;
      }
      return;
    }

    const station = session.visibleStation;
    const phase = session.activePhase;
    const phaseIndex = phase.stations.findIndex(item => item.id === station?.id) + 1;
    const finalActivity = session.complete ? this.api.finalActivityStatus?.() : null;
    el('station-title').textContent = finalActivity ? 'Σύνθεση ύμνου · ' + finalActivity.title : session.complete ? 'Η διαδρομή ολοκληρώθηκε' :
      (session.reviewId ? 'Επανεξέταση · ' : '') + phase.title + ' · ' + phaseIndex + ' · ' + station.title;
    el('stations-count').textContent = finalActivity?.progress || (session.phaseCount + ' / ' + phase.stations.length);
    if (finalActivity) {
      el('sentence').textContent = finalActivity.instruction;
    } else if (station.question) {
      el('sentence').replaceChildren(
        make('span', station.question + ' '),
        make('strong', session.solved(station.id) ? station.word : '…')
      );
    } else {
      const word = session.solved(station.id) ? station.word : '_______';
      strongSentence(el('sentence'), station.before, word, station.after);
    }
    el('water-choices').hidden = session.complete || Boolean(session.reviewId);
    for (const [id, button] of this.aimButtons) {
      button.disabled = session.busy || session.solved(id);
    }
  }

  syncChoices() {
    const session = this.session;
    const signature = session.activePhase.id + ':' + session.choices.map(choice => choice.id).join(',');
    if (signature === this.choiceSignature) return;
    this.choiceSignature = signature;
    this.aimButtons.clear();
    const choices = el('choices');
    choices.replaceChildren();
    for (const choice of session.choices) {
      const button = make('button', choice.word);
      button.type = 'button';
      button.setAttribute('aria-label', 'Στόχευσε το δοχείο «' + choice.word + '»');
      button.onclick = () => this.api.aim(choice.id);
      choices.append(button);
      this.aimButtons.set(choice.id, button);
    }
  }

  showMenu(from = 'main') {
    const actions = el('menu-actions'), content = el('menu-content');
    actions.replaceChildren();
    content.replaceChildren();
    const button = (label, click) => {
      const item = make('button', label);
      item.type = 'button';
      item.onclick = click;
      actions.append(item);
    };
    if (this.session.level === 'gate') {
      el('open-puzzle').textContent = from === 'puzzle' ? 'Πίσω στο παζλ' : 'Άνοιγμα παζλ';
      button('Δες την εικόνα', () => this.showContent('picture'));
      button('Ανακάτεμα', () => {
        this.api.shuffle();
        if (from === 'puzzle') this.open(puzzle);
        else menu.close();
      });
      if (this.api.assisting()) button('Σταμάτησε τη λύση', () => { this.api.stopAssist(); menu.close(); });
      else if (!this.session.gateComplete) button('Αυτόματη λύση', () => {
        this.open(puzzle);
        this.api.assist();
      });
    } else {
      if (this.session.current && !this.session.reviewId && !this.session.complete) button('Υπόδειξη', () => this.showContent('hint'));
      for (const phase of this.session.lesson.phases) {
        const solved = phase.stations.filter(item => this.session.solved(item.id) && !this.session.busy);
        if (solved.length) {
          content.append(make('h3', phase.title));
          for (const station of solved) {
            button('Επανεξέταση · ' + station.title, () => {
              this.api.review(station.id);
              menu.close();
            });
          }
        }
      }
      if (this.session.reviewId) button('Συνέχεια στη διαδρομή', () => {
        this.api.resumeReview();
        menu.close();
      });
      if (this.session.complete && this.api.openFinalActivity) {
        const status = this.api.finalActivityStatus?.();
        button(status?.complete ? 'Δες τον ολοκληρωμένο ύμνο' : 'Συνέχεια στη σύνθεση του ύμνου', () => {
          menu.close();
          this.api.openFinalActivity();
        });
      }
    }
    button('Χειρισμός', () => this.showContent('controls'));
    button('Κείμενα και πηγές', () => this.showContent('reading'));
    if (this.session.lesson.video) button('Το αρχικό βίντεο', () => this.showContent('video'));
    button('Από την αρχή', () => this.showContent('reset'));
    this.open(menu);
  }

  showVideo() {
    this.showMenu();
    this.showContent('video');
  }

  showContent(section) {
    const content = el('menu-content'), lesson = this.session.lesson;
    content.replaceChildren();
    if (section === 'picture') {
      const image = make('img');
      image.src = this.puzzleImage;
      image.alt = lesson.puzzle.alt;
      content.append(image, make('p', lesson.puzzle.caption));
    } else if (section === 'hint') {
      content.append(make('p', this.session.visibleStation.hint));
    } else if (section === 'controls') {
      content.append(
        make('p', 'Σύρε στην εικόνα για να κοιτάξεις γύρω σου. Κινήσου με τον μοχλό αφής, τα βέλη ή τα πλήκτρα WASD.'),
        make('p', 'Στο παζλ, διάλεξε ένα κομμάτι και μετά μία υποδοχή. Στους σταθμούς, φέρε το στόχαστρο πάνω στο δοχείο και κράτησε πατημένο το «Νερό» ή το διάστημα.'),
        make('p', 'Στο VR, κινήσου με τον αριστερό μοχλό και στρίψε με τον δεξιό. Πιάσε τα κομμάτια με τη λαβή. Στόχευσε και κράτησε τη σκανδάλη για να ρίξεις νερό.')
      );
    } else if (section === 'reading') {
      if (lesson.historicalCaveat) content.append(make('p', lesson.historicalCaveat));
      for (const section of lesson.readingSections || []) {
        const article = make('article');
        article.append(make('h3', section.title));
        if (section.text) {
          const text = make('p', section.text);
          if (section.className) text.className = section.className;
          article.append(text);
        }
        if (section.note) article.append(make('p', section.note));
        for (const paragraph of section.paragraphs || []) article.append(make('p', paragraph));
        for (const item of section.items || []) {
          const block = make('p');
          if (item.title) block.append(make('strong', item.title + ': '));
          block.append(document.createTextNode(item.text || ''));
          article.append(block);
        }
        if (section.attribution) article.append(make('p', section.attribution));
        for (const source of section.sources || []) {
          const citation = make('p');
          citation.append(link(source.title, source.url));
          article.append(citation);
        }
        content.append(article);
      }
      const sourceText = lesson.readingSections?.length ? null : lesson.manuscript || lesson.hymn;
      if (sourceText) {
        const heading = make('h3', sourceText.title || 'Το κείμενο');
        const text = make('p', sourceText.text);
        text.className = 'hymn-text';
        content.append(heading, text, make('p', sourceText.attribution));
        if (sourceText.note) content.append(make('p', sourceText.note));
        if (sourceText.sourceUrl) {
          const citation = make('p');
          citation.append(link(sourceText.sourceLabel || 'Πηγή κειμένου', sourceText.sourceUrl));
          content.append(citation);
        }
      }
      for (const phase of lesson.phases) {
        content.append(make('h3', phase.title));
        for (const station of phase.stations) {
          const article = make('article');
          article.append(make('h3', station.title));
          if (lesson.manuscript || lesson.hymn) {
            const phrase = make('p');
            if (station.manuscriptText) strongKeyword(phrase, station.manuscriptText, station.word);
            else strongSentence(phrase, station.before, station.word, station.after);
            article.append(phrase);
            for (const text of [station.meaning, station.visualQuestion, station.explanation, station.hint]) {
              if (text) article.append(make('p', text));
            }
          } else if (station.question) {
            for (const text of [station.historicalContext, station.question, station.reading,
              station.explanation, station.hint, station.source]) {
              if (text) article.append(make('p', text));
            }
            for (const reference of station.references || []) {
              const citation = make('p');
              citation.append(link(reference.title, reference.url));
              article.append(citation);
            }
          } else {
            const passage = (label, text) => link(label, 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(text) + '&version=SBLGNT');
            article.append(make('p', station.reading), passage(station.source, station.passage));
            if (station.relatedSource) article.append(' · ', passage(station.relatedSource, station.relatedPassage));
          }
          content.append(article);
        }
      }
      const credits = make('p');
      for (const source of lesson.sources || []) {
        if (!source.url) continue;
        if (credits.childNodes.length) credits.append(' · ');
        credits.append(link(source.title, source.url));
      }
      if (lesson.credits) credits.append(link(lesson.creditsLabel || 'Εικόνες και πηγές', lesson.credits));
      if (lesson.originalLesson) {
        if (credits.childNodes.length) credits.append(document.createElement('br'));
        credits.append(link(lesson.originalLabel || 'Αρχική δραστηριότητα', lesson.originalLesson));
      }
      if (credits.childNodes.length) content.append(credits);
    } else if (section === 'video') {
      const video = make('video');
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.src = lesson.video;
      const fallback = make('p');
      fallback.append(link('Άνοιξε το αρχικό βίντεο σε νέα καρτέλα', lesson.video));
      content.append(video, fallback);
    } else if (section === 'reset') {
      const confirm = make('button', 'Μηδένισε την πρόοδο');
      confirm.type = 'button';
      confirm.onclick = () => { menu.close(); this.api.restart(); };
      content.append(make('p', lesson.puzzle.restartText), confirm);
    }
  }
}
