"""Serve the isolated design documents locally with deterministic module MIME types."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import argparse


class DesignHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.mjs': 'text/javascript', '.js': 'text/javascript',
                      '.css': 'text/css', '.html': 'text/html; charset=utf-8',
                      '.md': 'text/plain; charset=utf-8'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5176)
    args = parser.parse_args()
    handler = partial(DesignHandler, directory=str(Path(__file__).resolve().parents[2]))
    ThreadingHTTPServer(('127.0.0.1', args.port), handler).serve_forever()
