import { CallGraph } from "./CallGraph.mjs";
import { CHANGE_MODES } from "../../inputs/change/ChangeReader.mjs";
import { readLanguageFamily } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { findMethodRelationFinder } from "../finders/LanguageStrategies.mjs";
import { findDiffDriver } from "../../inputs/source/Languages.mjs";
import { buildCallGraph } from "./CallGraphBuilder.mjs";
import { isABuildFile } from "../abstractions/application/index.mjs";

const CALL_GRAPH_CACHE_SECTION = "calls";

const CALL_GRAPH_ORIGINS = Object.freeze({ READ: "read", BUILT: "built" });

const NO_CALL_GRAPH = null;

const pairWithItsOrigin = (callGraph, origin) => ({ callGraph, origin });

class CallGraphLoading {
  constructor() {
    this.built = [];
    this.read = [];
    this.milliseconds = 0;
  }

  recordOrigin(family, origin) {
    this[origin].push(family);
  }

  recordMillisecondsSince(started) {
    this.milliseconds += performance.now() - started;
  }
}

export class CallGraphs {
  constructor(repositoryText, change, walk, cachedSourceIndex) {
    this.repositoryText = repositoryText;
    this.cachedSourceIndex = cachedSourceIndex;
    this.change = change;
    this.walk = walk;
    this.callGraphsByFamilyMap = new Map();
    this.loading = new CallGraphLoading();
  }

  readEvery(families) {
    for (const family of families) this.getOrAddCallGraph(family);
    return this;
  }

  getOrAddCallGraph(family) {
    if (!this.callGraphsByFamilyMap.has(family)) this.addTimedCallGraph(family);
    return this.callGraphsByFamilyMap.get(family);
  }

  addTimedCallGraph(family) {
    const started = performance.now();
    this.addCallGraph(family);
    this.loading.recordMillisecondsSince(started);
  }

  addCallGraph(family) {
    const found = this.readCallGraph(family);
    if (found) this.loading.recordOrigin(family, found.origin);
    this.callGraphsByFamilyMap.set(family, found ? found.callGraph : NO_CALL_GRAPH);
  }

  readCallGraph(family) {
    const found = this.change.mode === CHANGE_MODES.PATCH ? this.buildCallGraphOfThePatch(family) : this.loadCallGraphOfTheRepository(family);
    if (found && found.callGraph) found.callGraph.methodReferences = this.readMethodReferences(found.callGraph);
    return found;
  }

  readMethodReferences(callGraph) {
    return callGraph.methods.map(method => findMethodRelationFinder(findDiffDriver(method.path)).findMethodReferences(method, this.repositoryText.readFileLines(method.path) || [], callGraph));
  }

  listEveryCallGraph() {
    return [...this.callGraphsByFamilyMap.values()].filter(Boolean);
  }

  loadCallGraphOfTheRepository(family) {
    if (this.change.mode !== CHANGE_MODES.REPOSITORY) return null;
    const index = this.cachedSourceIndex.findFamilyFiles(family);
    if (!index) return null;
    const cache = this.cachedSourceIndex.readIndexCache();
    const sourceFiles = index.files.filter(file => !isABuildFile(file.path));
    const paths = sourceFiles.map(file => file.path);
    const saved = cache.read(family, paths, CALL_GRAPH_CACHE_SECTION);
    if (saved) return pairWithItsOrigin(CallGraph.createFromSaved(saved), CALL_GRAPH_ORIGINS.READ);
    const built = buildCallGraph(family, sourceFiles.map(file => this.createWalkedSource(file.path, index.readFileLines(file))));
    cache.write(family, paths, () => built.convertToSaved(), CALL_GRAPH_CACHE_SECTION);
    return pairWithItsOrigin(built, CALL_GRAPH_ORIGINS.BUILT);
  }

  createWalkedSource(filePath, lines) {
    return { path: filePath, lines, declarations: this.walk.findDeclarationsAt(filePath) || [] };
  }

  buildCallGraphOfThePatch(family) {
    const sources = this.change.files
      .filter(file => readLanguageFamily(file.path) === family && !isABuildFile(file.path))
      .map(file => this.createWalkedSource(file.path, this.repositoryText.readFileLines(file.path)))
      .filter(source => source.lines);
    return pairWithItsOrigin(buildCallGraph(family, sources), CALL_GRAPH_ORIGINS.BUILT);
  }
}
