export const meta = {
  name: 'laminar-review-verify',
  description: 'Laminar Code Review: try to show each possible finding and each covered path of the draft wrong, then rule keep, lower, combine or reject on every refuted possible finding of an item, and keep or reject on every refuted covered path',
  phases: [
    { title: 'Refute', detail: 'one refuter agent per possible finding and per covered path the merge listed reads its refute file and answers refuted or not refuted, with the line, the rule and the reason; a not refuted possible finding stands as its judge wrote it' },
    { title: 'Verify', detail: 'one verifier agent per item that holds a refuted possible finding reads the verify file of the item with the refutations and rules keep, lower, combine or reject on each refuted possible finding; each item goes on to its verifier call as soon as its refuter calls end, and what no attempt answered is listed as not verified' },
  ],
}

const PLUGIN = 'laminar'
const MAX_PROMPT_BYTES = 20000
const REFUTER_ATTEMPTS = 2
const VERIFIER_ATTEMPTS = 2
const REFUTER_STALL_MS = 300000
const VERIFIER_STALL_MS = 600000

const ROLES = { REFUTER: 'refuter', VERIFIER: 'verifier' }

const ROLE_ALIASES = { reader: ROLES.VERIFIER }

const DEFAULT_MODELS = { refuter: 'sonnet', verifier: 'opus' }

const DEFAULT_EFFORT = { refuter: 'medium', verifier: 'medium' }

const PHASES = { REFUTE: 'Refute', VERIFY: 'Verify' }

const STAGES = { REFUTER: 'refuter', VERIFIER: 'verifier' }

const REFUTATION_ANSWERS = { REFUTED: 'refuted', NOT_REFUTED: 'not refuted' }

const DECISIONS = ['keep', 'lower', 'combine', 'reject']

const CONFIDENCES = ['high', 'moderate', 'low']

const LABELS = { REFUTATION: 'Refutation:', VERDICTS_NEEDED: 'Verdicts needed:' }

const FIELD_SEPARATOR = ' · '

const NO_RULE = 'none'

const THE_NUMBER = '{number}'
const THE_ITEM = '{item}'

const REFUTATION_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', enum: [REFUTATION_ANSWERS.REFUTED, REFUTATION_ANSWERS.NOT_REFUTED] },
    line: { type: 'string' },
    rule: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['answer', 'line', 'rule', 'reason'],
}

const A_VERDICT = {
  type: 'object',
  properties: {
    possibleFinding: { type: 'integer' },
    decision: { type: 'string', enum: DECISIONS },
    confidence: { type: 'string', enum: CONFIDENCES },
    fact: { type: 'string' },
    whatWouldConfirm: { type: 'string' },
    inChange: { type: 'boolean' },
    checks: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['possibleFinding', 'decision', 'fact'],
}

const VERIFIER_SCHEMA = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: A_VERDICT } },
  required: ['verdicts'],
}

const forward = given => String(given == null ? '' : given).replace(/\\/g, '/')

const oneLine = given => String(given == null ? '' : given).replace(/\s+/g, ' ').trim()

const withTheAliasesResolved = given => Object.fromEntries(Object.entries(given || {})
  .map(([role, value]) => [ROLE_ALIASES[role] || role, value]))

const isInsideTheIntervals = (intervals, number) => (intervals || []).some(([from, to]) => number >= from && number <= to)

const possibleFindingNumberOf = listed => Number(Array.isArray(listed) ? listed[0] : listed)

const toItem = ([itemNumber, possibleFindings]) => ({
  number: itemNumber,
  possibleFindings: (possibleFindings || []).map(listed => ({ number: possibleFindingNumberOf(listed) })),
})

class WorkflowArguments {
  constructor(given) {
    const fields = given || {}
    this.runFolder = forward(fields.merged?.runFolder || fields.runFolder || '')
    this.merged = fields.merged || null
    this.models = withTheAliasesResolved(fields.models)
    this.effort = withTheAliasesResolved(fields.effort)
    this.waveNumber = Number(fields.wave) > 0 ? Math.floor(Number(fields.wave)) : null
  }

  get verify() {
    return (this.merged && this.merged.verify) || null
  }

  get waves() {
    return (this.verify && this.verify.waves) || []
  }

