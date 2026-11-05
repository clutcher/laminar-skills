import { buildWholeWordPattern, CHANGE_KINDS, isADeclaredType, isTestPath, readLanguageFamily, readMemberNames, Scale } from "../../../../../code/index.mjs";
import { readFolderPath } from "../../../../../files/paths.mjs";
import { formatNamePattern, listNameKeys, readNameWords, readVariantWord, shareAStem } from "./VariantNames.mjs";

export const LEAST_SHARED_MEMBERS = 2;

export const LEAST_SHARED_SHARE_OF_THE_SMALLER = 0.5;

export const MAX_SHOWN_TYPE_LINES = 30;

export const MAX_LINES_NAMING_THE_TYPES_TOGETHER = 5;

export const UNCHANGED = "UNCHANGED";

const LEAST_TYPES_NAMED_TOGETHER = 2;

const CHANGE_KINDS_OF_A_CHANGED_TYPE = new Set([CHANGE_KINDS.CREATED, CHANGE_KINDS.BOUNDARY_CHANGED]);

const isAChangedProductionType = abstraction => abstraction.scale === Scale.CLASS.name && !abstraction.isTest && !isTestPath(abstraction.path)
  && Boolean(abstraction.lines) && CHANGE_KINDS_OF_A_CHANGED_TYPE.has(abstraction.changeKind);

const isAProductionTypeInSource = type => isADeclaredType(type) && Boolean(type.place) && type.place.hasASourceLine && !isTestPath(type.place.file);

const buildPlaceKey = (filePath, line) => `${filePath}:${line}`;

const readScope = filePath => `${readLanguageFamily(filePath)}|${readFolderPath(filePath)}`;

const readVariantTypeOf = type => ({
  type,
  name: type.name,
  path: type.place.file,
  from: type.place.startLine,
  to: type.place.endLine,
  scope: readScope(type.place.file),
  words: readNameWords(type.name),
  members: type.members || [],
  memberNames: [...new Set(readMemberNames(type.members || []))],
});

export const shareTheirMembers = (left, right) => {
  const shared = left.memberNames.filter(name => right.memberNames.includes(name));
  const smallerCount = Math.min(left.memberNames.length, right.memberNames.length);
  return shared.length >= LEAST_SHARED_MEMBERS && smallerCount > 0 && shared.length / smallerCount >= LEAST_SHARED_SHARE_OF_THE_SMALLER;
};

const isAVariantOf = (changed, other, nameKey) => other === changed
  || (shareTheirMembers(changed, other) && !shareAStem(readVariantWord(changed.words, nameKey), readVariantWord(other.words, nameKey)));

const compareByPlace = (left, right) => left.path.localeCompare(right.path) || left.from - right.from;

export class VariantTypesWalk {
  constructor(repositoryText, codeGraph) {
    this.readFileLines = filePath => repositoryText.readFileLines(filePath) || [];
    this.variantTypes = codeGraph.listAbstractionsAt(Scale.CLASS).filter(isAProductionTypeInSource).map(readVariantTypeOf);
    this.variantTypesByPlaceMap = new Map(this.variantTypes.map(variantType => [buildPlaceKey(variantType.path, variantType.from), variantType]));
    this.variantTypesByScopedKeyMap = this.groupByScopedNameKey(this.variantTypes);
  }

  groupByScopedNameKey(variantTypes) {
    const variantTypesByScopedKeyMap = new Map();
    for (const variantType of variantTypes) {
      for (const nameKey of listNameKeys(variantType.words)) {
        const scopedKey = `${variantType.scope}|${nameKey}`;
        variantTypesByScopedKeyMap.set(scopedKey, [...(variantTypesByScopedKeyMap.get(scopedKey) || []), variantType]);
      }
    }
    return variantTypesByScopedKeyMap;
  }

  findRelations(abstractions) {
    const relationsByScopedKeyMap = new Map();
    for (const abstraction of abstractions.filter(isAChangedProductionType)) {
      const changed = this.variantTypesByPlaceMap.get(buildPlaceKey(abstraction.path, abstraction.lines.from));
      if (changed) this.addTheRelationsOf(changed, abstraction, relationsByScopedKeyMap);
    }
    return [...relationsByScopedKeyMap.values()].map(relation => this.describeRelation(relation));
  }

  addTheRelationsOf(changed, abstraction, relationsByScopedKeyMap) {
    for (const nameKey of listNameKeys(changed.words)) {
      const scopedKey = `${changed.scope}|${nameKey}`;
      const variants = (this.variantTypesByScopedKeyMap.get(scopedKey) || []).filter(other => isAVariantOf(changed, other, nameKey));
      if (variants.length < 2) continue;
      const relation = relationsByScopedKeyMap.get(scopedKey) || { nameKey, variants: new Set(), changedAbstractionsByTypeMap: new Map() };
      for (const variant of variants) relation.variants.add(variant);
      relation.changedAbstractionsByTypeMap.set(changed, abstraction);
      relationsByScopedKeyMap.set(scopedKey, relation);
    }
  }

  readTypeLines(variantType) {
    const to = Math.min(variantType.to, variantType.from + MAX_SHOWN_TYPE_LINES - 1);
    return this.readFileLines(variantType.path).slice(variantType.from - 1, to).map((text, at) => ({ line: variantType.from + at, text }));
  }

  describeVariantType(variantType, nameKey, changedAbstraction) {
    return {
      name: variantType.name,
      displayName: changedAbstraction ? changedAbstraction.displayName || changedAbstraction.name : variantType.name,
      path: variantType.path,
      from: variantType.from,
      to: variantType.to,
      changeKind: changedAbstraction ? changedAbstraction.changeKind : UNCHANGED,
      variantWord: readVariantWord(variantType.words, nameKey),
      members: variantType.members.map(member => ({ name: member.name, line: member.line })),
      lines: this.readTypeLines(variantType),
    };
  }

  describeRelation({ nameKey, variants, changedAbstractionsByTypeMap }) {
    const changedFirst = [...variants].sort((left, right) => Number(changedAbstractionsByTypeMap.has(right)) - Number(changedAbstractionsByTypeMap.has(left)) || compareByPlace(left, right));
    const types = changedFirst.map(variant => this.describeVariantType(variant, nameKey, changedAbstractionsByTypeMap.get(variant)));
    const lead = types[0];
    return {
      abstractionIds: [...changedAbstractionsByTypeMap.values()].map(abstraction => abstraction.id),
      displayName: lead.displayName,
      name: lead.name,
      path: lead.path,
      from: lead.from,
      to: lead.to,
      changeKind: lead.changeKind,
      namePattern: formatNamePattern(nameKey),
      types,
      namedTogether: this.findLinesNamingTheTypesTogether(changedFirst),
    };
  }

  findLinesNamingTheTypesTogether(variants) {
    const namePatterns = variants.map(variant => buildWholeWordPattern(variant.name));
    const isInsideAType = (filePath, line) => variants.some(variant => variant.path === filePath && line >= variant.from && line <= variant.to);
    const namesTheTypesTogether = text => namePatterns.filter(pattern => pattern.test(text)).length >= LEAST_TYPES_NAMED_TOGETHER;
    return [...new Set(variants.map(variant => variant.path))]
      .flatMap(filePath => this.readFileLines(filePath).map((text, at) => ({ path: filePath, line: at + 1, text })))
      .filter(place => !isInsideAType(place.path, place.line) && namesTheTypesTogether(place.text))
      .slice(0, MAX_LINES_NAMING_THE_TYPES_TOGETHER);
  }
}
