import { splitKeyPath } from "../../keys/KeyPaths.mjs";

const COMMENT_LINE_PATTERN = /^\s*[#!]/;
const KEY_END_CHARACTERS = new Set(["=", ":", " ", "\t", "\f"]);
const SEPARATOR_PATTERN = /^[ \t\f]*[=:]?[ \t\f]*/;
const ESCAPED_CHARACTER_PATTERN = /\\(.)/g;
const TRAILING_BACKSLASHES_PATTERN = /\\+$/;

const endsWithAContinuation = text => ((TRAILING_BACKSLASHES_PATTERN.exec(text) || [""])[0].length % 2) === 1;

function findKeyEnd(text) {
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "\\") { at++; continue; }
    if (KEY_END_CHARACTERS.has(text[at])) return at;
  }
  return text.length;
}

function readPropertyLine(text, line) {
  const content = text.trimStart();
  const keyEnd = findKeyEnd(content);
  const keyText = content.slice(0, keyEnd).replace(ESCAPED_CHARACTER_PATTERN, "$1");
  const value = content.slice(keyEnd).replace(SEPARATOR_PATTERN, "").replace(TRAILING_BACKSLASHES_PATTERN, "").trim();
  return { segments: splitKeyPath(keyText), line, value, valueLines: [] };
}

export function readPropertiesKeyLines(lines) {
  const keyLines = [];
  let continued = null;
  (lines || []).forEach((given, index) => {
    const text = String(given ?? "");
    const line = index + 1;
    if (continued) {
      continued.valueLines.push(line);
      continued = endsWithAContinuation(text) ? continued : null;
      return;
    }
    if (!text.trim() || COMMENT_LINE_PATTERN.test(text)) return;
    const keyLine = readPropertyLine(text, line);
    if (keyLine.segments.length) keyLines.push(keyLine);
    if (endsWithAContinuation(text)) continued = keyLine;
  });
  return keyLines;
}
