export class PackageScope {
  constructor({ qualifiedReceiverIsAPackageMember = false, fileLevelValuesShareTheFolder = false } = {}) {
    this.qualifiedReceiverIsAPackageMember = qualifiedReceiverIsAPackageMember;
    this.fileLevelValuesShareTheFolder = fileLevelValuesShareTheFolder;
    Object.freeze(this);
  }

  isReceiverAPackageMember(call) {
    return this.qualifiedReceiverIsAPackageMember && Boolean(call.qualifier);
  }
}

export const NO_PACKAGE_SCOPE = new PackageScope();
