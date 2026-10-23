export const meta = {
  name: 'laminar-review-judge',
  description: 'Laminar Code Review: screen the abstractions a prepared run folder holds, then judge one abstraction, design relation, boundary path, application or end method per call and return the possible findings',
  phases: [
    { title: 'Screen', detail: 'one agent per batch of abstractions answers the presence questions, and the workflow reads the answers against the checks each code under review holds; beside it, one agent writes the I/O rules from the summary of the end calls by type and module, one more call answers the groups of the summary that hold an end call no rule covers, where there are any, and the workflow applies the rules to every end call; no presence screen runs where no code under review holds a check it gates, and no I/O screen runs where the script listed no end call or the cache holds the rules' },
    { title: 'Judge', detail: 'one agent per abstraction and judge type reads its own file of the code under review and returns the findings of that abstraction, the 4 design judges each read 1 relation of 2 or more abstractions per call, the entry boundary judge reads the entry boundaries of 1 schema type or 1 controller with their callers in other applications per call, the boundary judge reads 1 changed abstraction with the entry methods that reach it and the calls between them per call, and the test plan call returns the paths a test already covers beside them; a call with no check a screen gates starts beside the screens, the others wait for the presence answers, and the I/O paths judge waits for the I/O rules and runs once for each end method that holds an end call a rule marks io' },
  ],
}

const PLUGIN = 'laminar'
const DEFAULT_BATCH = 1
const JUDGE_ATTEMPTS = 3
const MAX_PROMPT_BYTES = 20000
const JUDGE_STALL_MS = 600000

const ROLES = {
  SCREEN: 'screen',
  SCREEN_PRESENCE: 'screen-presence',
  SCREEN_IO: 'screen-io',
  JUDGE: 'judge',
}

const IO_PATHS_JUDGE = 'judge-performance-io-paths'

const DEFAULT_MODELS = {
  'screen-presence': 'sonnet',
  'screen-io': 'sonnet',
  'judge-simplicity-variable': 'sonnet',
  'judge-simplicity-method': 'sonnet',
  'judge-simplicity-class': 'sonnet',
  'judge-simplicity-module': 'sonnet',
  'judge-design-over-extraction': 'sonnet',
  'judge-design-scoped-parameters': 'sonnet',
  'judge-design-leaked-details': 'sonnet',
  'judge-design-entry-boundary': 'sonnet',
  'judge-design-missing-boundary': 'sonnet',
  'judge-correctness-prevention': 'sonnet',
  'judge-correctness-validate-at-the-boundary': 'sonnet',
  'judge-correctness-simplicity-test-method': 'sonnet',
  'judge-correctness-test-plan': 'sonnet',
  'judge-performance-abstraction': 'sonnet',
  'judge-performance-io-paths': 'sonnet',
  'judge-simplicity-decision': 'sonnet',
  'judge-simplicity-comment': 'sonnet',
}

const DEFAULT_EFFORT = {
  'screen-presence': 'low',
  'screen-io': 'low',
  'judge-simplicity-variable': 'medium',
  'judge-simplicity-method': 'low',
  'judge-simplicity-class': 'high',
  'judge-simplicity-module': 'low',
  'judge-design-over-extraction': 'low',
  'judge-design-scoped-parameters': 'low',
  'judge-design-leaked-details': 'low',
  'judge-design-entry-boundary': 'low',
  'judge-design-missing-boundary': 'low',
  'judge-correctness-prevention': 'low',
  'judge-correctness-validate-at-the-boundary': 'low',
  'judge-correctness-simplicity-test-method': 'low',
  'judge-correctness-test-plan': 'medium',
  'judge-performance-abstraction': 'low',
  'judge-performance-io-paths': 'low',
  'judge-simplicity-decision': 'low',
  'judge-simplicity-comment': 'low',
}

const NO_JUDGE_REACHED_IT = 'the judge call returned nothing'

const NO_END_CALL_IS_IO = 'the I/O rules marked no end call of this end method io'

const NO_RULE_ANSWERED_IT = 'no rule answered an end call of this end method and no end call of it is io, so it is listed as unknown'

const THE_FIELD_AN_IO_SCREEN_CLOSES = 'callsOutsideProcess'

const RULE_ANSWERS = { IO: 'io', NOT_IO: 'not_io' }

const MIN_LITERAL_PREFIX = 2

const SCREEN_FIELDS = [
  'repeatsWork', 'callsOutsideProcess', 'createsReusableResource', 'changesStateBeyondTheCall',
  'encodesCaseAsPrimitiveOrFallback', 'signalsFailureAsValueOrError', 'recoversFromFailureInPlace',
  'namesMechanism', 'decidesBusinessRule',
]

const FIELDS_ONLY_A_RELATION_ANSWERS = ['namesMechanism', 'decidesBusinessRule']

const THE_FIELD_SHOWN_ONLY_WHERE_ANSWERED = 'decidesBusinessRule'

