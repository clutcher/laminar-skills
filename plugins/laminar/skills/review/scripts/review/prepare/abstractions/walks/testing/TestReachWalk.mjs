import { CHANGE_MODES, changesTheBoundary, changesTheCode, findDriver, holdsKeyTreesAt, isOwnCodeAt, isTestPath, readLanguageFamily, readOwnSpans, Scale, findSharedStems, collectStems, TEST_KINDS, readTestKindAtTheHead, readTestHeadFactsOfTheFile, buildWholeWordPattern } from "../../../../../code/index.mjs";
import { readFileStem } from "../../../../../files/paths.mjs";
import { RepositoryAbstractions } from "../../RepositoryAbstractions.mjs";
import { TopClassWiring, formatWiredTypeNames } from "./TopClassWiring.mjs";

const NAMES_PER_ROUND = 40;
export const DEFAULT_REACH_BUDGET_MS = 30000;
const CLASSES_NAMED_AT_A_STOP = 5;
export const FIRST_PAGE_BEST = 3;
export const FIRST_PAGE_ENTRY_BOUNDARY_TESTS = 3;
export const MAX_TOP_CLASSES = 5;
export const MIN_FILE_NAME_CLASS = 4;

const TEST_NAME_ENDINGS = ["TestCase", "Tests", "Test", "Specs", "Spec"];
const TEST_NAME_OPENING = "Test";
const TEST_MARKER_PATTERN = /Tests?(?![a-z])|TestCase|Specs?(?![a-z])|(?:^|[._-])(?:test|tests|spec)(?:[._-]|$)/;
const MARKER_AT_THE_END_PATTERN = /(?:testcase|tests|test|specs|spec)$/;
const MARKER_AT_THE_START_PATTERN = /^test/;

const normaliseName = name => String(name).toLowerCase().replace(/[_.-]/g, "");

export const REACH_KINDS = Object.freeze({ NAME: "NAME", SUPERTYPE: "SUPERTYPE", IMPLEMENTATION: "IMPLEMENTATION", FILE_NAME: "FILE_NAME", ONLY_IN_THE_CHANGE: "ONLY_IN_THE_CHANGE" });

const REACH_KIND_ORDER = [REACH_KINDS.NAME, REACH_KINDS.SUPERTYPE, REACH_KINDS.IMPLEMENTATION, REACH_KINDS.FILE_NAME, REACH_KINDS.ONLY_IN_THE_CHANGE];

const holdsAChangedMember = abstraction => (abstraction.children || [])
  .some(child => child.scale === Scale.METHOD.name && changesTheCode(child.changeKind));

export const owesATest = abstraction => !abstraction.isTest
  && abstraction.scale === Scale.CLASS.name
  && !holdsKeyTreesAt(abstraction.path)
  && (changesTheBoundary(abstraction.changeKind) || holdsAChangedMember(abstraction));

export const isTheTestReachKnown = abstraction => Boolean(abstraction.reachingTests && abstraction.reachingTests.known);

export function readTestedTypeName(abstraction) {
  const name = String(abstraction.name || "");
  if (!abstraction.isTest) return abstraction.scale === Scale.METHOD.name && readEnclosingTypeName(abstraction) ? readEnclosingTypeName(abstraction) : name;
  for (const ending of TEST_NAME_ENDINGS) {
    if (name.length > ending.length && name.endsWith(ending)) return name.slice(0, -ending.length);
  }
  return name.startsWith(TEST_NAME_OPENING) && name.length > TEST_NAME_OPENING.length
    ? name.slice(TEST_NAME_OPENING.length)
    : name;
}

const readEnclosingTypeName = abstraction => {
  const enclosingTypeName = String(abstraction.enclosingTypeName || "");
  if (!enclosingTypeName || enclosingTypeName.includes("#")) return "";
  return enclosingTypeName.split(".").pop();
};

