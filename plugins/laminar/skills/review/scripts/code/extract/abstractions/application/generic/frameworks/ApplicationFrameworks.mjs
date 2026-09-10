import { CLASS_FINDER_REGISTRY } from "../../../class/index.mjs";
import { METHOD_FINDER_REGISTRY } from "../../../method/index.mjs";
import { MODULE_FINDER_REGISTRY } from "../../../module/index.mjs";
import { FinderContext } from "../../../../finders/FinderContext.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../../../../graph/Evidence.mjs";
import { findDeployableFolder } from "../ApplicationFolders.mjs";
import { findFinderReadingTheFile } from "../../index.mjs";
import { holdsTheFramework } from "./FrameworkPresence.mjs";
import { declaresFrameworkMarksOrDependencies, findDependencyLineNamingTheFramework, findIndexOfFirstLineMarkingTheFramework } from "./FrameworkMarks.mjs";

const FRAMEWORK_STRATEGIES = Object.freeze([CLASS_FINDER_REGISTRY, METHOD_FINDER_REGISTRY, MODULE_FINDER_REGISTRY]
  .flatMap(registry => registry.listEveryStrategy())
  .filter(declaresFrameworkMarksOrDependencies));

const compareByName = (left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

export function findFrameworksMarkedIn(filePath, lines) {
  const context = FinderContext.createForFile(filePath);
  const found = [];
  for (const strategy of FRAMEWORK_STRATEGIES) {
    if (!strategy.frameworkMarkPatterns || !context.speaks(strategy) || holdsTheFramework(found, strategy.framework)) continue;
    const at = findIndexOfFirstLineMarkingTheFramework(strategy, lines || []);
    if (at >= 0) found.push({ name: strategy.framework, foundBy: strategy.name, line: at + 1, mark: String(lines[at]).trim() });
  }
  return found.sort(compareByName);
}

const compareByPath = (left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

const createFrameworkMarkedInAFile = (filePath, marked) => ({
  name: marked.name,
  evidence: new Evidence({ kind: EVIDENCE_KINDS.CONVENTION, foundBy: marked.foundBy, detail: `${filePath}: ${marked.mark} at line ${marked.line}` }),
});

export const createMarkedFramework = marked => ({
  name: marked.name,
  evidence: new Evidence({ kind: EVIDENCE_KINDS.CONVENTION, foundBy: marked.foundBy, detail: `${marked.mark} at line ${marked.line}` }),
});

const createDeclaredFramework = (strategy, line, dependencyFile, foundBy) => ({
  name: strategy.framework,
  evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy, detail: `${dependencyFile.path} names ${line}` }),
});

function findDeclaredFrameworks(dependencyFile) {
  const foundBy = findFinderReadingTheFile(dependencyFile.path).name;
  const found = [];
  for (const strategy of FRAMEWORK_STRATEGIES) {
    if (holdsTheFramework(found, strategy.framework)) continue;
    const line = findDependencyLineNamingTheFramework(strategy, dependencyFile.lines);
    if (line === undefined) continue;
    found.push(createDeclaredFramework(strategy, line, dependencyFile, foundBy));
  }
  return found;
}

export class ApplicationFrameworks {
  constructor(roots = [], dependencyFiles = []) {
    this.roots = roots;
    this.markedByFolderMap = new Map();
    this.declaredByFolderMap = new Map();
    for (const file of dependencyFiles) {
      const folder = this.findApplicationFolder(file.path);
      const declared = this.declaredByFolderMap.get(folder) || [];
      for (const framework of findDeclaredFrameworks(file)) if (!holdsTheFramework(declared, framework.name)) declared.push(framework);
      this.declaredByFolderMap.set(folder, declared.sort(compareByName));
    }
  }

  findApplicationFolder(filePath) {
    return findDeployableFolder(filePath, this.roots) ?? "";
  }

  listDeclaredIn(applicationFolder) {
    return this.declaredByFolderMap.get(applicationFolder) || [];
  }

  noteTheMarksOf(walkedFiles) {
    for (const file of [...walkedFiles].sort(compareByPath)) {
      const folder = this.findApplicationFolder(file.path);
      const marked = this.markedByFolderMap.get(folder) || [];
      for (const framework of file.frameworks || []) {
        if (holdsTheFramework(marked, framework.name) || holdsTheFramework(this.listDeclaredIn(folder), framework.name)) continue;
        marked.push(createFrameworkMarkedInAFile(file.path, framework));
      }
      this.markedByFolderMap.set(folder, marked.sort(compareByName));
    }
  }

  findFrameworksOfApplication(applicationFolder) {
    return [...this.listDeclaredIn(applicationFolder), ...(this.markedByFolderMap.get(applicationFolder) || [])].sort(compareByName);
  }

  listFrameworkNamesAt(folder) {
    return this.findFrameworksOfApplication(this.findApplicationFolder(folder)).map(framework => framework.name);
  }

  listDeclaredFor(filePath) {
    return this.listDeclaredIn(this.findApplicationFolder(filePath));
  }

  listFrameworksFor(filePath, marked = []) {
    return [...this.listDeclaredFor(filePath), ...marked];
  }

  buildSignature() {
    return [...this.declaredByFolderMap.entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([folder, frameworks]) => `${folder}:${frameworks.map(framework => framework.name).join(",")}`).join(";");
  }
}

export const NO_DECLARED_FRAMEWORKS = new ApplicationFrameworks();
