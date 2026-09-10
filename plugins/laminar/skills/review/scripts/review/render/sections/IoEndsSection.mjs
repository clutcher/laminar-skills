import { countEndCallsByRule, RULE_ANSWERS, collectRuleAnswers, parseRules } from "../../prepare/io/IoRules.mjs";

export const IO_ENDS_HEADING = "## I/O ends";

const NO_END = "The script listed no end call under a loop, so the I/O screen did not run.";

const THE_ENDS_SENTENCE = "The script followed the calls under each loop to the calls that leave the repository's own code. The I/O screen wrote rules by the type or the module of these end calls, and the script applied the rules. Each end method with an end call that a rule marks io went to 1 call of the I/O paths judge. An end method with no io end call and at least 1 end call that no rule answers is unknown, and no judge read it.";

const THE_PATCH_SENTENCE = "The walk read only the patch, so it did not follow a call that leaves it.";

const RULE_SOURCES = Object.freeze({
  fresh: "written by the I/O screen in this run",
  cached: "from the cache of an earlier run with the same dependency files",
});

const NO_RULE_ANSWERED_IT = "no rule answered it";

const formatRuleWords = answer => `${answer.answer === RULE_ANSWERS.IO ? "io" : "not io"}, by rule ${answer.rule}`;

const formatEndCallLine = (end, call, words) => `- ${call.id} · \`${end.path}:${call.line}\` · \`${call.call}\` in \`${end.method}\` · ${words}`;

const formatNamedList = names => names.map(name => `\`${name}\``).join(", ");

const formatRuleLine = (rule, counts) => `- ${rule.id} · on \`${rule.on}\` · callee ${formatNamedList(rule.callee)} · ${rule.answer === RULE_ANSWERS.IO ? "io" : "not io"} · end calls: ${counts.get(rule.id) || 0}`;

const chooseUsedRules = (ioScreen, cachedRules) => {
  const fresh = parseRules((ioScreen || {}).rules).rules;
  if (fresh.length) return { rules: fresh, source: RULE_SOURCES.fresh };
  const cached = parseRules(cachedRules).rules;
  return { rules: cached, source: cached.length ? RULE_SOURCES.cached : "" };
};

const formatRulesBlock = (used, answers) => {
  if (!used.rules.length) return "Rules: none";
  const counts = countEndCallsByRule(answers);
  return [`Rules: ${used.rules.length}, ${used.source}`, ...used.rules.map(rule => formatRuleLine(rule, counts))].join("\n");
};

const formatUnknownLine = (unknown, unknownFile) => unknown.length
  ? `Unknown end methods: ${unknown.length}, written to \`${unknownFile}\``
  : "Unknown end methods: 0";

export function buildIoEndsSection({ ends, ioScreen, cachedRules, unknownFile, onlyThePatch }) {
  const patch = onlyThePatch ? [THE_PATCH_SENTENCE] : [];
  if (!(ends || []).length) return [IO_ENDS_HEADING, NO_END, ...patch].join("\n\n");
  const used = chooseUsedRules(ioScreen, cachedRules);
  const answers = collectRuleAnswers(used.rules, ends);
  const lines = ends.flatMap(end => end.calls.map(call => {
    const byRule = answers.get(call.id);
    return formatEndCallLine(end, call, byRule ? formatRuleWords(byRule) : NO_RULE_ANSWERED_IT);
  }));
  return [
    IO_ENDS_HEADING,
    THE_ENDS_SENTENCE,
    ...patch,
    formatRulesBlock(used, answers),
    formatUnknownLine((ioScreen || {}).unknown || [], unknownFile),
    lines.join("\n"),
  ].join("\n\n");
}