  get wave() {
    if (this.waveNumber === null) return null
    return this.waves.find(wave => wave.number === this.waveNumber) || null
  }

  get items() {
    const every = (this.verify.list || []).map(toItem)
    return this.wave ? every.filter(item => isInsideTheIntervals(this.wave.items, item.number)) : every
  }

  refuteFileOf(possibleFinding) {
    return this.fileAt(forward(this.verify.fileForms.refute).replace(THE_NUMBER, String(possibleFinding.number)))
  }

  verifyFileOf(item) {
    return this.fileAt(forward(this.verify.fileForms.verifier).replace(THE_ITEM, String(item.number)))
  }

  fileAt(relative) { return `${this.runFolder}/${relative}` }
}

class Agents {
  constructor(given) {
    this.models = given.models || {}
    this.effort = given.effort || {}
  }

  typeOf(role) { return `${PLUGIN}:review-${role}` }

  optionsFor(role, extra) {
    return {
      ...extra,
      agentType: this.typeOf(role),
      model: this.models[role] || DEFAULT_MODELS[role],
      effort: this.effort[role] || DEFAULT_EFFORT[role],
    }
  }
}

const sized = (prompt, label) => {
  if (prompt.length > MAX_PROMPT_BYTES) log(`the ${label} prompt is ${prompt.length} bytes, over the ${MAX_PROMPT_BYTES} byte bar`)
  return prompt
}

const NOTHING_VERIFIED = { verdicts: [], refutations: [], notVerified: [] }

const stoppedWith = words => ({ ...NOTHING_VERIFIED, stopped: words })

const theArguments = new WorkflowArguments(args)
const theAgents = new Agents(theArguments)

if (!theArguments.runFolder) return stoppedWith('the call did not run: it needs the run folder the merge wrote')

if (!theArguments.verify) return stoppedWith('the call did not run: pass the merge command\'s RESULT object as merged')

if (theArguments.waveNumber === null && theArguments.waves.length > 1) return stoppedWith(`the call did not run: merged plans ${theArguments.waves.length} verify waves, so make 1 call per wave with wave 1 to ${theArguments.waves.length}`)

if (theArguments.waveNumber !== null && !theArguments.wave) return stoppedWith(`the call did not run: merged plans no verify wave ${theArguments.waveNumber}`)

const items = theArguments.items

if (!items.length) {
  log('the merge listed no possible finding for the refuter, so no agent ran')
  return { ...(theArguments.wave ? { wave: theArguments.wave.number } : {}), ...NOTHING_VERIFIED }
}

if (theArguments.wave) log(`verify wave ${theArguments.wave.number} of ${theArguments.waves.length}`)
log(`${items.length} item(s) with ${items.reduce((sum, item) => sum + item.possibleFindings.length, 0)} possible finding(s) for the refuter`)

let verifyPhaseEntered = false
phase(PHASES.REFUTE)
const ruled = await pipeline(items, item => refutedItem(item), refuted => verifiedItem(refuted))

return {
  ...(theArguments.wave ? { wave: theArguments.wave.number } : {}),
  verdicts: ruled.flatMap(itemRuled => itemRuled.verdicts),
  refutations: ruled.flatMap(itemRuled => itemRuled.refutations),
  notVerified: ruled.flatMap(itemRuled => itemRuled.notVerified),
}

async function answeredWithin(attempts, label, message, options, isUsable) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const returned = await agent(message, options).catch(() => null)
    if (!isUsable(returned)) continue
    if (attempt > 1) log(`the ${label} call answered on attempt ${attempt} of ${attempts}`)
    return returned
  }
  log(`the ${label} call returned nothing usable in ${attempts} attempt(s), so it is listed as not verified`)
  return null
}

function isAnAnswer(returned) {
  return Boolean(returned) && Object.values(REFUTATION_ANSWERS).includes(returned.answer)
}

