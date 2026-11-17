export const meta = {
  name: 'laminar-design-writers',
  description: 'Laminar design: start 1 writer agent per migration group of a planned migration, each group after the earlier groups it touches and the other groups side by side, run the self-check of each finished group, and return per group the files written, the build, the tests run, the self-check and the stop',
  phases: [
    { title: 'Write', detail: 'one writer agent of the type laminar:design-writer per migration group reads design.md and the steps of its group, writes the code and the tests, builds and runs the tests, and returns its files and its commit message, or a stop; a group starts as soon as every earlier group it touches has finished, and a group whose earlier group stopped or gave no answer does not start' },
    { title: 'Self-check', detail: 'after a group finished with a build that passed or no build step, and with tests that passed, the helper laminar:design-self-check prepares a review of its files with the decision, method, variable and test-method judges, the judge workflow and the verify workflow run on it, and the writer answers each kept finding once: fixed, or recorded with a record reason' },
    { title: 'Build', detail: 'only where the call gives build: after-the-last-group: after every group and every self-check finished, the helper laminar:design-build compiles the production code and the test code once and runs the test files of the groups, each failure goes back to the group whose files hold it, each such group gets 1 fix call of its writer per fix pass, and the helper builds again' },
  ],
}

const PHASES = { WRITE: 'Write', SELF_CHECK: 'Self-check', BUILD: 'Build' }

const WRITER_AGENT_TYPE = 'laminar:design-writer'

const SELF_CHECK_AGENT_TYPE = 'laminar:design-self-check'

const BUILD_AGENT_TYPE = 'laminar:design-build'

// per-group: each writer builds and runs the tests of its own group, as before; after-the-last-group: the writers build nothing, and 1 build of the round follows the last group.
const BUILD_MODES = { PER_GROUP: 'per-group', AFTER_THE_LAST_GROUP: 'after-the-last-group' }

const BUILD_OF_THE_ROUND_LINE = 'after the last group'

const DEFAULT_BUILD_FIX_PASSES = 1

// Each fix pass costs 1 writer call per failing group and 1 build more, so a call allows at most 3.
const MAX_BUILD_FIX_PASSES = 3

const BUILD_FOLDER = 'build'

const JUDGE_WORKFLOW = 'laminar:laminar-review-judge'

const VERIFY_WORKFLOW = 'laminar:laminar-review-verify'

const MIGRATION_WORKFLOW_FILE = 'migration.workflow.js'

const PREPARE_RETURN_WORKFLOW_FILE = 'prepare-return.workflow.js'

const MERGE_RETURN_WORKFLOW_FILE = 'merge-return.workflow.js'

const SELF_CHECK_ITEMS_SCRIPT = 'selfCheckItems.mjs'

const OUTCOMES = { FINISHED: 'finished', STOPPED: 'stopped', NOT_STARTED: 'not started', NO_ANSWER: 'no answer' }

const STOP_REASONS = [
  'input-nothing-provides',
  'signature-the-stack-cannot-carry',
  'test-that-cannot-reach-its-branch',
  'behavior-the-design-did-not-decide',
  'migration-order-cannot-build',
  'fix-changes-the-model',
  'model-breaks-code-style',
]

const RECORD_REASONS = { CHANGES_THE_MODEL: 'changes-the-model', OUTSIDE_THE_GROUP: 'outside-the-group', RULE_SAYS_OTHERWISE: 'rule-says-otherwise', FIX_BREAKS_THE_BUILD: 'fix-breaks-the-build' }

const ANSWERS = { FIXED: 'fixed', RECORDED: 'recorded' }

// The stop of a group whose writer stopped or gave no answer with no stop of its own, so the next plan always reads a stop for each unfinished group.
const STOPPED_WITHOUT_A_REASON = 'stopped-without-a-reason'

const SAYS_WITHOUT_A_REASON = 'the writer stopped without a reason'

// The stop of a group whose writer finished with a failed build, with the build command as says.
const BUILD_FAILED = 'build-failed'

// The stop of a group whose writer finished with a build that did not fail and a test command that did not pass.
const TESTS_FAILED = 'tests-failed'

const SAYS_NO_TEST_RAN = 'no test ran'

const BUILD_RESULTS = ['passed', 'failed', 'not run']

const TEST_RESULTS = ['passed', 'failed']

// none: a language with no compile step, such as plain JavaScript, compiles nothing.
const COMPILE_RESULTS = ['passed', 'failed', 'none']

const LABELS = {
  DESIGN: 'Design:',
  MIGRATION: 'Migration:',
  MIGRATION_GROUP: 'Migration group:',
  REPOSITORY: 'Repository:',
  OPEN_QUESTIONS: 'Open questions:',
  LEFT_FILES: 'Files left by the writer before:',
  ROUND_REVIEW: 'Review of the round:',
  SELF_CHECK: 'Self-check:',
  BUILD: 'Build:',
  BUILD_FAILURES: 'Build failures:',
  COMMIT: 'Commit:',
}

const HELPER_LABELS = { WRITE: 'Write:', CONTENT: 'Content:', COMMAND: 'Command:' }

const BUILD_HELPER_LABELS = { REPOSITORY: 'Repository:', BUILD_COMMANDS: 'Build commands:', TEST_FILES: 'Test files:', FAILURES_FILE: 'Failures file:' }

