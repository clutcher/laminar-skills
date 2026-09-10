import { CHANGE_KINDS, changesTheCode, readLanguageFamily, Scale } from "../../../code/index.mjs";
import { listEverySliceLine, findLineNumber, listOwnSliceLines } from "../formats/SliceFormat.mjs";
import { compareByStrength, REACH_KINDS, sortWithAMixedFirstPage } from "../abstractions/walks/testing/TestReachWalk.mjs";
import { holdsBehavior } from "../selection/TrackSelection.mjs";


const isAChangedMethod = abstraction => abstraction.scale === Scale.METHOD.name && changesTheCode(abstraction.changeKind);

const isTheDeclaringLineOf = classAbstraction => line => Number(findLineNumber(line)) === (classAbstraction.lines || {}).from;

const findClassHead = classAbstraction => listEverySliceLine(classAbstraction).filter(isTheDeclaringLineOf(classAbstraction)).slice(0, 1);

const readTestPlanSlice = classAbstraction => classAbstraction.changeKind === CHANGE_KINDS.CREATED
  ? listOwnSliceLines(classAbstraction)
  : [...new Set([...findClassHead(classAbstraction), ...(classAbstraction.children || []).filter(isAChangedMethod).flatMap(listOwnSliceLines)])];

const BOUNDARY_MARK = "B";
const CHANGED_TEST_MARK = "T";
const WALKED_TEST_MARK = "W";
const NO_SEARCH_RAN = "no search ran";

const isAMethod = abstraction => abstraction.scale === Scale.METHOD.name;

const holdsAMethodOfItsOwn = abstraction => holdsBehavior(abstraction) && ((abstraction.measures || {}).stepCount > 0 || (abstraction.children || []).some(isAMethod));

const formatNumberedMark = (mark, index) => `${mark}${index + 1}`;

const compareByText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const compareByPath = (left, right) => compareByText(left.abstraction.path, right.abstraction.path);

const removeDuplicates = values => [...new Set(values)];

const readApplication = ({ abstraction, application }) => application
  ? { key: application.path || application.name, root: application.path || "", foundByBuildFile: true }
  : { key: readLanguageFamily(abstraction.path), root: "", foundByBuildFile: false };

const readModuleKey = ({ module }) => (module.module && module.module.root) || module.path;

const countSliceLines = boundaries => boundaries.reduce((total, boundary) => total + readTestPlanSlice(boundary.abstraction).length, 0);

const groupBy = (items, keyOf) => {
  const itemsByKeyMap = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!itemsByKeyMap.has(key)) itemsByKeyMap.set(key, []);
    itemsByKeyMap.get(key).push(item);
  }
  return itemsByKeyMap;
};

const splitByModule = (boundaries, sliceLineLimit) => {
  const modules = [...groupBy(boundaries, readModuleKey)].sort(([left], [right]) => compareByText(left, right));
  const boundaryGroups = [];
  let current = null;
  for (const [key, module] of modules) {
    const lines = countSliceLines(module);
    if (!current || (current.lines > 0 && current.lines + lines > sliceLineLimit)) {
      current = { modules: [], boundaries: [], lines: 0 };
      boundaryGroups.push(current);
    }
    current.modules.push(key);
    current.boundaries.push(...module);
    current.lines += lines;
  }
  return boundaryGroups;
};

const splitIntoBoundaryGroups = (boundaries, sliceLineLimit) => countSliceLines(boundaries) > sliceLineLimit
  ? splitByModule(boundaries, sliceLineLimit)
  : [{ modules: removeDuplicates(boundaries.map(readModuleKey)).sort(compareByText), boundaries }];

const reachOf = abstraction => {
  const reach = abstraction.reachingTests;
  if (!reach) return { known: false, reason: NO_SEARCH_RAN, testedTypeName: abstraction.name, supertypes: [], implementations: [], topClasses: [] };
  return {
    known: Boolean(reach.known),
    reason: reach.reason || "",
    testedTypeName: reach.testedTypeName,
    supertypes: reach.supertypes || [],
    implementations: reach.implementations || [],
    topClasses: reach.topClasses || [],
  };
};

const isFoundBySearch = reachingTest => reachingTest.kind !== REACH_KINDS.ONLY_IN_THE_CHANGE;

const readReachingTests = abstraction => (abstraction.reachingTests && abstraction.reachingTests.known ? abstraction.reachingTests.ranked || [] : []);

