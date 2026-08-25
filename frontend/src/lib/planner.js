// Plan generator — turns four onboarding answers into a real weekly plan.
//
// Why generate rather than hand the newcomer the exercise library: the first
// session is where a training app is won or lost, and building a routine from
// 1,324 exercises is a research project, not a first run. The old first-run
// state offered one fixed Push/Pull/Legs plan built for a barbell gym, which is
// the wrong plan for most of the people who install a workout tracker — someone
// training at home with two dumbbells got a plan they could not perform, and
// someone doing calisthenics got one with no bodyweight progression at all.
//
// The answers are deliberately four, not a questionnaire:
//   goal      → which progression policy and which rep range
//   days      → which split (a 3-day and a 6-day week are different programs,
//                not the same program done more often)
//   equipment → which exercises can be selected at all
//   (unit and body weight are profile fields, not plan inputs)
//
// Every exercise id below is asserted against the dataset in planner.test.js, so
// an upstream dataset change breaks the test rather than shipping a plan with
// holes in it.

import { uid } from './format.js'

export const GOALS = ['muscle', 'strength', 'calisthenics', 'fitness']
export const EQUIP = ['gym', 'home', 'none']
export const DAY_OPTIONS = [2, 3, 4, 5, 6]

// Rest, in seconds, by the role the movement plays in the session.
const REST_COMPOUND = 180
const REST_ACCESSORY = 90

// Rep scheme and progression policy per goal. `strength` gets Greyskull because
// its AMRAP top set is what makes a low-rep linear program self-correcting;
// `muscle` gets double progression because adding a rep is a smaller jump than
// adding a plate and that is where hypertrophy volume comes from.
// `reps` is the TOP of the range for a double-progression goal, because that is
// what cfg.reps means to the policy — the number you are working up to — and
// `repsMin` is where each new weight restarts.
const GOAL_SPEC = {
  muscle:       { prog: 'double', reps: 12, repsMin: 8, sets: 3, compoundSets: 4 },
  strength:     { prog: 'greyskull', reps: 5, sets: 3, compoundSets: 3 },
  calisthenics: { prog: 'double', reps: 15, repsMin: 8, sets: 3, compoundSets: 4 },
  fitness:      { prog: 'linear', reps: 12, sets: 3, compoundSets: 3 },
}

// Movement pattern → the exercise to use at each equipment tier, best first.
// A tier falls back to the one below it, so "home" quietly borrows a bodyweight
// movement wherever two dumbbells cannot cover the pattern (there is no home
// vertical pull that is not a pull-up).
// `side: true` marks a unilateral movement, so the app shows the per-side split
// and steps the rep target in twos instead of landing on a number one leg cannot
// have. The dataset does not carry that flag, so it is set here.
const PATTERN = {
  squat:      { gym: '0043', home: '1760', none: '2368', none_side: 1 }, // barbell / goblet / split squats
  hinge:      { gym: '0032', home: '1459', none: '3013' },  // deadlift / db RDL / glute bridge
  hpush:      { gym: '0025', home: '0289', none: '0662' },  // bench / db bench / push-up
  hpushIncl:  { gym: '0047', home: '0314', none: '1311' },  // incline bench / db incline / wide push-up
  vpush:      { gym: '1457', home: '0405', none: '0279' },  // military press / db press / decline push-up
  hpull:      { gym: '0027', home: '0293', none: '0499' },  // barbell row / db row / inverted row
  vpull:      { gym: '0198', home: '0652', none: '0652' },  // lat pulldown / pull-up
  lunge:      { gym: '0336', home: '0336', none: '1460', side: 1 },  // db lunge / walking lunge
  legAcc:     { gym: '0739', home: '1760', none: '1685' },  // leg press / goblet / squat to reach
  calf:       { gym: '1372', home: '1373', none: '1373' },  // barbell / bodyweight calf raise
  lateral:    { gym: '0334', home: '0334', none: '3294' },  // db lateral raise / archer push-up
  curl:       { gym: '0294', home: '0294', none: '1326' },  // db curl / chin-up
  triceps:    { gym: '0241', home: '0814', none: '0814' },  // cable pushdown / triceps dip
  coreLower:  { gym: '0472', home: '0472', none: '0472' },  // hanging leg raise
  coreUpper:  { gym: '0274', home: '0274', none: '0274' },  // crunch floor
}