// The stop of a group whose build of the round failed only because an earlier group of the call it builds on failed.
const SAYS_WAITS_ON = 'waits on group'

// The stop of a group with no failure of its own where the compile of the build of the round failed, because then no test of the group ran.
const SAYS_COMPILE_FAILED_IN = 'the compile of the round failed in group'

const A_CHARACTER_TO_ESCAPE = /[.*+?^${}()|[\]\\]/g

const COMMIT_BY_THE_SESSION = 'by the session'

const NONE = 'none'

const RESULT_MARK = 'RESULT '

// The end of the cost line of a prepare whose plan passes the threshold of the cost check of the review, which asks a person.
const ABOVE_THE_THRESHOLD_PATTERN = /above the threshold of [^:]*: yes/

const NO_VERDICTS = { verdicts: [], refutations: [], notVerified: [] }

const A_TEXT_LIST = { type: 'array', items: { type: 'string' } }

const WRITER_PROPERTIES = {
  outcome: { type: 'string', enum: [OUTCOMES.FINISHED, OUTCOMES.STOPPED] },
  files: A_TEXT_LIST,
  commitMessage: { type: 'string' },
  steps: { type: 'array', items: { type: 'integer' } },
  filled: A_TEXT_LIST,
  build: {
    type: 'object',
    properties: { command: { type: 'string' }, result: { type: 'string', enum: BUILD_RESULTS } },
    required: ['command', 'result'],
  },
  tests: {
    type: 'array',
    items: {
      type: 'object',
      properties: { command: { type: 'string' }, result: { type: 'string', enum: TEST_RESULTS }, testsRun: { type: 'integer', minimum: 0 } },
      required: ['command', 'result'],
    },
  },
  stop: {
    type: 'object',
    properties: { reason: { type: 'string', enum: STOP_REASONS }, at: { type: 'string' }, says: { type: 'string' } },
    required: ['reason', 'at', 'says'],
  },
}

const WRITER_REQUIRED = ['outcome', 'files', 'steps', 'build', 'tests']

const WRITER_SCHEMA = { type: 'object', properties: WRITER_PROPERTIES, required: WRITER_REQUIRED }

const ANSWER_ROUND_SCHEMA = {
  type: 'object',
  properties: {
    ...WRITER_PROPERTIES,
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          check: { type: 'string' },
          answer: { type: 'string', enum: [ANSWERS.FIXED, ANSWERS.RECORDED] },
          reason: { type: 'string', enum: Object.values(RECORD_REASONS) },
          says: { type: 'string' },
        },
        required: ['number', 'check', 'answer', 'says'],
      },
    },
  },
  required: [...WRITER_REQUIRED, 'answers'],
}

const SELF_CHECK_HELPER_SCHEMA = {
  type: 'object',
  properties: { ran: { type: 'boolean' }, result: { type: 'string' }, error: { type: 'string' } },
  required: ['ran'],
}

const BUILD_HELPER_SCHEMA = {
  type: 'object',
  properties: {
    ran: { type: 'boolean' },
    command: { type: 'string' },
    compile: { type: 'string', enum: COMPILE_RESULTS },
    result: { type: 'string', enum: TEST_RESULTS },
    tests: WRITER_PROPERTIES.tests,
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: { file: { type: 'string' }, test: { type: 'string' }, says: { type: 'string' } },
        required: ['says'],
      },
    },
    error: { type: 'string' },
  },
  required: ['ran'],
}

const forward = given => String(given == null ? '' : given).replace(/\\/g, '/')

const joinedOrNone = texts => (texts && texts.length ? texts.join(', ') : NONE)

const toGroupNumbers = given => (Array.isArray(given) ? given.map(Number).filter(number => Number.isInteger(number)) : [])

const folderOf = given => forward(given).replace(/\/[^/]*$/, '')

const quoted = given => `"${forward(given)}"`

const toFixPasses = given => (given === undefined || given === null ? DEFAULT_BUILD_FIX_PASSES : given)

class WorkflowArguments {
  constructor(given) {
    const fields = given || {}
    this.results = forward(fields.results || '')
    this.planned = fields.planned || null
    this.chosenGroupNumbers = toGroupNumbers(fields.groups)
    this.leftFilesOfGroupMap = fields.leftFiles || {}
    this.roundReview = forward(fields.review || '')
    this.model = fields.model || null
    this.effort = fields.effort || null
    this.runsTheSelfCheck = fields.selfCheck !== false
    this.agentTypes = fields.agentTypes || {}
    this.buildMode = fields.build || BUILD_MODES.PER_GROUP
    this.buildCommands = fields.buildCommands || null
    this.buildFixPasses = toFixPasses(fields.buildFixPasses)
  }

  get buildsAfterTheLastGroup() {
    return this.buildMode === BUILD_MODES.AFTER_THE_LAST_GROUP
  }

  get hasAKnownBuildMode() {
    return Object.values(BUILD_MODES).includes(this.buildMode)
  }

  get hasAllowedFixPasses() {
    return Number.isInteger(this.buildFixPasses) && this.buildFixPasses >= 0 && this.buildFixPasses <= MAX_BUILD_FIX_PASSES
  }

