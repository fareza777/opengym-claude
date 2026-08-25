import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Bottom navigation + the primary action.
//
// This used to be five cells with "Start" raised into the middle of them — an
// iOS pattern. On Android a destination row holds destinations only, and the
// screen's primary action is a FAB floating clear of it. Splitting them fixes a
// real ambiguity as well as a stylistic one: the old centre cell sometimes
// navigated and sometimes started a workout, and nothing on it said which.
//
// The FAB is hidden inside a running workout — you are already there, and the
// screen has its own finish/discard controls.
export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'settings' && k === 'home')

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label }) => (
    <button className={on(k) ? 'on' : ''} aria-current={on(k) ? 'page' : undefined} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  return (
    <>
      {cur !== 'workout' && (
        <button
          id="fab"
          className={S.active ? 'rec' : ''}
          onClick={startWorkout}
          aria-label={S.active ? t('Resume') : t('Start')}
        >
          <Icon name={S.active ? 'play' : 'dumbbell'} />
          {/* extended only while a session is open: "Resume" has to say what it
              resumes, but an idle FAB next to a labelled nav row does not need
              a second label to be understood */}
          {!!S.active && <span>{t('Resume')}</span>}
        </button>
      )}
      <nav id="tabbar">
        <Tab k="home" icon="house" to="/home" label={t('Home')} />
        <Tab k="plan" icon="calendar" to="/plan" label={t('Plan')} />
        <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
        <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
      </nav>
    </>
  )
}
