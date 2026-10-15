import { OCCURRENCE_KINDS } from "./SameDecisionWalk.mjs";
import { CHANGE_KINDS, isADeclaredType, isPlacedInSource, readLanguageFamily, readMemberNames, Scale, collectStems } from "../../../../../code/index.mjs";

export const LEAST_SHARED_MEMBERS = 3;

export const LEAST_SHARED_SHARE = 0.75;

const MAX_SHOWN_MEMBER_LINES = 8;

const CHANGE_KINDS_OF_A_CHANGED_TYPE = new Set([CHANGE_KINDS.CREATED, CHANGE_KINDS.BOUNDARY_CHANGED]);

const hasItsLines = abstraction => Boolean(abstraction.lines);

const isAProductionTypeOfTheChange = abstraction => hasItsLines(abstraction)
  && abstraction.scale === Scale.CLASS.name && !abstraction.isTest && CHANGE_KINDS_OF_A_CHANGED_TYPE.has(abstraction.changeKind);

export const compareTheMemberNames = (left, right) => {
  const sharedNames = left.filter(name => right.includes(name));
  const largerMemberCount = Math.max(left.length, right.length);
  return { sharedNames, shareOfTheLarger: largerMemberCount ? sharedNames.length / largerMemberCount : 0 };
};

const ROLE_STEMS = new Set(["input", "output", "request", "respons", "entity", "record", "dto", "model", "data", "view", "row", "document",
  "tabl", "item", "typ", "info", "detail", "payload", "command", "query", "event", "jpa", "sql", "orm", "schema", "form", "resourc", "json", "stor", "persist"].flatMap(word => collectStems(word).concat(word)));

const readBusinessStems = name => collectStems(name).filter(stem => !ROLE_STEMS.has(stem));

export const standForTheSameThing = (leftName, rightName) => {
  const rightBusinessStems = new Set(readBusinessStems(rightName));
  return readBusinessStems(leftName).some(stem => rightBusinessStems.has(stem));
};

export const areNearTwins = (left, right) => {
  const { sharedNames, shareOfTheLarger } = compareTheMemberNames(left, right);
  return sharedNames.length >= LEAST_SHARED_MEMBERS && shareOfTheLarger >= LEAST_SHARED_SHARE;
};

const isTheLeadOf = (one, other) => one.members.length > other.members.length
  || (one.members.length === other.members.length && `${one.abstraction.path}:${one.abstraction.lines.from}` < `${other.abstraction.path}:${other.abstraction.lines.from}`);

const leadsANearTwinPair = (one, other) => one !== other
  && readLanguageFamily(one.abstraction.path) === readLanguageFamily(other.abstraction.path)
  && isTheLeadOf(one, other)
  && areNearTwins(one.members, other.members)
  && standForTheSameThing(one.type.name, other.type.name);

const NO_EVIDENCE = Object.freeze({ readTheEvidenceOfThePair: () => ({}) });

const isADeclaredTypeInSource = type => isADeclaredType(type) && isPlacedInSource(type);

const buildTypesByPlace = codeGraph => new Map(codeGraph.listAbstractionsAt(Scale.CLASS)
  .filter(isADeclaredTypeInSource)
  .map(type => [`${type.place.file}:${type.place.startLine}`, type]));

export class NearTwinTypeSearch {
  constructor(codeGraph, linesOf, evidence = NO_EVIDENCE) {
    this.readFileLines = filePath => linesOf(filePath) || [];
    this.typesByPlaceMap = buildTypesByPlace(codeGraph);
    this.evidence = evidence;
  }

  findTypeOfTheAbstraction(abstraction) {
    const type = this.typesByPlaceMap.get(`${abstraction.path}:${abstraction.lines.from}`);
    return type ? { abstraction, type, members: [...new Set(readMemberNames(type.members))] } : null;
  }

  readThePlaceAt(path, line) {
    return { path, line, text: String(this.readFileLines(path)[line - 1] ?? "").trim() };
  }

  readTheSharedMemberPlaces(twin, sharedNames) {
    const sharedMemberLineNumbers = twin.type.members.filter(member => sharedNames.includes(member.name)).map(member => member.line).filter(Boolean);
    return [...new Set([twin.type.place.startLine, ...sharedMemberLineNumbers])]
      .slice(0, MAX_SHOWN_MEMBER_LINES + 1)
      .map(line => this.readThePlaceAt(twin.type.place.file, line));
  }

  createTheTwinOccurrence(lead, twin) {
    const { sharedNames } = compareTheMemberNames(lead.members, twin.members);
    return {
      key: twin.type.name,
      kind: OCCURRENCE_KINDS.TWIN_MEMBERS,
      shared: sharedNames.length,
      members: twin.members.length,
      places: this.readTheSharedMemberPlaces(twin, sharedNames),
      ...this.evidence.readTheEvidenceOfThePair(lead, twin),
    };
  }

  collectOccurrencesByAbstraction(abstractions) {
    const changedTypes = abstractions.filter(isAProductionTypeOfTheChange).map(abstraction => this.findTypeOfTheAbstraction(abstraction)).filter(Boolean);
    const occurrencesByAbstractionMap = new Map();
    for (const one of changedTypes) {
      for (const other of changedTypes) {
        if (leadsANearTwinPair(one, other)) occurrencesByAbstractionMap.set(one.abstraction, [...(occurrencesByAbstractionMap.get(one.abstraction) || []), this.createTheTwinOccurrence(one, other)]);
      }
    }
    return occurrencesByAbstractionMap;
  }
}
