// deviceLang decides what language a brand-new install opens in, which is the one
// language decision most users never revisit. It is worth a test because the
// interesting cases are all the ones a happy-path check would miss: region
// subtags, the two legacy ISO codes Android still emits for Indonesian, and a
// device whose language the app has no pack for.

import { describe, it, expect, afterEach } from 'vitest'
import { deviceLang, LANGS } from './i18n.js'

const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

function withNavigator(languages, language) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { languages, language },
    configurable: true,
    writable: true,
  })
}
afterEach(() => { if (orig) Object.defineProperty(globalThis, 'navigator', orig) })

describe('deviceLang', () => {
  it('matches an exact tag', () => {
    withNavigator(['id'], 'id')
    expect(deviceLang()).toBe('id')
  })

  it('ignores the region subtag', () => {
    withNavigator(['id-ID'], 'id-ID')
    expect(deviceLang()).toBe('id')
    withNavigator(['pt-BR'], 'pt-BR')
    expect(deviceLang()).toBe('pt')
  })

  it('is case-insensitive', () => {
    withNavigator(['ID-id'], 'ID-id')
    expect(deviceLang()).toBe('id')
  })

  it('accepts the legacy ISO codes Android still sends for Indonesian', () => {
    // "in" was the ISO 639-1 code for Indonesian until 1989 and Java/Android
    // kept emitting it for a very long time; some builds still do.
    withNavigator(['in-ID'], 'in-ID')
    expect(deviceLang()).toBe('id')
    withNavigator(['ind'], 'ind')
    expect(deviceLang()).toBe('id')
  })

  it('walks the preference list and takes the first language it has a pack for', () => {
    withNavigator(['ga-IE', 'sw', 'id-ID', 'en-US'], 'ga-IE')
    expect(deviceLang()).toBe('id')
  })

  it('falls back to English when nothing matches', () => {
    withNavigator(['sw-KE', 'am-ET'], 'sw-KE')
    expect(deviceLang()).toBe('en')
  })

  it('falls back to navigator.language when languages is empty or absent', () => {
    withNavigator([], 'id-ID')
    expect(deviceLang()).toBe('id')
    withNavigator(undefined, 'id-ID')
    expect(deviceLang()).toBe('id')
  })

  it('never returns a code Settings cannot offer', () => {
    withNavigator(['zz-ZZ'], 'zz-ZZ')
    expect(LANGS[deviceLang()]).toBeTruthy()
  })
})
