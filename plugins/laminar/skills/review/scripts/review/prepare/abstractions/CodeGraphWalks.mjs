import { ABSTRACTION_KINDS, FILE_STATUS, isADeclaredType, isAFileNamedByTheLanguage, isTheSameNameAcrossConventions, readApplicationName, CachedSourceIndex, buildCallGraphs, CHANGE_KINDS, CHANGE_MODES, countChangedBranches, ChangeReader, CodeGraph, DEFAULT_NAME_MATCHED_TARGETS, findDeployableFolder, findDeployableRoots, findCallsInsideCallArguments, findDiffDriver, findDriver, FileDeclarations, isOwnCodeAt, readLanguageFamily, ModuleReading, ModuleShapes, findNamedPlaces, numberFileLines, findOpenConstructsAndCallArgumentFunctions, readOwnSpans, countPhaseMarks, RepositoryText, findRepositoryToRead, ReviewedChange, Scale, doesSpanHoldLine, TestCode } from "../../../code/index.mjs";
import { readFolderPath } from "../../../files/paths.mjs";
import { createPropertyWhenNotEmpty } from "../../../files/jsonFile.mjs";
import { ReviewTree } from "./ReviewTree.mjs";
import { ReviewedFiles } from "./ReviewedFiles.mjs";
import { ReferencePlaces } from "./references/ReferencePlaces.mjs";
import { mapToUses, OCCURRENCE_KINDS, SameDecisionWalk } from "./walks/decisions/SameDecisionWalk.mjs";
import { IdentifierUses } from "./walks/decisions/IdentifierUses.mjs";
import { owesATest, TestReachWalk, isTheTestReachKnown } from "./walks/testing/TestReachWalk.mjs";
import { ExitBoundaryReachWalk } from "./walks/ExitBoundaryReachWalk.mjs";
import { CallChainsWalk } from "./walks/CallChainsWalk.mjs";
import { ScopedParameterRelationsWalk } from "./walks/parameters/ScopedParameterRelationsWalk.mjs";
import { NearTwinTypeSearch } from "./walks/decisions/NearTwinTypeSearch.mjs";
import { NearTwinEvidence } from "./walks/decisions/NearTwinEvidence.mjs";
import { MatchingKeyWalk } from "./walks/decisions/MatchingKeyWalk.mjs";
import { InOutOperationsWalk } from "./walks/InOutOperationsWalk.mjs";
import { CoreOperationsWalk } from "./walks/core/CoreOperationsWalk.mjs";
import { RebuiltValuesWalk } from "./walks/RebuiltValuesWalk.mjs";
import { MemberGroupsWalk } from "./walks/memberGroups/MemberGroupsWalk.mjs";
import { EntryBoundariesWalk } from "./walks/entryBoundaries/EntryBoundariesWalk.mjs";
import { BoundaryPathsWalk } from "./walks/BoundaryPathsWalk.mjs";
import { FieldReadings } from "./walks/entryBoundaries/FieldReadings.mjs";
import { selectMethodFriction, TestFrictionWalk } from "./walks/testing/TestFrictionWalk.mjs";
import { NamedDeclarationsWalk } from "./walks/declarations/NamedDeclarationsWalk.mjs";
import { DeclarationEnclosingTypes } from "./walks/declarations/DeclarationEnclosingTypes.mjs";
import { ProductionReadings } from "./walks/declarations/ProductionReadings.mjs";
import { OutsideDeclarations } from "./OutsideDeclarations.mjs";
import { parseOwnLinesOfTheSlice } from "../formats/SliceFormat.mjs";
import { CallWalks } from "./walks/CallWalks.mjs";
import { SliceBuilder } from "./slices/CodeSlice.mjs";
import { SourceRoots } from "./slices/SourceRoots.mjs";

const MIN_APPLICATIONS_FOR_AN_ENTRY_BOUNDARY = 2;

export const NAME_MATCHED_TARGETS = DEFAULT_NAME_MATCHED_TARGETS;

