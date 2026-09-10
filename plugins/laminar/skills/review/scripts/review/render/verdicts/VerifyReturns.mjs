import { readJsonFile } from "../../../files/jsonFile.mjs";

const LISTS_OF_THE_REFUTER_STAGE = Object.freeze(["refutations", "notVerified"]);

const VERDICTS_FILE_SEPARATOR = ",";

export const REFUTATION_ANSWERS = Object.freeze({ REFUTED: "refuted", NOT_REFUTED: "not refuted" });

const listOf = (read, field) => (Array.isArray(read[field]) ? read[field] : []);

const listTheVerdictsFiles = verdictsFiles => (Array.isArray(verdictsFiles) ? verdictsFiles : String(verdictsFiles || "").split(VERDICTS_FILE_SEPARATOR))
  .map(fileName => String(fileName).trim())
  .filter(Boolean);

export const readPossibleFindingNumber = given => Number(given.possibleFinding) || 0;

const holdsAPossibleFindingNumber = given => readPossibleFindingNumber(given) > 0;

const indexByNumber = list => new Map(list.filter(holdsAPossibleFindingNumber).map(listed => [readPossibleFindingNumber(listed), listed]));

const groupByItem = verdicts => {
  const verdictsByItemMap = new Map();
  for (const verdict of verdicts) verdictsByItemMap.set(verdict.itemId, [...(verdictsByItemMap.get(verdict.itemId) || []), verdict]);
  return verdictsByItemMap;
};

const isWrittenByTheRefuterStage = read => LISTS_OF_THE_REFUTER_STAGE.some(field => Array.isArray(read[field]));

export const isRefuted = refutation => String((refutation || {}).answer || "").trim().toLowerCase() === REFUTATION_ANSWERS.REFUTED;

export class VerifyReturns {
  constructor(reads) {
    const verdicts = reads.flatMap(read => listOf(read, "verdicts"));
    this.numberedVerdicts = verdicts.filter(holdsAPossibleFindingNumber);
    this.verdictsByNumberMap = indexByNumber(verdicts);
    this.refutationsByNumberMap = indexByNumber(reads.flatMap(read => listOf(read, "refutations")));
    this.notVerifiedByNumberMap = indexByNumber(reads.flatMap(read => listOf(read, "notVerified")));
    this.itemVerdictsByItemMap = groupByItem(verdicts.filter(verdict => !holdsAPossibleFindingNumber(verdict)));
    this.holdsRefutations = reads.some(isWrittenByTheRefuterStage);
  }

  static readFrom(verdictsFiles) {
    return new VerifyReturns(listTheVerdictsFiles(verdictsFiles).map(readJsonFile));
  }

  static fromVerdictsByItem(verdictsByItemMap) {
    return new VerifyReturns([{ verdicts: [...verdictsByItemMap.values()].flat() }]);
  }

  findVerdictOf(number) {
    return this.verdictsByNumberMap.get(number) || null;
  }

  findRefutationOf(number) {
    return this.refutationsByNumberMap.get(number) || null;
  }

  findNotVerifiedOf(number) {
    return this.notVerifiedByNumberMap.get(number) || null;
  }

  listItemVerdictsOf(itemId) {
    return this.itemVerdictsByItemMap.get(itemId) || [];
  }

  isEmpty() {
    return !this.verdictsByNumberMap.size && !this.refutationsByNumberMap.size && !this.notVerifiedByNumberMap.size
      && !this.itemVerdictsByItemMap.size;
  }
}
