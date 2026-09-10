import fs from "node:fs";
import path from "node:path";
import { chooseRepositoryToRead } from "../../code/index.mjs";
import { IO_UNKNOWN_FILE, formatIoUnknownText } from "../prepare/io/IoReachText.mjs";

export class IoScreenResultWriter {
  constructor(runFolder, preparedRun, ioScreen, ruleCache) {
    this.runFolder = runFolder;
    this.prepared = preparedRun.prepared;
    this.ioScreen = ioScreen;
    this.ruleCache = ruleCache;
  }

  keepTheRulesInTheCache() {
    this.ruleCache.write(this.prepared.ioRuleKey || "", this.ioScreen.rules);
  }

  findUnknownEndMethods() {
    const codeUnderReviewByEndMethodMap = new Map((this.prepared.codeUnderReview || []).filter(codeUnderReview => codeUnderReview.end).map(codeUnderReview => [codeUnderReview.end.id, codeUnderReview]));
    return this.ioScreen.unknown
      .filter(({ endMethod }) => codeUnderReviewByEndMethodMap.has(endMethod))
      .map(({ endMethod, endCalls }) => {
        const codeUnderReview = codeUnderReviewByEndMethodMap.get(endMethod);
        return { ioPaths: codeUnderReview, calls: codeUnderReview.calls.filter(call => endCalls.includes(call.id)) };
      });
  }

  writeTheUnknownEndMethods() {
    const file = path.join(this.runFolder, IO_UNKNOWN_FILE);
    const unknown = this.findUnknownEndMethods();
    const repositoryRoot = chooseRepositoryToRead(this.prepared.mode, this.prepared.target) || "";
    if (unknown.length) fs.writeFileSync(file, formatIoUnknownText(unknown, { repositoryRoot }));
    else fs.rmSync(file, { force: true });
  }
}
