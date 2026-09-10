import { CHANGE_KINDS, changesTheBoundary, findDriver, Scale } from "../../../../../code/index.mjs";
import { FileLines } from "../../lookups/FileLines.mjs";
import { CarrierTypeSearch } from "./CarrierTypeSearch.mjs";
import { FilledTogetherSearch } from "./FilledTogetherSearch.mjs";
import { ParameterReads } from "./ParameterReads.mjs";
import { TwinTypeSearch } from "./TwinTypeSearch.mjs";
import { TypeAbstractions } from "./TypeAbstractions.mjs";

const MIN_OPERATIONS_FOR_A_WIDENED_TYPE = 2;

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
    this.reads = new ParameterReads(repositoryText, testCode, callGraphOf, references);
    this.typeAbstractions = new TypeAbstractions(codeGraph, fileLines);
    this.twinTypeSearch = new TwinTypeSearch(testCode, references, this.typeAbstractions);
    this.carrierTypeSearch = new CarrierTypeSearch(this.reads, this.typeAbstractions);
    this.filledTogetherSearch = new FilledTogetherSearch(repositoryText, testCode, callGraphOf, references, fileLines);
  }

  addOperations(type) {
    return { ...type, operations: this.reads.findOperations(type.name, type.members) };
  }

  findTheScopedParameterRelationOf(abstraction) {
    const type = this.addOperations(this.typeAbstractions.readType({ name: abstraction.name, path: abstraction.path, from: abstraction.lines.from, to: abstraction.lines.to }));
    if (!type.members.length) return null;
    const added = collectAddedMemberNames(abstraction).filter(name => type.members.includes(name));
    if (!isWorthARelation(abstraction, type, added)) return null;
    const twins = this.twinTypeSearch.findTwins(type).map(twin => this.addOperations(twin));
    return {
      abstractionId: abstraction.id,
      displayName: abstraction.displayName,
      ...type,
      added,
      carriers: this.carrierTypeSearch.findCarriers(type, added),
      twins,
      filledTogether: twins.length ? this.filledTogetherSearch.findBlocksFilledTogether(type, twins) : [],
    };
  }

  findRelations(abstractions) {
    return abstractions.filter(isATouchedType).map(abstraction => this.findTheScopedParameterRelationOf(abstraction)).filter(Boolean);
  }
}
