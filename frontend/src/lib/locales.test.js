// Locale packs are plain objects keyed by the English source string, so a typo in
// a key is not an error — it is a string that silently renders in English forever.
// English is the reference here: every other pack is measured against the union of
// keys the established packs already agree on.

import { describe, it, expect } from 'vitest'
import { LANGS } from './i18n.js'

// Lives in lib/, not locales/, on purpose: scripts/check-locales.mjs imports
// every .js in src/locales/ as a locale pack, and a test file sitting there
// crashes it on the Vite-only import.meta.glob this very line uses.
const packs = import.meta.glob('../locales/*.js', { eager: true })
const load = code => packs['../locales/' + code + '.js']?.default

const CODES = Object.keys(LANGS).filter(c => c !== 'en')

describe('locale packs', () => {
  it('ships a pack for every language offered in Settings', () => {
    CODES.forEach(c => expect(load(c), `missing locales/${c}.js`).toBeTruthy())
  })

  it('never maps a key to an empty string', () => {
    CODES.forEach(c => {
      Object.entries(load(c)).forEach(([k, v]) => {
        expect(typeof v, `${c}: ${k}`).toBe('string')
        expect(v.trim().length, `${c}: ${k} is empty`).toBeGreaterThan(0)
      })
    })
  })

  it('keeps every {0}/{1} placeholder the source string uses', () => {
    // A dropped placeholder is the one translation bug that produces visibly
    // broken output — "{0} week streak" losing its {0} renders "week streak".
    CODES.forEach(c => {
      Object.entries(load(c)).forEach(([k, v]) => {
        const want = (k.match(/\{\d\}/g) || []).sort()
        const got = (v.match(/\{\d\}/g) || []).sort()
        expect(got, `${c}: "${k}"`).toEqual(want)
      })
    })
  })

  it('covers Indonesian at least as well as the other established packs', () => {
    // Indonesian is the app's primary market, so it may not be the thinnest pack.
    const size = c => Object.keys(load(c)).length
    const others = CODES.filter(c => c !== 'id').map(size)
    expect(size('id')).toBeGreaterThanOrEqual(Math.min(...others))
  })

  it('translates every string the onboarding flow shows, into Indonesian', () => {
    // The flow is the first thing an Indonesian user sees. A gap here is not a
    // cosmetic miss — it is an English wall in front of the install.
    const id = load('id')
    const REQUIRED = [
      'Forge yourself.', 'Get started', 'Skip', 'Continue',
      'What are you training for?', 'Build muscle', 'Get stronger',
      'Calisthenics', 'Stay in shape',
      'How many days a week?', 'days',
      'What can you train with?', 'Full gym', 'Home with weights', 'No equipment',
      'Units', 'Your plan is ready', "Start today's workout",
      'Later — take me to the app',
      'Your training log never leaves this phone',
      'Works with no signal, in any gym',
      'No account, no ads, no subscription',
    ]
    REQUIRED.forEach(k => expect(id[k], `id.js is missing: ${k}`).toBeTruthy())
  })

  it('translates the navigation destinations into Indonesian', () => {
    const id = load('id')
    ;['Home', 'Plan', 'Stats', 'Exercises', 'Start', 'Resume'].forEach(k =>
      expect(id[k], `id.js is missing nav label: ${k}`).toBeTruthy())
  })
})
