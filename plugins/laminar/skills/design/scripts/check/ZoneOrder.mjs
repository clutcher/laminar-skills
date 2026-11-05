
const DEFAULT_ZONE_ORDER_NAME = "default";

const RELATIONS = Object.freeze({ CALLS: "calls", IMPLEMENTS: "implements" });

const DEFAULT_ZONE_ORDER_TEXT = "in calls api\ndomain implements api\ndomain calls spi\nout implements spi\napi calls domain\nspi calls domain\nout calls domain\nout calls in of another module";

const ZONES_BLOCK = /^```zones[ \t]*\n([\s\S]*?)^```/m;

const RELATION_LINE = /^\s*([\w-]+)\s+(calls|implements)\s+([\w-]+)(\s+of another module)?\s*$/;

const ZONE_ORDER_SOURCES = Object.freeze({ DEFAULT: "DEFAULT", FILE: "FILE", NO_LAYOUT: "NO_LAYOUT", NONE: "NONE" });

// The folders of the backend layout of the book; domain is left out, because a folder of that name is common outside the layout.
const LAYOUT_FOLDER_NAMES = new Set(["in", "api", "spi", "out"]);

// The 2 folders that the book wraps a whole module in, so only they tell 1 module from another; api and spi stand inside app, and a folder inside in or out may take any name.
const IN_AND_OUT_FOLDER_NAMES = new Set(["in", "out"]);

const NO_SCOPE_MODULES = Object.freeze({ layoutModules: new Set(), modules: new Set() });

const NO_ZONES_BLOCK = Object.freeze({ relations: [], unreadLines: [] });

export const NO_LAYOUT_LINE = "zone order: not applied, no conventions file, and no folder of the scope has the backend layout of an api, spi, in or out folder";

const listAncestorFolders = folderPath => folderPath.split("/").map((_, at, folderNames) => folderNames.slice(0, at + 1).join("/"));

const joinRelation = (from, relation, to) => `${from} ${relation} ${to}`;

class ZoneOrder {
  constructor(source, label, { relations, unreadLines } = NO_ZONES_BLOCK, { layoutModules, modules } = NO_SCOPE_MODULES) {
    this.source = source;
    this.layoutModules = layoutModules;
    this.modules = modules;
    this.label = label;
    this.unreadLines = unreadLines;
    this.relations = new Set(relations.filter(relation => !relation.isAcrossModules).map(({ from, relation, to }) => joinRelation(from, relation, to)));
    this.relationsAcrossModules = new Set(relations.filter(relation => relation.isAcrossModules).map(({ from, relation, to }) => joinRelation(from, relation, to)));
    this.zones = new Set(relations.flatMap(({ from, to }) => [from, to]));
  }

  isFound() {
    return this.source === ZONE_ORDER_SOURCES.DEFAULT || this.source === ZONE_ORDER_SOURCES.FILE;
  }

  isMissingTheLayout() {
    return this.source === ZONE_ORDER_SOURCES.NO_LAYOUT;
  }

  // The default order holds only for a class under a layout module; an order of a conventions file holds for every class.
  appliesToTheFolder(folderPath) {
    if (this.source !== ZONE_ORDER_SOURCES.DEFAULT) return this.isFound();
    return listAncestorFolders(folderPath).some(ancestor => this.layoutModules.has(ancestor));
  }

  namesTheZone(zone) {
    return this.zones.has(zone);
  }

  allowsTheImplements(fromZone, toZone) {
    return fromZone === toZone || this.relations.has(joinRelation(fromZone, RELATIONS.IMPLEMENTS, toZone));
  }

  allowsTheCallByItsOrder(fromZone, toZone) {
    return fromZone === toZone || this.relations.has(joinRelation(fromZone, RELATIONS.CALLS, toZone));
  }

  allowsTheCall(fromZone, toZone) {
    return this.allowsTheCallByItsOrder(fromZone, toZone) || this.allowsTheImplements(fromZone, toZone);
  }

  // A relation "of another module" holds only where both folders lie under a module and the 2 modules differ, so a call inside 1 module stays checked by the plain order.
  allowsTheCallAcrossModules(fromZone, fromFolderPath, toZone, toFolderPath) {
    if (!this.relationsAcrossModules.has(joinRelation(fromZone, RELATIONS.CALLS, toZone))) return false;

    const fromModule = this.findModuleOfTheFolder(fromFolderPath);
    const toModule = this.findModuleOfTheFolder(toFolderPath);
    return fromModule !== null && toModule !== null && fromModule !== toModule;
  }

