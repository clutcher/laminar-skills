import { Scale } from "../../../code/index.mjs";
import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { readFileName } from "../../../files/paths.mjs";
import { formatPlacedSliceLine } from "../formats/SliceFormat.mjs";
import { MODULE_BOUNDARY_FACT_SECTIONS } from "../abstractions/slices/CodeSlice.mjs";
import { JUDGE_TYPE_BY_SCALE_MAP, JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";
import { findTheSingleLetterName, findTheTestNameWithNoShould, listNotesOfWorkWithNoTicket, listPhaseCommentsInProductionCode } from "./ScriptSettledForms.mjs";

export const SCRIPT_JUDGE_TYPE = "script";

const SCRIPT_ID_MARK = "R";

const readFolderName = filePath => readFileName(String(filePath).split("/").slice(0, -1).join("/"));

const formatInlineCode = name => `\`${name}\``;

const describeTheUsers = users => (users.length === 1 ? "1 file of another module uses it" : `${users.length} files of other modules use it`);

const buildExposureFindingTexts = ({ type, opening, module, users }) => {
  const moduleName = formatInlineCode(readFileName(module));
  const typeName = formatInlineCode(type.name);
  return {
    summary: `${typeName} sits in the hidden part of the app of ${moduleName}, yet a declaration opens it to other modules`,
    prediction: `The hidden part of the app of ${moduleName} holds classes the module keeps for itself.`,
    found: `${formatInlineCode(readFileName(opening.path))} opens ${typeName} to other modules, and ${users.length ? describeTheUsers(users) : "no other module uses it yet"}.`,
    direction: `Give other modules a public type of ${moduleName} in place of ${typeName} and keep ${typeName} inside the app, because 2 modules cannot share the classes inside their app folders.`,
    boundary: opening.text,
  };
};

const buildAppImportFindingTexts = ({ importLine, inOutFile, inOutImport }) => {
  const importingFileName = formatInlineCode(readFileName(importLine.path));
  const inOutName = formatInlineCode(readFileName(inOutFile));
  return {
    summary: `${importingFileName} of the app imports ${inOutName} ${inOutImport} of its own module, so the app reaches the outside without an interface`,
    prediction: "The app predicts business logic that calls nothing outside the module except through the interfaces it declares.",
    found: `${importingFileName} imports ${inOutName} ${inOutImport}, in the folder ${formatInlineCode(readFolderName(inOutFile))}.`,
    direction: `Let the app state what it needs as an spi interface and let ${inOutName} implement it, because the domain states what it needs as interfaces and the code that fulfills them lives outside the app.`,
  };
};

const buildSpiInsideTheAppFindingTexts = ({ apiSpiTypeName: spiName, implementations }) => {
  const spiText = formatInlineCode(spiName);
  const implementationNames = implementations.map(implementation => formatInlineCode(implementation.name)).join(" and ");
  return {
    summary: `${implementationNames} implements the spi interface ${spiText} inside the app, where the spi predicts an implementation at the edge`,
    prediction: `The spi interface ${spiText} predicts an implementation at the edge of the module, outside the app.`,
    found: `${implementationNames} implements ${spiText} inside the app.`,
    direction: `Move the implementation of ${spiText} to \`out/\`, because what the app needs becomes an interface in \`spi/\` and an implementation at the edge.`,
  };
};

const readPlacedSliceLineOfAPlace = place => formatPlacedSliceLine(place.path, place.line, place.text);

const buildEvidenceOfPlaces = places => places.map(place => ({ file: place.path, lines: [place.line] }));

const SETTLED_KINDS = Object.freeze([
  {
    field: "settledExposures",
    section: MODULE_BOUNDARY_FACT_SECTIONS.EXPOSED_DOMAIN_TYPES,
    listPlaces: exposure => [exposure.type, exposure.opening],
    listFiles: exposure => [exposure.type.path, exposure.opening.path, ...exposure.users],
    buildFindingTexts: exposure => buildExposureFindingTexts(exposure),
  },
  {
    field: "settledAppImports",
    section: MODULE_BOUNDARY_FACT_SECTIONS.APP_IMPORTS_IN_OUT,
    listPlaces: settledImport => [settledImport.importLine],
    listFiles: settledImport => [settledImport.importLine.path, settledImport.inOutFile],
    buildFindingTexts: settledImport => buildAppImportFindingTexts(settledImport),
  },
  {
    field: "settledSpiImplementedInsideApp",
    section: MODULE_BOUNDARY_FACT_SECTIONS.SPI_IMPLEMENTED_INSIDE_APP,
    listPlaces: settledSpi => [settledSpi.apiSpiType, ...settledSpi.implementations],
    listFiles: settledSpi => [settledSpi.apiSpiType.path, ...settledSpi.implementations.map(implementation => implementation.path)],
    buildFindingTexts: settledSpi => buildSpiInsideTheAppFindingTexts(settledSpi),
  },
]);

const buildTestNameFindingTexts = ({ abstraction }) => {
  const testName = formatInlineCode(abstraction.name);
  return {
    summary: `${testName} states no outcome in the should form, so the reader cannot tell which requirement the test verifies`,
    prediction: "A test name states the outcome the test verifies and the condition that produces it.",
    found: `${testName} holds no word should and no outcome.`,
    direction: "Name the test by the pattern should, then the outcome it verifies, then when and the condition that produces it, so reviewers can decide whether this test matches the requirement they are checking.",
  };
};

const LONGEST_QUOTE = 60;

const quoteTheComment = text => (text.length > LONGEST_QUOTE ? `${text.slice(0, LONGEST_QUOTE).trimEnd()} ...` : text);

const readThePhaseWord = comment => comment.trim().replace(/:$/, "").toLowerCase();

const listThePhaseWords = places => places.map(place => formatInlineCode(readThePhaseWord(place.comment))).join(", ");

const describeThePhaseComments = places => (places.length === 1 ? `The comment at line ${places[0].line} names only the phase` : `The comments at lines ${places.map(place => place.line).join(", ")} name only the phases`);

const buildPhaseCommentFindingTexts = ({ abstraction, places }) => ({
  summary: `${formatInlineCode(abstraction.name)} names the phases of production code in comments, which the operations of each group already show`,
  found: `${describeThePhaseComments(places)} ${listThePhaseWords(places)}.`,
  direction: "Remove the phase comments and keep the blank lines, because the operations in each group already reveal its purpose.",
});

const buildNoteOfWorkFindingTexts = ({ abstraction, place }) => ({
  summary: `${formatInlineCode(abstraction.name)} holds a note of work left undone that names no ticket`,
  prediction: "Production code holds finished work, and work still to do lives in a task tracker.",
  found: `The comment at line ${place.line} says ${formatInlineCode(quoteTheComment(place.comment))} and names no ticket.`,
  direction: "Move the work to the task tracker and remove the note, because a note of work left undone belongs in a task tracker rather than in the codebase.",
});

const buildSingleLetterFindingTexts = ({ abstraction }) => {
  const valueName = formatInlineCode(abstraction.name);
  return {
    summary: `${valueName} is a single letter, an abbreviated name that gives the reader little to predict from`,
    prediction: `${valueName} alone predicts no particular value.`,
    found: `${valueName} is declared with a single letter that is not the index of a loop.`,
    direction: "Name the value for what it holds, because a single letter other than the index of a loop is an abbreviated name.",
  };
};

const SCRIPT_SETTLED_SECTIONS = Object.freeze({
  SINGLE_LETTER_NAME: "singleLetterName",
  TEST_NAME_WITH_NO_SHOULD: "testNameWithNoShould",
  PHASE_COMMENT_IN_PRODUCTION_CODE: "phaseCommentInProductionCode",
  NOTE_OF_WORK_WITH_NO_TICKET: "noteOfWorkWithNoTicket",
});

const ABSTRACTION_KINDS = Object.freeze([
  {
    section: SCRIPT_SETTLED_SECTIONS.TEST_NAME_WITH_NO_SHOULD,
    track: TRACKS.TEST_METHOD,
    check: CHECKS_BY_ID_MAP.S2,
    standsInFor: JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_METHOD],
    listSettled: abstraction => [findTheTestNameWithNoShould(abstraction)].filter(Boolean).map(place => ({ abstraction, place })),
    listPlaces: testNameWithNoShould => [testNameWithNoShould.place],
    listFiles: testNameWithNoShould => [testNameWithNoShould.place.path],
    buildFindingTexts: testNameWithNoShould => buildTestNameFindingTexts(testNameWithNoShould),
  },
  {
    section: SCRIPT_SETTLED_SECTIONS.SINGLE_LETTER_NAME,
    track: TRACKS.SIMPLICITY,
    check: CHECKS_BY_ID_MAP.S2,
    standsInFor: JUDGE_TYPE_BY_SCALE_MAP[Scale.VARIABLE.name],
    listSettled: abstraction => [findTheSingleLetterName(abstraction)].filter(Boolean).map(place => ({ abstraction, place })),
    listPlaces: singleLetterName => [singleLetterName.place],
    listFiles: singleLetterName => [singleLetterName.place.path],
    buildFindingTexts: singleLetterName => buildSingleLetterFindingTexts(singleLetterName),
  },
  {
    section: SCRIPT_SETTLED_SECTIONS.PHASE_COMMENT_IN_PRODUCTION_CODE,
    track: TRACKS.COMMENT,
    check: CHECKS_BY_ID_MAP.S5,
    standsInFor: JUDGE_TYPE_BY_TRACK_MAP[TRACKS.COMMENT],
    listSettled: abstraction => [listPhaseCommentsInProductionCode(abstraction)].filter(places => places.length).map(places => ({ abstraction, places })),
    listPlaces: phaseComment => phaseComment.places,
    listFiles: phaseComment => phaseComment.places.map(place => place.path),
    buildFindingTexts: phaseComment => buildPhaseCommentFindingTexts(phaseComment),
  },
  {
    section: SCRIPT_SETTLED_SECTIONS.NOTE_OF_WORK_WITH_NO_TICKET,
    track: TRACKS.COMMENT,
    check: CHECKS_BY_ID_MAP.S2,
    standsInFor: JUDGE_TYPE_BY_TRACK_MAP[TRACKS.COMMENT],
    listSettled: abstraction => listNotesOfWorkWithNoTicket(abstraction).map(place => ({ abstraction, place })),
    listPlaces: noteOfWork => [noteOfWork.place],
    listFiles: noteOfWork => [noteOfWork.place.path],
    buildFindingTexts: noteOfWork => buildNoteOfWorkFindingTexts(noteOfWork),
  },
]);

