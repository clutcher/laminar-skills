import { createHash } from "node:crypto";

const PREPARE_FINGERPRINT_LENGTH = 12;

const listTheFiledFields = codeUnderReview => [
  codeUnderReview.id,
  codeUnderReview.displayName,
  codeUnderReview.judgeType,
  (codeUnderReview.checks || []).map(check => check.id),
];

export const computePrepareFingerprint = everyCodeUnderReview => createHash("sha256")
  .update(JSON.stringify(everyCodeUnderReview.map(listTheFiledFields)))
  .digest("hex")
  .slice(0, PREPARE_FINGERPRINT_LENGTH);
