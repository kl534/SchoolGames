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

Mail and Google sign-in stay off until you do the next two sections; the site works without them.

`ALLOWED_ORIGINS` and `SITE_URL` in `wrangler.toml` name the site (`https://kl534.github.io`). Change
them if the site moves.

## Email (confirm and reset links)

The Worker sends mail through [Resend](https://resend.com). Without a domain you can only send from
Resend's test sender, to your own address, which is enough to try it. Mail stays off until both
values are set; the site then hides "Forgot password?" and the "Confirm your email" line.

1. Make a free Resend account and an API key.
2. `npx wrangler secret put RESEND_API_KEY --config worker/wrangler.toml` and paste the key.
3. Set `MAIL_FROM` under `[vars]` in `worker/wrangler.toml`, for example
   `MAIL_FROM = "School Games <onboarding@resend.dev>"` (use an address on a domain you verified in
   Resend once you have one), then `npm run worker:deploy`.

## Google sign-in

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) create an OAuth
   client ID of type "Web application".
2. Add `https://kl534.github.io` under "Authorised JavaScript origins" (and
   `http://localhost:5173` to try it locally). No redirect URI is needed.
3. Put the client ID in `worker/wrangler.toml` as
   `GOOGLE_CLIENT_ID = "<id>.apps.googleusercontent.com"` under `[vars]` (it is public), then
   `npm run worker:deploy`. The picker then shows Google's button.

## Local development

1. `npx wrangler d1 migrations apply schoolgames --config worker/wrangler.toml --local`
2. `npm run worker:dev` serves the API on `http://localhost:8787`.
3. In another shell: `VITE_SYNC_URL=http://localhost:8787 npm run dev`.

To try the mail flows locally, make `worker/.dev.vars` (not committed) with `RESEND_API_KEY=log` and
`MAIL_FROM=dev@example.com`. Mail is then on, and each mail is printed in the `worker:dev` console
instead of being sent, so you can open its link. Never set `log` on the deployed Worker. Set
`GOOGLE_CLIENT_ID` there too to see Google's button. The tests use a fake mailer instead.

## API

All bodies are JSON. Errors are `{ "error": "<code>" }`. Auth is `Authorization: Bearer <token>`.

| Route                 | Auth | What it does                                                               |
| --------------------- | ---- | -------------------------------------------------------------------------- |
| `GET /config`         | no   | `{ emailEnabled, googleClientId }`                                         |
| `POST /auth/signup`   | no   | `{ email, password }` creates an account, returns a token                  |
| `POST /auth/login`    | no   | `{ email, password }` returns a token (rate limited)                       |
| `POST /auth/logout`   | yes  | ends this session                                                          |
| `GET /me`             | yes  | `{ email }`                                                                |
| `POST /sync`          | yes  | pushes changed players and progress, returns what changed since the cursor |
| `GET /account`        | yes  | `{ email, emailVerified, hasPassword }`                                    |
| `POST /auth/google`   | no   | `{ credential }`, a Google ID token; creates or links the account          |
| `POST /auth/verify`   | no   | `{ token }` from the mailed link; 204, or 400 when stale                   |
| `POST /auth/resend`   | yes  | mails the confirmation link again (3 an hour)                              |
| `POST /auth/forgot`   | no   | `{ email }`, always 204; mails a reset link only for a password account    |
| `POST /auth/reset`    | no   | `{ token, password }` sets the password and signs out every device         |
| `POST /auth/password` | yes  | `{ current, next }` changes it and signs out the other devices             |
| `DELETE /account`     | yes  | `{ confirmEmail }` deletes the account and all its data                    |

The shared types are in `src/shared/sync/protocol.ts`, and the merge rules in
`src/shared/sync/merge.ts`. Tests: `tests/worker-*.test.ts`.