const USES_OUTSIDE_THE_CHANGE = 4;
const USES_IN_ANOTHER_FILE = 2;
const USES_IN_TEST_CODE = 1;

const NO_RELATIONS = Object.freeze({ chainGroups: [], parameterRelations: [], coreOperations: [], inOutOperations: [], rebuiltValues: [], memberGroups: [], entryBoundaries: [] });

const createOccurrence = (name, places) => ({ key: name, kind: OCCURRENCE_KINDS.IDENTIFIER, places });

const createOccurrencesOfOneConstant = (name, uses) => (uses.length ? [createOccurrence(name, uses.map(use => use.place))] : []);

const createOccurrencesTakenInTurn = uses => [...uses]
  .sort((left, right) => left.distance - right.distance || left.rank - right.rank)
  .map(use => createOccurrence(use.name, [use.place]));

const addTheirTreeAbstractions = (valuesOnAbstractions, tree) => valuesOnAbstractions.map(valueOnAbstraction => ({ ...valueOnAbstraction, abstraction: tree.findAbstractionAt(valueOnAbstraction.abstraction) }));

const isATestMethod = abstraction => abstraction.isTest && abstraction.scale === Scale.METHOD.name;

const isAProductionMethod = abstraction => !abstraction.isTest && abstraction.scale === Scale.METHOD.name;

export class CodeGraphWalks {
  constructor(savedCodeGraph, { reachBudgetMs, indexCacheFolder } = {}) {
    const codeGraph = CodeGraph.createFromJSON(savedCodeGraph);
    const reviewed = ReviewedChange.createFromJSON(savedCodeGraph);
    this.codeGraph = codeGraph;
    this.extractedReview = reviewed.extractedReview;
    this.reachBudgetMs = reachBudgetMs;
    this.change = ChangeReader.readBackFrom(reviewed.change);
    this.tree = new ReviewTree(this.extractedReview.abstractions);
    this.markTheFileKindClasses();
    this.decisionSearches = addTheirTreeAbstractions(this.extractedReview.decisionSearches, this.tree);
    this.literalConstants = addTheirTreeAbstractions(this.extractedReview.literalConstants, this.tree);
    this.callGraphs = buildCallGraphs(codeGraph, { nameMatchedTargets: NAME_MATCHED_TARGETS });
    this.callWalks = new CallWalks(codeGraph, NAME_MATCHED_TARGETS);
    this.repositoryText = new RepositoryText(this.change.repository, this.change.mode, this.change.files, { cachedSourceIndex: new CachedSourceIndex(this.change.repository, { cacheFolder: indexCacheFolder }) });
    this.testCode = new TestCode(filePath => this.repositoryText.readFileLines(filePath) || []);
    this.references = new ReferencePlaces(codeGraph, filePath => this.repositoryText.readFileLines(filePath), NAME_MATCHED_TARGETS);
    this.sameDecisions = new SameDecisionWalk(codeGraph, this.references, this.repositoryText);
    this.identifierUses = new IdentifierUses(this.references);
    this.roots = findDeployableRoots(findRepositoryToRead(this.change));
    this.moduleReading = ModuleReading.createFromGraph(findRepositoryToRead(this.change), codeGraph, this.roots, ModuleShapes.createFromJSON(savedCodeGraph.moduleShapes));
    this.reviewedFiles = new ReviewedFiles(this.change);
    this.reviewedTestCode = new TestCode(filePath => this.reviewedFiles.readFileLines(filePath));
    this.relations = NO_RELATIONS;
    this.boundaryPaths = [];
  }

  markTheFileKindClasses() {
    for (const extractedAbstraction of this.extractedReview.abstractions) {
      if (extractedAbstraction.scale === Scale.CLASS.name && this.isJudgedAsAFile(extractedAbstraction.path) && this.isAFileWithNoTypeOfItsName(extractedAbstraction)) this.tree.findAbstractionAt(extractedAbstraction.id).kind = ABSTRACTION_KINDS.FILE;
    }
  }