const joinReachingTests = marked => {
  const reachingTestsByTestPathMap = new Map();
  for (const { mark, abstraction } of marked) {
    for (const reachingTest of readReachingTests(abstraction)) {
      const knownTestPath = reachingTestsByTestPathMap.get(reachingTest.path);
      const strongest = !knownTestPath || compareByStrength(reachingTest, knownTestPath.reachingTest) < 0 ? reachingTest : knownTestPath.reachingTest;
      const boundariesFoundBySearch = isFoundBySearch(reachingTest) ? [mark] : [];
      reachingTestsByTestPathMap.set(reachingTest.path, { reachingTest: strongest, boundaries: [...(knownTestPath ? knownTestPath.boundaries : []), ...boundariesFoundBySearch] });
    }
  }
  return sortWithAMixedFirstPage([...reachingTestsByTestPathMap.values()].map(({ reachingTest, boundaries }) => ({ ...reachingTest, boundaries })).sort(compareByStrength));
};

const createTest = (reachingTest, mark) => ({
  mark,
  path: reachingTest.path,
  kind: reachingTest.kind,
  chain: reachingTest.chain || [],
  changedInTheChange: Boolean(reachingTest.changedInTheChange),
  exactFileName: Boolean(reachingTest.exactFileName),
  sharedStems: reachingTest.sharedStems || 0,
  fileNameStems: reachingTest.fileNameStems || 0,
  hops: reachingTest.hops === undefined ? null : reachingTest.hops,
  methods: reachingTest.methods || [],
  boundaries: reachingTest.boundaries,
});

const markTests = rankedTests => {
  const changed = rankedTests.filter(reachingTest => reachingTest.changedInTheChange);
  const walked = rankedTests.filter(reachingTest => !reachingTest.changedInTheChange);
  return [
    ...changed.map((reachingTest, index) => createTest(reachingTest, formatNumberedMark(CHANGED_TEST_MARK, index))),
    ...walked.map((reachingTest, index) => createTest(reachingTest, formatNumberedMark(WALKED_TEST_MARK, index))),
  ];
};

const createBoundary = ({ mark, abstraction }, tests) => ({
  mark,
  abstractionId: abstraction.id,
  displayName: abstraction.displayName,
  changeKind: abstraction.changeKind,
  path: abstraction.path,
  lines: abstraction.lines,
  changedBranches: abstraction.changedBranches || null,
  methods: (abstraction.children || []).filter(isAChangedMethod).map(child => ({ name: child.name, changeKind: child.changeKind })),
  reach: reachOf(abstraction),
  testMarks: tests.filter(test => test.boundaries.includes(mark)).map(test => test.mark),
  sliceLines: readTestPlanSlice(abstraction),
});

const reachesOf = marked => marked.map(({ abstraction }) => abstraction.reachingTests).filter(reach => reach && reach.known);

const createPlan = (application, family, boundaryGroup, index, boundaryGroupCount) => {
  const marked = [...boundaryGroup.boundaries].sort(compareByPath).map((boundary, at) => ({ ...boundary, mark: formatNumberedMark(BOUNDARY_MARK, at) }));
  const tests = markTests(joinReachingTests(marked));
  const reaches = reachesOf(marked);
  return {
    application: { ...application, family, boundaryGroup: index + 1, boundaryGroups: boundaryGroupCount, modules: boundaryGroup.modules },
    boundaries: marked.map(boundary => createBoundary(boundary, tests)),
    tests,
    stops: removeDuplicates(reaches.flatMap(reach => reach.stops || [])),
    minifiedSkipped: Math.max(0, ...reaches.map(reach => reach.minifiedSkipped || 0)),
    onlyThePatch: reaches.some(reach => reach.onlyThePatch),
  };
};

const buildPlansOfAnApplication = (boundaries, sliceLineLimit) => {
  const application = readApplication(boundaries[0]);
  const family = removeDuplicates(boundaries.map(({ abstraction }) => readLanguageFamily(abstraction.path)).filter(Boolean)).sort(compareByText).join(", ");
  const boundaryGroups = splitIntoBoundaryGroups(boundaries, sliceLineLimit);
  return boundaryGroups.map((boundaryGroup, index) => createPlan(application, family, boundaryGroup, index, boundaryGroups.length));
};

export function buildTestPlans(boundariesOwingATest, sliceLineLimit) {
  const withBehavior = boundariesOwingATest.filter(({ abstraction }) => holdsAMethodOfItsOwn(abstraction));
  const applications = [...groupBy(withBehavior, boundary => readApplication(boundary).key)]
    .sort(([left], [right]) => compareByText(left, right));
  return applications.flatMap(([, boundaries]) => buildPlansOfAnApplication(boundaries, sliceLineLimit));
}
