import { lesson } from './session.js';

export const $ = id => document.getElementById(id);

const colors = ['#c9a561', '#649c9a', '#a77eaf', '#7db98f', '#779ebc'];
const buddhistReading = 'https://www.dhammatalks.org/suttas/SN/SN22_59.html';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  if (tag === 'button') node.type = 'button';
  return node;
}

function externalLink(label, href) {
  const link = element('a', label + ' ↗');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

export function installInterface(session, actions) {
  const planetButtons = new Map();
  lesson.religions.forEach((religion, index) => {
    const button = element('button', null, 'planet-button');
    button.dataset.planet = religion.id;
    button.style.setProperty('--planet', colors[index]);
    const disc = element('span', null, 'disc');
    disc.setAttribute('aria-hidden', 'true');
    const label = element('span');
    const status = element('small');
    label.append(element('strong', religion.label), status);
    button.append(disc, label);
    button.addEventListener('click', () => actions.visit(religion.id));
    $('planets').append(button);
    planetButtons.set(religion.id, status);
    $('reader-religion').append(new Option(religion.label, religion.id));
  });

  const activePlanet = () => session.religion($('reader-religion').value);
  function renderReader() {
    const religion = activePlanet();
    const station = religion.scenes.find(scene => scene.id === $('reader-axis').value);
    const school = 'Σχολικό βιβλίο · § ' + religion.schoolSection + ', σ. ' + religion.schoolPages;
    const copy = [
      element('p', station.axis, 'overline'),
      element('h3', station.cardTitle),
      element('p', station.reading),
      element('p', station.interpretation),
      element('p', station.question, 'reflection'),
      externalLink(station.sourceLabel, station.sourceUrl),
      externalLink(school, lesson.schoolSource.url)
    ];
    if (religion.id === 'buddhism' && station.id === 'afterlife') {
      copy.push(externalLink('Συμπληρωματικά · SN 22.59', buddhistReading));
    }
    copy.push(element('p', lesson.note, 'muted'));
    $('reader-copy').replaceChildren(...copy);
  }

  function chooseReading(id) {
    const religion = activePlanet();
    $('reader-axis').replaceChildren(...religion.scenes.map(scene => new Option(scene.axis, scene.id)));
    if (religion.scenes.some(scene => scene.id === id)) $('reader-axis').value = id;
    renderReader();
  }

  $('reader-religion').addEventListener('change', () => chooseReading());
  $('reader-axis').addEventListener('change', renderReader);
  function fromMenu(action) {
    $('menu-dialog').close();
    action();
  }
  $('read').addEventListener('click', () => fromMenu(actions.read));
  $('overview').addEventListener('click', () => fromMenu(actions.overview));
  $('hub').addEventListener('click', () => fromMenu(actions.hub));
  $('menu').addEventListener('click', actions.menu);
  $('book-focus').addEventListener('click', () => fromMenu(actions.manuscript));
  $('continue').addEventListener('click', actions.proceed);
  $('motion').addEventListener('click', actions.motion);
  $('reset').addEventListener('click', actions.confirmReset);
  $('reset-current').addEventListener('click', () => actions.reset(session.state.selectedPlanet));
  $('reset-all').addEventListener('click', () => actions.reset('all'));
  $('retry').addEventListener('click', actions.retry);
  $('menu-dialog').addEventListener('close', () => {
    $('menu-hint').open = false;
    $('choices').open = false;
  });

  if (import.meta.env.VITE_COLLECTION_URL) {
    $('collection').href = import.meta.env.VITE_COLLECTION_URL;
    $('collection').hidden = false;
  }
  let answerSignature = '';
  let aimCopy = '';
  function answers(religion, track, aim) {
    const signature = religion.id + ':' + track.count + ':' + track.order.join(',');
    if (signature !== answerSignature) {
      answerSignature = signature;
      $('answers').replaceChildren(...track.order.map(id => {
        const station = religion.scenes.find(scene => scene.id === id);
        const button = element('button', station.cardTitle);
        button.dataset.answer = id;
        button.addEventListener('click', () => fromMenu(() => actions.aim(id)));
        button.disabled = session.solved(religion.id, id);
        return button;
      }));
    }
    for (const button of $('answers').children) button.setAttribute('aria-pressed', String(button.dataset.answer === aim));
  }

  function reviews(religion, track) {
    $('review-list').hidden = track.count === 0;
    $('review-list').replaceChildren(...religion.scenes.slice(0, track.count).map(station => {
      const button = element('button', 'Δες ξανά · ' + station.axis);
      button.addEventListener('click', () => fromMenu(() => actions.review(station.id)));
      return button;
    }));
  }

  return {
    reading(id, axis) {
      $('reader-religion').value = id;
      chooseReading(axis);
    },
    setAim(copy, targeted) {
      if (aimCopy !== copy) $('aim-label').textContent = aimCopy = copy;
      $('reticle').classList.toggle('hot', targeted);
    },
    render({ ready, religion, revealing, interpretation, aim, canFire, reduced, coarse, hasModal, xr, feedback, firing }) {
      const route = religion && session.route(religion.id);
      const current = religion && session.current(religion.id);
      const active = ready && Boolean(religion) && !revealing && !interpretation;
      $('hub').hidden = !religion;
      $('hub-controls').hidden = !ready || Boolean(religion);
      $('menu-station').hidden = !active;
      $('book-focus').hidden = !active || route.phase !== 'ready';
      $('interpretation').hidden = !ready || revealing || !interpretation;
      $('water-controls').hidden = !canFire || xr || !aim;
      $('reticle').hidden = !canFire || xr;
      $('touch-walk').hidden = !ready || !coarse || xr || hasModal || revealing || Boolean(interpretation);
      $('place').textContent = religion ? religion.label : 'Πέντε διαδρομές μελέτης';
      $('controls-help').textContent = coarse ? 'Πάτησε έναν πλανήτη. Σύρε για να κοιτάξεις γύρω.' : 'Πάτησε έναν πλανήτη για το παζλ του.';
      $('input-help').textContent = coarse
        ? 'Χρησιμοποίησε τον μοχλό για κίνηση και σύρε για να κοιτάξεις γύρω.'
        : 'Κινήσου με WASD ή βέλη. Σύρε για να κοιτάξεις και πάτησε ή κράτησε το ποντίκι για επιλογή και νερό.';
      $('save-note').textContent = session.canStore ? 'Η πρόοδος αποθηκεύεται σε αυτή τη συσκευή.' : 'Η πρόοδος διατηρείται όσο μένει ανοιχτή η σελίδα.';
      $('motion').setAttribute('aria-pressed', String(reduced));
      $('water').setAttribute('aria-pressed', String(firing));
      $('feedback').hidden = !feedback;
      $('feedback').textContent = feedback?.text || '';
      $('feedback').dataset.kind = feedback?.kind || '';

      for (const item of lesson.religions) {
        const track = session.route(item.id);
        planetButtons.get(item.id).textContent = track.unlocked ? track.count + ' / 5 σταθμοί' : 'Παζλ 3 × 2';
      }
      if (religion && route) {
        const finished = route.phase === 'complete';
        $('station-progress').textContent = finished ? '5 / 5 ΣΤΑΘΜΟΙ' : 'ΣΤΑΘΜΟΣ ' + (route.count + 1) + ' / 5';
        $('station-title').textContent = finished ? 'Η διαδρομή ολοκληρώθηκε' : current?.axis || '';
        $('statement').textContent = finished ? 'Επίλεξε μια φωτισμένη εικόνα για να ξαναδείς τη σύνδεση.' : current?.statement || '';
        $('reflection').textContent = current?.question || '';
        $('choices').hidden = finished;
        $('menu-hint').hidden = finished || !current;
        $('hint-copy').textContent = current?.hint || '';
        answers(religion, route, aim);
        reviews(religion, route);
      }
      if (interpretation) {
        const { station, review } = interpretation;
        $('interpretation-source').textContent = station.sourceLabel + ' · διδακτική παράφραση';
        $('interpretation-title').textContent = station.cardTitle;
        $('interpretation-copy').textContent = station.interpretation;
        $('interpretation-question').textContent = station.question;
        $('continue').textContent = review ? 'Επιστροφή στη διαδρομή' : 'Συνέχεια';
      }
    }
  };
}

export function lessonReadingPages(religion) {
  return religion.scenes.flatMap(station => {
    const pages = [];
    const copy = [station.reading, station.interpretation, station.question].join('\n\n');
    for (const paragraph of copy.split(/\n\s*\n/u)) {
      let text = '';
      for (const word of paragraph.split(/\s+/u)) {
        if (text && (text + ' ' + word).length > 285) {
          pages.push({ title: station.axis, text, attribution: station.sourceLabel, sourceUrl: station.sourceUrl });
          text = '';
        }
        text += (text ? ' ' : '') + word;
      }
      if (text) pages.push({ title: station.axis, text, attribution: station.sourceLabel, sourceUrl: station.sourceUrl });
    }
    return pages;
  });
}
