import { ABSTRACTION_KINDS as KINDS_OF_AN_ABSTRACTION, Scale } from "../../../code/index.mjs";
import { CHECKS_BY_ID_MAP, TRACKS } from "../../../checks/CheckCatalog.mjs";
import { readFileName } from "../../../files/paths.mjs";
import { APPLICATION_ROOT_SECTION, formatPlacedSliceLine } from "../formats/SliceFormat.mjs";
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
  };
};

const buildSpiInsideTheAppFindingTexts = ({ apiSpiTypeName: spiName, implementations }) => {
  const spiText = formatInlineCode(spiName);
  const implementationNames = implementations.map(implementation => formatInlineCode(implementation.name)).join(" and ");
  return {
    summary: `${implementationNames} implements the spi interface ${spiText} inside the app, where the spi predicts an implementation at the edge`,
    prediction: `The spi interface ${spiText} predicts an implementation at the edge of the module, outside the app.`,
    found: `${implementationNames} implements ${spiText} inside the app.`,
  };
};

const THE_PREDICTION_OF_A_TEST_FILE_NAME = "A test file name starts with the name of the file it tests, and the behavior it verifies follows that name.";

const buildTestFileNamingAFileFindingTexts = ({ test, named }) => {
  const testName = formatInlineCode(readFileName(test.path));
  const nameInTheTest = formatInlineCode(named.name);
  return {
    summary: `${testName} names ${nameInTheTest} after its start: put ${nameInTheTest} first and the behavior after it, so its tests stand together with the other tests of ${formatInlineCode(readFileName(named.path))}`,
    prediction: THE_PREDICTION_OF_A_TEST_FILE_NAME,
    found: `The name of ${testName} opens with other words, and ${nameInTheTest} follows them.`,
  };
};

const buildTestFileNamingNoFileFindingTexts = ({ test }) => {
  const testName = formatInlineCode(readFileName(test.path));
  return {
    summary: `${testName} names no file of its folder or of the folder it mirrors: start the test name with the name of the file it tests, so the reader can tell which file its tests verify`,
    prediction: THE_PREDICTION_OF_A_TEST_FILE_NAME,
    found: `The name of ${testName} opens with the name of no file of its folder or of the folder it mirrors, and holds none after its start.`,
  };
};

const buildTestFileNameFindingTexts = settledTestFileName => (settledTestFileName.named
  ? buildTestFileNamingAFileFindingTexts(settledTestFileName)
  : buildTestFileNamingNoFileFindingTexts(settledTestFileName));

const TEST_FILE_NAME_SECTION = "testFileName";

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
  {
    field: "settledTestFileNames",
    section: TEST_FILE_NAME_SECTION,
    standsInFor: JUDGE_TYPE_BY_SCALE_MAP[Scale.MODULE.name],
    listPlaces: settledTestFileName => [settledTestFileName.test],
    listFiles: settledTestFileName => [settledTestFileName.test.path],
    buildFindingTexts: settledTestFileName => buildTestFileNameFindingTexts(settledTestFileName),
    createCodeUnderReview: (abstraction, kind, settledTestFileName, id) => createCodeUnderReviewOfATestFile(abstraction, kind, settledTestFileName, id),
  },
]);

const buildTestNameFindingTexts = ({ abstraction }) => {
  const testName = formatInlineCode(abstraction.name);
  return {
    summary: `${testName} states no outcome in the should form, so the reader cannot tell which requirement the test verifies`,
    prediction: "A test name states the outcome the test verifies and the condition that produces it.",
    found: `${testName} holds no word should and no outcome.`,
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
});

const buildNoteOfWorkFindingTexts = ({ abstraction, place }) => ({
  summary: `${formatInlineCode(abstraction.name)} holds a note of work left undone that names no ticket`,
  prediction: "Production code holds finished work, and work still to do lives in a task tracker.",
  found: `The comment at line ${place.line} says ${formatInlineCode(quoteTheComment(place.comment))} and names no ticket.`,
});

