import { readLead } from "../../../checks/CheckWords.mjs";
import { formatBelongingAnswerLines } from "../draft/DraftLinesText.mjs";

const LABEL_BY_FIELD = Object.freeze([
  ["field", "Field"],
  ["decision", "Decision"],
  ["summary", "Claim"],
  ["prediction", "Prediction"],
  ["found", "Found"],
  ["fact", "Fact"],
  ["consider", "To consider"],
  ["confidence", "Confidence"],
  ["whatWouldConfirm", "To confirm"],
]);

const SAME_DECISION_MARK = " · same decision";

const formatLinesOfAPlace = place => (place.lines ? place.lines.join(", ") : place.line);

const formatPlace = place => `- ${place.file}:${formatLinesOfAPlace(place)}${place.text ? ` · ${place.text}` : ""}${place.sameDecision ? SAME_DECISION_MARK : ""}`;

const formatFieldLines = (possibleFinding, leftOutFields) => LABEL_BY_FIELD
  .filter(([field]) => possibleFinding[field] && !leftOutFields.includes(field))
  .map(([field, label]) => `${label}: ${possibleFinding[field]}`);

const formatAlsoInLines = possibleFinding => {
  const alsoIn = [...(possibleFinding.places || []), ...(possibleFinding.alsoAt || [])];
  return alsoIn.length ? ["Also in:", ...alsoIn.map(formatPlace)] : [];
};

const formatChangedLines = item => (item && item.changedLines ? [`Changed lines: ${item.changedLines}`] : []);

export const formatPossibleFindingLines = (possibleFinding, item, leftOutFields = []) => [
  `Finding: ${possibleFinding.displayName} · ${possibleFinding.scale}`,
  `Check: ${possibleFinding.check} · ${readLead(possibleFinding.check)}`,
  ...formatFieldLines(possibleFinding, leftOutFields),
  ...formatBelongingAnswerLines([].concat(possibleFinding.belongingAnswers || []).filter(Boolean)),
  "Places:",
  ...(possibleFinding.evidence || []).map(formatPlace),
  ...formatAlsoInLines(possibleFinding),
  ...formatChangedLines(item),
];

export const formatRulesBlock = (judgeType, rules) => `Rules: ${judgeType}\n\n${rules}`;

export const formatCodeUnderReviewBlock = codeUnderReviewFile => `Code under review: ${codeUnderReviewFile.path}\n\n${codeUnderReviewFile.text}`;
