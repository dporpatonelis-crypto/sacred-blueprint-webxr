#!/usr/bin/env python3
"""Serve the self-contained production build on loopback; no npm required."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Permissions-Policy', 'xr-spatial-tracking=(self)')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5186)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Δεν βρέθηκε το έτοιμο build. Εκτελέστε πρώτα npm run build.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Η διαδρομή μας: {url}', flush=True)
    print('Κρατήστε αυτό το παράθυρο ανοιχτό. Ctrl+C για τερματισμό.', flush=True)
    if args.open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