  isJudgedAsAFile(filePath) {
    return this.isReadWhole(filePath) || isAFileNamedByTheLanguage(filePath);
  }

  isReadWhole(filePath) {
    return this.change.mode === CHANGE_MODES.REPOSITORY || this.change.files.some(file => file.path === filePath && file.status === FILE_STATUS.CREATED);
  }

  isAFileWithNoTypeOfItsName(extractedAbstraction) {
    const isOnAFile = (extractedAbstraction.on || []).map(id => this.codeGraph.findAbstractionAt(id)).some(abstraction => abstraction && abstraction.kind === ABSTRACTION_KINDS.FILE);
    return isOnAFile && !this.codeGraph.findAbstractionsIn(extractedAbstraction.path).some(abstraction => isADeclaredType(abstraction) && isTheSameNameAcrossConventions(abstraction.name, extractedAbstraction.name));
  }

  findCallGraph(family) {
    return this.callGraphs.get(family) || null;
  }

  walkEveryAbstraction() {
    this.runSearches();
    this.runNearTwins();
    this.runMatchingKeys();
    this.runUsesOfLiteralNames();
    this.placeTheModules();
    this.runTestReach();
    this.runIoReach();
    this.runBoundaryPaths();
    this.runRelations();
    this.runFieldReadings();
    this.runTestFriction();
    this.runChangedBranches();
    this.runNamedDeclarations();
    this.runPhaseMarks();
    this.runOutsideDeclarations();
    this.runNestedUsesBare();
    this.runSlices();
    this.runOpenConstructsAndCallArguments();
    return this;
  }

  buildReviewAbstractions() {
    return {
      mode: this.change.mode,
      modeReason: this.change.modeReason,
      target: this.change.target,
      excluded: this.change.excluded,
      counts: this.extractedReview.counts,
      notParsed: this.extractedReview.notParsed,
      ...createPropertyWhenNotEmpty("leftOutFiles", this.extractedReview.leftOutFiles || []),
      abstractions: this.tree.convertToJson(),
      abstractionsOfTheChange: this.listAbstractionsOfTheChange(),
      changedLines: this.extractedReview.changedLinesOfTheChange,
      dependencies: this.extractedReview.dependencies,
      chainGroups: this.relations.chainGroups,
      parameterRelations: this.relations.parameterRelations,
      coreOperations: this.relations.coreOperations,
      ...createPropertyWhenNotEmpty("inOutOperations", this.relations.inOutOperations),
      ...createPropertyWhenNotEmpty("rebuiltValues", this.relations.rebuiltValues),
      ...createPropertyWhenNotEmpty("memberGroups", this.relations.memberGroups),
      entryBoundaries: this.relations.entryBoundaries,
      boundaryPaths: this.boundaryPaths,
    };
  }

  listAbstractionsOfTheChange() {
    return this.change.files
      .filter(file => findDriver(file.path))
      .flatMap(file => findNamedPlaces(this.codeGraph, file.path, readApplicationName(file.path, this.roots)).map(place => ({ path: file.path, ...place })));
  }

  runSearches() {
    for (const { abstraction, path: ownPath, addedLines } of this.decisionSearches) {
      const searched = { name: abstraction.name, path: ownPath, addedLines, ownLines: readOwnSpans(abstraction) };
      const sameDecisionAt = this.sameDecisions.findSameDecisionPlaces(searched);
      const occurrences = this.identifierUses.usesOf(searched);
      const placed = this.placeTheSearchResults(abstraction, searched, sameDecisionAt, occurrences);
      abstraction.sameDecisionAt = placed.sameDecisionAt;
      abstraction.searchScope = { family: readLanguageFamily(ownPath), minifiedSkipped: this.repositoryText.countMinified() };
      abstraction.occurrences = placed.occurrences;
    }
  }

