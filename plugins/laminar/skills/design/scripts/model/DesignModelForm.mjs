export const KINDS = Object.freeze({ CREATED: "created", MOVED: "moved", MODIFIED: "modified", REMOVED: "removed", UNCHANGED: "unchanged" });

export const DOES = Object.freeze({ COMPUTES: "computes", COORDINATES: "coordinates", TRANSLATES: "translates" });

export const AUTONOMOUS_ANSWERS = Object.freeze({ DEFAULT: "default", STOP: "stop", OPEN: "open" });

const FORECAST_LEVELS = Object.freeze(["low", "medium", "high"]);

const FORECAST_CHANGES = Object.freeze(["new variant", "new rule", "new caller", "replaced technology", "removal"]);

const FORECAST_EVIDENCE = Object.freeze(["domain", "roadmap", "churn", "none"]);

const DEPTH_TAKERS = Object.freeze(["user", "forecast", "designer"]);

export const ANSWER_GIVERS = Object.freeze({ USER: "user", DEFAULT: "default", DELEGATE: "delegate" });

export const FINDING_REASONS = Object.freeze(["outside the change", "question to the author", "project convention", "exempt by the book", "fix apart"]);

export const STOP_REASONS = Object.freeze(["input-nothing-provides", "signature-the-stack-cannot-carry", "test-that-cannot-reach-its-branch", "behavior-the-design-did-not-decide", "migration-order-cannot-build", "fix-changes-the-model"]);

const SHOWN_VALUE_LENGTH = 40;

const TEXT = Object.freeze({ form: "text" });

const TEXT_WITH_NO_SPACE = Object.freeze({ form: "text", noSpace: true });

const TRUE_OR_FALSE = Object.freeze({ form: "flag" });

const NUMBER = Object.freeze({ form: "number" });

const TEXT_OR_NUMBER = Object.freeze({ form: "text or number" });

const TEXTS = Object.freeze({ form: "list", item: TEXT });

const createTextOf = values => ({ form: "text", values });

const createListOf = item => ({ form: "list", item });

const createObjectOf = keys => ({ form: "object", keys });

const METHOD_FORM = createObjectOf({
  visibility: TEXT, name: TEXT, returns: TEXT, body: TEXT, oldName: TEXT, unchanged: TRUE_OR_FALSE, uses: TEXTS, calls: TEXTS,
  parameters: createListOf(createObjectOf({ name: TEXT, type: TEXT })),
});

const CLASS_FORM = createObjectOf({
  file: TEXT, kindWord: TEXT, name: TEXT, zone: TEXT, does: createTextOf(Object.values(DOES)), exposed: TRUE_OR_FALSE, oldName: TEXT, group: NUMBER,
  extends: TEXTS, implements: TEXTS, removed: TEXTS, addedForFindings: createListOf(NUMBER),
  fields: createListOf(createObjectOf({ name: TEXT, type: TEXT, oldName: TEXT })),
  methods: createListOf(METHOD_FORM),
});

const FOLDER_FORM = createObjectOf({
  path: TEXT, kind: createTextOf(Object.values(KINDS)),
  children: createListOf(createObjectOf({ name: TEXT, kind: createTextOf(Object.values(KINDS)), oldPath: TEXT, removedClasses: TEXTS })),
});

const FORECAST_FORM = createObjectOf({
  sixMonths: createTextOf(FORECAST_LEVELS), oneYear: createTextOf(FORECAST_LEVELS), threeYears: createTextOf(FORECAST_LEVELS),
  change: createTextOf(FORECAST_CHANGES), evidence: createTextOf(FORECAST_EVIDENCE), reason: TEXT,
});

