import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { buildPlan, describePlan } from '../lib/planner.js'
import { POLICY_NAME } from '../lib/progression.js'
import { DAYN } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

// First run.
//
// The screen this replaces was a card on Home that said "Welcome!" and offered
// one fixed barbell Push/Pull/Legs plan. Everything else — what you train for,
// how many days you have, what equipment is in the room — you were expected to
// discover by finding Plan, creating a routine and searching 1,324 exercises.
// That is the gap most people never crossed, and an empty tracker is a deleted
// tracker.
//
// So: four questions, none of them optional-feeling, and a real plan at the end
// with today's session one tap away. It is skippable in one tap from the first
// screen, because someone who already knows what they want should not have to
// answer four questions to get to an empty plan they intend to build themselves.

const GOAL_CARDS = [
  { v: 'muscle',       icon: 'arm',             title: 'Build muscle',        sub: 'Hypertrophy rep ranges, weight goes up when you top the range' },
  { v: 'strength',     icon: 'barbell',         title: 'Get stronger',        sub: 'Low reps, heavy, one all-out set that decides the next jump' },
  { v: 'calisthenics', icon: 'pullup',          title: 'Calisthenics',        sub: 'Bodyweight movements — reps climb before load ever does' },
  { v: 'fitness',      icon: 'flame',           title: 'Stay in shape',       sub: 'Moderate reps across the whole body, steady weekly progress' },
]

const EQUIP_CARDS = [
  { v: 'gym',  icon: 'machine',  title: 'Full gym',        sub: 'Barbell, machines and cables' },
  { v: 'home', icon: 'dumbbell', title: 'Home with weights', sub: 'A pair of dumbbells or a kettlebell' },
  { v: 'none', icon: 'figureStrength', title: 'No equipment', sub: 'Bodyweight only — a floor and something to hang from' },
]

