import { create } from 'zustand'
import { produce } from 'immer'
import { api } from '../lib/api.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { deviceLang } from '../lib/i18n.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'

const KEY = 'gym_state_v1'
export const DEF = {
  // `lang: null` means "never chosen" — App.jsx resolves it against the device
  // language on every load. Storing a resolved 'en' here instead would pin the
  // default for everyone whose phone is not in English.
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: null,
  theme: 'dark', accent: 'ember', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null,
  // Native build only: fire a local notification when the rest timer ends, so it
  // still rings with the app in the background. Defaults on — it is what a rest
  // timer is for — and the OS permission is asked for by the Settings switch,
  // never mid-workout.
  restAlert: true,
  // How the exercise demos are rendered in dark mode: 'dim' (default, safe),
  // 'invert' (genuinely dark, suits most of these flat illustrations) or 'plain'
  // (the source untouched). Light mode always uses the source.
  demo: 'dim',
  // The gym's kit, per unit, for the plate calculator. Absent until someone
  // edits it, at which point lib/plates.js defaults take over — most people
  // train at one gym and will set this once, if ever.
  bar: null, plates: null,
  // Set once the first-run flow has been seen (or skipped). Absent on every
  // profile written before it existed, which is why App.jsx also checks whether
  // the profile has any data — an upgrading user must never be sent back to a
  // welcome screen.
  onboarded: false
}
const clone = o => JSON.parse(JSON.stringify(o))
// persist() used to stamp this; it no longer does, because an Immer result is
// frozen and cannot be written to after the fact. The produce() paths set it
// inside the recipe; the whole-state replacements below use this.
const stamp = S => { S._ts = Date.now(); return S }

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  // Writing to localStorage means serialising the whole state, which is ~10 ms at
  // a few years of history and grows with it. Doing that synchronously inside
  // every set toggle put that cost on the finger that tapped the checkbox, so
  // the write is debounced and the UI never waits on it. Everything that can end
  // the session early — backgrounding, navigating away, closing — flushes it, so
  // the durability guarantee is unchanged; only the timing moved.
  let writeTm = null
  const writeNow = () => {
    try { localStorage.setItem(KEY, JSON.stringify(get().S)) } catch (e) { /* quota — keep going */ }
  }
  // flushWrite() only exists to bring a PENDING write forward, so it guards on
  // there being one. writeNow() is the write itself and guards on nothing —
  // folding the two together meant the timer cleared writeTm, then called a
  // function that returned immediately because writeTm was null, and nothing was
  // ever persisted at all.
  const flushWrite = () => {
    if (!writeTm) return
    clearTimeout(writeTm)
    writeTm = null
    writeNow()
  }
  const scheduleWrite = () => {
    if (writeTm) return
    writeTm = setTimeout(() => { writeTm = null; writeNow() }, 400)
  }

  const persist = (S, push = true) => {
    registerCustom(S.customEx)
    set({ S })            // synchronous: the UI must never wait on I/O
    scheduleWrite()
    if (MOBILE) nativePersist()
    if (push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    flushWrite()
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(KEY)
    persist(stamp(clone(DEF)), false)
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,

      // Mutate a draft of S via producer fn, then persist + schedule sync.
    //
    // The draft is an Immer draft, not a deep copy. The producers are unchanged —
    // they still mutate what they are handed — but what comes out shares every
    // branch the producer did not touch with the state that went in. That matters
    // because `S` holds the entire workout history: deep-cloning it cost 28-112 ms
    // at three years of training, on every checkbox, every stepper press and every
    // keystroke in a weight field, and the cost grew for exactly the people who
    // had used the app longest. Cloning only the path being written is O(current
    // workout) instead of O(everything ever logged).
    update(mut, push = true) {
      persist(produce(get().S, draft => { mut(draft); draft._ts = Date.now() }), push)
    },
    replaceState(S, push = false) { persist(stamp(clone(S)), push) },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    setUser(u) {
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    async pushState() {
      if (!get().user) return
      clearTimeout(pushTm)
      try { await api('/api/data', { method: 'PUT', body: JSON.stringify({ state: get().S }) }); localStorage.removeItem('gym_dirty') }
      catch (e) { localStorage.setItem('gym_dirty', '1') }
    },
    async pullState() {
      try {
        const { state } = await api('/api/data')
        const S = get().S
        const dirty = localStorage.getItem('gym_dirty') === '1'
        if (state && (!hasData(S) || ((state._ts || 0) >= (S._ts || 0) && !dirty))) {
          const active = S.active
          const next = Object.assign(clone(DEF), state)
          if (active) next.active = active
          persist(stamp(next), false)
        } else if (hasData(S)) { await get().pushState() }
      } catch (e) { /* offline — keep local */ }
    },

    async signOut() {
      try { await get().pushState(); await api('/api/logout', { method: 'POST', body: '{}' }) } catch (e) { /* */ }
      clearLocalSession()
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      await get().pushState()   // never throws — stores gym_dirty and moves on when offline
      await api('/api/logout/all', { method: 'POST', body: '{}' })
      clearLocalSession()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(stamp(Object.assign(clone(DEF), buildDemoState())), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      // Mobile build: no backend either — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in.
      if (MOBILE) {
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(stamp(Object.assign(clone(DEF), saved)), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        syncReminder(get().S)
        set({ ready: true })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      try {
        const me = await api('/api/me')
        get().setUser(me.user)
        await get().pullState()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }
