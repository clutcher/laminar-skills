export class ReturnsOfAnotherPrepareStop extends Error {
  constructor(returnsFile, plannedPrepareFingerprint, runFolder, preparedFingerprint) {
    super(`${returnsFile} holds judge returns planned from the prepare ${plannedPrepareFingerprint}, but prepare.json of ${runFolder} is the prepare ${preparedFingerprint}; run the judge workflow again on this prepare, or prepare again as the returns were planned`);
  }
}

export const isTakenUnchecked = prepareFingerprintOfAFile => !prepareFingerprintOfAFile.prepareFingerprint;

export const findTheReturnsOfAnotherPrepare = (prepareFingerprints, preparedFingerprint) => prepareFingerprints
  .find(prepareFingerprintOfAFile => !isTakenUnchecked(prepareFingerprintOfAFile) && prepareFingerprintOfAFile.prepareFingerprint !== preparedFingerprint) || null;
