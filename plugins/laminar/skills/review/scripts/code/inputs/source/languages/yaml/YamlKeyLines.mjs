import { formatIndexSegment, splitKeyPath } from "../../keys/KeyPaths.mjs";

const DOCUMENT_MARK_PATTERN = /^(?:---|\.\.\.)(?:\s|$)/;
const DIRECTIVE_PATTERN = /^%/;
const DASH_PATTERN = /^-(?:\s+|$)/;
const BLOCK_SCALAR_PATTERN = /^[|>][-+0-9]*$/;
const ANCHORS_AND_TAGS_PATTERN = /^(?:[&!]\S*\s*)+/;
const COLON_OF_A_PLAIN_KEY_PATTERN = /:(?:\s+|$)/;
const COLON_OF_A_QUOTED_KEY_PATTERN = /^\s*:\s*/;
const LEADING_SPACES_PATTERN = /^ */;
const MERGE_KEY = "<<";
const PLAIN_KEY_INDICATORS = new Set(["[", "]", "{", "}", ",", "#", "&", "*", "!", "|", ">", "%", "@", "`", "?", "-"]);
const QUOTES = new Set(["\"", "'"]);
const OPENERS = new Set(["{", "["]);
const CLOSERS = new Set(["}", "]"]);
const TOKEN_STARTS_BEFORE_A_QUOTE = new Set([" ", "\t", ":", ",", "[", "{"]);

const measureIndent = text => LEADING_SPACES_PATTERN.exec(text)[0].length;

const startsAQuoteAt = (text, at) => QUOTES.has(text[at]) && (at === 0 || TOKEN_STARTS_BEFORE_A_QUOTE.has(text[at - 1]));

function findQuoteEnd(text, at) {
  const quote = text[at];
  for (let index = at + 1; index < text.length; index++) {
    if (quote === "\"" && text[index] === "\\") { index++; continue; }
    if (quote === "'" && text[index] === "'" && text[index + 1] === "'") { index++; continue; }
    if (text[index] === quote) return index;
  }
  return text.length;
}

function stripComment(text) {
  for (let at = 0; at < text.length; at++) {
    if (startsAQuoteAt(text, at)) { at = findQuoteEnd(text, at); continue; }
    if (text[at] === "#" && (at === 0 || /\s/.test(text[at - 1]))) return text.slice(0, at);
  }
  return text;
}

function measureFlowDepth(text) {
  let depth = 0;
  for (let at = 0; at < text.length; at++) {
    if (startsAQuoteAt(text, at)) { at = findQuoteEnd(text, at); continue; }
    if (OPENERS.has(text[at])) depth++;
    if (CLOSERS.has(text[at])) depth--;
  }
  return depth;
}

function splitAtTopLevelCommas(text) {
  const pieces = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < text.length; at++) {
    if (startsAQuoteAt(text, at)) { at = findQuoteEnd(text, at); continue; }
    if (OPENERS.has(text[at])) depth++;
    if (CLOSERS.has(text[at])) depth--;
    if (text[at] === "," && depth === 0) { pieces.push(text.slice(start, at)); start = at + 1; }
  }
  pieces.push(text.slice(start));
  return pieces.map(piece => piece.trim()).filter(Boolean);
}

function splitKeyAndValue(content) {
  if (QUOTES.has(content[0])) {
    const end = findQuoteEnd(content, 0);
    const afterTheKey = content.slice(end + 1);
    const colon = COLON_OF_A_QUOTED_KEY_PATTERN.exec(afterTheKey);
    if (end >= content.length || !colon) return null;
    return { keyText: content.slice(1, end), quoted: true, value: afterTheKey.slice(colon[0].length).trim() };
  }
  if (PLAIN_KEY_INDICATORS.has(content[0])) return null;
  const colon = COLON_OF_A_PLAIN_KEY_PATTERN.exec(content);
  if (!colon) return null;
  return { keyText: content.slice(0, colon.index).trim(), quoted: false, value: content.slice(colon.index + colon[0].length).trim() };
}

const readKeySegments = pair => (pair.quoted ? [pair.keyText] : splitKeyPath(pair.keyText));

const stripAnchorsAndTags = value => value.replace(ANCHORS_AND_TAGS_PATTERN, "").trim();

const createKeyLine = (segments, line, value = "") => ({ segments, line, value, valueLines: [] });

function readFlowMapKeyLines(text, prefix, line) {
  const inner = text.trim().replace(/^\{/, "").replace(/\}$/, "");
  return splitAtTopLevelCommas(inner).flatMap(piece => {
    const pair = splitKeyAndValue(piece);
    if (!pair || !pair.keyText) return [];
    const segments = [...prefix, ...readKeySegments(pair)];
    const value = stripAnchorsAndTags(pair.value);
    if (value.startsWith("{")) return [createKeyLine(segments, line), ...readFlowMapKeyLines(value, segments, line)];
    return [createKeyLine(segments, line, value)];
  });
}

const createRootFrame = () => ({ indent: -1, segments: [], isAKey: false, itemCount: 0, keyLine: null });

const createKeyFrame = (indent, keyLine) => ({ indent, segments: keyLine.segments, isAKey: true, awaitsChildren: true, sequenceIndent: null, itemCount: 0, keyLine });

