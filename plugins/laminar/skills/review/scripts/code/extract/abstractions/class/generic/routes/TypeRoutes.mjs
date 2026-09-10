import { findAnnotationLinesAbove } from "../../../../../inputs/source/lines/Annotations.mjs";
import { readFirstLiteral } from "../../../../../inputs/source/text/TextLiterals.mjs";

export function findTypeRouteAbove(classRoleFinder, lines, typeLine) {
  if (!classRoleFinder.typeMapping) return null;
  const mapping = findAnnotationLinesAbove(lines, typeLine).find(annotationLine => classRoleFinder.typeMapping.test(annotationLine.text));
  return mapping ? { line: mapping.line, route: readFirstLiteral(mapping.text) } : null;
}
