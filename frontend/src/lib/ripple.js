// Touch-point ripple.
//
// The ripple is the loudest thing that separates an Android control from a web
// one, and the part that can't be faked in CSS alone is where it starts: a
// ripple that always grows from the centre reads as an animation, one that grows
// from the finger reads as a response. So the geometry comes from here and the
// animation stays in the sheet (`.rip::after` in index.css).
//
// One delegated listener rather than a hook per component: every control in the
// app would otherwise have to opt in through its own JSX, and several of them
// (the set-row steppers, the glyph grid, the week strip) are plain elements the
// views build inline.
//
// Elements opt in either by carrying `.rip`, or by being one of the control
// classes listed below — which is how the existing markup gets ripples without
// a single view being edited.

// Keep in step with the ripple selector list in index.css. #fab and the nav
// items are deliberately not here — see the note over that block.
const SELECTOR = [
  '.rip', '.btn', '.item', '.lrow.tap', '.chip', '.iconbtn', '.wday',
  '.cal-d', '.glyph-cell', '.stp button', '.seg button', '.tile.tappable',
  '.today-row', '.bw-pm',
].join(',')

export function installRipple() {
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.(SELECTOR)
    if (!el || el.disabled) return
    const r = el.getBoundingClientRect()
    if (!r.width) return
    // The circle has to reach the far corner from wherever it started, or a press
    // near an edge leaves the opposite side untouched.
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const size = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2
    el.style.setProperty('--rx', x + 'px')
    el.style.setProperty('--ry', y + 'px')
    el.style.setProperty('--rs', size + 'px')
  }, { passive: true, capture: true })
}