  get groups() {
    const every = (this.planned && this.planned.groups) || []
    return this.chosenGroupNumbers.length ? every.filter(group => this.chosenGroupNumbers.includes(group.group)) : every
  }

  get unknownGroupNumbers() {
    const plannedNumbers = ((this.planned && this.planned.groups) || []).map(group => group.group)
    return this.chosenGroupNumbers.filter(number => !plannedNumbers.includes(number))
  }

  get resultsFolder() {
    return this.results || folderOf(this.planned.migration)
  }

  leftFilesOf(group) {
    return this.leftFilesOfGroupMap[String(group.group)] || []
  }

  writerOptionsFor(group, schema = WRITER_SCHEMA, label = `writer group ${group.group}`, phaseTitle = PHASES.WRITE) {
    return {
      phase: phaseTitle,
      agentType: this.agentTypes.writer || WRITER_AGENT_TYPE,
      label,
      schema,
      ...(this.model ? { model: this.model } : {}),
      ...(this.effort ? { effort: this.effort } : {}),
    }
  }

  helperOptionsFor(group, step) {
    return { phase: PHASES.SELF_CHECK, agentType: this.agentTypes.selfCheck || SELF_CHECK_AGENT_TYPE, label: `self-check ${step} group ${group.group}`, schema: SELF_CHECK_HELPER_SCHEMA }
  }

  selfCheckRunOf(group) {
    return `${this.resultsFolder}/plans/${this.planned.plan}/self-check/group-${group.group}`
  }

  buildHelperOptionsFor(build) {
    return { phase: PHASES.BUILD, agentType: this.agentTypes.build || BUILD_AGENT_TYPE, label: `build ${build}`, schema: BUILD_HELPER_SCHEMA }
  }

  // The file names the groups of the call, so a later call on other groups of the same plan keeps the output of this one.
  failuresFileOf(build, groupNumbers) {
    const planFolder = this.planned.plan == null ? this.resultsFolder : `${this.resultsFolder}/plans/${this.planned.plan}`
    return `${planFolder}/${BUILD_FOLDER}/build-groups-${groupNumbers.join('-')}-${build}.txt`
  }
}

const NOTHING_WRITTEN = { groups: [] }

const stoppedWith = words => ({ ...NOTHING_WRITTEN, stopped: words })

let unloadedReturn = null

async function loadPlannedOf(given) {
  const fields = given || {}
  if (fields.planned || !fields.results) return fields.planned
  const scriptPath = `${forward(fields.results)}/${MIGRATION_WORKFLOW_FILE}`
  try {
    return await workflow({ scriptPath })
  } catch (error) {
    log(`the results folder gave no migration return: ${error.message}`)
    unloadedReturn = error.message
    return null
  }
}

const theArguments = new WorkflowArguments({ ...(args || {}), planned: await loadPlannedOf(args) })

if (unloadedReturn) return stoppedWith(`the call did not run: ${MIGRATION_WORKFLOW_FILE} could not be loaded (${unloadedReturn}): where the file is missing, run the finish command or the migration script again; where another workflow calls this one, call it at the top level instead, or pass planned`)

if (!theArguments.planned) return stoppedWith('the call did not run: it needs the results folder that holds the migration')

if (theArguments.planned.defects > 0) return stoppedWith(`the call did not run: the migration holds ${theArguments.planned.defects} defect(s), so change the groups of the model and run the finish command again`)

if (theArguments.unknownGroupNumbers.length) return stoppedWith(`the call did not run: the migration plans no group ${theArguments.unknownGroupNumbers.join(', ')}`)

if (!theArguments.hasAKnownBuildMode) return stoppedWith(`the call did not run: build takes ${Object.values(BUILD_MODES).join(' or ')}, not ${theArguments.buildMode}`)

if (!theArguments.hasAllowedFixPasses) return stoppedWith(`the call did not run: buildFixPasses takes a whole number from 0 to ${MAX_BUILD_FIX_PASSES}, not ${theArguments.buildFixPasses}`)

const groups = theArguments.groups

if (!groups.length) {
  log('the migration plans no group, so no writer ran')
  return NOTHING_WRITTEN
}

log(`${groups.length} migration group(s) to write`)
for (const group of groups) if (group.selfCheckCost) log(`self-check of group ${group.group}: judge calls about ${group.selfCheckCost.judgeCalls}, dollars about $${group.selfCheckCost.dollars}`)
phase(PHASES.WRITE)

const writtenOfGroupMap = new Map()
for (const group of groups) writtenOfGroupMap.set(group.group, writtenAfterItsEarlierGroups(group))

const writtenGroups = await Promise.all(groups.map(group => writtenOfGroupMap.get(group.group)))

if (!theArguments.buildsAfterTheLastGroup) return { groups: writtenGroups }

return await builtAfterTheLastGroup(writtenGroups)