const readOwnSpansOfTheProductionAbstraction = abstraction => (abstraction.isTest ? [] : readOwnSpans(abstraction));

const TEXT_VALUE_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*$/g;

export const namesInCode = (text, name) => buildWholeWordPattern(name).test(String(text).replace(TEXT_VALUE_PATTERN, ""));

const declaresAClassAt = place => Boolean(findDriver(place.path)?.declaresAClass(place.text));

const buildUnknownReach = (testedTypeName, reason) => ({ known: false, onlyThePatch: false, testedTypeName, supertypes: [], implementations: [], topClasses: [], ranked: [], files: [], stops: [], reason });

const compareByTheOrderOfTheWalk = (left, right) => left.depth - right.depth;

const compareByFewestSteps = (left, right) => left.steps - right.steps;

const countIfTrue = value => (value ? 1 : 0);

const readSteps = reachingTest => (reachingTest.hops === null || reachingTest.hops === undefined ? Number.MAX_SAFE_INTEGER : reachingTest.hops);

export const compareByStrength = (left, right) => countIfTrue(right.changedInTheChange) - countIfTrue(left.changedInTheChange)
  || countIfTrue(right.exactFileName) - countIfTrue(left.exactFileName)
  || right.sharedStems - left.sharedStems
  || readSteps(left) - readSteps(right)
  || REACH_KIND_ORDER.indexOf(left.kind) - REACH_KIND_ORDER.indexOf(right.kind)
  || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

const ENTRY_BOUNDARY_TEST_HINT_PATTERN = /controller|integration/i;

export const hintsAtAnEntryBoundaryTest = filePath => ENTRY_BOUNDARY_TEST_HINT_PATTERN.test(readFileStem(filePath));

export const compareByNameStemsWithTheClass = (left, right) => countIfTrue(right.exactFileName) - countIfTrue(left.exactFileName)
  || (right.fileNameStems || 0) - (left.fileNameStems || 0)
  || compareByStrength(left, right);

export function sortWithAMixedFirstPage(ranked) {
  const changed = ranked.filter(reachingTest => reachingTest.changedInTheChange).sort(compareByNameStemsWithTheClass);
  const others = ranked.filter(reachingTest => !reachingTest.changedInTheChange);
  const best = others.slice(0, FIRST_PAGE_BEST);
  const rest = others.slice(FIRST_PAGE_BEST);
  const entryBoundaryTests = rest.filter(reachingTest => hintsAtAnEntryBoundaryTest(reachingTest.path)).slice(0, FIRST_PAGE_ENTRY_BOUNDARY_TESTS);
  return [...changed, ...best, ...entryBoundaryTests, ...rest.filter(reachingTest => !entryBoundaryTests.includes(reachingTest))];
}

export const isATestFileName = filePath => isTestPath(filePath) && TEST_MARKER_PATTERN.test(readFileStem(filePath));

export const isAnExactTestFileName = (filePath, className) => {
  const stem = normaliseName(readFileStem(filePath));
  const name = normaliseName(className);
  return stem.replace(MARKER_AT_THE_END_PATTERN, "") === name || stem.replace(MARKER_AT_THE_START_PATTERN, "") === name;
};

const formatSeconds = milliseconds => `${Number((milliseconds / 1000).toFixed(3))} s`;

const formatClassCountWords = count => `${count} ${count === 1 ? "class" : "classes"}`;

class ReachBudget {
  constructor(milliseconds) {
    this.milliseconds = milliseconds;
    this.deadline = null;
  }

  start() {
    if (this.deadline === null) this.deadline = performance.now() + this.milliseconds;
  }

  isSpent() {
    return this.deadline !== null && performance.now() >= this.deadline;
  }

