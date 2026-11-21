import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
TEXT_FILE = ROOT / "saved_text.txt"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/text":
            text = TEXT_FILE.read_text(encoding="utf-8") if TEXT_FILE.exists() else ""
            self.send_json({"text": text})
            return

        if path in ("/", "/index.html"):
            self.serve_file(ROOT / "index.html")
            return

        if path in ("/text", "/text/", "/text/index.html"):
            self.serve_file(ROOT / "text" / "index.html")
            return

        if path in ("/send", "/send/", "/send/index.html"):
            self.serve_file(ROOT / "send" / "index.html")
            return

        requested = (ROOT / path.lstrip("/")).resolve()
        if requested.is_relative_to(ROOT) and requested.is_file():
            self.serve_file(requested)
            return

        self.send_error(404)

    def do_POST(self):
        if urlparse(self.path).path != "/api/text":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            text = str(data.get("text", "")).strip()

            if not text:
                self.send_error(400, "Text is required")
                return

            TEXT_FILE.write_text(text, encoding="utf-8")
            self.send_json({"success": True, "text": text})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_error(400, "Invalid JSON")

    def serve_file(self, file_path):
        content_type = "text/html"
        if file_path.suffix == ".css":
            content_type = "text/css"
        elif file_path.suffix == ".js":
            content_type = "application/javascript"

        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Server running at http://localhost:{port}")
    server.serve_forever()
