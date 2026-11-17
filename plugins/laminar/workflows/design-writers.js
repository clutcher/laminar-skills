export const meta = {
  name: 'laminar-design-writers',
  description: 'Laminar design: start 1 writer agent per migration group of a planned migration, each group after the earlier groups it touches and the other groups side by side, run the self-check of each finished group, and return per group the files written, the build, the tests run, the self-check and the stop',
  phases: [
    { title: 'Write', detail: 'one writer agent of the type laminar:design-writer per migration group reads design.md and the steps of its group, writes the code and the tests, builds and runs the tests, and returns its files and its commit message, or a stop; a group starts as soon as every earlier group it touches has finished, and a group whose earlier group stopped or gave no answer does not start' },
    { title: 'Self-check', detail: 'after a group finished with a build that passed or no build step, and with tests that passed, the helper laminar:design-self-check prepares a review of its files with the decision, method, variable and test-method judges, the judge workflow and the verify workflow run on it, and the writer answers each kept finding once: fixed, or recorded with a record reason' },
  ],
}

const PHASES = { WRITE: 'Write', SELF_CHECK: 'Self-check' }

const WRITER_AGENT_TYPE = 'laminar:design-writer'

const SELF_CHECK_AGENT_TYPE = 'laminar:design-self-check'

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

const LABELS = {
  DESIGN: 'Design:',
  MIGRATION: 'Migration:',
  MIGRATION_GROUP: 'Migration group:',
  REPOSITORY: 'Repository:',
  OPEN_QUESTIONS: 'Open questions:',
  LEFT_FILES: 'Files left by the writer before:',
  ROUND_REVIEW: 'Review of the round:',
  SELF_CHECK: 'Self-check:',
  COMMIT: 'Commit:',
}

const HELPER_LABELS = { WRITE: 'Write:', CONTENT: 'Content:', COMMAND: 'Command:' }

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

const forward = given => String(given == null ? '' : given).replace(/\\/g, '/')

const joinedOrNone = texts => (texts && texts.length ? texts.join(', ') : NONE)

const toGroupNumbers = given => (Array.isArray(given) ? given.map(Number).filter(number => Number.isInteger(number)) : [])

const folderOf = given => forward(given).replace(/\/[^/]*$/, '')

const quoted = given => `"${forward(given)}"`

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

return { groups: await Promise.all(groups.map(group => writtenOfGroupMap.get(group.group))) }

function writerMessageOf(group, answerRound) {
  const planned = theArguments.planned
  const leftFiles = answerRound ? answerRound.leftFiles : theArguments.leftFilesOf(group)
  return [
    `${LABELS.DESIGN} ${forward(planned.design)}`,
    `${LABELS.MIGRATION} ${forward(planned.migration)}`,
    `${LABELS.MIGRATION_GROUP} ${group.group}`,
    `${LABELS.REPOSITORY} ${planned.repository ? forward(planned.repository) : NONE}`,
    `${LABELS.OPEN_QUESTIONS} ${joinedOrNone(planned.openQuestions)}`,
    `${LABELS.LEFT_FILES} ${joinedOrNone(leftFiles)}`,
    ...(theArguments.roundReview ? [`${LABELS.ROUND_REVIEW} ${theArguments.roundReview}`] : []),
    ...(answerRound ? [`${LABELS.SELF_CHECK} ${answerRound.review}`] : []),
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

// A build that did not run is no reason, because a project with no build step, such as plain JavaScript, builds nothing.
function findWhyNotReadyForTheSelfCheck(written) {
  if (!written.build) return 'the writer gave no build result'
  if (!written.tests.length) return 'the writer ran no test'
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
  return { run, judgeCalls, kept: items.kept || [], toConsider: items.toConsider || [], ...(items.decided ? { decided: items.decided } : {}) }
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
