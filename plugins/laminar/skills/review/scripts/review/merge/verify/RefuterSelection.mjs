import { isAConsideration } from "../filing/Considerations.mjs";
import { JUDGE_TYPE_BY_TRACK_MAP } from "../../../checks/JudgeType.mjs";
import { TRACKS } from "../../../checks/CheckCatalog.mjs";

const JUDGE_TYPES_LEFT_UNREFUTED = Object.freeze([JUDGE_TYPE_BY_TRACK_MAP[TRACKS.TEST_PLAN], JUDGE_TYPE_BY_TRACK_MAP[TRACKS.IO_PATHS]]);

export const readJudgeTypeOf = (possibleFinding, group) => possibleFinding.judgeType || group.judgeType || "";

const isRaisedByAJudgeTypeLeftUnrefuted = (possibleFinding, group) => JUDGE_TYPES_LEFT_UNREFUTED.includes(readJudgeTypeOf(possibleFinding, group));

const isRaisedByTheScript = possibleFinding => possibleFinding.scriptRaised === true;

const isNumbered = possibleFinding => Number.isInteger(possibleFinding.number);

export const isReadByTheRefuter = (possibleFinding, group) => isNumbered(possibleFinding)
  && !isRaisedByTheScript(possibleFinding)
  && !isAConsideration(possibleFinding)
  && !isRaisedByAJudgeTypeLeftUnrefuted(possibleFinding, group);
