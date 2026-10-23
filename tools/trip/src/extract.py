"""Turn the itinerary sources (days.py + itinerary.html) into one JSON file for the web page.

Usage: python3 extract.py <itinerary2 dir> <out.json>
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

src = Path(sys.argv[1])
out = Path(sys.argv[2])

spec = importlib.util.spec_from_file_location("days", src / "days.py")
days_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(days_mod)

YEAR = 2026


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def inline(node):
    """Inner HTML of an overview cell -> plain text with [[ok|x]], [[todo|x]] and **x** markers."""
    parts = []
    for ch in node.children:
        if getattr(ch, "name", None) is None:
            parts.append(str(ch))
            continue
        cls = ch.get("class") or []
        txt = clean(ch.get_text())
        if ch.name == "span" and "tx" in cls:
            kind = "ok" if "ok" in cls else "todo"
            parts.append(f"[[{kind}|{txt}]]")
        elif ch.name in ("b", "strong") or (ch.name == "span" and "em" in cls):
            parts.append(f"**{txt}**")
        elif ch.name == "br":
            parts.append(" ")
        else:
            parts.append(inline(ch))
    return clean("".join(parts))


def bold_md(node):
    """Cell text keeping <b> as **x**."""
    parts = []
    for ch in node.children:
        if getattr(ch, "name", None) is None:
            parts.append(str(ch))
        elif ch.name in ("b", "strong"):
            parts.append(f"**{clean(ch.get_text())}**")
        elif ch.name == "br":
            parts.append(" ")
        else:
            parts.append(bold_md(ch))
    return clean("".join(parts))


# ---------------------------------------------------------------- overview (1-page itinerary)
ov = BeautifulSoup((src / "itinerary.html").read_text(encoding="utf-8"), "lxml")

route = []
for stop in ov.select(".route .stop"):
    cc = [c for c in stop.get("class") if c != "stop"][0]
    small = stop.find("small")
    nights = clean(small.get_text()) if small else ""
    if small:
        small.extract()
    route.append({"city": clean(stop.get_text()), "cc": cc, "nights": nights})

hotels, ov_days = [], {}
cur_hotel, left = None, 0
for tr in ov.select("table tbody tr"):
    dcell = tr.select_one("td.date")
    wd = dcell.select_one(".wd")
    md = clean(dcell.contents[0])
    cities = [{"name": clean(t.get_text()), "cc": [c for c in t.get("class") if c != "tag"][0]} for t in tr.select("td.city .tag")]
    plan = tr.select_one("td.plan")
    main = plan.select_one(".main")
    tip = plan.select_one(".tip")
    hcell = tr.select_one("td.hotel")
    if hcell is not None:
        span = int(hcell.get("rowspan", 1))
        cityn = hcell.select_one(".city-n")
        status = cityn.select_one(".b")
        status_txt = clean(status.get_text()) if status else ""
        if status:
            status.extract()
        head = clean(cityn.get_text())
        m = re.match(r"(\S+)\s*(\d+ 晚)?", head)
        name = hcell.select_one(".name")
        zh = hcell.select_one(".zh")
        addr_lines, access = [], []
        a = hcell.select_one(".addr")
        if a:
            for line in [clean(x) for x in a.decode_contents().split("<br/>")]:
                line = clean(BeautifulSoup(line, "lxml").get_text())
                if not line:
                    continue
                (access if re.search(r"(步行|走) ?\d+ ?分钟", line) else addr_lines).append(line)
        cur_hotel = {
            "id": f"h{len(hotels) + 1}",
            "city": m.group(1) if m else head,
            "nights": (m.group(2) or "") if m else "",
            "status": status_txt,
            "name": clean(name.get_text()) if name else "",
            "sub": clean(zh.get_text()) if zh else "",
            "addr": addr_lines,
            "access": access,
            "dates": [],
            "cc": cities[-1]["cc"] if cities else "",
        }
        hotels.append(cur_hotel)
        left = span
    mm, dd = (int(x) for x in md.split("/"))
    iso = f"{YEAR}-{mm:02d}-{dd:02d}"
    if left > 0 and cur_hotel is not None:
        cur_hotel["dates"].append(iso)
        left -= 1
    ov_days[md] = {
        "cities": cities,
        "main": inline(main) if main else "",
        "tip": inline(tip) if tip else "",
        "hotel": cur_hotel["id"] if cur_hotel is not None and iso in cur_hotel["dates"] else None,
    }

# map links per hotel
from urllib.parse import quote

for h in hotels:
    links, q_local = [], (h["addr"][0] if h["addr"] else "")
    if not h["name"]:
        h["maps"] = []
        h["copy"] = ""
        continue
    if h["cc"] == "kr":
        links.append({"label": "Naver 地图", "url": "https://map.naver.com/p/search/" + quote(q_local or h["name"])})
        links.append({"label": "Google 地图", "url": "https://www.google.com/maps/search/?api=1&query=" + quote(h["name"])})
    else:
        q = h["name"] if h["cc"] == "jp" else f"{h['city']} {h['name']}"
        links.append({"label": "Apple 地图", "url": "https://maps.apple.com/?q=" + quote(q)})
        links.append({"label": "Google 地图", "url": "https://www.google.com/maps/search/?api=1&query=" + quote(q)})
    h["maps"] = links
    h["copy"] = q_local or h["name"]

foot = []
for box in ov.select(".foot > div"):
    foot.append({"h": clean(box.find("h3").get_text()), "items": [clean(li.get_text()) for li in box.select("li")]})

# ---------------------------------------------------------------- days
FLAG = {True: "fix", "固定紧": "fixtight", "紧": "tight"}
days = []
for d in days_mod.DAYS:
    md = d["date"]
    mm, dd = (int(x) for x in md.split("/"))
    wd, _, hol = d["wd"].partition(" · ")
    rows = []
    for r in d["rows"]:
        flag = r[3] if len(r) > 3 else None
        rows.append({"t": r[0], "what": r[1], "how": r[2], "flag": FLAG.get(flag)})
    o = ov_days.get(md, {})
    days.append({
        "date": f"{YEAR}-{mm:02d}-{dd:02d}",
        "md": md,
        "wd": wd,
        "hol": hol,
        "cc": d["cc"],
        "title": d["title"],
        "meta": d["meta"],
        "warn": d.get("warn", ""),
        "rows": rows,
        "bring": d.get("bring", ""),
        "tips": d.get("tips", ""),
        "cities": o.get("cities", []),
        "main": o.get("main", ""),
        "tip": o.get("tip", ""),
        "hotel": o.get("hotel"),
    })

# ---------------------------------------------------------------- notes (INTRO boxes)
intro = BeautifulSoup(days_mod.INTRO, "lxml")
notes = []
for box in intro.select(".intro .box"):
    notes.append({"h": clean(box.find("h3").get_text()), "items": [bold_md(li) for li in box.select("li")]})

# ---------------------------------------------------------------- shopping
shop = BeautifulSoup(days_mod.SHOPPING, "lxml")
rules = [bold_md(li) for li in shop.select(".rules li")]
groups = []
for tr in shop.select("table.buy tbody tr"):
    if "grp" in (tr.get("class") or []):
        cc = [c for c in tr.get("class") if c != "grp"][0]
        groups.append({"name": clean(tr.get_text()), "cc": cc, "items": []})
        continue
    tds = tr.find_all("td")
    groups[-1]["items"].append({"what": bold_md(tds[0]), "where": bold_md(tds[1]), "note": bold_md(tds[2])})

# ---------------------------------------------------------------- analysis
an = BeautifulSoup(days_mod.ANALYSIS, "lxml")
tables = an.select("table.buy")
heads = [clean(h.get_text()) for h in an.select("h3.sec")]
analysis = []
for h, t in zip(heads, tables):
    cols = [clean(th.get_text()) for th in t.select("thead th")]
    rows = [[bold_md(td) for td in tr.find_all("td")] for tr in t.select("tbody tr")]
    analysis.append({"h": h, "cols": cols, "rows": rows})
note = an.select_one("p.note")

data = {
    "v": 1,
    "updated": re.search(r"更新于 (\d{4}-\d{2}-\d{2})", ov.get_text()).group(1),
    "title": "韩国 · 日本",
    "start": days[0]["date"],
    "end": days[-1]["date"],
    "route": route,
    "days": days,
    "hotels": hotels,
    "foot": foot,
    "notes": notes,
    "shopping": {"rules": rules, "groups": groups},
    "analysis": {"tables": analysis, "note": clean(note.get_text()) if note else ""},
}
out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("days", len(days), "hotels", [(h["city"], len(h["dates"])) for h in hotels], "notes", [n["h"] for n in notes],
      "shop groups", [(g["name"], len(g["items"])) for g in groups], "analysis", [(a["h"], len(a["rows"])) for a in analysis])
