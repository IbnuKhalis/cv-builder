"""
Local development static HTTP server for Indonesian ATS CV Builder webapp.
Uses Python's standard library http.server with proper MIME types and no-cache headers.
"""

import http.server
import socketserver
import os
import sys

DEFAULT_PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class ATSCVRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Disable browser cache during local development and testing
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def guess_type(self, path):
        # Ensure proper modern MIME types
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html; charset=utf-8'
        elif path.endswith('.json'):
            return 'application/json'
        return super().guess_type(path)

def run_server(port=DEFAULT_PORT):
    socketserver.TCPServer.allow_reuse_address = True
    for p in [port, 3001, 8000, 8080]:
        try:
            with socketserver.TCPServer(("", p), ATSCVRequestHandler) as httpd:
                print(f"==================================================")
                print(f" ATS CV Builder Indonesia")
                print(f" Server berjalan di: http://localhost:{p}")
                print(f" Direktori Proyek   : {DIRECTORY}")
                print(f" Tekan Ctrl+C untuk menghentikan server")
                print(f"==================================================")
                sys.stdout.flush()
                httpd.serve_forever()
        except OSError as e:
            if "address already in use" in str(e).lower() or e.errno in (48, 98, 10048):
                print(f"Port {p} sedang digunakan, mencoba port berikutnya...")
                continue
            else:
                raise e

if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else DEFAULT_PORT
    try:
        run_server(port_arg)
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
