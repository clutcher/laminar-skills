import { DECISIONS, NOT_VERIFIED_STAGES, readDecision } from "./SettledFindings.mjs";
import { isRefuted } from "./VerifyReturns.mjs";
import { CHECKS_BY_ID_MAP } from "../../../checks/CheckCatalog.mjs";
import { readTrack } from "../../../checks/CheckWords.mjs";
import { Scale } from "../../../code/index.mjs";
import { readTheNeededTestCeiling } from "../../merge/filing/ConfidenceCeilings.mjs";

const NO_SECOND_READ = Object.freeze({ refutation: null, verdictDecision: "", notVerified: "" });

const INTEGRATION_TEST_NEEDED = CHECKS_BY_ID_MAP.CD4.id;

const readTheStageNotVerified = (covered, refutation, returns) => {
  const notVerified = returns.findNotVerifiedOf(covered.number);
  if (notVerified) return String(notVerified.stage || NOT_VERIFIED_STAGES.REFUTER);
  if (isRefuted(refutation)) return NOT_VERIFIED_STAGES.VERIFIER;
  return refutation ? "" : NOT_VERIFIED_STAGES.REFUTER;
};

const readTheSecondRead = (covered, returns) => {
  if (!returns.holdsRefutations) return NO_SECOND_READ;
  const refutation = returns.findRefutationOf(covered.number);
  const verdict = returns.findVerdictOf(covered.number);
  if (verdict && isRefuted(refutation)) return { ...NO_SECOND_READ, refutation, verdictDecision: readDecision(verdict) === DECISIONS.REJECT ? DECISIONS.REJECT : DECISIONS.KEEP, fact: verdict.fact || "" };
  return { ...NO_SECOND_READ, refutation, notVerified: readTheStageNotVerified(covered, refutation, returns) };
};

const readScale = displayName => String(displayName || "").includes("#") ? Scale.METHOD.name : Scale.CLASS.name;

const formatNamedTest = test => test.displayName ? `\`${test.displayName}\`` : "the test the judge named";

const buildEvidence = (abstractionPlace, test) => [abstractionPlace, test]
  .filter(place => place.file && place.line)
  .map(place => ({ file: place.file, lines: [place.line] }));

const buildPathToTest = (covered, confidence) => {
  const abstractionPlace = covered.abstractionPlace || {};
  const test = covered.test || {};
  const scale = readScale(abstractionPlace.displayName);
  return {
    id: covered.id,
    verdict: { decision: DECISIONS.KEEP, confidence },
    possibleFindings: [{
      codeUnderReviewId: covered.codeUnderReviewId,
      check: INTEGRATION_TEST_NEEDED,
      group: readTrack(INTEGRATION_TEST_NEEDED),
      judgeType: covered.judgeType,
      displayName: abstractionPlace.displayName || "",
      scale,
      abstraction: { displayName: abstractionPlace.displayName || "", scale },
      isTest: false,
      file: abstractionPlace.file,
      line: abstractionPlace.line,
      entry: abstractionPlace,
      outcome: covered.outcome || "",
      summary: covered.fact,
      evidence: covered.evidence || buildEvidence(abstractionPlace, test),
      confidence,
      whatWouldConfirm: `the requirement behind this outcome, because the verifier found that ${formatNamedTest(test)} does not run this path`,
      coveredClaimRejected: test,
    }],
  };
};

export class TestCoveredPaths {
  constructor(coveredPaths, returns, run = {}) {
    this.keptCoveredPaths = [];
    this.rejectedCoveredPaths = [];
    for (const covered of coveredPaths || []) this.settle({ ...covered, ...readTheSecondRead(covered, returns) });
    this.pathsToTest = this.rejectedCoveredPaths.map(covered => buildPathToTest(covered, readTheNeededTestCeiling(run)));
  }

  settle(covered) {
    if (covered.verdictDecision === DECISIONS.REJECT) this.rejectedCoveredPaths.push(covered);
    else this.keptCoveredPaths.push(covered);
  }

  listNumbers() {
    return [...this.keptCoveredPaths, ...this.rejectedCoveredPaths].map(covered => covered.number).filter(Number.isInteger);
  }

  listNotVerified() {
    return this.keptCoveredPaths.filter(covered => covered.notVerified);
  }
}
