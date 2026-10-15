import { CHANGE_KINDS, changesTheCode, formatDisplayNameOfMethod, holdsAnAddedLine, isTestPath, isUpperSnakeName, readLanguageFamily, Scale } from "../../../../../code/index.mjs";
import { ClassMemberUses } from "./ClassMemberUses.mjs";
import { groupMembers } from "./MemberGroups.mjs";

export const MIN_MEMBER_GROUPS = 2;

export const SELECTION_REASONS = Object.freeze({ CREATED: "created", GROUP_CHANGED: "member group changed" });

const isAChangedProductionClass = abstraction => abstraction.scale === Scale.CLASS.name && !abstraction.isTest && !isTestPath(abstraction.path)
  && Boolean(abstraction.lines) && changesTheCode(abstraction.changeKind);

const readMethodDisplayName = (className, method) => formatDisplayNameOfMethod({ enclosingTypeName: className, name: method.name });

const describeMethod = (classUses, method, groupNumberByPositionMap, position) => ({
  displayName: readMethodDisplayName(classUses.isAFile ? "" : classUses.name, method),
  name: method.name,
  from: method.from,
  to: method.to,
  exposed: method.exposed,
  reads: method.reads,
  writes: method.writes,
  takes: method.takes,
  returns: method.returns,
  callsTypes: method.callsTypes,
  calls: method.callees,
  calledBy: classUses.methods.filter(other => other !== method && other.callees.includes(method.name)).map(other => other.name),
  group: groupNumberByPositionMap.get(position) || 0,
});

const findCallsIntoTheGroup = (classUses, positions) => {
  const namesInside = new Set(positions.map(position => classUses.methods[position].name));
  return classUses.methods
    .filter((method, position) => !positions.includes(position))
    .flatMap(method => method.ownCalls.filter(call => namesInside.has(call.callee)).map(call => ({ from: method.name, callee: call.callee, line: call.line })));
};

const describeGroup = (classUses, group) => ({
  number: group.number,
  methods: group.methodPositions.map(position => classUses.methods[position].name),
  fields: group.fields,
  types: group.types,
  callsInto: findCallsIntoTheGroup(classUses, group.methodPositions),
});

const listGroupLines = (classUses, groups) => {
  const fieldLineByNameMap = new Map(classUses.fields.map(field => [field.name, field.line]));
  return groups.flatMap(group => [
    ...group.methodPositions.map(position => ({ from: classUses.methods[position].from, to: classUses.methods[position].to })),
    ...group.fields.filter(field => fieldLineByNameMap.has(field)).map(field => ({ from: fieldLineByNameMap.get(field), to: fieldLineByNameMap.get(field) })),
  ]);
};

export class MemberGroupsWalk {
  constructor(repositoryText, change, callGraphOf, codeGraph) {
    this.readFileLines = filePath => repositoryText.readFileLines(filePath);
    this.findCallGraph = callGraphOf;
    this.codeGraph = codeGraph;
    this.addedLinesByPathMap = change.readAddedLinesByPath();
    this.usesByFamilyMap = new Map();
  }

  getOrBuildUses(family) {
    if (!this.usesByFamilyMap.has(family)) {
      const callGraph = family ? this.findCallGraph(family) : null;
      this.usesByFamilyMap.set(family, callGraph ? new ClassMemberUses(this.codeGraph, callGraph, this.readFileLines) : null);
    }
    return this.usesByFamilyMap.get(family);
  }

  readMemberGroups(abstraction) {
    const uses = this.getOrBuildUses(readLanguageFamily(abstraction.path));
    if (!uses) return null;
    const classUses = uses.readClass(abstraction);
    const constantFields = classUses.fields.map(field => field.name).filter(isUpperSnakeName);
    const grouped = groupMembers({ className: classUses.isAFile ? "" : classUses.name, methods: classUses.methods, constantFields });
    return { abstraction, classUses, ...grouped, selectionReason: this.readSelectionReason(abstraction, classUses, grouped.groups) };
  }

  readSelectionReason(abstraction, classUses, groups) {
    if (groups.length < MIN_MEMBER_GROUPS) return "";
    if (abstraction.changeKind === CHANGE_KINDS.CREATED) return SELECTION_REASONS.CREATED;
    const addedLines = this.addedLinesByPathMap.get(abstraction.path);
    const touched = Boolean(addedLines) && listGroupLines(classUses, groups).some(span => holdsAnAddedLine(addedLines, span.from, span.to));
    return touched ? SELECTION_REASONS.GROUP_CHANGED : "";
  }

  listChangedClasses(abstractions) {
    return abstractions.filter(isAChangedProductionClass).map(abstraction => this.readMemberGroups(abstraction)).filter(Boolean);
  }

  findRelations(abstractions) {
    return this.listChangedClasses(abstractions).filter(read => read.selectionReason).map(read => this.describeRelation(read));
  }

  describeRelation({ abstraction, classUses, sharedFields, groups, selectionReason }) {
    const groupNumberByPositionMap = new Map(groups.flatMap(group => group.methodPositions.map(position => [position, group.number])));
    return {
      abstractionIds: [abstraction.id],
      displayName: abstraction.name,
      name: abstraction.name,
      path: abstraction.path,
      from: classUses.from,
      to: classUses.to,
      changeKind: abstraction.changeKind,
      selectionReason,
      fields: classUses.fields.map(({ name, line, text, typeText }) => ({ name, line, text, typeText })),
      methods: classUses.methods.map((method, position) => describeMethod(classUses, method, groupNumberByPositionMap, position)),
      sharedFields,
      memberGroups: groups.map(group => describeGroup(classUses, group)),
    };
  }
}