const shownScreenFields = answer => SCREEN_FIELDS.filter(field => field !== THE_FIELD_SHOWN_ONLY_WHERE_ANSWERED || answer[field] !== undefined)

const THE_ID = '{id}'
const THE_JUDGE_TYPE = '{judgeType}'

const forward = given => String(given == null ? '' : given).replace(/\\/g, '/')

const ID_MARKS = { CODE_UNDER_REVIEW: 'U', ABSTRACTION: 'A', END_METHOD: 'E', SCREEN_BATCH: 'B' }

const SCREEN_BATCH_FILE_FORM = 'screen-batches/{number}.json'

const abstractionIdOf = given => {
  if (typeof given === 'number') return given > 0 ? `${ID_MARKS.ABSTRACTION}${given}` : null
  return given
}

const toCodeUnderReview = (fields, compact, fileForm) => {
  const [number, abstraction, judgeTypeAt, checkSetAt, gate] = fields
  const id = `${ID_MARKS.CODE_UNDER_REVIEW}${number}`
  const judgeType = compact.judgeTypes[judgeTypeAt]
  return { id, abstractionId: abstractionIdOf(abstraction), judgeType, checks: compact.checkSets[checkSetAt], screened: Boolean(gate), ...(gate ? { gate } : {}), file: fileForm.replace(THE_ID, id).replace(THE_JUDGE_TYPE, judgeType) }
}

const toScreenBatch = (abstractions, index) => ({
  id: `${ID_MARKS.SCREEN_BATCH}${index + 1}`,
  file: SCREEN_BATCH_FILE_FORM.replace('{number}', String(index + 1)),
  abstractions,
})

const toIoPath = ([number, endNumber, endCallCount]) => {
  const endMethod = `${ID_MARKS.END_METHOD}${endNumber}`
  return {
    id: `${ID_MARKS.CODE_UNDER_REVIEW}${number}`,
    endMethod,
    endCalls: Array.from({ length: endCallCount }, (unused, at) => `${endMethod}.${at + 1}`),
  }
}

const hashTheMessageTail = text => {
  let first = 0xdeadbeef
  let second = 0x41c6ce57
  for (let at = 0; at < text.length; at++) {
    const code = text.charCodeAt(at)
    first = Math.imul(first ^ code, 2654435761)
    second = Math.imul(second ^ code, 1597334677)
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909)
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909)
  return (4294967296 * (2097151 & second) + (first >>> 0)).toString(36)
}

const isInsideTheIntervals = (intervals, id) => {
  const number = Number(String(id).slice(ID_MARKS.CODE_UNDER_REVIEW.length))
  return intervals.some(([from, to]) => number >= from && number <= to)
}

class WorkflowArguments {
  constructor(given) {
    const fields = given || {}
    this.runFolder = forward(fields.prepared?.runFolder || fields.runFolder || '')
    this.prepared = fields.prepared || {}
    this.batch = Number(fields.batch) > 0 ? Math.floor(Number(fields.batch)) : DEFAULT_BATCH
    this.models = fields.models || {}
    this.effort = fields.effort || {}
    this.waveNumber = Number(fields.wave) > 0 ? Math.floor(Number(fields.wave)) : null
  }

  get waves() {
    return this.prepared.waves || []
  }

  get wave() {
    if (this.waveNumber === null) return null
    return this.waves.find(wave => wave.number === this.waveNumber) || null
  }

  get codeUnderReview() {
    const fileForm = forward(this.prepared.fileForm)
    const compact = this.prepared.codeUnderReview || {}
    const every = (compact.list || []).map(fields => toCodeUnderReview(fields, compact, fileForm))
    return this.wave ? every.filter(code => isInsideTheIntervals(this.wave.codeUnderReview, code.id)) : every
  }

  get screenBatches() {
    const every = (this.prepared.screenBatches || []).map(toScreenBatch)
    if (!this.wave) return every
    const needed = new Set(this.wave.screenBatches.map(number => `${ID_MARKS.SCREEN_BATCH}${number}`))
    return every.filter(batch => needed.has(batch.id))
  }

  get gate() {
    return this.prepared.gate || {}
  }

  get checkNames() {
    return this.prepared.checkNames || {}
  }

  get ioPaths() {
    return new Map((this.prepared.ioPaths || []).map(toIoPath).map(ioPath => [ioPath.id, ioPath]))
  }

  get ioRuleScreenCall() {
    if (this.wave && !this.wave.ioRules) return null
    return this.prepared.ioRuleScreenCall || null
  }

  get ioCachedRules() {
    return this.prepared.ioCachedRules || null
  }

  get ioGroups() {
    return this.prepared.ioGroups || []
  }

  savedTailsOf(codeUnderReviewId) {
    return (this.prepared.judgeCache || {})[codeUnderReviewId] || []
  }

  fileAt(relative) { return `${this.runFolder}/${relative}` }
}

