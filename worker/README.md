# School Games sync service

A Cloudflare Worker with a D1 database. It stores accounts (an adult's email and a salted password
hash) and, per player, a first name, a buddy emoji and the progress JSON the app already keeps
locally. The site itself stays on GitHub Pages. If the site is built without a sync URL, none of this
is used and the app works exactly as before.

## One-time setup

You need a free Cloudflare account. Run these from the repo root.

1. `npx wrangler login`
2. `npx wrangler d1 create schoolgames` and copy the `database_id` it prints into
   `worker/wrangler.toml` (replace the placeholder).
3. `npx wrangler d1 migrations apply schoolgames --config worker/wrangler.toml --remote`
4. `npm run worker:deploy`. It prints the Worker URL, like
   `https://schoolgames-sync.<your-subdomain>.workers.dev`.
5. In the GitHub repo, go to Settings, Secrets and variables, Actions, Variables, and add a variable
   named `SYNC_URL` with the Worker URL. The next deploy of the site builds with it, and the player
   picker then shows "Sign in to sync across devices".

`ALLOWED_ORIGINS` and `SITE_URL` in `wrangler.toml` name the site (`https://kl534.github.io`). Change
them if the site moves.

## Local development

1. `npx wrangler d1 migrations apply schoolgames --config worker/wrangler.toml --local`
2. `npm run worker:dev` serves the API on `http://localhost:8787`.
3. In another shell: `VITE_SYNC_URL=http://localhost:8787 npm run dev`.

## API

All bodies are JSON. Errors are `{ "error": "<code>" }`. Auth is `Authorization: Bearer <token>`.

| Route               | Auth | What it does                                                               |
| ------------------- | ---- | -------------------------------------------------------------------------- |
| `GET /config`       | no   | `{ emailEnabled, googleClientId }`                                         |
| `POST /auth/signup` | no   | `{ email, password }` creates an account, returns a token                  |
| `POST /auth/login`  | no   | `{ email, password }` returns a token (rate limited)                       |
| `POST /auth/logout` | yes  | ends this session                                                          |
| `GET /me`           | yes  | `{ email }`                                                                |
| `POST /sync`        | yes  | pushes changed players and progress, returns what changed since the cursor |

The shared types are in `src/shared/sync/protocol.ts`, and the merge rules in
`src/shared/sync/merge.ts`. Tests: `tests/worker-*.test.ts`.
