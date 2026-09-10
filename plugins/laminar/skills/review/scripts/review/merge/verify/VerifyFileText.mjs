import { formatItemBlock } from "../draft/DraftLinesText.mjs";
import { formatCodeUnderReviewBlock, formatPossibleFindingLines, formatRulesBlock } from "./PossibleFindingText.mjs";

const formatPossibleFindingBlock = (possibleFinding, item) => [
  `Possible finding: ${possibleFinding.number} · ${possibleFinding.check} · ${possibleFinding.displayName}`,
  ...formatPossibleFindingLines(possibleFinding, item),
].join("\n");

export const buildVerifyFileText = ({ item, possibleFindings, rulesByJudgeType, codeUnderReviewFiles }) => [
  formatItemBlock(item),
  ...possibleFindings.map(possibleFinding => formatPossibleFindingBlock(possibleFinding, item)),
  ...Object.entries(rulesByJudgeType).map(([judgeType, rules]) => formatRulesBlock(judgeType, rules)),
  ...codeUnderReviewFiles.map(formatCodeUnderReviewBlock),
].join("\n\n");