  runNearTwins() {
    const evidence = new NearTwinEvidence({ codeGraph: this.codeGraph, repositoryText: this.repositoryText, testCode: this.testCode, callGraphOf: family => this.findCallGraph(family), references: this.references, moduleRootOf: filePath => this.moduleReading.readIdentity(readFolderPath(filePath)).root });
    const occurrencesByAbstractionMap = new NearTwinTypeSearch(this.codeGraph, filePath => this.repositoryText.readFileLines(filePath), evidence).collectOccurrencesByAbstraction(this.tree.listEveryAbstraction());
    for (const [abstraction, twinOccurrences] of occurrencesByAbstractionMap) abstraction.sameDecisionAt = [...(abstraction.sameDecisionAt || []), ...twinOccurrences];
  }

  runMatchingKeys() {
    const matchingKeys = new MatchingKeyWalk(this.repositoryText, this.testCode, family => this.findCallGraph(family), this.references, this.codeGraph);
    for (const abstraction of this.tree.listEveryAbstraction()) {
      const keys = matchingKeys.findMatchingKeys(abstraction).map(({ key, places }) => ({ key, kind: OCCURRENCE_KINDS.MATCHING_KEY, places }));
      if (keys.length) abstraction.sameDecisionAt = [...keys, ...(abstraction.sameDecisionAt || [])];
    }
  }

  placeTheSearchResults(abstraction, searched, sameDecisionAt, occurrences) {
    if (abstraction.isTest) return { sameDecisionAt: [], occurrences: mapToUses([...occurrences, ...sameDecisionAt]) };
    return { sameDecisionAt: [...sameDecisionAt, ...this.sameDecisions.readValuePlacesOf(searched), ...this.sameDecisions.findSharedReadPlaces(searched), ...this.sameDecisions.findDerivedValuePlaces(searched)], occurrences };
  }

  runUsesOfLiteralNames() {
    const isInTheChange = place => this.reviewedFiles.readAddedLines(place.path).has(place.line);
    for (const { abstraction, constants } of this.literalConstants) {
      const measureDistance = place => (isInTheChange(place) ? 0 : USES_OUTSIDE_THE_CHANGE)
        + (place.path === abstraction.path ? 0 : USES_IN_ANOTHER_FILE)
        + (this.reviewedTestCode.isTestCode(place.path, { from: place.line }) ? USES_IN_TEST_CODE : 0);
      const uses = constants.flatMap(({ name, spans }) => this.references.findNamingPlaces(name, readLanguageFamily(abstraction.path))
        .filter(place => !isOwnCodeAt(place, abstraction.path, spans))
        .map(place => ({ name, place, distance: measureDistance(place) }))
        .sort((left, right) => left.distance - right.distance)
        .map((use, rank) => ({ ...use, rank })));
      abstraction.occurrences = constants.length === 1
        ? createOccurrencesOfOneConstant(constants[0].name, uses)
        : createOccurrencesTakenInTurn(uses);
    }
  }

  placeTheModules() {
    for (const reviewAbstraction of this.tree.listEveryAbstraction().filter(abstraction => abstraction.sameDecisionAt.length)) {
      reviewAbstraction.homeModule = this.moduleReading.readIdentity(readFolderPath(reviewAbstraction.path));
      for (const place of reviewAbstraction.sameDecisionAt.flatMap(occurrence => occurrence.places)) {
        place.moduleRoot = this.moduleReading.readIdentity(readFolderPath(place.path)).root;
      }
    }
  }

