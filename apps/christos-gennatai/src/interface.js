import { assetUrl, byId, excerpt, fullHymn, gatePicture, ids, lesson, music, originalLesson, picturePath, pictures, ringNames, stages, tiles } from './content.js';

export const $ = id => document.getElementById(id);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(label, action, value, className) {
  const node = element('button', label, className);
  node.type = 'button';
  node.dataset.action = action;
  if (value !== undefined) node.dataset.value = value;
  return node;
}

function link(text, href) {
  const node = element('a', text);
  node.href = href;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}

function showTile(node, tile, enabled, selected, label) {
  if (tile !== undefined) {
    node.style.setProperty('--tile-x', (tile % 3) * 50 + '%');
    node.style.setProperty('--tile-y', Math.floor(tile / 3) * 100 + '%');
  }
  node.classList.toggle('has-tile', tile !== undefined);
  node.disabled = !enabled;
  node.setAttribute('aria-label', label);
  if (node.dataset.action === 'tile') node.setAttribute('aria-pressed', String(selected));
}

function makePicture(stage) {
  const node = $(stage + '-picture');
  const src = assetUrl(picturePath(stage));
  const base = element('img', null, 'picture-base');
  base.alt = stage === 'meaning' ? 'Το ανοιχτό εικονογραφημένο χειρόγραφο' : 'Η εικόνα της Γέννησης με τη φάτνη, τους ποιμένες και την ομάδα που προσεύχεται';
  base.src = src;
  node.append(base);
  return pictures[stage].regions.map(region => {
    const image = element('img', null, 'picture-layer');
    image.src = src;
    image.alt = '';
    const [left, top, right, bottom] = region.bounds;
    image.style.clipPath = 'inset(' + top + '% ' + (100 - right) + '% ' + (100 - bottom) + '% ' + left + '%)';
    node.append(image);
    return image;
  });
}

function buildReader() {
  const texts = $('source-texts');
  for (const source of [
    { title: 'Ο λόγος', citation: lesson.sourceLabel, text: excerpt, url: lesson.sourceUrl },
    { title: 'Ο ειρμός', citation: lesson.hymnLabel, text: fullHymn, url: lesson.hymnUrl }
  ]) {
    const article = element('section', null, 'source-block');
    article.append(element('h3', source.title), element('blockquote', source.text), link(source.citation, source.url));
    texts.append(article);
  }
  const credits = element('details', null, 'source-block');
  credits.append(element('summary', 'Εικόνες, μουσική και προέλευση'), element('p', lesson.artNote),
    element('p', lesson.audioCredits), link('Παρτιτούρα αναφοράς', music.sourceUrl),
    element('p', lesson.licenseNote), link('Αρχικό διαδραστικό μάθημα', originalLesson));
  texts.append(credits);

  return ids.map(id => {
    const label = element('label', null, 'evidence-choice');
    label.append(element('span', byId[id].concept));
    const select = element('select');
    const empty = element('option', 'Διάλεξε απόσπασμα');
    empty.value = '';
    select.append(empty);
    for (const choice of ['uplift', 'birth', 'welcome']) {
      const option = element('option', byId[choice].full);
      option.value = choice;
      select.append(option);
    }
    label.append(select);
    $('evidence-choices').append(label);
    return select;
  });
}

function installDrag(send) {
  const dialog = $('activity');
  let drag, suppressClick;
  dialog.addEventListener('pointerdown', event => {
    const source = event.target.closest('.drag-source:not(:disabled)');
    if (!source || !event.isPrimary || event.button !== 0) return;
    drag = { source, id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  dialog.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 7) {
      const width = drag.source.getBoundingClientRect().width;
      drag.ghost = drag.source.cloneNode(true);
      drag.ghost.classList.add('drag-ghost');
      drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.tabIndex = -1;
      drag.ghost.style.width = width + 'px';
      dialog.append(drag.ghost);
      drag.source.setPointerCapture(event.pointerId);
    }
    if (!drag.ghost) return;
    drag.ghost.style.left = event.clientX + 'px';
    drag.ghost.style.top = event.clientY + 'px';
  });
  dialog.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const { source, ghost } = drag;
    drag = null;
    if (!ghost) return;
    ghost.remove();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-zone]');
    if (!target || target.dataset.dropZone !== source.dataset.action || target.disabled) return;
    send(source.dataset.action, source.dataset.value);
    send(target.dataset.action, target.dataset.value);
  });
  const clearDrag = () => { drag?.ghost?.remove(); drag = null; };
  dialog.addEventListener('pointercancel', clearDrag);
  dialog.addEventListener('close', clearDrag);
  dialog.addEventListener('lostpointercapture', clearDrag);
  dialog.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