const DECISIONS_FORM = createObjectOf({
  conventions: createObjectOf({ folder: TEXT, found: TRUE_OR_FALSE, files: TEXTS, zoneOrder: TEXT, testNameForms: TEXTS }),
  owners: createListOf(createObjectOf({
    decision: TEXT, owner: TEXT, placement: TEXT, callers: TEXTS, forecast: FORECAST_FORM,
    depth: createObjectOf({ shape: TEXT, takenBy: createTextOf(DEPTH_TAKERS), reason: TEXT }),
  })),
  entries: createListOf(createObjectOf({
    entry: TEXT, changed: TRUE_OR_FALSE, reads: TEXTS, handler: TEXT,
    validates: createListOf(createObjectOf({ data: TEXT, check: TEXT, at: TEXT })),
    invariants: createListOf(createObjectOf({ type: TEXT, carries: TEXT })),
    responses: createListOf(createObjectOf({ outcome: TEXT, status: TEXT_OR_NUMBER, type: TEXT, handledAt: TEXT })),
  })),
  exits: createListOf(createObjectOf({
    exit: TEXT, from: TEXT, does: TEXT,
    failure: createObjectOf({ absent: TEXT, failed: TEXT, handledAt: TEXT, question: TEXT }),
  })),
  tests: createObjectOf({
    integration: createListOf(createObjectOf({ entry: TEXT, file: TEXT, substitutes: TEXTS, tests: TEXTS })),
    "unit": createListOf(createObjectOf({ "class": TEXT, file: TEXT, tests: TEXTS })),
  }),
  questions: createListOf(createObjectOf({
    id: TEXT_WITH_NO_SPACE, fact: TEXT, recommendation: TEXT, autonomous: createTextOf(Object.values(AUTONOMOUS_ANSWERS)),
    options: createListOf(createObjectOf({ name: TEXT, shape: TEXT })),
    answer: createObjectOf({ option: TEXT, by: createTextOf(Object.values(ANSWER_GIVERS)), says: TEXT }),
  })),
  stops: createListOf(createObjectOf({ reason: createTextOf(STOP_REASONS), at: TEXT, says: TEXT, plan: NUMBER, round: NUMBER })),
  findings: createListOf(createObjectOf({ run: NUMBER, number: NUMBER, check: TEXT, closedBy: TEXT, reason: TEXT, says: TEXT, decidedBy: TEXT, openAfterCeiling: TEXT })),
  existingDefects: createListOf(createObjectOf({ class: TEXT, member: TEXT, defect: TEXT, fix: TEXT, notFixed: TEXT, group: NUMBER })),
  scriptCases: createListOf(createObjectOf({ code: TEXT, name: TEXT, text: TEXT, reason: TEXT })),
});

const DESIGN_MODEL_FORM = createObjectOf({ version: NUMBER, folders: createListOf(FOLDER_FORM), classes: createListOf(CLASS_FORM), decisions: DECISIONS_FORM });

const isAnObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

const showValue = value => {
  const shown = JSON.stringify(value);
  return shown.length > SHOWN_VALUE_LENGTH ? `${shown.slice(0, SHOWN_VALUE_LENGTH)}...` : shown;
};

const joinKeyPath = (path, key) => (path ? `${path}.${key}` : key);

const describeTextProblem = (value, form) => {
  if (typeof value !== "string") return "a text";
  if (form.noSpace && /\s/.test(value)) return "a text with no space";
  if (form.values && !form.values.includes(value)) return `1 of ${form.values.join(", ")}`;
  return null;
};

const describeExpectedForm = (value, form) => {
  if (form.form === "text") return describeTextProblem(value, form);
  if (form.form === "flag") return typeof value === "boolean" ? null : "true or false";
  if (form.form === "number") return Number.isFinite(value) ? null : "a number";
  if (form.form === "text or number") return typeof value === "string" || Number.isFinite(value) ? null : "a text or a number";
  if (form.form === "list") return Array.isArray(value) ? null : "a list";
  return isAnObject(value) ? null : "an object";
};

const collectFormProblems = (value, form, path, problems) => {
  if (value === undefined) return;

  const expected = value === null ? "no null" : describeExpectedForm(value, form);
  if (expected) {
    problems.push(`${path || "the top level"}: ${showValue(value)}, where ${expected} is expected`);
    return;
  }
  if (form.form === "list") value.forEach((item, at) => collectFormProblems(item, form.item, `${path}[${at}]`, problems));
  if (form.form === "object") {
    for (const [key, keyForm] of Object.entries(form.keys)) collectFormProblems(value[key], keyForm, joinKeyPath(path, key), problems);
  }
};

export const findDesignModelFormProblems = given => {
  if (given === undefined) return ["the top level: no value, where an object is expected"];

  const problems = [];
  collectFormProblems(given, DESIGN_MODEL_FORM, "", problems);
  return problems;
};
