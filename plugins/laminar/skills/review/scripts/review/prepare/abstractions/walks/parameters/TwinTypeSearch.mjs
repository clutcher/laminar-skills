import { readLanguageFamily } from "../../../../../code/index.mjs";

const MIN_SHARED_MEMBERS = 2;

const haveSameNames = (left, right) => left.length === right.length && left.every(name => right.includes(name));

export class TwinTypeSearch {
  constructor(testCode, references, typeAbstractions) {
    this.testCode = testCode;
    this.references = references;
    this.typeAbstractions = typeAbstractions;
  }

  findProductionPathsNamingEveryMember(members, family) {
    let paths = null;
    for (const member of members) {
      const namingPaths = this.references.collectProductionPathsNaming(member, family, this.testCode);
      paths = paths ? new Set([...paths].filter(filePath => namingPaths.has(filePath))) : namingPaths;
    }
    return [...(paths || [])];
  }

  findTwins(type) {
    if (type.members.length < MIN_SHARED_MEMBERS) return [];
    return this.findProductionPathsNamingEveryMember(type.members, readLanguageFamily(type.path))
      .flatMap(filePath => this.typeAbstractions.listTypesDeclaredInTheFile(filePath))
      .filter(other => !(other.path === type.path && other.from === type.from))
      .map(other => this.typeAbstractions.readType(other))
      .filter(other => haveSameNames(other.members, type.members));
  }
}
