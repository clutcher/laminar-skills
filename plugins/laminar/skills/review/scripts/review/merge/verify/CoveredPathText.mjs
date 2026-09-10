import { readLead } from "../../../checks/CheckWords.mjs";
import { LINE_CHECK_RESULTS } from "../lines/LineCheck.mjs";

const formatNamedPlace = place => `${place.file}:${place.line}${place.displayName ? ` · ${place.displayName}` : ""}`;

const formatQuotedLine = quote => `- ${quote.file}:${quote.line}${quote.text ? ` · ${quote.text}` : ""}`;

const isInTheCode = quote => quote.lineCheckResult !== LINE_CHECK_RESULTS.NO_SUCH_LINE;

const formatCallingTests = test => ((test.calledByTests || []).length ? [`Called by tests: ${test.calledByTests.join(", ")}`] : []);

export const formatCoveredPathLines = covered => {
  const entry = covered.abstractionPlace || {};
  const test = covered.test || {};
  return [
    `Covered path: ${covered.number} · ${covered.check} · ${entry.displayName || ""}`,
    `Check: ${covered.check} · ${readLead(covered.check)}`,
    `Entry: ${formatNamedPlace(entry)}`,
    `Test: ${formatNamedPlace(test)}`,
    ...formatCallingTests(test),
    `Outcome: ${covered.outcome || ""}`,
    "Places:",
    ...(covered.quotes || []).filter(isInTheCode).map(formatQuotedLine),
  ];
};
