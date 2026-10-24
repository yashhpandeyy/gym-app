# GYM API

Cloudflare Worker (Hono) + D1. One deployment serves every gym. Every stored document carries a `gym_id`, and every query is scoped by the caller's session.

## Run locally (no Cloudflare account needed)

```bash
cd server
npm install
npm run db:local     # create the local D1 tables
npm run dev          # http://127.0.0.1:8787, also reachable from a phone on the same Wi-Fi
npm test             # 120+ end-to-end checks against the running server
node scripts/make-admin.mjs you@gmail.com "Your Name" "a-strong-password"
node test/seed-demo.mjs   # optional: a gym with realistic starter records, built through the real API
```

Secrets for local runs live in `.dev.vars` (copy `.dev.vars.example`). Never commit it.

## Deploy ($0)

Everything below is on Cloudflare's free tier. No credit card is needed for an account.

```bash
npx wrangler login
npx wrangler d1 create gym-db            # paste the printed database_id into wrangler.toml
npm run db:remote
npx wrangler secret put ADMIN_TOKEN      # master token for scripts
npx wrangler secret put APP_SECRET       # long random string; also keys the password and invite hashes
npm run deploy
API=https://your-worker.workers.dev ADMIN_TOKEN=... node scripts/make-admin.mjs you@gmail.com "Your Name" "a-strong-password"
```

Then point the app at it with `EXPO_PUBLIC_API_URL`.

## Why it costs nothing

| Need | Free tool | Limit that matters |
| --- | --- | --- |
| API | Workers free plan | 100,000 requests a day, 10 ms CPU per request, 50 database calls per request |
| Database | D1 free plan | 5 GB, 5 million rows read and 100,000 rows written a day |
| Logos | A D1 table (the app shrinks them under 200 KB) | R2 needs a card on file, so it isn't used |
| Invites | A `wa.me` WhatsApp link the owner sends | No SMS or Meta API |
| Password hashing | Peppered HMAC-SHA256 | PBKDF2 would exceed the 10 ms CPU cap |

Passwords and PINs are hashed with a secret key kept in the Worker's secrets, plus a per-user salt. Sign-in locks after 5 tries, and a stolen database is useless without that key. Keep `APP_SECRET` private and never change it once gyms are live, or every login and invite stops working.

The free plan comfortably carries a handful of gyms. Every phone asks for changes every 20 seconds while the app is open, so the first limit you'd reach is the daily request count. Re-measure as you add gyms.

## How the data is shared

Everything the app keeps (plans, slots, members, bookings, check-ins, XP, workouts, meals...) is a small JSON document with a `kind`, an `id` and a position in the gym's change log.

- `GET /v1/sync?since=N` returns every document that changed after position N that this person may see.
- `POST /v1/sync/push` sends up to 20 changes. Each is accepted or refused on its own, with a reason.
- `POST /v1/sync/get` fetches specific documents, so a phone can repair itself after a refusal.

`src/sync.ts` holds the rules for who can read and write each kind. In short: the gym's setup is read by everyone and changed by staff; a member's own records are theirs to read and write; other members see only what a leaderboard or "spots left" needs (a short name, a body weight, XP amounts), never phones, plans, dues or payments.

The server also enforces what a phone can't be trusted with:

- A slot's capacity, atomically, so two people can never take the last spot.
- XP and chest limits per day, and amounts per award.
- Chest prizes, which are drawn here with real randomness when the chest is opened.
- New members, who can only be created with an invite code, never through sync.
- Medicines and supplement ticks, which are never accepted.

## Who signs in how

- **Platform admins** (you) sign in with their own email and password on the same screen as owners (`POST /v1/auth/owner-login`). They create gyms that are live at once, open any gym as its owner to set it up, switch gyms on or off, and reset an owner's password.
- **Owners** sign in with their email and password. The gym comes from the account, so no code is needed. The email is an identifier, not verified: an admin checks each gym by hand before it goes live.
- **Staff** sign in with gym code, phone and PIN, so one shared front-desk phone works. The owner adds, removes and resets them.
- **Members** have no password and no email requirement. The gym adds them and gets a one-time 6-digit invite to send on WhatsApp or read out. They enter gym code, phone and invite. Five wrong tries lock the invite; staff issue a fresh one.
- **Front-desk pairing** is the alternative: the member requests a `GYMPAIR:` QR, staff scan it, see who is asking, and confirm.

The gym code (like `FK20`, built from the gym's initials) returns branding only and nothing else.

## Sessions

Tokens are random, stored hashed, and checked on every request. Owners and staff last 30 days and members 14. Close to the end (5 days for owners and staff, 2 for members) the next request returns a fresh token in the `x-session-token` header and the app swaps it in silently, so anyone who keeps using the app never gets signed out. The old token stays valid for 10 minutes. `POST /v1/auth/logout` ends a session on the server.

## Gym lifecycle

Owners can sign up themselves (`POST /v1/gyms`) and set up branding while the gym is `pending`. Nothing else works until an admin activates it. An admin can also create a gym that is already live. `suspended` cuts off every session at once.
