import { isACommentLine } from "../forms/CommentForms.mjs";
import { IMPORT_OR_NAMESPACE_LINE_PATTERN } from "./ImportLines.mjs";
import { STRING_LITERAL_PATTERN } from "../text/TextLiterals.mjs";

const DECISION_WORD_PATTERN = /\b(?:if|elif|elsif|unless|while|when|case|guard|not|and|or|is)\b/;
const DECISION_SIGN_PATTERN = /\s\?\s|[=!]==?|\s[<>]=?\s|&&|\|\||\.equals\(|(?:^|[\s(])!(?!=)[\w$(]/;

const holdsADecision = text => DECISION_SIGN_PATTERN.test(text) || DECISION_WORD_PATTERN.test(text.replace(STRING_LITERAL_PATTERN, " "));

export const isADecisionLine = text => !isACommentLine(text) && !IMPORT_OR_NAMESPACE_LINE_PATTERN.test(text) && holdsADecision(text);
