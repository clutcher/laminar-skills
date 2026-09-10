import { countBraces, readCodeOfLine, measureHeadIndent } from "../../../../../inputs/source/SourceText.mjs";
import { findHeadsEnclosedBy, readEnclosingHeadOrder } from "../../../../finders/AbstractionFinder.mjs";
import { Scale } from "../../../../../graph/abstractions/Scale.mjs";
import { listDeclarationHeads } from "../../../../../inputs/source/declarations/SourceHeads.mjs";
import { ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE } from "../../../../../inputs/source/text/PatternText.mjs";

const MEMBER_DEPTH_OF_A_TYPE = 1;

const FILE_DEPTH = 0;

const ASSIGNED_VALUE_PATTERN = new RegExp(`[^=!<>]${ASSIGNING_EQUALS_SIGN_PATTERN_SOURCE}`);

const fieldsBySourceMap = new WeakMap();

function findLinesAtDepth(source, from, to, depth) {
  const found = [];
  let at = FILE_DEPTH;
  for (let line = from; line <= to; line++) {
    const text = String(source.lines[line - 1] ?? "");
    if (at === depth && !(depth > FILE_DEPTH && line === from)) found.push({ line, text });
    const braces = countBraces(text);
    at += braces.opened - braces.closed;
  }
  return found;
}

const readSpanOfTheEnclosingHead = (parent, source) => (parent
  ? { from: parent.line, to: source.blockEndAt(parent.line) || source.lastLine, depth: MEMBER_DEPTH_OF_A_TYPE }
  : { from: 1, to: source.lastLine, depth: FILE_DEPTH });

function getOrAddFieldsOfTheSource(source) {
  if (!fieldsBySourceMap.has(source)) fieldsBySourceMap.set(source, { fieldsByEnclosingHeadMap: new Map(), nextOrder: listDeclarationHeads(source).length });
  return fieldsBySourceMap.get(source);
}

function findLinesAtTheEnclosingDepthHoldingNoHead(parent, source) {
  const span = readSpanOfTheEnclosingHead(parent, source);
  const headLines = new Set(listDeclarationHeads(source).map(head => head.line));
  return findLinesAtDepth(source, span.from, span.to, span.depth).filter(({ line }) => !headLines.has(line));
}

function readFieldsIn(parent, source, fieldNameOf) {
  return findLinesAtTheEnclosingDepthHoldingNoHead(parent, source)
    .map(({ line, text }) => ({ line, text, name: fieldNameOf(text) }))
    .filter(field => field.name)
    .map(field => ({
      line: field.line,
      scale: Scale.VARIABLE.name,
      name: field.name,
      scope: parent ? parent.name : null,
      declaredScope: null,
      indent: measureHeadIndent(field.text),
      text: field.text,
      holdsTextValue: false,
      readAsAField: true,
      holdsAValue: ASSIGNED_VALUE_PATTERN.test(readCodeOfLine(field.text)),
      enclosingHeadOrder: readEnclosingHeadOrder(parent),
    }));
}

const takeNextOrdersFor = (fields, fieldsOfTheSource) => fields.map(field => ({ ...field, order: fieldsOfTheSource.nextOrder++ }));

function getOrReadTheFieldsOfTheEnclosingHead(parent, source, readFields) {
  const fieldsOfTheSource = getOrAddFieldsOfTheSource(source);
  const enclosingHeadOrder = readEnclosingHeadOrder(parent);
  if (!fieldsOfTheSource.fieldsByEnclosingHeadMap.has(enclosingHeadOrder)) fieldsOfTheSource.fieldsByEnclosingHeadMap.set(enclosingHeadOrder, takeNextOrdersFor(readFields(), fieldsOfTheSource));
  return fieldsOfTheSource.fieldsByEnclosingHeadMap.get(enclosingHeadOrder);
}

function findFieldsIn(parent, source, fieldNameOf) {
  if (!source.lines || (parent && parent.scale !== Scale.CLASS.name)) return [];
  return getOrReadTheFieldsOfTheEnclosingHead(parent, source, () => readFieldsIn(parent, source, fieldNameOf));
}

export const readFieldHeadsIn = (parent, source, fieldNameOf) => [...findHeadsEnclosedBy(parent, source, Scale.VARIABLE.name), ...findFieldsIn(parent, source, fieldNameOf)];
