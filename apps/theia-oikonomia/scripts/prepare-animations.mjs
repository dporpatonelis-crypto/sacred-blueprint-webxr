import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runMedia } from '../../../shared/node/media-cli.mjs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const media = path.join(root, 'public/media');
const originals = path.join(root, 'media');
await fs.mkdir(path.join(originals, 'gifs'), { recursive: true });
const sources = JSON.parse(await fs.readFile(path.join(originals, 'sources.json'), 'utf8'));
let manifest;
try { manifest = JSON.parse(await fs.readFile(path.join(media, 'manifest.json'), 'utf8')); }
catch { manifest = { animations: {} }; }
manifest.version = 2;
manifest.paths = { atlas: 'relative to public/ and the published lesson URL', source: 'relative to the source project root', gif: 'relative to the source project root' };
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null;
const run = (command, args) => runMedia(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

for (const source of sources) {
  if (only && !only.has(source.id)) continue;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), `talanta-${source.id}-`));
  try {
    const input = path.join(originals, 'sheets', source.input);
    const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_frames', '-select_streams', 'v:0', '-of', 'json', input]));
    const stream = probe.streams[0];
    let count, durations;
    if (source.format === 'static') {
      count = 1; durations = [1000];
      const c = source.crop;
      const filter = c
        ? 'crop=' + Math.floor(stream.width / c.columns) + ':' + Math.floor(stream.height / c.rows) + ':' +
          (c.index % c.columns) * Math.floor(stream.width / c.columns) + ':' +
          Math.floor(c.index / c.columns) * Math.floor(stream.height / c.rows) + ',format=rgba'
        : 'format=rgba';
      ffmpeg(['-i', input, '-vf', filter, '-frames:v', '1', path.join(temp, 'frame-001.png')]);
    } else if (source.format === 'sheet') {
      count = source.columns * source.rows;
      const width = Math.floor(stream.width / source.columns);
      const height = Math.floor(stream.height / source.rows);
      for (let i = 0; i < count; i++) {
        ffmpeg(['-i', input, '-vf', `crop=${width}:${height}:${(i % source.columns) * width}:${Math.floor(i / source.columns) * height},format=rgba`, '-frames:v', '1', path.join(temp, `frame-${String(i + 1).padStart(3, '0')}.png`)]);
      }
      durations = Array(count).fill(source.frameDurationMs || 220);
    } else {
      count = probe.frames.length;
      durations = probe.frames.map((frame, i, frames) => {
        const seconds = Number(frame.duration_time || frame.pkt_duration_time || 0);
        const next = frames[i + 1];
        return Math.max(20, Math.round((seconds || (next ? Number(next.pts_time) - Number(frame.pts_time) : 0.2)) * 1000));
      });
      ffmpeg(['-i', input, '-fps_mode', 'passthrough', path.join(temp, 'frame-%03d.png')]);
    }
    if (count < 2 && source.format !== 'static') throw new Error(`${source.id}: the source is a still image, not an animation.`);
    // Limit runtime texture memory while retaining the actual generated frames.
    const first = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', path.join(temp, 'frame-001.png')])).streams[0];
    const scale = Math.min(1, 512 / Math.max(first.width, first.height));
    const frameWidth = Math.max(2, Math.floor(first.width * scale));
    const frameHeight = Math.max(2, Math.floor(first.height * scale));
    const columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / columns), margin = 2, spacing = 2;
    const atlasName = `${source.id}-atlas.png`, gifName = `${source.id}.gif`;
    ffmpeg(['-framerate', '1', '-i', path.join(temp, 'frame-%03d.png'), '-vf', `scale=${frameWidth}:${frameHeight}:flags=lanczos,format=rgba,tile=${columns}x${rows}:nb_frames=${count}:padding=${spacing}:margin=${margin}:color=0x00000000`, '-frames:v', '1', path.join(media, atlasName)]);
    // concat preserves the native GIF's individual frame timings.
    const concat = [];
    for (let i = 0; i < count; i++) {
      concat.push(`file '${path.join(temp, `frame-${String(i + 1).padStart(3, '0')}.png`)}'`);
      concat.push('option framerate 100');
      concat.push(`duration ${(durations[i] / 1000).toFixed(3)}`);
    }
    await fs.writeFile(path.join(temp, 'frames.txt'), concat.join('\n') + '\n');
    if (count > 1) ffmpeg(['-f', 'concat', '-safe', '0', '-i', path.join(temp, 'frames.txt'), '-filter_complex', `[0:v]scale=${frameWidth}:${frameHeight}:flags=lanczos,split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:alpha_threshold=128`, '-fps_mode', 'passthrough', '-loop', '0', '-final_delay', String(Math.round(durations.at(-1) / 10)), path.join(originals, 'gifs', gifName)]);
    manifest.animations[source.id] = {
      atlas: `media/${atlasName}`, gif: count > 1 ? `media/gifs/${gifName}` : null, source: `media/sheets/${source.input}`,
      frameCount: count, frameWidth, frameHeight, columns, rows, margin, spacing,
      width: columns * frameWidth + (columns - 1) * spacing + margin * 2,
      height: rows * frameHeight + (rows - 1) * spacing + margin * 2,
      durations, durationMs: durations.reduce((a, b) => a + b, 0),
      chromaKey: source.chromaKey || null, generatedAs: source.format === 'static' ? 'imagegen-cutout' : source.format === 'sheet' ? 'imagegen-keyframes' : 'native-gif',
    };
    console.log(`${source.id}: ${count} frames, ${manifest.animations[source.id].durationMs} ms → ${count > 1 ? 'GIF and atlas' : 'static atlas'}`);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
await fs.writeFile(path.join(media, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
