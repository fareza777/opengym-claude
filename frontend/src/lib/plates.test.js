// Plate maths is exactly the kind of code that looks obviously right and is not:
// the whole thing is floating-point subtraction halved and compared to zero.
// These tests are mostly about the awkward numbers.

import { describe, it, expect } from 'vitest'
import { platesFor, loadableWeights, nearestLoadable, DEFAULT_PLATES, defaultBar } from './plates.js'

const KG = DEFAULT_PLATES.kg
const LB = DEFAULT_PLATES.lb

const label = r => r.perSide.map(p => `${p.count}x${p.plate}`).join(' ')

describe('platesFor', () => {
  it('loads a plain 100 kg', () => {
    const r = platesFor(100, 20, KG)
    expect(label(r)).toBe('1x25 1x15')       // 40 per side
    expect(r.loaded).toBe(100)
    expect(r.exact).toBe(true)
  })

  it('loads 60 kg as a single pair', () => {
    const r = platesFor(60, 20, KG)
    expect(label(r)).toBe('1x20')
    expect(r.exact).toBe(true)
  })

  it('reaches 82.5 with the 1.25s — the case that needs them', () => {
    const r = platesFor(82.5, 20, KG)
    expect(r.loaded).toBe(82.5)
    expect(r.exact).toBe(true)
    expect(r.perSide.some(p => p.plate === 1.25)).toBe(true)
  })

  it('does not silently round when the small plates are missing', () => {
    const noSmall = [25, 20, 15, 10, 5, 2.5]
    const r = platesFor(82.5, 20, noSmall)
    expect(r.exact).toBe(false)
    expect(r.loaded).toBe(80)
    expect(r.short).toBe(2.5)
  })

  it('handles a bare bar and a weight below it', () => {
    expect(platesFor(20, 20, KG).perSide).toEqual([])
    expect(platesFor(20, 20, KG).exact).toBe(true)
    expect(platesFor(15, 20, KG).perSide).toEqual([])
  })

  it('works with no bar at all — dumbbells, machines', () => {
    const r = platesFor(30, 0, KG)
    expect(r.loaded).toBe(30)
    expect(r.exact).toBe(true)
  })

  it('survives the float that makes this worth testing', () => {
    // 82.5 - 20 = 62.5; /2 = 31.25; minus 25, 5, 1.25 must land exactly on zero.
    // With a 1.25 as the smallest plate every loadable weight is bar + 2.5k, so
    // these are the awkward ones that ARE makeable.
    for (const w of [82.5, 47.5, 67.5, 102.5, 122.5, 142.5]) {
      const r = platesFor(w, 20, KG)
      expect(r.loaded, `${w} kg`).toBe(w)
      expect(r.exact, `${w} kg`).toBe(true)
    }
  })

  it('refuses a weight that falls between what the plates can make', () => {
    // 83.75 needs 31.875 per side, and no pair of 1.25s gets there. The honest
    // answer is the best it can load and how far short that leaves it — not a
    // silent round to something the lifter did not ask for.
    for (const w of [83.75, 61.25, 141.25]) {
      const r = platesFor(w, 20, KG)
      expect(r.exact, `${w} kg`).toBe(false)
      expect(r.loaded, `${w} kg`).toBeLessThan(w)
      expect(r.short, `${w} kg`).toBeGreaterThan(0)
    }
  })

  it('reports an odd remainder as unloadable rather than fudging it', () => {
    // 21 kg on a 20 kg bar is 0.5 per side, and the default set has no 0.25
    const r = platesFor(21, 20, KG)
    expect(r.exact).toBe(false)
  })

  it('works in pounds', () => {
    const r = platesFor(225, 45, LB)
    expect(label(r)).toBe('2x45')            // 90 per side
    expect(r.loaded).toBe(225)
    expect(r.exact).toBe(true)
    expect(defaultBar('lb')).toBe(45)
  })

  it('is greedy — heaviest plates first, fewest changes at the bar', () => {
    const r = platesFor(140, 20, KG)
    expect(r.perSide[0].plate).toBe(25)
    expect(r.perSide.reduce((n, p) => n + p.count, 0)).toBeLessThanOrEqual(4)
  })
})

describe('loadableWeights', () => {
  it('always includes the bare bar', () => {
    expect(loadableWeights(20, KG, 200)).toContain(20)
  })
  it('never produces a weight the plates cannot make', () => {
    const set = [20, 10]
    const all = loadableWeights(20, set, 120)
    all.forEach(w => expect(platesFor(w, 20, set).exact, `${w} kg`).toBe(true))
  })
  it('is ascending and free of duplicates', () => {
    const all = loadableWeights(20, KG, 150)
    expect([...all].sort((a, b) => a - b)).toEqual(all)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('nearestLoadable', () => {
  it('confirms a weight that is already loadable', () => {
    const r = nearestLoadable(100, 20, KG)
    expect(r.exact).toBe(true)
    expect(r.below).toBe(100)
  })

  it('brackets a weight that is not', () => {
    const noSmall = [25, 20, 15, 10, 5]
    const r = nearestLoadable(82.5, 20, noSmall)
    expect(r.exact).toBe(false)
    expect(r.below).toBe(80)
    expect(r.above).toBe(90)
  })

  it('returns no lower option below the bar', () => {
    expect(nearestLoadable(10, 20, KG).below).toBe(null)
  })
})