export function installInterface(session, send) {
  const gateUrl = assetUrl(gatePicture);
  document.documentElement.style.setProperty('--gate-image', 'url("' + gateUrl + '")');
  $('gate-preview').querySelector('img').src = gateUrl;
  const board = tiles.map(slot => {
    const node = button(null, 'slot', slot, 'tile slot');
    node.dataset.dropZone = 'tile';
    $('gate-board').append(node);
    return node;
  });
  const tray = tiles.map(tile => {
    const node = button(null, 'tile', tile, 'tile drag-source');
    $('gate-tray').append(node);
    return node;
  });
  const layers = { meaning: makePicture('meaning'), hymn: makePicture('hymn') };
  const manuscripts = ['welcome', 'uplift', 'birth'].map(id => {
    const phrase = byId[id];
    const node = button(null, 'card', id, 'manuscript drag-source');
    node.append(element('strong', phrase.concept), element('small', phrase.short));
    $('manuscripts').append(node);
    return node;
  });
  const targets = ids.map(id => {
    const node = button(byId[id].target, 'target', id);
    node.dataset.dropZone = 'card';
    $('meaning-targets').append(node);
    return node;
  });
  const phraseButtons = ['uplift', 'birth', 'welcome'].map(id => {
    const wrap = element('div', null, 'phrase');
    const choose = button(byId[id].full, 'phrase', id, 'drag-source');
    const listen = button('♫', 'listen', id, 'clip');
    listen.setAttribute('aria-label', 'Άκου τη φράση «' + byId[id].full + '»');
    wrap.append(choose, listen);
    $('phrase-bank').append(wrap);
    return choose;
  });
  const positions = ids.map((id, index) => {
    const ring = button(String(index + 1), 'ring', id, 'ring ring-' + (index + 1));
    ring.dataset.dropZone = 'phrase';
    ring.setAttribute('aria-label', 'Θέση ' + (index + 1) + ' · ' + ringNames[index] + ' δακτύλιος');
    const dot = element('span', null, 'ring-dot');
    dot.setAttribute('aria-hidden', 'true');
    ring.append(dot);
    $('rings').append(ring);
    const row = button(null, 'ring', id, 'ring-row');
    row.dataset.dropZone = 'phrase';
    const title = element('small', (index + 1) + 'η θέση · ' + ringNames[index]);
    const choice = element('strong');
    row.append(title, choice);
    $('hymn-positions').append(row);
    return { ring, dot, row, choice };
  });
  const evidence = buildReader();
  $('final-interpretation').textContent = lesson.finalInterpretation;
  $('completed-hymn').textContent = fullHymn;
  $('reflection-label').textContent = lesson.finalQuestion;
  $('reflection').addEventListener('input', event => session.reflect(event.target.value));
  const collection = import.meta.env.VITE_COLLECTION_URL;
  if (collection) {
    $('collection-link').href = collection;
    $('collection-link').hidden = false;
  }
  document.addEventListener('click', event => {
    const node = event.target.closest('button[data-action]');
    if (!node || node.disabled) return;
    send(node.dataset.action, node.dataset.value, node);
  });
  $('activity').addEventListener('keydown', event => {
    const ring = event.target.closest('[data-action="ring"]');
    if (!ring || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    send('cycle-ring', { id: ring.dataset.value, direction: event.key === 'ArrowLeft' ? -1 : 1 });
  });
  installDrag(send);

  return {
    render(view) {
      const { stage, placed, meaning, hymn, choices } = session.state;
      const controls = stages[stage];
      const counts = { gate: placed.length + '/6', meaning: meaning.length + '/3', hymn: hymn.length + '/3' };
      $('stage-label').textContent = controls.place;
      $('stage-heading').textContent = controls.name;
      $('open-activity').textContent = controls.action;
      $('stage-progress').textContent = counts[stage];
      $('activity-label').textContent = controls.place;
      $('activity-title').textContent = controls.name;
      for (const key of Object.keys(stages)) $(key + '-activity').hidden = key !== stage;
      const next = $('next-stage');
      next.hidden = stage === 'hymn' || (stage === 'gate' ? !session.gateOpen : !session.hymnOpen);
      next.textContent = stage === 'gate' ? 'Στη Βηθλεέμ →' : 'Συνέχισε στον ύμνο →';
      next.dataset.action = 'travel';
      next.dataset.value = stage === 'gate' ? 'meaning' : 'hymn';
      $('menu-meaning').disabled = !session.gateOpen;
      $('menu-hymn').disabled = !session.hymnOpen;
      $('reset-hymn').disabled = !session.hymnOpen;
      $('save-note').hidden = session.canSave;
      $('tile-progress').textContent = counts.gate;
      $('gate-enter').disabled = !session.gateOpen;
      $('gate-preview').hidden = !view.reference;
      $('preview-button').textContent = view.reference ? 'Κλείσε την εικόνα' : 'Δες την εικόνα';
      $('preview-button').setAttribute('aria-pressed', String(view.reference));
      $('shuffle').disabled = session.gateOpen || view.assisting;
      $('auto').disabled = session.gateOpen;
      $('auto').textContent = view.assisting ? 'Διακοπή αυτόματης λύσης' : 'Αυτόματη λύση';
      board.forEach((node, slot) => {
        const locked = placed.includes(slot);
        showTile(node, locked ? slot : undefined, !locked && !view.assisting, false, 'Θέση ' + (slot + 1) + (locked ? ' · στη θέση του' : ' · άδεια'));
        node.classList.toggle('missed', !locked && view.missedSlot === slot);
      });
      tray.forEach((node, index) => {
        const tile = session.state.tray[index];
        const available = !placed.includes(tile);
        node.dataset.value = tile;
        showTile(node, available ? tile : undefined, available && !view.assisting, tile === view.tile, 'Κομμάτι ' + (index + 1) + (available ? '' : ' · τοποθετημένο'));
      });
      manuscripts.forEach(node => {
        const id = node.dataset.value;
        node.disabled = meaning.includes(id);
        node.setAttribute('aria-pressed', String(view.card === id));
      });
      targets.forEach((node, index) => {
        node.classList.toggle('solved', meaning.includes(ids[index]));
        node.setAttribute('aria-pressed', String(view.meaningTarget === ids[index]));
      });
      for (const [key, images] of Object.entries(layers)) images.forEach((image, index) => {
        image.classList.toggle('revealed', session.state[key].includes(ids[index]));
      });
      $('meaning-progress').textContent = counts.meaning;
      $('meaning-hint').disabled = session.hymnOpen;
      $('meaning-enter').disabled = !session.hymnOpen;
      $('hymn-progress').textContent = counts.hymn;
      $('hymn-hint').disabled = session.complete;
      $('check-hymn').disabled = session.complete;
      $('hymn-complete').hidden = !session.complete;
      phraseButtons.forEach(node => node.setAttribute('aria-pressed', String(view.phrase === node.dataset.value)));
      positions.forEach(({ring, dot, row, choice}, index) => {
        const id = ids[index];
        const locked = hymn.includes(id);
        choice.textContent = byId[choices[index]].full;
        dot.style.rotate = ids.indexOf(choices[index]) * 120 + 'deg';
        for (const node of [ring, row]) {
          node.setAttribute('aria-pressed', String(view.ring === id));
          node.classList.toggle('solved', locked);
        }
        ring.setAttribute('aria-label', 'Θέση ' + (index + 1) + ' · ' + ringNames[index] + ': ' + choice.textContent);
      });
      for (const node of document.querySelectorAll('[data-action="cycle"]')) node.disabled = session.complete || hymn.includes(view.ring);
      $('evidence').hidden = !session.hymnOpen;
      $('evidence-count').textContent = session.state.evidence.length + '/3';
      evidence.forEach((select, index) => {
        select.disabled = session.state.evidence.includes(ids[index]);
        if (select.disabled) select.value = ids[index];
      });
      const feedback = view.feedback;
      for (const id of ['world-status', 'learning-feedback']) {
        const node = $(id);
        if (node.textContent !== (feedback?.text || '')) node.textContent = feedback?.text || '';
        node.hidden = !feedback;
        node.dataset.tone = feedback?.tone || '';
      }
    },
    playStatus(info) {
      const strip = $('audio-strip');
      strip.hidden = info.status === 'idle';
      strip.dataset.status = info.status;
      if (strip.hidden) return;
      const title = info.label + (info.count > 1 ? ' · ' + Math.min(info.range, info.count) + '/' + info.count : '');
      if ($('audio-title').textContent !== title) $('audio-title').textContent = title;
      const status = { loading: 'Προετοιμασία ήχου…', playing: 'Παίζει', paused: 'Σε παύση', ended: 'Η ακρόαση ολοκληρώθηκε', error: 'Ο ήχος δεν ξεκίνησε. Δοκίμασε ξανά.' }[info.status];
      if ($('audio-state').textContent !== status) $('audio-state').textContent = status;
      $('audio-progress').value = info.progress;
      $('audio-pause').disabled = !['playing', 'paused'].includes(info.status);
      $('audio-pause').textContent = info.status === 'paused' ? 'Συνέχεια' : 'Παύση';
    },
    evidenceAnswers() { return ids.filter((id, index) => evidence[index].value === id); },
    syncReflection() { $('reflection').value = session.state.reflection; },
    clearEvidence() {
      evidence.forEach(select => { select.value = ''; });
      $('evidence-status').textContent = '';
      this.syncReflection();
    }
  };
}