async function refutationOf(item, possibleFinding) {
  const label = `refute ${possibleFinding.number} of item ${item.number}`
  const options = theAgents.optionsFor(ROLES.REFUTER, { phase: PHASES.REFUTE, label, schema: REFUTATION_SCHEMA, stallMs: REFUTER_STALL_MS })
  const returned = await answeredWithin(REFUTER_ATTEMPTS, label, theArguments.refuteFileOf(possibleFinding), options, isAnAnswer)
  if (!returned) return null
  return { possibleFinding: possibleFinding.number, answer: returned.answer, line: oneLine(returned.line), rule: oneLine(returned.rule), reason: oneLine(returned.reason) }
}

async function refutedItem(item) {
  const answered = await parallel(item.possibleFindings.map(possibleFinding => () => refutationOf(item, possibleFinding)))
  const refutations = answered.filter(Boolean)
  const answeredNumbers = new Set(refutations.map(refutation => refutation.possibleFinding))
  const notVerified = item.possibleFindings
    .filter(possibleFinding => !answeredNumbers.has(possibleFinding.number))
    .map(possibleFinding => ({ possibleFinding: possibleFinding.number, stage: STAGES.REFUTER }))
  return { item, refutations, notVerified }
}

function refutationLineOf(refutation) {
  return `${LABELS.REFUTATION} ${[refutation.possibleFinding, refutation.answer, refutation.line, refutation.rule || NO_RULE, refutation.reason].join(FIELD_SEPARATOR)}`
}

function verifierMessageOf(item, refutations, neededNumbers) {
  return [
    theArguments.verifyFileOf(item),
    ...refutations.map(refutationLineOf),
    `${LABELS.VERDICTS_NEEDED} ${neededNumbers.join(', ')}`,
  ].join('\n')
}

function enterTheVerifyPhase() {
  if (verifyPhaseEntered) return
  verifyPhaseEntered = true
  phase(PHASES.VERIFY)
}

function verdictsOnTheNeededNumbers(returned, neededNumbers, label) {
  const verdictsByNumber = new Map()
  for (const verdict of returned.verdicts) {
    const number = Number(verdict && verdict.possibleFinding)
    if (!neededNumbers.includes(number)) {
      log(`the ${label} call ruled on possible finding ${verdict && verdict.possibleFinding}, which is not refuted in this item, so the verdict is dropped`)
      continue
    }
    if (!DECISIONS.includes(verdict.decision)) {
      log(`the ${label} call ruled ${verdict.decision} on possible finding ${number}, which is no verdict, so it is dropped`)
      continue
    }
    if (verdictsByNumber.has(number)) {
      log(`the ${label} call ruled twice on possible finding ${number}, so the second verdict is dropped`)
      continue
    }
    verdictsByNumber.set(number, { ...verdict, possibleFinding: number })
  }
  return verdictsByNumber
}

function holdsAVerdictOnANeededNumber(neededNumbers) {
  return returned => Boolean(returned) && Array.isArray(returned.verdicts)
    && returned.verdicts.some(verdict => verdict && neededNumbers.includes(Number(verdict.possibleFinding)) && DECISIONS.includes(verdict.decision))
}

async function verifiedItem({ item, refutations, notVerified }) {
  const neededNumbers = refutations.filter(refutation => refutation.answer === REFUTATION_ANSWERS.REFUTED).map(refutation => refutation.possibleFinding)
  if (!neededNumbers.length) return { verdicts: [], refutations, notVerified }
  enterTheVerifyPhase()
  const label = `verify item ${item.number}`
  const message = sized(verifierMessageOf(item, refutations, neededNumbers), label)
  const options = theAgents.optionsFor(ROLES.VERIFIER, { phase: PHASES.VERIFY, label, schema: VERIFIER_SCHEMA, stallMs: VERIFIER_STALL_MS })
  const returned = await answeredWithin(VERIFIER_ATTEMPTS, label, message, options, holdsAVerdictOnANeededNumber(neededNumbers))
  const verdictsByNumber = returned ? verdictsOnTheNeededNumbers(returned, neededNumbers, label) : new Map()
  const verdicts = neededNumbers.filter(number => verdictsByNumber.has(number)).map(number => ({ ...verdictsByNumber.get(number) }))
  const unruled = neededNumbers
    .filter(number => !verdictsByNumber.has(number))
    .map(number => ({ possibleFinding: number, stage: STAGES.VERIFIER }))
  return { verdicts, refutations, notVerified: [...notVerified, ...unruled] }
}