  // The deepest module above the folder, so a module nested in another module counts as its own module.
  findModuleOfTheFolder(folderPath) {
    const modules = listAncestorFolders(folderPath).filter(ancestor => this.modules.has(ancestor));
    return modules.length ? modules[modules.length - 1] : null;
  }

  describeUnreadLines() {
    return this.unreadLines.map(line => `zone order: line not read: ${line}`);
  }

  listRelationTexts() {
    return [...this.relations, ...[...this.relationsAcrossModules].map(relation => `${relation} of another module`)];
  }

  describe() {
    if (this.source === ZONE_ORDER_SOURCES.DEFAULT) return `the default zone order of the design skill, ${this.listRelationTexts().join(", ")}`;
    if (this.source === ZONE_ORDER_SOURCES.FILE) return `${this.label}, ${this.listRelationTexts().join(", ")}`;
    if (this.source === ZONE_ORDER_SOURCES.NO_LAYOUT) return "none, so the cycle check reports cycles only";
    return `none found (${this.label}), so the cycle check reports cycles only`;
  }
}

// A relation "of another module" is read only with calls, so a line "<zone> implements <zone> of another module" is a line not read.
const readRelation = line => {
  const match = RELATION_LINE.exec(line);
  if (!match) return null;
  const isAcrossModules = match[4] !== undefined;
  if (isAcrossModules && match[2] !== RELATIONS.CALLS) return null;
  return { from: match[1], relation: match[2], to: match[3], isAcrossModules };
};

// Each relation of the block, and each other line that is not blank, so the check names a line it did not read.
const readZonesBlockLines = blockText => {
  const relations = [];
  const unreadLines = [];
  for (const line of blockText.split("\n")) {
    if (!line.trim()) continue;
    const relation = readRelation(line);
    if (relation) relations.push(relation);
    else unreadLines.push(line.trim());
  }
  return { relations, unreadLines };
};

const readZonesBlock = text => {
  const block = ZONES_BLOCK.exec(text.replace(/\r\n/g, "\n"));
  return block ? readZonesBlockLines(block[1]) : NO_ZONES_BLOCK;
};

// Each folder that holds a folder of the backend layout, so the default order applies to the classes under it.
const listLayoutModules = scopeFolderPaths => {
  const layoutModules = new Set();
  for (const folderPath of scopeFolderPaths) {
    const folderNames = folderPath.split("/");
    folderNames.forEach((folderName, at) => {
      if (at > 0 && LAYOUT_FOLDER_NAMES.has(folderName)) layoutModules.add(folderNames.slice(0, at).join("/"));
    });
  }
  return layoutModules;
};

// Each folder that holds an in or out folder and lies inside no in or out folder, so a relation "of another module" tells the modules apart; only the first in or out folder of a path counts, because every folder below it lies inside it.
const listModules = scopeFolderPaths => {
  const modules = new Set();
  for (const folderPath of scopeFolderPaths) {
    const folderNames = folderPath.split("/");
    const inOrOutAt = folderNames.findIndex(folderName => IN_AND_OUT_FOLDER_NAMES.has(folderName));
    if (inOrOutAt > 0) modules.add(folderNames.slice(0, inOrOutAt).join("/"));
  }
  return modules;
};

export const readZoneOrder = (zoneOrderName, currentTree, scopeFolderPaths) => {
  const scopeModules = { layoutModules: listLayoutModules(scopeFolderPaths), modules: listModules(scopeFolderPaths) };
  if (!zoneOrderName || zoneOrderName === DEFAULT_ZONE_ORDER_NAME) {
    if (!scopeModules.layoutModules.size) return new ZoneOrder(ZONE_ORDER_SOURCES.NO_LAYOUT, DEFAULT_ZONE_ORDER_NAME);
    return new ZoneOrder(ZONE_ORDER_SOURCES.DEFAULT, DEFAULT_ZONE_ORDER_NAME, readZonesBlockLines(DEFAULT_ZONE_ORDER_TEXT), scopeModules);
  }
  if (!currentTree) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} not read, no --repo given`);

  const zoneOrderText = currentTree.readFileText(zoneOrderName);
  if (zoneOrderText === null) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} is not in the repository`);

  const zonesBlock = readZonesBlock(zoneOrderText);
  if (!zonesBlock.relations.length) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} holds no fenced block zones with a line "<zone> calls <zone>" or "<zone> implements <zone>"`, zonesBlock);
  return new ZoneOrder(ZONE_ORDER_SOURCES.FILE, zoneOrderName, zonesBlock, scopeModules);
};
