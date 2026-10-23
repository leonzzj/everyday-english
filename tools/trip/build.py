#!/usr/bin/env python3
"""Build the encrypted itinerary page at site/trip/.

  python3 tools/trip/build.py TRIP_JSON

TRIP_JSON is the plaintext itinerary (see tools/trip/README.md for where it comes from).
It is sealed with the dashboard's public key, so the dashboard password unlocks it, and
written to site/trip/data.enc.json. The page itself (index.html, sw.js, manifest, icons)
is rebuilt from tools/trip/src/, and the dashboard's key.enc.json is copied next to it.
Nothing readable about the trip is written to the repo.

Options for local testing: --public-key PEM --key-file key.enc.json --out DIR
Requires: pip install cryptography pillow
"""
import argparse
import base64
import datetime
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SRC = HERE / "src"


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def now_melbourne() -> str:
    try:
        from zoneinfo import ZoneInfo

        return datetime.datetime.now(ZoneInfo("Australia/Melbourne")).isoformat(timespec="seconds")
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("trip_json")
    ap.add_argument("--public-key", default=str(ROOT / "tools" / "dashboard" / "public_key.pem"))
    ap.add_argument("--key-file", default=str(ROOT / "site" / "dashboard" / "key.enc.json"))
    ap.add_argument("--out", default=str(ROOT / "site" / "trip"))
    a = ap.parse_args()

    trip = json.loads(Path(a.trip_json).read_text(encoding="utf-8"))
    if not trip.get("days"):
        sys.exit("No days in " + a.trip_json)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    stamp = now_melbourne()
    payload = json.dumps({"at": stamp, "data": trip}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    public_key = serialization.load_pem_public_key(Path(a.public_key).read_bytes())
    content_key, iv = AESGCM.generate_key(bit_length=256), os.urandom(12)
    sealed = AESGCM(content_key).encrypt(iv, payload, None)
    wrapped = public_key.encrypt(
        content_key,
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    enc = {"v": 1, "alg": "RSA-OAEP-256+A256GCM", "at": stamp, "wk": b64(wrapped), "iv": b64(iv), "ct": b64(sealed)}
    (out / "data.enc.json").write_text(json.dumps(enc) + "\n", encoding="utf-8")
    shutil.copyfile(a.key_file, out / "key.enc.json")

    subprocess.run([sys.executable, str(SRC / "build_page.py"), "pages", str(out)], check=True)
    for name in ("sw.js", "manifest.webmanifest"):
        shutil.copyfile(SRC / name, out / name)
    if not (out / "icon-512.png").exists():
        subprocess.run([sys.executable, str(SRC / "make_icons.py"), str(out)], check=True)
    print(f"Wrote {out}/data.enc.json ({len(trip['days'])} days) at {stamp}")


if __name__ == "__main__":
    main()
