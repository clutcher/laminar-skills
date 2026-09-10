import { stripTypeArguments } from "../../../../../inputs/source/SourceText.mjs";
import { findClosingParenthesis, ONLY_PARENTHESES } from "../../../../../inputs/source/text/Brackets.mjs";

export function readParameters(headText) {
  const text = String(headText || "");
  const opened = text.indexOf("(");
  if (opened < 0) return [];
  const closed = findClosingParenthesis(text, opened, ONLY_PARENTHESES);
  if (closed < 0) return [];
  const inside = stripTypeArguments(text.slice(opened + 1, closed)).trim();
  return inside ? inside.split(",") : [];
}

const LAST_NAME_OF_A_PARAMETER_PATTERN = /([A-Za-z_$][\w$]*)\s*(?:=[^=].*)?$/;

export const readParameterName = parameterText => (LAST_NAME_OF_A_PARAMETER_PATTERN.exec(parameterText.trim()) || [])[1];

export const readParameterNames = headText => readParameters(headText).map(readParameterName).filter(Boolean);
