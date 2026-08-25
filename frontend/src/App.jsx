import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore, hasData } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang, deviceLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { effectiveRoutine } from './lib/history.js'
import { todayISO } from './lib/format.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Login from './views/Login.jsx'
import Onboarding from './views/Onboarding.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

// Normalise any CSS colour the sheet can produce (color-mix, oklab, a hex) into
// the rgb() string a <meta> parser understands. A 2D context stores fillStyle as
// a serialised colour, so assigning and reading it back is the conversion.
let cctx = null
function resolveColor(css) {
  if (!css) return ''
  try {
    cctx = cctx || document.createElement('canvas').getContext('2d')
    cctx.fillStyle = '#000'
    cctx.fillStyle = css
    return cctx.fillStyle
  } catch (e) { return '' }
}

function applyPrefs(theme, accent, demo) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'ember'
  de.dataset.demo = demo === 'invert' || demo === 'plain' ? demo : 'dim'
  // Matches --surf for the active theme. Read from the element rather than
  // hard-coded, because --surf is mixed from the accent seed — a hard-coded pair
  // was visibly the wrong hue behind the status bar on every accent but one.
  //
  // It has to be *resolved* first: getPropertyValue hands back the literal
  // `color-mix(...)` text, and a theme-color meta parses none of color-mix,
  // oklab or a custom property — the tag is simply ignored and the system bar
  // falls back to black. Round-tripping through a canvas fill turns whatever
  // the sheet computed into a plain rgb() string, which every parser accepts.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = resolveColor(getComputedStyle(de).getPropertyValue('--surf').trim())
    || (de.dataset.theme === 'light' ? '#fcfbfa' : '#121213')
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent, S.demo) }, [S.theme, S.accent, S.demo])
  // A profile that has never picked a language follows the phone; an explicit
  // choice in Settings is stored and always wins.
  const lang = S.lang || deviceLang()
  useEffect(() => { setLang(lang) }, [lang])
  useEffect(() => { document.documentElement.lang = lang }, [langV, lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  const authed = user || isGuest
  // First run only. `hasData` guards the upgrade path: a profile that already has
  // routines, workouts or weigh-ins has plainly been through this once, whether
  // or not it carries the flag — the flag did not exist before this version.
  const needsOnboarding = authed && !S.onboarded && !hasData(S)

  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={needsOnboarding ? 'onb' : loc.pathname}>
        <ErrorBoundary>
          {!authed ? <Login /> : needsOnboarding ? (
            <Onboarding onDone={start => {
              // Straight into today's session when they asked for it — the whole
              // point of the flow is that the first workout is one tap from the
              // last screen, not a hunt for where the plan ended up.
              const S2 = useStore.getState().S
              const r = start && effectiveRoutine(S2, todayISO())
              if (r && r.ex.length) startFlow(r.id)
              else navigate('/home')
            }} />
          ) : (
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      {!needsOnboarding && <TabBar onStart={startFlow} />}
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  return <HashRouter><Shell /></HashRouter>
}
