export const LOOP_WORDS = Object.freeze({ PASS: "pass", CONTINUE: "continue", STOP: "stop" });

export const LOOP_CODES = Object.freeze({
  OPEN_COUNT_ZERO: "open-count-zero",
  CEILING_REACHED: "ceiling-reached",
  CLOSED_FINDING_RETURNED: "closed-finding-returned",
  OPEN_AFTER_DESIGNER: "open-after-designer",
  NEW_FINDINGS_ON_FIX_CREATED_CODE: "new-findings-on-fix-created-code",
  NO_LOWER_COUNT: "no-lower-count",
  FIRST_ROUND: "first-round",
  OPEN_FINDINGS_REMAIN: "open-findings-remain",
});

// More than this share of the appeared findings on fix-created files stops the loop, because the fixes then make new problems faster than they close old ones.
export const FIX_CREATED_SHARE_LIMIT = 0.5;

const DESIGN_PROBLEM_WORDS = "1 design problem";

const createLoopLine = (word, code, text) => ({ word, code, text });

const joinNames = names => names.join(", ");

// A display name open in round n-1 and round n goes back to the designer once, the first time.
export const listSendLines = (round, openChecksBefore, openChecksNow, sentBackRoundOfNameMap) => {
  const sendLines = [];
  for (const [displayName, checksNow] of openChecksNow) {
    const checksBefore = openChecksBefore.get(displayName);
    if (!checksBefore || sentBackRoundOfNameMap.has(displayName)) continue;
    const checks = [...new Set([...checksBefore, ...checksNow])];
    sendLines.push({ to: "designer", displayName, text: `open in rounds ${round - 1} and ${round}: ${joinNames(checks)}; ${DESIGN_PROBLEM_WORDS}` });
  }
  return sendLines;
};

const describeTheShare = (onFixCreated, appeared) => `${onFixCreated} of ${appeared} appeared findings stand on fix-created files`;

const describeTheReturn = keyState => `${keyState.check} on ${keyState.displayName}${keyState.returnedFrom ? ` (was ${keyState.returnedFrom})` : ""}`;

const findStopLine = ({ round, ceiling, returnedKeys, openAfterDesignerNames, comparison }) => {
  if (returnedKeys.length) return createLoopLine(LOOP_WORDS.STOP, LOOP_CODES.CLOSED_FINDING_RETURNED, `a fix closed ${joinNames(returnedKeys.map(describeTheReturn))} in an earlier round, and it appears again`);
  if (ceiling !== null && round >= ceiling) return createLoopLine(LOOP_WORDS.STOP, LOOP_CODES.CEILING_REACHED, `round ${round} reached the ceiling of ${ceiling} rounds`);
  if (openAfterDesignerNames.length) return createLoopLine(LOOP_WORDS.STOP, LOOP_CODES.OPEN_AFTER_DESIGNER, `${joinNames(openAfterDesignerNames)} went back to the designer in round ${round - 1} and is open again`);
  if (!comparison) return null;

  const { appeared, appearedOnFixCreatedFiles, openBefore, openNow } = comparison;
  if (appearedOnFixCreatedFiles !== null && appeared > 0 && appearedOnFixCreatedFiles / appeared > FIX_CREATED_SHARE_LIMIT) return createLoopLine(LOOP_WORDS.STOP, LOOP_CODES.NEW_FINDINGS_ON_FIX_CREATED_CODE, describeTheShare(appearedOnFixCreatedFiles, appeared));
  if (openNow === 0 || openNow < openBefore) return null;
  const change = openNow === openBefore ? `stayed at ${openNow}` : `rose from ${openBefore} to ${openNow}`;
  return createLoopLine(LOOP_WORDS.STOP, LOOP_CODES.NO_LOWER_COUNT, `the open count on keys judged in both rounds ${change}`);
};

// The first rule that matches decides the loop line.
export const decideLoopLine = facts => {
  if (facts.open === 0) return createLoopLine(LOOP_WORDS.PASS, LOOP_CODES.OPEN_COUNT_ZERO, `no finding is open after round ${facts.round}`);
  const stopLine = findStopLine(facts);
  if (stopLine) return stopLine;
  if (!facts.comparison) return createLoopLine(LOOP_WORDS.CONTINUE, LOOP_CODES.FIRST_ROUND, `the open count is ${facts.open} after the first round`);
  return createLoopLine(LOOP_WORDS.CONTINUE, LOOP_CODES.OPEN_FINDINGS_REMAIN, `the open count is ${facts.open} after round ${facts.round}`);
};
