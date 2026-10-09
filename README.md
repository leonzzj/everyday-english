# Everyday English

A personal English practice site: graded daily news (C1 and B2 versions with key expressions and a short quiz), natural spoken English, podcast listening with dictation and shadowing, tap-to-look-up reading, and a word book.

Static site in `site/`, deployed by Netlify from the `main` branch (no build step).

## How content updates

| What | Where it lives | Who updates it |
|---|---|---|
| Daily news issue | `site/data/issues/YYYY-MM-DD.json` + `site/data/index.json` | A scheduled Claude task commits a new issue each morning (Melbourne time) |
| Podcast and article feed | `site/data/feed.json` | GitHub Actions (`.github/workflows/feeds.yml`) runs `scripts/fetch-feeds.mjs` twice a day |
| Speaking content, curated sources | `site/assets/js/content.js` | Edit by hand |

The word book, quiz answers and preferences are stored in the browser (localStorage). Use **备份 / 导入备份** on the word book page to move them between devices.

## Issue format

```jsonc
{
  "date": "2026-10-10", "issueNo": 1, "title": "…", "createdAt": "2026-10-10T06:55:00+11:00",
  "stories": [{
    "id": "kebab-slug", "category": "World", "headline": "…", "headlineZh": "…", "summaryZh": "…",
    "c1": "4 paragraphs separated by \n\n", "b2": "…",
    "vocab": [{ "word": "broaden the scope", "pos": "phr.", "ipa": "", "zh": "…", "en": "…", "example": "…", "forms": ["broadened the scope"] }],
    "questions": [
      { "type": "tfng", "q": "…", "options": ["True", "False", "Not Given"], "answer": 1, "explain": "…" },
      { "type": "mcq", "q": "…", "options": ["…", "…", "…", "…"], "answer": 2, "explain": "…" }
    ],
    "discuss": "…", "sources": [{ "name": "ABC News", "url": "https://…" }]
  }],
  "dialogue": { "title": "…", "titleZh": "…", "setting": "…", "settingZh": "…",
    "lines": [{ "s": "A", "name": "Mia", "en": "…", "zh": "…" }],
    "phrases": [{ "plain": "…", "en": "…", "zh": "…" }] }
}
```

## Local preview

```sh
cd site && python3 -m http.server 8000
# open http://localhost:8000
```

Fonts (Archivo, Atkinson Hyperlegible, Gentium Book Plus) are self-hosted under the SIL Open Font License.
