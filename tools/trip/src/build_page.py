"""Assemble the itinerary page.

  python3 build_page.py artifact trip.json out.html   -> page with the data inline (private Claude artifact)
  python3 build_page.py pages out_dir                  -> index.html for the encrypted web copy (data comes from data.enc.json)
"""
import json
import sys
from pathlib import Path

H = Path(__file__).resolve().parent
css = (H / "style.css").read_text(encoding="utf-8")
body = (H / "body.html").read_text(encoding="utf-8")
app = (H / "app.js").read_text(encoding="utf-8")
lock_html = (H / "lock.html").read_text(encoding="utf-8")
lock_js = (H / "lock.js").read_text(encoding="utf-8")
FONT = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&display=swap">')


def artifact(data_path, out):
    data = json.loads(Path(data_path).read_text(encoding="utf-8"))
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = (f'<title>韩日行程</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{FONT}\n'
            f"<style>\n{css}\n</style>\n{body}\n"
            f'<script type="application/json" id="trip-data">{js}</script>\n<script>\n{app}\n</script>\n')
    Path(out).write_text(html, encoding="utf-8")
    print("wrote", out, len(html.encode()), "bytes")


def pages(out_dir):
    head = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>韩日行程</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#161b20">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="行程">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
{FONT}
<style>:root{{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}}body{{margin:0;font-size:14px}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<style>
{css}
</style>
</head>
<body>
"""
    html = head + body + lock_html + f"<script>\n{app}\n</script>\n<script>\n{lock_js}\n</script>\n</body>\n</html>\n"
    out = Path(out_dir) / "index.html"
    out.write_text(html, encoding="utf-8")
    print("wrote", out, len(html.encode()), "bytes")


if __name__ == "__main__":
    if sys.argv[1] == "artifact":
        artifact(sys.argv[2], sys.argv[3])
    else:
        pages(sys.argv[2])
