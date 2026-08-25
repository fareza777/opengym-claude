# Privacy Policy — Tempa

**Last updated: 25 August 2026**
**Applies to: Tempa for Android (`io.github.fareza777.tempa`), version 2.0.0 and later**

Google Play requires every app to link a privacy policy, and requires the
[Data safety](#data-safety-declaration) form to match it. This document is
written to be the source of truth for both, so it states what the app actually
does rather than what a template would allow it to do.

---

## The short version

Tempa has no account system, no server, and no analytics. Your training log —
every workout, every set, every weigh-in — is written to storage on your phone
and is never transmitted anywhere. There is nothing for us to see, because there
is no "us" in the data path at all.

The app makes exactly one kind of network request, and it is not about you: it
downloads exercise animations from a public CDN the first time you open an
exercise. That is described in full below.

---

## What Tempa stores, and where

All of the following is kept **only on your device**, in the app's private
storage:

| Data | Why it exists |
|---|---|
| Workouts — exercises, sets, reps, weights, duration, optional effort rating | The training log. It is the app. |
| Body weight entries and an optional weight goal | The body-weight chart |
| Your weekly plan and routines | What the app suggests you train today |
| Per-exercise working weights and personal records | Pre-filling your next session and detecting PRs |
| Settings — units, theme, accent, language, rest timer, reminder time | Preferences |
| Downloaded exercise images and animations | Offline use (see below) |

Android's own private app storage is where this lives. Other apps cannot read
it. Uninstalling Tempa deletes all of it.

**We never see any of it.** There is no upload, no sync, no backup to us, no
crash reporting, no analytics SDK, no advertising SDK, no fingerprinting.

### Automatic cloud backup is switched off for your training data

Android can back an app's files up to your Google Drive automatically. Tempa
**excludes its training data from that**, in both
[`backup_rules.xml`](../frontend/android/app/src/main/res/xml/backup_rules.xml)
and
[`data_extraction_rules.xml`](../frontend/android/app/src/main/res/xml/data_extraction_rules.xml),
so your workouts are not copied to Google's servers without you asking.

If you want a copy of your data — to move phones, or just to keep one — use
**Settings → Export backup (JSON)**. That hands you a file and lets you decide
where it goes.

---

## The one network request

Tempa's exercise library has 1,324 movements with demonstration animations. Those
files total roughly 140 MB, which is not a reasonable download for installing a
workout tracker, so they are **not bundled in the app**. Instead:

- The first time you open an exercise, the app fetches that exercise's image and
  animation from **jsDelivr** (`cdn.jsdelivr.net`), a public open-source CDN,
  which serves them from the
  [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
  repository.
- The file is then **saved on your phone** and served from disk from then on. An
  exercise you have opened once works with no connection at all.
- **Settings → Offline → Download my plan for offline use** fetches everything in
  your plan in one go, so you can do it on wifi and train offline afterwards.
- **Settings → Offline → Clear downloaded media** removes the cached files.

### What jsDelivr can see

Like any web request, this one exposes your **IP address** and the **filename
requested** to the CDN. jsDelivr is operated by an independent third party under
[its own privacy policy](https://www.jsdelivr.com/privacy-policy-jsdelivr-net).

That request contains **no identifier of you and no training data**. It does not
say who you are, what you lifted, or that the two requests came from the same
person. It is the same information any browser reveals when it loads an image.

We are stating it plainly rather than burying it, because "works offline, nothing
leaves your phone" would otherwise be an overstatement, and an app whose whole
pitch is data ownership does not get to be sloppy about the one exception.

**If you do not want any network request at all:** turn off network access for
Tempa in Android Settings → Apps → Tempa → Mobile data & Wi-Fi. Everything except
the exercise animations continues to work.

---

## Permissions, and why each one exists

| Permission | Why |
|---|---|
| `INTERNET` | Downloading exercise animations (above). Nothing else. |
| `POST_NOTIFICATIONS` | The optional rest-timer alert and workout-day reminder. Asked for only when you switch a reminder on; deny it and the rest of the app is unaffected. |
| `RECEIVE_BOOT_COMPLETED` | Re-registers your reminder after a reboot, so it does not silently stop working. |
| `WAKE_LOCK` | Delivers a scheduled reminder while the device is asleep. |

Tempa deliberately does **not** request:

- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` — a workout reminder does not need
  to fire to the exact minute, and Play restricts these to alarm-clock and
  calendar apps.
- Location, camera, microphone, contacts, files, health data, or any device
  identifier. None of them.

---

## Children

Tempa is not directed at children under 13 and collects nothing from anyone,
including them.

---

## Changes

Any change to this policy ships with an app update and this file's history is
public in the repository, so the diff is auditable rather than announced.

---

## Contact

Open an issue at
<https://github.com/fareza777/opengym-claude/issues>.

---

# Data safety declaration

The answers below are what the Play Console form should be filled in with. They
follow directly from the policy above.

**Does your app collect or share any of the required user data types?**
→ **No.**

Google's definition of "collect" is transmission off the device. Tempa transmits
no user data. The training log never leaves the phone, and the CDN request
carries no user data — only a filename.

| Question | Answer |
|---|---|
| Data collected | None |
| Data shared with third parties | None |
| Data encrypted in transit | N/A — no user data is transmitted. The CDN request itself is HTTPS. |
| Users can request data deletion | N/A — nothing is held. Uninstalling removes everything; Settings → Reset everything clears it in place. |
| Committed to the Play Families Policy | No (the app is not targeted at children) |
| Independent security review | No |

**Ads:** none. **In-app purchases:** none. **Account required:** none.

If a future version adds optional sync, this form and the policy above must be
updated in the same release — not after it.
