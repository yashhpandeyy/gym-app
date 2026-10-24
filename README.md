# GYM: one app for every gym you sign

A gym membership app that re-skins itself for each gym. The owner signs up (or you create the gym for them on the spot), sets their logo, colours, hours and features, and gets a short **gym code** like `FK20`. Their members enter that code, and the app becomes theirs. Everything is real: members, bookings, check-ins, XP, plans and payments live on a server and stay in step on every phone.

There is no demo data and no hard-coded gym anywhere in the app.

## How it works

| Who | What they do |
| --- | --- |
| **You** (platform admin) | Sign in with your own email at **I run a gym**. Tap **Create a gym on the spot** after an owner agrees and pays. The gym is live at once. Open it as the owner to set it up with them, then hand over their login. |
| **Gym owner** | Signs in with their email and password. Sets name, logo (colours are suggested from it), hours, contact details and which features members get. Adds plans and prices, slots, classes, coaches and staff logins. Adds members. |
| **Front desk** | Signs in with their phone number and PIN (gym code first). Checks members in by scanning their pass or searching a name, adds members, confirms people joining at the desk. |
| **Member** | Enters the gym code, then their phone number and the 6-digit invite the gym sent on WhatsApp. They never need an email. Books slots, pauses for leave, earns XP and chests, follows workout and diet plans. |

A gym code on its own only shows the gym's name and logo. Nobody gets in unless the gym has added their phone number and sent them an invite (or the front desk confirms them in person).

## Run it

You need two things running: the server and the app.

```bash
# 1. The server (see server/README.md for details and deploying)
cd server
npm install
npm run db:local          # create the local database
npm run dev               # http://localhost:8787, also reachable from your phone on the same Wi-Fi
node scripts/make-admin.mjs you@gmail.com "Your Name" "a-strong-password"

# 2. The app
cd ..
npx expo start            # scan the QR with Expo Go
```

Then open the app, tap **I run a gym**, sign in with the admin email you just made, and create your first gym.

To fill a gym with realistic starter records for trying things out, run `node server/test/seed-demo.mjs` (it uses the real API, exactly like an owner would, and prints the logins).

`EXPO_PUBLIC_API_URL` points the app at a deployed server. In development it finds the server on the same computer as Expo.

## Where things live

```
src/
  app/                  screens (Expo Router)
    (auth)/             welcome, join with a gym code, owner and admin sign-in
    (member)/           member tabs: home, book, pass, club, profile
    member/             member screens: pause, renew, payments, progress, workout, coaches, leaderboards…
    (manager)/          manager tabs: today, members, check in, slots, manage
    manage/             manager screens: member detail, add member, plans, classes, coaches, staff, payments…
    live/               gym settings (setup) and the platform admin screens
  components/           membership card, pass card, charts, tab bar, flip awards, sync gate
  config/               brand.json (platform defaults), brand.ts (how a gym's details become the look)
  lib/sync.ts           keeps the phone and the server in step
  lib/domain.ts         business rules: membership, pauses, capacity, crowd, streaks, QR
  lib/game.ts           XP, levels, rings, Strength score, leagues, boards, badges
  store/                the app's state and every action
  theme/                colours derived from one brand colour, type scale, light and dark
server/                 the API and database (Cloudflare Worker + D1), with tests
shared/rules.ts         game rules both the app and the server use
```

## What stays on the phone

Medicines and supplement ticks are never uploaded. Staff can't see them. Everything else a gym member does is stored on the server.

## Publishing

Builds use [EAS](https://docs.expo.dev/eas/); no Mac or Android Studio is needed. One app called **GYM** serves every gym; members pick theirs with the code.

```bash
npx eas-cli@latest init
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform all
```

Check the current store rules before you promise launch dates:

- Apple's guideline 4.2.6 rejects apps made from a commercial template unless the business whose content it is submits them. One app that lets people pick their gym by code is the pattern Apple allows. Check the wording of the current guideline before you submit.
- Google Play makes new personal developer accounts run a closed test with a group of testers for two weeks before going live.
- The Google Play developer fee is a one-time payment and Apple's is yearly. Both are only due when you publish.

A gym that wants its own app on the stores gets a dedicated build: copy a file from `brands/` to `src/config/brand.json` with `npm run brand -- <name>`, regenerate icons with `npm run icons`, and build.

## Commands

| Command | What it does |
| --- | --- |
| `npx expo start` | Run the app (Expo Go, simulator or web) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `cd server && npm test` | 120+ end-to-end checks of the server against a running `npm run dev` |
| `npm run brand -- <name>` | Switch a dedicated build to one of the files in `brands/` |
| `npm run icons` | Regenerate icons and splash from the active brand (needs Python with Pillow) |
