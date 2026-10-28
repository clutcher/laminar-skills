const JUDGE_TYPE_PREFIX_PATTERN = /^judge-/;

const formatCount = number => Number(number).toLocaleString("en-US");

const findJudgeCalls = plan => plan && plan.upTo ? plan.upTo.judgeCalls : null;

const wasAskedAtTheCostCheck = fullPlan => Boolean(fullPlan && fullPlan.passesThreshold);

export function buildScope(prepared, plan, fullPlan, leftOutCountByScaleMap = null) {
  const filter = prepared.filter;
  if (!filter) return null;
  return {
    askedAtTheCostCheck: wasAskedAtTheCostCheck(fullPlan),
    judges: filter.judges || [],
    paths: filter.paths || [],
    scales: filter.scales || [],
    leftOut: leftOutCountByScaleMap,
    leftOutByThePaths: prepared.leftOutByThePaths || null,
    judgeCallsPlanned: findJudgeCalls(fullPlan),
    judgeCallsInThisRun: findJudgeCalls(plan),
  };
}

const isSet = value => value !== null && !(Array.isArray(value) && !value.length);

export const selectScopeProperties = scope => Object.fromEntries(Object.entries(scope).filter(([, value]) => isSet(value)));

const formatLeftOutPhrase = leftOutCountByScaleMap => Object.entries(leftOutCountByScaleMap || {}).map(([scale, count]) => `${scale.toLowerCase()} ${formatCount(count)}`).join(", ");

const formatScalesPhrase = ({ scales, leftOut }) => {
  if (!scales.length) return "";
  const leftOutPhrase = formatLeftOutPhrase(leftOut);
  return `scales: ${scales.map(scale => scale.toLowerCase()).join(", ")}${leftOutPhrase ? ` · left out: ${leftOutPhrase}` : ""}`;
};

const formatJudgesPhrase = ({ judges }) => judges.length ? `judges: ${judges.map(judgeType => judgeType.replace(JUDGE_TYPE_PREFIX_PATTERN, "")).join(", ")}` : "";

export const formatLeftOutByThePaths = leftOutByThePaths => `a path names a file, so the folders that hold it are not judged · left out: ${formatLeftOutPhrase(leftOutByThePaths)}`;

const formatPathsPhrase = ({ paths, leftOutByThePaths }) => {
  if (!paths.length) return "";
  const leftOutPhrase = formatLeftOutPhrase(leftOutByThePaths);
  return `paths: ${paths.join(", ")}${leftOutPhrase ? ` · left out: ${leftOutPhrase}` : ""}`;
};

const formatJudgeCallsPhrase = ({ judgeCallsPlanned, judgeCallsInThisRun }) => {
  if (judgeCallsInThisRun === null) return "";
  if (judgeCallsPlanned === null) return `${formatCount(judgeCallsInThisRun)} judge calls in this run`;
  return `${formatCount(judgeCallsPlanned)} judge calls planned, ${formatCount(judgeCallsInThisRun)} in this run`;
};

const formatCounted = (count, one, many) => `${formatCount(count)} ${count === 1 ? one : many}`;

export const findAcrossApplicationsCounts = prepared => {
  const counts = prepared.entryBoundaries;
  return counts && counts.boundaries > 0 ? counts : null;
};

export function formatAcrossApplicationsLine(counts) {
  if (!counts) return "";
  const judged = [`${formatCount(counts.judged)} judged`, `${formatCount(counts.noCaller)} with no caller found`, ...(counts.notJudged ? [`${formatCount(counts.notJudged)} not judged`] : [])].join(", ");
  return `**Across applications** · ${formatCounted(counts.boundaries, "entry boundary", "entry boundaries")} in ${formatCounted(counts.applications, "application", "applications")} · ${judged} · callers are searched in this repository only, and callers in other repositories are not seen`;
}

const FILTERED_AT_THE_COST_CHECK = "filtered at the cost check";

const FILTERED_WHEN_THE_REVIEW_STARTED = "filtered when the review was started";

export function formatScopeLine(scope) {
  if (!scope) return "";
  return [`**Scope** · ${scope.askedAtTheCostCheck ? FILTERED_AT_THE_COST_CHECK : FILTERED_WHEN_THE_REVIEW_STARTED}`, formatScalesPhrase(scope), formatJudgesPhrase(scope), formatPathsPhrase(scope), formatJudgeCallsPhrase(scope)].filter(Boolean).join(" · ");
}
