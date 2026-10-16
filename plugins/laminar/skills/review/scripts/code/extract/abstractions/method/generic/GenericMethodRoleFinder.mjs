import { joinRoute } from "./routes/Route.mjs";
import { Evidence, EVIDENCE_KINDS } from "../../../../graph/Evidence.mjs";
import { ROLE_KINDS } from "../../../../graph/abstractions/Role.mjs";
import { Scale } from "../../../../graph/abstractions/Scale.mjs";

import { findAnnotationLinesAbove } from "../../../../inputs/source/lines/Annotations.mjs";
import { readFirstLiteral, findTextLiterals } from "../../../../inputs/source/text/TextLiterals.mjs";
import { RoleFinder } from "../../../finders/RoleFinder.mjs";
import { MARK_FORMS } from "../../../../inputs/source/declarations/MarkedDeclarations.mjs";
import { findTypeHolding } from "../../../../inputs/source/declarations/TypeHolding.mjs";
import { NO_OUTBOUND_IO } from "./outside/OutboundIo.mjs";
import { NO_TEST_CODE_MARKS } from "./testing/TestCodeMarks.mjs";
import { findClosingParenthesis, ONLY_PARENTHESES } from "../../../../inputs/source/text/Brackets.mjs";
import { escapeForAPattern } from "../../../../inputs/source/text/PatternText.mjs";
import { splitIntoTopLevelPieces } from "../../../../inputs/source/text/TopLevelText.mjs";

const citeMarkedLine = (lines, at) => `${String(lines[at - 1]).trim()} at line ${at}`;

const isAMethod = declaration => declaration.scale === Scale.METHOD.name;

const MAX_HEAD_LINES = 12;

const NO_PARAMETERS = Object.freeze([]);

const readParameterPieces = (lines, method) => {
  const headText = lines.slice(method.line - 1, method.line - 1 + MAX_HEAD_LINES).map(line => String(line ?? "")).join(" ");
  const nameAt = headText.search(new RegExp(`(?<![\\w$])${escapeForAPattern(method.name)}\\s*\\(`));
  const opening = nameAt < 0 ? -1 : headText.indexOf("(", nameAt);
  const closing = opening < 0 ? -1 : findClosingParenthesis(headText, opening, ONLY_PARENTHESES);
  return closing < 0 ? NO_PARAMETERS : splitIntoTopLevelPieces(headText.slice(opening + 1, closing));
};

export class GenericMethodRoleFinder extends RoleFinder {
  constructor() {
    super(Scale.METHOD);
    this.methodMapping = null;
    this.bareVerb = null;
    this.schemaMapping = null;
    this.schemaArgument = null;
    this.outboundIo = NO_OUTBOUND_IO;
    this.testCodeMarks = NO_TEST_CODE_MARKS;
  }

  findRoles(file) {
    return file.declarations.filter(isAMethod).flatMap(method => [...this.findRouteRoles(method, file), ...this.findSchemaMappingRoles(method, file)]);
  }

  findRouteRoles(method, file) {
    const mapping = this.findMethodMapping(file.lines, method.line, file.readTypeRoute(findTypeHolding(file.declarations, method.line)));
    if (!mapping) return [];
    const evidence = new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: GenericMethodRoleFinder.name, detail: citeMarkedLine(file.lines, mapping.line) });
    return [{ kind: ROLE_KINDS.ENTRY_BOUNDARY, form: MARK_FORMS.ROUTE, of: method, line: mapping.line, detail: `${mapping.verb} ${mapping.route}`.trim(), evidence, facts: { mapping } }];
  }

  findSchemaMappingRoles(method, file) {
    const schemaMapping = this.findSchemaMapping(file.lines, method);
    if (!schemaMapping) return [];
    const evidence = new Evidence({ kind: EVIDENCE_KINDS.DECLARED, foundBy: GenericMethodRoleFinder.name, detail: citeMarkedLine(file.lines, schemaMapping.line) });
    return [{ kind: ROLE_KINDS.ENTRY_BOUNDARY, form: MARK_FORMS.SCHEMA_MAPPING, of: method, line: schemaMapping.line, evidence, facts: { schemaMapping } }];
  }

  findMethodMapping(lines, headLine, typeRoute) {
    if (!this.methodMapping) return null;
    const annotations = findAnnotationLinesAbove(lines, headLine);
    const mapping = annotations.find(annotation => this.methodMapping.test(annotation.text));
    if (!mapping) return null;
    const bareVerb = this.bareVerb ? annotations.map(annotation => (this.bareVerb.exec(annotation.text) || [])[1]).find(Boolean) || "" : "";
    return {
      line: mapping.line,
      from: annotations[0].line,
      verb: this.readVerb(mapping.text) || bareVerb,
      route: joinRoute(typeRoute, readFirstLiteral(mapping.text)),
    };
  }

  readVerb() {
    return "";
  }

  findSchemaMapping(lines, method) {
    if (!this.schemaMapping) return null;
    const mapping = findAnnotationLinesAbove(lines, method.line).find(annotationLine => this.schemaMapping.test(annotationLine.text));
    return mapping ? { line: mapping.line, names: findTextLiterals(mapping.text).map(literal => literal.text), arguments: this.findSchemaArguments(lines, method) } : null;
  }

  findSchemaArguments(lines, method) {
    if (!this.schemaArgument) return NO_PARAMETERS;
    return readParameterPieces(lines, method)
      .map(parameterText => ({ parameterText, mark: this.schemaArgument.exec(parameterText) }))
      .filter(({ mark }) => mark)
      .map(({ parameterText, mark }) => ({ name: mark[1] || "", parameterText }));
  }
}
