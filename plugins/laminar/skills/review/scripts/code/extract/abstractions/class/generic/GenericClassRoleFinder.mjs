import { BOUNDARY_RANKS, findFolderRoleKindOfRank, ROLE_KINDS } from "../../../../graph/abstractions/Role.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../../../graph/Evidence.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";
import { RoleFinder } from "../../../finders/RoleFinder.mjs";
import { findDeclarationAnnotatedAt, MARK_FORMS, findMarkedCodeLines } from "../../../../inputs/source/declarations/MarkedDeclarations.mjs";
import { isATypeDeclaration, isATypeHoldingTheLine } from "../../../../inputs/source/declarations/TypeHolding.mjs";

const RANK_BY_DIRECTION_NAME_MAP = Object.freeze({
  in: BOUNDARY_RANKS.IN_CODE,
  inbound: BOUNDARY_RANKS.IN_CODE,
  out: BOUNDARY_RANKS.OUT_CODE,
  outbound: BOUNDARY_RANKS.OUT_CODE,
});

const OUTBOUND_SIDE_NAMES = Object.freeze(["adapter", "adapters", "client", "clients"]);

const RANK_BY_FOLDER_NAME_MAP = Object.freeze({
  api: BOUNDARY_RANKS.IN_CODE,
  controller: BOUNDARY_RANKS.IN_CODE,
  controllers: BOUNDARY_RANKS.IN_CODE,
  rest: BOUNDARY_RANKS.IN_CODE,
  web: BOUNDARY_RANKS.IN_CODE,
  resource: BOUNDARY_RANKS.IN_CODE,
  resources: BOUNDARY_RANKS.IN_CODE,
  endpoint: BOUNDARY_RANKS.IN_CODE,
  endpoints: BOUNDARY_RANKS.IN_CODE,
  handler: BOUNDARY_RANKS.IN_CODE,
  handlers: BOUNDARY_RANKS.IN_CODE,
  graphql: BOUNDARY_RANKS.IN_CODE,
  cli: BOUNDARY_RANKS.IN_CODE,
  spi: BOUNDARY_RANKS.MODULE_BOUNDARY,
  domain: BOUNDARY_RANKS.DOMAIN_MODEL,
  model: BOUNDARY_RANKS.DOMAIN_MODEL,
  impl: BOUNDARY_RANKS.API_IMPLEMENTATION,
});

function findDeepestRankNamedIn(segments, rankByNameMap) {
  for (let index = segments.length - 1; index >= 0; index--) {
    const rank = rankByNameMap[segments[index]];
    if (rank) return rank;
  }
  return null;
}

const namesAnOutboundSide = segments => segments.some(segment => OUTBOUND_SIDE_NAMES.includes(segment));

function findRankByFolderConvention(folder) {
  const segments = folder.split("/").filter(Boolean).map(segment => segment.toLowerCase());
  return findDeepestRankNamedIn(segments, RANK_BY_DIRECTION_NAME_MAP)
    || (namesAnOutboundSide(segments) ? BOUNDARY_RANKS.OUT_CODE : null)
    || findDeepestRankNamedIn(segments, RANK_BY_FOLDER_NAME_MAP);
}

const findTypesHolding = (declarations, line, annotated) => declarations
  .filter(declaration => isATypeHoldingTheLine(declaration, line) || (annotated && isATypeHoldingTheLine(declaration, annotated.line)));

const NO_ENCLOSING_TYPE = null;

const findEnclosingTypesOfTheMarkAt = (declarations, lines, line) => {
  const annotated = findDeclarationAnnotatedAt(declarations, lines, line);
  return [...(annotated ? [annotated] : []), ...findTypesHolding(declarations, line, annotated), NO_ENCLOSING_TYPE];
};

export class GenericClassRoleFinder extends RoleFinder {
  constructor() {
    super(Scale.CLASS);
    this.entryBoundaryMarks = null;
    this.typeMapping = null;
    this.applicationMark = null;
  }

  findRoles(file) {
    return [...this.findEntryBoundaryRolesIn(file), ...this.findApplicationStartsIn(file)];
  }

  findEntryBoundaryRolesIn({ declarations, lines }) {
    if (!this.entryBoundaryMarks) return [];
    return findMarkedCodeLines(lines, this.entryBoundaryMarks).flatMap(marked => {
      const role = { kind: ROLE_KINDS.ENTRY_BOUNDARY, form: MARK_FORMS.ANNOTATION, line: marked.line, evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: this.name, detail: `${marked.text} at line ${marked.line}` }) };
      return findEnclosingTypesOfTheMarkAt(declarations, lines, marked.line).map(of => ({ ...role, of }));
    });
  }

  findApplicationStartsIn({ declarations, lines }) {
    if (!this.applicationMark) return [];
    return findMarkedCodeLines(lines, this.applicationMark).flatMap(marked => {
      const annotated = findDeclarationAnnotatedAt(declarations, lines, marked.line);
      if (!annotated || !isATypeDeclaration(annotated)) return [];
      return [{ kind: ROLE_KINDS.APPLICATION_START, form: MARK_FORMS.ANNOTATION, of: annotated, line: marked.line, evidence: new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: this.name, detail: `${marked.text} at line ${marked.line}` }) }];
    });
  }

  findFolderRoleKind(folder) {
    return findFolderRoleKindOfRank(findRankByFolderConvention(folder));
  }
}
