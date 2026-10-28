import { PublicChangeKinds } from "../../../code/index.mjs";

const listTheAbstractionAndItsDescendants = abstraction => [abstraction, ...(abstraction.children || []).flatMap(listTheAbstractionAndItsDescendants)];

const indexThePublicChangeKindsById = abstractions => new Map(abstractions
  .flatMap(listTheAbstractionAndItsDescendants)
  .filter(abstraction => abstraction.publicChangeKind)
  .map(abstraction => [abstraction.id, abstraction.publicChangeKind]));

const indexTheAbstractionIds = everyCodeUnderReview => new Map(everyCodeUnderReview
  .filter(codeUnderReview => codeUnderReview.abstractionId)
  .map(codeUnderReview => [codeUnderReview.id, codeUnderReview.abstractionId]));

const readTheFirstLine = finding => (finding.ownLines || {}).from || finding.line || 0;

export class ChangeKindsOfTheReport {
  constructor({ publicChangeKinds = null, abstractions = [], codeUnderReview = [] } = {}) {
    this.kinds = PublicChangeKinds.createFromJSON(publicChangeKinds);
    this.publicChangeKindByIdMap = indexThePublicChangeKindsById(abstractions);
    this.abstractionIdByCodeUnderReviewIdMap = indexTheAbstractionIds(codeUnderReview);
  }

  readKindOfTheFinding(finding) {
    const abstractionId = this.abstractionIdByCodeUnderReviewIdMap.get(finding.codeUnderReviewId);
    const known = abstractionId ? this.publicChangeKindByIdMap.get(abstractionId) : null;
    return known || this.kinds.readKindAtTheScale(String(finding.scale || ""), finding.file, readTheFirstLine(finding));
  }

  readKindAtThePlace(place) {
    return this.kinds.readKindAtThePlace(place.file, place.line);
  }
}
