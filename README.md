<div align="center">

# Tempa

**Catat latihan. Naik terus.** · *Log your training. Keep going up.*

A gym & calisthenics workout tracker for Android that works offline, needs no
account, and tells you what to lift next — not just what you lifted.

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-ff9a4d?style=flat-square)](LICENSE)
![Android](https://img.shields.io/badge/Android-6.0%2B-3ddc84?style=flat-square&logo=android&logoColor=white)
![No telemetry](https://img.shields.io/badge/telemetry-none-ff9a4d?style=flat-square)
![Bahasa Indonesia](https://img.shields.io/badge/lang-id%20%C2%B7%20en%20%2B%2011-60a5fa?style=flat-square)

*A fork of [openGym](https://github.com/DuarteSantos8/openGym) by Duarte Santos.*

</div>

---

## What this is

openGym is an excellent self-hosted PWA. Tempa is that codebase turned into a
**shippable Android product for the Indonesian market**: same engine, different
audience, and a different set of assumptions about who is installing it.

The three things that changed the product, rather than the code:

**1. It is an Android app, not a web app in a shell.** The design system was
rebuilt from an iOS-derived sheet onto Material 3 Expressive — tonal surfaces
mixed from the accent hue, ripples from the touch point, an M3 navigation bar
with a real FAB, Roboto with Android metrics. See
[`frontend/src/index.css`](frontend/src/index.css).

**2. You get a real plan in four taps.** The old first run was a "Welcome!" card
offering one fixed barbell Push/Pull/Legs plan; everything else you had to
discover through a 1,324-exercise library. Now four questions — goal, days,
equipment, units — generate a plan built for the kit you actually have, and the
last screen starts today's session.

**3. It speaks Indonesian, and follows your phone.** A complete Bahasa Indonesia
pack, selected automatically from the device language, with *latihan* (a session)
and *gerakan* (a movement) kept apart the way English does not.

## Why you would pick it over Hevy, Strong, JEFIT or Madbarz

| | Tempa | Typical alternative |
|---|---|---|
| Account | none | required |
| Your training log | on your phone, exportable | on their server |
| Price | free, no tiers | free tier + subscription |
| Ads / analytics / trackers | none | usually all three |
| Offline | fully, animations included | partial or none |
| Calisthenics | first-class — reps progress, then sets, then load | usually an afterthought |
| Tells you the next weight | yes, and says why | rarely, or paid |
| Bahasa Indonesia | yes | rarely |

The differentiator is the middle of that table, not the ends. Plenty of trackers
record a set. Tempa **prescribes** the next one — pick Linear, Greyskull LP,
Double progression or Add time, and the session opens with the right numbers
already on screen and a line explaining why each one is what it is. Missed reps
never advance the load; a stall deloads on its own.

## Features

Everything openGym had — 1,324 exercises with animations, supersets, timed
holds, per-side reps, estimated 1RM, muscle map, activity heatmap, body-weight
tracking with a goal line, RIR/RPE, plan sharing, imports from FitNotes/Strong/
Hevy, JSON export — plus:

- **Generated onboarding** — goal × days × equipment → a real weekly plan
- **Offline media cache** — download your plan's animations on wifi, train with
  no signal; bounded and clearable from Settings
- **Bahasa Indonesia**, auto-selected from the device language
- **Material 3 Expressive** across every control, in light and dark
- **Edge-to-edge** with real window insets pushed into CSS
- **Themed launcher icon** (Android 13+)

## Running it

### Web (fastest way to look at it)

```bash
cd frontend && npm install && npm run dev
```

The dev server proxies `/api` to a backend that need not exist — guest mode
keeps everything in `localStorage`.

For a build with example data already in it:

```bash
npm run build:demo && npm run preview
```

### Android

Needs the Android SDK (API 36) and JDK 21.

```bash
cd frontend
npm install
npm run sync:android          # web build + cap sync
cd android && ./gradlew assembleRelease
```

The APK lands in `frontend/android/app/build/outputs/apk/release/`.

Point Gradle at your SDK first, in `frontend/android/local.properties`:

```properties
sdk.dir=C:/Android/Sdk
```

### Release build for Play

```bash
cd frontend
npm run check:release         # 24 release invariants — run this first
npm run android:bundle        # -> android/app/build/outputs/bundle/release/app-release.aab
```

Signing reads `frontend/android/keystore.properties` (gitignored) or the
environment variables `TEMPA_KEYSTORE`, `TEMPA_KEYSTORE_PASSWORD`,
`TEMPA_KEY_ALIAS`, `TEMPA_KEY_PASSWORD`. Create your upload key with:

```bash
keytool -genkeypair -v -keystore tempa-upload.jks -alias tempa -keyalg RSA -keysize 4096 -validity 10000
```

**Back that file up somewhere you will still have in five years.** Losing it
means never shipping an update to the listing again. Enrol in Play App Signing.

### Tests

```bash
cd frontend && npm test
```

```bash
npm run check:locales         # key parity across every language pack
npm run check:release         # 24 release invariants
```

218 tests. The ones worth knowing about:
[`planner.test.js`](frontend/src/lib/planner.test.js) asserts every generated
plan resolves against the real dataset and never hands a barbell to someone who
answered "no equipment"; [`locales.test.js`](frontend/src/lib/locales.test.js)
checks `{0}` placeholder parity across every language pack.

### Known gap: the other eleven languages

The onboarding flow and the offline settings added ~59 new strings. They exist in
**English and Indonesian**; the other eleven packs fall back to English for those
screens and are complete everywhere else. `npm run check:locales` lists exactly
which keys, per language. Machine-translating them without a native reader would
be worse than the fallback, so they are left as a deliberate, visible gap rather
than a hidden one.

## Documentation

- [`docs/PRIVACY.md`](docs/PRIVACY.md) — privacy policy and the Play Data safety
  answers, written to match each other
- [`store/LISTING.md`](store/LISTING.md) — store copy in Indonesian and English,
  asset specs, release checklist
- [`docs/MOBILE.md`](docs/MOBILE.md), [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) — from upstream

## Self-hosting

The upstream server, sync and passkey login are all still here and still work —
see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md). The Android build simply does
not use them: it has no backend at all, by design.

## Licence & attribution

**AGPL v3** — see [LICENSE](LICENSE).

Tempa is a fork of **openGym**, Copyright (C) 2026 Duarte Santos, and most of the
code here is his. [NOTICE.md](NOTICE.md) has the full attribution, the
app-store exception under AGPL § 7 that makes a Play release possible, the
MuscleMap licence for the body diagrams, and the terms of the exercise dataset.

Exercise names, instructions, images and animations come from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
and are **not** covered by the AGPL — they remain under that dataset's own terms.
They are not redistributed in this repository; they are fetched at runtime.

If you fork this in turn: keep the licence, keep the notices, and credit both
projects. That is not a courtesy, it is the licence.