// A choice is a tappable card rather than a radio row: it is the only thing on
// the screen, it has to read at arm's length, and the description is what makes
// the answer a decision instead of a guess.
function Choice({ icon, title, sub, on, onClick }) {
  return (
    <button className={'onb-c' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      <span className="onb-ci"><Icon name={icon} /></span>
      <span className="onb-ct">
        <span className="onb-cn">{t(title)}</span>
        <span className="onb-cs">{t(sub)}</span>
      </span>
      {on && <Icon name="checkCircle" className="onb-ck" />}
    </button>
  )
}

export default function Onboarding({ onDone }) {
  const update = useStore(s => s.update)
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState('muscle')
  const [days, setDays] = useState(3)
  const [equipment, setEquipment] = useState('gym')
  const [unit, setUnit] = useState('kg')

  const STEPS = 5
  const back = () => setStep(s => Math.max(0, s - 1))
  const next = () => setStep(s => Math.min(STEPS - 1, s + 1))

  // Writing the plan is the only mutation this whole flow performs, and it
  // happens once, at the end — so backing out at any point leaves nothing behind.
  const commit = start => {
    const { routines, week } = buildPlan({ goal, days, equipment })
    update(s => {
      s.routines = routines
      s.week = week
      s.unit = unit
      s.onboarded = true
    })
    onDone(start)
  }
  const skip = () => {
    update(s => { s.onboarded = true })
    onDone(false)
  }

  const plan = describePlan({ goal, days, equipment })
  // Whether the plan actually has a session today decides what the last screen
  // can honestly offer. Promising "Start today's workout" on a rest day and then
  // landing on Home is the kind of small lie that costs the app its credibility
  // in the first ninety seconds.
  const trainsToday = plan.days.includes(new Date().getDay())
  const nextDay = plan.days.find(d => d > new Date().getDay()) ?? plan.days[0]

  return (
    <div className="onb">
      <div className="onb-top">
        {step > 0
          ? <button className="iconbtn" onClick={back} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
          : <span style={{ width: 40 }} />}
        <div className="onb-prog" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS}>
          {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
        </div>
        {step === 0
          ? <button className="btn ghost xs" onClick={skip}>{t('Skip')}</button>
          : <span style={{ width: 40 }} />}
      </div>

      <div className="onb-body" key={step}>
        {step === 0 && <>
          <div className="onb-hero"><Icon name="flame" /></div>
          <h1 className="onb-h">{t('Forge yourself.')}</h1>
          <p className="onb-p">{t('Tempa logs every set, works out what you should lift next, and shows you the proof that it is working.')}</p>
          <div className="onb-facts">
            <div><Icon name="lock" /><span>{t('Your training log never leaves this phone')}</span></div>
            <div><Icon name="globe" /><span>{t('Works with no signal, in any gym')}</span></div>
            <div><Icon name="heart" /><span>{t('No account, no ads, no subscription')}</span></div>
          </div>
        </>}

        {step === 1 && <>
          <h1 className="onb-h">{t('What are you training for?')}</h1>
          <p className="onb-p">{t('This picks how your weights and reps move over time. You can change it later.')}</p>
          <div className="onb-list">
            {GOAL_CARDS.map(c => <Choice key={c.v} {...c} on={goal === c.v} onClick={() => { setGoal(c.v); if (c.v === 'calisthenics') setEquipment('none') }} />)}
          </div>
        </>}

        {step === 2 && <>
          <h1 className="onb-h">{t('How many days a week?')}</h1>
          <p className="onb-p">{t('Be honest — a plan you finish beats a plan you admire. Three is plenty.')}</p>
          <div className="onb-days">
            {[2, 3, 4, 5, 6].map(d => (
              <button key={d} className={'onb-d' + (days === d ? ' on' : '')} onClick={() => setDays(d)} aria-pressed={days === d}>
                <span className="n">{d}</span>
                <span className="l">{t(d === 1 ? 'day' : 'days')}</span>
              </button>
            ))}
          </div>
          <div className="onb-note">
            <Icon name="lightbulb" />
            <span>{t('{0} → {1}', days + ' ' + t('days'), plan.names.join(' · '))}</span>
          </div>
        </>}

        {step === 3 && <>
          <h1 className="onb-h">{t('What can you train with?')}</h1>
          <p className="onb-p">{t('Only exercises you can actually perform will end up in your plan.')}</p>
          <div className="onb-list">
            {EQUIP_CARDS.map(c => <Choice key={c.v} {...c} on={equipment === c.v} onClick={() => setEquipment(c.v)} />)}
          </div>
          <h4 className="sec">{t('Units')}</h4>
          <Segmented value={unit} onChange={setUnit}
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </>}

        {step === 4 && <>
          <div className="onb-hero done"><Icon name="check" /></div>
          <h1 className="onb-h">{t('Your plan is ready')}</h1>
          <p className="onb-p">{t('{0} routines across {1} days, progressing by {2}.',
            plan.routineCount, plan.dayCount, t(POLICY_NAME[plan.policy]))}</p>
          <div className="onb-week">
            {plan.days.map((d, i) => (
              <div key={d} className="onb-wr">
                <span className="onb-wd">{t(DAYN[d])}</span>
                <span className="onb-wn">
                  <Icon name={glyphOf(plan.glyphs[i % plan.glyphs.length])} />
                  {plan.names[i % plan.names.length]}
                </span>
              </div>
            ))}
          </div>
          <div className="onb-note">
            <Icon name="info" />
            <span>{t('Nothing here is fixed — swap exercises, rename a day or change the rule any time in Plan.')}</span>
          </div>
        </>}
      </div>

      <div className="onb-foot">
        {step < STEPS - 1 && (
          <Button variant="primary" trailingIcon="chevronRight" onClick={next}>
            {step === 0 ? t('Get started') : t('Continue')}
          </Button>
        )}
        {step === STEPS - 1 && (trainsToday ? <>
          <Button variant="primary" icon="play" onClick={() => commit(true)}>{t("Start today's workout")}</Button>
          <div style={{ height: 8 }} />
          <Button variant="ghost" onClick={() => commit(false)}>{t('Later — take me to the app')}</Button>
        </> : <>
          <Button variant="primary" trailingIcon="chevronRight" onClick={() => commit(false)}>{t('Take me to the app')}</Button>
          <div className="onb-hint">{t('Today is a rest day — your first session is {0}.', t(DAYN[nextDay]))}</div>
        </>)}
      </div>
    </div>
  )
}
