# Dashboard (site/dashboard/)

A standalone copy of Zijian's Claude dashboard, published with the rest of `site/` at
https://leonzzj.github.io/everyday-english/dashboard/. On an iPhone, open it in Safari and
add it to the Home Screen; it then opens full screen like an app and works offline.

## How it works

- The page is the Claude dashboard artifact's own HTML with a different data layer.
  The data is a snapshot of the artifact's database, encrypted, in
  `site/dashboard/data.enc.json`. Nothing readable about the user is in this repo.
- Encryption: the snapshot is sealed with AES-256-GCM, and that key is wrapped with an
  RSA-OAEP (SHA-256) public key (`tools/dashboard/public_key.pem`). The matching private key
  is in `site/dashboard/key.enc.json`, itself sealed with AES-GCM under a key derived from the
  user's password (PBKDF2-SHA256). The browser unlocks it once and keeps it in IndexedDB as a
  non-extractable key, so the password is only typed once per device.
- Ticks, status changes and new deadlines made on the page are stored in that browser only
  (`localStorage`, key `dash.local.v1`). An edit is dropped once a newer snapshot changes the
  same document. They do not go back to Claude.
- Exchange rates come straight from the ECB feed at api.frankfurter.dev; the snapshot's rates
  are the fallback.
- `sw.js` serves the last copy when there is no connection.

## Updating the data (for Claude sessions)

The source of truth is the Claude dashboard artifact
https://claude.ai/code/artifact/219d6762-8107-43e2-b0d4-baf3ffb2127d (owner only).
After changing its database:

1. Export each collection with the ArtifactData tool, `action: "list"`, `out_dir: <dir>`,
   for `board`, `items`, `legs`, `prep` and `fx`.
2. `python3 tools/dashboard/build.py <dir>` (needs `pip install cryptography`; no password).
3. Commit `site/dashboard/data.enc.json` and push to `main`. The Pages workflow deploys it.

To change the password: `python3 tools/dashboard/new_key.py`, then step 2 again, and push both
`site/dashboard/key.enc.json` and `tools/dashboard/public_key.pem`. Every device then unlocks once more.

The page itself is generated from the artifact's HTML. If the artifact's layout changes,
port the change into `site/dashboard/index.html` by hand; keep the data section at the end of
the script as it is.