  stopOf(unsearched) {
    const named = unsearched.slice(0, CLASSES_NAMED_AT_A_STOP).map(reachingClass => `\`${reachingClass.name}\``).join(", ");
    const more = unsearched.length > CLASSES_NAMED_AT_A_STOP ? `, and ${unsearched.length - CLASSES_NAMED_AT_A_STOP} more` : "";
    return `time limit: ${formatSeconds(this.milliseconds)} · step: ${unsearched[0].depth} · not searched: ${formatClassCountWords(unsearched.length)}, ${named}${more}`;
  }
}

export class TestReachWalk {
  constructor(repositoryText, testCode, mode, references, graph, { budgetMs = DEFAULT_REACH_BUDGET_MS } = {}) {
    this.repositoryText = repositoryText;
    this.testCode = testCode;
    this.references = references;
    this.graph = graph;
    this.mode = mode;
    this.budget = new ReachBudget(budgetMs);
    this.repositoryAbstractions = new RepositoryAbstractions(references.graph, repositoryText, filePath => this.readFileLines(filePath));
    this.topClassWiring = new TopClassWiring(graph, this.repositoryAbstractions, filePath => this.readFileLines(filePath));
    this.linesByPathMap = new Map();
    this.testMethodsByPathMap = new Map();
    this.longestClassKeyByTestKeyMap = new Map();
    this.inlineTestsByPathMap = new Map();
    this.changedPaths = new Set((repositoryText.changedFiles || []).map(file => file.path));
    this.changedFiles = repositoryText.changedFiles || [];
  }

  collectChangedTestPaths() {
    if (!this.everyChangedTestPath) {
      this.everyChangedTestPath = this.changedFiles
        .filter(file => file.existsAfterTheChange && readLanguageFamily(file.path) && this.holdsTests(file.path))
        .map(file => file.path);
    }
    return this.everyChangedTestPath;
  }

  findInlineTests(filePath) {
    if (!this.inlineTestsByPathMap.has(filePath)) {
      const driver = findDriver(filePath);
      this.inlineTestsByPathMap.set(filePath, driver && driver.readsInlineTests ? driver.findInlineTests(this.readFileLines(filePath)) : null);
    }
    return this.inlineTestsByPathMap.get(filePath);
  }

  holdsInlineTests(filePath) {
    const inline = this.findInlineTests(filePath);
    return Boolean(inline && inline.regions.length);
  }

  holdsTests(filePath) {
    return isTestPath(filePath) || this.holdsInlineTests(filePath);
  }

  isTestPlace(place) {
    return this.testCode.isTestPlace(place);
  }

  isInlineTestPlace(place) {
    return this.testCode.isInlineTestPlace(place);
  }

  startTheBudget() {
    this.budget.start();
  }

  readTheTestReachOf(abstraction) {
    const testedTypeName = readTestedTypeName(abstraction);
    if (abstraction.isTest && !this.repositoryAbstractions.declaresTheName(testedTypeName)) {
      return buildUnknownReach(testedTypeName, `no declaration of \`${testedTypeName}\``);
    }
    const walk = new ReachWalk(this, abstraction, testedTypeName).run();
    if (!abstraction.isTest) walk.addTheChangedTests();
    const rankedTests = walk.rankReachingTests();
    return {
      known: true,
      onlyThePatch: this.mode === CHANGE_MODES.PATCH,
      family: readLanguageFamily(abstraction.path),
      minifiedSkipped: this.repositoryText.countMinified(),
      testedTypeName,
      supertypes: walk.supertypes,
      implementations: walk.implementations,
      topClasses: walk.selectTheTopClasses(),
      ranked: rankedTests,
      files: rankedTests.map(reachingTest => reachingTest.path),
      stops: walk.stops,
      reason: "",
    };
  }

  findTheClassUnderTest(testMethod) {
    const testClass = String(testMethod.enclosingTypeName || "").split(".")[0];
    const testedTypeName = readTestedTypeName({ isTest: true, name: testClass });
    if (!testClass || !this.repositoryAbstractions.declaresTheName(testedTypeName)) return null;
    const classPath = this.repositoryAbstractions.findDeclaringPath(testedTypeName, "");
    return classPath ? { name: testedTypeName, path: classPath } : null;
  }