  runTestReach() {
    const reach = new TestReachWalk(this.repositoryText, this.testCode, this.change.mode, this.references, this.codeGraph, this.reachBudgetMs === undefined ? {} : { budgetMs: this.reachBudgetMs });
    reach.startTheBudget();
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (owesATest(abstraction)) abstraction.reachingTests = reach.readTheTestReachOf(abstraction);
      if (isATestMethod(abstraction)) abstraction.classUnderTest = reach.findTheClassUnderTest(abstraction);
    }
  }

  runIoReach() {
    this.ioReach = new ExitBoundaryReachWalk(this.repositoryText, this.change.mode, filePath => this.reviewedFiles.readAddedLines(filePath), family => this.findCallGraph(family), this.callWalks);
    for (const abstraction of this.tree.listEveryAbstraction()) abstraction.ioReach = this.ioReach.reachOf(abstraction);
  }

  runBoundaryPaths() {
    this.boundaryPaths = new BoundaryPathsWalk(this.repositoryText, family => this.findCallGraph(family), filePath => this.reviewedFiles.readAddedLines(filePath), this.callWalks).walkAbstractions(this.tree.listEveryAbstraction());
  }

  runRelations() {
    this.relations = { ...NO_RELATIONS };
    if (this.change.mode !== CHANGE_MODES.REPOSITORY) return;
    const abstractions = this.tree.listEveryAbstraction();
    const findCallGraph = family => this.findCallGraph(family);
    this.relations.chainGroups = new CallChainsWalk(this.repositoryText, this.testCode, this.change, findCallGraph, this.references, this.callWalks).buildGroups(abstractions);
    this.relations.parameterRelations = new ScopedParameterRelationsWalk(this.repositoryText, this.testCode, this.change, findCallGraph, this.references, this.codeGraph).findRelations(abstractions);
    this.relations.coreOperations = new CoreOperationsWalk(this.repositoryText, this.testCode, findCallGraph, filePath => this.findCoreSearchStart(filePath), this.references, this.callWalks).findRelations(abstractions);
    this.relations.inOutOperations = new InOutOperationsWalk(this.codeGraph, filePath => this.repositoryText.readFileLines(filePath)).findRelations(abstractions);
    this.relations.rebuiltValues = new RebuiltValuesWalk(this.repositoryText, this.testCode, findCallGraph, this.references, this.codeGraph).findRelations(abstractions);
    this.relations.memberGroups = new MemberGroupsWalk(this.repositoryText, this.change, findCallGraph, this.codeGraph).findRelations(abstractions);
    this.entryBoundaryReading = new EntryBoundariesWalk(this.repositoryText, this.testCode, this.change, this.roots, findCallGraph, this.references, this.codeGraph);
    if (new Set(this.roots.map(readFolderPath)).size >= MIN_APPLICATIONS_FOR_AN_ENTRY_BOUNDARY) this.relations.entryBoundaries = this.entryBoundaryReading.walkAbstractions(abstractions);
  }

  runFieldReadings() {
    const readings = this.entryBoundaryReading ? this.entryBoundaryReading.buildSchemaFieldReadings() : [];
    const fieldReadings = new FieldReadings(readings);
    for (const abstraction of this.tree.listEveryAbstraction()) abstraction.fieldReadings = fieldReadings.findFieldReadings(abstraction);
  }

  findCoreSearchStart(filePath) {
    const folder = readFolderPath(filePath);
    const { root } = this.moduleReading.readIdentity(folder);
    if (root && folder.startsWith(`${root}/`)) return root;
    return findDeployableFolder(filePath, this.roots);
  }

  runTestFriction() {
    const friction = new TestFrictionWalk(this.change.files, filePath => this.repositoryText.readFileLines(filePath), this.references, this.codeGraph);
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (!isTheTestReachKnown(abstraction)) continue;
      abstraction.testFriction = friction.collectFriction(abstraction);
      for (const method of abstraction.children.filter(isAProductionMethod)) method.testFriction = selectMethodFriction(abstraction.testFriction);
    }
  }

  runChangedBranches() {
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (!owesATest(abstraction)) continue;
      const lines = this.reviewedFiles.readFileLines(abstraction.path);
      if (!abstraction.lines || !lines) continue;
      const ownLines = numberFileLines(lines).slice(abstraction.lines.from - 1, abstraction.lines.to);
      abstraction.changedBranches = countChangedBranches(ownLines, this.reviewedFiles.readAddedLines(abstraction.path));
    }
  }

  runNamedDeclarations() {
    const readModuleRoot = given => this.moduleReading.readIdentity(readFolderPath(given)).root;
    const declarationEnclosingTypes = new DeclarationEnclosingTypes(this.repositoryText, this.references);
    const named = new NamedDeclarationsWalk(this.repositoryText, this.references, declarationEnclosingTypes, readModuleRoot);
    const readings = new ProductionReadings(this.repositoryText, this.testCode, this.references, declarationEnclosingTypes, readModuleRoot);
    for (const { abstraction, body } of this.listChangedTestMethodBodies()) {
      const homeRoot = named.findTheHomeRootOf(abstraction);
      const found = named.findNamedDeclarations(abstraction, body);
      declarationEnclosingTypes.rememberEnclosingTypes(found);
      abstraction.namedDeclarations = readings.readTheLinesThatReadThem({ ...found, homeRoot }, abstraction.path);
    }
  }

  runPhaseMarks() {
    for (const { abstraction, body } of this.listChangedTestMethodBodies()) {
      abstraction.measures = { ...abstraction.measures, phaseMarks: countPhaseMarks(body, abstraction.path) };
    }
  }

  listChangedTestMethodBodies() {
    const readBody = abstraction => this.reviewedFiles.findFileAt(abstraction.path).readNumberedLines().filter(numberedLine => doesSpanHoldLine(abstraction.lines, numberedLine.line));
    return this.tree.listEveryAbstraction()
      .filter(abstraction => isATestMethod(abstraction) && abstraction.lines && this.reviewedFiles.holds(abstraction.path))
      .map(abstraction => ({ abstraction, body: readBody(abstraction) }));
  }

  runOutsideDeclarations() {
    const changedPaths = this.reviewedFiles.collectChangedPaths();
    const outside = new OutsideDeclarations(this.codeGraph, this.references);
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (abstraction.changeKind !== CHANGE_KINDS.REFERENCE) continue;
      abstraction.outsideDeclaration = outside.findTypeDeclaration({ name: abstraction.name, enclosingTypeName: abstraction.enclosingTypeName, usedFrom: abstraction.path }, changedPaths);
    }
  }

  runNestedUsesBare() {
    const outside = new OutsideDeclarations(this.codeGraph, this.references);
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (abstraction.changeKind !== CHANGE_KINDS.REFERENCE) continue;
      const outer = outside.findOuterTypeOfBareUse({ name: abstraction.name, enclosingTypeName: abstraction.enclosingTypeName, usedFrom: abstraction.path });
      if (outer) abstraction.facts = { ...abstraction.facts, nestedUsedBare: outer };
    }
  }

  runSlices() {
    const readFileLines = filePath => this.repositoryText.readFileLines(filePath);
    const slices = new SliceBuilder(this.change, readFileLines, this.roots, this.references, (filePath, given) => FileDeclarations.createFromGraph(this.codeGraph, filePath, given), this.extractedReview.decisionSearches, SourceRoots.createForTheChange(this.change, readFileLines, this.roots, this.codeGraph.listWalkedFiles()));
    for (const abstraction of this.tree.listEveryAbstraction()) abstraction.slice = slices.buildSlice(abstraction);
  }

  runOpenConstructsAndCallArguments() {
    for (const abstraction of this.tree.listEveryAbstraction()) {
      if (abstraction.scale !== Scale.METHOD.name || abstraction.changeKind === CHANGE_KINDS.REFERENCE) continue;
      const ownLines = parseOwnLinesOfTheSlice(abstraction);
      const driver = findDriver(abstraction.path);
      const { callArgumentFunctions, ...openConstructs } = findOpenConstructsAndCallArgumentFunctions(ownLines, {
        textLines: driver ? driver.findTextLines(ownLines.map(ownLine => ownLine.text)) : new Set(),
        headLine: abstraction.lines ? abstraction.lines.from : null,
      });
      abstraction.openConstructs = openConstructs;
      abstraction.callArgumentFunctions = callArgumentFunctions;
      abstraction.callArgumentCalls = findCallsInsideCallArguments(ownLines, { diffDriver: findDiffDriver(abstraction.path) });
      abstraction.measures = { ...abstraction.measures, nestingDepth: abstraction.openConstructs.constructs.length };
    }
  }
}
