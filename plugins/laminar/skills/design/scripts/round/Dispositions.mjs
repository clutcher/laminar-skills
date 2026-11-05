import { FINDING_REASONS } from "../model/DesignModelForm.mjs";
import { isAText, readList } from "../model/DesignModel.mjs";
import { PLACEMENT_SCALES, RoundStop } from "./RunFolder.mjs";

export const SENT_TO = Object.freeze({ DESIGNER: "designer", WRITER: "writer" });

export const ROUND_DEFECT_CODES = Object.freeze({
  DISPOSITION_MISSING: "disposition-missing",
  DISPOSITION_NUMBER_UNKNOWN: "disposition-number-unknown",
  DISPOSITION_REASON_OUTSIDE_LIST: "disposition-reason-outside-list",
  DISPOSITION_NOT_AUTONOMOUS: "disposition-not-autonomous",
  OUTSIDE_THE_CHANGE_BUT_CHANGED: "outside-the-change-but-changed",
  PROJECT_CONVENTION_ON_A_BOOK_RULE: "project-convention-on-a-book-rule",
  QUESTION_UNANSWERED: "question-unanswered",
  PLACEMENT_FINDING_TO_WRITER: "placement-finding-to-writer",
  OPEN_FINDING_ON_UNCHANGED_ABSTRACTION: "open-finding-on-unchanged-abstraction",
  OPEN_KEY_ABSENT_FROM_MODEL: "open-key-absent-from-model",
  RENAMED_KEY_UNKNOWN: "renamed-key-unknown",
  RENAMED_NAME_ABSENT_FROM_MODEL: "renamed-name-absent-from-model",
});

const OUTSIDE_THE_CHANGE = "outside the change";

const PROJECT_CONVENTION = "project convention";

const QUESTION_TO_THE_AUTHOR = "question to the author";

// The 2 reason classes that a script checks, so autonomous mode may take them without a user.
const AUTONOMOUS_REASONS = new Set([OUTSIDE_THE_CHANGE, PROJECT_CONVENTION]);

// The checks that rest on a rule narrower than the book; every check of the review today rests on the book, so a project convention clears none.
const CHECKS_NARROWER_THAN_THE_BOOK = new Set();

const ENDING_KEYS = Object.freeze(["to", "reason", "question"]);

const FIRST_GROUP = 1;

export const createRoundDefect = (code, displayName, text) => ({ code, displayName, text });

const describeTheDisposition = (disposition, at) => `dispositions[${at}] (item ${disposition.number})`;

// A rename names the display name of an earlier round and the new display name, because the base never held the old name and no oldName can record it.
const isARename = disposition => disposition !== null && typeof disposition === "object" && disposition.renamedFrom !== undefined;

const findRenameFormProblem = (rename, at) => {
  if (!isAText(rename.renamedFrom) || !isAText(rename.displayName)) return `dispositions[${at}]: a rename needs the text of renamedFrom and displayName`;
  return null;
};

const findFormProblem = (disposition, at) => {
  if (disposition === null || typeof disposition !== "object") return `dispositions[${at}] is no object`;
  if (isARename(disposition)) return findRenameFormProblem(disposition, at);
  if (!Number.isInteger(disposition.number)) return `dispositions[${at}] holds no whole number under number`;
  if (disposition.check !== undefined && !isAText(disposition.check)) return `${describeTheDisposition(disposition, at)}: check is no text`;
  const endingKeys = ENDING_KEYS.filter(key => disposition[key] !== undefined);
  if (endingKeys.length !== 1) return `${describeTheDisposition(disposition, at)} holds ${endingKeys.join(" and ") || "none"} of ${ENDING_KEYS.join(", ")}, and holds exactly 1`;
  if (disposition.to !== undefined && !Object.values(SENT_TO).includes(disposition.to)) return `${describeTheDisposition(disposition, at)}: to is ${JSON.stringify(disposition.to)}, and is 1 of ${Object.values(SENT_TO).join(", ")}`;
  if (disposition.reason !== undefined && (!isAText(disposition.reason) || !isAText(disposition.says))) return `${describeTheDisposition(disposition, at)}: a reason needs the text of the reason and says`;
  if (disposition.question !== undefined && !isAText(disposition.question)) return `${describeTheDisposition(disposition, at)}: question is no text`;
  return null;
};

