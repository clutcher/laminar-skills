import { formatCodeUnderReviewBlock, formatPossibleFindingLines, formatRulesBlock } from "./PossibleFindingText.mjs";
import { formatCoveredPathLines } from "./CoveredPathText.mjs";

const FIELDS_THE_REFUTER_NEVER_READS = Object.freeze(["confidence", "whatWouldConfirm"]);

const joinTheBlocks = (claimLines, { judgeType, rules, codeUnderReviewFile }) => [
  claimLines.join("\n"),
  formatRulesBlock(judgeType, rules),
  formatCodeUnderReviewBlock(codeUnderReviewFile),
].join("\n\n");

export const buildRefuteFileText = ({ possibleFinding, item, ...rulesAndCode }) => joinTheBlocks(formatPossibleFindingLines(possibleFinding, item, FIELDS_THE_REFUTER_NEVER_READS), rulesAndCode);

export const buildCoveredPathFileText = ({ covered, ...rulesAndCode }) => joinTheBlocks(formatCoveredPathLines(covered), rulesAndCode);
