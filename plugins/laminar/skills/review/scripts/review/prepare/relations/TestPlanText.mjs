import { formatChangedLinesLine, formatRootLine } from "../formats/CodeUnderReviewText.mjs";
import { fitsOnOnePage, formatListFileLine } from "../formats/ListFileText.mjs";
import { findPlaceOfSliceLine } from "../formats/SliceFormat.mjs";
import { NO_CHANGED_LINES_TEXT } from "../formats/ChangedLinesText.mjs";

const REACH_WORDS = Object.freeze({ NAME: "by name", SUPERTYPE: "by supertype", IMPLEMENTATION: "by implementation", FILE_NAME: "by file name", ONLY_IN_THE_CHANGE: "no chain" });

const CHANGE_WORDS = Object.freeze({ CREATED: "created", BOUNDARY_CHANGED: "boundary changed", INTERNALS_CHANGED: "internals changed" });

const EXACT_FILE_NAME = "exact file name";

const CHANGED_TESTS_HEAD = "Tests in the change:";

const RANKED_TESTS_HEAD = "Reaching tests outside the change:";

const TEST_NAMES_OF_THE_CHANGE = "Names from the change file:";

const TEST_NAMES_OF_THE_WALK = "Names from the tests file:";

const NO_METHOD_NAME = "    names: none";

const formatNames = names => names.map(name => `\`${name}\``).join(", ");

const readChangeWord = changeKind => CHANGE_WORDS[changeKind] || changeKind;

const formatTestsWord = count => `${count} ${count === 1 ? "test" : "tests"}`;

const findChangedTests = plan => (plan.tests || []).filter(test => test.changedInTheChange);

const findWalkedTests = plan => (plan.tests || []).filter(test => !test.changedInTheChange);

const formatBoundariesReached = test => test.boundaries.length ? [`for: ${test.boundaries.join(", ")}`] : [];

const listFactsOfAChangedTest = test => [
  ...(test.exactFileName ? [EXACT_FILE_NAME] : []),
  ...(test.fileNameStems > 0 ? [`stems: ${test.fileNameStems}`] : []),
];

const listFactsOfAWalkedTest = test => [
  ...(test.exactFileName ? [EXACT_FILE_NAME] : []),
  ...(test.sharedStems > 0 ? [`stems: ${test.sharedStems}`] : []),
  ...(test.hops === null ? [] : [`steps: ${test.hops}`]),
];

const formatTestLine = (test, facts) => [
  `${test.mark}. ${test.path}`,
  REACH_WORDS[test.kind],
  ...(test.chain.length ? [test.chain.join(" → ")] : []),
  ...facts,
  ...formatBoundariesReached(test),
].join(" · ");

const formatMethodLines = test => [
  `${test.mark}. ${test.path}`,
  ...(test.methods.length ? test.methods.map(method => `    - ${method}`) : [NO_METHOD_NAME]),
];

const formatNameGroup = (head, tests) => tests.length ? [head, ...tests.flatMap(formatMethodLines)] : [];

export const formatChangedTestListLines = plan => {
  const changed = findChangedTests(plan);
  return changed.length ? [CHANGED_TESTS_HEAD, ...changed.map(test => formatTestLine(test, listFactsOfAChangedTest(test)))] : [];
};

export const formatTestListLines = plan => {
  const walked = findWalkedTests(plan);
  return walked.length ? [RANKED_TESTS_HEAD, ...walked.map(test => formatTestLine(test, listFactsOfAWalkedTest(test)))] : [];
};

export const formatTestNameListLines = plan => [
  ...formatNameGroup(TEST_NAMES_OF_THE_CHANGE, findChangedTests(plan)),
  ...formatNameGroup(TEST_NAMES_OF_THE_WALK, findWalkedTests(plan)),
];

const joinIntoText = lines => `${lines.join("\n")}\n`;

export const formatChangedTestListText = plan => joinIntoText(formatChangedTestListLines(plan));

export const formatTestListText = plan => joinIntoText(formatTestListLines(plan));

export const formatTestNameListText = plan => joinIntoText(formatTestNameListLines(plan));

const formatHeadLine = plan => `### ${plan.id} · application \`${plan.application.key}\``;

const formatApplicationLine = application => [
  application.foundByBuildFile ? `Application: ${application.key}` : "Application: none found",
  `Language family: ${application.family}`,
].join(" · ");

const formatBoundaryGroupLines = application => application.boundaryGroups > 1
  ? [`Boundary group: ${application.boundaryGroup} of ${application.boundaryGroups} · modules: ${formatNames(application.modules)}`]
  : [];

export const holdsTheChangedTestsInline = plan => fitsOnOnePage(formatChangedTestListLines(plan));

export const holdsTheTestNamesInline = plan => fitsOnOnePage(formatTestNameListLines(plan));

