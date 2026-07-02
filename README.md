# StudyAnki

StudyAnki is a browser-based spaced-repetition card app prototype with two modules:

- `Study Deck`: generic front/back cards
- `Nihongo Deck`: Japanese card creation with dictionary lookup candidates

The local data model supports multiple users. Cards, tags, notes, and daily review progress are scoped to the active user. The app opens on a profile selection screen where users can switch profiles, edit users, or read basic usage guidance.

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

## Review Scheduling

The app uses an Anki-like classic scheduler:

- New cards enter learning steps: `1m`, then `10m`
- Graduated cards enter review with day-based intervals
- Failed review cards enter relearning for `10m`
- New card and review card daily limits are tracked separately

## Cloudflare Pages

Use these settings:

```text
Build command: npm run build
Build output directory: dist
Node.js version: 22
Deploy command: leave blank
```

The repository also includes `wrangler.toml`, so Wrangler can deploy the static build directly:

```bash
npm run build
CLOUDFLARE_API_TOKEN=your_token npx wrangler pages deploy dist --project-name studyanki --branch main
```

This repository is prepared for full static hosting. In a fully static deployment, live dictionary lookup may fall back to local mock candidates if a remote API blocks browser CORS requests. To support live lookup in production, add a Cloudflare Function/Worker proxy later.

## Cloudflare Workers Static Assets

If Cloudflare shows a required `Deploy command` field, use the Workers Static Assets settings instead:

```text
Build command: npm run build
Deploy command: npm run deploy
Non-production branch deploy command: npm run deploy
Path: /
```

Do not use `npx wrangler deploy` by itself. This project is a static site, so Wrangler must receive the built assets directory. The `npm run deploy` script expands to:

```bash
npx wrangler deploy --assets=./dist
```
