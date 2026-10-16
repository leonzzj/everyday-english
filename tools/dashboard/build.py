#!/usr/bin/env python3
"""Encrypt a fresh copy of the dashboard data into site/dashboard/data.enc.json.

The data comes from the Claude dashboard's database. Export it first with the
ArtifactData tool (action "list" with out_dir) for the collections
board, items, legs, prep and fx, so that EXPORT_DIR holds
<collection>/<doc_id>.json files. Then:

  python3 tools/dashboard/build.py EXPORT_DIR

Only the public key is needed here; no password.
Requires: pip install cryptography
"""
import base64
import datetime
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
COLLECTIONS = ["board", "items", "legs", "prep", "fx"]


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def now_melbourne() -> str:
    try:
        from zoneinfo import ZoneInfo

        return datetime.datetime.now(ZoneInfo("Australia/Melbourne")).isoformat(timespec="seconds")
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    data = {}
    for name in COLLECTIONS:
        folder = src / name
        docs = {}
        if folder.is_dir():
            for path in sorted(folder.glob("*.json")):
                docs[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        data[name] = docs
    missing = [name for name in ("board", "items", "legs", "prep") if not data[name]]
    if missing:
        sys.exit("Export looks incomplete, nothing found for: " + ", ".join(missing))

    stamp = now_melbourne()
    payload = json.dumps({"at": stamp, "data": data}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    public_key = serialization.load_pem_public_key((HERE / "public_key.pem").read_bytes())
    content_key, iv = AESGCM.generate_key(bit_length=256), os.urandom(12)
    sealed = AESGCM(content_key).encrypt(iv, payload, None)
    wrapped = public_key.encrypt(
        content_key,
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
    )
    out = {"v": 1, "alg": "RSA-OAEP-256+A256GCM", "at": stamp, "wk": b64(wrapped), "iv": b64(iv), "ct": b64(sealed)}
    (ROOT / "site" / "dashboard" / "data.enc.json").write_text(json.dumps(out) + "\n", encoding="utf-8")
    counts = ", ".join(f"{name} {len(docs)}" for name, docs in data.items())
    print(f"Wrote site/dashboard/data.enc.json ({counts}) at {stamp}")


if __name__ == "__main__":
    main()
