from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, urlencode
from urllib.request import Request, urlopen
import json


class StudyDeckHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/jisho":
            self.handle_jisho(parsed)
            return
        super().do_GET()

    def handle_jisho(self, parsed):
        keyword = parse_qs(parsed.query).get("keyword", [""])[0].strip()
        if not keyword:
            self.write_json({"error": "missing keyword"}, 400)
            return

        url = "https://jisho.org/api/v1/search/words?" + urlencode({"keyword": keyword})
        try:
            request = Request(url, headers={"User-Agent": "StudyDeckPrototype/0.1"})
            with urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
            self.write_json(payload)
        except Exception as exc:
            self.write_json({"error": str(exc)}, 502)

    def write_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4173), StudyDeckHandler)
    print("Serving Study Deck on http://127.0.0.1:4173/")
    server.serve_forever()