class Agents {
  constructor(given) {
    this.models = given.models || {}
    this.effort = given.effort || {}
  }

  typeOf(role) { return `${PLUGIN}:review-${role}` }

  settingFor(defaults, given, role) {
    const group = [ROLES.JUDGE, ROLES.SCREEN].find(word => role.startsWith(`${word}-`)) || role
    return given[role] || given[group] || defaults[role]
  }

  optionsFor(role, extra) {
    return {
      ...extra,
      agentType: this.typeOf(role),
      model: this.settingFor(DEFAULT_MODELS, this.models, role),
      effort: this.settingFor(DEFAULT_EFFORT, this.effort, role),
    }
  }
}

class Step {
  constructor(name, phaseTitle, role, returnIds) {
    this.name = name
    this.phase = phaseTitle
    this.role = role
    this.returnIds = returnIds
  }

  missingFrom(returned) {
    if (!returned) return this.returnIds
    return this.returnIds.filter(id => returned[id] === undefined || returned[id] === '')
  }
}

const STEPS = {
  screen: new Step('screen', 'Screen', ROLES.SCREEN_PRESENCE, ['answers']),
  ioRules: new Step('ioRules', 'Screen', ROLES.SCREEN_IO, ['rules']),
  judge: new Step('judge', 'Judge', ROLES.JUDGE, ['findings']),
}

const STRINGS = { type: 'array', items: { type: 'string' } }

const SCREEN_ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    abstractionId: { type: 'string' },
    repeatsWork: { type: 'boolean' },
    callsOutsideProcess: { type: 'boolean' },
    createsReusableResource: { type: 'boolean' },
    changesStateBeyondTheCall: { type: 'boolean' },
    encodesCaseAsPrimitiveOrFallback: { type: 'boolean' },
    signalsFailureAsValueOrError: { type: 'boolean' },
    recoversFromFailureInPlace: { type: 'boolean' },
    namesMechanism: { type: 'boolean' },
    decidesBusinessRule: { type: 'boolean' },
  },
  required: ['abstractionId', ...SCREEN_FIELDS.filter(field => !FIELDS_ONLY_A_RELATION_ANSWERS.includes(field))],
}

const SCREEN_SCHEMA = {
  type: 'object',
  properties: { answers: { type: 'array', items: SCREEN_ANSWER_SCHEMA } },
  required: ['answers'],
}

const AN_IO_RULE = {
  type: 'object',
  properties: { on: { type: 'string' }, callee: STRINGS, answer: { type: 'string', enum: [RULE_ANSWERS.IO, RULE_ANSWERS.NOT_IO] } },
  required: ['on', 'callee', 'answer'],
}

const IO_RULES_SCHEMA = {
  type: 'object',
  properties: { rules: { type: 'array', items: AN_IO_RULE } },
  required: ['rules'],
}

const NAMED_LINES = {
  type: 'object',
  properties: { file: { type: 'string' }, lines: { type: 'array', items: { type: 'integer' } } },
  required: ['file', 'lines'],
}

const A_NAMED_PLACE = {
  type: 'object',
  properties: { file: { type: 'string' }, lines: { type: 'array', items: { type: 'integer' } } },
  required: ['file'],
}

const A_PLACE_READING = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    lines: { type: 'array', items: { type: 'integer' } },
    sameDecision: { type: 'boolean' },
  },
  required: ['file', 'sameDecision'],
}

const A_SECOND_PLACE = {
  type: 'object',
  properties: { file: { type: 'string' }, line: { type: 'integer' }, displayName: { type: 'string' }, quote: { type: 'string' } },
  required: ['file', 'line', 'displayName'],
}

const A_TEXT = { type: 'string' }

const A_LINE = {
  type: 'object',
  properties: { file: { type: 'string' }, line: { type: 'integer' } },
  required: ['file', 'line'],
}

const A_BRANCH_OUTCOME = {
  type: 'object',
  properties: { file: { type: 'string' }, line: { type: 'integer' }, outcome: A_TEXT },
  required: ['file', 'line', 'outcome'],
}

const CHECKS_BY_JUDGE_TYPE = {
  'judge-simplicity-variable': ['S2'],
  'judge-simplicity-method': ['S2', 'S5', 'S6'],
  'judge-simplicity-class': ['S2', 'S5'],
  'judge-simplicity-module': ['S2', 'S5'],
  'judge-design-over-extraction': ['D1'],
  'judge-design-scoped-parameters': ['D2'],
  'judge-design-leaked-details': ['D3'],
  'judge-design-entry-boundary': ['S1', 'CP1', 'D3'],
  'judge-design-missing-boundary': ['D4'],
  'judge-correctness-prevention': ['CP1', 'CP3', 'CP4', 'CP5', 'CP7'],
  'judge-correctness-validate-at-the-boundary': ['CP6'],
  'judge-correctness-simplicity-test-method': ['S2', 'S4', 'S5', 'CD2'],
  'judge-correctness-test-plan': ['CD4', 'CD5', 'CD6', 'CD7'],
  'judge-performance-abstraction': ['P2', 'P3', 'P4'],
  'judge-performance-io-paths': ['P1', 'P2'],
  'judge-simplicity-decision': ['S1'],
  'judge-simplicity-comment': ['S2', 'S5'],
}