// followUp is the answer round, with review, or the fix call, with buildFailures; each goes on from the files the first call of the group changed.
function writerMessageOf(group, followUp) {
  const planned = theArguments.planned
  const leftFiles = followUp ? followUp.leftFiles : theArguments.leftFilesOf(group)
  return [
    `${LABELS.DESIGN} ${forward(planned.design)}`,
    `${LABELS.MIGRATION} ${forward(planned.migration)}`,
    `${LABELS.MIGRATION_GROUP} ${group.group}`,
    `${LABELS.REPOSITORY} ${planned.repository ? forward(planned.repository) : NONE}`,
    `${LABELS.OPEN_QUESTIONS} ${joinedOrNone(planned.openQuestions)}`,
    `${LABELS.LEFT_FILES} ${joinedOrNone(leftFiles)}`,
    ...(theArguments.roundReview ? [`${LABELS.ROUND_REVIEW} ${theArguments.roundReview}`] : []),
    ...(followUp && followUp.review ? [`${LABELS.SELF_CHECK} ${followUp.review}`] : []),
    ...(theArguments.buildsAfterTheLastGroup ? [`${LABELS.BUILD} ${BUILD_OF_THE_ROUND_LINE}`] : []),
    ...(followUp && followUp.buildFailures ? [`${LABELS.BUILD_FAILURES} ${forward(followUp.buildFailures)}`] : []),
    `${LABELS.COMMIT} ${COMMIT_BY_THE_SESSION}`,
  ].join('\n')
}

function stopAtTheGroupOf(group, reason, says) {
  return { reason, at: group.firstClass || `migration group ${group.group}`, says }
}

function stopWithoutAReasonOf(group) {
  return stopAtTheGroupOf(group, STOPPED_WITHOUT_A_REASON, SAYS_WITHOUT_A_REASON)
}

// A missing testsRun is unknown, as from a writer body that does not give it, so it never counts as 0.
function ranNoTest(test) {
  return test.testsRun === 0
}

// A group that the migration gives no test step may run a command that finds no test; a group given test steps must run 1, or its command did not pass.
function hasNotPassedIn(group) {
  const writesTests = Array.isArray(group.testSteps) && group.testSteps.length > 0
  return test => test.result !== 'passed' || (writesTests && ranNoTest(test))
}

function describeNotPassed(test) {
  return ranNoTest(test) ? `${test.command}: ${SAYS_NO_TEST_RAN}` : test.command
}

function stoppedGroupOf(group, finished, stop) {
  log(`migration group ${group.group} stopped with ${stop.reason}: ${stop.says}`)
  return { ...finished, outcome: OUTCOMES.STOPPED, stop }
}

// A group is finished only where its build did not fail and every test command passed, so the session commits no group with a failed build or test.
function withAFailedBuildOrTestStopped(group, finished) {
  if (finished.outcome !== OUTCOMES.FINISHED) return finished
  if (finished.build && finished.build.result === 'failed') return stoppedGroupOf(group, finished, stopAtTheGroupOf(group, BUILD_FAILED, finished.build.command))
  const notPassed = finished.tests.filter(hasNotPassedIn(group))
  if (!notPassed.length) return finished
  return stoppedGroupOf(group, finished, stopAtTheGroupOf(group, TESTS_FAILED, notPassed.map(describeNotPassed).join(', ')))
}

function isAWriterAnswer(returned) {
  return Boolean(returned) && [OUTCOMES.FINISHED, OUTCOMES.STOPPED].includes(returned.outcome)
}

function notWrittenOf(group, outcome, extra) {
  return { group: group.group, dependsOn: group.dependsOn, outcome, files: [], steps: [], filled: [], tests: [], ...extra }
}

function writtenOf(group, returned) {
  return {
    group: group.group,
    dependsOn: group.dependsOn,
    outcome: returned.outcome,
    files: returned.files || [],
    commitMessage: returned.commitMessage || '',
    steps: returned.steps || [],
    filled: returned.filled || [],
    build: returned.build,
    tests: returned.tests || [],
    ...(returned.outcome === OUTCOMES.STOPPED ? { stop: returned.stop || stopWithoutAReasonOf(group) } : {}),
  }
}

async function writtenGroup(group) {
  const options = theArguments.writerOptionsFor(group)
  const returned = await agent(writerMessageOf(group), options).catch(() => null)
  if (!isAWriterAnswer(returned)) {
    log(`the ${options.label} call returned nothing usable, so its group is not written and no later group it touches starts`)
    return notWrittenOf(group, OUTCOMES.NO_ANSWER, { stop: stopWithoutAReasonOf(group) })
  }
  const written = withAFailedBuildOrTestStopped(group, writtenOf(group, returned))
  if (written.outcome !== OUTCOMES.FINISHED) return written
  const notReadyReason = findWhyNotReadyForTheSelfCheck(written)
  if (notReadyReason) return withTheSelfCheckNotRun(group, written, notReadyReason)
  return withAFailedBuildOrTestStopped(group, await selfCheckedGroup(group, written))
}

// An earlier group that this call does not write is taken as written and committed.
async function writtenAfterItsEarlierGroups(group) {
  const earlierGroups = await Promise.all((group.dependsOn || [])
    .filter(number => writtenOfGroupMap.has(number))
    .map(number => writtenOfGroupMap.get(number)))
  const unfinishedNumbers = earlierGroups.filter(earlier => earlier.outcome !== OUTCOMES.FINISHED).map(earlier => earlier.group)
  if (unfinishedNumbers.length) {
    log(`migration group ${group.group} did not start, because the earlier group ${unfinishedNumbers.join(', ')} it builds on did not finish`)
    return notWrittenOf(group, OUTCOMES.NOT_STARTED, { waitedOn: unfinishedNumbers })
  }
  return writtenGroup(group)
}