const createItemFrame = (indent, segments) => ({ indent, segments, isAKey: false, itemCount: 0, keyLine: null });

class YamlKeyReading {
  constructor() {
    this.keyLines = [];
    this.startADocument();
  }

  get top() {
    return this.frames[this.frames.length - 1];
  }

  startADocument() {
    this.frames = [createRootFrame()];
    this.blockScalar = null;
    this.openFlow = null;
    this.lastKeyLine = null;
  }

  readLine(text, line) {
    const indent = measureIndent(text);
    const content = stripComment(text.slice(indent)).trimEnd();
    if (this.blockScalar && this.continuesTheBlockScalar(text, indent, line)) return;
    if (this.openFlow) { this.continueTheFlow(content, line); return; }
    if (!content) return;
    if (indent === 0 && DOCUMENT_MARK_PATTERN.test(content)) { this.startADocument(); return; }
    if (indent === 0 && DIRECTIVE_PATTERN.test(content)) return;
    if (DASH_PATTERN.test(content)) { this.readAnItem(content, indent, line); return; }
    const pair = splitKeyAndValue(content);
    if (pair) { this.readAKey(pair, indent, line); return; }
    if (this.lastKeyLine) this.lastKeyLine.valueLines.push(line);
  }

  continuesTheBlockScalar(text, indent, line) {
    if (!text.trim()) return true;
    if (indent <= this.blockScalar.indent) { this.blockScalar = null; return false; }
    this.blockScalar.keyLine.valueLines.push(line);
    return true;
  }

  continueTheFlow(content, line) {
    const flow = this.openFlow;
    flow.text = `${flow.text} ${content.trim()}`;
    flow.keyLine.valueLines.push(line);
    if (measureFlowDepth(flow.text) > 0) return;
    this.openFlow = null;
    if (flow.isAMap) this.keyLines.push(...readFlowMapKeyLines(flow.text, flow.keyLine.segments, flow.keyLine.line));
    else flow.keyLine.value = flow.text;
  }

  readFlowValue(keyLine, value) {
    const isAMap = value.startsWith("{");
    if (measureFlowDepth(value) > 0) { this.openFlow = { text: value, keyLine, isAMap }; return; }
    if (isAMap) this.keyLines.push(...readFlowMapKeyLines(value, keyLine.segments, keyLine.line));
    else keyLine.value = value;
  }

  closeTheFramesBeforeAnItemAt(indent) {
    while (this.frames.length > 1) {
      const top = this.top;
      const holdsTheSequence = top.isAKey && (top.awaitsChildren || top.sequenceIndent === indent);
      if (top.indent < indent || (top.indent === indent && holdsTheSequence)) return;
      this.frames.pop();
    }
  }

  readAnItem(content, indent, line) {
    const rest = stripAnchorsAndTags(content.replace(DASH_PATTERN, ""));
    const contentIndent = indent + content.length - content.replace(DASH_PATTERN, "").length;
    this.closeTheFramesBeforeAnItemAt(indent);
    const sequenceKey = this.top;
    const segments = [...sequenceKey.segments, formatIndexSegment(sequenceKey.itemCount++)];
    sequenceKey.sequenceIndent = indent;
    sequenceKey.awaitsChildren = false;
    if (!rest) { this.frames.push(createItemFrame(indent, segments)); return; }
    const pair = DASH_PATTERN.test(rest) ? null : splitKeyAndValue(rest);
    if (pair) { this.frames.push(createItemFrame(indent, segments)); this.readAKey(pair, contentIndent, line); return; }
    if (rest.startsWith("{")) { this.readAnItemOfAFlowMap(segments, rest, line); return; }
    this.addToTheSequenceValue(sequenceKey, rest, line);
  }

  readAnItemOfAFlowMap(segments, value, line) {
    const keyLine = createKeyLine(segments, line);
    this.keyLines.push(keyLine);
    this.lastKeyLine = keyLine;
    this.readFlowValue(keyLine, value);
  }

  addToTheSequenceValue(sequenceKey, value, line) {
    if (!sequenceKey.keyLine) return;
    sequenceKey.keyLine.valueLines.push(line);
    sequenceKey.keyLine.value = sequenceKey.keyLine.value ? `${sequenceKey.keyLine.value}, ${value}` : value;
  }

  readAKey(pair, indent, line) {
    while (this.frames.length > 1 && this.top.indent >= indent) this.frames.pop();
    if (!pair.quoted && pair.keyText === MERGE_KEY) return;
    const parent = this.top;
    parent.awaitsChildren = false;
    const keyLine = createKeyLine([...parent.segments, ...readKeySegments(pair)], line);
    this.keyLines.push(keyLine);
    this.lastKeyLine = keyLine;
    const value = stripAnchorsAndTags(pair.value);
    if (!value) { this.frames.push(createKeyFrame(indent, keyLine)); return; }
    if (BLOCK_SCALAR_PATTERN.test(value)) { this.blockScalar = { indent, keyLine }; return; }
    if (OPENERS.has(value[0])) { this.readFlowValue(keyLine, value); return; }
    keyLine.value = value;
  }
}

export function readYamlKeyLines(lines) {
  const reading = new YamlKeyReading();
  (lines || []).forEach((text, index) => reading.readLine(String(text ?? ""), index + 1));
  return reading.keyLines;
}