const THE_FIELDS_EVERY_JUDGE_WRITES = {
  check: A_TEXT,
  evidence: { type: 'array', items: NAMED_LINES },
  summary: A_TEXT,
  confidence: { type: 'string', enum: ['high', 'moderate', 'low'] },
  whatWouldConfirm: A_TEXT,
  inChange: { type: 'boolean' },
}

const THE_FIELDS_EVERY_JUDGE_MUST_FILL = ['check', 'evidence', 'summary', 'confidence']

const findingOf = (own, mustFill) => ({
  type: 'object',
  properties: { ...THE_FIELDS_EVERY_JUDGE_WRITES, ...own },
  required: [...THE_FIELDS_EVERY_JUDGE_MUST_FILL, ...(mustFill || [])],
})

const THE_PREDICTION = { prediction: A_TEXT, found: A_TEXT }

const THE_QUESTION_TO_THE_AUTHOR = { consider: A_TEXT }

const THE_BELONGING_ANSWERS = { belongingAnswers: STRINGS }

const judgeSchemaOf = finding => ({
  type: 'object',
  properties: { findings: { type: 'array', items: finding } },
  required: ['findings'],
})

const A_TEST_PLAN_ITEM = findingOf({
  abstractionPlace: A_LINE,
  entry: A_LINE,
  exit: A_LINE,
  outcome: A_TEXT,
  branches: { type: 'array', items: A_BRANCH_OUTCOME },
  input: A_TEXT,
  takenBy: { type: 'array', items: A_LINE },
  unverified: A_TEXT,
}, ['abstractionPlace'])

const A_COVERED_PATH = {
  type: 'object',
  properties: { abstractionPlace: A_LINE, test: A_LINE, outcome: A_TEXT },
  required: ['abstractionPlace', 'test', 'outcome'],
}

const TEST_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: A_TEST_PLAN_ITEM },
    covered: { type: 'array', items: A_COVERED_PATH },
  },
  required: ['findings', 'covered'],
}

const SCHEMA_OF_ANY_CHECK_BY_JUDGE_TYPE = {
  'judge-simplicity-variable': judgeSchemaOf(findingOf({ ...THE_PREDICTION, established: A_TEXT, field: A_TEXT }, ['prediction', 'found'])),
  'judge-simplicity-method': judgeSchemaOf(findingOf({ ...THE_PREDICTION, ...THE_BELONGING_ANSWERS, ...THE_QUESTION_TO_THE_AUTHOR, established: A_TEXT })),
  'judge-simplicity-class': judgeSchemaOf(findingOf({ ...THE_PREDICTION, ...THE_BELONGING_ANSWERS, established: A_TEXT })),
  'judge-simplicity-module': judgeSchemaOf({
    type: 'object',
    properties: {
      ...THE_FIELDS_EVERY_JUDGE_WRITES,
      evidence: { type: 'array', items: A_NAMED_PLACE },
      ...THE_PREDICTION,
      ...THE_BELONGING_ANSWERS,
      boundary: A_TEXT,
      established: A_TEXT,
      count: A_TEXT,
    },
    required: THE_FIELDS_EVERY_JUDGE_MUST_FILL,
  }),
  'judge-design-over-extraction': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alsoAt: { type: 'array', items: A_SECOND_PLACE } })),
  'judge-design-scoped-parameters': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alsoAt: { type: 'array', items: A_SECOND_PLACE } })),
  'judge-design-leaked-details': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alsoAt: { type: 'array', items: A_SECOND_PLACE } })),
  'judge-design-entry-boundary': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alsoAt: { type: 'array', items: A_SECOND_PLACE }, ...THE_QUESTION_TO_THE_AUTHOR })),
  'judge-design-missing-boundary': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alsoAt: { type: 'array', items: A_SECOND_PLACE }, ...THE_BELONGING_ANSWERS })),
  'judge-correctness-prevention': judgeSchemaOf(findingOf({ decision: A_TEXT, established: A_TEXT, alsoAt: { type: 'array', items: A_SECOND_PLACE } }, ['decision'])),
  'judge-correctness-validate-at-the-boundary': judgeSchemaOf(findingOf({ alsoAt: { type: 'array', items: A_SECOND_PLACE } }, ['alsoAt'])),
  'judge-correctness-simplicity-test-method': judgeSchemaOf(findingOf({ ...THE_PREDICTION, ...THE_BELONGING_ANSWERS, established: A_TEXT })),
  'judge-correctness-test-plan': TEST_PLAN_SCHEMA,
  'judge-performance-abstraction': judgeSchemaOf(findingOf({ alternative: A_TEXT }, ['alternative'])),
  'judge-performance-io-paths': judgeSchemaOf(findingOf({ abstractionPlace: A_LINE, alternative: A_TEXT }, ['alternative'])),
  'judge-simplicity-decision': judgeSchemaOf(findingOf({
    places: { type: 'array', items: A_PLACE_READING },
    placesLeftUnopened: { type: 'boolean' },
    fact: A_TEXT,
    mechanism: A_TEXT,
    ...THE_QUESTION_TO_THE_AUTHOR,
  }, ['places', 'fact'])),
  'judge-simplicity-comment': judgeSchemaOf(findingOf({ ...THE_PREDICTION })),
}

