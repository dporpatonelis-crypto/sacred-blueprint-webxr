"""Preview the built collection without Node or external services."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=5190)
args = parser.parse_args()
directory = Path(__file__).resolve().parents[1] / 'dist'
if not (directory / 'index.html').is_file():
    raise SystemExit('Run npm run build first.')
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
print(f'Sacred Blueprint WebXR: http://127.0.0.1:{args.port}/', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
