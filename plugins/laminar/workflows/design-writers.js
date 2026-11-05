export const meta = {
  name: 'laminar-design-writers',
  description: 'Laminar design: start 1 writer agent per migration group of a planned migration, each group after the earlier groups it touches and the other groups side by side, and return per group the files written, the build, the tests run and the stop',
  phases: [
    { title: 'Write', detail: 'one writer agent of the type laminar:design-writer per migration group reads design.md and the steps of its group, writes the code and the tests, builds and runs the tests, and returns its files and its commit message, or a stop; a group starts as soon as every earlier group it touches has finished, and a group whose earlier group stopped or gave no answer does not start' },
  ],
}

const PHASES = { WRITE: 'Write' }

const WRITER_AGENT_TYPE = 'laminar:design-writer'

const MIGRATION_WORKFLOW_FILE = 'migration.workflow.js'

const OUTCOMES = { FINISHED: 'finished', STOPPED: 'stopped', NOT_STARTED: 'not started', NO_ANSWER: 'no answer' }

const STOP_REASONS = [
  'input-nothing-provides',
  'signature-the-stack-cannot-carry',
  'test-that-cannot-reach-its-branch',
  'behavior-the-design-did-not-decide',
  'migration-order-cannot-build',
  'fix-changes-the-model',
]

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
  COMMIT: 'Commit:',
}

const COMMIT_BY_THE_SESSION = 'by the session'

const NONE = 'none'

const A_TEXT_LIST = { type: 'array', items: { type: 'string' } }

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
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
        properties: { command: { type: 'string' }, result: { type: 'string', enum: TEST_RESULTS } },
        required: ['command', 'result'],
      },
    },
    stop: {
      type: 'object',
      properties: { reason: { type: 'string', enum: STOP_REASONS }, at: { type: 'string' }, says: { type: 'string' } },
      required: ['reason', 'at', 'says'],
    },
  },
  required: ['outcome', 'files', 'steps', 'build', 'tests'],
}

const forward = given => String(given == null ? '' : given).replace(/\\/g, '/')

const joinedOrNone = texts => (texts && texts.length ? texts.join(', ') : NONE)

const toGroupNumbers = given => (Array.isArray(given) ? given.map(Number).filter(number => Number.isInteger(number)) : [])

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
  }

  get groups() {
    const every = (this.planned && this.planned.groups) || []
    return this.chosenGroupNumbers.length ? every.filter(group => this.chosenGroupNumbers.includes(group.group)) : every
  }

  get unknownGroupNumbers() {
    const plannedNumbers = ((this.planned && this.planned.groups) || []).map(group => group.group)
    return this.chosenGroupNumbers.filter(number => !plannedNumbers.includes(number))
  }

  leftFilesOf(group) {
    return this.leftFilesOfGroupMap[String(group.group)] || []
  }

  writerOptionsFor(group) {
    return {
      phase: PHASES.WRITE,
      agentType: WRITER_AGENT_TYPE,
      label: `writer group ${group.group}`,
      schema: WRITER_SCHEMA,
      ...(this.model ? { model: this.model } : {}),
      ...(this.effort ? { effort: this.effort } : {}),
    }
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
phase(PHASES.WRITE)

const writtenOfGroupMap = new Map()
for (const group of groups) writtenOfGroupMap.set(group.group, writtenAfterItsEarlierGroups(group))

return { groups: await Promise.all(groups.map(group => writtenOfGroupMap.get(group.group))) }

function writerMessageOf(group) {
  const planned = theArguments.planned
  return [
    `${LABELS.DESIGN} ${forward(planned.design)}`,
    `${LABELS.MIGRATION} ${forward(planned.migration)}`,
    `${LABELS.MIGRATION_GROUP} ${group.group}`,
    `${LABELS.REPOSITORY} ${planned.repository ? forward(planned.repository) : NONE}`,
    `${LABELS.OPEN_QUESTIONS} ${joinedOrNone(planned.openQuestions)}`,
    `${LABELS.LEFT_FILES} ${joinedOrNone(theArguments.leftFilesOf(group))}`,
    ...(theArguments.roundReview ? [`${LABELS.ROUND_REVIEW} ${theArguments.roundReview}`] : []),
    `${LABELS.COMMIT} ${COMMIT_BY_THE_SESSION}`,
  ].join('\n')
}

function isAWriterAnswer(returned) {
  return Boolean(returned) && [OUTCOMES.FINISHED, OUTCOMES.STOPPED].includes(returned.outcome)
}

function notWrittenOf(group, outcome, extra) {
  return { group: group.group, dependsOn: group.dependsOn, outcome, files: [], steps: [], filled: [], tests: [], ...extra }
}

async function writtenGroup(group) {
  const options = theArguments.writerOptionsFor(group)
  const returned = await agent(writerMessageOf(group), options).catch(() => null)
  if (!isAWriterAnswer(returned)) {
    log(`the ${options.label} call returned nothing usable, so its group is not written and no later group it touches starts`)
    return notWrittenOf(group, OUTCOMES.NO_ANSWER, {})
  }
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
    ...(returned.outcome === OUTCOMES.STOPPED ? { stop: returned.stop || null } : {}),
  }
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