export const checkDispositionsForm = given => {
  if (!Array.isArray(given)) throw new RoundStop("dispositions: the file holds no JSON list");
  const problems = given.map(findFormProblem).filter(Boolean);
  if (problems.length) throw new RoundStop(`dispositions: the file is malformed:\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  return { dispositions: given.filter(disposition => !isARename(disposition)), renames: given.filter(isARename) };
};

const isAnsweredInTheModel = (model, questionId) => Boolean(model)
  && readList(model.decisions.questions).some(question => question.id === questionId && question.answer && isAText(question.answer.option));

const readGroupOfTheFinding = (model, finding) => {
  const theClass = model ? model.findClass(finding.displayName) : null;
  return theClass && Number.isFinite(theClass.group) ? theClass.group : FIRST_GROUP;
};

// The file of a finding, from its first place with a line, so a finding on a class that the model does not hold, such as a test class, still names its file.
const readFileOfTheFinding = finding => {
  const place = finding.places.find(other => other.file && other.line !== null);
  return place ? place.file : "";
};

const resolveTheDisposition = (disposition, finding, model) => {
  const resolved = { number: disposition.number, check: finding.check, displayName: finding.displayName, scale: finding.scale, testCode: finding.testCode, file: readFileOfTheFinding(finding) };
  if (disposition.to === SENT_TO.WRITER) return { ...resolved, to: SENT_TO.WRITER, group: readGroupOfTheFinding(model, finding) };
  if (disposition.to) return { ...resolved, to: disposition.to };
  if (disposition.reason !== undefined) return { ...resolved, reason: disposition.reason, says: disposition.says, ...(isAText(disposition.decidedBy) ? { decidedBy: disposition.decidedBy } : {}) };
  return { ...resolved, question: disposition.question };
};

const findDefectsOfTheFinding = (resolved, finding, context) => {
  const defects = [];
  const addDefect = (code, text) => defects.push(createRoundDefect(code, finding.displayName, text));
  if (resolved.to === SENT_TO.WRITER && PLACEMENT_SCALES.has(finding.scale)) addDefect(ROUND_DEFECT_CODES.PLACEMENT_FINDING_TO_WRITER, `item ${resolved.number} is at the ${finding.scale} scale, which judges a placement, so it goes to the designer`);
  if (resolved.question !== undefined && !isAnsweredInTheModel(context.model, resolved.question)) addDefect(ROUND_DEFECT_CODES.QUESTION_UNANSWERED, `item ${resolved.number} names the question ${resolved.question}, which ${context.model ? "the model holds with no answer, or does not hold" : "no --model gives"}`);
  if (resolved.reason === undefined) return defects;

  if (!FINDING_REASONS.includes(resolved.reason)) addDefect(ROUND_DEFECT_CODES.DISPOSITION_REASON_OUTSIDE_LIST, `${JSON.stringify(resolved.reason)} is not 1 of ${FINDING_REASONS.join(", ")}`);
  // A reason that the calling session decided stands in autonomous mode too, because the session decided it, not the designer; so does a question to the author on an item to consider, which claims no defect.
  const isAQuestionToConsider = finding.toConsider && resolved.reason === QUESTION_TO_THE_AUTHOR;
  if (context.autonomous && FINDING_REASONS.includes(resolved.reason) && !AUTONOMOUS_REASONS.has(resolved.reason) && resolved.decidedBy === undefined && !isAQuestionToConsider) addDefect(ROUND_DEFECT_CODES.DISPOSITION_NOT_AUTONOMOUS, `item ${resolved.number} takes ${resolved.reason}, and autonomous mode takes only ${[...AUTONOMOUS_REASONS].join(" or ")}`);
  if (resolved.reason === PROJECT_CONVENTION && !CHECKS_NARROWER_THAN_THE_BOOK.has(finding.check)) addDefect(ROUND_DEFECT_CODES.PROJECT_CONVENTION_ON_A_BOOK_RULE, `item ${resolved.number} takes ${PROJECT_CONVENTION} on ${finding.check}, a check that rests on the book`);
  if (resolved.reason === OUTSIDE_THE_CHANGE && context.findChangedPlace) {
    const changedPlace = context.findChangedPlace(finding.places);
    if (changedPlace) addDefect(ROUND_DEFECT_CODES.OUTSIDE_THE_CHANGE_BUT_CHANGED, `item ${resolved.number} is left as ${OUTSIDE_THE_CHANGE}, and the change since the base commit changed ${changedPlace}`);
  }
  return defects;
};

const listFindingsOfTheDisposition = (item, disposition) => item.findings.filter(finding => disposition.check === undefined || finding.check === disposition.check);

// Each disposition applies to every finding of its item, or to the findings of its check where 1 item holds 2 checks with 2 dispositions.
export const resolveDispositions = (given, items, context) => {
  const dispositionOfFindingMap = new Map();
  const defects = [];
  for (const disposition of given) {
    const item = items.find(other => other.number === disposition.number);
    const findings = item ? listFindingsOfTheDisposition(item, disposition) : [];
    if (!findings.length) {
      const checkWords = disposition.check === undefined ? "" : ` with the check ${disposition.check}`;
      defects.push(createRoundDefect(ROUND_DEFECT_CODES.DISPOSITION_NUMBER_UNKNOWN, "", `review.md holds no item ${disposition.number}${checkWords}`));
      continue;
    }
    for (const finding of findings) {
      const resolved = resolveTheDisposition(disposition, finding, context.model);
      dispositionOfFindingMap.set(finding.index, resolved);
      defects.push(...findDefectsOfTheFinding(resolved, finding, context));
    }
  }
  return { dispositionOfFindingMap, defects };
};

export const isSent = disposition => Boolean(disposition && disposition.to);
