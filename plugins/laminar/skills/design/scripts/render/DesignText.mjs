import { ANSWER_GIVERS, DOES, KINDS, OVERRIDE_KINDS, getFileOfTheChild, getFolderPath, isAText, isAnInterface, isLeftUnfixed, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";

const GUESS_EVIDENCE = new Set(["churn", "none"]);

const CODE_FENCE = "```";

const writeCode = text => `\`${text}\``;

const escapeTableCell = text => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const writeConventionsLine = conventions => {
  if (!conventions) return "Project conventions: not recorded in the model.";
  if (conventions.found === false) return `Project conventions: none found in ${writeCode(conventions.folder || "")}; the design follows the default zone order of the design skill and the rules of the skill.`;
  return `Project conventions: ${readList(conventions.files).map(writeCode).join(", ") || "none listed"} from ${writeCode(conventions.folder || "")}; zone order: ${writeCode(conventions.zoneOrder || "default")}.`;
};

// 1 head line per clash with a written project rule, so no question asks it again and the writer reads which rule holds.
const writeOverrideLine = override => (override.kind === OVERRIDE_KINDS.OVERRIDE
  ? `Convention override: ${writeCode(override.project)} wins over ${writeCode(override.codeStyle)}, a rule of the skill code-style marked narrower than the book: "${override.says}"`
  : `Convention contradiction: ${writeCode(override.project)} contradicts ${writeCode(override.codeStyle)}, a design direction of the book, so the design follows the book: "${override.says}"`);

const writeOverrideLines = conventions => readList(conventions?.overrides)
  .filter(override => override.kind === OVERRIDE_KINDS.OVERRIDE || override.kind === OVERRIDE_KINDS.CONTRADICTION)
  .map(writeOverrideLine);

// A proposed rule overrides nothing until the project adds it to its own conventions folder, so the rule of code-style holds for the writers.
const writeProposedRuleSection = conventions => {
  const proposedRules = readList(conventions?.overrides).filter(override => override.kind === OVERRIDE_KINDS.PROPOSED);
  if (!proposedRules.length) return [];

  const lines = ["## Proposed project rules", "", `Each rule below is the answer of the user to its question, for the project to add to ${writeCode(conventions.folder || "")}. The design writes nothing into the repository, so until the project adds the rule, the rule of the skill code-style it names holds for the writers.`, ""];
  for (const proposedRule of proposedRules) {
    lines.push(`### Against ${writeCode(proposedRule.codeStyle)}, question ${writeCode(proposedRule.question)}`, "", `The rule of the skill: "${proposedRule.says}"`, "", `${CODE_FENCE}markdown`, proposedRule.rule, CODE_FENCE, "");
  }
  return lines;
};

const writeParameters = parameters => readList(parameters).map(parameter => (parameter.type ? `${parameter.name}: ${parameter.type}` : parameter.name)).join(", ");

const writeClassMarks = theClass => {
  const marks = [theClass.kindWord || "class", theClass.name];
  if (isAText(theClass.oldName)) marks.push(`(renamed from ${theClass.oldName})`);
  const details = [];
  if (isAText(theClass.zone)) details.push(`zone ${theClass.zone}`);
  if (isAText(theClass.does)) details.push(theClass.does);
  if (theClass.exposed === true) details.push("exposed");
  if (theClass.exposed === false) details.push("inside its folder");
  if (Number.isFinite(theClass.group)) details.push(`group ${theClass.group}`);
  for (const listKey of ["extends", "implements"]) {
    if (readList(theClass[listKey]).length) details.push(`${listKey} ${readList(theClass[listKey]).join(", ")}`);
  }
  return details.length ? `${marks.join(" ")} · ${details.join(" · ")}` : marks.join(" ");
};

const writeMethodLines = (method, indent) => {
  const visibilityMark = method.visibility === "private" ? "-" : "+";
  const renamed = isAText(method.oldName) ? ` (renamed from ${method.oldName})` : "";
  const returns = isAText(method.returns) ? `: ${method.returns}` : "";
  const lines = [`${indent}${visibilityMark} ${method.name}(${writeParameters(method.parameters)})${returns}${renamed}`];
  if (readList(method.calls).length) lines.push(`${indent}    calls ${readList(method.calls).join(", ")}`);
  if (readList(method.uses).length) lines.push(`${indent}    uses ${readList(method.uses).join(", ")}`);
  if (isAText(method.body)) {
    for (const bodyLine of method.body.split("\n")) lines.push(`${indent}    | ${bodyLine}`);
  }
  return lines;
};

const listReferredTypeTexts = theClass => [
  ...readList(theClass.fields).map(field => field.type),
  ...readList(theClass.methods).flatMap(method => [method.returns, ...readList(method.parameters).map(parameter => parameter.type)]),
];

const listReferredClasses = (model, theClass) => [
  ...listReferredTypeTexts(theClass).flatMap(readTypeNames).map(typeName => model.findClassOfTheType(typeName, theClass)),
  ...readList(theClass.methods).flatMap(method => readList(method.calls)).map(called => model.findClass(called)),
];

// The classes that name a class by a field type, a parameter or return type, or a call, so the reader of a created class sees where it is used.
const buildUserNamesOfClassMap = model => {
  const userNamesOfClassMap = new Map(model.classes.map(theClass => [theClass, new Set()]));
  for (const user of model.classes) {
    for (const referredClass of listReferredClasses(model, user)) {
      if (referredClass && referredClass !== user) userNamesOfClassMap.get(referredClass).add(model.getClassDisplayName(user));
    }
  }
  return userNamesOfClassMap;
};

const writeUsedByLine = (model, theClass, userNamesOfClassMap, indent) => {
  if (model.getKindOfClass(theClass) !== KINDS.CREATED) return [];
  const userNames = [...userNamesOfClassMap.get(theClass)];
  const parentNames = [...readList(theClass.implements), ...readList(theClass.extends)].filter(parentName => model.findClassOfTheType(readHeadTypeName(parentName), theClass));
  const throughParents = parentNames.length ? `, and through ${parentNames.join(", ")} by its users` : "";
  return [`${indent}  used by ${userNames.length ? userNames.join(", ") : "no class of the model"}${throughParents}`];
};

// A class that the model holds only because a finding of the run folder names it, so the reader sees why a class with no change of the design stands in the tree.
const writeAddedForFindingsLine = (theClass, indent) => {
  const numbers = readList(theClass.addedForFindings);
  return numbers.length ? [`${indent}  added to the model for the findings ${numbers.join(", ")} of the run folder`] : [];
};

// With the current tree, the tree is the whole end tree, so an interface names the classes of the model that implement it.
const writeImplementedByLine = (model, theClass, indent, currentTree) => {
  if (!currentTree || !isAnInterface(theClass)) return [];
  const implementationNames = model.classes.filter(other => readList(other.implements).some(parentName => readHeadTypeName(parentName) === theClass.name)).map(other => other.name);
  return [`${indent}  implemented by ${implementationNames.length ? implementationNames.join(", ") : "no class of the model"}`];
};

const writeClassLines = (model, theClass, userNamesOfClassMap, indent, currentTree = null) => {
  const lines = [`${indent}${writeClassMarks(theClass)}`, ...writeUsedByLine(model, theClass, userNamesOfClassMap, indent), ...writeImplementedByLine(model, theClass, indent, currentTree), ...writeAddedForFindingsLine(theClass, indent)];
  for (const field of readList(theClass.fields)) lines.push(`${indent}  ${field.name}${field.type ? `: ${field.type}` : ""}${isAText(field.oldName) ? ` (renamed from ${field.oldName})` : ""}`);
  for (const method of readList(theClass.methods)) lines.push(...writeMethodLines(method, `${indent}  `));
  if (readList(theClass.removed).length) lines.push(`${indent}  removes ${readList(theClass.removed).join(", ")}`);
  return lines;
};

const writeChildLine = child => {
  const moved = isAText(child.oldPath) ? ` from ${child.oldPath}` : "";
  const removedClasses = readList(child.removedClasses).length ? ` · removes ${readList(child.removedClasses).join(", ")}` : "";
  return `  ${child.name} [${child.kind}]${moved}${removedClasses}`;
};

const listFilesOfNoFolder = model => {
  const listedFiles = new Set(model.folders.flatMap(folder => readList(folder.children).map(child => getFileOfTheChild(folder, child))));
  return [...new Set(model.classes.map(theClass => theClass.file).filter(file => isAText(file) && !listedFiles.has(file)))];
};

const UNLISTED_MARK = "[unchanged, not in the model]";

// The files of the current tree right inside a modified folder that the model does not list, so the tree shows the whole folder after the change.
const writeUnlistedFileLines = (folder, currentTree) => {
  if (!currentTree || folder.kind !== KINDS.MODIFIED) return [];
  const folderPath = getFolderPath(folder);
  const listedNames = new Set(readList(folder.children).map(child => child.name));
  return currentTree.listFilesUnder(folderPath)
    .filter(file => file.slice(0, file.lastIndexOf("/")) === folderPath && !listedNames.has(file.slice(file.lastIndexOf("/") + 1)))
    .sort()
    .map(file => `  ${file.slice(file.lastIndexOf("/") + 1)} ${UNLISTED_MARK}`);
};

const writeTreeBlock = (model, currentTree) => {
  const userNamesOfClassMap = buildUserNamesOfClassMap(model);
  const lines = [];
  for (const folder of model.folders) {
    lines.push(`${getFolderPath(folder)}/ [${folder.kind}]`);
    for (const child of readList(folder.children)) {
      lines.push(writeChildLine(child));
      for (const theClass of model.classes.filter(other => other.file === getFileOfTheChild(folder, child))) lines.push(...writeClassLines(model, theClass, userNamesOfClassMap, "    ", currentTree));
    }
    lines.push(...writeUnlistedFileLines(folder, currentTree));
  }
  for (const file of listFilesOfNoFolder(model)) {
    lines.push(`${file} [listed in no folder]`);
    for (const theClass of model.classes.filter(other => other.file === file)) lines.push(...writeClassLines(model, theClass, userNamesOfClassMap, "    ", currentTree));
  }
  return ["## Tree", "", CODE_FENCE + "text", ...lines, CODE_FENCE];
};

const writeForecast = forecast => {
  if (!forecast) return "no forecast yet";
  const levels = `6 months ${forecast.sixMonths}, 1 year ${forecast.oneYear}, 3 years ${forecast.threeYears}`;
  const guess = GUESS_EVIDENCE.has(forecast.evidence) ? `, a guess, because its evidence is ${forecast.evidence}` : `, evidence ${forecast.evidence}`;
  return `${levels}; ${forecast.change}${guess}: ${forecast.reason}`;
};

const writeOwnerSection = owners => {
  const lines = ["## Owners", ""];
  if (!owners.length) return [...lines, "None."];
  for (const owner of owners) {
    lines.push(`- ${owner.decision}: owned by ${writeCode(owner.owner)}; callers ${readList(owner.callers).map(writeCode).join(", ") || "none"}.`);
    if (owner.placement) lines.push(`  - Placement: ${owner.placement}`);
    lines.push(`  - Forecast (expectation, not evidence): ${writeForecast(owner.forecast)}`);
    if (owner.depth) lines.push(`  - Depth: ${owner.depth.shape}, taken by ${owner.depth.takenBy}: ${owner.depth.reason}`);
  }
  return lines;
};

const writeTestNames = tests => readList(tests).map(testName => `    - ${writeCode(testName)}`);

const writeEntrySection = (entries, integrations) => {
  const lines = ["## Entries", ""];
  if (!entries.length) return [...lines, "None."];
  for (const entry of entries) {
    lines.push(`### ${writeCode(entry.entry)}`, "");
    lines.push(`- Reads: ${readList(entry.reads).join("; ") || "nothing"}`);
    lines.push(readList(entry.validates).length ? "- Validates:" : "- Validates: nothing");
    for (const validation of readList(entry.validates)) lines.push(`  - ${validation.data}: ${validation.check}, at ${writeCode(validation.at)}`);
    for (const invariant of readList(entry.invariants)) lines.push(`- Invariant: ${writeCode(invariant.type)} carries ${invariant.carries}`);
    for (const response of readList(entry.responses)) lines.push(`- Response: ${response.outcome}: ${response.status}, ${writeCode(response.type)}${isAText(response.handledAt) ? `, handled at ${writeCode(response.handledAt)}` : ""}`);
    lines.push(`- Handler: ${writeCode(entry.handler)}`);
    for (const integration of integrations.filter(other => other.entry === entry.entry)) {
      lines.push(`- Integration tests: ${writeCode(integration.file)}, with substitutes for ${readList(integration.substitutes).map(writeCode).join(", ") || "nothing"}`);
      lines.push(...writeTestNames(integration.tests));
    }
    lines.push("");
  }
  const entryNames = new Set(entries.map(entry => entry.entry));
  for (const integration of integrations.filter(other => !entryNames.has(other.entry))) {
    lines.push(`- Defect of the model: the integration tests in ${writeCode(integration.file)} name the entry ${writeCode(integration.entry)}, which decisions.entries does not hold`);
  }
  return lines;
};

const writeFailureLine = failure => {
  if (!failure) return "no failure line";
  const failureTexts = [];
  if (isAText(failure.absent)) failureTexts.push(`absent: ${failure.absent}`);
  failureTexts.push(`failed: ${failure.failed}, handled at ${writeCode(failure.handledAt)}`);
  if (isAText(failure.question)) failureTexts.push(`decided by question ${writeCode(failure.question)}`);
  return failureTexts.join("; ");
};

const writeExitSection = exits => {
  const lines = ["## Exits", ""];
  if (!exits.length) return [...lines, "None."];
  for (const exit of exits) {
    lines.push(`- ${writeCode(exit.exit)} from ${writeCode(exit.from)}: ${exit.does}.`);
    lines.push(`  - Failure: ${writeFailureLine(exit.failure)}`);
  }
  return lines;
};

const writeUnitTestSection = (model, unitTests) => {
  const lines = ["## Unit tests", ""];
  for (const unitTest of unitTests) lines.push(`- ${writeCode(unitTest.class)} in ${writeCode(unitTest.file)}`, ...writeTestNames(unitTest.tests).map(line => line.slice(2)));
  const testedClasses = new Set(unitTests.map(unitTest => model.findClass(unitTest.class)));
  for (const theClass of model.classes.filter(other => other.does === DOES.COMPUTES && model.isChangedClass(other) && !testedClasses.has(other))) {
    lines.push(`- ${writeCode(model.getClassDisplayName(theClass))} computes and has no unit tests`);
  }
  return lines.length > 2 ? lines : [...lines, "None."];
};

// The section stands only where the design removes a test, so a design that removes none renders as before.
const writeRemovedTestSection = removedTests => {
  if (!removedTests.length) return [];
  return ["## Removed tests", "", ...removedTests.map(removedTest => `- ${writeCode(removedTest.test)} of ${writeCode(removedTest.file)}, by ${writeCode(removedTest.class)}: ${removedTest.why}`), ""];
};

const writeAnswer = question => {
  if (!question.answer) return `Open; with no user, ${question.autonomous}.`;
  if (question.answer.by === ANSWER_GIVERS.DEFAULT) return `Taken by default: ${question.answer.option}.`;
  if (question.answer.by === ANSWER_GIVERS.DELEGATE) return `Answered on the author's delegation by ${question.answer.says}: ${question.answer.option}.`;
  return `Answered by the user: ${question.answer.option}.`;
};

// The code of an option, indented under its list item, so the user reads the code before the decision.
const writeOptionCode = option => (isAText(option.code) ? ["", `  ${CODE_FENCE}`, ...option.code.split("\n").map(line => `  ${line}`), `  ${CODE_FENCE}`, ""] : []);

const writeQuestionSection = questions => {
  const lines = ["## Questions", ""];
  if (!questions.length) return [...lines, "None.", ""];
  for (const question of questions) {
    lines.push(`### ${question.id}`, "", question.fact, "");
    for (const option of readList(question.options)) lines.push(`- ${option.name}: ${option.shape}`, ...writeOptionCode(option));
    lines.push("", `Recommendation: ${question.recommendation}`, "", writeAnswer(question), "");
  }
  return lines;
};

const writeStopSection = stops => {
  const lines = ["## Stops", ""];
  if (!stops.length) return [...lines, "None."];
  lines.push("| Plan | Reason | At | Says |", "|---|---|---|---|");
  for (const stop of stops) lines.push(`| ${stop.plan ?? stop.round} | ${escapeTableCell(stop.reason)} | ${writeCode(escapeTableCell(stop.at))} | ${escapeTableCell(stop.says)} |`);
  return lines;
};

const describeFindingItem = finding => {
  const check = isAText(finding.check) ? ` (${finding.check})` : "";
  return Number.isFinite(finding.run) ? `shape run ${finding.run}, item ${finding.number}${check}` : `${finding.number}${check}`;
};

const writeFindingLine = finding => {
  const item = describeFindingItem(finding);
  if (isAText(finding.closedBy)) return `- ${item}: closed by ${writeCode(finding.closedBy)}`;
  if (isAText(finding.decidedBy)) return `- ${item}: left, ${finding.reason}, decided by ${finding.decidedBy}: ${finding.says}`;
  return `- ${item}: left, ${finding.reason}: ${finding.says}`;
};

const writeFindingSection = (findings, findingsToConsider) => {
  const lines = ["## Findings", ""];
  const judgedFindings = findings.filter(finding => !isAText(finding.openAfterCeiling) && !findingsToConsider.has(finding));
  if (!judgedFindings.length) return [...lines, "None."];
  return [...lines, ...judgedFindings.map(writeFindingLine)];
};

// The items to consider stand apart from the findings, because they ask the author a question and claim no defect.
const writeToConsiderSection = (findings, findingsToConsider) => {
  const consideredFindings = findings.filter(finding => findingsToConsider.has(finding));
  if (!consideredFindings.length) return [];
  return ["", "## To consider", "", ...consideredFindings.map(writeFindingLine)];
};

// An item the shape runs left open at their ceiling, with the change the designer intends, which the writers do not build.
const writeOpenAfterCeilingSection = findings => {
  const openFindings = findings.filter(finding => isAText(finding.openAfterCeiling));
  if (!openFindings.length) return [];
  return ["", "## Open after the ceiling", "", ...openFindings.map(finding => `- ${describeFindingItem(finding)}: ${finding.openAfterCeiling}`)];
};

const writeExistingDefectLine = existingDefect => {
  const memberName = writeCode(`${existingDefect.class}#${existingDefect.member}`);
  if (isLeftUnfixed(existingDefect)) return `- ${memberName}: ${existingDefect.defect}; not fixed: ${existingDefect.notFixed}`;
  return `- ${memberName}: ${existingDefect.defect}; fixed in migration group ${existingDefect.group}: ${existingDefect.fix}`;
};

const writeExistingDefectSection = existingDefects => {
  const lines = ["## Existing defects of modified classes", ""];
  if (!existingDefects.length) return [...lines, "None."];
  return [...lines, ...existingDefects.map(writeExistingDefectLine)];
};

const writeScriptCaseSection = scriptCases => {
  const lines = ["## Defects of the script", ""];
  if (!scriptCases.length) return [...lines, "None."];
  lines.push("| Code | Name | Text | Reason |", "|---|---|---|---|");
  for (const scriptCase of scriptCases) lines.push(`| ${escapeTableCell(scriptCase.code)} | ${writeCode(escapeTableCell(scriptCase.name))} | ${escapeTableCell(scriptCase.text)} | ${escapeTableCell(scriptCase.reason)} |`);
  return lines;
};

const formatDollars = dollars => (Number.isFinite(dollars) ? dollars.toFixed(2) : "not given");

const writeRoundTableLine = countsOfTheRound => {
  const { counts, loopLine, dollars } = countsOfTheRound;
  const cells = [countsOfTheRound.round, counts.findings, counts.open, counts.withAReason, counts.closedByAnAnswer, counts.carried, counts.toTheDesigner, counts.toTheWriters, counts.stillOpen, `${loopLine.word} ${loopLine.code}`, formatDollars(dollars.round), formatDollars(dollars.soFar)];
  return `| ${cells.map(escapeTableCell).join(" | ")} |`;
};

const formatRecordedReasons = recorded => Object.entries(recorded || {}).map(([reason, count]) => `recorded ${reason} ${count}`);

const writeSelfCheckLine = (plan, selfCheck) => {
  const head = `- Plan ${plan}, group ${selfCheck.group}: `;
  if (selfCheck.notRun) return `${head}not run, ${selfCheck.notRun}`;
  const unanswered = (selfCheck.unanswered || []).length;
  return `${head}${[
    `judge calls ${selfCheck.judgeCalls}`,
    `kept ${(selfCheck.kept || []).length}`,
    `fixed ${selfCheck.fixed || 0}`,
    ...formatRecordedReasons(selfCheck.recorded),
    ...(unanswered ? [`unanswered ${unanswered}`] : []),
    `to consider ${(selfCheck.toConsider || []).length}`,
    ...((selfCheck.decided || []).length ? [`${selfCheck.decided.length} decided`] : []),
  ].join(" · ")}`;
};

// 1 line per migration group of each plan whose self-check file the calling session wrote, after the rows of the rounds.
const writeSelfCheckLines = selfChecksOfThePlans => (selfChecksOfThePlans.length
  ? ["Self-checks:", "", ...selfChecksOfThePlans.flatMap(({ plan, groups }) => readList(groups).map(selfCheck => writeSelfCheckLine(plan, selfCheck))), ""]
  : []);

// 1 row per round that the round script recorded, with the dollars of the round and the sum so far.
const writeRoundSection = (roundCounts, selfChecksOfThePlans = []) => {
  if (roundCounts === null) return [];
  const lines = ["## Rounds", ""];
  if (!roundCounts.length) return [...lines, "None.", "", ...writeSelfCheckLines(selfChecksOfThePlans)];
  lines.push("| Round | Findings | Open | With a reason | Closed by an answer | Carried | To the designer | To the writers | Still open, not judged | Loop line | Dollars | Dollars so far |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  return [...lines, ...roundCounts.map(writeRoundTableLine), "", ...writeSelfCheckLines(selfChecksOfThePlans)];
};

// With the current tree, the tree also shows each unlisted file of a modified folder and the implementations of each interface.
export const writeDesignText = (model, roundCounts = null, findingsToConsider = new Set(), selfChecksOfThePlans = [], currentTree = null) => {
  const { decisions } = model;
  const tests = decisions.tests || {};
  return [
    writeConventionsLine(decisions.conventions),
    ...writeOverrideLines(decisions.conventions),
    "",
    "# Design",
    "",
    ...writeTreeBlock(model, currentTree),
    "",
    ...writeOwnerSection(readList(decisions.owners)),
    "",
    ...writeEntrySection(readList(decisions.entries), readList(tests.integration)),
    ...writeExitSection(readList(decisions.exits)),
    "",
    ...writeUnitTestSection(model, readList(tests.unit)),
    "",
    ...writeRemovedTestSection(readList(tests.removed)),
    ...writeQuestionSection(readList(decisions.questions)),
    ...writeProposedRuleSection(decisions.conventions),
    ...writeFindingSection(readList(decisions.findings), findingsToConsider),
    ...writeToConsiderSection(readList(decisions.findings), findingsToConsider),
    ...writeOpenAfterCeilingSection(readList(decisions.findings)),
    "",
    ...writeStopSection(readList(decisions.stops)),
    "",
    ...writeExistingDefectSection(readList(decisions.existingDefects)),
    "",
    ...writeScriptCaseSection(readList(decisions.scriptCases)),
    "",
    ...writeRoundSection(roundCounts, selfChecksOfThePlans),
  ].join("\n");
};