  readFileLines(filePath) {
    if (!this.linesByPathMap.has(filePath)) this.linesByPathMap.set(filePath, this.repositoryText.readFileLines(filePath) || []);
    return this.linesByPathMap.get(filePath);
  }

  getOrReadTestMethods(filePath) {
    if (!this.testMethodsByPathMap.has(filePath)) this.testMethodsByPathMap.set(filePath, this.readTestMethodsOf(filePath));
    return this.testMethodsByPathMap.get(filePath);
  }

  readTestMethodsOf(filePath) {
    if (!findDriver(filePath)) return [];
    const inline = this.findInlineTests(filePath);
    if (inline && inline.names.length) return inline.names;
    const testHeadFacts = readTestHeadFactsOfTheFile(this.graph, filePath);
    const isATest = abstraction => abstraction.scale === Scale.METHOD.name && readTestKindAtTheHead(testHeadFacts, abstraction.line) === TEST_KINDS.TEST;
    return [...new Set(this.repositoryAbstractions.listAbstractionsOfTheFile(filePath).filter(isATest).map(abstraction => abstraction.name))];
  }

  listTestFileNamesWithTheirKeys() {
    if (!this.everyTestFileName) {
      this.everyTestFileName = [...this.repositoryAbstractions.readAbstractionsByPath().keys(), ...this.graph.listWalkedFiles()]
        .filter((filePath, index, paths) => paths.indexOf(filePath) === index)
        .sort()
        .filter(isATestFileName)
        .map(filePath => ({ path: filePath, key: normaliseName(readFileStem(filePath)) }));
    }
    return this.everyTestFileName;
  }

  collectProductionClassKeys() {
    if (!this.everyProductionClassKey) {
      this.everyProductionClassKey = new Set();
      for (const [filePath, listed] of this.repositoryAbstractions.readAbstractionsByPath()) {
        if (isTestPath(filePath)) continue;
        for (const abstraction of listed) {
          if (abstraction.scale === Scale.CLASS.name) this.everyProductionClassKey.add(normaliseName(abstraction.name));
        }
      }
    }
    return this.everyProductionClassKey;
  }

  measureLongestClassKey(testKey) {
    if (this.longestClassKeyByTestKeyMap.has(testKey)) return this.longestClassKeyByTestKeyMap.get(testKey);
    const known = this.collectProductionClassKeys();
    let longest = 0;
    for (let from = 0; from < testKey.length; from++) {
      for (let to = testKey.length; to - from > Math.max(longest, MIN_FILE_NAME_CLASS - 1); to--) {
        if (known.has(testKey.slice(from, to))) { longest = to - from; break; }
      }
    }
    this.longestClassKeyByTestKeyMap.set(testKey, longest);
    return longest;
  }

  findTestFilesNamedForTheClass(className) {
    const key = normaliseName(className);
    if (key.length < MIN_FILE_NAME_CLASS) return [];
    return this.listTestFileNamesWithTheirKeys()
      .filter(keyedTestFile => keyedTestFile.key.includes(key) && this.measureLongestClassKey(keyedTestFile.key) <= key.length)
      .map(keyedTestFile => keyedTestFile.path);
  }
}

class ReachWalk {
  constructor(reach, abstraction, testedTypeName) {
    this.reach = reach;
    this.abstraction = abstraction;
    this.testedTypeName = testedTypeName;
    this.ownLines = readOwnSpansOfTheProductionAbstraction(abstraction);
    this.languageFamily = readLanguageFamily(abstraction.path);
    this.walked = new Set();
    this.reachingTestsByPathMap = new Map();
    this.stops = [];
    this.supertypes = [];
    this.implementations = [];
    this.shortNames = [];
    this.tops = [];
  }