const createCodeUnderReviewOfTheScript = (abstraction, kind, settled, id) => ({
  id,
  abstractionId: abstraction.id,
  displayName: abstraction.displayName,
  name: abstraction.name,
  enclosing: "",
  usedIn: "",
  scale: Scale.MODULE.name,
  changeKind: abstraction.changeKind,
  path: abstraction.path,
  lines: null,
  isTest: false,
  boundaryRank: abstraction.boundaryRank,
  track: TRACKS.SIMPLICITY,
  judgeType: SCRIPT_JUDGE_TYPE,
  checks: [{ id: CHECKS_BY_ID_MAP.S2.id, name: CHECKS_BY_ID_MAP.S2.name, fields: [] }],
  slice: { sections: [{ section: kind.section, lines: kind.listPlaces(settled).map(readPlacedSliceLineOfAPlace) }] },
});

const createCodeUnderReviewOfAnAbstractionTheScriptSettled = (abstraction, kind, settled, id) => ({
  id,
  abstractionId: abstraction.id,
  displayName: abstraction.displayName,
  name: abstraction.name,
  enclosing: abstraction.enclosingTypeName || "",
  usedIn: abstraction.usedIn || "",
  scale: abstraction.scale,
  changeKind: abstraction.changeKind,
  path: abstraction.path,
  lines: abstraction.lines,
  isTest: Boolean(abstraction.isTest),
  boundaryRank: abstraction.boundaryRank,
  track: kind.track,
  judgeType: SCRIPT_JUDGE_TYPE,
  standsInFor: kind.standsInFor,
  checks: [{ id: kind.check.id, name: kind.check.name, fields: [] }],
  slice: { sections: [{ section: kind.section, lines: kind.listPlaces(settled).map(readPlacedSliceLineOfAPlace) }] },
});

