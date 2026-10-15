import { closeTheBlocksEndedAtIndent, measureHeadIndent } from "../SourceText.mjs";
import { findTextAroundTheWord } from "../text/TextAroundAWord.mjs";

export const NO_ENCLOSING_HEAD = -1;

const TEXT_VALUE_HEAD_PATTERN = /^\s*(?:(?:public|private|protected|internal|fileprivate|open|static|final|readonly|const|let|var|val|export|override|lateinit|lazy|volatile|transient|mut|pub(?:\([^)]*\))?)\s+)*(?:[A-Za-z_$][\w$<>[\],?.]*\s+)?\$?([A-Za-z_]\w*)\s*(?::[^=]+)?:?=(?!=)/;

const BRACKETED_GROUP_PATTERN = /\([^()]*\)|<[^<>]*>|\[[^[\]]*\]/g;

function stripBracketedGroups(text) {
  let out = text;
  for (let previous = null; previous !== out;) {
    previous = out;
    out = out.replace(BRACKETED_GROUP_PATTERN, "");
  }
  return out;
}

const readTextBeforeTheName = (text, name) => {
  const around = findTextAroundTheWord(text, name);
  return around ? around.before : "";
};

const isAnItemOfAList = (text, name) => stripBracketedGroups(readTextBeforeTheName(text, name)).includes(",");

const CLASS_SCALE = "CLASS";

export const isATopLevelType = declaration => declaration.scale === CLASS_SCALE && (declaration.enclosingHeadOrder ?? NO_ENCLOSING_HEAD) === NO_ENCLOSING_HEAD;
const VARIABLE_SCALE = "VARIABLE";

const rebaseEnclosingHeadOrder = (enclosingHeadOrder, offset) => (enclosingHeadOrder === NO_ENCLOSING_HEAD ? NO_ENCLOSING_HEAD : enclosingHeadOrder + offset);

function joinHeadsOfAReading(every, headsOfTheReading) {
  const offset = every.length;
  for (const head of headsOfTheReading) every.push({ ...head, order: every.length, enclosingHeadOrder: rebaseEnclosingHeadOrder(head.enclosingHeadOrder, offset) });
}

function readDeclarationHeads(source) {
  const every = [];
  source.readings.forEach((numberedLines, at) => joinHeadsOfAReading(every, findDeclarationHeadsIn(source, numberedLines, source.heads[at], source.opens[at] || [])));
  return every;
}

class EnclosingScopes {
  constructor(open, scopeIsFlat) {
    this.stack = open.map(openHead => ({ ...openHead, at: NO_ENCLOSING_HEAD }));
    this.scopeIsFlat = scopeIsFlat;
  }

  closeThoseEndedBy(scale, indent) {
    if (this.scopeIsFlat) { if (scale === CLASS_SCALE) this.stack.length = 0; }
    else closeTheBlocksEndedAtIndent(this.stack, indent);
  }

  get innermost() {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  open(name, indent, at) {
    this.stack.push({ name, indent, at });
  }
}

const readHeadAt = (source, texts, { line, valueName, wrappedText }) => {
  if (valueName) return { scale: VARIABLE_SCALE, name: valueName, scope: null };
  return wrappedText ? source.driver.readDeclaration(wrappedText) : source.driver.findDeclarationAt(texts, line - 1);
};

const isSkippedDeclaration = (source, text, read) =>
  !read.scale || !read.name || isAnItemOfAList(text, read.name)
  || Boolean(source.driver.isTestCallback && source.driver.isTestCallback(read.name, source.finderContext));

function findDeclarationHeadsIn(source, numberedLines, heads, open) {
  const found = [];
  const scopes = new EnclosingScopes(open, source.driver.scopeIsFlat);
  const texts = numberedLines.map(numberedLine => numberedLine.text);
  for (const headAtALine of addTextValueHeads(source, numberedLines, addHeadsWrappedBeforeTheName(source, texts, heads))) {
    const { line, head, valueName, wrappedText } = headAtALine;
    const numberedLine = numberedLines[line - 1];
    if (!numberedLine) continue;
    if (source.cannotHoldADeclarationHeadAt(texts, line - 1, numberedLine.line)) continue;
    const text = wrappedText || numberedLine.text || head;
    const indent = measureHeadIndent(text);
    const read = readHeadAt(source, texts, headAtALine);
    if (isSkippedDeclaration(source, text, read)) continue;
    scopes.closeThoseEndedBy(read.scale, indent);
    const top = scopes.innermost;
    found.push({
      line: numberedLine.line,
      scale: read.scale,
      name: read.name,
      scope: read.scope || (top ? top.name : null),
      declaredScope: read.scope || null,
      indent,
      text,
      holdsTextValue: Boolean(valueName),
      enclosingHeadOrder: top ? top.at : NO_ENCLOSING_HEAD,
      ...(read.holdsMembersOfTheEnclosingType ? { holdsMembersOfTheEnclosingType: true } : {}),
    });
    if (opensAScope(source, read, indent, numberedLine.line)) scopes.open(read.name, indent, found.length - 1);
  }
  return found;
}

function addHeadsWrappedBeforeTheName(source, texts, heads) {
  const wrapped = source.driver.findHeadsWrappedBeforeTheName(texts);
  if (!wrapped.length) return heads;
  const wrappedLines = new Set(wrapped.map(head => head.line));
  const wrappedHeads = wrapped.map(({ line, text }) => ({ line, head: text.trim(), wrappedText: text }));
  return [...heads.filter(head => !wrappedLines.has(head.line)), ...wrappedHeads].sort((left, right) => left.line - right.line);
}

function addTextValueHeads(source, numberedLines, heads) {
  const headLines = new Set(heads.map(head => head.line));
  const valueHeads = numberedLines
    .map((numberedLine, offset) => ({ line: offset + 1, head: numberedLine.text, opensText: source.textOpeningLines.has(numberedLine.line) }))
    .filter(valueHead => valueHead.opensText && !headLines.has(valueHead.line))
    .map(valueHead => ({ line: valueHead.line, head: valueHead.head, valueName: (TEXT_VALUE_HEAD_PATTERN.exec(valueHead.head) || [])[1] }))
    .filter(valueHead => valueHead.valueName);
  return [...heads, ...valueHeads].sort((left, right) => left.line - right.line);
}

export const isATopLevelVariable = declaration => declaration.scale === VARIABLE_SCALE && declaration.indent === 0;

const holdsAValueOverSeveralLines = (source, line) => source.readValueEndAt(line) > line;

const opensAScope = (source, { scale, holdsMembersOfTheEnclosingType }, indent, line) => !holdsMembersOfTheEnclosingType
  && (scale === CLASS_SCALE || (isATopLevelVariable({ scale, indent }) && holdsAValueOverSeveralLines(source, line)));

export const holdsMembersOfItsOwn = declaration => !declaration.holdsMembersOfTheEnclosingType;

const headsBySourceMap = new WeakMap();

export function listDeclarationHeads(source) {
  const rememberedHeads = headsBySourceMap.get(source);
  if (rememberedHeads && rememberedHeads.heads === source.heads && rememberedHeads.context === source.finderContext) return rememberedHeads.read;
  const read = readDeclarationHeads(source);
  headsBySourceMap.set(source, { heads: source.heads, context: source.finderContext, read });
  return read;
}
