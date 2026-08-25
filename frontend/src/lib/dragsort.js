// Drag-to-reorder for a vertical list, by touch or mouse.
//
// The routine editor moved exercises with up/down arrows. That works, and it is
// the accessible fallback that stays, but dragging is the gesture an Android
// user reaches for first and reordering is what people do most in that screen.
//
// Deliberately not a library: the whole behaviour is "which row is my finger
// over", and the pointer events give that directly. No placeholder element, no
// cloned node — the real rows translate out of the way, which is both simpler
// and what makes the list feel like it is responding rather than re-rendering.

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * @param {number} count  how many rows there are
 * @param {(from:number,to:number)=>void} onMove  commit a reorder
 * @returns {{ dragging:number|null, over:number|null, handleProps:(i:number)=>object, rowProps:(i:number)=>object }}
 */
export function useDragSort(count, onMove) {
  const [dragging, setDragging] = useState(null)
  const [over, setOver] = useState(null)
  const rows = useRef([])           // measured row rects, taken once per drag
  const state = useRef({ from: null, to: null })

  const finish = useCallback(() => {
    const { from, to } = state.current
    state.current = { from: null, to: null }
    setDragging(null)
    setOver(null)
    if (from != null && to != null && from !== to) onMove(from, to)
  }, [onMove])

  useEffect(() => {
    if (dragging == null) return
    const move = e => {
      const y = e.touches ? e.touches[0].clientY : e.clientY
      // The index the finger is over, from the rects measured at drag start.
      // Midpoints, so a row swaps once you are past half of it rather than the
      // moment you touch its edge.
      let to = state.current.from
      for (let i = 0; i < rows.current.length; i++) {
        const r = rows.current[i]
        if (!r) continue
        if (y > r.top + r.height / 2) to = Math.min(count - 1, i + (i >= state.current.from ? 0 : 1))
        else { to = Math.max(0, i - (i > state.current.from ? 1 : 0)); break }
      }
      if (to !== state.current.to) { state.current.to = to; setOver(to) }
      e.preventDefault?.()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [dragging, count, finish])

  const start = (i, el) => {
    // Measure every row now: during the drag they are transformed, so reading
    // their live positions would chase the animation.
    const list = el?.closest('[data-dragsort]')
    rows.current = list
      ? [...list.querySelectorAll('[data-dragsort-row]')].map(n => n.getBoundingClientRect())
      : []
    state.current = { from: i, to: i }
    setDragging(i)
    setOver(i)
    if (navigator.vibrate) navigator.vibrate(12)   // the "picked up" cue
  }

  return {
    dragging,
    over,
    /** Spread onto the grab handle. */
    handleProps: i => ({
      onPointerDown: e => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        start(i, e.currentTarget)
      },
      style: { touchAction: 'none' },
    }),
    /** Spread onto each row. */
    rowProps: i => {
      const from = dragging
      const to = over
      let shift = 0
      if (from != null && to != null && i !== from) {
        // Rows between the origin and the target slide one place toward the gap.
        if (from < to && i > from && i <= to) shift = -1
        else if (from > to && i >= to && i < from) shift = 1
      }
      return {
        'data-dragsort-row': '',
        className: from === i ? 'drag-row lifted' : 'drag-row',
        style: shift ? { '--shift': shift } : undefined,
      }
    },
  }
}