const answeringOnlyTheChecksOf = (judgeType, schema) => {
  const findings = schema.properties.findings
  const check = { type: 'string', enum: CHECKS_BY_JUDGE_TYPE[judgeType] }
  const finding = { ...findings.items, properties: { ...findings.items.properties, check } }
  return { ...schema, properties: { ...schema.properties, findings: { ...findings, items: finding } } }
}

const SCHEMA_BY_JUDGE_TYPE = Object.fromEntries(Object.entries(SCHEMA_OF_ANY_CHECK_BY_JUDGE_TYPE)
  .map(([judgeType, schema]) => [judgeType, answeringOnlyTheChecksOf(judgeType, schema)]))

const sized = (prompt, label) => {
  if (prompt.length > MAX_PROMPT_BYTES) log(`the ${label} prompt is ${prompt.length} bytes, over the ${MAX_PROMPT_BYTES} byte bar`)
  return prompt
}

const NO_IO_SCREEN = { rules: [], unknown: [] }

const NO_JUDGE_CACHE_USE = { hits: [], fresh: [] }

const NOTHING_JUDGED = { findings: [], covered: [], notRun: [], counts: { judgeCalls: 0, cachedJudgeCalls: 0, emptied: 0, findings: 0, notRun: 0 }, ioScreen: NO_IO_SCREEN, judgeCache: NO_JUDGE_CACHE_USE }

const stoppedWith = words => ({ ...NOTHING_JUDGED, stopped: words })

const PREPARE_RETURN_WORKFLOW_FILE = 'prepare-return.workflow.js'

let unloadedReturn = null

async function loadPreparedOf(given) {
  const fields = given || {}
  if (fields.prepared || !fields.runFolder) return fields.prepared
  const scriptPath = `${forward(fields.runFolder)}/${PREPARE_RETURN_WORKFLOW_FILE}`
  try {
    return await workflow({ scriptPath })
  } catch (error) {
    log(`the run folder gave no prepare return: ${error.message}`)
    unloadedReturn = error.message
    return null
  }
}

const theArguments = new WorkflowArguments({ ...(args || {}), prepared: await loadPreparedOf(args) })
const theAgents = new Agents(theArguments)

if (unloadedReturn) return stoppedWith(`the call did not run: ${PREPARE_RETURN_WORKFLOW_FILE} could not be loaded (${unloadedReturn}): where the file is missing, run the prepare command again; where another workflow calls this one, call it at the top level instead, because a workflow that another workflow calls cannot load the file, or pass prepared`)

if (!theArguments.runFolder) return stoppedWith('the call did not run: it needs the run folder the prepare command wrote')

if (theArguments.waveNumber === null && theArguments.waves.length > 1) return stoppedWith(`the call did not run: prepared plans ${theArguments.waves.length} waves, so make 1 call per wave with wave 1 to ${theArguments.waves.length}`)

if (theArguments.waveNumber !== null && !theArguments.wave) return stoppedWith(`the call did not run: prepared plans no wave ${theArguments.waveNumber}`)

if (!theArguments.codeUnderReview.length && (theArguments.prepared.counts || {}).codeUnderReview === 0) {
  log('prepare found no code under review, so no judge ran')
  return NOTHING_JUDGED
}

if (!theArguments.codeUnderReview.length) {
  log(`the call carries no code under review, so no judge ran; run the prepare command again, which writes ${PREPARE_RETURN_WORKFLOW_FILE}`)
  return stoppedWith('the call did not run: prepared names no code under review')
}

if (theArguments.wave) log(`wave ${theArguments.wave.number} of ${theArguments.waves.length}, up to ${theArguments.wave.agentCalls} agent call(s)`)
log(`${theArguments.codeUnderReview.length} abstraction(s) under review over ${theArguments.screenBatches.length} screen batch(es)`)

const opening = codeUnderReviewByGate()
const ungatedJudgeCalls = judgeCallsOf(opening.ungated)
log(`${ungatedJudgeCalls.length} judge call(s) hold no check the screen gates, so they start beside the screen`)

let judgePhaseEntered = false
phase(openingPhase())
const [ungatedJudged, gatedRun, ioPathsRun] = await parallel([
  () => parallel(ungatedJudgeCalls.map(judgeCall => () => judgeOf(judgeCall))),
  () => screenedThenJudged(opening.gated),
  () => ioScreenedThenJudged(opening.ioPaths),
])