// A build that did not run is no reason, because a project with no build step, such as plain JavaScript, builds nothing; where the call builds after the last group, the writer runs no test, and the self-check reads source text that needs no build.
function findWhyNotReadyForTheSelfCheck(written) {
  if (!written.build) return 'the writer gave no build result'
  if (!written.tests.length && !theArguments.buildsAfterTheLastGroup) return 'the writer ran no test'
  return ''
}

function withTheSelfCheckNotRun(group, written, reason) {
  log(`the self-check of group ${group.group} did not run: ${reason}`)
  return { ...written, selfCheck: { run: theArguments.selfCheckRunOf(group), notRun: reason } }
}

// A self-check that does not reach its report never fails the group, because the group's code already passed its build, where it has one, and its tests.
async function selfCheckedGroup(group, written) {
  const notRunBecause = reason => withTheSelfCheckNotRun(group, written, reason)
  if (!theArguments.runsTheSelfCheck) return notRunBecause('the self-check is turned off for this run')
  if (!theArguments.planned.reviewScripts || !theArguments.planned.designScripts || !theArguments.planned.plan) return notRunBecause(`${MIGRATION_WORKFLOW_FILE} names no review scripts, so run the finish command again`)
  try {
    const reviewed = await reviewedSelfCheckOf(group, written)
    if (reviewed.notRun) return notRunBecause(reviewed.notRun)
    return answeredSelfCheckOf(group, written, reviewed)
  } catch (error) {
    return notRunBecause(`a step stopped: ${error.message}`)
  }
}

async function helperResultOf(group, step, writes, commands) {
  const message = [
    ...writes.flatMap(([file, content]) => [`${HELPER_LABELS.WRITE} ${forward(file)}`, `${HELPER_LABELS.CONTENT} ${JSON.stringify(content)}`]),
    ...commands.map(command => `${HELPER_LABELS.COMMAND} ${command}`),
  ].join('\n')
  const returned = await agent(message, theArguments.helperOptionsFor(group, step)).catch(() => null)
  if (!returned || !returned.ran) throw new Error(`the ${step} commands did not run${returned && returned.error ? `: ${returned.error}` : ''}`)
  return returned.result || ''
}

function reviewCommand(step, options) {
  return `node ${quoted(`${theArguments.planned.reviewScripts}/runReview.mjs`)} ${step} ${options}`
}

async function wavesOf(childWorkflow, given, waveCount) {
  const returns = []
  for (let wave = 1; wave <= Math.max(waveCount, 1); wave++) {
    const returned = await workflow(childWorkflow, { ...given, ...(waveCount > 1 ? { wave } : {}) })
    if (!returned || returned.stopped) throw new Error(`${childWorkflow} stopped: ${returned ? returned.stopped : 'no return'}`)
    returns.push(returned)
  }
  return returns
}

function numberedFile(run, name, count, wave) {
  return `${run}/returns/${name}${count > 1 ? `-${wave}` : ''}.json`
}

async function reviewedSelfCheckOf(group, written) {
  const run = theArguments.selfCheckRunOf(group)
  const planned = theArguments.planned
  await helperResultOf(group, 'prepare', [], [
    reviewCommand('extract', `--run ${quoted(run)} --repo ${quoted(planned.repository)} --uncommitted ${quoted(written.files.join(','))}`),
    reviewCommand('prepare', `--run ${quoted(run)} --judges ${planned.selfCheckJudges.join(',')}`),
  ])
  const prepared = await workflow({ scriptPath: `${run}/${PREPARE_RETURN_WORKFLOW_FILE}` })
  if (ABOVE_THE_THRESHOLD_PATTERN.test(prepared.costPlan || '')) return { notRun: `the cost line is above the threshold of the cost check: ${prepared.costPlan}` }
  const judged = await wavesOf(JUDGE_WORKFLOW, { prepared }, (prepared.waves || []).length)
  const judgeCalls = judged.reduce((total, returned) => total + ((returned.counts || {}).judgeCalls || 0), 0)
  const findingsFiles = judged.map((returned, at) => [numberedFile(run, 'possible-findings', judged.length, at + 1), returned])
  await helperResultOf(group, 'merge', findingsFiles, [reviewCommand('merge', `--run ${quoted(run)} --findings ${quoted(findingsFiles.map(([file]) => file).join(','))}`)])
  const merged = await workflow({ scriptPath: `${run}/${MERGE_RETURN_WORKFLOW_FILE}` })
  const verified = ((merged.counts || {}).refuterCalls || 0) > 0 ? await wavesOf(VERIFY_WORKFLOW, { merged }, ((merged.verify || {}).waves || []).length) : [NO_VERDICTS]
  const verdictsFiles = verified.map((returned, at) => [numberedFile(run, 'verdicts', verified.length, at + 1), returned])
  const itemsLine = await helperResultOf(group, 'render', verdictsFiles, [
    reviewCommand('render', `--run ${quoted(run)} --verdicts ${quoted(verdictsFiles.map(([file]) => file).join(','))}${planned.decidedReview ? ` --decided-review ${quoted(planned.decidedReview)}` : ''}`),
    `node ${quoted(`${planned.designScripts}/${SELF_CHECK_ITEMS_SCRIPT}`)} --run ${quoted(run)}`,
  ])
  const items = JSON.parse(itemsLine.startsWith(RESULT_MARK) ? itemsLine.slice(RESULT_MARK.length) : itemsLine)
  return { run, judgeCalls, kept: items.kept || [], toConsider: items.toConsider || [], ...(items.decided ? { decided: items.decided } : {}), ...(items.changedSince ? { changedSince: items.changedSince } : {}) }
}

