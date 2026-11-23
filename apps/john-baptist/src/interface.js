import { lesson, TILES } from './session.js';

export const el = id => document.getElementById(id);
export const mediaUrl = path => import.meta.env.BASE_URL + path;
const menu = el('menu-dialog'), puzzle = el('puzzle-dialog');
const baptismImage = mediaUrl(lesson.baptism.image);

function make(tag, content) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  return node;
}

function strongSentence(node, before, word, after) {
  node.replaceChildren(before, make('strong', word), after);
}

function markPiece(button, tile) {
  button.style.backgroundImage = 'url("' + baptismImage + '")';
  button.style.backgroundPosition = (tile % 3) * 50 + '% ' + Math.floor(tile / 3) * 100 + '%';
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
    this.api = api;
    this.dialogs = [menu, puzzle];
    this.choiceInputs = new Map();
    this.slots = TILES.map(tile => {
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
    this.tiles = TILES.map(tile => {
      const button = make('button');
      button.type = 'button';
      button.className = 'piece';
      button.draggable = true;
      button.setAttribute('aria-label', 'Κομμάτι ' + (tile + 1));
      markPiece(button, tile);
      button.addEventListener('click', () => api.select(tile));
      button.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', String(tile));
        event.dataTransfer.effectAllowed = 'move';
        api.select(tile, true);
      });
      return button;
    });
    this.trayOrder = [];
    for (const station of session.choices) {
      const label = make('label'), input = make('input');
      input.type = 'radio';
      input.name = 'word';
      input.value = station.id;
      input.addEventListener('change', () => api.aim(station.id));
      label.append(input, make('span', station.word));
      el('choices').append(label);
      this.choiceInputs.set(station.id, input);
    }
    for (const dialog of this.dialogs) {
      dialog.addEventListener('close', () => {
        if (dialog === menu) el('menu-content').replaceChildren();
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

  render({ selected, aimed, assisting }) {
    const session = this.session, gate = session.level === 'gate';
    el('gate').hidden = !gate;
    el('river').hidden = gate;
    el('area').textContent = gate ? 'Η Βάπτιση στον Ιορδάνη' : 'Οι σταθμοί της όχθης';
    if (gate) {
      const complete = session.gateComplete;
      el('tiles-count').textContent = session.placed.size + ' / 6';
      el('enter-river').hidden = el('puzzle-enter').hidden = !complete;
      el('open-puzzle').hidden = complete;
      el('puzzle-copy').textContent = complete ? lesson.baptism.caption :
        assisting ? 'Τα κομμάτια μπαίνουν ένα ένα στις θέσεις τους.' : 'Διάλεξε ένα κομμάτι και μετά μία θέση.';
      if (complete) strongSentence(el('gate-copy'), 'Στον Ιορδάνη, ο Ιησούς ', 'βαπτίζεται', ' από τον Ιωάννη.');
      else el('gate-copy').textContent = 'Τοποθέτησε τα έξι κομμάτια στις υποδοχές.';
      if (this.trayOrder !== session.tileOrder) {
        this.trayOrder = session.tileOrder;
        el('tray').replaceChildren(...this.trayOrder.map(tile => this.tiles[tile]));
      }
      for (const tile of TILES) {
        const placed = session.placed.has(tile);
        const slot = this.slots[tile], piece = this.tiles[tile];
        slot.classList.toggle('placed', placed);
        slot.disabled = placed || assisting;
        if (placed) markPiece(slot, tile);
        else slot.style.removeProperty('background-image');
        piece.classList.toggle('empty-piece', placed);
        piece.style.visibility = placed ? 'hidden' : '';
        piece.setAttribute('aria-pressed', String(selected === tile));
        piece.disabled = placed || assisting;
      }
      return;
    }

    const station = session.visibleStation;
    el('station-title').textContent = session.complete ? 'Η διαδρομή ολοκληρώθηκε' :
      (lesson.stations.indexOf(station) + 1) + ' · ' + station.title;
    el('stations-count').textContent = session.count + ' / 4';
    const word = session.solved(station.id) ? station.word : '_______';
    strongSentence(el('sentence'), station.before, word, station.after);
    el('sentence').setAttribute('aria-live', 'polite');
    el('water-choices').hidden = el('water-controls').hidden = session.complete;
    for (const [id, input] of this.choiceInputs) {
      input.checked = id === aimed;
      input.disabled = session.busy || session.solved(id);
    }
    el('pour').disabled = !aimed || session.busy || session.solved(aimed);
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
    } else if (this.session.current) button('Υπόδειξη', () => this.showContent('hint'));
    button('Κείμενα και πηγές', () => this.showContent('reading'));
    button('Το αρχικό βίντεο', () => this.showContent('video'));
    button('Από την αρχή', () => this.showContent('reset'));
    if (from === 'puzzle') button('Πίσω στο παζλ', () => this.open(puzzle));
    this.open(menu);
  }

  showVideo() {
    this.showMenu();
    this.showContent('video');
  }

  showContent(section) {
    const content = el('menu-content');
    content.replaceChildren();
    if (section === 'picture') {
      const image = make('img');
      image.src = baptismImage;
      image.alt = lesson.baptism.alt;
      content.append(image, make('p', lesson.baptism.caption));
    } else if (section === 'hint') {
      content.append(make('p', this.session.visibleStation.hint));
    } else if (section === 'reading') {
      for (const station of lesson.stations) {
        const article = make('article');
        const passage = (label, text) => link(label, 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(text) + '&version=SBLGNT');
        article.append(make('h3', station.title), make('p', station.reading), passage(station.source, station.passage));
        if (station.relatedSource) article.append(' · ', passage(station.relatedSource, station.relatedPassage));
        content.append(article);
      }
      const credits = make('p');
      credits.append(link('Εικόνες και πηγές του αρχικού βίντεο', lesson.credits));
      content.append(credits);
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
      content.append(make('p', 'Θα ξεκινήσεις ξανά από τα έξι κομμάτια της Βάπτισης.'), confirm);
    }
  }
}
