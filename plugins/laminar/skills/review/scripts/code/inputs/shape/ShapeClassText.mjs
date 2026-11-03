import { PUBLIC_METHOD_VISIBILITY } from "./ShapeModel.mjs";

const MEMBER_INDENT = "    ";

const formatTypedName = typed => (typed.type ? `${typed.name}: ${typed.type}` : typed.name);

const formatSupertypes = (word, names) => (names.length ? ` ${word} ${names.join(", ")}` : "");

const formatClassHead = shapeClass => `${shapeClass.kindWord} ${shapeClass.name}${formatSupertypes("extends", shapeClass.extends)}${formatSupertypes("implements", shapeClass.implements)} {`;

const formatVisibilityWord = method => (method.visibility === PUBLIC_METHOD_VISIBILITY ? "" : `${method.visibility} `);

const formatSignature = method => `${formatVisibilityWord(method)}${method.name}(${method.parameters.map(formatTypedName).join(", ")})${method.returns ? `: ${method.returns}` : ""}`;

const readIndentation = text => text.length - text.trimStart().length;

function removeTheSharedIndentation(lines) {
  const indents = lines.filter(line => line.trim()).map(readIndentation);
  const shared = indents.length ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(Math.min(shared, readIndentation(line))));
}

const indentEachLine = (lines, indent) => lines.map(line => (line.trim() ? `${indent}${line}` : ""));

const holdsItsOwnHead = (bodyLines, method) => (bodyLines[0] || "").includes(`${method.name}(`);

function formatMethodLines(method) {
  if (!method.body) return [`${MEMBER_INDENT}${formatSignature(method)}`];
  const bodyLines = removeTheSharedIndentation(method.body.split(/\r?\n/));
  if (holdsItsOwnHead(bodyLines, method)) return indentEachLine(bodyLines, MEMBER_INDENT);
  return [`${MEMBER_INDENT}${formatSignature(method)} {`, ...indentEachLine(bodyLines, MEMBER_INDENT + MEMBER_INDENT), `${MEMBER_INDENT}}`];
}

function formatClassLines(shapeClass, firstLine) {
  const lines = [formatClassHead(shapeClass), ...shapeClass.fields.map(field => `${MEMBER_INDENT}${formatTypedName(field)}`)];
  const methods = [];
  for (const method of shapeClass.methods) {
    if (lines.length > 1) lines.push("");
    const methodLines = formatMethodLines(method);
    methods.push({ method, lines: { from: firstLine + lines.length, to: firstLine + lines.length + methodLines.length - 1 } });
    lines.push(...methodLines);
  }
  lines.push("}");
  return { lines, placement: { shapeClass, lines: { from: firstLine, to: firstLine + lines.length - 1 }, methods } };
}

export function formatTheClassesOfTheFile(shapeClasses) {
  const lines = [];
  const placements = [];
  for (const shapeClass of shapeClasses) {
    if (lines.length) lines.push("");
    const formatted = formatClassLines(shapeClass, lines.length + 1);
    lines.push(...formatted.lines);
    placements.push(formatted.placement);
  }
  return { lines, placements };
}