const createFinding = (kind, settled, id, changedLines) => ({
  codeUnderReviewId: id,
  check: (kind.check || CHECKS_BY_ID_MAP.S2).id,
  evidence: buildEvidenceOfPlaces(kind.listPlaces(settled)),
  confidence: "high",
  inChange: kind.listFiles(settled).some(filePath => Boolean(changedLines[filePath])),
  scriptRaised: true,
  ...kind.buildFindingTexts(settled),
});

const isAModule = abstraction => abstraction.scale === Scale.MODULE.name;

const listSettledFacts = abstraction => SETTLED_KINDS.flatMap(kind => ((abstraction.module || {})[kind.field] || []).map(settledFact => ({ abstraction, kind, settledFact })));

const KEEPS_EVERY_JUDGE_TYPE = () => true;

const listAbstractionFactsTheScriptSettles = (selectedAbstractions, keepsJudgeType) => ABSTRACTION_KINDS
  .filter(kind => keepsJudgeType(kind.standsInFor))
  .flatMap(kind => selectedAbstractions.flatMap(abstraction => kind.listSettled(abstraction).map(settledFact => ({ abstraction, kind, settledFact }))));

export function buildScriptFindings(abstractions, changedLines = {}, { selectedAbstractions = [], keepsJudgeType = KEEPS_EVERY_JUDGE_TYPE } = {}) {
  const settledFactsOfModules = abstractions.filter(isAModule).flatMap(listSettledFacts)
    .map(settled => ({ ...settled, createCodeUnderReview: createCodeUnderReviewOfTheScript }));
  const settledFactsOfAbstractions = listAbstractionFactsTheScriptSettles(selectedAbstractions, keepsJudgeType)
    .map(settled => ({ ...settled, createCodeUnderReview: createCodeUnderReviewOfAnAbstractionTheScriptSettled }));
  return [...settledFactsOfModules, ...settledFactsOfAbstractions].map(({ abstraction, kind, settledFact, createCodeUnderReview }, at) => {
    const id = `${SCRIPT_ID_MARK}${at + 1}`;
    return { codeUnderReview: createCodeUnderReview(abstraction, kind, settledFact, id), finding: createFinding(kind, settledFact, id, changedLines) };
  });
}
