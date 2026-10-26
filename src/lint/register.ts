/**
 * The register lint protects treatment.
 *
 * It is build-time and deliberately stupid: no Chinese NLP, no model, no
 * cleverness. Predictable rules a person can argue with, over a hand written
 * string table.
 *
 * The validator (runtime) protects truth. These two are kept apart on purpose.
 */

export type RegisterRule = 'no-blame' | 'one-job' | 'no-performance'

export interface RegisterIssue {
  key: string
  rule: RegisterRule
  text: string
  detail: string
}

/** Person-as-subject. */
const PRONOUNS = ['你們', '妳們', '我們', '咱們', '你', '妳']

/**
 * Error predicates. Note what is NOT here: 偏左 / 偏右, which are directions,
 * not accusations.
 */
const ERROR_PREDICATES = [
  '走反',
  '走錯',
  '走偏',
  '走岔',
  '走歪',
  '跑錯',
  '轉錯',
  '弄錯',
  '搞錯',
  '迷路',
  '錯了',
  '反了',
  '錯過',
  '偏了',
]

/** How many characters before a predicate still count as "the subject of it". */
const SUBJECT_WINDOW = 3

const IMPERATIVE_CHARS = /[往走轉停按拿去問等掃]/

const SEGMENT_SPLIT = /[，,。；;！!？?\n]|\.(?=\s|$)/

const PERFORMANCE_PARTICLES = /[喔唷呢啦囉耶哦噢嘛]/

const EXCLAMATION = /[!！]/

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u

const TRIPLED = /(.)\1{2,}/

const SOOTHING = /(沒關係|別擔心|不要擔心|放心|不用怕|不要怕|別緊張|別怕)/

// English versions of the same rules. Phone keyboards type ’, so it is read as '.

/** "you" or "we" and an error word in the same clause; "your left" is not "you". */
const BLAME_EN = /\b(you|we)\b[\w\s']{0,20}?\b(wrong|lost|missed|off course)\b/i

const IMPERATIVE_EN = /^(go|turn|walk|stop|press|take|ask|wait|scan|head|keep|follow)\b/i

/** Words that join two jobs, read past to find the verb of the second. */
const JOINER_EN = /^((and|then|please)\s+)+/i

const PERFORMANCE_EN = /\b(oops|whoops|yay|hooray|great job|well done|awesome|uh-oh)\b/i

const SOOTHING_EN = /\b(don't worry|do not worry|no worries|it's ok(ay)?|it is ok(ay)?|relax|take it easy|no problem)\b/i

const english = (text: string) => text.replace(/’/g, "'")

/** Rejects "you went the wrong way" without rejecting "your left hand side". */
export function checkNoBlame(key: string, text: string): RegisterIssue[] {
  const issues: RegisterIssue[] = []
  for (const predicate of ERROR_PREDICATES) {
    let index = text.indexOf(predicate)
    while (index !== -1) {
      const window = text.slice(Math.max(0, index - SUBJECT_WINDOW), index)
      const subject = PRONOUNS.find((p) => window.endsWith(p))
      if (subject !== undefined) {
        issues.push({
          key,
          rule: 'no-blame',
          text,
          detail: `person-as-subject "${subject}" immediately before error predicate "${predicate}"`,
        })
        return issues
      }
      index = text.indexOf(predicate, index + 1)
    }
  }
  const blame = english(text).match(BLAME_EN)
  if (blame) {
    issues.push({ key, rule: 'no-blame', text, detail: `person-as-subject "${blame[1]}" with error word "${blame[2]}"` })
  }
  return issues
}

/** One guidance string may carry one job. */
export function checkOneJob(key: string, text: string): RegisterIssue[] {
  const stripped = text.replace(/請問/g, '')
  const segments = stripped.split(SEGMENT_SPLIT).filter((s) => s.trim().length > 0)
  const jobs = segments.filter(
    (s) => IMPERATIVE_CHARS.test(s) || IMPERATIVE_EN.test(s.trim().replace(JOINER_EN, '')),
  )
  if (jobs.length > 1) {
    return [
      {
        key,
        rule: 'one-job',
        text,
        detail: `${jobs.length} imperative segments in one string: ${jobs.map((j) => `"${j}"`).join(', ')}`,
      },
    ]
  }
  return []
}

/** No performance, no cheerfulness, no soothing mixed into an instruction. */
export function checkNoPerformance(key: string, text: string): RegisterIssue[] {
  const issues: RegisterIssue[] = []
  const add = (detail: string) => issues.push({ key, rule: 'no-performance', text, detail })
  if (PERFORMANCE_PARTICLES.test(text)) add('performative sentence-final particle')
  if (EXCLAMATION.test(text)) add('exclamation mark')
  if (EMOJI.test(text)) add('emoji')
  if (TRIPLED.test(text)) add('three or more repeated characters')
  if (SOOTHING.test(text) || SOOTHING_EN.test(english(text))) add('soothing phrase mixed into an instruction')
  if (PERFORMANCE_EN.test(text)) add('performative interjection')
  return issues
}

export function lintString(key: string, text: string): RegisterIssue[] {
  if (text.trim().length === 0) return []
  return [...checkNoBlame(key, text), ...checkOneJob(key, text), ...checkNoPerformance(key, text)]
}

export function lintStringTable(table: Record<string, string>): RegisterIssue[] {
  return Object.entries(table).flatMap(([key, text]) => lintString(key, text))
}

export function formatIssues(issues: RegisterIssue[]): string {
  return issues.map((i) => `${i.rule}  ${i.key}  「${i.text}」  — ${i.detail}`).join('\n')
}