const buildSingleLetterFindingTexts = ({ abstraction }) => {
  const valueName = formatInlineCode(abstraction.name);
  return {
    summary: `${valueName} is a single letter, an abbreviated name that gives the reader little to predict from`,
    prediction: `${valueName} alone predicts no particular value.`,
    found: `${valueName} is declared with a single letter that is not the index of a loop.`,
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

const THE_PREDICTION_OF_AN_APPLICATION = "Integration tests are the starting point for every application, regardless of what kind of users it serves.";

const readTheApplicationFolder = application => application.path || ".";

const buildNoTestRunnerFindingTexts = application => {
  const applicationName = formatInlineCode(application.displayName);
  return {
    summary: `${applicationName} has no test runner and no test, so no test can show that its main paths work`,
    prediction: THE_PREDICTION_OF_AN_APPLICATION,
    found: `The build files of ${applicationName} declare no test runner, and ${applicationName} holds no test file.`,
  };
};

const APPLICATION_WITH_NO_TEST_RUNNER = Object.freeze({
  section: APPLICATION_ROOT_SECTION,
  track: TRACKS.TEST_PLAN,
  check: CHECKS_BY_ID_MAP.CD4,
  standsInFor: JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_PLAN],
  listPlaces: () => [],
  listFiles: application => [readTheApplicationFolder(application)],
  buildEvidence: application => [{ file: readTheApplicationFolder(application), lines: [] }],
  buildFindingTexts: application => buildNoTestRunnerFindingTexts(application),
});

export const isAnApplicationWithNoTestRunner = abstraction => Boolean(abstraction) && abstraction.scale === Scale.APPLICATION.name && Boolean((abstraction.facts || {}).hasNoTestRunner);

const listApplicationsWithNoTestRunner = (applications, keepsJudgeType, keepsScale) => (keepsScale(Scale.APPLICATION.name) && keepsJudgeType(APPLICATION_WITH_NO_TEST_RUNNER.standsInFor)
  ? applications.filter(isAnApplicationWithNoTestRunner)
  : []);

const createCodeUnderReviewOfAnApplication = (application, kind, settled, id) => ({
  ...createCodeUnderReviewOfAnAbstractionTheScriptSettled(application, kind, settled, id),
  path: readTheApplicationFolder(application),
  lines: null,
  slice: { sections: [{ section: kind.section, lines: [`${readTheApplicationFolder(application)}/`] }] },
});

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

const createCodeUnderReviewOfATestFile = (abstraction, kind, settledTestFileName, id) => ({
  ...createCodeUnderReviewOfTheScript(abstraction, kind, settledTestFileName, id),
  displayName: readFileName(settledTestFileName.test.path),
  name: readFileName(settledTestFileName.test.path),
  scale: Scale.CLASS.name,
  kind: KINDS_OF_AN_ABSTRACTION.FILE,
  path: settledTestFileName.test.path,
  isTest: true,
  standsInFor: kind.standsInFor,
});

const createCodeUnderReviewOfAnAbstractionTheScriptSettled =(abstraction, kind, settled, id) => ({
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
  evidence: kind.buildEvidence ? kind.buildEvidence(settled) : buildEvidenceOfPlaces(kind.listPlaces(settled)),
  confidence: "high",
  inChange: kind.listFiles(settled).some(filePath => Boolean(changedLines[filePath])),
  scriptRaised: true,
  ...(kind.standsInFor ? { standsInFor: kind.standsInFor } : {}),
  ...kind.buildFindingTexts(settled),
});

const isAModule = abstraction => abstraction.scale === Scale.MODULE.name;

const listSettledFacts = abstraction => SETTLED_KINDS.flatMap(kind => ((abstraction.module || {})[kind.field] || []).map(settledFact => ({ abstraction, kind, settledFact })));

const chooseHowToCreateTheCodeUnderReview = kind => kind.createCodeUnderReview || createCodeUnderReviewOfTheScript;

const KEEPS_EVERY_JUDGE_TYPE = () => true;

const KEEPS_EVERY_SCALE = () => true;

const listAbstractionFactsTheScriptSettles = (selectedAbstractions, keepsJudgeType) => ABSTRACTION_KINDS
  .filter(kind => keepsJudgeType(kind.standsInFor))
  .flatMap(kind => selectedAbstractions.flatMap(abstraction => kind.listSettled(abstraction).map(settledFact => ({ abstraction, kind, settledFact }))));

export function buildScriptFindings(abstractions, changedLines = {}, { selectedAbstractions = [], applications = [], keepsJudgeType = KEEPS_EVERY_JUDGE_TYPE, keepsScale = KEEPS_EVERY_SCALE } = {}) {
  const modulesKept = keepsScale(Scale.MODULE.name) ? abstractions.filter(isAModule) : [];
  const settledFactsOfModules = modulesKept.flatMap(listSettledFacts)
    .filter(settled => !settled.kind.standsInFor || keepsJudgeType(settled.kind.standsInFor))
    .map(settled => ({ ...settled, createCodeUnderReview: chooseHowToCreateTheCodeUnderReview(settled.kind) }));
  const settledFactsOfAbstractions = listAbstractionFactsTheScriptSettles(selectedAbstractions.filter(abstraction => keepsScale(abstraction.scale)), keepsJudgeType)
    .map(settled => ({ ...settled, createCodeUnderReview: createCodeUnderReviewOfAnAbstractionTheScriptSettled }));
  const settledFactsOfApplications = listApplicationsWithNoTestRunner(applications, keepsJudgeType, keepsScale)
    .map(application => ({ abstraction: application, kind: APPLICATION_WITH_NO_TEST_RUNNER, settledFact: application, createCodeUnderReview: createCodeUnderReviewOfAnApplication }));
  return [...settledFactsOfModules, ...settledFactsOfAbstractions, ...settledFactsOfApplications].map(({ abstraction, kind, settledFact, createCodeUnderReview }, at) => {
    const id = `${SCRIPT_ID_MARK}${at + 1}`;
    return { codeUnderReview: createCodeUnderReview(abstraction, kind, settledFact, id), finding: createFinding(kind, settledFact, id, changedLines) };
  });
}
