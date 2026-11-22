import { assetUrl, music } from './content.js';

// The same Web Audio buffer serves each clip, the ordered sequence, and the full hymn.
export class HymnAudio {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.status = 'idle';
    this.token = 0;
    this.ranges = [];
    this.index = 0;
    this.offset = 0;
  }

  async unlock() {
    if (!this.context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw new Error('Ο browser δεν διαθέτει Web Audio.');
      this.context = new Audio();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  async ready() {
    await this.unlock();
    if (!this.decode) {
      this.decode = fetch(assetUrl(music.file)).then(response => {
        if (!response.ok) throw new Error('Δεν φορτώθηκε ο ήχος.');
        return response.arrayBuffer();
      }).then(bytes => this.context.decodeAudioData(bytes)).catch(error => {
        this.decode = null;
        throw error;
      });
    }
    return this.decode;
  }

  update() {
    const range = this.ranges[this.index];
    const elapsed = this.status === 'playing' ? this.context.currentTime - this.started : 0;
    const progress = range ? Math.min((this.offset + elapsed) / (range[1] - range[0]), 1) : 0;
    this.onUpdate({
      status: this.status, label: this.label, range: this.index + 1, count: this.ranges.length,
      progress: this.status === 'ended' ? 1 : progress
    });
  }

  clearVoice() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    if (!this.voice) return;
    this.voice.onended = null;
    this.voice.stop();
    this.voice.disconnect();
    this.voice = null;
  }

  stop() {
    this.token++;
    this.clearVoice();
    this.status = 'idle';
    this.update();
  }

  async play(ranges, label) {
    this.stop();
    const token = this.token;
    this.label = label;
    this.index = 0;
    this.offset = 0;
    this.ranges = [];
    this.status = 'loading';
    this.update();
    try {
      const buffer = await this.ready();
      if (token !== this.token) return;
      this.buffer = buffer;
      this.ranges = ranges ? ranges.map(([start, end]) => [start, Math.min(end, buffer.duration)]) : [[0, buffer.duration]];
      if (this.ranges.some(([start, end]) => start < 0 || end <= start)) throw new Error('Μη έγκυρο απόσπασμα.');
      this.startVoice(token);
    } catch {
      if (token !== this.token) return;
      this.status = 'error';
      this.update();
    }
  }

  startVoice(token) {
    const [start, end] = this.ranges[this.index];
    if (end - start - this.offset < .01) {
      this.advance(token);
      return;
    }
    const voice = this.context.createBufferSource();
    this.voice = voice;
    voice.buffer = this.buffer;
    voice.connect(this.context.destination);
    this.started = this.context.currentTime;
    this.status = 'playing';
    voice.onended = () => {
      if (token !== this.token || this.voice !== voice) return;
      voice.disconnect();
      this.voice = null;
      this.advance(token);
    };
    voice.start(0, start + this.offset, end - start - this.offset);
    this.tick();
  }

  advance(token) {
    this.index++;
    this.offset = 0;
    if (this.index < this.ranges.length) this.startVoice(token);
    else {
      this.status = 'ended';
      this.update();
    }
  }

  tick() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.update();
    if (this.status === 'playing') this.frame = requestAnimationFrame(() => this.tick());
  }

  async togglePause() {
    if (this.status === 'playing') {
      this.offset += this.context.currentTime - this.started;
      this.clearVoice();
      this.status = 'paused';
      this.update();
    } else if (this.status === 'paused') {
      const token = this.token;
      try {
        await this.unlock();
        if (token === this.token && this.status === 'paused') this.startVoice(token);
      } catch {
        if (token === this.token) {
          this.status = 'error';
          this.update();
        }
      }
    }
  }
}
