import { formatKeyPath } from "./KeyPaths.mjs";

const ROOT_LINE = 0;

const VALUE_SEPARATOR = " | ";

class Key {
  constructor(segments, line, parent) {
    this.segments = segments;
    this.path = formatKeyPath(segments);
    this.name = segments.length ? segments[segments.length - 1] : "";
    this.line = line;
    this.parent = parent;
    this.ownLines = new Set();
    this.values = [];
    this.childrenByNameMap = new Map();
  }

  get children() {
    return [...this.childrenByNameMap.values()];
  }

  get holdsChildren() {
    return this.childrenByNameMap.size > 0;
  }

  get isAtTheRoot() {
    return !this.parent || !this.parent.segments.length;
  }

  get value() {
    return this.values.join(VALUE_SEPARATOR);
  }

  get childNames() {
    return [...this.childrenByNameMap.keys()];
  }

  listOwnLines() {
    return [...this.ownLines].sort((left, right) => left - right);
  }

  listLines() {
    const lines = new Set(this.ownLines);
    for (const child of this.children) for (const line of child.listLines()) lines.add(line);
    return [...lines].sort((left, right) => left - right);
  }

  findChild(name) {
    return this.childrenByNameMap.get(name) || null;
  }

  findOrAddChild(name, line) {
    if (!this.childrenByNameMap.has(name)) this.childrenByNameMap.set(name, new Key([...this.segments, name], line, this));
    return this.childrenByNameMap.get(name);
  }
}

export class KeyTree {
  constructor() {
    this.root = new Key([], ROOT_LINE, null);
    this.keysByPathMap = new Map();
  }

  static createFromKeyLines(keyLines) {
    const tree = new KeyTree();
    for (const keyLine of keyLines) tree.addKeyLine(keyLine);
    return tree;
  }

  addKeyLine({ segments, line, value = "", valueLines = [] }) {
    if (!segments.length) return;
    let key = this.root;
    for (const segment of segments) {
      key = key.findOrAddChild(segment, line);
      this.keysByPathMap.set(key.path, key);
    }
    key.ownLines.add(line);
    for (const valueLine of valueLines) key.ownLines.add(valueLine);
    if (value) key.values.push(value);
  }

  findKey(keyPath) {
    return this.keysByPathMap.get(keyPath) || null;
  }

  listKeys() {
    return [...this.keysByPathMap.values()];
  }
}