  run() {
    const pending = this.startTheWalk();
    let firstRound = true;
    while (pending.length) {
      pending.sort(compareByTheOrderOfTheWalk);
      const round = pending.splice(0, NAMES_PER_ROUND);
      for (let at = 0; at < round.length; at++) {
        if (!firstRound && this.reach.budget.isSpent()) {
          this.stateTheStop([...round.slice(at), ...pending].sort(compareByTheOrderOfTheWalk));
          return this;
        }
        this.offerTestsByFileName(round[at]);
        const places = this.findPlacesNamingOutsideTheOwnCode(round[at]);
        const wired = this.findEntryBoundaryClassesWiredTo(round[at], places);
        this.recordTheTopAndTheReachingTests(round[at], places, wired);
        const above = [...this.findClassesAbove(round[at], places), ...wired];
        this.markAsWalked(above);
        pending.push(...above);
      }
      firstRound = false;
    }
    this.stateTheLimits();
    return this;
  }

  stateTheStop(unsearched) {
    this.stateTheLimits();
    this.stops.push(this.reach.budget.stopOf(unsearched));
  }

  startTheWalk() {
    const start = this.buildStartingClass();
    this.markAsWalked([start]);
    if (this.reach.holdsInlineTests(this.abstraction.path)) this.offer(this.buildReachingTest(this.abstraction.path, start, REACH_KINDS.NAME));
    const supertypes = this.findSupertypeClassesOf(start);
    this.markAsWalked(supertypes);
    this.supertypes = supertypes.map(reachingClass => reachingClass.name);
    const implementations = this.reach.repositoryAbstractions.isAnAbstractType(this.testedTypeName, start.path) ? this.findImplementationClassesOf(start) : [];
    this.markAsWalked(implementations);
    this.implementations = implementations.map(reachingClass => reachingClass.name);
    return [start, ...supertypes, ...implementations];
  }

  buildStartingClass() {
    const classPath = this.reach.repositoryAbstractions.findDeclaringPath(this.testedTypeName, this.abstraction.path) || this.abstraction.path;
    return { name: this.testedTypeName, path: classPath, chain: [this.testedTypeName], names: [this.testedTypeName], depth: 0, kind: REACH_KINDS.NAME };
  }

  markAsWalked(reachingClasses) {
    for (const reachingClass of reachingClasses) this.walked.add(reachingClass.name);
  }

  findSupertypeClassesOf(reachingClass, isWalked = name => this.walked.has(name)) {
    const names = this.reach.repositoryAbstractions.listSupertypes(reachingClass.name, reachingClass.path).filter(name => !isWalked(name));
    const found = [];
    for (const name of names) {
      found.push({
        ...reachingClass,
        pathsBelow: [reachingClass.path, ...(reachingClass.pathsBelow || [])],
        name,
        path: this.reach.repositoryAbstractions.findDeclaringPath(name, ""),
        chain: [`${name} (a supertype of ${reachingClass.name})`, ...reachingClass.chain.slice(1)],
        names: [name, ...reachingClass.names.slice(1)],
        kind: REACH_KINDS.SUPERTYPE,
      });
    }
    return found;
  }

  isAPossibleImplementation(place, name, start, taken) {
    if (this.reach.isTestPlace(place) || !name || this.walked.has(name) || taken.has(name)) return false;
    return this.reach.repositoryAbstractions.listSupertypes(name, place.path).includes(start.name);
  }

  findImplementationClassesOf(start) {
    const found = [];
    const taken = new Set();
    for (const place of this.findPlacesNamingOutsideTheOwnCode(start)) {
      const name = this.reach.isTestPlace(place) ? "" : this.reach.repositoryAbstractions.findTypeNameOfTheFile(place.path);
      if (!this.isAPossibleImplementation(place, name, start, taken)) continue;
      taken.add(name);
      found.push({
        name,
        path: place.path,
        chain: [`${name} (an implementation of ${start.name})`],
        names: [name],
        depth: 1,
        kind: REACH_KINDS.IMPLEMENTATION,
      });
    }
    return found;
  }

