import { TestCode } from "../../inputs/source/TestCode.mjs";
import { findDriver } from "../../inputs/source/drivers/LanguageRegistry.mjs";
import { FinderContext } from "../finders/FinderContext.mjs";
import { TEST_KINDS, readTestKindAtTheHead } from "../abstractions/method/generic/testing/TestKinds.mjs";

export class TestRecognition {
  constructor({ change, walk, applications }) {
    const linesByPathMap = new Map(change.files.map(file => [file.path, file.lines]));
    this.testCode = new TestCode(filePath => linesByPathMap.get(filePath) || null);
    this.walk = walk;
    this.applications = applications;
  }

  isTestCode(filePath, lines) {
    return this.testCode.isTestCode(filePath, lines);
  }

  readTestKind(abstraction, headLine) {
    if (headLine === null) return this.isATestCallbackIn(abstraction.path, abstraction.name) ? TEST_KINDS.HOOK : TEST_KINDS.TEST;
    return readTestKindAtTheHead(this.walk.readTestFacts(abstraction.path), headLine);
  }

  isATestCallbackIn(filePath, name) {
    const driver = findDriver(filePath);
    const context = FinderContext.createForAWalkedFile(filePath, this.walk.findFrameworksMarkedInTheWalkedFile(filePath), this.applications);
    return Boolean(driver && driver.isTestCallback && driver.isTestCallback(name, context));
  }
}
