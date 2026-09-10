import { isACodeLineCarryingAMark } from "../lines/LineKinds.mjs";
import { LINE_BEFORE_A_DECLARATION_PATTERN } from "./DeclarationSpans.mjs";

export const MARK_FORMS = Object.freeze({ ANNOTATION: "annotation", ROUTE: "route", SCHEMA_MAPPING: "schema mapping" });

export const findMarkedCodeLines = (lines, mark) => lines.flatMap((text, index) => (isACodeLineCarryingAMark(text, [mark]) ? [{ line: index + 1, text: text.trim() }] : []));

export function findDeclarationAnnotatedAt(declarations, lines, line) {
  const below = declarations.filter(declaration => declaration.line >= line).sort((left, right) => left.line - right.line)[0];
  if (!below) return null;
  for (let between = line + 1; between < below.line; between++) {
    if (!LINE_BEFORE_A_DECLARATION_PATTERN.test(lines[between - 1] ?? "")) return null;
  }
  return below;
}
