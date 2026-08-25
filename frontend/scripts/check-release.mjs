// Release preflight.
//
//   node scripts/check-release.mjs
//
// Everything here is a rule that is cheap to break silently and expensive to
// discover on the Play Console: a version that drifted between three files, a
// target API below the store's floor, a permission that triggers a policy
// review, R8 quietly switched off. None of it is caught by the unit tests,
// because none of it is JavaScript.
//
// Exits non-zero on the first FAIL, so it can gate a release script or CI.

import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

// Google Play requires new apps and updates to target an API level released
// within the past year. API 36 (Android 16) became the floor on 31 Aug 2026.
const MIN_TARGET_SDK = 36

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })

// ---------------------------------------------------------------- versions --
const pkg = JSON.parse(read('package.json'))
const gradle = read('android/app/build.gradle')
const versionJs = read('src/lib/version.js')

const gradleName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1]
const gradleCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1])
const jsVersion = (versionJs.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1]

check('package.json / build.gradle versionName agree',
  pkg.version === gradleName, `package.json=${pkg.version} gradle=${gradleName}`)
check('src/lib/version.js agrees with build.gradle',
  jsVersion === gradleName, `version.js=${jsVersion} gradle=${gradleName}`)
check('versionCode is a positive integer', Number.isInteger(gradleCode) && gradleCode > 0,
  `versionCode=${gradleCode}`)

// ------------------------------------------------------------------- sdks ---
const variables = read('android/variables.gradle')
const targetSdk = Number((variables.match(/targetSdkVersion\s*=\s*(\d+)/) || [])[1])
const compileSdk = Number((variables.match(/compileSdkVersion\s*=\s*(\d+)/) || [])[1])
check(`targetSdkVersion >= ${MIN_TARGET_SDK} (Play requirement)`,
  targetSdk >= MIN_TARGET_SDK, `targetSdk=${targetSdk}`)
check('compileSdkVersion >= targetSdkVersion',
  compileSdk >= targetSdk, `compileSdk=${compileSdk} targetSdk=${targetSdk}`)

// ------------------------------------------------------------ permissions ---
const manifest = read('android/app/src/main/AndroidManifest.xml')
// Play restricts SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM to alarm-clock and
// calendar apps and requires a declaration form. A workout reminder does not
// qualify, and the notification plugin degrades to an inexact alarm without it.
for (const perm of ['SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) {
  const declared = new RegExp(`android:name="android\\.permission\\.${perm}"(?![^>]*tools:node="remove")`, 's')
  check(`${perm} is not requested`, !declared.test(manifest))
}
check('backup rules are declared for both transports',
  manifest.includes('android:fullBackupContent') && manifest.includes('android:dataExtractionRules'))
check('per-app language config is declared', manifest.includes('android:localeConfig'))

// -------------------------------------------------------------- hardening ---
check('R8 is enabled for release', /release\s*\{[^}]*minifyEnabled\s+true/s.test(gradle))
check('resource shrinking is enabled for release', /release\s*\{[^}]*shrinkResources\s+true/s.test(gradle))
check('release is signed with v1 as well (minSdk 23 predates v2)',
  /enableV1Signing\s+true/.test(gradle))

// --------------------------------------------------------------- identity ---
const cap = JSON.parse(read('capacitor.config.json'))
const appId = (gradle.match(/applicationId\s+"([^"]+)"/) || [])[1]
check('capacitor appId matches the gradle applicationId',
  cap.appId === appId, `capacitor=${cap.appId} gradle=${appId}`)
check('applicationId is not the upstream project id',
  !appId.startsWith('ch.duartesantos'), appId)
const strings = read('android/app/src/main/res/values/strings.xml')
check('strings.xml package_name matches the applicationId',
  strings.includes(`<string name="package_name">${appId}</string>`))

// ------------------------------------------------------------------ icons ---
for (const f of [
  'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
  'android/app/src/main/res/drawable/ic_launcher_foreground.xml',
  'android/app/src/main/res/drawable/ic_launcher_monochrome.xml',
]) check(`${f.split('/').pop()} exists`, existsSync(join(ROOT, f)))
check('adaptive icon declares a monochrome layer (Android 13 themed icons)',
  read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml').includes('<monochrome'))

// ------------------------------------------------------------------- i18n ---
const i18n = read('src/lib/i18n.js')
const langs = [...(i18n.match(/export const LANGS = \{([\s\S]*?)\}/) || [])[1]
  .matchAll(/(\w+):\s*'/g)].map(m => m[1])
const localeConfig = read('android/app/src/main/res/xml/locales_config.xml')
const missing = langs.filter(l => !localeConfig.includes(`android:name="${l}"`))
check('locales_config lists every language Settings offers', missing.length === 0,
  missing.length ? `missing: ${missing.join(', ')}` : '')
check('Indonesian locale pack is present', existsSync(join(ROOT, 'src/locales/id.js')))

// ---------------------------------------------------------------- licence ---
// The AGPL notices have to travel with the work, and the fork credit is not
// optional politeness.
const notice = read('../NOTICE.md')
check('NOTICE.md still credits the upstream copyright holder',
  notice.includes('Duarte Santos'))
check('LICENSE is still AGPL v3',
  read('../LICENSE').includes('GNU AFFERO GENERAL PUBLIC LICENSE'))
check('NOTICE.md still carries the exercise-dataset terms',
  notice.includes('exercises-dataset'))

// ------------------------------------------------------------------ report --
let failed = 0
for (const r of results) {
  if (!r.ok) failed++
  const mark = r.ok ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
