import { parseRules } from "../../prepare/io/IoRules.mjs";
import { CHECK_WORDS } from "../../../checks/CheckWords.mjs";
import { readJsonFile } from "../../../files/jsonFile.mjs";

const NOTHING_RETURNED = Object.freeze({ findings: [], notRun: [] });

const CHECK_IDS = new Set(CHECK_WORDS.map(checkWords => checkWords.id));

const CHECK_WITH_ITS_NAME_PATTERN = /^(\S+)\s+\S/;

const readCheckId = check => {
  const named = CHECK_WITH_ITS_NAME_PATTERN.exec(String(check || "").trim());
  return named && CHECK_IDS.has(named[1]) ? named[1] : check;
};

const keepTheCheckIdAlone = finding => ({ ...finding, check: readCheckId(finding.check) });

const readUnknownEndMethod = unknownEndMethod => ({ endMethod: String(unknownEndMethod.endMethod), endCalls: (unknownEndMethod.endCalls || []).map(String) });

const keepOnceEach = values => [...new Map(values.map(value => [JSON.stringify(value), value])).values()];

const summedCountsOf = returns => returns.reduce((summed, returned) => {
  for (const [name, count] of Object.entries(returned.counts || {})) summed[name] = (summed[name] || 0) + (Number(count) || 0);
  return summed;
}, {});

export const joinReturns = returns => ({
  findings: returns.flatMap(returned => returned.findings || []),
  covered: returns.flatMap(returned => returned.covered || []),
  notRun: keepOnceEach(returns.flatMap(returned => returned.notRun || [])),
  counts: summedCountsOf(returns),
  ioScreen: {
    rules: keepOnceEach(returns.flatMap(returned => (returned.ioScreen || {}).rules || [])),
    unknown: returns.flatMap(returned => (returned.ioScreen || {}).unknown || []),
  },
});

const listFindingsFiles = given => (Array.isArray(given) ? given : [given]).filter(Boolean);

const readThePrepareFingerprint = (file, returned) => ({ file, prepareFingerprint: returned.prepareFingerprint || "" });

export class JudgeReturn {
  constructor(returned, prepareFingerprints = []) {
    this.returned = returned;
    this.prepareFingerprints = prepareFingerprints;
  }

  static readFrom(findingsFiles) {
    const files = listFindingsFiles(findingsFiles);
    if (!files.length) return new JudgeReturn(NOTHING_RETURNED);
    const returns = files.map(file => readJsonFile(file));
    const prepareFingerprints = files.map((file, index) => readThePrepareFingerprint(file, returns[index]));
    if (files.length === 1) return new JudgeReturn(returns[0], prepareFingerprints);
    return new JudgeReturn(joinReturns(returns), prepareFingerprints);
  }

  listPrepareFingerprints() {
    return this.prepareFingerprints;
  }

  listFindings() {
    return (this.returned.findings || []).map(keepTheCheckIdAlone);
  }

  listCoveredPaths() {
    return this.returned.covered || [];
  }

  readIoScreen() {
    const given = this.returned.ioScreen || {};
    const unknown = (Array.isArray(given.unknown) ? given.unknown : [])
      .filter(unknownEndMethod => unknownEndMethod && unknownEndMethod.endMethod)
      .map(readUnknownEndMethod);
    return { rules: parseRules(given.rules).rules, unknown };
  }

  listNotRunChecks() {
    return this.returned.notRun || [];
  }
}
