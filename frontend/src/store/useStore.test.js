// The store's one performance-critical invariant: a mutation must not copy the
// parts of the state it did not touch.
//
// This is worth a test rather than a comment because the regression is invisible.
// Swapping `produce` back for a deep clone changes no behaviour and breaks no
// other test — it just quietly reintroduces a cost that scales with how long
// someone has used the app, on the single most frequent interaction there is.
// So the assertions here are about object *identity*, not values.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Minimal browser surface the store touches at module load. Deliberately not a
// full DOM: the store should never need more than this.
const store = new Map()
vi.stubGlobal('localStorage', {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
})
vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} })

const { useStore } = await import('./useStore.js')

const workout = i => ({
  id: 'w' + i, d: '2026-01-01', start: i, name: 'S',
  entries: [{ id: '0043', target: { id: '0043', sets: 3, reps: 5 }, sets: [{ w: 100, r: 5, done: true }] }],
})

beforeEach(() => {
  useStore.getState().replaceState({
    unit: 'kg', routines: [{ id: 'r1', name: 'A', ex: [] }], week: {}, exWeights: {},
    bodyweight: [{ d: '2026-01-01', w: 80 }], customEx: [], workouts: [1, 2, 3].map(workout),
    active: { id: 'a', name: 'A', entries: [{ id: '0043', target: {}, sets: [{ w: 100, r: 5, done: false }, { w: 100, r: 5, done: false }] }] },
  })
})

describe('persistence', () => {
  it('actually writes to localStorage', async () => {
    // The debounced write had a guard bug that made it a no-op: the timer cleared
    // the pending handle, then called a flush that returned early because the
    // handle was null. Everything looked fine until you restarted the app and
    // found the session gone. Worth a test that just checks the bytes land.
    store.delete('gym_state_v1')
    useStore.getState().update(s => { s.unit = 'lb' })
    await new Promise(r => setTimeout(r, 600))
    const raw = store.get('gym_state_v1')
    expect(raw, 'nothing was written').toBeTruthy()
    expect(JSON.parse(raw).unit).toBe('lb')
  })

  it('coalesces a burst of mutations into one write', async () => {
    store.delete('gym_state_v1')
    for (let i = 0; i < 10; i++) useStore.getState().update(s => { s.restSec = 60 + i })
    await new Promise(r => setTimeout(r, 600))
    // last value wins, and it got there
    expect(JSON.parse(store.get('gym_state_v1')).restSec).toBe(69)
  })
})

describe('update() structural sharing', () => {
  it('does not copy the workout history when only the active session changed', () => {
    const before = useStore.getState().S
    useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
    const after = useStore.getState().S

    expect(after).not.toBe(before)                       // a new state object…
    expect(after.workouts).toBe(before.workouts)         // …sharing the untouched history
    expect(after.workouts[0]).toBe(before.workouts[0])
    expect(after.routines).toBe(before.routines)
    expect(after.bodyweight).toBe(before.bodyweight)
  })

  it('copies only the path that was written', () => {
    const before = useStore.getState().S
    useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
    const after = useStore.getState().S

    expect(after.active).not.toBe(before.active)
    expect(after.active.entries[0].sets[0]).not.toBe(before.active.entries[0].sets[0])
    // the sibling set was not written, so it is the same object
    expect(after.active.entries[0].sets[1]).toBe(before.active.entries[0].sets[1])
  })

  it('leaves the previous state untouched — the log is never mutated in place', () => {
    const before = useStore.getState().S
    const wasDone = before.active.entries[0].sets[0].done
    useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
    expect(before.active.entries[0].sets[0].done).toBe(wasDone)
  })

  it('still copies the history when the history is what changed', () => {
    const before = useStore.getState().S
    useStore.getState().update(s => { s.workouts.push(workout(4)) })
    const after = useStore.getState().S
    expect(after.workouts).not.toBe(before.workouts)
    expect(after.workouts).toHaveLength(4)
    expect(before.workouts).toHaveLength(3)              // and the old array is intact
    expect(after.workouts[0]).toBe(before.workouts[0])   // unchanged entries still shared
  })

  it('stamps _ts so sync can order two devices', () => {
    const before = useStore.getState().S._ts
    useStore.getState().update(s => { s.unit = 'lb' })
    expect(useStore.getState().S._ts).toBeGreaterThanOrEqual(before || 0)
    expect(useStore.getState().S.unit).toBe('lb')
  })
})