const everyJudgeCall = [...ungatedJudgeCalls, ...gatedRun.judgeCalls, ...ioPathsRun.judgeCalls]
const answered = [...ungatedJudged, ...gatedRun.judged, ...ioPathsRun.judged].filter(Boolean)
const findings = answered.flatMap(returned => returned.findings)
const covered = answered.flatMap(returned => returned.covered)
const notRun = [...gatedRun.narrowed.notRun, ...ioPathsRun.notRun, ...answered.flatMap(returned => returned.notRun)]
const judgeCache = {
  hits: answered.flatMap(returned => returned.cacheHit ? [returned.cacheHit] : []),
  fresh: answered.flatMap(returned => returned.cacheFresh ? [returned.cacheFresh] : []),
}
if (judgeCache.hits.length) log(`${judgeCache.hits.length} judge call(s) answered from the saved judge returns, so no agent ran for them`)
return {
  ...(theArguments.wave ? { wave: theArguments.wave.number } : {}),
  findings,
  covered,
  notRun,
  counts: { judgeCalls: everyJudgeCall.length, cachedJudgeCalls: judgeCache.hits.length, emptied: gatedRun.narrowed.emptied, findings: findings.length, notRun: notRun.length },
  ioScreen: ioPathsRun.ioScreen,
  judgeCache,
}

function gateFieldsOf(code, check) {
  return (code.gate && code.gate[check]) || theArguments.gate[check] || []
}

function isAnIoPathsCodeUnderReview(code) {
  return code.judgeType === IO_PATHS_JUDGE
}

function codeUnderReviewByGate() {
  const everyCodeUnderReview = theArguments.codeUnderReview.filter(code => !isAnIoPathsCodeUnderReview(code))
  return {
    ungated: everyCodeUnderReview.filter(code => !code.screened).map(code => ({ ...code, live: code.checks, answer: null })),
    gated: everyCodeUnderReview.filter(code => code.screened),
    ioPaths: theArguments.codeUnderReview.filter(isAnIoPathsCodeUnderReview),
  }
}

function openingPhase() {
  if (!opening.gated.length) log('no code under review holds a check the screen gates, so no screen runs')
  const ioScreenRuns = Boolean(theArguments.ioRuleScreenCall)
  if (!ioScreenRuns) log('the script listed no end call, or the cache holds the I/O rules, so no I/O screen runs')
  if (opening.gated.length || ioScreenRuns) return STEPS.screen.phase
  judgePhaseEntered = true
  return STEPS.judge.phase
}

function enterTheJudgePhase() {
  if (judgePhaseEntered) return
  judgePhaseEntered = true
  phase(STEPS.judge.phase)
}

function nothingGated() {
  return { judgeCalls: [], judged: [], narrowed: { open: [], notRun: [], emptied: 0 } }
}

async function screenedThenJudged(gatedCodeUnderReview) {
  if (!gatedCodeUnderReview.length) return nothingGated()
  const screenAnswers = await screened()
  const narrowed = narrowByTheScreenAnswers(gatedCodeUnderReview, screenAnswers)
  const judgeCalls = judgeCallsOf(narrowed.open)
  log(`${ungatedJudgeCalls.length + judgeCalls.length} judge call(s), ${narrowed.emptied} abstraction(s) the screen emptied, ${narrowed.notRun.length} check(s) the screen closed`)
  enterTheJudgePhase()
  const judged = await parallel(judgeCalls.map(judgeCall => () => judgeOf(judgeCall)))
  return { judgeCalls, judged, narrowed }
}

function narrowByTheScreenAnswers(gatedCodeUnderReview, screenAnswers) {
  const byAbstraction = new Map(screenAnswers.map(answer => [answer.abstractionId, answer]))
  const open = []
  const notRun = []
  let emptied = 0
  for (const code of gatedCodeUnderReview) {
    const answer = byAbstraction.get(code.abstractionId) || null
    const live = []
    for (const check of code.checks) {
      const closingGateField = answer ? gateFieldsOf(code, check).find(field => answer[field] !== true) : ''
      if (closingGateField) notRun.push({ codeUnderReviewId: code.id, check, field: closingGateField })
      else live.push(check)
    }
    if (live.length) open.push({ ...code, live, answer })
    else emptied++
  }
  return { open, notRun, emptied }
}

function checkWithItsName(check) {
  return [check, theArguments.checkNames[check]].filter(Boolean).join(' ')
}

function messageOf(code) {
  const lines = [theArguments.fileAt(code.file), `Checks to answer: ${code.live.map(checkWithItsName).join(', ')}`]
  if (code.answer) lines.push(`Screen answers: ${shownScreenFields(code.answer).map(field => `${field} ${code.answer[field] === true}`).join(', ')}`)
  if (code.ioEnds) lines.push(`I/O ends: ${code.ioEnds.join(', ')}`)
  return lines.join('\n')
}