  findPlacesNaming(reachingClass) {
    const listed = this.reach.references.abstractionLookup.findAbstractionNamed(reachingClass.path, reachingClass.name);
    return listed ? this.reach.references.findPlacesReaching(listed) : this.reach.references.findNamingPlaces(reachingClass.name, this.languageFamily);
  }

  findPlacesNamingOutsideTheOwnCode(reachingClass) {
    return this.findPlacesNaming(reachingClass).filter(place => !isOwnCodeAt(place, this.abstraction.path, this.ownLines));
  }

  recordTheTopAndTheReachingTests(reachingClass, places, wired) {
    if (this.isATop(reachingClass, places) && !wired.length) this.tops.push(this.buildTopClass(reachingClass));
    for (const place of places) {
      if (isTestPath(place.path)) this.offer(this.buildReachingTest(place.path, reachingClass, reachingClass.kind));
      else if (this.reach.isInlineTestPlace(place) && reachingClass.depth === 0 && namesInCode(place.text, reachingClass.name)) this.offer(this.buildReachingTest(place.path, reachingClass, reachingClass.kind));
    }
  }

  findClassesAbove(reachingClass, places) {
    const above = [];
    const taken = new Set();
    const isWalked = name => this.walked.has(name) || taken.has(name);
    for (const place of places) {
      if (isTestPath(place.path) || this.reach.isInlineTestPlace(place)) continue;
      if (declaresAClassAt(place)) continue;
      const name = this.reach.repositoryAbstractions.findTypeNameOfTheFile(place.path);
      if (!name || isWalked(name)) continue;
      taken.add(name);
      const found = {
        name,
        path: place.path,
        pathsBelow: [reachingClass.path, ...(reachingClass.pathsBelow || [])],
        chain: [name, ...reachingClass.chain],
        names: [name, ...reachingClass.names],
        depth: reachingClass.depth + 1,
        kind: reachingClass.kind,
      };
      const supertypes = this.findSupertypeClassesOf(found, isWalked);
      for (const supertype of supertypes) taken.add(supertype.name);
      above.push(found, ...supertypes);
    }
    return above;
  }

  findEntryBoundaryClassesWiredTo(reachingClass, places) {
    if (!reachingClass.pathsBelow || !this.isATop(reachingClass, places) || this.reach.topClassWiring.hasAnEntryBoundaryRole(reachingClass.path)) return [];
    const wiredByClassNameMap = new Map();
    for (const { method, typeNames } of this.reach.topClassWiring.findEntryMethodsWiredTo(reachingClass.path, reachingClass.names[1], this.languageFamily)) {
      const name = this.reach.repositoryAbstractions.findTypeNameOfTheFile(method.place.file);
      if (!name || this.walked.has(name)) continue;
      const wiredClass = wiredByClassNameMap.get(name) || this.buildWiredClass(name, method.place.file, reachingClass, typeNames);
      wiredClass.wiredMethods.push({ name: method.name, line: method.place.startLine });
      wiredByClassNameMap.set(name, wiredClass);
    }
    return [...wiredByClassNameMap.values()];
  }

  buildWiredClass(name, filePath, reachingClass, typeNames) {
    return {
      name,
      path: filePath,
      pathsBelow: [reachingClass.path, ...reachingClass.pathsBelow],
      chain: [`${name} (wired to ${reachingClass.name} by ${formatWiredTypeNames(typeNames)})`, ...reachingClass.chain],
      names: [name, ...reachingClass.names],
      depth: reachingClass.depth + 1,
      kind: reachingClass.kind,
      wiredMethods: [],
    };
  }

  isATop(reachingClass, places) {
    return !places.some(place => place.path !== reachingClass.path && !this.reach.isTestPlace(place));
  }

