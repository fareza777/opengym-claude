// Tiny dependency-free i18n. English source strings are the keys; locale files in
// src/locales/ map them to translations and are lazy-loaded (Vite code-splits each
// import.meta.glob entry), so the initial bundle stays English-only.
// Exercise instructions come from separately generated packs in src/instr/ (one per
// language, from the upstream dataset) — also lazy-loaded on language switch.
import { useSyncExternalStore } from 'react'

// UI languages. de/pt have no instruction pack upstream — instructions fall back to English.
// Indonesian sits second because it is the app's primary market; the rest keep
// their previous order. id/de/pt have no instruction pack upstream — exercise
// instructions fall back to English there.
export const LANGS = {
  en: 'English', id: 'Bahasa Indonesia', de: 'Deutsch', es: 'Español',
  fr: 'Français', it: 'Italiano', pt: 'Português', pl: 'Polski',
  tr: 'Türkçe', ru: 'Русский', zh: '中文',
  ko: '한국어', hi: 'हिन्दी'
}
export const INSTR_LANGS = ['en', 'es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko']
const DATE_LOCALES = {
  en: 'en-GB', id: 'id-ID', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
  pt: 'pt-PT', pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', zh: 'zh-CN', ko: 'ko-KR', hi: 'hi-IN'
}

// The language the device is set to, when the app has a pack for it. Used only
// as the default for a profile that has never chosen one — an explicit choice in
// Settings is stored and always wins. Without this an Indonesian phone opened
// Tempa in English and most people never went looking for the setting.
export function deviceLang() {
  const tags = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'])
  for (const tag of tags) {
    const base = String(tag).toLowerCase().split('-')[0]
    // Indonesian carries two legacy ISO codes that some Android builds still send.
    const norm = base === 'in' || base === 'ind' ? 'id' : base
    if (LANGS[norm]) return norm
  }
  return 'en'
}

const localePacks = import.meta.glob('../locales/*.js')
const instrPacks = import.meta.glob('../instr/*.js')

let lang = 'en'
let dict = {}
let instr = null            // { exId: [steps] } for the current language, null = English
let version = 0
const subs = new Set()
const notify = () => { version++; subs.forEach(f => f()) }

export const getLang = () => lang
export const dateLocale = () => DATE_LOCALES[lang] || 'en-GB'

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s, ...args) {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}
// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = ex => (instr && instr[ex.id]) || ex.st || []

export async function setLang(l) {
  if (!LANGS[l]) l = 'en'
  if (l === lang && version > 0) return
  lang = l
  try {
    dict = l === 'en' ? {} : (await localePacks['../locales/' + l + '.js']()).default
    instr = l === 'en' || !INSTR_LANGS.includes(l) ? null : (await instrPacks['../instr/' + l + '.js']()).default
  } catch (e) { dict = {}; instr = null }
  notify()
}

// Re-renders the subscribing component (and its children) whenever the language changes.
export function useLang() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => version)
}
