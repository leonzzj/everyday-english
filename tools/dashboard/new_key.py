#!/usr/bin/env python3
"""Create a new key pair for the dashboard (site/dashboard/).

Writes
  tools/dashboard/public_key.pem   used by build.py to encrypt the data
  site/dashboard/key.enc.json      the private key, encrypted with the password;
                                   the page decrypts it in the browser

Usage:
  DASH_PASSWORD='...' python3 tools/dashboard/new_key.py
  (or run it without DASH_PASSWORD and type the password)

After a new key, run build.py again. Every device has to unlock once more.
Requires: pip install cryptography
"""
import base64
import getpass
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ITERATIONS = 300_000


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def main() -> None:
    password = os.environ.get("DASH_PASSWORD") or getpass.getpass("New dashboard password: ")
    if len(password) < 10:
        sys.exit("Use at least 10 characters.")
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    der = private_key.private_bytes(
        serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    salt, iv = os.urandom(16), os.urandom(12)
    kek = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(
        password.encode("utf-8")
    )
    sealed = AESGCM(kek).encrypt(iv, der, None)
    key_file = {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(sealed)}
    (ROOT / "site" / "dashboard" / "key.enc.json").write_text(json.dumps(key_file) + "\n", encoding="utf-8")
    (HERE / "public_key.pem").write_bytes(
        private_key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        )
    )
    print("Wrote site/dashboard/key.enc.json and tools/dashboard/public_key.pem. Now run build.py.")


if __name__ == "__main__":
    main()