async function ioScreenedThenJudged(ioPathsCodeUnderReview) {
  const written = await ioRulesWritten()
  const byRules = ruleAnswersOfGroups(written.rules, theArguments.ioGroups)
  const open = []
  const notRun = []
  const unknown = []
  for (const code of ioPathsCodeUnderReview) {
    const endMethod = theArguments.ioPaths.get(code.id) || {}
    const endCalls = endMethod.endCalls || []
    const ioEnds = endCalls.filter(id => byRules.answered.get(id) === RULE_ANSWERS.IO)
    if (ioEnds.length) {
      open.push({ ...code, live: code.checks, answer: null, ioEnds })
      continue
    }
    const unanswered = endCalls.filter(id => !byRules.answered.has(id))
    if (unanswered.length) unknown.push({ endMethod: endMethod.endMethod, endCalls: unanswered })
    const reason = unanswered.length ? NO_RULE_ANSWERED_IT : NO_END_CALL_IS_IO
    notRun.push(...code.checks.map(check => ({ codeUnderReviewId: code.id, check, field: THE_FIELD_AN_IO_SCREEN_CLOSES, reason })))
  }
  if (ioPathsCodeUnderReview.length) log(`${open.length} I/O paths call(s), 1 per end method with an io end call; ${unknown.length} unknown end method(s); ${ioPathsCodeUnderReview.length - open.length - unknown.length} end method(s) with no io end call`)
  const judgeCalls = judgeCallsOf(open)
  if (judgeCalls.length) enterTheJudgePhase()
  const judged = await parallel(judgeCalls.map(judgeCall => () => judgeOf(judgeCall)))
  return { judgeCalls, judged, notRun, ioScreen: { rules: written.fresh ? written.rules : [], unknown } }
}

async function ioRulesWritten() {
  if (theArguments.ioCachedRules) return { rules: usableRulesOf(theArguments.ioCachedRules), fresh: false }
  const ioRuleScreenCall = theArguments.ioRuleScreenCall
  if (!ioRuleScreenCall) return { rules: [], fresh: false }
  const rules = await rulesOfAnIoRuleScreenCall(ioRuleScreenCall, 'screen-io rules', '')
  if (!rules) {
    log('the I/O rule screen call returned nothing, so no rule covers an end call')
    return { rules: [], fresh: false }
  }
  const uncovered = groupsWithAnEndCallNoRuleCovers(rules, theArguments.ioGroups)
  if (!uncovered.length) return { rules, fresh: true }
  log(`${uncovered.length} group(s) of the I/O summary hold an end call no rule covers, so 1 more I/O rule screen call answers them`)
  const added = await rulesOfAnIoRuleScreenCall(ioRuleScreenCall, 'screen-io completion', `\nGroups to answer: ${uncovered.join(', ')}`)
  if (!added) log('the second I/O rule screen call returned nothing, so the end calls no rule covers stay unanswered')
  return { rules: [...rules, ...(added || [])], fresh: true }
}

async function rulesOfAnIoRuleScreenCall(ioRuleScreenCall, label, groupsLine) {
  const returned = await agent(sized(`${theArguments.fileAt(ioRuleScreenCall.file)}
I/O summary: ${ioRuleScreenCall.groups} groups${groupsLine}`, label), theAgents.optionsFor(STEPS.ioRules.role, { phase: STEPS.ioRules.phase, label, schema: IO_RULES_SCHEMA })).catch(() => null)
  if (!returned || STEPS.ioRules.missingFrom(returned).length) return null
  const rules = usableRulesOf(returned.rules)
  if (rules.length < returned.rules.length) log(`${returned.rules.length - rules.length} I/O rule(s) of the ${label} call did not rest on a type or a module and were dropped`)
  return rules
}

function groupsWithAnEndCallNoRuleCovers(rules, groups) {
  const uncovered = new Set()
  for (const [names, callees, summaryId] of groups) {
    if (summaryId && callees.some(([callee]) => !(names.length && callee && ruleAnswerOf(rules, names, callee)))) uncovered.add(summaryId)
  }
  return [...uncovered].sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
}

function globMatches(glob, text) {
  let at = 0
  let from = 0
  let star = -1
  let mark = 0
  while (from < text.length) {
    if (at < glob.length && (glob[at] === '?' || glob[at] === text[from])) { at++; from++ }
    else if (at < glob.length && glob[at] === '*') { star = at++; mark = from }
    else if (star >= 0) { at = star + 1; from = ++mark }
    else return false
  }
  while (at < glob.length && glob[at] === '*') at++
  return at === glob.length
}

function isARuleText(given) {
  return typeof given === 'string' && given.trim() === given && given.length > 0 && !/\s/.test(given)
}

function restsOnATypeOrModule(on) {
  if (!isARuleText(on)) return false
  let length = 0
  while (length < on.length && on[length] !== '*' && on[length] !== '?') length++
  return length >= MIN_LITERAL_PREFIX
}

