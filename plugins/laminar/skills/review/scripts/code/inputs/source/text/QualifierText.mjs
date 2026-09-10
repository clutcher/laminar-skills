import { EXPRESSION_QUALIFIER } from "../../../graph/relations/Reference.mjs";

const TYPE_QUALIFIER_RIGHT_BEFORE_PATTERN = /([A-Za-z_$][\w$]*)(?:\.|::)\s*$/;

const RECEIVER_WORD_BEFORE_PATTERN = /([A-Za-z_$@][\w$]*)\s*$/;

const SPREAD_BEFORE_PATTERN = /\.\.\.\s*$/;

export const findValueQualifierBefore = (code, at) => (TYPE_QUALIFIER_RIGHT_BEFORE_PATTERN.exec(String(code).slice(0, at)) || [])[1] || "";

export const findCallQualifierBefore = (code, at, separatorPattern) => {
  const ahead = code.slice(0, at);
  const separator = separatorPattern.exec(ahead);
  if (!separator || SPREAD_BEFORE_PATTERN.test(ahead)) return "";
  const receiverMatch = RECEIVER_WORD_BEFORE_PATTERN.exec(ahead.slice(0, ahead.length - separator[0].length));
  return receiverMatch ? receiverMatch[1] : EXPRESSION_QUALIFIER;
};
