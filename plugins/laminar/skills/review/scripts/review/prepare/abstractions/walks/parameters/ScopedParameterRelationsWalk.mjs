import { CHANGE_KINDS, changesTheBoundary, findDriver, Scale } from "../../../../../code/index.mjs";
import { measureSharedFolderDepth } from "../../../../../files/paths.mjs";
import { FileLines } from "../../lookups/FileLines.mjs";
import { CarrierTypeSearch } from "./CarrierTypeSearch.mjs";
import { FilledTogetherSearch } from "./FilledTogetherSearch.mjs";
import { ParameterReads } from "./ParameterReads.mjs";
import { TwinTypeSearch } from "./TwinTypeSearch.mjs";
import { TypeAbstractions } from "./TypeAbstractions.mjs";

const MIN_OPERATIONS_FOR_A_WIDENED_TYPE = 2;

export const MAX_OPERATIONS_SHOWN = 30;

const compareNearestTo = typePath => (left, right) => measureSharedFolderDepth(right.path, typePath) - measureSharedFolderDepth(left.path, typePath)
  || (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) || left.from - right.from;

const showTheOperationsWithin = (type, room) => ({ ...type, operations: type.operations.slice(0, room), operationsLeftOut: Math.max(0, type.operations.length - room) });

const showTheOperationsOfEveryType = relation => {
  let room = MAX_OPERATIONS_SHOWN;
  const showWithinTheRoom = type => {
    const shown = showTheOperationsWithin(type, room);
    room -= shown.operations.length;
    return shown;
  };
  const shownType = showWithinTheRoom(relation);
  const carriers = relation.carriers.map(showWithinTheRoom);
  const twins = relation.twins.map(showWithinTheRoom);
  return { ...shownType, carriers, twins };
};

const isATouchedType = abstraction => abstraction.scale === Scale.CLASS.name && !abstraction.isTest && changesTheBoundary(abstraction.changeKind)
  && Boolean(abstraction.lines) && Boolean(findDriver(abstraction.path));

const collectAddedMemberNames = abstraction => (abstraction.children || [])
  .filter(child => child.scale === Scale.VARIABLE.name && child.changeKind === CHANGE_KINDS.CREATED)
  .flatMap(child => (child.fields ? child.fields.map(field => field.name) : [child.name]));

const readsNoneOfTheAdded = added => operation => operation.readsKnown && added.every(member => !operation.reads.includes(member));

const isAWidenedTypeOfManyOperations = (abstraction, type) => abstraction.changeKind === CHANGE_KINDS.BOUNDARY_CHANGED
  && type.operations.length >= MIN_OPERATIONS_FOR_A_WIDENED_TYPE;

const isWorthARelation = (abstraction, type, added) => added.length
  && (isAWidenedTypeOfManyOperations(abstraction, type) || type.operations.some(readsNoneOfTheAdded(added)));

export class ScopedParameterRelationsWalk {
  constructor(repositoryText, testCode, change, callGraphOf, references, codeGraph) {
    const fileLines = new FileLines(repositoryText);
    this.typeAbstractions = new TypeAbstractions(codeGraph, fileLines);
    this.reads = new ParameterReads(repositoryText, testCode, callGraphOf, references, this.typeAbstractions);
    this.twinTypeSearch = new TwinTypeSearch(testCode, references, this.typeAbstractions);
    this.carrierTypeSearch = new CarrierTypeSearch(this.reads, this.typeAbstractions);
    this.filledTogetherSearch = new FilledTogetherSearch(repositoryText, testCode, callGraphOf, references, fileLines, this.typeAbstractions);
  }

  addOperations(type) {
    return { ...type, operations: this.reads.findOperations(type).sort(compareNearestTo(type.path)) };
  }

  findTheScopedParameterRelationOf(abstraction) {
    const type = this.addOperations(this.typeAbstractions.readType({ name: abstraction.name, path: abstraction.path, from: abstraction.lines.from, to: abstraction.lines.to }));
    if (!type.members.length) return null;
    const added = collectAddedMemberNames(abstraction).filter(name => type.members.includes(name));
    if (!isWorthARelation(abstraction, type, added)) return null;
    const twins = this.twinTypeSearch.findTwins(type).map(twin => this.addOperations(twin));
    return showTheOperationsOfEveryType({
      abstractionId: abstraction.id,
      displayName: abstraction.displayName,
      ...type,
      added,
      carriers: this.carrierTypeSearch.findCarriers(type, added),
      twins,
      filledTogether: twins.length ? this.filledTogetherSearch.findBlocksFilledTogether(type, twins) : [],
    });
  }

  findRelations(abstractions) {
    return abstractions.filter(isATouchedType).map(abstraction => this.findTheScopedParameterRelationOf(abstraction)).filter(Boolean);
  }
}
