import { UnionFind } from "../../../../../collections/UnionFind.mjs";

const MIN_METHODS_OF_A_GROUP_WITH_NO_FIELD = 2;

const FIELD_KEY_PREFIX = "field:";

const CONSTANT_KEY_PREFIX = "constant:";

const TYPE_KEY_PREFIX = "type:";

const METHOD_KEY_PREFIX = "method:";

const createFieldKey = name => `${FIELD_KEY_PREFIX}${name}`;

const createConstantKey = name => `${CONSTANT_KEY_PREFIX}${name}`;

const createTypeKey = name => `${TYPE_KEY_PREFIX}${name}`;

const createMethodKey = position => `${METHOD_KEY_PREFIX}${position}`;

const readKeyName = (key, prefix) => key.slice(prefix.length);

const listFieldsUsedBy = method => [...new Set([...method.reads, ...method.writes])];

export const findSharedFields = methods => {
  const fieldSets = methods.map(listFieldsUsedBy).filter(fields => fields.length).map(fields => new Set(fields));
  if (fieldSets.length < 2) return [];
  const [first, ...rest] = fieldSets;
  return [...first].filter(field => rest.every(fields => fields.has(field))).sort();
};

class GroupKeys {
  constructor(methods, className, constantFields) {
    this.className = className;
    this.constantFields = new Set(constantFields);
    this.sharedFields = new Set(findSharedFields(methods));
    const exposed = methods.filter(method => method.exposed);
    this.fieldsOfExposedMethods = new Set(exposed.flatMap(listFieldsUsedBy));
    this.typesOfExposedMethods = new Set(exposed.flatMap(method => method.types));
  }

  isAGroupField(field) {
    return !this.sharedFields.has(field) && !this.fieldsOfExposedMethods.has(field);
  }

  isAGroupType(type) {
    return type !== this.className && !this.typesOfExposedMethods.has(type);
  }

  listKeysOf(method) {
    if (method.exposed) return [];
    return [
      ...listFieldsUsedBy(method).filter(field => this.isAGroupField(field)).map(field => (this.constantFields.has(field) ? createConstantKey(field) : createFieldKey(field))),
      ...method.types.filter(type => this.isAGroupType(type)).map(createTypeKey),
    ];
  }
}

class MemberJoining {
  constructor(methods, keys) {
    this.methods = methods;
    this.keys = keys;
    this.union = new UnionFind();
    this.privatePositions = methods.map((method, position) => position).filter(position => !methods[position].exposed);
    this.keysByPositionMap = new Map(this.privatePositions.map(position => [position, keys.listKeysOf(methods[position])]));
  }

  joinBySharedKeys() {
    for (const position of this.privatePositions) {
      for (const key of this.keysByPositionMap.get(position)) this.union.join(createMethodKey(position), key);
    }
  }

  readRoot(position) {
    return this.union.findRoot(createMethodKey(position));
  }

  listComponentPositions(root) {
    return this.privatePositions.filter(position => this.readRoot(position) === root);
  }

  usesAGroupField(positions) {
    return positions.some(position => this.keysByPositionMap.get(position).some(key => key.startsWith(FIELD_KEY_PREFIX)));
  }

  holdsAKey(positions) {
    return positions.some(position => this.keysByPositionMap.get(position).length);
  }

  listCallerPositionsOutside(positions) {
    const names = new Set(positions.map(position => this.methods[position].name));
    return this.methods.map((method, at) => at).filter(at => !positions.includes(at) && this.methods[at].callees.some(callee => names.has(callee)));
  }

  findTheOneCallerRoot(positions) {
    const callers = this.listCallerPositionsOutside(positions);
    if (!callers.length || callers.some(caller => this.methods[caller].exposed)) return null;
    const roots = new Set(callers.map(caller => this.readRoot(caller)));
    if (roots.size !== 1) return null;
    const [root] = roots;
    return this.holdsAKey(this.listComponentPositions(root)) ? root : null;
  }

  joinCalledStepsToTheirCallers() {
    for (let joined = true; joined;) {
      joined = false;
      for (const root of new Set(this.privatePositions.map(position => this.readRoot(position)))) {
        const positions = this.listComponentPositions(root);
        if (this.usesAGroupField(positions)) continue;
        const callerRoot = this.findTheOneCallerRoot(positions);
        if (callerRoot === null) continue;
        this.union.join(root, callerRoot);
        joined = true;
        break;
      }
    }
  }

  collectGroups() {
    const positionsByRootMap = new Map();
    for (const position of this.privatePositions) {
      const root = this.union.findRoot(createMethodKey(position));
      if (!positionsByRootMap.has(root)) positionsByRootMap.set(root, []);
      positionsByRootMap.get(root).push(position);
    }
    return [...positionsByRootMap.values()]
      .map(positions => this.describeGroup(positions))
      .filter(group => group.holdsAField || (group.holdsAKey && group.methodPositions.length >= MIN_METHODS_OF_A_GROUP_WITH_NO_FIELD));
  }

  describeGroup(positions) {
    const keys = [...new Set(positions.flatMap(position => this.keysByPositionMap.get(position)))];
    return {
      methodPositions: positions,
      holdsAField: keys.some(key => key.startsWith(FIELD_KEY_PREFIX)),
      holdsAKey: keys.length > 0,
      fields: [
        ...keys.filter(key => key.startsWith(FIELD_KEY_PREFIX)).map(key => readKeyName(key, FIELD_KEY_PREFIX)),
        ...keys.filter(key => key.startsWith(CONSTANT_KEY_PREFIX)).map(key => readKeyName(key, CONSTANT_KEY_PREFIX)),
      ].sort(),
      types: keys.filter(key => key.startsWith(TYPE_KEY_PREFIX)).map(key => readKeyName(key, TYPE_KEY_PREFIX)).sort(),
    };
  }
}

export function groupMembers({ className, methods, constantFields = [] }) {
  const keys = new GroupKeys(methods, className, constantFields);
  const joining = new MemberJoining(methods, keys);
  joining.joinBySharedKeys();
  joining.joinCalledStepsToTheirCallers();
  const groups = joining.collectGroups()
    .sort((left, right) => left.methodPositions[0] - right.methodPositions[0])
    .map(({ holdsAField, holdsAKey, ...group }, index) => ({ number: index + 1, ...group }));
  return { sharedFields: [...keys.sharedFields], groups };
}
