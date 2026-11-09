"""Export the approved ImageGen sheets as runtime atlases and preview GIFs.

Run from any directory with Python 3 and FFmpeg installed. No AI generation or
retouching is performed here: only grid cropping, palette encoding and copying.
"""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile

APP = Path(__file__).resolve().parents[1]
MANIFEST = APP / 'public/media/manifest.json'

def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *map(str, args)], check=True)

for name, animation in json.loads(MANIFEST.read_text())['animations'].items():
    source = APP / animation['source']
    target = APP / 'public' / animation['atlas']
    shutil.copyfile(source, target)
    gif = APP / animation['gif']
    gif.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='paul-sprites-') as temp:
        frames = Path(temp)
        w, h, cols = animation['frameWidth'], animation['frameHeight'], animation['columns']
        for i in range(animation['frameCount']):
            ffmpeg('-i', source, '-vf', f'crop={w}:{h}:{(i % cols)*w}:{(i // cols)*h}', '-frames:v', '1', frames / f'frame-{i}.png')
        # The approved sheets all use 280 ms per frame: eight frames / 2.24 s.
        ffmpeg('-framerate', '25/7', '-i', frames / 'frame-%d.png', '-filter_complex', '[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=alpha_threshold=128', '-loop', '0', gif)
    print(f'{name}: {animation["frameCount"]} frames, {sum(animation["durations"])} ms → {gif.name}')
