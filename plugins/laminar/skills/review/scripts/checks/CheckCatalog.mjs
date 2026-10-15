export const TRACKS = Object.freeze({
  SIMPLICITY: "SIMPLICITY",
  DESIGN: "DESIGN",
  PREVENTION: "PREVENTION",
  TEST_METHOD: "TEST_METHOD",
  TEST_PLAN: "TEST_PLAN",
  PERFORMANCE: "PERFORMANCE",
  DECISION: "DECISION",
  COMMENT: "COMMENT",
  IO_PATHS: "IO_PATHS",
  ENTRY_BOUNDARY: "ENTRY_BOUNDARY",
  BOUNDARY: "BOUNDARY",
});

export const GATE_KINDS = Object.freeze({ NONE: "NONE", SCREEN: "SCREEN", FACT: "FACT", MEASURE: "MEASURE" });

export const SCREEN_FIELDS = Object.freeze([
  "repeatsWork",
  "callsOutsideProcess",
  "createsReusableResource",
  "changesStateBeyondTheCall",
  "encodesCaseAsPrimitiveOrFallback",
  "signalsFailureAsValueOrError",
  "recoversFromFailureInPlace",
  "namesMechanism",
  "decidesBusinessRule",
]);

const createScreenGate = (...fields) => ({ kind: GATE_KINDS.SCREEN, fields });
const createFactGate = field => ({ kind: GATE_KINDS.FACT, fields: [field] });
const createNoGate = () => ({ kind: GATE_KINDS.NONE, fields: [] });
const createMeasureGate = (field, allowed) => ({ kind: GATE_KINDS.MEASURE, fields: [field], allowed });

const OPEN_CONSTRUCTS_ALLOWED = 3;

const PHASE_MARKS_ALLOWED = 0;

export const CHECKS_BY_ID_MAP = Object.freeze({
  S1: { id: "S1", name: "Incomplete Mental Model", track: TRACKS.DECISION, gate: createNoGate() },
  S2: { id: "S2", name: "Prediction Failure", track: TRACKS.SIMPLICITY, gate: createNoGate() },
  S4: { id: "S4", name: "Compression Failure", track: TRACKS.SIMPLICITY, gate: createMeasureGate("phaseMarks", PHASE_MARKS_ALLOWED) },
  S5: { id: "S5", name: "Unnamed Part Failure", track: TRACKS.SIMPLICITY, gate: createNoGate() },
  S6: { id: "S6", name: "Open Construct Overload", track: TRACKS.SIMPLICITY, gate: createMeasureGate("nestingDepth", OPEN_CONSTRUCTS_ALLOWED) },
  D1: { id: "D1", name: "Over-Extraction", track: TRACKS.DESIGN, gate: createNoGate() },
  D2: { id: "D2", name: "Scoped Parameters", track: TRACKS.DESIGN, gate: createNoGate() },
  D3: { id: "D3", name: "Leaked Details", track: TRACKS.DESIGN, gate: createScreenGate("namesMechanism") },
  D4: { id: "D4", name: "Missing Boundary", track: TRACKS.DESIGN, gate: createNoGate() },
  CP1: { id: "CP1", name: "Exclude Illegal States", track: TRACKS.PREVENTION, gate: createScreenGate("encodesCaseAsPrimitiveOrFallback") },
  CP3: { id: "CP3", name: "Protect the State", track: TRACKS.PREVENTION, gate: createScreenGate("changesStateBeyondTheCall") },
  CP4: { id: "CP4", name: "Remove Edge Cases", track: TRACKS.PREVENTION, gate: createScreenGate("signalsFailureAsValueOrError") },
  CP5: { id: "CP5", name: "Remove Hidden Dependencies", track: TRACKS.PREVENTION, gate: createFactGate("hiddenDependency") },
  CP6: { id: "CP6", name: "Validate at the Boundary", track: TRACKS.BOUNDARY, gate: createNoGate() },
  CP7: { id: "CP7", name: "Fail Fast", track: TRACKS.PREVENTION, gate: createScreenGate("recoversFromFailureInPlace") },
  CD2: { id: "CD2", name: "Test Behavior", track: TRACKS.TEST_METHOD, gate: createNoGate() },
  CD4: { id: "CD4", name: "Integration Test Needed", track: TRACKS.TEST_PLAN, gate: createNoGate() },
  CD5: { id: "CD5", name: "Unit Test Needed", track: TRACKS.TEST_PLAN, gate: createNoGate() },
  CD6: { id: "CD6", name: "Unit Test to Remove", track: TRACKS.TEST_PLAN, gate: createNoGate() },
  CD7: { id: "CD7", name: "Partial Path Test", track: TRACKS.TEST_PLAN, gate: createNoGate() },
  P1: { id: "P1", name: "Looped I/O", track: TRACKS.IO_PATHS, gate: createNoGate() },
  P2: { id: "P2", name: "Repeated Retrieval", track: TRACKS.PERFORMANCE, gate: createScreenGate("repeatsWork", "callsOutsideProcess") },
  P3: { id: "P3", name: "Excess Retrieval", track: TRACKS.PERFORMANCE, gate: createScreenGate("callsOutsideProcess") },
  P4: { id: "P4", name: "Resource Recreation", track: TRACKS.PERFORMANCE, gate: createScreenGate("createsReusableResource") },
});

export const SCREEN_FIELDS_BY_CHECK_MAP = Object.freeze(Object.fromEntries(Object.values(CHECKS_BY_ID_MAP)
  .filter(check => check.gate.kind === GATE_KINDS.SCREEN)
  .map(check => [check.id, check.gate.fields])));

export const CHECK_NAMES = Object.freeze(Object.fromEntries(Object.values(CHECKS_BY_ID_MAP).map(check => [check.id, check.name])));
