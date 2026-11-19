import { THE_VERIFIER } from "../../../checks/CheckText.mjs";
import { formatCodeUnderReviewBlock, formatPossibleFindingLines, formatRulesBlock } from "./PossibleFindingText.mjs";
import { formatCoveredPathLines } from "./CoveredPathText.mjs";

const FIELDS_THE_REFUTER_NEVER_READS = Object.freeze(["confidence", "whatWouldConfirm"]);

const formatVerifierReviewConventionsBlocks = verifierReviewConventions => (verifierReviewConventions ? [formatRulesBlock(THE_VERIFIER, verifierReviewConventions)] : []);

const joinTheBlocks = (claimLines, { judgeType, rules, verifierReviewConventions, codeUnderReviewFile }) => [
  claimLines.join("\n"),
  formatRulesBlock(judgeType, rules),
  ...formatVerifierReviewConventionsBlocks(verifierReviewConventions),
  formatCodeUnderReviewBlock(codeUnderReviewFile),
].join("\n\n");

export const buildRefuteFileText = ({ possibleFinding, item, ...rulesAndCode }) => joinTheBlocks(formatPossibleFindingLines(possibleFinding, item, FIELDS_THE_REFUTER_NEVER_READS), rulesAndCode);

export const buildCoveredPathFileText = ({ covered, ...rulesAndCode }) => joinTheBlocks(formatCoveredPathLines(covered), rulesAndCode);
