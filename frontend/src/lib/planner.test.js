// The generator hard-codes exercise ids from the upstream dataset. An id that
// stops resolving would not throw — exOr() renders "Unknown exercise" — so a
// newcomer's very first plan would quietly contain holes. These tests are the
// thing that catches a dataset change, so they check resolution, not just shape.

import { describe, it, expect } from 'vitest'
import { buildPlan, describePlan, GOALS, EQUIP, DAY_OPTIONS } from './planner.js'
import { EXIDX } from './exercises.js'
import { modeOf, isBw } from './history.js'
import { policyFor, POLICIES_FOR } from './progression.js'

const every = fn => GOALS.forEach(goal =>
  EQUIP.forEach(equipment =>
    DAY_OPTIONS.forEach(days => fn({ goal, equipment, days }))))

describe('buildPlan', () => {
  it('resolves every exercise id against the dataset, for every combination', () => {
    every(answers => {
      const { routines } = buildPlan(answers)
      routines.forEach(r => r.ex.forEach(cfg => {
        expect(EXIDX[cfg.id], `${JSON.stringify(answers)} → ${r.name} → ${cfg.id}`).toBeTruthy()
      }))
    })
  })

  it('gives every routine at least three exercises', () => {
    every(answers => {
      buildPlan(answers).routines.forEach(r => {
        expect(r.ex.length, `${JSON.stringify(answers)} → ${r.name}`).toBeGreaterThanOrEqual(3)
      })
    })
  })

  it('fills exactly the requested number of training days', () => {
    every(answers => {
      const { week } = buildPlan(answers)
      expect(Object.keys(week).length).toBe(answers.days)
    })
  })

  it('points every weekday at a routine that exists in the same plan', () => {
    every(answers => {
      const { routines, week } = buildPlan(answers)
      const ids = new Set(routines.map(r => r.id))
      Object.values(week).forEach(id => expect(ids.has(id)).toBe(true))
    })
  })

  it('never lists the same exercise twice in one routine', () => {
    every(answers => {
      buildPlan(answers).routines.forEach(r => {
        const ids = r.ex.map(e => e.id)
        expect(new Set(ids).size, `${JSON.stringify(answers)} → ${r.name} → ${ids}`).toBe(ids.length)
      })
    })
  })

  it('gives routines distinct ids across two calls', () => {
    const a = buildPlan({ goal: 'muscle', days: 3, equipment: 'gym' })
    const b = buildPlan({ goal: 'muscle', days: 3, equipment: 'gym' })
    const ids = new Set([...a.routines, ...b.routines].map(r => r.id))
    expect(ids.size).toBe(a.routines.length + b.routines.length)
  })

  it('picks a progression policy the exercise mode actually allows', () => {
    every(answers => {
      const { routines } = buildPlan(answers)
      routines.forEach(r => r.ex.forEach(cfg => {
        const mode = modeOf({ ...cfg })
        expect(POLICIES_FOR[mode]).toContain(policyFor(cfg, r, mode))
      }))
    })
  })

  it('keeps the double-progression floor at or below the target reps', () => {
    every(answers => {
      buildPlan(answers).routines.forEach(r => r.ex.forEach(cfg => {
        if (cfg.repsMin == null) return
        expect(cfg.repsMin).toBeLessThanOrEqual(cfg.reps)
        expect(cfg.repsMin).toBeGreaterThan(0)
      }))
    })
  })

  it('selects only bodyweight exercises when there is no equipment', () => {
    GOALS.forEach(goal => DAY_OPTIONS.forEach(days => {
      buildPlan({ goal, days, equipment: 'none' }).routines.forEach(r => r.ex.forEach(cfg => {
        expect(isBw({ id: cfg.id }), `${cfg.id} ${EXIDX[cfg.id].n} is not bodyweight`).toBe(true)
      }))
    }))
  })

  it('never prescribes a barbell or machine to someone training at home', () => {
    const allowed = ['body weight', 'dumbbell', 'band', 'resistance band', 'kettlebell', 'assisted']
    GOALS.forEach(goal => DAY_OPTIONS.forEach(days => {
      buildPlan({ goal, days, equipment: 'home' }).routines.forEach(r => r.ex.forEach(cfg => {
        expect(allowed, `${cfg.id} ${EXIDX[cfg.id].n}`).toContain(EXIDX[cfg.id].eq)
      }))
    }))
  })

  it('falls back to a usable plan for nonsense answers', () => {
    const { routines, week } = buildPlan({ goal: 'nope', days: 99, equipment: 'spaceship' })
    expect(routines.length).toBeGreaterThan(0)
    expect(Object.keys(week).length).toBeGreaterThan(0)
    routines.forEach(r => r.ex.forEach(cfg => expect(EXIDX[cfg.id]).toBeTruthy()))
  })

  it('describes the same shape it builds', () => {
    every(answers => {
      const d = describePlan(answers)
      const { routines, week } = buildPlan(answers)
      expect(d.routineCount).toBe(routines.length)
      expect(d.dayCount).toBe(Object.keys(week).length)
      expect(d.names).toEqual(routines.map(r => r.name))
    })
  })
})