const formatChangedTestsLines = (plan, changedTestListFile) => {
  const count = formatChangedTestListLines(plan).length;
  if (!count) return ["Change file: none"];
  return holdsTheChangedTestsInline(plan) ? [] : [formatListFileLine("Change file", changedTestListFile, count, formatTestsWord(findChangedTests(plan).length))];
};

const formatWalkedTestsLine = (plan, testListFile) => {
  const count = formatTestListLines(plan).length;
  return count ? formatListFileLine("Tests file", testListFile, count, formatTestsWord(findWalkedTests(plan).length)) : "Tests file: none";
};

const formatTestNamesLines = (plan, testNameListFile) => {
  const count = formatTestNameListLines(plan).length;
  return count && !holdsTheTestNamesInline(plan) ? [formatListFileLine("Names file", testNameListFile, count)] : [];
};

const formatInlineLists = plan => [
  ...(holdsTheChangedTestsInline(plan) ? [formatChangedTestListLines(plan)] : []),
  ...(holdsTheTestNamesInline(plan) ? [formatTestNameListLines(plan)] : []),
].filter(lines => lines.length).map(lines => lines.join("\n"));

const stopLinesOf = plan => [
  ...(plan.minifiedSkipped ? [`- minified skipped: ${plan.minifiedSkipped}`] : []),
  ...(plan.stops || []).map(stop => `- ${stop}`),
];

const stopBlockOf = plan => {
  const lines = stopLinesOf(plan);
  return lines.length ? ["Stops:", ...lines] : ["Stops: none"];
};

const formatHeadBlock = (plan, { repositoryRoot, changedTestListFile, testListFile, testNameListFile }) => [
  formatHeadLine(plan),
  formatApplicationLine(plan.application),
  ...formatBoundaryGroupLines(plan.application),
  formatRootLine(repositoryRoot),
  ...formatChangedTestsLines(plan, changedTestListFile),
  formatWalkedTestsLine(plan, testListFile),
  ...formatTestNamesLines(plan, testNameListFile),
  ...stopBlockOf(plan),
].join("\n");

const formatBoundaryHead = boundary => `#### ${boundary.mark} · class \`${boundary.displayName}\` · ${readChangeWord(boundary.changeKind)}`;

const formatBranchLines = boundary => {
  const branches = boundary.changedBranches;
  if (!branches) return [];
  const where = branches.lines.length ? ` · lines: ${branches.lines.join(", ")}` : "";
  return [`Branches on changed lines: ${branches.onChangedLines} of ${branches.counted}${where}`];
};

const formatMethodsLines = boundary => boundary.methods.length
  ? [`Methods: ${boundary.methods.map(method => `\`${method.name}\` ${readChangeWord(method.changeKind)}`).join(", ")}`]
  : [];

const formatEntryMethods = methods => (methods || []).length ? [`entry methods: ${methods.map(method => `\`${method.name}\`:${method.line}`).join(", ")}`] : [];

const formatTopClassLine = topClass => [`- \`${topClass.name}\``, `${topClass.path}:${topClass.line}`, ...formatEntryMethods(topClass.methods), ...((topClass.chain || []).length ? [topClass.chain.join(" → ")] : [])].join(" · ");

const formatTopClassLines = topClasses => topClasses.length ? ["Top classes:", ...topClasses.map(formatTopClassLine)] : ["Top classes: none"];

const walkLinesOf = reach => [
  `Walked up from: \`${reach.testedTypeName}\``,
  ...(reach.supertypes.length ? [`Supertypes: ${formatNames(reach.supertypes)}`] : []),
  ...(reach.implementations.length ? [`Implementations: ${formatNames(reach.implementations)}`] : []),
  ...formatTopClassLines(reach.topClasses),
];

const formatTestsLine = boundary => boundary.testMarks.length ? `Tests: ${boundary.testMarks.join(", ")}` : "Tests: none";

const reachLinesOf = boundary => boundary.reach.known
  ? [...walkLinesOf(boundary.reach), formatTestsLine(boundary)]
  : [`Tests: unknown · ${boundary.reach.reason}`];

const readBoundaryPlaces = boundary => boundary.sliceLines.map(line => findPlaceOfSliceLine(boundary.path, line)).filter(Boolean);

const formatSliceLines = (boundary, changedLines) => [
  `path: ${boundary.path}`,
  "Slice:", "```", ...boundary.sliceLines, "```",
  formatChangedLinesLine(changedLines, boundary.path, readBoundaryPlaces(boundary)),
];

const formatBoundaryBlock = changedLines => boundary => [
  formatBoundaryHead(boundary),
  ...formatBranchLines(boundary),
  ...formatMethodsLines(boundary),
  ...reachLinesOf(boundary),
  ...formatSliceLines(boundary, changedLines),
].join("\n");

export const formatTestPlanText = (plan, files) =>
  `${[formatHeadBlock(plan, files), ...formatInlineLists(plan), ...plan.boundaries.map(formatBoundaryBlock(files.changedLines || NO_CHANGED_LINES_TEXT))].join("\n\n")}\n`;