// Splits. Each entry is [routine name, glyph, [pattern, isCompound]…]; the
// weekday mapping lives alongside so a 4-day week lands on Mon/Tue/Thu/Fri
// rather than four days in a row.
const SPLITS = {
  2: {
    days: [1, 4],
    routines: [
      ['Full Body A', 'figureStrength', [['squat', 1], ['hpush', 1], ['hpull', 1], ['vpush', 0], ['coreLower', 0]]],
      ['Full Body B', 'figureStrength', [['hinge', 1], ['hpushIncl', 1], ['vpull', 1], ['lunge', 0], ['coreUpper', 0]]],
    ],
  },
  3: {
    days: [1, 3, 5],
    routines: [
      ['Full Body A', 'figureStrength', [['squat', 1], ['hpush', 1], ['hpull', 1], ['coreLower', 0]]],
      ['Full Body B', 'figureStrength', [['hinge', 1], ['vpush', 1], ['vpull', 1], ['coreUpper', 0]]],
      ['Full Body C', 'figureStrength', [['squat', 1], ['hpushIncl', 1], ['hpull', 1], ['lunge', 0], ['calf', 0]]],
    ],
  },
  4: {
    days: [1, 2, 4, 5],
    routines: [
      ['Upper A', 'arm',  [['hpush', 1], ['hpull', 1], ['vpush', 0], ['curl', 0], ['triceps', 0]]],
      ['Lower A', 'legs', [['squat', 1], ['hinge', 1], ['lunge', 0], ['calf', 0], ['coreLower', 0]]],
      ['Upper B', 'pullup', [['vpull', 1], ['hpushIncl', 1], ['hpull', 0], ['lateral', 0], ['curl', 0]]],
      ['Lower B', 'legs', [['hinge', 1], ['legAcc', 1], ['lunge', 0], ['calf', 0], ['coreUpper', 0]]],
    ],
  },
  5: {
    days: [1, 2, 3, 5, 6],
    routines: [
      ['Push', 'figureStrength', [['hpush', 1], ['vpush', 1], ['hpushIncl', 0], ['lateral', 0], ['triceps', 0]]],
      ['Pull', 'pullup', [['hpull', 1], ['vpull', 1], ['curl', 0], ['coreLower', 0]]],
      ['Legs', 'legs',   [['squat', 1], ['hinge', 1], ['lunge', 0], ['calf', 0]]],
      ['Upper', 'arm',   [['hpushIncl', 1], ['hpull', 1], ['lateral', 0], ['triceps', 0], ['curl', 0]]],
      ['Lower', 'legs',  [['legAcc', 1], ['hinge', 1], ['lunge', 0], ['coreUpper', 0]]],
    ],
  },
  6: {
    days: [1, 2, 3, 4, 5, 6],
    routines: [
      ['Push A', 'figureStrength', [['hpush', 1], ['vpush', 1], ['lateral', 0], ['triceps', 0]]],
      ['Pull A', 'pullup', [['hpull', 1], ['vpull', 1], ['curl', 0], ['coreLower', 0]]],
      ['Legs A', 'legs',   [['squat', 1], ['hinge', 1], ['calf', 0]]],
      ['Push B', 'figureStrength', [['hpushIncl', 1], ['vpush', 1], ['lateral', 0], ['triceps', 0]]],
      ['Pull B', 'pullup', [['vpull', 1], ['hpull', 1], ['curl', 0], ['coreUpper', 0]]],
      ['Legs B', 'legs',   [['legAcc', 1], ['lunge', 1], ['calf', 0]]],
    ],
  },
}

// A pattern's exercise at the requested tier, falling through to the tiers below
// it. Ordered strongest-kit-first so the fallback only ever loosens.
// `home` and `none` fall through downwards only — a dumbbell plan may borrow a
// bodyweight movement where two dumbbells cannot cover the pattern, but must
// never borrow the barbell one, which is the whole point of the answer.
const TIERS = { gym: ['gym', 'home', 'none'], home: ['home', 'none'], none: ['none'] }
function pick(pattern, equip) {
  const row = PATTERN[pattern]
  if (!row) return null
  for (const tier of (TIERS[equip] || TIERS.gym)) {
    if (row[tier]) return { id: row[tier], side: !!(row[tier + '_side'] || row.side) }
  }
  return null
}

function dedupe(list) {
  const seen = new Set()
  return list.filter(cfg => {
    if (!cfg || seen.has(cfg.id)) return false
    seen.add(cfg.id)
    return true
  })
}

/**
 * Build the routines and the weekday map for a set of onboarding answers.
 * Returns { routines, week } — ready to be dropped straight into state.
 */
export function buildPlan({ goal = 'muscle', days = 3, equipment = 'gym' } = {}) {
  const spec = GOAL_SPEC[goal] || GOAL_SPEC.muscle
  const split = SPLITS[days] || SPLITS[3]

  const routines = split.routines.map(([name, emoji, items]) => ({
    id: uid(),
    name,
    emoji,
    // The policy is set on the routine, so every exercise in it follows one rule
    // and a single change in Plan re-aims the whole day.
    prog: spec.prog,
    // A routine must never list the same exercise twice. It can happen honestly:
    // at the bodyweight tier several patterns collapse onto the movement that
    // covers them, and two of those can land in one day. Dropping the later slot
    // leaves a shorter routine, which is the correct outcome — a second identical
    // block of push-ups is not extra training, it is a bug that looks like one.
    ex: dedupe(items.map(([pattern, compound]) => {
      const hit = pick(pattern, equipment)
      if (!hit) return null
      const cfg = {
        id: hit.id,
        sets: compound ? spec.compoundSets : spec.sets,
        // A generated plan should not leave rest as one number for the whole app.
        // A heavy compound wants three minutes; a lateral raise does not, and
        // making someone wait it out is how a 45-minute session becomes 75.
        rest: compound ? REST_COMPOUND : REST_ACCESSORY,
        // Unilateral work is logged as the total across both sides, so its
        // target has to be even and roughly double.
        reps: hit.side ? Math.round(spec.reps) * 2 : spec.reps,
        weight: 0,
      }
      if (hit.side) cfg.side = true
      // Double progression needs the bottom of its range, or every new weight
      // restarts two reps below the top instead of where the goal wants it.
      if (spec.prog === 'double') {
        cfg.repsMin = Math.min(hit.side ? spec.repsMin * 2 : spec.repsMin, cfg.reps)
      }
      return cfg
    })),
  }))

  const week = {}
  split.days.forEach((d, i) => { week[d] = routines[i % routines.length].id })
  return { routines, week }
}

// Human-readable summary for the last onboarding screen, so the plan is not a
// surprise the first time it opens.
export function describePlan({ goal, days, equipment }) {
  const split = SPLITS[days] || SPLITS[3]
  return {
    routineCount: split.routines.length,
    dayCount: split.days.length,
    names: split.routines.map(r => r[0]),
    glyphs: split.routines.map(r => r[1]),
    days: split.days,
    policy: (GOAL_SPEC[goal] || GOAL_SPEC.muscle).prog,
    equipment,
  }
}
