# StudyAnki

StudyAnki is a browser-based spaced-repetition card app prototype with two modules:

- `Study Deck`: generic front/back cards
- `Nihongo Deck`: Japanese card creation with dictionary lookup candidates

## Local Development

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173/
```

The local dev server includes `/api/jisho`, a small proxy for Jisho lookup. This is for local development only.

## Static Build

```bash
npm run build
```

The static site is written to:

```text
dist/
```

## Cloudflare Pages

Use these settings:

```text
Build command: npm run build
Build output directory: dist
```

This repository is prepared for full static hosting. In a fully static deployment, live dictionary lookup may fall back to local mock candidates if a remote API blocks browser CORS requests. To support live lookup in production, add a Cloudflare Function/Worker proxy later.