function countRecordedByReason(answers) {
  const recordedByReasonMap = {}
  for (const answer of answers.filter(given => given.answer === ANSWERS.RECORDED)) recordedByReasonMap[answer.reason] = (recordedByReasonMap[answer.reason] || 0) + 1
  return recordedByReasonMap
}

function selfCheckOf(reviewed, answers, answered) {
  const keptNumbers = new Set(reviewed.kept.map(item => item.number))
  const answersOfTheKept = answers.filter(answer => keptNumbers.has(answer.number))
  const answeredNumbers = new Set(answersOfTheKept.map(answer => answer.number))
  return {
    run: reviewed.run,
    judgeCalls: reviewed.judgeCalls,
    kept: reviewed.kept,
    toConsider: reviewed.toConsider,
    ...(reviewed.decided ? { decided: reviewed.decided } : {}),
    ...(reviewed.changedSince ? { changedSince: reviewed.changedSince } : {}),
    answered,
    answers: answersOfTheKept,
    fixed: answersOfTheKept.filter(answer => answer.answer === ANSWERS.FIXED).length,
    recorded: countRecordedByReason(answersOfTheKept),
    unanswered: reviewed.kept.filter(item => !answeredNumbers.has(item.number)).map(item => item.number),
    needsModelChange: answersOfTheKept.filter(answer => answer.reason === RECORD_REASONS.CHANGES_THE_MODEL),
  }
}

// 1 answer round: the fixes are not judged again before the commit, because the closing review judges every scale anyway.
async function answeredSelfCheckOf(group, written, reviewed) {
  if (!reviewed.kept.length) return { ...written, selfCheck: selfCheckOf(reviewed, [], true) }
  const options = theArguments.writerOptionsFor(group, ANSWER_ROUND_SCHEMA, `writer answers group ${group.group}`, PHASES.SELF_CHECK)
  const returned = await agent(writerMessageOf(group, { leftFiles: written.files, review: `${reviewed.run}/review.md` }), options).catch(() => null)
  if (!isAWriterAnswer(returned) || returned.outcome !== OUTCOMES.FINISHED) {
    log(`the ${options.label} call returned no finished answer, so the kept findings of the self-check of group ${group.group} stand unanswered in its record`)
    return { ...written, selfCheck: selfCheckOf(reviewed, [], false) }
  }
  const answeredGroup = writtenOf(group, returned)
  return {
    ...answeredGroup,
    files: [...new Set([...written.files, ...answeredGroup.files])],
    commitMessage: answeredGroup.commitMessage || written.commitMessage,
    steps: written.steps,
    filled: [...new Set([...written.filled, ...answeredGroup.filled])],
    selfCheck: selfCheckOf(reviewed, returned.answers || [], true),
  }
}

function isFinished(written) {
  return written.outcome === OUTCOMES.FINISHED
}

function plannedGroupOf(written) {
  return groups.find(group => group.group === written.group)
}

// The writers built nothing, so 1 build of the round follows the last group and its self-check: each failure that maps to a finished group goes back to it for 1 fix call per fix pass, and the build runs again after each pass that changed a group.
async function builtAfterTheLastGroup(writtenGroups) {
  if (!writtenGroups.some(isFinished)) {
    log('no group of the call finished, so the build of the round did not run')
    return { groups: writtenGroups, roundBuild: { mode: theArguments.buildMode, fixPasses: 0, notRun: 'no group of the call finished' } }
  }
  phase(PHASES.BUILD)
  let currentGroups = writtenGroups
  let built = await roundBuildOf(1, currentGroups)
  let fixPasses = 0
  while (fixPasses < theArguments.buildFixPasses && isFixable(built, currentGroups)) {
    fixPasses += 1
    const fixed = await fixedGroupsOf(currentGroups, mapFailuresToGroups(built.failures, currentGroups).failuresOfGroupMap, built.failuresFile)
    currentGroups = fixed.groups
    if (!fixed.changed) {
      log(`no fix call of pass ${fixPasses} returned an answer, so the build of the round does not run again`)
      break
    }
    built = await roundBuildOf(fixPasses + 1, currentGroups)
  }
  return { groups: groupsWithTheRoundBuild(currentGroups, built), roundBuild: roundBuildReturnOf(built, currentGroups, fixPasses) }
}

function listTestFilesOfTheCall(writtenGroups) {
  return [...new Set(writtenGroups.filter(isFinished).flatMap(written => (plannedGroupOf(written).testFiles || []).map(forward)))]
}

// A missing testsRun is unknown, so only a run whose every test command gives 0 counts as a run of no test.
function ranNoTestOf(tests) {
  return !tests.length || tests.every(ranNoTest)
}

