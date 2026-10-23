"""Home Screen icons: a dark departures-board square with the trip drawn as a metro line."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
S = 1024
img = Image.new("RGB", (S, S), "#161b20")
d = ImageDraw.Draw(img)
font = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 300, index=2)  # SC
text = "行程"
bb = d.textbbox((0, 0), text, font=font)
d.text(((S - (bb[2] - bb[0])) / 2 - bb[0], 250 - bb[1]), text, font=font, fill="#f2f4f6")
# the line: Guangzhou -> Seoul -> Busan -> Tokyo -> Osaka -> Beijing
y = 720
x0, x1 = 150, S - 150
d.rounded_rectangle((x0, y - 22, x1, y + 22), radius=22, fill="#f2f4f6")
stops = ["#e2b35a", "#82a9ea", "#82a9ea", "#ff8f80", "#ff8f80", "#e2b35a"]
n = len(stops)
for k, col in enumerate(stops):
    cx = x0 + k * (x1 - x0) / (n - 1)
    r = 58
    d.ellipse((cx - r, y - r, cx + r, y + r), fill="#161b20", outline=col, width=26)
for size in (180, 192, 512):
    img.resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png", optimize=True)
print("icons written to", out)
