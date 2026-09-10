import { findQuotedWords, stripComment } from "./BuildFileText.mjs";

const JSON_DEPENDENCY_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "require", "require-dev"];

export function findLinesInsideBlocks(lines, opening) {
  const found = [];
  let depth = 0;
  for (const raw of lines) {
    const text = stripComment(raw, "//");
    if (depth === 0 && opening.test(text)) { depth = 1; continue; }
    if (depth === 0) continue;
    for (const character of text) {
      if (character === "{") depth++;
      else if (character === "}") depth--;
    }
    if (depth > 0 && text && text !== "{") found.push(text);
  }
  return found;
}

export function parseJsonKeys(lines) {
  try {
    const parsed = JSON.parse(lines.join("\n"));
    return JSON_DEPENDENCY_KEYS.flatMap(key => Object.keys((parsed && parsed[key]) || {}));
  } catch { return []; }
}

export function findTomlDependencyLines(lines) {
  const found = [];
  let inSection = false;
  let inList = false;
  for (const raw of lines) {
    const text = stripComment(raw, "#");
    if (/^\[.*\]$/.test(text)) { inSection = /dependencies|requires/i.test(text); inList = false; continue; }
    if (inList) {
      found.push(...findQuotedWords(text));
      if (text.includes("]")) inList = false;
      continue;
    }
    if (/^[\w.-]*(?:dependencies|requires)\s*=\s*\[/i.test(text)) {
      found.push(...findQuotedWords(text.slice(text.indexOf("["))));
      inList = !text.includes("]");
      continue;
    }
    if (inSection && text) found.push(text);
  }
  return found;
}

export const filterLinesMatching = pattern => lines => lines.map(line => line.trim()).filter(line => pattern.test(line));