  buildTopClass(reachingClass) {
    const methods = reachingClass.wiredMethods || (reachingClass.pathsBelow ? this.reach.repositoryAbstractions.findTheMethodsCallingInto(reachingClass.path, reachingClass.pathsBelow) : []);
    return {
      name: reachingClass.name,
      path: reachingClass.path,
      line: this.reach.repositoryAbstractions.findClassDeclarationLine(reachingClass.name, reachingClass.path),
      ...(methods.length ? { methods } : {}),
      chain: reachingClass.chain,
      steps: reachingClass.depth,
    };
  }

  selectTheTopClasses() {
    return [...this.tops].sort(compareByFewestSteps).slice(0, MAX_TOP_CLASSES);
  }

  offerTestsByFileName(reachingClass) {
    if (normaliseName(reachingClass.name).length < MIN_FILE_NAME_CLASS) { this.shortNames.push(reachingClass.name); return; }
    for (const testPath of this.reach.findTestFilesNamedForTheClass(reachingClass.name)) {
      if (readLanguageFamily(testPath) === this.languageFamily) this.offer(this.buildReachingTest(testPath, reachingClass, REACH_KINDS.FILE_NAME));
    }
  }

  addTheChangedTests() {
    const notYetFound = this.reach.collectChangedTestPaths()
      .filter(testPath => readLanguageFamily(testPath) === this.languageFamily && !this.reachingTestsByPathMap.has(testPath));
    for (const testPath of notYetFound) this.reachingTestsByPathMap.set(testPath, this.buildChangedReachingTest(testPath));
  }

  buildChangedReachingTest(testPath) {
    const start = { name: this.testedTypeName, names: [this.testedTypeName] };
    return {
      path: testPath,
      kind: REACH_KINDS.ONLY_IN_THE_CHANGE,
      chain: [],
      changedInTheChange: true,
      exactFileName: isTestPath(testPath) && isAnExactTestFileName(testPath, this.testedTypeName),
      hops: null,
      sharedStems: this.countSharedStems(testPath, start),
      fileNameStems: this.countFileNameStems(testPath),
      methods: this.reach.getOrReadTestMethods(testPath),
    };
  }

  buildReachingTest(testPath, reachingClass, kind) {
    return {
      path: testPath,
      kind,
      chain: [readFileStem(testPath), ...reachingClass.chain],
      changedInTheChange: this.reach.changedPaths.has(testPath),
      exactFileName: isTestPath(testPath) && isAnExactTestFileName(testPath, reachingClass.name),
      hops: reachingClass.depth + 1,
      sharedStems: this.countSharedStems(testPath, reachingClass),
      fileNameStems: this.countFileNameStems(testPath),
      methods: this.reach.getOrReadTestMethods(testPath),
    };
  }

  countSharedStems(testPath, reachingClass) {
    const namesAbove = reachingClass.names.filter(name => name !== this.testedTypeName);
    const testSideStems = new Set([readFileStem(testPath), ...namesAbove].flatMap(collectStems));
    return findSharedStems(testSideStems, this.testedTypeName).length;
  }

  countFileNameStems(testPath) {
    return findSharedStems(new Set(collectStems(readFileStem(testPath))), this.testedTypeName).length;
  }

  offer(reachingTest) {
    const knownReach = this.reachingTestsByPathMap.get(reachingTest.path);
    if (!knownReach || compareByStrength(reachingTest, knownReach) < 0) this.reachingTestsByPathMap.set(reachingTest.path, reachingTest);
  }

  stateTheLimits() {
    if (this.shortNames.length) {
      this.stops.push(`names under ${MIN_FILE_NAME_CLASS} letters: ${this.shortNames.map(name => `\`${name}\``).join(", ")}`);
    }
  }

  rankReachingTests() {
    return sortWithAMixedFirstPage([...this.reachingTestsByPathMap.values()].sort(compareByStrength));
  }
}
