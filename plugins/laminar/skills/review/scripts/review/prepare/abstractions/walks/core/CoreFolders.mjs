import { readFolderPath } from "../../../../../files/paths.mjs";

const splitSegments = folder => String(folder || "").split("/").filter(Boolean);

const isWithin = (filePath, folder) => folder === "" || filePath.startsWith(`${folder}/`);

const readChildFolder = (filePath, level) => {
  const rest = splitSegments(level === "" ? filePath : filePath.slice(level.length + 1));
  if (rest.length < 2) return "";
  return level === "" ? rest[0] : `${level}/${rest[0]}`;
};

const listLevels = (start, fileFolder) => {
  const below = splitSegments(fileFolder).slice(splitSegments(start).length);
  const levels = [];
  let level = start;
  for (const segment of below) {
    levels.push(level);
    level = level === "" ? segment : `${level}/${segment}`;
  }
  return levels;
};

const groupStronglyJoined = (abstractions, neighboursOf) => {
  const indexByAbstractionMap = new Map();
  const lowByAbstractionMap = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  let counter = 0;
  const visit = abstraction => {
    indexByAbstractionMap.set(abstraction, counter);
    lowByAbstractionMap.set(abstraction, counter);
    counter++;
    stack.push(abstraction);
    onStack.add(abstraction);
    for (const next of neighboursOf(abstraction)) {
      if (!indexByAbstractionMap.has(next)) { visit(next); lowByAbstractionMap.set(abstraction, Math.min(lowByAbstractionMap.get(abstraction), lowByAbstractionMap.get(next))); }
      else if (onStack.has(next)) lowByAbstractionMap.set(abstraction, Math.min(lowByAbstractionMap.get(abstraction), indexByAbstractionMap.get(next)));
    }
    if (lowByAbstractionMap.get(abstraction) !== indexByAbstractionMap.get(abstraction)) return;
    const group = [];
    for (let poppedVertex = stack.pop(); ; poppedVertex = stack.pop()) {
      onStack.delete(poppedVertex);
      group.push(poppedVertex);
      if (poppedVertex === abstraction) break;
    }
    groups.push(group.sort());
  };
  for (const abstraction of abstractions) if (!indexByAbstractionMap.has(abstraction)) visit(abstraction);
  return groups;
};

const callsOutsideTheProcess = file => Boolean(file.exit);

export class CoreFolders {
  constructor(callGraph, startOf) {
    this.callGraph = callGraph;
    this.startOf = startOf;
    this.readingByLevelMap = new Map();
  }

  findCores(filePath) {
    const start = this.startOf(filePath);
    if (start === null || start === undefined || !isWithin(filePath, start)) return [];
    const found = [];
    for (const level of listLevels(start, readFolderPath(filePath))) {
      const child = readChildFolder(filePath, level);
      const { cores } = this.getOrReadLevel(level);
      const core = cores.find(core => core.folders.includes(child));
      if (core) { found.push(core); continue; }
      if (found.length || cores.length) break;
    }
    return found.reverse();
  }

  getOrReadLevel(level) {
    if (!this.readingByLevelMap.has(level)) this.readingByLevelMap.set(level, this.readLevel(level));
    return this.readingByLevelMap.get(level);
  }

  readLevel(level) {
    const filesByChildMap = new Map();
    for (const file of this.callGraph.files || []) {
      if (!isWithin(file.path, level)) continue;
      const child = readChildFolder(file.path, level);
      if (!child) continue;
      if (!filesByChildMap.has(child)) filesByChildMap.set(child, []);
      filesByChildMap.get(child).push(file);
    }
    const importsByChildMap = new Map([...filesByChildMap].map(([child, files]) => [child, this.collectImportedChildren(files, level, child)]));
    const groups = groupStronglyJoined([...filesByChildMap.keys()].sort(), child => [...(importsByChildMap.get(child) || [])]);
    const groupByChildMap = new Map(groups.flatMap(group => group.map(child => [child, group])));
    const collectImportedGroups = group => new Set(group.flatMap(child => [...(importsByChildMap.get(child) || [])]).map(child => groupByChildMap.get(child)).filter(importedGroup => importedGroup !== group));
    const findImporters = group => groups.filter(other => other !== group && collectImportedGroups(other).has(group))
      .sort((left, right) => left[0].localeCompare(right[0]));
    const cores = groups
      .filter(group => collectImportedGroups(group).size === 0 && findImporters(group).length > 0)
      .filter(group => !group.some(child => filesByChildMap.get(child).some(callsOutsideTheProcess)))
      .map(group => ({ level, folders: group, importedBy: findImporters(group) }));
    return { cores };
  }

  collectImportedChildren(files, level, own) {
    const imported = new Set();
    for (const file of files) {
      for (const target of file.imports) {
        const child = isWithin(target, level) ? readChildFolder(target, level) : "";
        if (child && child !== own) imported.add(child);
      }
    }
    return imported;
  }
}