function isAUsableRule(rule) {
  return Boolean(rule)
    && restsOnATypeOrModule(rule.on)
    && Array.isArray(rule.callee) && rule.callee.length > 0 && rule.callee.every(isARuleText)
    && [RULE_ANSWERS.IO, RULE_ANSWERS.NOT_IO].includes(rule.answer)
}

function usableRulesOf(given) {
  return (Array.isArray(given) ? given : []).filter(isAUsableRule).map(rule => ({ on: rule.on, callee: [...rule.callee], answer: rule.answer }))
}

function ruleAnswerOf(rules, names, callee) {
  const covering = rules.filter(rule => names.some(name => globMatches(rule.on, name)) && rule.callee.some(glob => globMatches(glob, callee)))
  if (!covering.length) return ''
  return covering.some(rule => rule.answer === RULE_ANSWERS.IO) ? RULE_ANSWERS.IO : RULE_ANSWERS.NOT_IO
}

function ruleAnswersOfGroups(rules, groups) {
  const answered = new Map()
  for (const [names, callees] of groups) {
    for (const [callee, ids] of callees) {
      const answer = names.length && callee ? ruleAnswerOf(rules, names, callee) : ''
      if (answer) for (const id of ids) answered.set(id, answer)
    }
  }
  return { answered }
}

function judgeCallsOf(everyCodeUnderReview) {
  const byType = new Map()
  for (const code of everyCodeUnderReview) {
    const sameJudgeType = byType.get(code.judgeType) || []
    sameJudgeType.push(code)
    byType.set(code.judgeType, sameJudgeType)
  }
  const judgeCalls = []
  for (const [judgeType, sameJudgeType] of byType) {
    for (let start = 0; start < sameJudgeType.length; start += theArguments.batch) {
      judgeCalls.push({ judgeType, codeUnderReview: sameJudgeType.slice(start, start + theArguments.batch) })
    }
  }
  return judgeCalls
}

async function screened() {
  if (!theArguments.screenBatches.length) return []
  const returned = await parallel(theArguments.screenBatches.map(batch => () => agent(sized(`${theArguments.fileAt(batch.file)}
Screen batch: ${batch.id}
Abstractions: ${batch.abstractions}`, `screen-presence ${batch.id}`), theAgents.optionsFor(STEPS.screen.role, { phase: STEPS.screen.phase, label: `screen-presence ${batch.id}`, schema: SCREEN_SCHEMA })).catch(() => null)))
  const silent = returned.filter(answered => !answered).length
  if (silent) log(`${silent} screen batch(es) returned nothing, so every check the screen gates on their abstractions runs`)
  return returned.filter(Boolean).flatMap(answered => answered.answers || [])
}

async function judgeOf(judgeCall) {
  const batch = judgeCall.codeUnderReview
  const label = `judge ${judgeCall.judgeType.replace('judge-', '')} ${batch[0].id}${batch.length > 1 ? ` and ${batch.length - 1} more` : ''}`
  const message = sized(batch.map(messageOf).join('\n\n'), label)
  const options = theAgents.optionsFor(judgeCall.judgeType, { phase: STEPS.judge.phase, label, schema: SCHEMA_BY_JUDGE_TYPE[judgeCall.judgeType], stallMs: JUDGE_STALL_MS })
  const tail = batch.length === 1 ? tailOf(message, options) : ''
  if (tail && theArguments.savedTailsOf(batch[0].id).includes(tail)) return { findings: [], covered: [], notRun: [], cacheHit: [batch[0].id, tail] }
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt++) {
    const returned = await agent(message, options).catch(() => null)
    if (STEPS.judge.missingFrom(returned).length) continue
    if (attempt > 1) log(`the ${label} call answered on attempt ${attempt} of ${JUDGE_ATTEMPTS}`)
    return {
      findings: stampedWithTheCodeUnderReviewId(returned.findings, batch[0].id),
      covered: stampedWithTheCodeUnderReviewId(returned.covered || [], batch[0].id),
      notRun: [],
      ...(tail ? { cacheFresh: [batch[0].id, tail] } : {}),
    }
  }
  log(`the ${label} call returned nothing usable in ${JUDGE_ATTEMPTS} attempt(s), so its checks are reported as failed`)
  return { findings: [], covered: [], notRun: checksNoJudgeReached(batch) }
}

function tailOf(message, options) {
  return hashTheMessageTail([options.model, options.effort, ...message.split('\n').slice(1)].join('\n'))
}

function checksNoJudgeReached(batch) {
  return batch.flatMap(code => code.live
    .map(check => ({ codeUnderReviewId: code.id, check, reason: NO_JUDGE_REACHED_IT })))
}

function stampedWithTheCodeUnderReviewId(returnedFindings, codeUnderReviewId) {
  return returnedFindings.map(returnedFinding => ({ ...returnedFinding, codeUnderReviewId }))
}
