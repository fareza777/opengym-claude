import { useState, useEffect } from 'react'
import { imgSrc, gifSrc } from '../lib/exercises.js'
import { cachedSrc, cachedSrcSync } from '../lib/media-cache.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// The src to render, preferring an on-device copy.
//
// The initial value is the synchronous best guess, so an exercise you have
// opened before paints from disk with no flicker and no network at all. On a
// miss that guess is the remote URL, which is exactly what this rendered before
// there was a cache — the file is then stored in the background and the swap
// happens on the next open, not mid-view.
function useMediaSrc(url) {
  const [src, setSrc] = useState(() => cachedSrcSync(url))
  useEffect(() => {
    let alive = true
    setSrc(cachedSrcSync(url))
    cachedSrc(url).then(s => { if (alive && s) setSrc(s) })
    return () => { alive = false }
  }, [url])
  return src
}

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises have no media — the animation stays blank by design (issue #11).
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  const src = useMediaSrc(ex.gif ? (playing ? gifSrc(ex) : imgSrc(ex)) : null)
  if (!ex.gif) return null
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id} onClick={() => setPlaying(p => !p)}>
      <img decoding="async" src={src} alt={ex.n} />
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  const src = useMediaSrc(ex.img ? imgSrc(ex) : null)
  if (!ex.img) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" src={src} alt="" />
}