// A failed build that names no failure still fails, with 1 failure of no file; a compile that passed with test files to run and no test that ran fails too, because no group can then be shown to pass its tests.
async function roundBuildOf(build, writtenGroups) {
  const planned = theArguments.planned
  const failuresFile = theArguments.failuresFileOf(build, groups.map(group => group.group))
  const testFiles = listTestFilesOfTheCall(writtenGroups)
  const message = [
    `${BUILD_HELPER_LABELS.REPOSITORY} ${planned.repository ? forward(planned.repository) : NONE}`,
    `${BUILD_HELPER_LABELS.BUILD_COMMANDS} ${theArguments.buildCommands ? JSON.stringify(theArguments.buildCommands) : NONE}`,
    `${BUILD_HELPER_LABELS.TEST_FILES} ${joinedOrNone(testFiles)}`,
    `${BUILD_HELPER_LABELS.FAILURES_FILE} ${failuresFile}`,
  ].join('\n')
  const returned = await agent(message, theArguments.buildHelperOptionsFor(build)).catch(() => null)
  if (!returned) return { failuresFile, notRun: 'the build helper gave no answer' }
  if (!returned.ran) return { failuresFile, notRun: `the build did not run${returned.error ? `: ${returned.error}` : ''}` }
  const command = returned.command || ''
  const tests = returned.tests || []
  const named = returned.failures || []
  const compile = returned.compile || (named.some(failure => !failure.test) ? 'failed' : 'passed')
  const failedWithNoFailure = returned.result !== 'passed' && !named.length ? [{ says: `the build failed: ${command}` }] : []
  const ranNoTestFailure = compile !== 'failed' && testFiles.length && ranNoTestOf(tests) ? [{ says: SAYS_NO_TEST_RAN }] : []
  const failures = [...named, ...failedWithNoFailure, ...ranNoTestFailure]
  const result = failures.length ? 'failed' : 'passed'
  log(`build ${build} of the round ${result}: ${command}`)
  return { failuresFile, command, compile, result, tests, failures }
}

