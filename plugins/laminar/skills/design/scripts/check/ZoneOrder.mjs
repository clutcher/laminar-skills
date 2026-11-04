
const DEFAULT_ZONE_ORDER_NAME = "default";

const RELATIONS = Object.freeze({ CALLS: "calls", IMPLEMENTS: "implements" });

const BOOK_LAYOUT_TEXT = "in calls api\ndomain implements api\ndomain calls spi\nout implements spi\napi calls domain\nspi calls domain\nout calls domain";

const ZONES_BLOCK = /^```zones[ \t]*\n([\s\S]*?)^```/m;

const RELATION_LINE = /^\s*([\w-]+)\s+(calls|implements)\s+([\w-]+)\s*$/;

const ZONE_ORDER_SOURCES = Object.freeze({ BOOK_LAYOUT: "BOOK_LAYOUT", FILE: "FILE", NO_LAYOUT: "NO_LAYOUT", NONE: "NONE" });

const BOOK_ZONE_NAMES = new Set(["in", "api", "domain", "spi", "out"]);

export const NO_LAYOUT_LINE = "no zone order: no conventions file, and the folders of the scope carry none of the book's zone names";

const joinRelation = (from, relation, to) => `${from} ${relation} ${to}`;

class ZoneOrder {
  constructor(source, label, relations) {
    this.source = source;
    this.label = label;
    this.relations = new Set(relations.map(({ from, relation, to }) => joinRelation(from, relation, to)));
    this.zones = new Set(relations.flatMap(({ from, to }) => [from, to]));
  }

  isFound() {
    return this.source === ZONE_ORDER_SOURCES.BOOK_LAYOUT || this.source === ZONE_ORDER_SOURCES.FILE;
  }

  isMissingTheLayout() {
    return this.source === ZONE_ORDER_SOURCES.NO_LAYOUT;
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

  describe() {
    if (this.source === ZONE_ORDER_SOURCES.BOOK_LAYOUT) return `the book's layout, ${[...this.relations].join(", ")}, nothing calls in`;
    if (this.source === ZONE_ORDER_SOURCES.FILE) return `${this.label}, ${[...this.relations].join(", ")}`;
    if (this.source === ZONE_ORDER_SOURCES.NO_LAYOUT) return "none, so the cycle check reports cycles only";
    return `none found (${this.label}), so the cycle check reports cycles only`;
  }
}

const readRelations = blockText => {
  const relations = [];
  for (const line of blockText.split("\n")) {
    const match = RELATION_LINE.exec(line);
    if (match) relations.push({ from: match[1], relation: match[2], to: match[3] });
  }
  return relations;
};

const readZonesBlock = text => {
  const block = ZONES_BLOCK.exec(text.replace(/\r\n/g, "\n"));
  return block ? readRelations(block[1]) : [];
};

const carriesABookZoneName = folderPath => folderPath.split("/").some(folderName => BOOK_ZONE_NAMES.has(folderName));

export const readZoneOrder = (zoneOrderName, currentTree, scopeFolderPaths) => {
  if (!zoneOrderName || zoneOrderName === DEFAULT_ZONE_ORDER_NAME) {
    if (!scopeFolderPaths.some(carriesABookZoneName)) return new ZoneOrder(ZONE_ORDER_SOURCES.NO_LAYOUT, DEFAULT_ZONE_ORDER_NAME, []);
    return new ZoneOrder(ZONE_ORDER_SOURCES.BOOK_LAYOUT, DEFAULT_ZONE_ORDER_NAME, readRelations(BOOK_LAYOUT_TEXT));
  }
  if (!currentTree) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} not read, no --repo given`, []);

  const zoneOrderText = currentTree.readFileText(zoneOrderName);
  if (zoneOrderText === null) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} is not in the repository`, []);

  const relations = readZonesBlock(zoneOrderText);
  if (!relations.length) return new ZoneOrder(ZONE_ORDER_SOURCES.NONE, `${zoneOrderName} holds no fenced block zones with a line "<zone> calls <zone>" or "<zone> implements <zone>"`, []);
  return new ZoneOrder(ZONE_ORDER_SOURCES.FILE, zoneOrderName, relations);
};
