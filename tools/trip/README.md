# Trip itinerary (site/trip/)

Zijian's Korea–Japan itinerary (12–28 Nov 2026) as a phone page, published with the rest of
`site/` at https://leonzzj.github.io/everyday-english/trip/. On an iPhone, open it in Safari and
add it to the Home Screen; it then opens full screen like an app and works offline.

## How it works

- The page is built from `tools/trip/src/` by `src/build_page.py`. The itinerary itself is a
  JSON snapshot, encrypted, in `site/trip/data.enc.json`. Nothing readable about the trip is in
  this repo.
- Encryption is the dashboard's scheme (see `tools/dashboard/README.md`): AES-256-GCM, with the
  key wrapped by the dashboard's RSA public key (`tools/dashboard/public_key.pem`). The dashboard
  password unlocks it. `site/trip/key.enc.json` is a copy of `site/dashboard/key.enc.json`.
- The unlocked key is kept in the same IndexedDB store as the dashboard (`dashboard` / `keys` /
  `priv`), so the password is typed once per browser or Home Screen app.
- `sw.js` serves the last copy when there is no connection.

## Updating the itinerary (for Claude sessions)

The readable source is the private Claude artifact https://claude.ai/artifact/VDasKcgA4sdt8fWPeT93Wp
(owner only). Its page holds the data as JSON in `<script id="trip-data">`. The same JSON format
is produced from the PDF sources (`days.py`, `itinerary.html`, and `places.py` with the local-language
map names for each stop) by `src/extract.py`. Those sources are private and stay out of this repo.

1. Get the updated JSON (edit it, or regenerate it with `src/extract.py`) and keep it outside the repo.
2. Republish the artifact with the new JSON (`src/build_page.py artifact trip.json page.html`).
3. `python3 tools/trip/build.py trip.json` (needs `pip install cryptography pillow`; no password).
4. Commit `site/trip/` and push to `main`. The Pages workflow deploys it.

If the dashboard password changes (`tools/dashboard/new_key.py`), run step 3 again so the trip
page gets the new key file and is sealed with the new public key.