// The files of a writer and of a step may stand relative to the repository or as absolute paths, so both are read relative to it.
function relativeToTheRepository(file) {
  const repository = forward(theArguments.planned.repository || '').replace(/\/$/, '')
  const given = forward(file).replace(/^\.\//, '')
  return repository && given.startsWith(`${repository}/`) ? given.slice(repository.length + 1) : given
}

function holdsTheFile(files, file) {
  return files.map(relativeToTheRepository).some(listed => listed === file || (listed.endsWith('/') && file.startsWith(listed)))
}

// A test tool often names a failing test by its class or its test name, not by its file, so the base name of a test file, as a whole word, finds its group.
function namesTheTestFile(failure, testFile) {
  const baseName = forward(testFile).replace(/\/$/, '').split('/').pop().replace(/\.[^.]*$/, '')
  if (!baseName) return false
  const wholeWord = new RegExp(`(^|[^A-Za-z0-9_])${baseName.replace(A_CHARACTER_TO_ESCAPE, '\\$&')}([^A-Za-z0-9_]|$)`)
  return wholeWord.test(`${failure.file || ''} ${failure.test || ''}`)
}

// A failure goes to each group of the call whose writer returned its file, else to each group whose step lists it, else to each group whose test file it names; a failure of no group is a gap of the plan.
function findGroupNumbersOfTheFailure(failure, writtenGroups) {
  const file = failure.file ? relativeToTheRepository(failure.file) : ''
  const returnedBy = file ? writtenGroups.filter(written => holdsTheFile(written.files || [], file)) : []
  if (returnedBy.length) return returnedBy.map(written => written.group)
  const listedBy = file ? writtenGroups.filter(written => holdsTheFile(plannedGroupOf(written).files || [], file)) : []
  if (listedBy.length) return listedBy.map(written => written.group)
  return writtenGroups.filter(written => (plannedGroupOf(written).testFiles || []).some(testFile => namesTheTestFile(failure, testFile))).map(written => written.group)
}

// unmapped: the failures of no group; failingEveryGroup: those and the failures of no finished group, which no fix call can reach and which fail every finished group.
function mapFailuresToGroups(failures, writtenGroups) {
  const failuresOfGroupMap = new Map()
  const unmapped = []
  const failingEveryGroup = []
  for (const failure of failures) {
    const numbers = findGroupNumbersOfTheFailure(failure, writtenGroups)
    if (!numbers.length) unmapped.push(failure)
    if (!writtenGroups.some(written => isFinished(written) && numbers.includes(written.group))) failingEveryGroup.push(failure)
    for (const number of numbers) failuresOfGroupMap.set(number, [...(failuresOfGroupMap.get(number) || []), failure])
  }
  return { failuresOfGroupMap, unmapped, failingEveryGroup }
}

// A fix pass runs where 1 finished group has a failure of its own; a failure of no finished group gets no fix call, because no writer may fix a gap of the plan alone, and it still fails every group at the end.
function isFixable(built, writtenGroups) {
  if (built.notRun || built.result === 'passed') return false
  const { failuresOfGroupMap } = mapFailuresToGroups(built.failures, writtenGroups)
  return writtenGroups.some(written => isFinished(written) && failuresOfGroupMap.has(written.group))
}

// The fix calls run 1 after the other in group order, because 2 groups that share a failing file touch, and every writer writes into 1 working tree.
async function fixedGroupsOf(writtenGroups, failuresOfGroupMap, failuresFile) {
  const fixedOfGroupMap = new Map()
  for (const written of writtenGroups) {
    if (!isFinished(written) || !failuresOfGroupMap.has(written.group)) continue
    const fixed = await fixedGroupOf(written, failuresFile)
    if (fixed) fixedOfGroupMap.set(written.group, fixed)
  }
  return { groups: writtenGroups.map(written => fixedOfGroupMap.get(written.group) || written), changed: fixedOfGroupMap.size > 0 }
}

// A fix call with no usable answer gives null, so its group stays as it was and its failures stand.
async function fixedGroupOf(written, failuresFile) {
  const group = plannedGroupOf(written)
  const options = theArguments.writerOptionsFor(group, WRITER_SCHEMA, `writer fixes group ${group.group}`, PHASES.BUILD)
  const returned = await agent(writerMessageOf(group, { leftFiles: written.files, buildFailures: failuresFile }), options).catch(() => null)
  if (!isAWriterAnswer(returned)) {
    log(`the ${options.label} call returned nothing usable, so the failures of group ${group.group} stand`)
    return null
  }
  const fixed = { ...written, files: [...new Set([...written.files, ...(returned.files || [])])], filled: [...new Set([...written.filled, ...(returned.filled || [])])] }
  if (returned.outcome === OUTCOMES.STOPPED) return stoppedGroupOf(group, fixed, returned.stop || stopWithoutAReasonOf(group))
  return fixed
}

function describeFailure(failure) {
  return [failure.file, failure.test, failure.says].filter(Boolean).join(': ')
}

function isATestFailure(failure) {
  return Boolean(failure.test) || failure.says === SAYS_NO_TEST_RAN
}

// A group passes only where the compile of the last build did not fail, no failure of its own or of every group stands, and no earlier group of the call it builds on failed; its own failures come first in its stop. A group stopped only because the compile failed elsewhere is waited on by no group, so each later group names the group that failed.
function groupsWithTheRoundBuild(writtenGroups, built) {
  if (built.notRun) {
    log(`the build of the round did not run: ${built.notRun}`)
    return writtenGroups
  }
  const { failuresOfGroupMap, failingEveryGroup } = mapFailuresToGroups(built.failures, writtenGroups)
  const failedReasonOfGroupMap = new Map(writtenGroups.filter(written => !isFinished(written)).map(written => [written.group, BUILD_FAILED]))
  const compileFailedNumbers = [...failuresOfGroupMap.entries()].filter(([, failures]) => failures.some(failure => !isATestFailure(failure))).map(([number]) => number)
  return writtenGroups.map(written => {
    if (!isFinished(written)) return written
    const group = plannedGroupOf(written)
    const failures = [...(failuresOfGroupMap.get(written.group) || []), ...failingEveryGroup]
    if (failures.length) {
      const failed = failedByTheRoundBuild(group, written, built, failures)
      failedReasonOfGroupMap.set(written.group, failed.stop.reason)
      return failed
    }
    const waitedOn = (written.dependsOn || []).filter(number => failedReasonOfGroupMap.has(number))
    if (waitedOn.length) {
      const reason = waitedOn.every(number => failedReasonOfGroupMap.get(number) === TESTS_FAILED) ? TESTS_FAILED : BUILD_FAILED
      failedReasonOfGroupMap.set(written.group, reason)
      return stoppedGroupOf(group, { ...written, build: { command: built.command, result: reason === TESTS_FAILED ? 'passed' : 'failed' }, waitedOn }, stopAtTheGroupOf(group, reason, `${SAYS_WAITS_ON} ${waitedOn.join(', ')}`))
    }
    if (built.compile === 'failed') {
      return stoppedGroupOf(group, { ...written, build: { command: built.command, result: 'failed' } }, stopAtTheGroupOf(group, BUILD_FAILED, `${SAYS_COMPILE_FAILED_IN} ${compileFailedNumbers.join(', ')}`))
    }
    return { ...written, build: { command: built.command, result: 'passed' }, tests: built.tests.filter(test => test.result === 'passed') }
  })
}

function failedByTheRoundBuild(group, written, built, failures) {
  const stop = stopAtTheGroupOf(group, isATestFailure(failures[0]) ? TESTS_FAILED : BUILD_FAILED, describeFailure(failures[0]))
  const result = failures.every(isATestFailure) && built.compile !== 'failed' ? 'passed' : 'failed'
  return stoppedGroupOf(group, { ...written, build: { command: built.command, result }, buildFailures: failures }, stop)
}

function roundBuildReturnOf(built, writtenGroups, fixPasses) {
  if (built.notRun) return { mode: theArguments.buildMode, fixPasses, notRun: built.notRun }
  const { unmapped } = mapFailuresToGroups(built.failures, writtenGroups)
  return { mode: theArguments.buildMode, command: built.command, compile: built.compile, result: built.result, tests: built.tests, failures: built.failures, unmapped, fixPasses, failuresFile: built.failuresFile }
}
