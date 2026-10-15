const JUDGE_TYPE_PREFIX_PATTERN = /^judge-/;

const formatCount = number => Number(number).toLocaleString("en-US");

const findJudgeCalls = plan => plan && plan.upTo ? plan.upTo.judgeCalls : null;

export function buildScope(prepared, plan, fullPlan) {
  const filter = prepared.filter;
  if (!filter) return null;
  return {
    judges: filter.judges || [],
    paths: filter.paths || [],
    scales: filter.scales || [],
    judgeCallsPlanned: findJudgeCalls(fullPlan),
    judgeCallsInThisRun: findJudgeCalls(plan),
  };
}

const isSet = value => value !== null && !(Array.isArray(value) && !value.length);

export const selectScopeProperties = scope => Object.fromEntries(Object.entries(scope).filter(([, value]) => isSet(value)));

const formatScalesPhrase = ({ scales }) => scales.length ? `scales: ${scales.map(scale => scale.toLowerCase()).join(", ")}` : "";

const formatJudgesPhrase = ({ judges }) => judges.length ? `judges: ${judges.map(judgeType => judgeType.replace(JUDGE_TYPE_PREFIX_PATTERN, "")).join(", ")}` : "";

const formatPathsPhrase = ({ paths }) => paths.length ? `paths: ${paths.join(", ")}` : "";

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

export function formatScopeLine(scope) {
  if (!scope) return "";
  return ["**Scope** · filtered at the cost check", formatScalesPhrase(scope), formatJudgesPhrase(scope), formatPathsPhrase(scope), formatJudgeCallsPhrase(scope)].filter(Boolean).join(" · ");
}
