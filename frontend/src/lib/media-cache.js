// On-device cache for exercise images and animations.
//
// The native build does not bundle the media: the dataset's images and GIFs are
// around 140 MB, which is not a download anyone should make to try a workout
// tracker, so they are fetched from the upstream CDN on first view.
//
// That left two real problems, and this module exists for both:
//
//   1. The app tells people it works with no signal. Without a cache that was
//      only true of the numbers — walk into a basement gym and the animation
//      for the movement you are about to do is a broken image. The demo is the
//      reason a beginner trusts the app at all.
//   2. Mobile data costs money. Re-fetching the same GIF every time you open
//      the same exercise is the app spending someone else's quota, and in the
//      market this is built for that is not a rounding error.
//
// So every file is written to the app's cache directory the first time it is
// seen and served from disk afterwards. The cache is bounded (see LIMIT) and
// evicted oldest-first, because a user who browses the library could otherwise
// pull down the whole dataset one exercise at a time.
//
// Everything here folds away in a web build: MOBILE is replaced at build time
// and the browser has an HTTP cache of its own doing this job already.

import { MOBILE } from './mobile.js'

const DIR = 'media'
const MANIFEST = 'media/index.json'
// ~120 MB. Large enough that a plan's worth of exercises — a few dozen files —
// never evicts, small enough that browsing the whole library cannot fill a
// budget phone. Cache-directory files are also what Android reclaims first when
// storage runs low, so the worst case is a re-download, never lost training data.
const LIMIT = 120 * 1024 * 1024

let ready = null           // Promise<void>       — one-time load of the manifest
let index = null           // { [key]: { bytes, at } }
let dirty = false
const resolved = new Map() // key -> local src, so a re-render never touches disk
const inFlight = new Map() // key -> Promise, so two <img> for one file fetch once

const keyOf = url => url.split('/').pop().split('?')[0]

async function fs() { return (await import('@capacitor/filesystem')) }

async function load() {
  if (ready) return ready
  ready = (async () => {
    try {
      const { Filesystem, Directory, Encoding } = await fs()
      await Filesystem.mkdir({ path: DIR, directory: Directory.Cache, recursive: true }).catch(() => {})
      const r = await Filesystem.readFile({ path: MANIFEST, directory: Directory.Cache, encoding: Encoding.UTF8 })
      index = JSON.parse(r.data) || {}
    } catch (e) { index = {} }
  })()
  return ready
}

let saveTm = null
function scheduleSave() {
  dirty = true
  clearTimeout(saveTm)
  saveTm = setTimeout(save, 2000)
}
async function save() {
  if (!dirty) return
  dirty = false
  try {
    const { Filesystem, Directory, Encoding } = await fs()
    await Filesystem.writeFile({
      path: MANIFEST, directory: Directory.Cache,
      data: JSON.stringify(index), encoding: Encoding.UTF8,
    })
  } catch (e) { /* the files are still there; the manifest rebuilds as empty */ }
}

function totalBytes() {
  return Object.values(index).reduce((n, e) => n + (e.bytes || 0), 0)
}

// Oldest-first, which for media is a decent proxy for least-used: the exercises
// in your current plan are the ones you keep touching, and `at` is refreshed on
// every hit.
async function evictTo(target) {
  const entries = Object.entries(index).sort((a, b) => (a[1].at || 0) - (b[1].at || 0))
  let bytes = totalBytes()
  const { Filesystem, Directory } = await fs()
  for (const [key, entry] of entries) {
    if (bytes <= target) break
    try { await Filesystem.deleteFile({ path: DIR + '/' + key, directory: Directory.Cache }) } catch (e) { /* */ }
    bytes -= entry.bytes || 0
    delete index[key]
    resolved.delete(key)
  }
  scheduleSave()
}

async function localSrc(key) {
  const { Filesystem, Directory } = await fs()
  const { Capacitor } = await import('@capacitor/core')
  const { uri } = await Filesystem.getUri({ path: DIR + '/' + key, directory: Directory.Cache })
  return Capacitor.convertFileSrc(uri)
}

// Fetch once and write to disk. Resolves to the local src, or to null when the
// download failed — the caller keeps showing the remote URL in that case, so a
// cache miss is never worse than not having a cache.
async function store(url, key) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const blob = await res.blob()
  const data = await new Promise((ok, no) => {
    const fr = new FileReader()
    fr.onerror = () => no(fr.error)
    // readAsDataURL gives "data:<type>;base64,<payload>"; Filesystem wants the payload.
    fr.onload = () => ok(String(fr.result).split(',')[1])
    fr.readAsDataURL(blob)
  })
  const { Filesystem, Directory } = await fs()
  await Filesystem.writeFile({ path: DIR + '/' + key, directory: Directory.Cache, data, recursive: true })
  index[key] = { bytes: blob.size, at: Date.now() }
  scheduleSave()
  if (totalBytes() > LIMIT) await evictTo(LIMIT * 0.8)
  return localSrc(key)
}

/**
 * The src to render for a media URL.
 *
 * Returns the cached local src when there is one. On a miss it returns the
 * remote URL immediately — so the image appears at exactly the speed it did
 * before this module existed — and caches in the background for next time.
 */
export async function cachedSrc(url) {
  if (!MOBILE || !url) return url
  const key = keyOf(url)
  if (resolved.has(key)) return resolved.get(key)
  await load()
  if (index[key]) {
    try {
      const src = await localSrc(key)
      resolved.set(key, src)
      index[key].at = Date.now()
      scheduleSave()
      return src
    } catch (e) {
      // Android reclaimed the cache directory under storage pressure.
      delete index[key]
    }
  }
  if (!inFlight.has(key)) {
    inFlight.set(key, store(url, key)
      .then(src => { resolved.set(key, src); return src })
      .catch(() => null)
      .finally(() => inFlight.delete(key)))
  }
  return url
}

/** Synchronous best guess, for the first paint. Never touches disk. */
export const cachedSrcSync = url => (MOBILE && url ? resolved.get(keyOf(url)) || url : url)

/**
 * Pre-download a list of media URLs — "get my plan onto the phone while I am on
 * wifi", which is the whole point of the cache for anyone paying by the
 * megabyte. Reports progress so the caller can show it, and never rejects: a
 * partial download is a partial cache, not a failure.
 */
export async function preload(urls, onProgress) {
  if (!MOBILE) return { done: 0, total: 0 }
  await load()
  const todo = [...new Set(urls.filter(Boolean))].filter(u => !index[keyOf(u)])
  let done = 0
  // Serial on purpose: a phone on a weak connection does worse with eight
  // parallel GIF downloads than with one at a time, and this runs in the
  // background behind a progress row nobody is staring at.
  for (const url of todo) {
    try { await store(url, keyOf(url)) } catch (e) { /* skip and continue */ }
    done++
    onProgress?.(done, todo.length)
  }
  await save()
  return { done, total: todo.length }
}

/** Bytes currently held, for the Settings row. */
export async function cacheSize() {
  if (!MOBILE) return 0
  await load()
  return totalBytes()
}

/** Count of files held. */
export async function cacheCount() {
  if (!MOBILE) return 0
  await load()
  return Object.keys(index).length
}

export async function clearCache() {
  if (!MOBILE) return
  await load()
  try {
    const { Filesystem, Directory } = await fs()
    await Filesystem.rmdir({ path: DIR, directory: Directory.Cache, recursive: true })
    await Filesystem.mkdir({ path: DIR, directory: Directory.Cache, recursive: true }).catch(() => {})
  } catch (e) { /* */ }
  index = {}
  resolved.clear()
  await save()
}
