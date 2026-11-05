import { ANSWER_GIVERS, DOES, KINDS, getFileOfTheChild, getFolderPath, isAText, isLeftUnfixed, readHeadTypeName, readList, readTypeNames } from "../model/DesignModel.mjs";

const GUESS_EVIDENCE = new Set(["churn", "none"]);

const CODE_FENCE = "```";

const writeCode = text => `\`${text}\``;

const escapeTableCell = text => String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const writeConventionsLine = conventions => {
  if (!conventions) return "Project conventions: not recorded in the model.";
  if (conventions.found === false) return `Project conventions: none found in ${writeCode(conventions.folder || "")}; the design follows the book's layout and the rules of the skill.`;
  return `Project conventions: ${readList(conventions.files).map(writeCode).join(", ") || "none listed"} from ${writeCode(conventions.folder || "")}; zone order: ${writeCode(conventions.zoneOrder || "default")}.`;
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

const writeClassLines = (model, theClass, userNamesOfClassMap, indent) => {
  const lines = [`${indent}${writeClassMarks(theClass)}`, ...writeUsedByLine(model, theClass, userNamesOfClassMap, indent)];
  for (const field of readList(theClass.fields)) lines.push(`${indent}  ${field.name}${field.type ? `: ${field.type}` : ""}`);
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

const writeTreeBlock = model => {
  const userNamesOfClassMap = buildUserNamesOfClassMap(model);
  const lines = [];
  for (const folder of model.folders) {
    lines.push(`${getFolderPath(folder)}/ [${folder.kind}]`);
    for (const child of readList(folder.children)) {
      lines.push(writeChildLine(child));
      for (const theClass of model.classes.filter(other => other.file === getFileOfTheChild(folder, child))) lines.push(...writeClassLines(model, theClass, userNamesOfClassMap, "    "));
    }
  }
  for (const file of listFilesOfNoFolder(model)) {
    lines.push(`${file} [listed in no folder]`);
    for (const theClass of model.classes.filter(other => other.file === file)) lines.push(...writeClassLines(model, theClass, userNamesOfClassMap, "    "));
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

const writeAnswer = question => {
  if (!question.answer) return `Open; with no user, ${question.autonomous}.`;
  if (question.answer.by === ANSWER_GIVERS.DEFAULT) return `Taken by default: ${question.answer.option}.`;
  if (question.answer.by === ANSWER_GIVERS.DELEGATE) return `Answered on the author's delegation by ${question.answer.says}: ${question.answer.option}.`;
  return `Answered by the user: ${question.answer.option}.`;
};

const writeQuestionSection = questions => {
  const lines = ["## Questions", ""];
  if (!questions.length) return [...lines, "None.", ""];
  for (const question of questions) {
    lines.push(`### ${question.id}`, "", question.fact, "");
    for (const option of readList(question.options)) lines.push(`- ${option.name}: ${option.shape}`);
    lines.push("", `Recommendation: ${question.recommendation}`, "", writeAnswer(question), "");
  }
  return lines;
};

const writeStopSection = stops => {
  const lines = ["## Stops", ""];
  if (!stops.length) return [...lines, "None."];
  lines.push("| Round | Reason | At | Says |", "|---|---|---|---|");
  for (const stop of stops) lines.push(`| ${stop.round} | ${escapeTableCell(stop.reason)} | ${writeCode(escapeTableCell(stop.at))} | ${escapeTableCell(stop.says)} |`);
  return lines;
};

const describeFindingItem = finding => (Number.isFinite(finding.run) ? `shape run ${finding.run}, item ${finding.number}` : `${finding.number}`);

const writeFindingLine = finding => {
  const item = describeFindingItem(finding);
  if (isAText(finding.closedBy)) return `- ${item}: closed by ${writeCode(finding.closedBy)}`;
  return `- ${item}: left, ${finding.reason}: ${finding.says}`;
};

const writeFindingSection = findings => {
  const lines = ["## Findings", ""];
  const judgedFindings = findings.filter(finding => !isAText(finding.openAfterCeiling));
  if (!judgedFindings.length) return [...lines, "None."];
  return [...lines, ...judgedFindings.map(writeFindingLine)];
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

// 1 row per round that the round script recorded, with the dollars of the round and the sum so far.
const writeRoundSection = roundCounts => {
  if (roundCounts === null) return [];
  const lines = ["## Rounds", ""];
  if (!roundCounts.length) return [...lines, "None.", ""];
  lines.push("| Round | Findings | Open | With a reason | Closed by an answer | Carried | To the designer | To the writers | Still open, not judged | Loop line | Dollars | Dollars so far |", "|---|---|---|---|---|---|---|---|---|---|---|---|");
  return [...lines, ...roundCounts.map(writeRoundTableLine), ""];
};

export const writeDesignText = (model, roundCounts = null) => {
  const { decisions } = model;
  const tests = decisions.tests || {};
  return [
    writeConventionsLine(decisions.conventions),
    "",
    "# Design",
    "",
    ...writeTreeBlock(model),
    "",
    ...writeOwnerSection(readList(decisions.owners)),
    "",
    ...writeEntrySection(readList(decisions.entries), readList(tests.integration)),
    ...writeExitSection(readList(decisions.exits)),
    "",
    ...writeUnitTestSection(model, readList(tests.unit)),
    "",
    ...writeQuestionSection(readList(decisions.questions)),
    ...writeFindingSection(readList(decisions.findings)),
    ...writeOpenAfterCeilingSection(readList(decisions.findings)),
    "",
    ...writeStopSection(readList(decisions.stops)),
    "",
    ...writeExistingDefectSection(readList(decisions.existingDefects)),
    "",
    ...writeScriptCaseSection(readList(decisions.scriptCases)),
    "",
    ...writeRoundSection(roundCounts),
  ].join("\n");
};
