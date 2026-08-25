// Plate maths.
//
// The app's whole argument is that it works the training variables out for you:
// it decides the next weight and explains why. Then it stops one step short of
// the thing you actually have to do, standing in front of a rack — work out
// which plates to hang on the bar. Everyone does that arithmetic in their head,
// badly, mid-warm-up.
//
// It also gives rounding an honest answer. The progression engine snaps to the
// configured increment, but an increment is not the same as a loadable weight:
// 82.5 kg needs a 1.25 pair, and plenty of gyms do not have one. Knowing the
// plate set means the app can say "you cannot make 82.5 here" and offer the two
// weights you can make, instead of prescribing a number and letting you discover
// the problem at the bar.

/** Bars people actually train on, per unit. */
export const BARS = {
  kg: [
    { w: 20, label: 'Olympic bar' },
    { w: 15, label: "Women's bar" },
    { w: 10, label: 'Training bar' },
    { w: 7,  label: 'EZ bar' },
    { w: 0,  label: 'No bar' },
  ],
  lb: [
    { w: 45, label: 'Olympic bar' },
    { w: 35, label: "Women's bar" },
    { w: 25, label: 'Training bar' },
    { w: 15, label: 'EZ bar' },
    { w: 0,  label: 'No bar' },
  ],
}

/** The plate denominations a gym is likely to own, heaviest first. */
export const PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lb: [45, 35, 25, 10, 5, 2.5, 1.25],
}

/** What a gym is assumed to have until someone says otherwise. */
export const DEFAULT_PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
}
export const defaultBar = unit => (unit === 'lb' ? 45 : 20)

// Floating point: 82.5 - 20 = 62.5, / 2 = 31.25, and subtracting 1.25 eight times
// lands on 8.881784197001252e-16 rather than 0. Everything is compared in
// hundredths of a unit as integers instead.
const cents = v => Math.round(v * 100)

/**
 * Which plates to put on each side.
 *
 * Greedy from the heaviest plate down, which is both optimal for these
 * denominations and the way anyone actually loads a bar. Returns what it could
 * make and what it could not, rather than failing: a bar you can only get to
 * 81.25 kg is still the answer to "what do I load", it just needs saying.
 *
 * @returns {{ perSide: {plate:number,count:number}[], loaded:number, short:number, exact:boolean }}
 */
export function platesFor(target, bar, available) {
  const set = [...(available || [])].filter(p => p > 0).sort((a, b) => b - a)
  const t = cents(target)
  const b = cents(bar)
  if (!(t > b)) return { perSide: [], loaded: bar, short: 0, exact: cents(bar) === t }

  // Everything below is per side; the bar carries twice what one side holds, so
  // an odd remainder is simply not loadable however many plates you own.
  let remaining = Math.round((t - b) / 2)
  const perSide = []
  for (const plate of set) {
    const p = cents(plate)
    const count = Math.floor(remaining / p)
    if (count > 0) { perSide.push({ plate, count }); remaining -= count * p }
  }
  const loadedCents = b + (Math.round((t - b) / 2) - remaining) * 2
  return {
    perSide,
    loaded: loadedCents / 100,
    short: (t - loadedCents) / 100,
    exact: remaining === 0 && (t - b) % 2 === 0,
  }
}

/** Every weight this bar and plate set can actually make, ascending. */
export function loadableWeights(bar, available, max) {
  const set = [...(available || [])].filter(p => p > 0).sort((a, b) => b - a)
  if (!set.length) return [bar]
  const ceiling = cents(max || bar + 400)
  const seen = new Set([cents(bar)])
  // Each plate contributes in pairs; walking the denominations and doubling
  // every reachable subtotal keeps this to a few thousand values at most.
  let frontier = [0]
  for (const plate of set) {
    const p = cents(plate)
    const next = []
    for (const base of frontier) {
      // A gym has a finite number of any one plate; eight pairs is already
      // 400 kg of 25s and past anything this app needs to enumerate.
      for (let n = 0; n <= 8; n++) {
        const v = base + n * p
        const total = cents(bar) + v * 2
        if (total > ceiling) break
        next.push(v)
        seen.add(total)
      }
    }
    frontier = [...new Set(next)]
  }
  return [...seen].sort((a, b) => a - b).map(c => c / 100)
}

/**
 * The nearest weights this bar and plate set can make, either side of a target.
 * Used to answer "82.5 isn't loadable here — 80 or 85?".
 */
export function nearestLoadable(target, bar, available) {
  const all = loadableWeights(bar, available, target + 60)
  const t = cents(target)
  let below = null, above = null
  for (const w of all) {
    const c = cents(w)
    if (c <= t) below = w
    if (c >= t) { above = w; break }
  }
  return { below, above, exact: below != null && cents(below) === t }
}
